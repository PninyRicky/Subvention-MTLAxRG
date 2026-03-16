import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  isFavorite: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = payloadSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Charge utile invalide." }, { status: 400 });
  }

  const program = await prisma.fundingProgram.update({
    where: { id },
    data: {
      isFavorite: payload.data.isFavorite,
    },
    select: {
      id: true,
      isFavorite: true,
    },
  });

  return NextResponse.json(program);
}
