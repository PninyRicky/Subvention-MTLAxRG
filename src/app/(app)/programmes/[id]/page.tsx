import { notFound } from "next/navigation";
import { MatchStatus } from "@prisma/client";
import { ExternalLink } from "lucide-react";

import { SafeTerritoryMap } from "@/components/territory-map-boundary";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FavoriteToggleButton } from "@/components/favorite-toggle-button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getOfficialOrganizationsForTerritory } from "@/lib/official-organizations";
import { prisma } from "@/lib/prisma";
import { getTerritoryDataForProgram } from "@/lib/territories";

export const dynamic = "force-dynamic";

export default async function ProgrammeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const program = await prisma.fundingProgram.findUnique({
    where: { id },
    include: {
      intakeWindows: true,
      eligibilityRules: true,
      matchResults: {
        include: {
          profile: true,
        },
        orderBy: {
          score: "desc",
        },
      },
      source: true,
    },
  });

  if (!program) {
    notFound();
  }

  const territory = await getTerritoryDataForProgram({
    name: program.name,
    organization: program.organization,
    region: program.region,
    governmentLevel: program.governmentLevel,
    summary: program.summary,
    details: program.details,
    sourceName: program.source?.name,
    sourceUrl: program.source?.url,
  });

  const organizationDirectory = await getOfficialOrganizationsForTerritory(territory, {
    sourceName: program.source?.name,
    sourceUrl: program.source?.url,
  });

  const tone =
    program.status === "OPEN" ? "open" : program.status === "REVIEW" ? "review" : "closed";

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone}>{program.status}</Badge>
              <Badge>{program.governmentLevel}</Badge>
              <Badge>{program.region}</Badge>
              {program.isFavorite ? <Badge tone="eligible">Favori</Badge> : null}
            </div>
            <h1 className="mt-4 text-4xl font-medium tracking-[-0.07em]">{program.name}</h1>
            <p className="mt-2 text-sm uppercase tracking-[0.16em] text-black/45">{program.organization}</p>
            <p className="mt-4 text-sm leading-7 text-black/68">{program.summary}</p>
          </div>

          <div className="min-w-[260px] space-y-2 text-sm text-black/64">
            <div className="mb-4">
              <FavoriteToggleButton programId={program.id} isFavorite={program.isFavorite} />
            </div>
            <p>
              <span className="font-medium text-black">Confiance:</span> {program.confidence}%
            </p>
            <p>
              <span className="font-medium text-black">Dernière vérification:</span>{" "}
              {formatDateTime(program.lastVerifiedAt)}
            </p>
            <p>
              <span className="font-medium text-black">Date limite:</span>{" "}
              {formatDate(program.intakeWindows[0]?.closesAt)}
            </p>
            <p>
              <span className="font-medium text-black">Max:</span> {program.maxAmount ?? "À confirmer"}
            </p>
            <p>
              <span className="font-medium text-black">Couverture:</span>{" "}
              {program.maxCoveragePct ? `${program.maxCoveragePct}%` : "À confirmer"}
            </p>
            <a
              href={program.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[color:var(--accent)] underline-offset-4 hover:underline"
            >
              Ouvrir la fiche officielle
              <ExternalLink className="h-4 w-4" />
            </a>
            {program.sourceLandingUrl && program.sourceLandingUrl !== program.officialUrl ? (
              <a
                href={program.sourceLandingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-black/72 underline-offset-4 hover:underline"
              >
                Ouvrir la page source
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Aperçu détaillé</p>
            <div className="mt-5 grid gap-5 md:grid-cols-1">
              <div className="rounded-[24px] border border-black/10 p-5">
                <p className="text-sm font-medium">Description et contexte</p>
                <p className="mt-2 text-sm leading-7 text-black/66">
                  {program.details ?? "Aucune information détaillée n'a encore été extraite pour ce programme."}
                </p>
              </div>
              <div className="rounded-[24px] border border-black/10 p-5">
                <p className="text-sm font-medium">Notes d&apos;admissibilité</p>
                <p className="mt-2 text-sm leading-7 text-black/66">
                  {program.eligibilityNotes ?? "À confirmer sur la fiche officielle du programme."}
                </p>
              </div>
              <div className="rounded-[24px] border border-black/10 p-5">
                <p className="text-sm font-medium">Notes de dépôt</p>
                <p className="mt-2 text-sm leading-7 text-black/66">
                  {program.applicationNotes ?? "Vérifier la page officielle pour les formulaires, dates et pièces à joindre."}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Admissibilité structurée</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Types de demandeurs</p>
                <p className="mt-2 text-sm leading-6 text-black/66">{program.applicantTypes.join(", ") || "À confirmer"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Secteurs</p>
                <p className="mt-2 text-sm leading-6 text-black/66">{program.sectors.join(", ") || "À confirmer"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Stades de projet</p>
                <p className="mt-2 text-sm leading-6 text-black/66">{program.projectStages.join(", ") || "À confirmer"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Dépenses admissibles</p>
                <p className="mt-2 text-sm leading-6 text-black/66">{program.eligibleExpenses.join(", ") || "À confirmer"}</p>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-black/10 bg-black/[0.02] p-5">
              <p className="text-sm font-medium">Justification du statut</p>
              <p className="mt-2 text-sm leading-6 text-black/66">{program.openStatusReason ?? "Aucune justification détaillée."}</p>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Scores par profil</p>
            <div className="mt-5 space-y-4">
              {program.matchResults.map((match) => (
                <div key={match.id} className="rounded-[24px] border border-black/10 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-medium">{match.profile.name}</p>
                        {match.status === MatchStatus.ELIGIBLE ? <Badge tone="eligible">Eligible</Badge> : <Badge>Revision</Badge>}
                      </div>
                      <p className="mt-2 text-sm text-black/66">{match.profile.description}</p>
                    </div>
                    <p className="text-3xl font-medium tracking-[-0.06em]">{match.score}</p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-black/55">Motifs</p>
                      <ul className="mt-2 space-y-2 text-sm leading-6 text-black/68">
                        {((match.reasons as string[]) ?? []).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-black/55">Exclusions</p>
                      <ul className="mt-2 space-y-2 text-sm leading-6 text-black/68">
                        {((match.exclusions as string[]) ?? []).length ? (
                          ((match.exclusions as string[]) ?? []).map((item) => <li key={item}>{item}</li>)
                        ) : (
                          <li>Aucune exclusion structurelle détectée.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-black/55">Incertitudes</p>
                      <ul className="mt-2 space-y-2 text-sm leading-6 text-black/68">
                        {((match.uncertainties as string[]) ?? []).length ? (
                          ((match.uncertainties as string[]) ?? []).map((item) => <li key={item}>{item}</li>)
                        ) : (
                          <li>Aucune incertitude critique.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Source</p>
            <div className="mt-4 space-y-2 text-sm leading-6 text-black/66">
              <p>
                <span className="font-medium text-black">Nom:</span> {program.source?.name ?? "Non associée"}
              </p>
              <p>
                <span className="font-medium text-black">Type:</span>{" "}
                {program.source?.type === "OFFICIAL" ? "Source officielle" : "À confirmer"}
              </p>
              <p>
                <span className="font-medium text-black">Cadence:</span> {program.source?.cadence ?? "À confirmer"}
              </p>
              <p>
                <span className="font-medium text-black">Lien direct programme:</span>{" "}
                <a
                  href={program.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--accent)] underline-offset-4 hover:underline"
                >
                  {program.officialUrl}
                </a>
              </p>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Territoire admissible</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] border border-black/10 p-4">
                <p className="text-sm font-medium text-black">{territory.label}</p>
                <p className="mt-2 text-sm leading-6 text-black/64">{territory.coverageLabel}</p>
              </div>

              <SafeTerritoryMap territory={territory} />

              {territory.municipalities.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-black/55">Municipalités couvertes</p>
                  <div className="flex flex-wrap gap-2">
                    {territory.municipalities.map((municipality) => (
                      <span
                        key={municipality}
                        className="rounded-full border border-black/10 bg-black/[0.02] px-3 py-1.5 text-xs text-black/70"
                      >
                        {municipality}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <ul className="space-y-2 text-sm leading-6 text-black/62">
                {territory.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Organismes repérés sur ce territoire</p>
            <p className="mt-4 text-sm leading-6 text-black/64">{organizationDirectory.coverageNote}</p>

            <div className="mt-5 max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {organizationDirectory.organizations.length > 0 ? (
                organizationDirectory.organizations.map((organization) => (
                  <div key={organization.id} className="rounded-[24px] border border-black/10 p-4">
                    <p className="text-sm font-medium text-black">{organization.name}</p>
                    <div className="mt-2 space-y-1 text-sm leading-6 text-black/64">
                      {organization.municipality ? (
                        <p>
                          <span className="font-medium text-black">Municipalité:</span> {organization.municipality}
                        </p>
                      ) : null}
                      {organization.region ? (
                        <p>
                          <span className="font-medium text-black">Région:</span> {organization.region}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-medium text-black">Source:</span> {organization.sourceLabel}
                      </p>
                      <div className="flex flex-wrap gap-3 pt-1">
                        <a
                          href={organization.website ?? organization.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-[color:var(--accent)] underline-offset-4 hover:underline"
                        >
                          {organization.website ? "Ouvrir l’organisme" : "Ouvrir la source"}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        {organization.website && organization.sourceUrl !== organization.website ? (
                          <a
                            href={organization.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-black/72 underline-offset-4 hover:underline"
                          >
                            Source officielle
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                      {organization.email ? (
                        <p>
                          <span className="font-medium text-black">Courriel:</span> {organization.email}
                        </p>
                      ) : null}
                      {organization.phone ? (
                        <p>
                          <span className="font-medium text-black">Téléphone:</span> {organization.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
                  Aucun organisme public n&apos;a encore été relié à ce territoire avec les jeux de données officiels
                  actuellement intégrés.
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2 border-t border-black/10 pt-4 text-xs leading-5 text-black/54">
              <p className="uppercase tracking-[0.18em]">Sources de répertoire</p>
              <ul className="space-y-2">
                {organizationDirectory.dataSources.map((item) => (
                  <li key={item.url}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-black/70 underline-offset-4 hover:text-black hover:underline"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
