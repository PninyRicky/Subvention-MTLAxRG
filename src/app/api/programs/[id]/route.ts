import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const program = await prisma.fundingProgram.findUnique({
    where: { id },
    include: {
      intakeWindows: true,
      eligibilityRules: true,
      matchResults: {
        include: {
          profile: true,
        },
      },
      reviews: true,
      source: true,
    },
  });

  if (!program) {
    return NextResponse.json({ error: "Programme introuvable." }, { status: 404 });
  }

  return NextResponse.json(program);
}
