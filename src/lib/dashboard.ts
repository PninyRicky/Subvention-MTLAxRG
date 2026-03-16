import { MatchStatus, ProgramStatus, ReviewStatus, ScanStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getDashboardData() {
  const [programs, reviewQueue, latestRun, profiles] = await Promise.all([
    prisma.fundingProgram.findMany({
      include: {
        intakeWindows: true,
        matchResults: {
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
  ]);

  const stats = {
    openPrograms: programs.filter((program) => program.status === ProgramStatus.OPEN).length,
    reviewPrograms: programs.filter((program) => program.status === ProgramStatus.REVIEW).length,
    eligibleMatches: programs.flatMap((program) => program.matchResults).filter((result) => result.status === MatchStatus.ELIGIBLE).length,
    reviewQueue,
    activeProfiles: profiles.filter((profile) => profile.active).length,
    runningScan: latestRun?.status === ScanStatus.RUNNING,
  };

  return {
    programs,
    reviewQueue,
    latestRun,
    profiles,
    stats,
  };
}
