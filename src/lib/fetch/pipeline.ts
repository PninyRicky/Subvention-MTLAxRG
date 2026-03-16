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

async function fetchSourceHtml(source: SourceRegistry) {
  try {
    const response = await fetch(source.url, {
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
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Echec de collecte pour ${source.url}:`, error);
    }
    return null;
  }
}

export async function executeFetchRun({ mode, initiatedById }: PipelineOptions) {
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

    for (const source of officialSources) {
      const html = await fetchSourceHtml(source);
      const rawContent = html ?? JSON.stringify(source.fallbackPayload ?? {});
      const contentHash = hashContent(rawContent);

      let aiAnalysis: AiProgramAnalysis | null = null;
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

        if (existingAi?.aiAnalysis) {
          aiAnalysis = existingAi.aiAnalysis as unknown as AiProgramAnalysis;
        } else {
          const bodyText = html
            ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            : JSON.stringify(source.fallbackPayload ?? {});
          aiAnalysis = await analyzeProgramPage(bodyText, {
            sourceName: source.name,
            sourceUrl: source.url,
            governmentLevel: source.governmentLevel ?? "A confirmer",
          });
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
          fetchRunId: fetchRun.id,
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

      discoveredCount += existingProgram ? 0 : 1;
      updatedCount += existingProgram ? 1 : 0;
      closedCount += parsed.status === ProgramStatus.CLOSED ? 1 : 0;

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

      if (parsed.shouldReview) {
        reviewCount += 1;
        await prisma.reviewQueue.create({
          data: {
            programId: program.id,
            fetchRunId: fetchRun.id,
            reason: "Informations incompletes ou ambigues apres collecte.",
            fields: parsed.reviewFields,
            status: ReviewStatus.PENDING,
          },
        });
      }
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
            ? "Scan lance manuellement depuis l'interface."
            : "Scan planifie par le scheduler Vercel.",
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
