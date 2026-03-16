import { describe, expect, it } from "vitest";

import { aiProgramAnalysisSchema } from "@/lib/ai/schema";

describe("aiProgramAnalysisSchema", () => {
  it("accepte une reponse AI complete", () => {
    const result = aiProgramAnalysisSchema.safeParse({
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
      eligibilityNotes: "Ouvert aux entreprises du Quebec.",
      applicationNotes: "Depot en ligne avant le 15 juin 2026.",
      details: "Programme d'aide au developpement.",
      confidence: 85,
    });

    expect(result.success).toBe(true);
  });

  it("accepte une reponse AI avec tous les champs null", () => {
    const result = aiProgramAnalysisSchema.safeParse({
      status: null,
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
      eligibilityNotes: null,
      applicationNotes: null,
      details: null,
      confidence: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejette un statut invalide", () => {
    const result = aiProgramAnalysisSchema.safeParse({
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
      eligibilityNotes: null,
      applicationNotes: null,
      details: null,
      confidence: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejette une confidence hors bornes", () => {
    const result = aiProgramAnalysisSchema.safeParse({
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
      eligibilityNotes: null,
      applicationNotes: null,
      details: null,
      confidence: 150,
    });

    expect(result.success).toBe(false);
  });
});
