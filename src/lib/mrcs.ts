import { cache } from "react";
import { ProgramStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getMrcDirectory, normalizeOfficialPlaceName, territorySlug } from "@/lib/territories";

export type MrcProgramSummary = {
  id: string;
  name: string;
  organization: string;
  summary: string;
  status: ProgramStatus;
  officialUrl: string;
  region: string;
  updatedAt: Date;
};

export type MrcGroup = {
  slug: string;
  name: string;
  regionName: string;
  programCount: number;
  programs: MrcProgramSummary[];
};

export type MrcNavLink = {
  slug: string;
  name: string;
  count: number;
  href: string;
};

function simplifyMrcText(value: string) {
  return normalizeOfficialPlaceName(value)
    .replace(/^mrc\s+/, "")
    .replace(/^(de la|de l|du|des|de|la|le|les)\s+/, "")
    .trim();
}

function findMrcMatch(
  program: {
    name: string;
    organization: string;
    summary: string;
  },
  directory: Awaited<ReturnType<typeof getMrcDirectory>>,
) {
  const primaryFields = [program.organization, program.name].map((value) => normalizeOfficialPlaceName(value));
  const primaryMatch = directory.find((entry) =>
    primaryFields.some((field) => field.includes(entry.normalizedName)),
  );

  if (primaryMatch) {
    return primaryMatch;
  }

  const simplifiedPrimaryFields = [program.organization, program.name].map((value) => simplifyMrcText(value));
  const simplifiedMatch = directory.find((entry) => {
    const simplifiedEntry = simplifyMrcText(entry.name);
    return simplifiedPrimaryFields.some(
      (field) => field.includes(simplifiedEntry) || simplifiedEntry.includes(field),
    );
  });

  if (simplifiedMatch) {
    return simplifiedMatch;
  }

  const summaryField = normalizeOfficialPlaceName(program.summary);
  return directory.find((entry) => summaryField.includes(entry.normalizedName));
}

export const getMrcGroups = cache(async (): Promise<MrcGroup[]> => {
  const [regionalPrograms, mrcDirectory] = await Promise.all([
    prisma.fundingProgram.findMany({
      where: {
        governmentLevel: "Regional",
      },
      select: {
        id: true,
        name: true,
        organization: true,
        summary: true,
        status: true,
        officialUrl: true,
        region: true,
        updatedAt: true,
      },
      orderBy: [
        { organization: "asc" },
        { name: "asc" },
      ],
    }),
    getMrcDirectory(),
  ]);

  const sortedDirectory = [...mrcDirectory].sort((left, right) => right.normalizedName.length - left.normalizedName.length);
  const groups = new Map<string, MrcGroup>();

  for (const program of regionalPrograms) {
    const match = findMrcMatch(program, sortedDirectory);

    if (!match) {
      continue;
    }

    const slug = territorySlug(match.name);
    const current = groups.get(slug);
    const programSummary: MrcProgramSummary = {
      id: program.id,
      name: program.name,
      organization: program.organization,
      summary: program.summary,
      status: program.status,
      officialUrl: program.officialUrl,
      region: program.region,
      updatedAt: program.updatedAt,
    };

    if (current) {
      current.programs.push(programSummary);
      current.programCount += 1;
      continue;
    }

    groups.set(slug, {
      slug,
      name: match.name,
      regionName: match.regionName,
      programCount: 1,
      programs: [programSummary],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      programs: group.programs.sort((left, right) => left.name.localeCompare(right.name, "fr")),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
});

export const getMrcNavLinks = cache(async (): Promise<MrcNavLink[]> => {
  const groups = await getMrcGroups();

  return groups.map((group) => ({
    slug: group.slug,
    name: group.name,
    count: group.programCount,
    href: `/mrcs?mrc=${group.slug}`,
  }));
});
