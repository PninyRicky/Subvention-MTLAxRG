import { notFound } from "next/navigation";
import { MatchStatus, ReviewStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

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
      reviews: {
        orderBy: {
          createdAt: "desc",
        },
      },
      source: true,
    },
  });

  if (!program) {
    notFound();
  }

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
            </div>
            <h1 className="mt-4 text-4xl font-medium tracking-[-0.07em]">{program.name}</h1>
            <p className="mt-2 text-sm uppercase tracking-[0.16em] text-black/45">{program.organization}</p>
            <p className="mt-4 text-sm leading-7 text-black/68">{program.summary}</p>
          </div>

          <div className="min-w-[260px] space-y-2 text-sm text-black/64">
            <p>
              <span className="font-medium text-black">Confiance:</span> {program.confidence}%
            </p>
            <p>
              <span className="font-medium text-black">Derniere verification:</span>{" "}
              {formatDateTime(program.lastVerifiedAt)}
            </p>
            <p>
              <span className="font-medium text-black">Date limite:</span>{" "}
              {formatDate(program.intakeWindows[0]?.closesAt)}
            </p>
            <p>
              <span className="font-medium text-black">Max:</span> {program.maxAmount ?? "A confirmer"}
            </p>
            <p>
              <span className="font-medium text-black">Couverture:</span>{" "}
              {program.maxCoveragePct ? `${program.maxCoveragePct}%` : "A confirmer"}
            </p>
            <a
              href={program.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm text-[color:var(--accent)] underline-offset-4 hover:underline"
            >
              Ouvrir la source officielle
            </a>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Admissibilite structuree</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Types de demandeurs</p>
                <p className="mt-2 text-sm leading-6 text-black/66">{program.applicantTypes.join(", ") || "A confirmer"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Secteurs</p>
                <p className="mt-2 text-sm leading-6 text-black/66">{program.sectors.join(", ") || "A confirmer"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Stades de projet</p>
                <p className="mt-2 text-sm leading-6 text-black/66">{program.projectStages.join(", ") || "A confirmer"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Depenses admissibles</p>
                <p className="mt-2 text-sm leading-6 text-black/66">{program.eligibleExpenses.join(", ") || "A confirmer"}</p>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-black/10 bg-black/[0.02] p-5">
              <p className="text-sm font-medium">Justification du statut</p>
              <p className="mt-2 text-sm leading-6 text-black/66">{program.openStatusReason ?? "Aucune justification detaillee."}</p>
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
                          <li>Aucune exclusion structurelle detectee.</li>
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
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Historique de revue</p>
            <div className="mt-5 space-y-3">
              {program.reviews.map((review) => (
                <div key={review.id} className="rounded-[24px] border border-black/10 p-4">
                  <div className="flex items-center justify-between">
                    <Badge tone={review.status === ReviewStatus.APPROVED ? "open" : review.status === ReviewStatus.REJECTED ? "closed" : "review"}>
                      {review.status}
                    </Badge>
                    <p className="text-xs text-black/45">{formatDateTime(review.createdAt)}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-black/66">{review.reason}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Source</p>
            <div className="mt-4 space-y-2 text-sm leading-6 text-black/66">
              <p>
                <span className="font-medium text-black">Nom:</span> {program.source?.name ?? "Non associee"}
              </p>
              <p>
                <span className="font-medium text-black">Type:</span> {program.source?.type ?? "A confirmer"}
              </p>
              <p>
                <span className="font-medium text-black">Cadence:</span> {program.source?.cadence ?? "A confirmer"}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
