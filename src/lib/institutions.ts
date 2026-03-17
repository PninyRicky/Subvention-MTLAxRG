import { cache } from "react";
import { Prisma } from "@prisma/client";

import { getLatestCompletedScanMap } from "@/lib/fetch-run-metadata";
import { prisma } from "@/lib/prisma";
import { buildVisibleProgramWhere } from "@/lib/program-visibility";
import { isOfficialInstitutionUrl } from "@/lib/source-registry";

export type InstitutionNavLink = {
  slug: string;
  label: string;
  count: number;
  href: string;
  sourceIds: string[];
  targetLabel: string;
  lastScannedAt: string | null;
};

type InstitutionConfig = {
  slug: string;
  label: string;
  governmentLevel: "Quebec" | "Federal";
  patterns: string[];
};

const institutionConfigs: InstitutionConfig[] = [
  {
    slug: "sodec",
    label: "SODEC",
    governmentLevel: "Quebec",
    patterns: ["sodec"],
  },
  {
    slug: "calq",
    label: "CALQ",
    governmentLevel: "Quebec",
    patterns: ["conseil des arts et des lettres du quebec", "calq"],
  },
  {
    slug: "cac",
    label: "CAC",
    governmentLevel: "Federal",
    patterns: ["conseil des arts du canada", "cac"],
  },
  {
    slug: "telefilm",
    label: "Téléfilm",
    governmentLevel: "Federal",
    patterns: ["telefilm canada", "telefilm"],
  },
  {
    slug: "fmc",
    label: "FMC",
    governmentLevel: "Federal",
    patterns: ["fonds des medias du canada", "fmc", "cmf"],
  },
  {
    slug: "patrimoine-canadien",
    label: "Patrimoine canadien",
    governmentLevel: "Federal",
    patterns: ["patrimoine canadien"],
  },
];

export function getInstitutionConfig(slug: string) {
  return institutionConfigs.find((config) => config.slug === slug);
}

function buildInstitutionWhere(config: InstitutionConfig): Prisma.FundingProgramWhereInput {
  const orConditions = config.patterns.flatMap((pattern) => [
    { organization: { contains: pattern, mode: Prisma.QueryMode.insensitive } },
    { name: { contains: pattern, mode: Prisma.QueryMode.insensitive } },
    { source: { is: { name: { contains: pattern, mode: Prisma.QueryMode.insensitive } } } },
    { source: { is: { url: { contains: pattern } } } },
  ]);

  return {
    governmentLevel: config.governmentLevel,
    OR: orConditions,
  };
}

export const getInstitutionNavLinks = cache(async (): Promise<InstitutionNavLink[]> => {
  const [sources, counts] = await Promise.all([
    prisma.sourceRegistry.findMany({
      where: {
        active: true,
        type: "OFFICIAL",
      },
      select: {
        id: true,
        name: true,
        url: true,
        description: true,
      },
    }),
    Promise.all(
    institutionConfigs.map(async (config) => ({
      config,
      count: await prisma.fundingProgram.count({
        where: {
          ...buildVisibleProgramWhere(),
          ...buildInstitutionWhere(config),
        },
      }),
      sourceIds: (
        await prisma.fundingProgram.findMany({
          where: {
            ...buildVisibleProgramWhere(),
            ...buildInstitutionWhere(config),
          },
          select: {
            sourceId: true,
          },
        })
      )
        .map((program) => program.sourceId)
        .filter((value): value is string => Boolean(value)),
    })),
    ),
  ]);

  const labels = counts.map(({ config }) => `Institution: ${config.label}`);
  const latestByLabel = await getLatestCompletedScanMap(labels);

  return counts
    .filter((entry) => entry.count > 0)
    .map(({ config, count, sourceIds }) => {
      const matchedSourceIds = sources
        .filter((source) => {
          if (!isOfficialInstitutionUrl(source.url)) {
            return false;
          }

          const haystack = [source.name, source.url, source.description ?? ""].join(" ").toLowerCase();
          return config.patterns.some((pattern) => haystack.includes(pattern.toLowerCase()));
        })
        .map((source) => source.id);
      const uniqueSourceIds = [...new Set([...sourceIds, ...matchedSourceIds])];
      const targetLabel = `Institution: ${config.label}`;

      return {
        slug: config.slug,
        label: config.label,
        count,
        href: `/programmes?institution=${config.slug}`,
        sourceIds: uniqueSourceIds,
        targetLabel,
        lastScannedAt: latestByLabel.get(targetLabel) ?? null,
      };
    });
});

export function buildInstitutionProgramWhere(slug: string): Prisma.FundingProgramWhereInput | null {
  const config = getInstitutionConfig(slug);
  return config ? buildInstitutionWhere(config) : null;
}
