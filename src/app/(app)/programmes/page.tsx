import Link from "next/link";
import { MatchStatus, ProgramStatus, Prisma } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  level?: string;
}>;

export default async function ProgrammesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim();
  const status =
    params.status && Object.values(ProgramStatus).includes(params.status as ProgramStatus)
      ? (params.status as ProgramStatus)
      : undefined;

  const programs = await prisma.fundingProgram.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(params.level ? { governmentLevel: params.level } : {}),
      ...(query
        ? {
            OR: [
              {
                name: {
                  contains: query,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                organization: {
                  contains: query,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                summary: {
                  contains: query,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    },
    include: {
      intakeWindows: true,
      matchResults: {
        include: {
          profile: true,
        },
        orderBy: {
          score: "desc",
        },
      },
      reviews: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: [
      { status: "asc" },
      { updatedAt: "desc" },
    ],
  });

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Catalogue</p>
            <h1 className="mt-2 text-4xl font-medium tracking-[-0.07em]">Programmes</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/66">
              Vue detaillee des programmes detectes, avec filtres rapides, score par profil et statut d’ouverture.
            </p>
          </div>

          <form className="grid gap-3 sm:grid-cols-[1.6fr_0.8fr_0.8fr_auto]">
            <input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder="Rechercher un programme, un organisme..."
              className="h-11 rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
            />
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="h-11 rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
            >
              <option value="">Tous les statuts</option>
              <option value="OPEN">Ouverts</option>
              <option value="REVIEW">A verifier</option>
              <option value="CLOSED">Fermes</option>
            </select>
            <select
              name="level"
              defaultValue={params.level ?? ""}
              className="h-11 rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
            >
              <option value="">Tous les niveaux</option>
              <option value="Quebec">Quebec</option>
              <option value="Federal">Federal</option>
              <option value="Municipal">Municipal</option>
              <option value="Canada">Canada</option>
            </select>
            <button className="h-11 rounded-full bg-black px-5 text-sm font-medium text-white transition hover:bg-[color:var(--accent)]">
              Filtrer
            </button>
          </form>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table>
            <thead className="border-b border-black/10 bg-black/[0.02] text-left text-[11px] uppercase tracking-[0.18em] text-black/55">
              <tr>
                <th className="px-6 py-4 font-medium">Programme</th>
                <th className="px-6 py-4 font-medium">Statut</th>
                <th className="px-6 py-4 font-medium">Niveau</th>
                <th className="px-6 py-4 font-medium">Date limite</th>
                <th className="px-6 py-4 font-medium">Meilleur match</th>
                <th className="px-6 py-4 font-medium">Mise a jour</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => {
                const topMatch = program.matchResults[0];
                const tone =
                  program.status === ProgramStatus.OPEN
                    ? "open"
                    : program.status === ProgramStatus.REVIEW
                      ? "review"
                      : "closed";

                return (
                  <tr key={program.id} className="border-b border-black/10 align-top last:border-b-0">
                    <td className="px-6 py-5">
                      <Link href={`/programmes/${program.id}`} className="block space-y-2">
                        <p className="text-base font-medium">{program.name}</p>
                        <p className="text-sm text-black/60">{program.organization}</p>
                        <p className="max-w-xl text-sm leading-6 text-black/66">{program.summary}</p>
                      </Link>
                    </td>
                    <td className="px-6 py-5">
                      <Badge tone={tone}>{program.status}</Badge>
                    </td>
                    <td className="px-6 py-5 text-sm text-black/64">{program.governmentLevel}</td>
                    <td className="px-6 py-5 text-sm text-black/64">
                      {formatDate(program.intakeWindows[0]?.closesAt)}
                    </td>
                    <td className="px-6 py-5">
                      {topMatch ? (
                        <div className="space-y-2">
                          <Badge tone={topMatch.status === MatchStatus.ELIGIBLE ? "eligible" : "default"}>
                            {topMatch.profile.name}
                          </Badge>
                          <p className="text-sm text-black/64">Score {topMatch.score}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-black/44">Aucun match calcule</p>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm text-black/64">{formatDateTime(program.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
