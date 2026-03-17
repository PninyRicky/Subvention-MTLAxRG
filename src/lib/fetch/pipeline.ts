import {
  Prisma,
  ProgramStatus,
  ReviewStatus,
  ScanMode,
  ScanScope,
  ScanStatus,
  type FundingProgram,
  type SourceRegistry,
} from "@prisma/client";

import { analyzeProgramPage } from "@/lib/ai/analyzer";
import { isAiEnabled } from "@/lib/ai/provider";
import type { AiProgramAnalysis, AiProgramEntry } from "@/lib/ai/schema";
import { env } from "@/lib/env";
import {
  discoverSourceDocuments,
  isGeneratedRegionalPortalSource,
  type DiscoveredDocument,
} from "@/lib/fetch/deep-scan";
import { parseProgramsFromSource, type ParsedProgramPayload } from "@/lib/fetch/parsers";
import { resolveWorkingOfficialUrls } from "@/lib/link-validation";
import { prisma } from "@/lib/prisma";
import { scoreProgramForProfile } from "@/lib/scoring";
import { hasRunToday } from "@/lib/scheduler";
import { isOfficialInstitutionUrl } from "@/lib/source-registry";

type PipelineOptions = {
  mode: ScanMode;
  scope?: ScanScope;
  initiatedById?: string | null;
  targetProgramId?: string | null;
};

type CachedAiProgramAnalysis = AiProgramAnalysis & {
  analysisVersion?: number;
  documentUrl?: string;
  documentType?: "HTML" | "PDF";
  depth?: number;
};

type ProcessingMetrics = {
  discoveredCount: number;
  updatedCount: number;
  closedCount: number;
  reviewCount: number;
  resolvedReviewCount: number;
  voletCount: number;
  htmlPageCount: number;
  pdfCount: number;
  failed: boolean;
};

type ProcessSourceOptions = {
  source: SourceRegistry;
  fetchRunId: string;
  mode: ScanMode;
  profiles: Awaited<ReturnType<typeof prisma.serviceProfile.findMany>>;
  deepScan: boolean;
  seedUrls?: string[];
  targetProgram?: FundingProgram | null;
};

const SOURCE_PROCESS_CONCURRENCY = 4;
const STALE_FETCH_RUN_TIMEOUT_MS = 20 * 60 * 1000;
const REVIEW_REASON = "Informations incomplètes ou ambiguës après collecte.";
const AI_ANALYSIS_CACHE_VERSION = 3;

function isProgramSeed(source: SourceRegistry) {
  const payload =
    source.fallbackPayload && typeof source.fallbackPayload === "object"
      ? (source.fallbackPayload as Record<string, unknown>)
      : null;

  return payload?.seedType === "program";
}

function createEmptyMetrics(): ProcessingMetrics {
  return {
    discoveredCount: 0,
    updatedCount: 0,
    closedCount: 0,
    reviewCount: 0,
    resolvedReviewCount: 0,
    voletCount: 0,
    htmlPageCount: 0,
    pdfCount: 0,
    failed: false,
  };
}

async function syncReviewQueueForProgram(programId: string, fetchRunId: string, parsed: ParsedProgramPayload) {
  const pendingReviews = await prisma.reviewQueue.findMany({
    where: {
      programId,
      status: ReviewStatus.PENDING,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!parsed.shouldReview) {
    if (!pendingReviews.length) {
      return { reviewCount: 0, resolvedReviewCount: 0 };
    }

    await prisma.reviewQueue.updateMany({
      where: {
        id: {
          in: pendingReviews.map((review) => review.id),
        },
      },
      data: {
        status: ReviewStatus.APPROVED,
        notes: "Résolu automatiquement par le dernier scan.",
        reviewedAt: new Date(),
      },
    });

    return { reviewCount: 0, resolvedReviewCount: pendingReviews.length };
  }

  const [primaryReview, ...duplicateReviews] = pendingReviews;

  if (primaryReview) {
    await prisma.reviewQueue.update({
      where: { id: primaryReview.id },
      data: {
        fetchRunId,
        reason: REVIEW_REASON,
        fields: parsed.reviewFields,
        notes: null,
        reviewedAt: null,
      },
    });
  } else {
    await prisma.reviewQueue.create({
      data: {
        programId,
        fetchRunId,
        reason: REVIEW_REASON,
        fields: parsed.reviewFields,
        status: ReviewStatus.PENDING,
      },
    });
  }

  if (duplicateReviews.length) {
    await prisma.reviewQueue.updateMany({
      where: {
        id: {
          in: duplicateReviews.map((review) => review.id),
        },
      },
      data: {
        status: ReviewStatus.APPROVED,
        notes: "Doublon de revue fermé automatiquement par le dernier scan.",
        reviewedAt: new Date(),
      },
    });
  }

  return {
    reviewCount: 1,
    resolvedReviewCount: duplicateReviews.length,
  };
}

export async function expireStaleFetchRuns() {
  const thresholdDate = new Date(Date.now() - STALE_FETCH_RUN_TIMEOUT_MS);

  const staleRuns = await prisma.fetchRun.findMany({
    where: {
      status: {
        in: [ScanStatus.QUEUED, ScanStatus.RUNNING],
      },
      OR: [
        { startedAt: { not: null, lt: thresholdDate } },
        { startedAt: null, createdAt: { lt: thresholdDate } },
      ],
    },
    select: {
      id: true,
    },
  });

  if (!staleRuns.length) {
    return 0;
  }

  await prisma.fetchRun.updateMany({
    where: {
      id: {
        in: staleRuns.map((run) => run.id),
      },
    },
    data: {
      status: ScanStatus.FAILED,
      finishedAt: new Date(),
      error: "Run expiré automatiquement après dépassement du temps maximal autorisé.",
    },
  });

  return staleRuns.length;
}

function buildProgramAuditAnalysis(
  aiAnalysis: AiProgramAnalysis | null,
  candidate: AiProgramEntry | null,
  document: DiscoveredDocument,
) {
  if (!aiAnalysis) {
    return null;
  }

  return {
    ...aiAnalysis,
    analysisVersion: AI_ANALYSIS_CACHE_VERSION,
    documentUrl: document.url,
    documentTitle: document.title,
    documentType: document.contentKind,
    depth: document.depth,
    selectedProgramName: candidate?.programName ?? null,
    selectedOfficialUrl: candidate?.officialUrl ?? null,
    selectedReviewReason: candidate?.reviewReason ?? null,
  };
}

async function getCachedAnalysisForDocument(sourceId: string, document: DiscoveredDocument) {
  const existingDoc = await prisma.sourceDocument.findFirst({
    where: {
      sourceId,
      url: document.url,
      contentHash: document.contentHash,
    },
    orderBy: {
      fetchedAt: "desc",
    },
  });

  if (!existingDoc) {
    return null;
  }

  const existingProgram = await prisma.fundingProgram.findFirst({
    where: {
      sourceId,
      aiAnalysis: { not: Prisma.AnyNull },
    },
    select: {
      aiAnalysis: true,
    },
  });

  const cached = existingProgram?.aiAnalysis as CachedAiProgramAnalysis | null;

  if (
    cached &&
    (cached.analysisVersion ?? 1) >= AI_ANALYSIS_CACHE_VERSION &&
    cached.documentUrl === document.url &&
    Array.isArray(cached.programs)
  ) {
    return cached;
  }

  return null;
}

async function analyzeDocument(
  source: SourceRegistry,
  document: DiscoveredDocument,
  mode: ScanMode,
): Promise<AiProgramAnalysis | null> {
  if (!isAiEnabled()) {
    return null;
  }

  if (mode !== ScanMode.MANUAL) {
    const cached = await getCachedAnalysisForDocument(source.id, document);
    if (cached) {
      return cached;
    }
  }

  const analysis = await analyzeProgramPage(document.textContent, {
    sourceName: source.name,
    sourceUrl: source.url,
    governmentLevel: source.governmentLevel ?? "A confirmer",
    documentUrl: document.url,
    documentType: document.contentKind,
    depth: document.depth,
  });

  if (!analysis) {
    return null;
  }

  return {
    ...analysis,
    analysisVersion: AI_ANALYSIS_CACHE_VERSION,
    documentUrl: document.url,
    documentType: document.contentKind,
    depth: document.depth,
  } as CachedAiProgramAnalysis;
}

function buildManualFallbackAnalysis(parsed: ParsedProgramPayload): AiProgramEntry {
  return {
    programName: parsed.name,
    officialUrl: parsed.officialUrl,
    status: parsed.status,
    statusReason: parsed.openStatusReason,
    closesAt: parsed.intakeWindow.closesAt?.toISOString().slice(0, 10) ?? null,
    opensAt: parsed.intakeWindow.opensAt?.toISOString().slice(0, 10) ?? null,
    rolling: parsed.intakeWindow.rolling,
    organization: parsed.organization,
    summary: parsed.summary,
    maxAmount: parsed.maxAmount,
    maxCoveragePct: parsed.maxCoveragePct,
    applicantTypes: parsed.applicantTypes,
    sectors: parsed.sectors,
    projectStages: parsed.projectStages,
    eligibleExpenses: parsed.eligibleExpenses,
    eligibleProfessionalServices: parsed.eligibleProfessionalServices,
    eligibilityNotes: parsed.eligibilityNotes,
    applicationNotes: parsed.applicationNotes,
    details: parsed.details,
    confidence: parsed.confidence,
    reviewReason: parsed.shouldReview ? parsed.reviewFields.join(", ") : null,
  };
}

async function upsertProgramFromParsedPayload({
  source,
  parsed,
  profiles,
  fetchRunId,
  aiAnalysis,
  aiProgramCandidate,
  document,
  targetProgram,
}: {
  source: SourceRegistry;
  parsed: ParsedProgramPayload;
  profiles: Awaited<ReturnType<typeof prisma.serviceProfile.findMany>>;
  fetchRunId: string;
  aiAnalysis: AiProgramAnalysis | null;
  aiProgramCandidate: AiProgramEntry | null;
  document: DiscoveredDocument;
  targetProgram?: FundingProgram | null;
}) {
  const resolvedUrls = await resolveWorkingOfficialUrls({
    officialUrl: parsed.officialUrl,
    sourceLandingUrl: parsed.sourceLandingUrl ?? source.url,
    sourceUrl: source.url,
  });
  const forcedClosedBecauseBrokenDirectUrl =
    isProgramSeed(source) &&
    !resolvedUrls.directOfficialUrlValid &&
    parsed.status !== ProgramStatus.CLOSED;
  const finalStatus = forcedClosedBecauseBrokenDirectUrl ? ProgramStatus.CLOSED : parsed.status;
  const finalOpenStatusReason = forcedClosedBecauseBrokenDirectUrl
    ? `La page officielle directe du programme n’est plus valide (${resolvedUrls.directOfficialUrlStatus ?? "statut inconnu"}). Le programme est traité comme fermé ou retiré jusqu’à validation contraire sur une fiche officielle active.`
    : parsed.openStatusReason;
  const effectiveParsed: ParsedProgramPayload = forcedClosedBecauseBrokenDirectUrl
    ? {
        ...parsed,
        status: finalStatus,
        openStatusReason: finalOpenStatusReason,
        shouldReview: false,
        reviewFields: parsed.reviewFields.filter((field) => field !== "status"),
      }
    : parsed;

  const existingProgram = targetProgram
    ? await prisma.fundingProgram.findUnique({
        where: { id: targetProgram.id },
      })
    : isProgramSeed(source)
      ? await prisma.fundingProgram.findFirst({
          where: {
            sourceId: source.id,
          },
          orderBy: {
            updatedAt: "desc",
          },
        })
      : await prisma.fundingProgram.findUnique({
          where: {
            slug: parsed.slug,
          },
        });

  const storedAnalysis =
    buildProgramAuditAnalysis(aiAnalysis, aiProgramCandidate, document) ??
    buildProgramAuditAnalysis(
      { programs: [buildManualFallbackAnalysis(parsed)] },
      buildManualFallbackAnalysis(parsed),
      document,
    );

  const programPayload = {
    name: parsed.name,
    organization: parsed.organization,
    summary: parsed.summary,
    officialUrl: resolvedUrls.officialUrl,
    sourceLandingUrl: resolvedUrls.sourceLandingUrl,
    governmentLevel: parsed.governmentLevel,
    region: parsed.region,
    status: finalStatus,
    confidence: parsed.confidence,
    applicantTypes: parsed.applicantTypes,
    sectors: parsed.sectors,
    projectStages: parsed.projectStages,
    eligibleExpenses: parsed.eligibleExpenses,
    eligibleProfessionalServices: parsed.eligibleProfessionalServices,
    maxAmount: parsed.maxAmount,
    maxCoveragePct: parsed.maxCoveragePct,
    details: parsed.details,
    eligibilityNotes: parsed.eligibilityNotes,
    applicationNotes: parsed.applicationNotes,
    openStatusReason: finalOpenStatusReason,
    sourceId: source.id,
    lastVerifiedAt: new Date(),
    ...(storedAnalysis ? { aiAnalysis: storedAnalysis, aiAnalyzedAt: new Date() } : {}),
  };

  const program = targetProgram || (isProgramSeed(source) && existingProgram)
    ? await prisma.fundingProgram.update({
        where: { id: (targetProgram ?? existingProgram)!.id },
        data: programPayload,
      })
    : await prisma.fundingProgram.upsert({
        where: {
          slug: parsed.slug,
        },
        update: programPayload,
        create: {
          slug: parsed.slug,
          ...programPayload,
        },
      });

  if (isProgramSeed(source)) {
    await prisma.fundingProgram.deleteMany({
      where: {
        sourceId: source.id,
        id: {
          not: program.id,
        },
      },
    });
  }

  if (targetProgram?.sourceId === source.id) {
    const currentPayload =
      source.fallbackPayload && typeof source.fallbackPayload === "object"
        ? (source.fallbackPayload as Record<string, unknown>)
        : null;
    const seedType = typeof currentPayload?.seedType === "string" ? currentPayload.seedType : null;

    await prisma.sourceRegistry.update({
      where: { id: source.id },
      data: {
        ...(seedType === "program" ? { url: resolvedUrls.officialUrl } : {}),
        fallbackPayload: buildUpdatedSourceFallbackPayload(source, {
          ...parsed,
          status: finalStatus,
          openStatusReason: finalOpenStatusReason,
          officialUrl: resolvedUrls.officialUrl,
          sourceLandingUrl: resolvedUrls.sourceLandingUrl,
        }),
      },
    });
  }

  await prisma.intakeWindow.deleteMany({
    where: {
      programId: program.id,
    },
  });

  await prisma.intakeWindow.create({
    data: {
      programId: program.id,
      rolling: parsed.intakeWindow.rolling,
      opensAt: parsed.intakeWindow.opensAt ?? null,
      closesAt: parsed.intakeWindow.closesAt ?? null,
      lastConfirmedAt: new Date(),
    },
  });

  const hydratedProgram = await prisma.fundingProgram.findUniqueOrThrow({
    where: { id: program.id },
    include: {
      intakeWindows: true,
    },
  });

  for (const profile of profiles) {
    const result = scoreProgramForProfile(hydratedProgram, profile);

    await prisma.matchResult.upsert({
      where: {
        programId_profileId: {
          programId: hydratedProgram.id,
          profileId: profile.id,
        },
      },
      update: result,
      create: {
        ...result,
        programId: hydratedProgram.id,
        profileId: profile.id,
      },
    });
  }

  const reviewResult = await syncReviewQueueForProgram(program.id, fetchRunId, effectiveParsed);

  return {
    discoveredCount: existingProgram ? 0 : 1,
    updatedCount: existingProgram ? 1 : 0,
    closedCount: finalStatus === ProgramStatus.CLOSED ? 1 : 0,
    reviewCount: reviewResult.reviewCount,
    resolvedReviewCount: reviewResult.resolvedReviewCount,
    voletCount: 1,
  };
}

async function processDocumentForSource({
  source,
  document,
  fetchRunId,
  mode,
  profiles,
  targetProgram,
}: {
  source: SourceRegistry;
  document: DiscoveredDocument;
  fetchRunId: string;
  mode: ScanMode;
  profiles: Awaited<ReturnType<typeof prisma.serviceProfile.findMany>>;
  targetProgram?: FundingProgram | null;
}) {
  const metrics = createEmptyMetrics();

  await prisma.sourceDocument.create({
    data: {
      sourceId: source.id,
      fetchRunId,
      url: document.url,
      title: document.title,
      rawContent: document.rawContent,
      contentHash: document.contentHash,
    },
  });

  const aiAnalysis = await analyzeDocument(source, document, mode);
  const parsedPrograms = parseProgramsFromSource(
    source,
    document.contentKind === "HTML" ? document.rawContent : null,
    (source.fallbackPayload ?? null) as Record<string, unknown> | null,
    aiAnalysis,
    document.textContent,
  );
  const parsedProgramsToProcess = targetProgram
    ? selectParsedProgramsForTarget(targetProgram, parsedPrograms)
    : parsedPrograms;

  const aiPrograms = aiAnalysis?.programs ?? [];

  for (const parsed of parsedProgramsToProcess) {
    const aiProgramCandidate =
      aiPrograms.find((candidate) => candidate.programName && parsed.name.includes(candidate.programName)) ??
      aiPrograms.find((candidate) => candidate.officialUrl === parsed.officialUrl) ??
      aiPrograms[0] ??
      null;

    const programMetrics = await upsertProgramFromParsedPayload({
      source,
      parsed,
      profiles,
      fetchRunId,
      aiAnalysis,
      aiProgramCandidate,
      document,
      targetProgram,
    });

    metrics.discoveredCount += programMetrics.discoveredCount;
    metrics.updatedCount += programMetrics.updatedCount;
    metrics.closedCount += programMetrics.closedCount;
    metrics.reviewCount += programMetrics.reviewCount;
    metrics.resolvedReviewCount += programMetrics.resolvedReviewCount;
    metrics.voletCount += programMetrics.voletCount;
  }

  metrics.htmlPageCount += document.contentKind === "HTML" ? 1 : 0;
  metrics.pdfCount += document.contentKind === "PDF" ? 1 : 0;

  return metrics;
}

function getSeedUrlsForProgram(program: Pick<FundingProgram, "officialUrl" | "sourceLandingUrl">, source: SourceRegistry) {
  const seedCandidates = [program.officialUrl, program.sourceLandingUrl, source.url];
  const uniqueUrls = new Set<string>();

  for (const candidate of seedCandidates) {
    if (!candidate || !candidate.startsWith("http")) {
      continue;
    }

    if (!isOfficialInstitutionUrl(candidate)) {
      continue;
    }

    uniqueUrls.add(candidate);
  }

  return [...uniqueUrls];
}

function normalizeProgramComparisonText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreParsedProgramAgainstTarget(targetProgram: FundingProgram, parsed: ParsedProgramPayload) {
  let score = 0;
  const targetName = normalizeProgramComparisonText(targetProgram.name);
  const parsedName = normalizeProgramComparisonText(parsed.name);
  const targetOfficialUrl = targetProgram.officialUrl.trim();
  const targetSourceLandingUrl = targetProgram.sourceLandingUrl?.trim();

  if (parsed.officialUrl === targetOfficialUrl) {
    score += 20;
  }

  if (targetSourceLandingUrl && parsed.officialUrl === targetSourceLandingUrl) {
    score += 12;
  }

  if (parsed.sourceLandingUrl && parsed.sourceLandingUrl === targetOfficialUrl) {
    score += 8;
  }

  if (parsedName === targetName) {
    score += 16;
  }

  if (parsedName.includes(targetName) || targetName.includes(parsedName)) {
    score += 10;
  }

  const targetWords = new Set(targetName.split(" ").filter((word) => word.length > 3));
  const parsedWords = new Set(parsedName.split(" ").filter((word) => word.length > 3));

  for (const word of targetWords) {
    if (parsedWords.has(word)) {
      score += 2;
    }
  }

  score += Math.round(parsed.confidence / 20);

  return score;
}

function selectParsedProgramsForTarget(targetProgram: FundingProgram, parsedPrograms: ParsedProgramPayload[]) {
  if (!parsedPrograms.length) {
    return [];
  }

  const ranked = [...parsedPrograms].sort(
    (left, right) =>
      scoreParsedProgramAgainstTarget(targetProgram, right) -
      scoreParsedProgramAgainstTarget(targetProgram, left),
  );

  return [ranked[0]];
}

function buildUpdatedSourceFallbackPayload(source: SourceRegistry, parsed: ParsedProgramPayload) {
  const currentPayload =
    source.fallbackPayload && typeof source.fallbackPayload === "object"
      ? (source.fallbackPayload as Record<string, unknown>)
      : {};

  return {
    ...currentPayload,
    name: parsed.name,
    organization: parsed.organization,
    summary: parsed.summary,
    officialUrl: parsed.officialUrl,
    governmentLevel: parsed.governmentLevel,
    region: parsed.region,
    status: parsed.status,
    confidence: parsed.confidence,
    details: parsed.details,
    eligibilityNotes: parsed.eligibilityNotes,
    applicationNotes: parsed.applicationNotes,
    applicantTypes: parsed.applicantTypes,
    sectors: parsed.sectors,
    projectStages: parsed.projectStages,
    eligibleExpenses: parsed.eligibleExpenses,
    eligibleProfessionalServices: parsed.eligibleProfessionalServices,
    maxAmount: parsed.maxAmount,
    maxCoveragePct: parsed.maxCoveragePct,
    openStatusReason: parsed.openStatusReason,
    intakeWindow: {
      rolling: parsed.intakeWindow.rolling,
      opensAt: parsed.intakeWindow.opensAt?.toISOString() ?? null,
      closesAt: parsed.intakeWindow.closesAt?.toISOString() ?? null,
    },
  };
}

async function processSourceForFetchRun({
  source,
  fetchRunId,
  mode,
  profiles,
  deepScan,
  seedUrls,
  targetProgram,
}: ProcessSourceOptions) {
  try {
    const discovery = await discoverSourceDocuments(source, {
      manualMode: deepScan,
      seedUrls,
    });
    const metrics = createEmptyMetrics();

    for (const document of discovery.documents) {
      const documentMetrics = await processDocumentForSource({
        source,
        document,
        fetchRunId,
        mode,
        profiles,
        targetProgram,
      });

      metrics.discoveredCount += documentMetrics.discoveredCount;
      metrics.updatedCount += documentMetrics.updatedCount;
      metrics.closedCount += documentMetrics.closedCount;
      metrics.reviewCount += documentMetrics.reviewCount;
      metrics.resolvedReviewCount += documentMetrics.resolvedReviewCount;
      metrics.voletCount += documentMetrics.voletCount;
      metrics.htmlPageCount += documentMetrics.htmlPageCount;
      metrics.pdfCount += documentMetrics.pdfCount;
    }

    return metrics;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Echec de traitement pour ${source.url}:`, error);
    }

    return {
      ...createEmptyMetrics(),
      failed: true,
    };
  }
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>,
) {
  const results: TResult[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  const workerCount = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

export async function executeFetchRun({
  mode,
  initiatedById,
  scope = ScanScope.GLOBAL,
  targetProgramId,
}: PipelineOptions) {
  await expireStaleFetchRuns();

  const running = await prisma.fetchRun.findFirst({
    where: {
      status: {
        in: [ScanStatus.QUEUED, ScanStatus.RUNNING],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (running) {
    return running;
  }

  if (mode === ScanMode.SCHEDULED) {
    const latestScheduledRun = await prisma.fetchRun.findFirst({
      where: {
        mode: ScanMode.SCHEDULED,
        status: ScanStatus.COMPLETED,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (hasRunToday(latestScheduledRun?.createdAt)) {
      return latestScheduledRun;
    }
  }

  let targetProgram:
    | (FundingProgram & {
        source: SourceRegistry | null;
      })
    | null = null;

  if (scope === ScanScope.PROGRAM) {
    if (!targetProgramId) {
      throw new Error("Programme cible manquant pour le scan approfondi.");
    }

    targetProgram = await prisma.fundingProgram.findUnique({
      where: { id: targetProgramId },
      include: {
        source: true,
      },
    });

    if (!targetProgram) {
      throw new Error("Programme introuvable pour le scan approfondi.");
    }

    if (!targetProgram.source || !isOfficialInstitutionUrl(targetProgram.source.url)) {
      throw new Error("Aucune source officielle exploitable n’est rattachée à ce programme.");
    }
  }

  const fetchRun = await prisma.fetchRun.create({
    data: {
      mode,
      scope,
      status: ScanStatus.RUNNING,
      startedAt: new Date(),
      initiatedById: initiatedById ?? null,
      targetProgramId: targetProgram?.id ?? null,
      targetSourceId: targetProgram?.sourceId ?? null,
      targetLabel: targetProgram?.name ?? null,
    },
  });

  try {
    const profiles = await prisma.serviceProfile.findMany({
      where: { active: true },
    });

    let discoveredCount = 0;
    let updatedCount = 0;
    let closedCount = 0;
    let reviewCount = 0;
    let resolvedReviewCount = 0;
    let htmlPageCount = 0;
    let pdfCount = 0;
    let voletCount = 0;

    const sourceJobs: Array<{
      source: SourceRegistry;
      deepScan: boolean;
      seedUrls?: string[];
      targetProgram?: FundingProgram | null;
    }> = [];

    if (scope === ScanScope.PROGRAM && targetProgram?.source) {
      sourceJobs.push({
        source: targetProgram.source,
        deepScan: true,
        seedUrls: getSeedUrlsForProgram(targetProgram, targetProgram.source),
        targetProgram,
      });
    } else {
      const sources = await prisma.sourceRegistry.findMany({
        where: {
          active: true,
          type: "OFFICIAL",
        },
      });

      const officialSources = sources.filter((source) => isOfficialInstitutionUrl(source.url));
      const sourcesToProcess =
        mode === ScanMode.MANUAL
          ? officialSources.filter((source) => !isGeneratedRegionalPortalSource(source))
          : officialSources;

      sourceJobs.push(
        ...sourcesToProcess.map((source) => ({
          source,
          deepScan: false,
        })),
      );
    }

    const sourceResults = await mapWithConcurrency(sourceJobs, SOURCE_PROCESS_CONCURRENCY, (job) =>
      processSourceForFetchRun({
        source: job.source,
        fetchRunId: fetchRun.id,
        mode,
        profiles,
        deepScan: job.deepScan,
        seedUrls: job.seedUrls,
        targetProgram: job.targetProgram,
      }),
    );

    for (const result of sourceResults) {
      discoveredCount += result.discoveredCount;
      updatedCount += result.updatedCount;
      closedCount += result.closedCount;
      reviewCount += result.reviewCount;
      resolvedReviewCount += result.resolvedReviewCount;
      htmlPageCount += result.htmlPageCount;
      pdfCount += result.pdfCount;
      voletCount += result.voletCount;
    }

    return await prisma.fetchRun.update({
      where: { id: fetchRun.id },
      data: {
        status: ScanStatus.COMPLETED,
        sourceCount: sourceJobs.length,
        discoveredCount,
        updatedCount,
        closedCount,
        reviewCount,
        resolvedReviewCount,
        htmlPageCount,
        pdfCount,
        voletCount,
        finishedAt: new Date(),
        notes:
          scope === ScanScope.PROGRAM
            ? `Scan approfondi ciblé sur le programme avec crawl BFS limité, PDF, volets et URL officielles directes.`
            : mode === ScanMode.MANUAL
              ? `Scan de veille global avec collecte officielle légère et mise à jour rapide des programmes pertinents.`
              : `Scan planifié léger avec collecte officielle et analyse ciblée.`,
      },
    });
  } catch (error) {
    return await prisma.fetchRun.update({
      where: { id: fetchRun.id },
      data: {
        status: ScanStatus.FAILED,
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : "Echec inconnu du pipeline.",
      },
    });
  }
}

export function isCronAuthorized(request: Request) {
  const header = request.headers.get("authorization");
  return header === `Bearer ${env.cronSecret}`;
}
