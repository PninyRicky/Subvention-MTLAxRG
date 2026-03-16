import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const profiles = [
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

  for (const profile of profiles) {
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

  const sources = [
    {
      name: "SODEC - Aide au developpement",
      url: "https://sodec.gouv.qc.ca/aide-financiere/",
      type: "OFFICIAL" as const,
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
      type: "OFFICIAL" as const,
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
      type: "AGGREGATOR" as const,
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

  for (const source of sources) {
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
