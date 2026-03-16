import { ReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const { id } = await params;

  const review = await prisma.reviewQueue.update({
    where: { id },
    data: {
      status: ReviewStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedById: viewer.id === "dev-admin" ? null : viewer.id,
    },
  });

  return NextResponse.json(review);
}
