import { ProgramStatus, SourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { scoreProgramForProfile } from "@/lib/scoring";
import { defaultOfficialSources, defaultProfiles, isOfficialInstitutionUrl } from "@/lib/source-registry";
import { getMrcDirectory } from "@/lib/territories";
import { slugify } from "@/lib/utils";

let bootstrapPromise: Promise<void> | null = null;

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase().replace(/^www\./, "");
  }
}

async function upsertGeneratedMrcSources() {
  const mrcDirectory = await getMrcDirectory();
  const curatedHosts = new Set(
    defaultOfficialSources
      .filter((source) => source.governmentLevel === "Regional")
      .map((source) => getHostname(source.url)),
  );

  for (const entry of mrcDirectory) {
    const website = entry.website ? normalizeWebsiteUrl(entry.website) : null;

    if (!website) {
      continue;
    }

    const hostname = getHostname(website);
    const curatedSpecificSourceExists = curatedHosts.has(hostname);
    const sourceName = curatedSpecificSourceExists
      ? `${entry.name} - Portail officiel territorial`
      : `${entry.name} - Fonds, programmes et soutien territorial`;

    await prisma.sourceRegistry.upsert({
      where: {
        url: website,
      },
      update: {
        name: sourceName,
        type: SourceType.OFFICIAL,
        governmentLevel: "Regional",
        description: `Portail officiel de ${entry.name} pour repérer les fonds, programmes et soutiens territoriaux.`,
        active: true,
        fallbackPayload: {
          name: sourceName,
          organization: entry.name,
          summary:
            `Portail officiel de ${entry.name} pour repérer ses fonds, programmes, ententes culturelles et leviers de financement territoriaux.`,
          officialUrl: website,
          governmentLevel: "Regional",
          region: entry.regionName,
          status: "REVIEW",
          confidence: curatedSpecificSourceExists ? 52 : 58,
          details:
            `Cette fiche est générée à partir du répertoire officiel des MRC du Québec. Le scan doit y repérer les pages internes de fonds, programmes, culture, patrimoine ou soutien financier propres à ${entry.name}.`,
          eligibilityNotes:
            `Pertinent surtout pour les OBNL, organismes culturels, municipalités, coopératives et porteurs de projets actifs dans ${entry.name}. L’admissibilité exacte dépend du programme territorial détecté.`,
          applicationNotes:
            "Toujours confirmer la page programme précise, la date limite, les documents à joindre et le volet actif avant de qualifier une opportunité comme ouverte.",
          applicantTypes: ["OBNL", "Organisme culturel", "Municipalité", "Coopérative", "Entreprise"],
          sectors: ["culture", "patrimoine", "développement territorial", "rayonnement", "développement organisationnel"],
          projectStages: ["développement", "production", "diffusion"],
          eligibleExpenses: ["projet culturel", "rayonnement", "médiation", "fonctionnement", "initiative structurante"],
          maxAmount: "Selon le programme",
          maxCoveragePct: null,
          openStatusReason:
            "Le site officiel MRC a été confirmé. Le scan doit encore identifier le sous-programme, sa fenêtre de dépôt et ses modalités exactes.",
        },
      },
      create: {
        name: sourceName,
        url: website,
        type: SourceType.OFFICIAL,
        governmentLevel: "Regional",
        description: `Portail officiel de ${entry.name} pour repérer les fonds, programmes et soutiens territoriaux.`,
        active: true,
        fallbackPayload: {
          name: sourceName,
          organization: entry.name,
          summary:
            `Portail officiel de ${entry.name} pour repérer ses fonds, programmes, ententes culturelles et leviers de financement territoriaux.`,
          officialUrl: website,
          governmentLevel: "Regional",
          region: entry.regionName,
          status: "REVIEW",
          confidence: curatedSpecificSourceExists ? 52 : 58,
          details:
            `Cette fiche est générée à partir du répertoire officiel des MRC du Québec. Le scan doit y repérer les pages internes de fonds, programmes, culture, patrimoine ou soutien financier propres à ${entry.name}.`,
          eligibilityNotes:
            `Pertinent surtout pour les OBNL, organismes culturels, municipalités, coopératives et porteurs de projets actifs dans ${entry.name}. L’admissibilité exacte dépend du programme territorial détecté.`,
          applicationNotes:
            "Toujours confirmer la page programme précise, la date limite, les documents à joindre et le volet actif avant de qualifier une opportunité comme ouverte.",
          applicantTypes: ["OBNL", "Organisme culturel", "Municipalité", "Coopérative", "Entreprise"],
          sectors: ["culture", "patrimoine", "développement territorial", "rayonnement", "développement organisationnel"],
          projectStages: ["développement", "production", "diffusion"],
          eligibleExpenses: ["projet culturel", "rayonnement", "médiation", "fonctionnement", "initiative structurante"],
          maxAmount: "Selon le programme",
          maxCoveragePct: null,
          openStatusReason:
            "Le site officiel MRC a été confirmé. Le scan doit encore identifier le sous-programme, sa fenêtre de dépôt et ses modalités exactes.",
        },
      },
    });
  }
}

async function removeUnofficialRecords() {
  const unofficialSources = await prisma.sourceRegistry.findMany({
    where: {
      OR: [
        { type: SourceType.AGGREGATOR },
        { url: { contains: "hellodarwin.com" } },
      ],
    },
    select: { id: true },
  });

  const unofficialSourceIds = unofficialSources.map((source) => source.id);

  if (unofficialSourceIds.length > 0) {
    await prisma.fundingProgram.deleteMany({
      where: {
        sourceId: {
          in: unofficialSourceIds,
        },
      },
    });

    await prisma.sourceRegistry.deleteMany({
      where: {
        id: {
          in: unofficialSourceIds,
        },
      },
    });
  }

  const unofficialPrograms = await prisma.fundingProgram.findMany({
    where: {
      OR: [
        { officialUrl: { contains: "hellodarwin.com" } },
        { sourceLandingUrl: { contains: "hellodarwin.com" } },
      ],
    },
    select: { id: true },
  });

  if (unofficialPrograms.length > 0) {
    await prisma.fundingProgram.deleteMany({
      where: {
        id: {
          in: unofficialPrograms.map((program) => program.id),
        },
      },
    });
  }

  const allPrograms = await prisma.fundingProgram.findMany({
    select: {
      id: true,
      officialUrl: true,
      sourceLandingUrl: true,
    },
  });

  const invalidProgramIds = allPrograms
    .filter(
      (program) =>
        !isOfficialInstitutionUrl(program.officialUrl) ||
        (program.sourceLandingUrl ? !isOfficialInstitutionUrl(program.sourceLandingUrl) : false),
    )
    .map((program) => program.id);

  if (invalidProgramIds.length > 0) {
    await prisma.fundingProgram.deleteMany({
      where: {
        id: {
          in: invalidProgramIds,
        },
      },
    });
  }
}

async function ensureSourcePrograms() {
  const sources = await prisma.sourceRegistry.findMany();
  const touchedPrograms: string[] = [];

  for (const source of sources) {
    const payload = source.fallbackPayload as Record<string, unknown> | null;

    if (!payload) {
      continue;
    }

    const slug = slugify(String(payload.name ?? source.name));
    const baseData = {
      name: String(payload.name ?? source.name),
      organization: String(payload.organization ?? source.name),
      summary: String(payload.summary ?? source.description ?? ""),
      officialUrl: payload.officialUrl ? String(payload.officialUrl) : source.url,
      sourceLandingUrl: source.url,
      governmentLevel: String(payload.governmentLevel ?? source.governmentLevel ?? "A confirmer"),
      region: String(payload.region ?? "Quebec"),
      status: ProgramStatus[String(payload.status ?? "REVIEW") as keyof typeof ProgramStatus],
      confidence: Number(payload.confidence ?? 50),
      maxAmount: payload.maxAmount ? String(payload.maxAmount) : null,
      maxCoveragePct: payload.maxCoveragePct ? Number(payload.maxCoveragePct) : null,
      details: payload.details ? String(payload.details) : null,
      eligibilityNotes: payload.eligibilityNotes ? String(payload.eligibilityNotes) : null,
      applicationNotes: payload.applicationNotes ? String(payload.applicationNotes) : null,
      applicantTypes: Array.isArray(payload.applicantTypes) ? (payload.applicantTypes as string[]) : [],
      sectors: Array.isArray(payload.sectors) ? (payload.sectors as string[]) : [],
      projectStages: Array.isArray(payload.projectStages) ? (payload.projectStages as string[]) : [],
      eligibleExpenses: Array.isArray(payload.eligibleExpenses) ? (payload.eligibleExpenses as string[]) : [],
      openStatusReason: payload.openStatusReason ? String(payload.openStatusReason) : null,
      sourceId: source.id,
      lastVerifiedAt: new Date(),
    };

    const program = await prisma.fundingProgram.upsert({
      where: { slug },
      update: baseData,
      create: {
        slug,
        ...baseData,
      },
      select: { id: true },
    });

    touchedPrograms.push(program.id);

    if (payload.intakeWindow) {
      await prisma.$transaction([
        prisma.intakeWindow.deleteMany({
          where: {
            programId: program.id,
          },
        }),
        prisma.intakeWindow.create({
          data: {
            programId: program.id,
            rolling: Boolean((payload.intakeWindow as Record<string, unknown>).rolling),
            opensAt: (payload.intakeWindow as Record<string, unknown>).opensAt
              ? new Date(String((payload.intakeWindow as Record<string, unknown>).opensAt))
              : null,
            closesAt: (payload.intakeWindow as Record<string, unknown>).closesAt
              ? new Date(String((payload.intakeWindow as Record<string, unknown>).closesAt))
              : null,
            lastConfirmedAt: new Date(),
          },
        }),
      ]);
    }
  }

  if (touchedPrograms.length === 0) {
    return;
  }

  const [profiles, programs] = await Promise.all([
    prisma.serviceProfile.findMany(),
    prisma.fundingProgram.findMany({
      where: {
        id: {
          in: touchedPrograms,
        },
      },
      include: {
        intakeWindows: true,
      },
    }),
  ]);

  for (const profile of profiles) {
    for (const program of programs) {
      const result = scoreProgramForProfile(program, profile);

      await prisma.matchResult.upsert({
        where: {
          programId_profileId: {
            programId: program.id,
            profileId: profile.id,
          },
        },
        update: result,
        create: {
          ...result,
          programId: program.id,
          profileId: profile.id,
        },
      });
    }
  }
}

async function runBootstrap() {
  await prisma.serviceProfile.createMany({
    data: defaultProfiles,
    skipDuplicates: true,
  });

  await removeUnofficialRecords();

  for (const source of defaultOfficialSources) {
    await prisma.sourceRegistry.upsert({
      where: {
        url: source.url,
      },
      update: source,
      create: source,
    });
  }

  await upsertGeneratedMrcSources();
  await ensureSourcePrograms();
}

export async function ensureBootstrapped() {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
}
