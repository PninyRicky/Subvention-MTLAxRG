import Link from "next/link";
import { ProgramStatus } from "@prisma/client";
import { ArrowUpRight, Clock3, Radar, ShieldAlert } from "lucide-react";

import { DashboardFilters } from "@/components/dashboard-filters";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { formatDateTime } from "@/lib/dates";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  region?: string;
  focus?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filters = {
    status:
      params.status && Object.values(ProgramStatus).includes(params.status as ProgramStatus)
        ? (params.status as ProgramStatus)
        : undefined,
    region:
      params.region === "montreal" || params.region === "quebec" ? params.region : undefined,
    focus:
      params.focus === "cinema-creation" || params.focus === "obnl-development"
        ? params.focus
        : undefined,
  } as const;

  const { latestRun, programs, profiles, stats } = await getDashboardData(filters);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-5">
        <StatCard label="Programmes ouverts" value={stats.openPrograms} hint="Programmes actuellement détectés comme ouverts aujourd'hui." />
        <StatCard label="À vérifier" value={stats.reviewPrograms} hint="Programmes ambigus ou signalés sans validation définitive." />
        <StatCard label="Matches éligibles" value={stats.eligibleMatches} hint="Associations fortes entre programmes et profils actifs." />
        <StatCard label="File de revue" value={stats.reviewQueue} hint="Éléments qui demandent une validation humaine avant usage." />
        <StatCard label="Profils actifs" value={stats.activeProfiles} hint="Profils de sélection actuellement pris en compte dans le score." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <DashboardFilters
            params={{
              status: params.status,
              region: params.region,
              focus: params.focus,
            }}
          />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Priorites</p>
              <h2 className="mt-2 text-2xl font-medium tracking-[-0.05em]">Programmes en vue</h2>
            </div>
            <Link href="/programmes" className="inline-flex items-center gap-2 text-sm text-black/72 transition hover:text-black">
              Voir tous les programmes
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {programs.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-black/12 px-5 py-8 text-sm leading-6 text-black/60">
                Aucun programme ne correspond aux filtres actifs pour l&apos;instant. Essaie d&apos;enlever un filtre ou
                relance un scan.
              </div>
            ) : null}

            {programs.map((program) => {
              const topMatch = program.matchResults[0];
              const tone =
                program.status === "OPEN" ? "open" : program.status === "REVIEW" ? "review" : "closed";

              return (
                <Link
                  key={program.id}
                  href={`/programmes/${program.id}`}
                  className="block rounded-[28px] border border-black/10 px-5 py-5 transition hover:border-black"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={tone}>{program.status}</Badge>
                        {topMatch?.status === "ELIGIBLE" ? <Badge tone="eligible">Match fort</Badge> : null}
                        <span className="text-xs uppercase tracking-[0.18em] text-black/42">{program.organization}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-medium tracking-[-0.04em]">{program.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-black/66">{program.summary}</p>
                    </div>

                    <div className="min-w-[220px] text-sm text-black/64">
                      <p className="font-medium text-black">Score: {topMatch?.score ?? 0}</p>
                      <p className="mt-1">Niveau: {program.governmentLevel}</p>
                      <p className="mt-1">Région: {program.region}</p>
                      <p className="mt-1">Dernière vérification: {formatDateTime(program.lastVerifiedAt)}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-3">
              <Clock3 className="h-4 w-4 text-[color:var(--accent)]" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Dernier scan</p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.05em]">
                {latestRun ? latestRun.status : "Aucun scan"}
                </h2>
              </div>
            </div>

            <dl className="mt-5 space-y-3 text-sm text-black/68">
              <div className="flex items-center justify-between">
                <dt>Mode</dt>
                <dd>{latestRun?.mode ?? "Aucun"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Dernier lancement</dt>
                <dd>{formatDateTime(latestRun?.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Sources parcourues</dt>
                <dd>{latestRun?.sourceCount ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Nouveaux programmes</dt>
                <dd>{latestRun?.discoveredCount ?? 0}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <Radar className="h-4 w-4 text-[color:var(--accent)]" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Profils actifs</p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.05em]">{profiles.length}</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="rounded-3xl border border-black/10 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{profile.name}</p>
                      <p className="mt-1 text-sm text-black/62">{profile.description}</p>
                    </div>
                    <Badge>{profile.active ? "Actif" : "Pause"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 text-[color:var(--accent)]" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Notes</p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.05em]">Cadre de vérification</h2>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-black/68">
              <li>Un programme n’est marqué ouvert que si la source officielle le confirme.</li>
              <li>Les agrégateurs, chambres de commerce et plateformes tierces sont exclus du scan automatisé.</li>
              <li>Le registre privilégie les sources officielles gouvernementales, municipales et régionales publiques.</li>
              <li>Les cartes territoriales s&apos;appuient sur le service cartographique officiel du gouvernement du Québec.</li>
              <li>Les scans automatiques tournent lundi, mercredi et vendredi une fois par jour sur Vercel Hobby.</li>
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}
