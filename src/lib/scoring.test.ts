import { MatchStatus, ProgramStatus, type ServiceProfile } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { scoreProgramForProfile } from "@/lib/scoring";

const profile = {
  id: "profile-1",
  name: "OBNL - Essence de Marque",
  scenario: "essence-marque",
  description: "Profil de test",
  active: true,
  criteria: {
    applicantTypes: ["OBNL"],
    geography: ["Quebec"],
    sectors: ["branding", "marketing numerique"],
    projectStages: ["developpement", "diffusion"],
    eligibleExpenses: ["branding", "photo", "video"],
    excludedKeywords: ["immobilier"],
  },
  weights: {
    serviceFit: 26,
    applicantFit: 22,
    geographyFit: 10,
    expenseFit: 17,
    professionalServicesFit: 15,
    deadlineFit: 5,
    confidenceFit: 10,
  },
  thresholds: {
    eligible: 70,
    review: 45,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies ServiceProfile;

describe("scoreProgramForProfile", () => {
  it("classe un bon programme ouvert comme eligible ou review elevee", () => {
    const result = scoreProgramForProfile(
      {
        id: "program-1",
        slug: "program-1",
        name: "Programme de rayonnement numerique",
        organization: "Ville de Montreal",
        summary: "Aide au branding et a la production de contenu pour OBNL.",
        officialUrl: "https://example.com",
        governmentLevel: "Quebec",
        region: "Quebec",
        status: ProgramStatus.OPEN,
        confidence: 86,
        maxAmount: "50 000 $",
        maxCoveragePct: 60,
        applicantTypes: ["OBNL"],
        sectors: ["branding", "marketing numerique"],
        projectStages: ["developpement", "diffusion"],
        eligibleExpenses: ["branding", "photo", "video"],
        eligibleProfessionalServices: true,
        openStatusReason: "Ouvert",
        sourceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastVerifiedAt: new Date(),
        intakeWindows: [
          {
            opensAt: new Date("2026-01-01T00:00:00.000Z"),
            closesAt: new Date("2026-04-30T00:00:00.000Z"),
            rolling: false,
          },
        ],
      },
      profile,
    );

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect([MatchStatus.ELIGIBLE, MatchStatus.REVIEW]).toContain(result.status);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("bloque un programme avec mot exclu", () => {
    const result = scoreProgramForProfile(
      {
        id: "program-2",
        slug: "program-2",
        name: "Programme d'immobilier",
        organization: "Ville",
        summary: "Aide pour projet immobilier lourd.",
        officialUrl: "https://example.com",
        governmentLevel: "Quebec",
        region: "Quebec",
        status: ProgramStatus.OPEN,
        confidence: 88,
        maxAmount: null,
        maxCoveragePct: null,
        applicantTypes: ["OBNL"],
        sectors: ["branding"],
        projectStages: ["developpement"],
        eligibleExpenses: ["branding"],
        eligibleProfessionalServices: false,
        openStatusReason: "Ouvert",
        sourceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastVerifiedAt: new Date(),
        intakeWindows: [
          {
            opensAt: new Date("2026-01-01T00:00:00.000Z"),
            closesAt: new Date("2026-04-30T00:00:00.000Z"),
            rolling: false,
          },
        ],
      },
      profile,
    );

    expect(result.status).toBe(MatchStatus.INELIGIBLE);
    expect(result.exclusions.length).toBeGreaterThan(0);
  });

  it("bonifie Essence de Marque quand les services professionnels sont admissibles", () => {
    const withServices = scoreProgramForProfile(
      {
        id: "program-3",
        slug: "program-3",
        name: "Programme de rayonnement",
        organization: "Ville",
        summary: "Aide pour OBNL avec consultants admissibles.",
        officialUrl: "https://example.com",
        sourceLandingUrl: null,
        governmentLevel: "Quebec",
        region: "Quebec",
        status: ProgramStatus.OPEN,
        confidence: 86,
        maxAmount: null,
        maxCoveragePct: null,
        details: null,
        eligibilityNotes: null,
        applicationNotes: null,
        isFavorite: false,
        applicantTypes: ["OBNL"],
        sectors: ["branding", "marketing numerique"],
        projectStages: ["developpement"],
        eligibleExpenses: ["branding"],
        eligibleProfessionalServices: true,
        openStatusReason: "Ouvert",
        aiAnalysis: null,
        aiAnalyzedAt: null,
        sourceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastVerifiedAt: new Date(),
        intakeWindows: [
          {
            opensAt: new Date("2026-01-01T00:00:00.000Z"),
            closesAt: new Date("2026-04-30T00:00:00.000Z"),
            rolling: false,
          },
        ],
      },
      profile,
    );

    const withoutServices = scoreProgramForProfile(
      {
        id: "program-4",
        slug: "program-4",
        name: "Programme de rayonnement",
        organization: "Ville",
        summary: "Aide pour OBNL.",
        officialUrl: "https://example.com",
        sourceLandingUrl: null,
        governmentLevel: "Quebec",
        region: "Quebec",
        status: ProgramStatus.OPEN,
        confidence: 86,
        maxAmount: null,
        maxCoveragePct: null,
        details: null,
        eligibilityNotes: null,
        applicationNotes: null,
        isFavorite: false,
        applicantTypes: ["OBNL"],
        sectors: ["branding", "marketing numerique"],
        projectStages: ["developpement"],
        eligibleExpenses: ["branding"],
        eligibleProfessionalServices: null,
        openStatusReason: "Ouvert",
        aiAnalysis: null,
        aiAnalyzedAt: null,
        sourceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastVerifiedAt: new Date(),
        intakeWindows: [
          {
            opensAt: new Date("2026-01-01T00:00:00.000Z"),
            closesAt: new Date("2026-04-30T00:00:00.000Z"),
            rolling: false,
          },
        ],
      },
      profile,
    );

    expect(withServices.score).toBeGreaterThan(withoutServices.score);
    expect(withServices.reasons).toContain("Les services professionnels ou externes semblent admissibles.");
  });
});
