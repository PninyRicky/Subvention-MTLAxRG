import { ScanMode, ScanScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { getViewer } from "@/lib/auth";
import { executeFetchRun } from "@/lib/fetch/pipeline";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const { id } = await params;
  const initiatedById =
    viewer.id === "dev-admin" || viewer.id === "shared-access" ? null : viewer.id;

  try {
    const run = await executeFetchRun({
      mode: ScanMode.MANUAL,
      scope: ScanScope.PROGRAM,
      targetProgramId: id,
      initiatedById,
    });

    return NextResponse.json(run, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Impossible de lancer le scan approfondi du programme.",
      },
      { status: 400 },
    );
  }
}
