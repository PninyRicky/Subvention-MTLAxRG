import Link from "next/link";
import { ArrowUpRight, Clock3, Radar, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { formatDateTime } from "@/lib/dates";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { latestRun, programs, profiles, stats } = await getDashboardData();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-5">
        <StatCard label="Programmes ouverts" value={stats.openPrograms} hint="Programmes actuellement detectes comme ouverts aujourd'hui." />
        <StatCard label="A verifier" value={stats.reviewPrograms} hint="Programmes ambigus ou signales sans validation definitive." />
        <StatCard label="Matches eligibles" value={stats.eligibleMatches} hint="Associations fortes entre programmes et profils actifs." />
        <StatCard label="File de revue" value={stats.reviewQueue} hint="Elements qui demandent une validation humaine avant usage." />
        <StatCard label="Profils actifs" value={stats.activeProfiles} hint="Profils de selection actuellement pris en compte dans le score." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
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
                      <p className="mt-1">Region: {program.region}</p>
                      <p className="mt-1">Derniere verification: {formatDateTime(program.lastVerifiedAt)}</p>
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
                <dt>Sources parcours</dt>
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
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.05em]">Cadre de verification</h2>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-black/68">
              <li>Un programme n’est marque ouvert que si la source officielle le confirme.</li>
              <li>Les programmes detectes via agregateur restent en revision jusqu’a validation humaine.</li>
              <li>Les scans automatiques tournent lundi, mercredi et vendredi a 06:00 Toronto.</li>
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}
