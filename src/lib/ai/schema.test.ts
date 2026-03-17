import { describe, expect, it } from "vitest";

import { aiProgramAnalysisSchema } from "@/lib/ai/schema";

describe("aiProgramAnalysisSchema", () => {
  it("accepte une reponse AI complete", () => {
    const result = aiProgramAnalysisSchema.safeParse({
      programs: [
        {
          programName: "SODEC - Soutien au développement audiovisuel",
          officialUrl:
            "https://sodec.gouv.qc.ca/domaines-dintervention/cinema-et-television/aide-financiere/aide-developpement/",
          status: "OPEN",
          statusReason: "Le programme accepte les demandes.",
          closesAt: "2026-06-15",
          opensAt: "2026-01-15",
          rolling: false,
          organization: "SODEC",
          summary: "Aide au developpement audiovisuel.",
          maxAmount: "50 000 $",
          maxCoveragePct: 75,
          applicantTypes: ["Entreprise", "Producteur"],
          sectors: ["audiovisuel"],
          projectStages: ["developpement"],
          eligibleExpenses: ["ecriture", "preproduction"],
          eligibleProfessionalServices: false,
          eligibilityNotes: "Ouvert aux entreprises du Quebec.",
          applicationNotes: "Depot en ligne avant le 15 juin 2026.",
          details: "Programme d'aide au developpement.",
          confidence: 85,
          reviewReason: null,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepte une reponse AI avec une liste vide", () => {
    const result = aiProgramAnalysisSchema.safeParse({
      programs: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejette un statut invalide", () => {
    const result = aiProgramAnalysisSchema.safeParse({
      programs: [
        {
          programName: null,
          officialUrl: null,
          status: "INVALID",
          statusReason: null,
          closesAt: null,
          opensAt: null,
          rolling: null,
          organization: null,
          summary: null,
          maxAmount: null,
          maxCoveragePct: null,
          applicantTypes: null,
          sectors: null,
          projectStages: null,
          eligibleExpenses: null,
          eligibleProfessionalServices: null,
          eligibilityNotes: null,
          applicationNotes: null,
          details: null,
          confidence: null,
          reviewReason: null,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejette une confidence hors bornes", () => {
    const result = aiProgramAnalysisSchema.safeParse({
      programs: [
        {
          programName: null,
          officialUrl: null,
          status: "OPEN",
          statusReason: null,
          closesAt: null,
          opensAt: null,
          rolling: null,
          organization: null,
          summary: null,
          maxAmount: null,
          maxCoveragePct: null,
          applicantTypes: null,
          sectors: null,
          projectStages: null,
          eligibleExpenses: null,
          eligibleProfessionalServices: null,
          eligibilityNotes: null,
          applicationNotes: null,
          details: null,
          confidence: 150,
          reviewReason: null,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
