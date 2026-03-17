import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const runs = await prisma.fetchRun.findMany({
    include: {
      initiatedBy: true,
      documents: true,
      targetProgram: true,
      targetSource: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(runs);
}
