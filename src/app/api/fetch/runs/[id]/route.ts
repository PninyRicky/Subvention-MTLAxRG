import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const run = await prisma.fetchRun.findUnique({
    where: { id },
    include: {
      initiatedBy: true,
      documents: true,
      reviews: true,
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Scan introuvable." }, { status: 404 });
  }

  return NextResponse.json(run);
}
