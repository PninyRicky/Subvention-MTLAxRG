import { MatchStatus, ProgramStatus, ReviewStatus, ScanStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const [openPrograms, reviewPrograms, reviewQueue, eligibleMatches, latestRun] = await Promise.all([
    prisma.fundingProgram.count({
      where: { status: ProgramStatus.OPEN },
    }),
    prisma.fundingProgram.count({
      where: { status: ProgramStatus.REVIEW },
    }),
    prisma.reviewQueue.count({
      where: { status: ReviewStatus.PENDING },
    }),
    prisma.matchResult.count({
      where: { status: MatchStatus.ELIGIBLE },
    }),
    prisma.fetchRun.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return NextResponse.json({
    openPrograms,
    reviewPrograms,
    reviewQueue,
    eligibleMatches,
    latestRun,
    scanInProgress: latestRun?.status === ScanStatus.RUNNING,
  });
}
