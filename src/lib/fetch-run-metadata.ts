import { ScanStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getLatestCompletedScanMap(labels: string[]) {
  const uniqueLabels = [...new Set(labels.filter(Boolean))];

  if (!uniqueLabels.length) {
    return new Map<string, string>();
  }

  const runs = await prisma.fetchRun.findMany({
    where: {
      status: ScanStatus.COMPLETED,
      targetLabel: {
        in: uniqueLabels,
      },
    },
    select: {
      targetLabel: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const latestByLabel = new Map<string, string>();

  for (const run of runs) {
    if (!run.targetLabel || latestByLabel.has(run.targetLabel)) {
      continue;
    }

    latestByLabel.set(run.targetLabel, run.createdAt.toISOString());
  }

  return latestByLabel;
}
