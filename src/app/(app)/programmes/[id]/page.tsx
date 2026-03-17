import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MatchStatus, ScanScope } from "@prisma/client";
import { ExternalLink } from "lucide-react";

import { ProgramOrganizationsCard } from "@/components/program-organizations-card";
import { ProgramDeepScanButton } from "@/components/program-deep-scan-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FavoriteToggleButton } from "@/components/favorite-toggle-button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { parseJsonField } from "@/lib/utils";

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

  const latestProgramRun = await prisma.fetchRun.findFirst({
    where: {
      scope: ScanScope.PROGRAM,
      targetProgramId: program.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const tone =
    program.status === "OPEN" ? "open" : program.status === "REVIEW" ? "review" : "closed";
  const audit = parseJsonField<Record<string, unknown> | null>(program.aiAnalysis, null);
  const selectedProgramName =
    typeof audit?.selectedProgramName === "string" ? audit.selectedProgramName : program.name;
  const auditPrograms = Array.isArray(audit?.programs) ? (audit.programs as Array<Record<string, unknown>>) : [];
  const selectedAuditProgram =
    auditPrograms.find((entry) => entry["programName"] === selectedProgramName) ?? auditPrograms[0] ?? null;

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

          <div className="min-w-[260px] space-y-3 text-sm text-black/64">
            <div className="mb-2 flex flex-col items-end gap-3">
              <ProgramDeepScanButton programId={program.id} />
              <FavoriteToggleButton programId={program.id} isFavorite={program.isFavorite} />
            </div>
            <div className="rounded-[24px] border border-black/10 bg-black/[0.02] p-4 text-xs leading-6 text-black/66">
              <p className="font-medium text-black">Scan ciblé du programme</p>
              <p className="mt-1">
                Ce bouton approfondit uniquement cette fiche: volets, PDF, dates exactes, statut officiel et URL directe.
              </p>
              <p className="mt-2">
                <span className="font-medium text-black">Dernier scan ciblé:</span>{" "}
                {latestProgramRun ? formatDateTime(latestProgramRun.createdAt) : "Jamais lancé"}
              </p>
              {latestProgramRun ? (
                <p>
                  <span className="font-medium text-black">Statut:</span> {latestProgramRun.status}
                </p>
              ) : null}
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
            <p>
              <span className="font-medium text-black">Services professionnels:</span>{" "}
              {program.eligibleProfessionalServices === true
                ? "Admissibles"
                : program.eligibleProfessionalServices === false
                  ? "Non admissibles"
                  : "À confirmer"}
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
              <p className="text-sm font-medium">Services professionnels</p>
              <p className="mt-2 text-sm leading-6 text-black/66">
                {program.eligibleProfessionalServices === true
                  ? "Le scan a détecté un signal officiel indiquant que les honoraires professionnels, consultants, services externes ou outils numériques peuvent être admissibles."
                  : program.eligibleProfessionalServices === false
                    ? "Le scan a détecté un signal officiel indiquant que les services professionnels ou consultants ne sont pas admissibles."
                    : "Le scan n’a pas trouvé de signal suffisamment explicite sur l’admissibilité des services professionnels."}
              </p>
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
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Audit du scan</p>
            <div className="mt-4 space-y-2 text-sm leading-6 text-black/66">
              <p>
                <span className="font-medium text-black">Document analysé:</span>{" "}
                {typeof audit?.documentUrl === "string" ? (
                  <a
                    href={audit.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--accent)] underline-offset-4 hover:underline"
                  >
                    {audit.documentUrl}
                  </a>
                ) : (
                  "À confirmer"
                )}
              </p>
              <p>
                <span className="font-medium text-black">Type de document:</span>{" "}
                {typeof audit?.documentType === "string" ? audit.documentType : "À confirmer"}
              </p>
              <p>
                <span className="font-medium text-black">Volet retenu:</span> {selectedProgramName}
              </p>
              <p>
                <span className="font-medium text-black">Raison du statut:</span>{" "}
                {typeof selectedAuditProgram?.["statusReason"] === "string"
                  ? selectedAuditProgram["statusReason"]
                  : program.openStatusReason}
              </p>
              {typeof selectedAuditProgram?.["reviewReason"] === "string" && selectedAuditProgram["reviewReason"] ? (
                <p>
                  <span className="font-medium text-black">Raison de révision:</span>{" "}
                  {selectedAuditProgram["reviewReason"] as string}
                </p>
              ) : null}
              <p>
                <span className="font-medium text-black">Date de clôture détectée:</span>{" "}
                {typeof selectedAuditProgram?.["closesAt"] === "string" && selectedAuditProgram["closesAt"]
                  ? (selectedAuditProgram["closesAt"] as string)
                  : "À confirmer"}
              </p>
            </div>
          </Card>

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

          <Suspense fallback={<ProgramSideCardSkeleton title="Organismes repérés sur ce territoire" lines={8} />}>
            <ProgramOrganizationsCard
              programInput={{
                name: program.name,
                organization: program.organization,
                region: program.region,
                governmentLevel: program.governmentLevel,
                summary: program.summary,
                details: program.details,
                sourceName: program.source?.name,
                sourceUrl: program.source?.url,
              }}
              sourceName={program.source?.name}
              sourceUrl={program.source?.url}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function ProgramSideCardSkeleton({
  title,
  lines,
}: {
  title: string;
  lines: number;
}) {
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">{title}</p>
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={`${title}-${index}`} className="h-4 animate-pulse rounded-full bg-black/[0.06]" />
        ))}
      </div>
    </Card>
  );
}
