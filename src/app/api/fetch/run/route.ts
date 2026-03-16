import { ScanMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { getViewer } from "@/lib/auth";
import { executeFetchRun } from "@/lib/fetch/pipeline";

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const run = await executeFetchRun({
    mode: ScanMode.MANUAL,
    initiatedById: viewer.id === "dev-admin" ? null : viewer.id,
  });

  return NextResponse.json(run, { status: 202 });
}
