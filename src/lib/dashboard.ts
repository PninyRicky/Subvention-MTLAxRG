import { MatchStatus, ProgramStatus, Prisma, ReviewStatus, ScanStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { MIN_VISIBLE_PROGRAM_SCORE, buildVisibleProgramWhere } from "@/lib/program-visibility";

export type DashboardFilters = {
  status?: ProgramStatus;
  region?: "montreal" | "quebec";
  focus?: "cinema-creation" | "obnl-development";
};

function getDashboardProgramWhere(filters: DashboardFilters): Prisma.FundingProgramWhereInput {
  const conditions: Prisma.FundingProgramWhereInput[] = [buildVisibleProgramWhere()];

  if (filters.status) {
    conditions.push({ status: filters.status });
  }

  if (filters.region === "montreal") {
    conditions.push({
      OR: [
        { region: { equals: "Montreal", mode: Prisma.QueryMode.insensitive } },
        { organization: { contains: "Montreal", mode: Prisma.QueryMode.insensitive } },
        { name: { contains: "Montreal", mode: Prisma.QueryMode.insensitive } },
        { source: { is: { name: { contains: "Montreal", mode: Prisma.QueryMode.insensitive } } } },
        { source: { is: { url: { contains: "montreal.ca" } } } },
      ],
    });
  }

  if (filters.region === "quebec") {
    conditions.push({
      OR: [
        { region: { equals: "Capitale-Nationale", mode: Prisma.QueryMode.insensitive } },
        { organization: { contains: "Ville de Quebec", mode: Prisma.QueryMode.insensitive } },
        { name: { contains: "Ville de Quebec", mode: Prisma.QueryMode.insensitive } },
        { source: { is: { name: { contains: "Ville de Quebec", mode: Prisma.QueryMode.insensitive } } } },
        { source: { is: { url: { contains: "ville.quebec.qc.ca" } } } },
      ],
    });
  }

  if (filters.focus === "cinema-creation") {
    conditions.push({
      OR: [
        { sectors: { hasSome: ["audiovisuel", "cinema", "production video", "arts", "creation"] } },
        { name: { contains: "cinema", mode: Prisma.QueryMode.insensitive } },
        { name: { contains: "culture", mode: Prisma.QueryMode.insensitive } },
        { summary: { contains: "audiovisuel", mode: Prisma.QueryMode.insensitive } },
        { summary: { contains: "creation", mode: Prisma.QueryMode.insensitive } },
      ],
    });
  }

  if (filters.focus === "obnl-development") {
    conditions.push({
      OR: [
        { applicantTypes: { hasSome: ["OBNL", "Organisme communautaire", "Organisme culturel", "Cooperative"] } },
        { eligibleExpenses: { hasSome: ["branding", "marketing", "site web", "rayonnement", "communications"] } },
        { summary: { contains: "organisme", mode: Prisma.QueryMode.insensitive } },
        { summary: { contains: "obnl", mode: Prisma.QueryMode.insensitive } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getDashboardData(filters: DashboardFilters = {}) {
  const programWhere = getDashboardProgramWhere(filters);

  const [programs, reviewQueue, latestRun, profiles, openPrograms, reviewPrograms, eligibleMatches] = await Promise.all([
    prisma.fundingProgram.findMany({
      where: programWhere,
      include: {
        intakeWindows: true,
        matchResults: {
          where: {
            score: {
              gte: 55,
            },
          },
          include: {
            profile: true,
          },
          orderBy: {
            score: "desc",
          },
        },
      },
      orderBy: [
        {
          status: "asc",
        },
        {
          confidence: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
      take: 8,
    }),
    prisma.reviewQueue.count({
      where: {
        status: ReviewStatus.PENDING,
        program: buildVisibleProgramWhere(),
      },
    }),
    prisma.fetchRun.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.serviceProfile.findMany({
      include: {
        matches: true,
      },
    }),
    prisma.fundingProgram.count({
      where: {
        ...buildVisibleProgramWhere(),
        status: ProgramStatus.OPEN,
      },
    }),
    prisma.fundingProgram.count({
      where: {
        ...buildVisibleProgramWhere(),
        status: ProgramStatus.REVIEW,
      },
    }),
    prisma.matchResult.count({
      where: {
        status: MatchStatus.ELIGIBLE,
        score: {
          gte: MIN_VISIBLE_PROGRAM_SCORE,
        },
      },
    }),
  ]);

  const stats = {
    openPrograms,
    reviewPrograms,
    eligibleMatches,
    reviewQueue,
    activeProfiles: profiles.filter((profile) => profile.active).length,
    runningScan: latestRun?.status === ScanStatus.RUNNING,
  };

  return {
    filters,
    programs,
    reviewQueue,
    latestRun,
    profiles,
    stats,
  };
}
