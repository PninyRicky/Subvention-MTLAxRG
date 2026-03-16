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

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "ADMIN") {
    return NextResponse.json({ error: "Acces refuse." }, { status: 403 });
  }

  const payload = profileInputSchema.parse(await request.json());

  const profile = await prisma.serviceProfile.create({
    data: {
      name: payload.name,
      scenario: payload.scenario,
      description: payload.description,
      criteria: JSON.parse(payload.criteria),
      weights: JSON.parse(payload.weights),
      thresholds: JSON.parse(payload.thresholds),
    },
  });

  return NextResponse.json(profile, { status: 201 });
}
