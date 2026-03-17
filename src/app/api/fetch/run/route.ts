import { ScanMode, ScanScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { getViewer } from "@/lib/auth";
import { executeFetchRun } from "@/lib/fetch/pipeline";

export const maxDuration = 300;

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? ((await request.json().catch(() => null)) as
          | {
              sourceIds?: string[];
              targetLabel?: string | null;
              targetSourceId?: string | null;
            }
          | null)
      : null;
    const initiatedById =
      viewer.id === "dev-admin" || viewer.id === "shared-access" ? null : viewer.id;

    const run = await executeFetchRun({
      mode: ScanMode.MANUAL,
      scope: ScanScope.GLOBAL,
      initiatedById,
      sourceIds: payload?.sourceIds,
      targetLabel: payload?.targetLabel ?? null,
      targetSourceId: payload?.targetSourceId ?? null,
    });

    return NextResponse.json(run, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Impossible de lancer le scan global.",
      },
      { status: 400 },
    );
  }
}
