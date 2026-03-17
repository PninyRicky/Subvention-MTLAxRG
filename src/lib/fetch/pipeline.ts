import { Prisma, ProgramStatus, ReviewStatus, ScanMode, ScanStatus, type SourceRegistry } from "@prisma/client";

import { analyzeProgramPage } from "@/lib/ai/analyzer";
import { isAiEnabled } from "@/lib/ai/provider";
import type { AiProgramAnalysis } from "@/lib/ai/schema";
import { env } from "@/lib/env";
import { parseProgramFromSource } from "@/lib/fetch/parsers";
import { resolveWorkingOfficialUrls } from "@/lib/link-validation";
import { prisma } from "@/lib/prisma";
import { scoreProgramForProfile } from "@/lib/scoring";
import { hasRunToday } from "@/lib/scheduler";
import { isOfficialInstitutionUrl } from "@/lib/source-registry";
import { hashContent } from "@/lib/utils";

type PipelineOptions = {
  mode: ScanMode;
  initiatedById?: string | null;
};

type ParsedProgram = ReturnType<typeof parseProgramFromSource>;
type CachedAiProgramAnalysis = AiProgramAnalysis & { analysisVersion?: number };

const SOURCE_FETCH_TIMEOUT_MS = 8_000;
const SOURCE_FETCH_MAX_ATTEMPTS = 2;
const SOURCE_PROCESS_CONCURRENCY = 4;
const STALE_FETCH_RUN_TIMEOUT_MS = 20 * 60 * 1000;
const REVIEW_REASON = "Informations incomplètes ou ambiguës après collecte.";
const AI_ANALYSIS_CACHE_VERSION = 2;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSourceHtml(source: SourceRegistry) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= SOURCE_FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(source.url, {
        signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
        headers: {
          "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
        },
        next: {
          revalidate: 0,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;

      if (attempt < SOURCE_FETCH_MAX_ATTEMPTS) {
        await wait(350 * attempt);
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(`Echec de collecte pour ${source.url}:`, lastError);
  }

  return null;
}

async function syncReviewQueueForProgram(programId: string, fetchRunId: string, parsed: ParsedProgram) {
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
      return 0;
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

    return 0;
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

  return 1;
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

async function processSourceForFetchRun({
  source,
  fetchRunId,
  mode,
  profiles,
}: {
  source: SourceRegistry;
  fetchRunId: string;
  mode: ScanMode;
  profiles: Awaited<ReturnType<typeof prisma.serviceProfile.findMany>>;
}) {
  try {
    const html = await fetchSourceHtml(source);
    const rawContent = html ?? JSON.stringify(source.fallbackPayload ?? {});
    const contentHash = hashContent(rawContent);

    let aiAnalysis: CachedAiProgramAnalysis | null = null;
    if (isAiEnabled()) {
      const existingDoc = await prisma.sourceDocument.findFirst({
        where: { sourceId: source.id, contentHash },
        orderBy: { fetchedAt: "desc" },
      });

      const existingAi = existingDoc
        ? await prisma.fundingProgram.findFirst({
            where: { sourceId: source.id, aiAnalysis: { not: Prisma.AnyNull } },
            select: { aiAnalysis: true },
          })
        : null;
      const cachedAnalysis = existingAi?.aiAnalysis as CachedAiProgramAnalysis | null;
      const canReuseCachedAnalysis =
        mode !== ScanMode.MANUAL &&
        cachedAnalysis &&
        (cachedAnalysis.analysisVersion ?? 1) >= AI_ANALYSIS_CACHE_VERSION;

      if (canReuseCachedAnalysis) {
        aiAnalysis = cachedAnalysis;
      } else {
        const bodyText = html
          ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
          : JSON.stringify(source.fallbackPayload ?? {});
        const freshAnalysis = await analyzeProgramPage(bodyText, {
          sourceName: source.name,
          sourceUrl: source.url,
          governmentLevel: source.governmentLevel ?? "A confirmer",
        });
        aiAnalysis = freshAnalysis ? { ...freshAnalysis, analysisVersion: AI_ANALYSIS_CACHE_VERSION } : null;
      }
    }

    const parsed = parseProgramFromSource(
      source,
      html,
      (source.fallbackPayload ?? null) as Record<string, unknown> | null,
      aiAnalysis,
    );
    const resolvedUrls = await resolveWorkingOfficialUrls({
      officialUrl: parsed.officialUrl,
      sourceLandingUrl: parsed.sourceLandingUrl ?? source.url,
      sourceUrl: source.url,
    });

    await prisma.sourceDocument.create({
      data: {
        sourceId: source.id,
        fetchRunId,
        url: source.url,
        title: parsed.name,
        rawContent,
        contentHash,
      },
    });

    const existingProgram = await prisma.fundingProgram.findUnique({
      where: {
        slug: parsed.slug,
      },
      include: {
        intakeWindows: true,
        matchResults: true,
      },
    });

    const program = await prisma.fundingProgram.upsert({
      where: {
        slug: parsed.slug,
      },
      update: {
        name: parsed.name,
        organization: parsed.organization,
        summary: parsed.summary,
        officialUrl: resolvedUrls.officialUrl,
        sourceLandingUrl: resolvedUrls.sourceLandingUrl,
        governmentLevel: parsed.governmentLevel,
        region: parsed.region,
        status: parsed.status,
        confidence: parsed.confidence,
        applicantTypes: parsed.applicantTypes,
        sectors: parsed.sectors,
        projectStages: parsed.projectStages,
        eligibleExpenses: parsed.eligibleExpenses,
        maxAmount: parsed.maxAmount,
        maxCoveragePct: parsed.maxCoveragePct,
        details: parsed.details,
        eligibilityNotes: parsed.eligibilityNotes,
        applicationNotes: parsed.applicationNotes,
        openStatusReason: parsed.openStatusReason,
        sourceId: source.id,
        lastVerifiedAt: new Date(),
        ...(aiAnalysis ? { aiAnalysis, aiAnalyzedAt: new Date() } : {}),
      },
      create: {
        slug: parsed.slug,
        name: parsed.name,
        organization: parsed.organization,
        summary: parsed.summary,
        officialUrl: resolvedUrls.officialUrl,
        sourceLandingUrl: resolvedUrls.sourceLandingUrl,
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
        maxAmount: parsed.maxAmount,
        maxCoveragePct: parsed.maxCoveragePct,
        openStatusReason: parsed.openStatusReason,
        sourceId: source.id,
        lastVerifiedAt: new Date(),
        ...(aiAnalysis ? { aiAnalysis, aiAnalyzedAt: new Date() } : {}),
      },
    });

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

    const reviewCount = await syncReviewQueueForProgram(program.id, fetchRunId, parsed);

    return {
      discoveredCount: existingProgram ? 0 : 1,
      updatedCount: existingProgram ? 1 : 0,
      closedCount: parsed.status === ProgramStatus.CLOSED ? 1 : 0,
      reviewCount,
      failed: false,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Echec de traitement pour ${source.url}:`, error);
    }

    return {
      discoveredCount: 0,
      updatedCount: 0,
      closedCount: 0,
      reviewCount: 0,
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

export async function executeFetchRun({ mode, initiatedById }: PipelineOptions) {
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

  const fetchRun = await prisma.fetchRun.create({
    data: {
      mode,
      status: ScanStatus.RUNNING,
      startedAt: new Date(),
      initiatedById: initiatedById ?? null,
    },
  });

  try {
    const [sources, profiles] = await Promise.all([
      prisma.sourceRegistry.findMany({
        where: {
          active: true,
          type: "OFFICIAL",
        },
      }),
      prisma.serviceProfile.findMany({
        where: { active: true },
      }),
    ]);

    let discoveredCount = 0;
    let updatedCount = 0;
    let closedCount = 0;
    let reviewCount = 0;
    const officialSources = sources.filter((source) => isOfficialInstitutionUrl(source.url));
    const sourceResults = await mapWithConcurrency(officialSources, SOURCE_PROCESS_CONCURRENCY, (source) =>
      processSourceForFetchRun({
        source,
        fetchRunId: fetchRun.id,
        mode,
        profiles,
      }),
    );

    for (const result of sourceResults) {
      discoveredCount += result.discoveredCount;
      updatedCount += result.updatedCount;
      closedCount += result.closedCount;
      reviewCount += result.reviewCount;
    }

    return await prisma.fetchRun.update({
      where: { id: fetchRun.id },
      data: {
        status: ScanStatus.COMPLETED,
        sourceCount: officialSources.length,
        discoveredCount,
        updatedCount,
        closedCount,
        reviewCount,
        finishedAt: new Date(),
        notes:
          mode === ScanMode.MANUAL
            ? `Scan lance manuellement depuis l'interface avec concurrence ${SOURCE_PROCESS_CONCURRENCY}.`
            : `Scan planifie par le scheduler Vercel avec concurrence ${SOURCE_PROCESS_CONCURRENCY}.`,
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
