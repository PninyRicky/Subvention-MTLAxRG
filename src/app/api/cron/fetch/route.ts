import { ScanMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { executeFetchRun, isCronAuthorized } from "@/lib/fetch/pipeline";
import { isScheduledRunWindow } from "@/lib/scheduler";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Cron non autorise." }, { status: 401 });
  }

  if (!isScheduledRunWindow()) {
    return NextResponse.json({
      skipped: true,
      reason: "En dehors des jours programmes lundi/mercredi/vendredi.",
    });
  }

  const run = await executeFetchRun({
    mode: ScanMode.SCHEDULED,
  });

  return NextResponse.json(run);
}
