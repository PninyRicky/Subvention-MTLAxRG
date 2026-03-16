import { SafeTerritoryMap } from "@/components/territory-map-boundary";
import { Card } from "@/components/ui/card";
import { getTerritoryDataForProgram, type TerritoryProgramInput } from "@/lib/territories";

export async function ProgramTerritoryCard({
  programInput,
}: {
  programInput: TerritoryProgramInput;
}) {
  const territory = await getTerritoryDataForProgram(programInput);

  return (
    <Card>
      <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Territoire admissible</p>
      <div className="mt-4 space-y-4">
        <div className="rounded-[24px] border border-black/10 p-4">
          <p className="text-sm font-medium text-black">{territory.label}</p>
          <p className="mt-2 text-sm leading-6 text-black/64">{territory.coverageLabel}</p>
          {territory.regionName ? (
            <p className="mt-2 text-sm leading-6 text-black/64">
              <span className="font-medium text-black">Région administrative:</span> {territory.regionName}
            </p>
          ) : null}
          {territory.territoryCode ? (
            <p className="text-sm leading-6 text-black/64">
              <span className="font-medium text-black">Code officiel:</span> {territory.territoryCode}
            </p>
          ) : null}
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
  );
}

