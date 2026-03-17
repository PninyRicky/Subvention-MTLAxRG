import { cache } from "react";
import { ProgramStatus } from "@prisma/client";

import { getLatestCompletedScanMap } from "@/lib/fetch-run-metadata";
import { prisma } from "@/lib/prisma";
import { buildVisibleProgramWhere } from "@/lib/program-visibility";
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
  website?: string;
  code?: string;
  programCount: number;
  programs: MrcProgramSummary[];
};

export type MrcNavLink = {
  slug: string;
  name: string;
  count: number;
  href: string;
  regionName: string;
  sourceIds: string[];
  targetLabel: string;
  targetSourceId?: string | null;
  lastScannedAt: string | null;
};

export type MrcRegionNavLink = {
  slug: string;
  name: string;
  count: number;
  sourceIds: string[];
  targetLabel: string;
  lastScannedAt: string | null;
};

function normalizeHostname(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

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
        ...buildVisibleProgramWhere(),
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
  const groups = new Map<string, MrcGroup>(
    mrcDirectory.map((entry) => [
      territorySlug(entry.name),
      {
        slug: territorySlug(entry.name),
        name: entry.name,
        regionName: entry.regionName,
        website: entry.website,
        code: entry.code,
        programCount: 0,
        programs: [],
      } satisfies MrcGroup,
    ]),
  );

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
      website: match.website,
      code: match.code,
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
  const [groups, sources] = await Promise.all([
    getMrcGroups(),
    prisma.sourceRegistry.findMany({
      where: {
        active: true,
        type: "OFFICIAL",
        governmentLevel: "Regional",
      },
      select: {
        id: true,
        name: true,
        url: true,
      },
    }),
  ]);
  const targetLabels = groups.map((group) => `MRC: ${group.name}`);
  const latestByLabel = await getLatestCompletedScanMap(targetLabels);

  return groups.map((group) => {
    const targetLabel = `MRC: ${group.name}`;
    const websiteHost = normalizeHostname(group.website);
    const uniqueSourceIds = [
      ...new Set(
        sources
          .filter((source) => {
            const sourceHost = normalizeHostname(source.url);
            const normalizedSourceName = normalizeOfficialPlaceName(source.name);
            return (
              (websiteHost && sourceHost === websiteHost) ||
              normalizedSourceName.includes(group.slug.replace(/-/g, " ")) ||
              normalizeOfficialPlaceName(group.name).includes(normalizedSourceName)
            );
          })
          .map((source) => source.id),
      ),
    ];

    return {
      slug: group.slug,
      name: group.name,
      count: group.programCount,
      href: `/mrcs?mrc=${group.slug}`,
      regionName: group.regionName,
      sourceIds: uniqueSourceIds,
      targetLabel,
      targetSourceId: uniqueSourceIds.length === 1 ? uniqueSourceIds[0] : null,
      lastScannedAt: latestByLabel.get(targetLabel) ?? null,
    };
  });
});

export const getMrcRegionLinks = cache(async (): Promise<MrcRegionNavLink[]> => {
  const mrcLinks = await getMrcNavLinks();
  const groupedByRegion = mrcLinks.reduce<Record<string, MrcNavLink[]>>((accumulator, link) => {
    const bucket = accumulator[link.regionName] ?? [];
    bucket.push(link);
    accumulator[link.regionName] = bucket;
    return accumulator;
  }, {});

  const labels = Object.keys(groupedByRegion).map((regionName) => `Région MRC: ${regionName}`);
  const latestByLabel = await getLatestCompletedScanMap(labels);

  return Object.entries(groupedByRegion)
    .map(([regionName, links]) => {
      const targetLabel = `Région MRC: ${regionName}`;

      return {
        slug: territorySlug(regionName),
        name: regionName,
        count: links.reduce((sum, link) => sum + link.count, 0),
        sourceIds: [...new Set(links.flatMap((link) => link.sourceIds))],
        targetLabel,
        lastScannedAt: latestByLabel.get(targetLabel) ?? null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
});
