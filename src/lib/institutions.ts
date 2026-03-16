import { cache } from "react";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type InstitutionNavLink = {
  slug: string;
  label: string;
  count: number;
  href: string;
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
  const counts = await Promise.all(
    institutionConfigs.map(async (config) => ({
      config,
      count: await prisma.fundingProgram.count({
        where: buildInstitutionWhere(config),
      }),
    })),
  );

  return counts
    .filter((entry) => entry.count > 0)
    .map(({ config, count }) => ({
      slug: config.slug,
      label: config.label,
      count,
      href: `/programmes?institution=${config.slug}`,
    }));
});

export function buildInstitutionProgramWhere(slug: string): Prisma.FundingProgramWhereInput | null {
  const config = getInstitutionConfig(slug);
  return config ? buildInstitutionWhere(config) : null;
}
