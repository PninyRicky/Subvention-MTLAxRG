import { SourceType, type SourceRegistry } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { parseProgramFromSource, parseProgramsFromSource } from "@/lib/fetch/parsers";

const source = {
  id: "source-1",
  name: "SODEC",
  url: "https://sodec.gouv.qc.ca/aide-financiere/",
  type: SourceType.OFFICIAL,
  cadence: "mwf-06:00-toronto",
  description: "Source de test",
  active: true,
  governmentLevel: "Quebec",
  fallbackPayload: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies SourceRegistry;

describe("parseProgramFromSource", () => {
  it("priorise l'URL officielle du fallback", () => {
    const parsed = parseProgramFromSource(source, null, {
      name: "SODEC - Soutien au developpement audiovisuel",
      summary: "Resume de test",
      officialUrl: "https://sodec.gouv.qc.ca/programme-direct",
      details: "Details",
      eligibilityNotes: "Eligibilite",
      applicationNotes: "Depot",
    });

    expect(parsed.officialUrl).toBe("https://sodec.gouv.qc.ca/programme-direct");
    expect(parsed.details).toBe("Details");
    expect(parsed.eligibilityNotes).toBe("Eligibilite");
    expect(parsed.applicationNotes).toBe("Depot");
  });

  it("ignore une URL tierce du fallback et garde la source officielle", () => {
    const parsed = parseProgramFromSource(source, null, {
      name: "SODEC - Soutien au developpement audiovisuel",
      summary: "Resume de test",
      officialUrl: "https://hellodarwin.com/fr/subventions/programme-x",
    });

    expect(parsed.officialUrl).toBe(source.url);
    expect(parsed.sourceLandingUrl).toBe(source.url);
  });

  it("marque CLOSED quand la date limite est dans le passe", () => {
    const parsed = parseProgramFromSource(source, null, {
      name: "Programme test ferme",
      summary: "Depot des demandes en cours. Date limite 17 aout 2017.",
      officialUrl: "https://sodec.gouv.qc.ca/vieux-programme",
    });

    expect(parsed.status).toBe("CLOSED");
    expect(parsed.openStatusReason).toMatch(/passée/i);
  });

  it("integre les donnees AI quand disponibles", () => {
    const parsed = parseProgramFromSource(
      source,
      null,
      {
        name: "SODEC - Test AI",
        summary: "Resume basique",
        officialUrl: "https://sodec.gouv.qc.ca/test",
      },
      {
        programs: [
          {
            programName: "SODEC - Test AI",
            officialUrl: "https://sodec.gouv.qc.ca/test",
            status: "OPEN",
            statusReason: "Le programme accepte les demandes.",
            closesAt: "2027-06-15",
            opensAt: null,
            rolling: false,
            organization: "SODEC via AI",
            summary: "Resume enrichi par AI",
            maxAmount: "50 000 $",
            maxCoveragePct: 75,
            applicantTypes: ["Producteur delegue"],
            sectors: ["cinema"],
            projectStages: null,
            eligibleExpenses: null,
            eligibleProfessionalServices: false,
            eligibilityNotes: "Admissible aux producteurs",
            applicationNotes: null,
            details: "Detail enrichi par AI",
            confidence: 82,
            reviewReason: null,
          },
        ],
      },
    );

    expect(parsed.organization).toBe("SODEC via AI");
    expect(parsed.summary).toBe("Resume enrichi par AI");
    expect(parsed.maxAmount).toBe("50 000 $");
    expect(parsed.details).toBe("Detail enrichi par AI");
    expect(parsed.applicantTypes).toContain("Producteur delegue");
    expect(parsed.intakeWindow.closesAt?.toISOString()).toContain("2027-06-15");
  });

  it("retourne plusieurs volets distincts a partir de l'analyse AI", () => {
    const parsedPrograms = parseProgramsFromSource(
      source,
      null,
      {
        name: "Programme portail",
        summary: "Portail officiel",
        officialUrl: source.url,
      },
      {
        programs: [
          {
            programName: "Volet 1 - Rayonnement",
            officialUrl: "https://sodec.gouv.qc.ca/volet-1",
            status: "OPEN",
            statusReason: "Volet ouvert",
            closesAt: "2027-03-15",
            opensAt: "2027-01-05",
            rolling: false,
            organization: "SODEC",
            summary: "Volet 1",
            maxAmount: null,
            maxCoveragePct: null,
            applicantTypes: ["OBNL"],
            sectors: ["rayonnement"],
            projectStages: ["developpement"],
            eligibleExpenses: ["communications"],
            eligibleProfessionalServices: true,
            eligibilityNotes: null,
            applicationNotes: null,
            details: null,
            confidence: 78,
            reviewReason: null,
          },
          {
            programName: "Volet 2 - Numérique",
            officialUrl: "https://sodec.gouv.qc.ca/volet-2",
            status: "REVIEW",
            statusReason: "Date a confirmer",
            closesAt: null,
            opensAt: null,
            rolling: null,
            organization: "SODEC",
            summary: "Volet 2",
            maxAmount: null,
            maxCoveragePct: null,
            applicantTypes: ["OBNL"],
            sectors: ["developpement numerique"],
            projectStages: ["developpement"],
            eligibleExpenses: ["outils numeriques"],
            eligibleProfessionalServices: true,
            eligibilityNotes: null,
            applicationNotes: null,
            details: null,
            confidence: 75,
            reviewReason: "Date non explicite",
          },
        ],
      },
    );

    expect(parsedPrograms).toHaveLength(2);
    expect(parsedPrograms[0].slug).not.toBe(parsedPrograms[1].slug);
    expect(parsedPrograms[0].eligibleProfessionalServices).toBe(true);
    expect(parsedPrograms[1].shouldReview).toBe(true);
  });

  it("repere un lien fonds ou programmes depuis un portail regional generique", () => {
    const regionalSource = {
      ...source,
      name: "MRC de Lotbinière - Fonds, programmes et soutien territorial",
      url: "https://www.mrclotbiniere.org",
      governmentLevel: "Regional",
    } satisfies SourceRegistry;

    const parsed = parseProgramFromSource(
      regionalSource,
      `
        <html>
          <head><title>MRC de Lotbinière</title></head>
          <body>
            <a href="/services-aux-citoyens/programmes-et-mesures/fonds-regions-ruralites/">Fonds Régions et Ruralité</a>
            <a href="/nous-joindre/">Nous joindre</a>
            <a href="/mrc-de-lotbiniere/services/culture-et-patrimoine/">Culture et patrimoine</a>
          </body>
        </html>
      `,
      {
        name: "MRC de Lotbinière - Fonds, programmes et soutien territorial",
        summary: "Portail officiel de la MRC pour ses fonds et programmes.",
      },
    );

    expect(parsed.officialUrl).toContain("fonds-regions-ruralites");
  });
});
