import Link from "next/link";
import { ProgramStatus } from "@prisma/client";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { getMrcGroups } from "@/lib/mrcs";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  mrc?: string;
}>;

export default async function MrcPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const groups = await getMrcGroups();
  const selectedGroup = groups.find((group) => group.slug === params.mrc) ?? groups[0] ?? null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Territoires</p>
            <h1 className="mt-2 text-4xl font-medium tracking-[-0.07em]">MRC</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/66">
              Liste des MRC officiellement présentes dans l&apos;application, avec leurs programmes régionaux déjà
              intégrés.
            </p>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-black/[0.02] px-5 py-4 text-sm text-black/64">
            <p>
              <span className="font-medium text-black">MRC intégrées:</span> {groups.length}
            </p>
            <p className="mt-1">
              <span className="font-medium text-black">Programmes régionaux:</span>{" "}
              {groups.reduce((total, group) => total + group.programCount, 0)}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Liste MRC</p>
          <div className="mt-4 space-y-2">
            {groups.length > 0 ? (
              groups.map((group) => {
                const active = selectedGroup?.slug === group.slug;

                return (
                  <Link
                    key={group.slug}
                    href={`/mrcs?mrc=${group.slug}`}
                    className={`block rounded-[22px] border px-4 py-4 transition ${
                      active
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-white text-black hover:border-black/20 hover:bg-black/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{group.name}</p>
                        <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-black/50"}`}>
                          {group.regionName}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${
                          active ? "bg-white/14 text-white" : "bg-black/[0.04] text-black/55"
                        }`}
                      >
                        {group.programCount}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
                Aucune MRC n&apos;est encore présente dans l&apos;application.
              </div>
            )}
          </div>
        </Card>

        <Card>
          {selectedGroup ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">MRC sélectionnée</p>
                  <h2 className="mt-2 text-3xl font-medium tracking-[-0.06em]">{selectedGroup.name}</h2>
                  <p className="mt-2 text-sm text-black/62">{selectedGroup.regionName}</p>
                </div>
                <Badge>{selectedGroup.programCount} programmes</Badge>
              </div>

              <div className="mt-6 space-y-4">
                {selectedGroup.programs.map((program) => {
                  const tone =
                    program.status === ProgramStatus.OPEN
                      ? "open"
                      : program.status === ProgramStatus.REVIEW
                        ? "review"
                        : "closed";

                  return (
                    <div key={program.id} className="rounded-[26px] border border-black/10 p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={tone}>{program.status}</Badge>
                            <Badge>{program.region}</Badge>
                          </div>
                          <Link href={`/programmes/${program.id}`} className="mt-3 block">
                            <p className="text-xl font-medium tracking-[-0.04em]">{program.name}</p>
                            <p className="mt-2 text-sm text-black/58">{program.organization}</p>
                            <p className="mt-3 text-sm leading-6 text-black/66">{program.summary}</p>
                          </Link>
                        </div>

                        <div className="space-y-3 text-sm text-black/62">
                          <p>
                            <span className="font-medium text-black">Mise à jour:</span> {formatDateTime(program.updatedAt)}
                          </p>
                          <div className="flex flex-col gap-2">
                            <Link
                              href={`/programmes/${program.id}`}
                              className="inline-flex items-center gap-2 text-[color:var(--accent)] underline-offset-4 hover:underline"
                            >
                              Ouvrir la fiche
                            </Link>
                            <a
                              href={program.officialUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-[color:var(--accent)] underline-offset-4 hover:underline"
                            >
                              Ouvrir la source officielle
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-5 py-8 text-sm leading-6 text-black/58">
              Aucun regroupement MRC n&apos;a encore été construit à partir des programmes régionaux existants.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
