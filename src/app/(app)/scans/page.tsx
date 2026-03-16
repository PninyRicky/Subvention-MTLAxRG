import { ScanStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { getScheduleLabel } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ScansPage() {
  const runs = await prisma.fetchRun.findMany({
    include: {
      initiatedBy: true,
      documents: true,
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
            <li>Les scans manuels utilisent exactement le meme pipeline que les scans planifies.</li>
            <li>Le bouton de scan se bloque si un run est deja en cours ou en file.</li>
            <li>Chaque run journalise les sources, documents, creations, mises a jour et cas a revoir.</li>
          </ul>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table>
              <thead className="border-b border-black/10 bg-black/[0.02] text-left text-[11px] uppercase tracking-[0.18em] text-black/55">
                <tr>
                  <th className="px-6 py-4 font-medium">Statut</th>
                  <th className="px-6 py-4 font-medium">Mode</th>
                  <th className="px-6 py-4 font-medium">Lancement</th>
                  <th className="px-6 py-4 font-medium">Sources</th>
                  <th className="px-6 py-4 font-medium">Documents</th>
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
                      <td className="px-6 py-5 text-sm text-black/64">{run.mode}</td>
                      <td className="px-6 py-5 text-sm text-black/64">{formatDateTime(run.createdAt)}</td>
                      <td className="px-6 py-5 text-sm text-black/64">{run.sourceCount}</td>
                      <td className="px-6 py-5 text-sm text-black/64">{run.documents.length}</td>
                      <td className="px-6 py-5 text-sm leading-6 text-black/64">
                        <p>Nouveaux: {run.discoveredCount}</p>
                        <p>Maj: {run.updatedCount}</p>
                        <p>A revoir: {run.reviewCount}</p>
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
