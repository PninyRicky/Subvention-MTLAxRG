import { ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getOfficialOrganizationsForTerritory } from "@/lib/official-organizations";
import { getTerritoryDataForProgram, type TerritoryProgramInput } from "@/lib/territories";

export async function ProgramOrganizationsCard({
  programInput,
  sourceName,
  sourceUrl,
}: {
  programInput: TerritoryProgramInput;
  sourceName?: string | null;
  sourceUrl?: string | null;
}) {
  const territory = await getTerritoryDataForProgram(programInput);
  const organizationDirectory = await getOfficialOrganizationsForTerritory(territory, {
    sourceName,
    sourceUrl,
  });

  return (
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
  );
}

