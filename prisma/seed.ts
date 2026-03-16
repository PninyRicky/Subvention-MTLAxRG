import { PrismaClient } from "@prisma/client";

import { defaultOfficialSources, defaultProfiles } from "../src/lib/source-registry";

const prisma = new PrismaClient();

async function main() {
  for (const profile of defaultProfiles) {
    await prisma.serviceProfile.upsert({
      where: { name: profile.name },
      update: {
        scenario: profile.scenario,
        description: profile.description,
        criteria: profile.criteria,
        weights: profile.weights,
        thresholds: profile.thresholds,
      },
      create: profile,
    });
  }

  await prisma.fundingProgram.deleteMany({
    where: {
      OR: [
        { officialUrl: { contains: "hellodarwin.com" } },
        { sourceLandingUrl: { contains: "hellodarwin.com" } },
      ],
    },
  });

  await prisma.sourceRegistry.deleteMany({
    where: {
      OR: [
        { type: "AGGREGATOR" },
        { url: { contains: "hellodarwin.com" } },
      ],
    },
  });

  for (const source of defaultOfficialSources) {
    await prisma.sourceRegistry.upsert({
      where: { url: source.url },
      update: source,
      create: source,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
