import { ScanScope, ScanStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { expireStaleFetchRuns } from "@/lib/fetch/pipeline";
import { getScheduleLabel } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ScansPage() {
  await expireStaleFetchRuns();

  const runs = await prisma.fetchRun.findMany({
    include: {
      initiatedBy: true,
      documents: true,
      targetProgram: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Historique</p>
        <h1 className="mt-2 text-4xl font-medium tracking-[-0.07em]">Scans</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/66">
          Les scans automatiques suivent la cadence suivante: {getScheduleLabel()}. Un seul scan peut etre actif a la fois, qu’il soit manuel ou planifie.
        </p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Regles d’execution</p>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-black/68">
            <li>Le bouton global lance une veille rapide pour découvrir et mettre à jour les programmes pertinents.</li>
            <li>Depuis une fiche programme, le bouton ciblé lance un scan approfondi avec pages HTML, PDF et volets.</li>
            <li>Les scans planifies restent plus legers pour preserver la stabilite sur Vercel.</li>
            <li>Le bouton de scan se bloque si un run est deja en cours ou en file.</li>
            <li>Chaque run journalise les sources, documents, volets crees, fermetures et cas a revoir.</li>
          </ul>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table>
              <thead className="border-b border-black/10 bg-black/[0.02] text-left text-[11px] uppercase tracking-[0.18em] text-black/55">
                <tr>
                  <th className="px-6 py-4 font-medium">Statut</th>
                  <th className="px-6 py-4 font-medium">Portée</th>
                  <th className="px-6 py-4 font-medium">Mode</th>
                  <th className="px-6 py-4 font-medium">Lancement</th>
                  <th className="px-6 py-4 font-medium">Sources</th>
                  <th className="px-6 py-4 font-medium">Documents</th>
                  <th className="px-6 py-4 font-medium">Crawl</th>
                  <th className="px-6 py-4 font-medium">Resultat</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const tone =
                    run.status === ScanStatus.COMPLETED
                      ? "open"
                      : run.status === ScanStatus.FAILED
                        ? "closed"
                        : "review";

                  return (
                    <tr key={run.id} className="border-b border-black/10 align-top last:border-b-0">
                      <td className="px-6 py-5">
                        <Badge tone={tone}>{run.status}</Badge>
                      </td>
                      <td className="px-6 py-5 text-sm leading-6 text-black/64">
                        <p>
                          {run.scope === ScanScope.PROGRAM
                            ? "Programme"
                            : run.targetLabel
                              ? "Segment"
                              : "Veille globale"}
                        </p>
                        {run.scope === ScanScope.PROGRAM && run.targetProgram ? (
                          <p className="max-w-[240px] text-black/48">{run.targetProgram.name}</p>
                        ) : run.targetLabel ? (
                          <p className="max-w-[240px] text-black/48">{run.targetLabel}</p>
                        ) : null}
                      </td>
                      <td className="px-6 py-5 text-sm text-black/64">{run.mode}</td>
                      <td className="px-6 py-5 text-sm text-black/64">{formatDateTime(run.createdAt)}</td>
                      <td className="px-6 py-5 text-sm text-black/64">{run.sourceCount}</td>
                      <td className="px-6 py-5 text-sm text-black/64">{run.documents.length}</td>
                      <td className="px-6 py-5 text-sm leading-6 text-black/64">
                        <p>HTML: {run.htmlPageCount}</p>
                        <p>PDF: {run.pdfCount}</p>
                        <p>Volets: {run.voletCount}</p>
                      </td>
                      <td className="px-6 py-5 text-sm leading-6 text-black/64">
                        <p>Nouveaux: {run.discoveredCount}</p>
                        <p>Maj: {run.updatedCount}</p>
                        <p>Fermes: {run.closedCount}</p>
                        <p>A revoir: {run.reviewCount}</p>
                        <p>Revisions resolues: {run.resolvedReviewCount}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
