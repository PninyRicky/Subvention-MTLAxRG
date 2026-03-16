import { ProgramStatus, SourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { scoreProgramForProfile } from "@/lib/scoring";
import { slugify } from "@/lib/utils";

const defaultProfiles = [
  {
    name: "OBNL - Essence de Marque",
    scenario: "essence-marque",
    description:
      "Profil pour OBNL cherchant du financement en branding, contenu visuel, rayonnement et virage numerique.",
    criteria: {
      applicantTypes: ["OBNL", "Organisme communautaire"],
      geography: ["Quebec", "Canada"],
      sectors: ["marketing numerique", "branding", "rayonnement", "communications"],
      projectStages: ["developpement", "production", "diffusion"],
      eligibleExpenses: ["branding", "photo", "video", "site web", "marketing"],
      excludedKeywords: ["capital", "immobilier lourd"],
    },
    weights: {
      serviceFit: 30,
      applicantFit: 25,
      geographyFit: 10,
      expenseFit: 20,
      deadlineFit: 5,
      confidenceFit: 10,
    },
    thresholds: {
      eligible: 70,
      review: 45,
    },
  },
  {
    name: "MTLA - Production vidéo",
    scenario: "production-video",
    description:
      "Profil pour courts metrages, documentaires, series web, clips et productions videos de MTLA.",
    criteria: {
      applicantTypes: ["Entreprise", "Producteur", "OBNL"],
      geography: ["Quebec", "Canada"],
      sectors: ["audiovisuel", "production video", "documentaire", "court metrage"],
      projectStages: ["developpement", "production", "post-production", "diffusion"],
      eligibleExpenses: ["video", "post-production", "developpement", "diffusion"],
      excludedKeywords: ["construction", "achat immobilier"],
    },
    weights: {
      serviceFit: 32,
      applicantFit: 20,
      geographyFit: 10,
      expenseFit: 18,
      deadlineFit: 10,
      confidenceFit: 10,
    },
    thresholds: {
      eligible: 68,
      review: 42,
    },
  },
];

const defaultSources = [
  {
    name: "SODEC - Aide au developpement",
    url: "https://sodec.gouv.qc.ca/aide-financiere/",
    type: SourceType.OFFICIAL,
    governmentLevel: "Quebec",
    description: "Page de reference SODEC pour les programmes d'aide financiere.",
    fallbackPayload: {
      name: "SODEC - Soutien au developpement audiovisuel",
      organization: "SODEC",
      summary:
        "Soutien pour le developpement et la structuration de projets audiovisuels au Quebec.",
      governmentLevel: "Quebec",
      region: "Quebec",
      status: "OPEN",
      confidence: 76,
      applicantTypes: ["Entreprise", "Producteur"],
      sectors: ["audiovisuel", "production video"],
      projectStages: ["developpement"],
      eligibleExpenses: ["developpement", "ecriture", "preproduction"],
      maxAmount: "Variable selon le programme",
      maxCoveragePct: 75,
      openStatusReason: "Source officielle et programme recurremment ouvert selon les appels.",
      intakeWindow: {
        rolling: false,
        opensAt: "2026-01-15T11:00:00.000Z",
        closesAt: "2026-04-30T21:59:00.000Z",
      },
    },
  },
  {
    name: "Conseil des arts du Canada - Subventions Explorer et creer",
    url: "https://conseildesarts.ca/financement/subventions/explorer-et-creer",
    type: SourceType.OFFICIAL,
    governmentLevel: "Federal",
    description: "Programme federal pour artistes et organismes en creation.",
    fallbackPayload: {
      name: "CAC - Explorer et creer",
      organization: "Conseil des arts du Canada",
      summary:
        "Subvention pour le developpement, la creation et l'experimentation de projets artistiques.",
      governmentLevel: "Federal",
      region: "Canada",
      status: "REVIEW",
      confidence: 60,
      applicantTypes: ["Artiste", "OBNL", "Collectif"],
      sectors: ["audiovisuel", "arts", "creation"],
      projectStages: ["developpement", "creation"],
      eligibleExpenses: ["creation", "recherche", "production legere"],
      maxAmount: "Selon la composante choisie",
      maxCoveragePct: 100,
      openStatusReason: "Programme detecte mais dates a confirmer sur l'appel actif.",
      intakeWindow: {
        rolling: false,
        opensAt: "2026-02-01T05:00:00.000Z",
        closesAt: "2026-05-15T03:59:00.000Z",
      },
    },
  },
  {
    name: "helloDarwin - subventions marketing",
    url: "https://hellodarwin.com/fr/subventions",
    type: SourceType.AGGREGATOR,
    governmentLevel: "Agregateur",
    description: "Source secondaire pour reperage rapide de programmes.",
    fallbackPayload: {
      name: "Subventions de rayonnement numerique pour OBNL",
      organization: "Programme a confirmer",
      summary:
        "Programme signale par agregateur pour modernisation numerique, site web, strategie et contenus.",
      governmentLevel: "Quebec",
      region: "Quebec",
      status: "REVIEW",
      confidence: 42,
      applicantTypes: ["OBNL"],
      sectors: ["marketing numerique", "rayonnement", "branding"],
      projectStages: ["developpement", "diffusion"],
      eligibleExpenses: ["site web", "branding", "photo", "video", "campagne numerique"],
      maxAmount: "A confirmer",
      maxCoveragePct: 50,
      openStatusReason: "Detecte par source secondaire; confirmation officielle requise.",
      intakeWindow: {
        rolling: true,
      },
    },
  },
];

export async function ensureBootstrapped() {
  const [profileCount, sourceCount] = await Promise.all([
    prisma.serviceProfile.count(),
    prisma.sourceRegistry.count(),
  ]);

  if (profileCount === 0) {
    await prisma.serviceProfile.createMany({
      data: defaultProfiles,
    });
  }

  if (sourceCount === 0) {
    for (const source of defaultSources) {
      await prisma.sourceRegistry.create({
        data: source,
      });
    }
  }

  const programCount = await prisma.fundingProgram.count();
  if (programCount > 0) {
    return;
  }

  const sources = await prisma.sourceRegistry.findMany();
  for (const source of sources) {
    const payload = source.fallbackPayload as Record<string, unknown> | null;

    if (!payload) {
      continue;
    }

    await prisma.fundingProgram.create({
      data: {
        slug: slugify(String(payload.name ?? source.name)),
        name: String(payload.name ?? source.name),
        organization: String(payload.organization ?? source.name),
        summary: String(payload.summary ?? source.description ?? ""),
        officialUrl: source.url,
        governmentLevel: String(payload.governmentLevel ?? source.governmentLevel ?? "A confirmer"),
        region: String(payload.region ?? "Quebec"),
        status: ProgramStatus[String(payload.status ?? "REVIEW") as keyof typeof ProgramStatus],
        confidence: Number(payload.confidence ?? 50),
        maxAmount: payload.maxAmount ? String(payload.maxAmount) : null,
        maxCoveragePct: payload.maxCoveragePct ? Number(payload.maxCoveragePct) : null,
        applicantTypes: Array.isArray(payload.applicantTypes) ? (payload.applicantTypes as string[]) : [],
        sectors: Array.isArray(payload.sectors) ? (payload.sectors as string[]) : [],
        projectStages: Array.isArray(payload.projectStages) ? (payload.projectStages as string[]) : [],
        eligibleExpenses: Array.isArray(payload.eligibleExpenses) ? (payload.eligibleExpenses as string[]) : [],
        openStatusReason: payload.openStatusReason ? String(payload.openStatusReason) : null,
        sourceId: source.id,
        lastVerifiedAt: new Date(),
        intakeWindows: {
          create: payload.intakeWindow
            ? {
                rolling: Boolean((payload.intakeWindow as Record<string, unknown>).rolling),
                opensAt: (payload.intakeWindow as Record<string, unknown>).opensAt
                  ? new Date(String((payload.intakeWindow as Record<string, unknown>).opensAt))
                  : null,
                closesAt: (payload.intakeWindow as Record<string, unknown>).closesAt
                  ? new Date(String((payload.intakeWindow as Record<string, unknown>).closesAt))
                  : null,
                lastConfirmedAt: new Date(),
              }
            : undefined,
        },
      },
    });
  }

  const [profiles, programs] = await Promise.all([
    prisma.serviceProfile.findMany(),
    prisma.fundingProgram.findMany({
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
