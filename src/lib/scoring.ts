import { MatchStatus, ProgramStatus, type FundingProgram, type ServiceProfile } from "@prisma/client";

import { daysUntil, isOpenToday } from "@/lib/dates";
import { parseJsonField } from "@/lib/utils";

type ProfileCriteria = {
  applicantTypes?: string[];
  geography?: string[];
  sectors?: string[];
  projectStages?: string[];
  eligibleExpenses?: string[];
  excludedKeywords?: string[];
};

type ProfileWeights = {
  serviceFit: number;
  applicantFit: number;
  geographyFit: number;
  expenseFit: number;
  professionalServicesFit: number;
  deadlineFit: number;
  confidenceFit: number;
};

type ProfileThresholds = {
  eligible: number;
  review: number;
};

type ProgramWithWindow = FundingProgram & {
  intakeWindows: {
    opensAt: Date | null;
    closesAt: Date | null;
    rolling: boolean;
  }[];
};

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function overlap(left: string[], right: string[]) {
  if (!left.length || !right.length) {
    return 0;
  }

  const rightSet = new Set(right.map((item) => normalizeComparableText(item)));
  const matches = left.filter((item) => rightSet.has(normalizeComparableText(item)));
  return matches.length / Math.max(left.length, right.length);
}

function containsExcludedKeyword(program: ProgramWithWindow, excludedKeywords: string[]) {
  const haystack = [
    program.name,
    program.summary,
    program.organization,
    ...program.sectors,
    ...program.eligibleExpenses,
  ]
    .join(" ")
    .toLowerCase();

  const normalizedHaystack = normalizeComparableText(haystack);
  return excludedKeywords.some((keyword) => normalizedHaystack.includes(normalizeComparableText(keyword)));
}

function getDeadlineScore(program: ProgramWithWindow) {
  const closestWindow = [...program.intakeWindows]
    .filter((window) => window.closesAt || window.rolling)
    .sort((left, right) => {
      if (!left.closesAt) {
        return 1;
      }
      if (!right.closesAt) {
        return -1;
      }
      return left.closesAt.getTime() - right.closesAt.getTime();
    })[0];

  if (!closestWindow) {
    return 0.4;
  }

  if (closestWindow.rolling) {
    return 1;
  }

  const days = daysUntil(closestWindow.closesAt);

  if (days < 0) {
    return 0;
  }
  if (days <= 7) {
    return 1;
  }
  if (days <= 21) {
    return 0.8;
  }
  if (days <= 45) {
    return 0.65;
  }

  return 0.45;
}

export function scoreProgramForProfile(program: ProgramWithWindow, profile: ServiceProfile) {
  const criteria = parseJsonField<ProfileCriteria>(profile.criteria, {});
  const weights = parseJsonField<ProfileWeights>(profile.weights, {
    serviceFit: 30,
    applicantFit: 25,
    geographyFit: 10,
    expenseFit: 20,
    professionalServicesFit: 10,
    deadlineFit: 5,
    confidenceFit: 10,
  });
  const thresholds = parseJsonField<ProfileThresholds>(profile.thresholds, {
    eligible: 70,
    review: 45,
  });

  const exclusions: string[] = [];
  const reasons: string[] = [];
  const uncertainties: string[] = [];

  if (criteria.excludedKeywords?.length && containsExcludedKeyword(program, criteria.excludedKeywords)) {
    exclusions.push("Mot-cle exclu present dans la description du programme.");
  }

  const applicantScore = overlap(program.applicantTypes, criteria.applicantTypes ?? []);
  const geographyScore = criteria.geography?.some((entry) =>
    normalizeComparableText([program.region, program.governmentLevel].join(" ")).includes(normalizeComparableText(entry)),
  )
    ? 1
    : 0;
  const sectorScore = overlap(program.sectors, criteria.sectors ?? []);
  const expenseScore = overlap(program.eligibleExpenses, criteria.eligibleExpenses ?? []);
  const stageScore = overlap(program.projectStages, criteria.projectStages ?? []);
  const serviceFit = Math.min(1, sectorScore + stageScore * 0.5);
  const confidenceScore = Math.min(1, program.confidence / 100);
  const deadlineScore = getDeadlineScore(program);
  const currentlyOpen = program.intakeWindows.some((window) => isOpenToday(window));
  const professionalServicesScore =
    profile.scenario === "essence-marque" && program.eligibleProfessionalServices === true ? 1 : 0;

  if (applicantScore > 0) {
    reasons.push("Type de demandeur compatible.");
  }
  if (serviceFit > 0.4) {
    reasons.push("Bonne adequation avec le service cible.");
  }
  if (expenseScore > 0.25) {
    reasons.push("Depenses admissibles pertinentes.");
  }
  if (professionalServicesScore > 0) {
    reasons.push("Les services professionnels ou externes semblent admissibles.");
  }
  if (!currentlyOpen || program.status !== ProgramStatus.OPEN) {
    uncertainties.push("Statut d'ouverture a confirmer ou en revision.");
  }
  if (program.confidence < 60) {
    uncertainties.push("Extraction de la source a confiance moyenne.");
  }

  const rawScore =
    serviceFit * weights.serviceFit +
    applicantScore * weights.applicantFit +
    geographyScore * weights.geographyFit +
    expenseScore * weights.expenseFit +
    professionalServicesScore * weights.professionalServicesFit +
    deadlineScore * weights.deadlineFit +
    confidenceScore * weights.confidenceFit;

  const score = Math.round(Math.max(0, rawScore));

  let status: MatchStatus = MatchStatus.INELIGIBLE;
  if (exclusions.length > 0) {
    status = MatchStatus.INELIGIBLE;
  } else if (score >= thresholds.eligible && currentlyOpen && program.status === ProgramStatus.OPEN) {
    status = MatchStatus.ELIGIBLE;
  } else if (score >= thresholds.review || program.status === ProgramStatus.REVIEW) {
    status = MatchStatus.REVIEW;
  }

  return {
    score,
    status,
    reasons,
    exclusions,
    uncertainties,
  };
}
