import Link from "next/link";
import { MatchStatus, ProgramStatus, Prisma } from "@prisma/client";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FavoriteToggleButton } from "@/components/favorite-toggle-button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { buildInstitutionProgramWhere, getInstitutionConfig, getInstitutionNavLinks } from "@/lib/institutions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  level?: string;
  favorites?: string;
  institution?: string;
}>;

export default async function ProgrammesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim();
  const institution = params.institution?.trim();
  const status =
    params.status && Object.values(ProgramStatus).includes(params.status as ProgramStatus)
      ? (params.status as ProgramStatus)
      : undefined;
  const institutionWhere = institution ? buildInstitutionProgramWhere(institution) : null;
  const institutionLinks = await getInstitutionNavLinks();
  const activeInstitution = institution ? getInstitutionConfig(institution) : null;

  const programs = await prisma.fundingProgram.findMany({
    where: {
      ...(institutionWhere ?? {}),
      ...(status ? { status } : {}),
      ...(params.favorites === "1" ? { isFavorite: true } : {}),
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
      { isFavorite: "desc" },
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
              Vue détaillée des programmes détectés, avec filtres rapides, score par profil et statut d’ouverture.
            </p>
            {activeInstitution ? (
              <p className="mt-3 text-sm leading-6 text-black/58">
                Filtre actif: <span className="font-medium text-black">{activeInstitution.label}</span>
              </p>
            ) : null}
          </div>

          <form className="grid gap-3 sm:grid-cols-[1.45fr_0.8fr_0.8fr_0.8fr_1fr_auto]">
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
              <option value="REVIEW">À vérifier</option>
              <option value="CLOSED">Fermes</option>
            </select>
            <select
              name="level"
              defaultValue={params.level ?? ""}
              className="h-11 rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
            >
              <option value="">Tous les niveaux</option>
              <option value="Quebec">Québec</option>
              <option value="Federal">Fédéral</option>
              <option value="Municipal">Municipal</option>
              <option value="Regional">Régional</option>
              <option value="Canada">Canada</option>
            </select>
            <select
              name="favorites"
              defaultValue={params.favorites ?? ""}
              className="h-11 rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
            >
              <option value="">Tous</option>
              <option value="1">Favoris seulement</option>
            </select>
            <select
              name="institution"
              defaultValue={params.institution ?? ""}
              className="h-11 rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
            >
              <option value="">Toutes les institutions</option>
              {institutionLinks.map((link) => (
                <option key={link.slug} value={link.slug}>
                  {link.label}
                </option>
              ))}
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
                <th className="px-6 py-4 font-medium">Source</th>
                <th className="px-6 py-4 font-medium">Mise à jour</th>
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
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/programmes/${program.id}`} className="block space-y-2">
                            <p className="text-base font-medium">{program.name}</p>
                          </Link>
                          <FavoriteToggleButton programId={program.id} isFavorite={program.isFavorite} compact />
                        </div>
                        <Link href={`/programmes/${program.id}`} className="block space-y-2">
                        <p className="text-sm text-black/60">{program.organization}</p>
                        <p className="max-w-xl text-sm leading-6 text-black/66">{program.summary}</p>
                        </Link>
                      </div>
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
                        <p className="text-sm text-black/44">Aucun match calculé</p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <a
                        href={program.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-[color:var(--accent)] underline-offset-4 hover:underline"
                      >
                        Lien direct
                        <ExternalLink className="h-4 w-4" />
                      </a>
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
