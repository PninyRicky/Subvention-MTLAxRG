import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const profileInputSchema = z.object({
  name: z.string().min(3),
  scenario: z.string().min(2),
  description: z.string().min(10),
  criteria: z.string(),
  weights: z.string(),
  thresholds: z.string(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "ADMIN") {
    return NextResponse.json({ error: "Acces refuse." }, { status: 403 });
  }

  const { id } = await params;
  const payload = profileInputSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Charge utile invalide." }, { status: 400 });
  }

  try {
    const profile = await prisma.serviceProfile.update({
      where: { id },
      data: {
        name: payload.data.name,
        scenario: payload.data.scenario,
        description: payload.data.description,
        criteria: JSON.parse(payload.data.criteria),
        weights: JSON.parse(payload.data.weights),
        thresholds: JSON.parse(payload.data.thresholds),
      },
    });

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Impossible de mettre le profil a jour.",
      },
      { status: 400 },
    );
  }
}
