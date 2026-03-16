import * as cheerio from "cheerio";
import { ProgramStatus, SourceType, type SourceRegistry } from "@prisma/client";

import type { AiProgramAnalysis } from "@/lib/ai/schema";
import { parseRelevantFrenchDeadlineFromText } from "@/lib/dates";
import { isOfficialInstitutionUrl } from "@/lib/source-registry";
import { slugify } from "@/lib/utils";

export type ParsedProgramPayload = {
  slug: string;
  name: string;
  organization: string;
  summary: string;
  officialUrl: string;
  sourceLandingUrl?: string | null;
  governmentLevel: string;
  region: string;
  status: ProgramStatus;
  confidence: number;
  applicantTypes: string[];
  sectors: string[];
  projectStages: string[];
  eligibleExpenses: string[];
  maxAmount: string | null;
  maxCoveragePct: number | null;
  details: string | null;
  eligibilityNotes: string | null;
  applicationNotes: string | null;
  openStatusReason: string;
  intakeWindow: {
    rolling: boolean;
    opensAt?: Date | null;
    closesAt?: Date | null;
  };
  shouldReview: boolean;
  reviewFields: string[];
};

type FallbackPayload = {
  name?: string;
  organization?: string;
  summary?: string;
  officialUrl?: string;
  governmentLevel?: string;
  region?: string;
  status?: string;
  confidence?: number;
  details?: string;
  eligibilityNotes?: string;
  applicationNotes?: string;
  applicantTypes?: string[];
  sectors?: string[];
  projectStages?: string[];
  eligibleExpenses?: string[];
  maxAmount?: string;
  maxCoveragePct?: number;
  openStatusReason?: string;
  intakeWindow?: {
    rolling?: boolean;
    opensAt?: string;
    closesAt?: string;
  };
};

function isDateInPast(date: Date | null | undefined) {
  if (!date) {
    return false;
  }
  return date.getTime() < Date.now();
}

function getStatusFromText(text: string, sourceType: SourceType, candidateCloseDate: Date | null) {
  const normalized = text.toLowerCase();
  const hasRelevantDate = Boolean(candidateCloseDate);
  const deadlineIsInPast = isDateInPast(candidateCloseDate);
  const hasOpenSignal =
    normalized.includes("en cours") ||
    normalized.includes("appel a projets") ||
    normalized.includes("appel de projets") ||
    normalized.includes("soumettre") ||
    normalized.includes("deposer une demande") ||
    normalized.includes("depot des demandes");

  if (deadlineIsInPast) {
    return {
      status: ProgramStatus.CLOSED,
      reason: `La date limite detectee (${candidateCloseDate!.toISOString().slice(0, 10)}) est dans le passe. Le programme est considere ferme.`,
      confidence: 88,
    };
  }

  if (
    normalized.includes("ferme") ||
    normalized.includes("fermé") ||
    normalized.includes("closed") ||
    normalized.includes("periode de depot s'est terminee") ||
    normalized.includes("periode de depot s’est terminee") ||
    normalized.includes("période de dépôt s'est terminée") ||
    normalized.includes("période de dépôt s’est terminée") ||
    normalized.includes("s'est terminee le") ||
    normalized.includes("s’est terminee le") ||
    normalized.includes("s'est terminée le") ||
    normalized.includes("s’est terminée le") ||
    normalized.includes("date limite depassee") ||
    normalized.includes("date limite dépassée") ||
    normalized.includes("complet") ||
    normalized.includes("aucun nouvel organisme")
  ) {
    return {
      status: ProgramStatus.CLOSED,
      reason: "La page officielle mentionne une fermeture ou une date limite depassee.",
      confidence: 85,
    };
  }

  if (hasOpenSignal && (hasRelevantDate || normalized.includes("en cours"))) {
    return {
      status: sourceType === SourceType.OFFICIAL ? ProgramStatus.OPEN : ProgramStatus.REVIEW,
      reason:
        sourceType === SourceType.OFFICIAL
          ? "La source officielle semble active et decrire un depot en cours avec un signal de date ou d'ouverture."
          : "Le programme est detecte sur une source secondaire; confirmation officielle requise.",
      confidence: sourceType === SourceType.OFFICIAL ? 72 : 48,
    };
  }

  return {
    status: ProgramStatus.REVIEW,
    reason: "Aucun signal officiel assez clair sur l'ouverture en cours; verification humaine recommandee.",
    confidence: 40,
  };
}

function detectList(text: string, dictionary: string[]) {
  const normalized = text.toLowerCase();
  return dictionary.filter((entry) => normalized.includes(entry.toLowerCase()));
}

function toAbsoluteUrl(sourceUrl: string, href: string) {
  try {
    return new URL(href, sourceUrl).toString();
  } catch {
    return sourceUrl;
  }
}

function normalizeWords(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

const genericProgramKeywords = [
  "fonds",
  "programme",
  "programmes",
  "subvention",
  "subventions",
  "financement",
  "soutien",
  "aide",
  "culture",
  "patrimoine",
  "appel",
  "projet",
  "projets",
  "rural",
  "ruralite",
  "régions",
  "regions",
  "mesures",
  "organismes",
  "organisme",
  "communautaire",
  "communication",
  "communications",
  "numerique",
  "numérique",
  "rayonnement",
  "promotion",
  "visibilite",
  "visibilité",
  "developpement",
  "développement",
  "fonctionnement",
  "partenariat",
  "social",
  "mediation",
  "médiation",
];

const lowValueLinkKeywords = ["contact", "nous joindre", "accueil", "a propos", "carriere", "carrieres"];

function pickDirectOfficialUrl(
  source: SourceRegistry,
  $: cheerio.CheerioAPI | null,
  targetName: string,
  fallbackPayload?: FallbackPayload | null,
) {
  if (fallbackPayload?.officialUrl) {
    if (isOfficialInstitutionUrl(fallbackPayload.officialUrl)) {
      return fallbackPayload.officialUrl;
    }

    return source.url;
  }

  if (!$) {
    return source.url;
  }

  const targetWords = normalizeWords(targetName);
  const regionalSource = source.governmentLevel?.toLowerCase() === "regional";
  let bestHref = source.url;
  let bestScore = 0;

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const text = $(element).text().replace(/\s+/g, " ").trim();

    if (!href || !text) {
      return;
    }

    const absoluteHref = toAbsoluteUrl(source.url, href);
    if (!absoluteHref.startsWith("http") || !isOfficialInstitutionUrl(absoluteHref)) {
      return;
    }

    const haystack = `${text} ${absoluteHref}`.toLowerCase();
    let score = 0;

    for (const word of targetWords) {
      if (haystack.includes(word)) {
        score += 2;
      }
    }

    if (haystack.includes("programme") || haystack.includes("subvention") || haystack.includes("aide")) {
      score += 1;
    }

    for (const keyword of genericProgramKeywords) {
      if (haystack.includes(keyword)) {
        score += regionalSource ? 3 : 2;
      }
    }

    for (const keyword of lowValueLinkKeywords) {
      if (haystack.includes(keyword)) {
        score -= 3;
      }
    }

    if (regionalSource && (absoluteHref.includes("/culture") || absoluteHref.includes("/fonds") || absoluteHref.includes("/programmes"))) {
      score += 4;
    }

    if (absoluteHref.endsWith(".pdf")) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestHref = absoluteHref;
    }
  });

  return bestHref;
}

function extractBodyExcerpt(bodyText: string, maxLength = 420) {
  if (!bodyText) {
    return null;
  }

  const excerpt = bodyText.slice(0, maxLength).trim();
  return excerpt.length ? excerpt : null;
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mergeArrays(regex: string[], ai: string[] | null | undefined): string[] {
  if (!ai || ai.length === 0) {
    return regex;
  }
  return Array.from(new Set([...regex, ...ai]));
}

export function parseProgramFromSource(
  source: SourceRegistry,
  html: string | null,
  fallbackPayload?: FallbackPayload | null,
  aiAnalysis?: AiProgramAnalysis | null,
): ParsedProgramPayload {
  const parsedFallback = fallbackPayload ?? {};
  const $ = html ? cheerio.load(html) : null;
  const bodyText = $ ? $("body").text().replace(/\s+/g, " ").trim() : "";
  const pageTitle = $?.("title").text().trim() || String(parsedFallback.name ?? source.name);
  const metaDescription =
    $?.('meta[name="description"]').attr("content")?.trim() ||
    String(parsedFallback.summary ?? source.description ?? "");
  const ai = aiAnalysis && (aiAnalysis.confidence ?? 0) >= 40 ? aiAnalysis : null;

  const candidateCloseDate =
    parseIsoDate(ai?.closesAt) ?? parseRelevantFrenchDeadlineFromText(bodyText || metaDescription);
  const statusInfo = getStatusFromText(bodyText || metaDescription, source.type, candidateCloseDate);

  const applicantTypes = mergeArrays(
    Array.from(
      new Set([
        ...(parsedFallback.applicantTypes ?? []),
        ...detectList(bodyText, ["OBNL", "organisme", "entreprise", "producteur", "artiste", "collectif"]),
      ]),
    ),
    ai?.applicantTypes,
  );
  const sectors = mergeArrays(
    Array.from(
      new Set([
        ...(parsedFallback.sectors ?? []),
        ...detectList(bodyText, [
          "marketing numerique",
          "branding",
          "rayonnement",
          "audiovisuel",
          "production video",
          "documentaire",
          "court metrage",
          "creation",
        ]),
      ]),
    ),
    ai?.sectors,
  );
  const projectStages = mergeArrays(
    Array.from(
      new Set([
        ...(parsedFallback.projectStages ?? []),
        ...detectList(bodyText, ["developpement", "production", "post-production", "diffusion", "creation"]),
      ]),
    ),
    ai?.projectStages,
  );
  const eligibleExpenses = mergeArrays(
    Array.from(
      new Set([
        ...(parsedFallback.eligibleExpenses ?? []),
        ...detectList(bodyText, ["photo", "video", "branding", "site web", "campagne numerique", "preproduction"]),
      ]),
    ),
    ai?.eligibleExpenses,
  );
  const directOfficialUrl = pickDirectOfficialUrl(source, $, pageTitle, parsedFallback);
  const details = ai?.details ?? parsedFallback.details ?? extractBodyExcerpt(bodyText, 560) ?? metaDescription;
  const eligibilityNotes =
    ai?.eligibilityNotes ??
    parsedFallback.eligibilityNotes ??
    (applicantTypes.length || eligibleExpenses.length
      ? `Demandeurs detectes: ${applicantTypes.join(", ") || "a confirmer"}. Depenses reperees: ${eligibleExpenses.join(", ") || "a confirmer"}.`
      : null);
  const applicationNotes =
    ai?.applicationNotes ??
    parsedFallback.applicationNotes ??
    (candidateCloseDate
      ? `Le prochain repere de depot detecte est autour du ${candidateCloseDate.toLocaleDateString("fr-CA")}. Toujours revalider sur la page officielle avant depot.`
      : "Verifier la page officielle pour la date limite, les formulaires et les pieces a joindre.");

  const aiStatus = ai?.status ? ProgramStatus[ai.status] : null;
  const resolvedStatus = aiStatus ?? statusInfo.status;
  const resolvedReason = ai?.statusReason ?? statusInfo.reason;

  const reviewFields: string[] = [];
  if (!candidateCloseDate && !(ai?.rolling ?? parsedFallback.intakeWindow?.rolling ?? false)) {
    reviewFields.push("dates");
  }
  if (resolvedStatus !== ProgramStatus.OPEN && source.type === SourceType.OFFICIAL) {
    reviewFields.push("status");
  }
  if (source.type === SourceType.AGGREGATOR || !isOfficialInstitutionUrl(source.url)) {
    reviewFields.push("verification_officielle");
  }

  const regexConfidence = Math.min(95, statusInfo.confidence + (html ? 10 : 0));
  const confidence = Math.max(
    Number(parsedFallback.confidence ?? 0),
    ai ? Math.max(regexConfidence, ai.confidence ?? 0) : regexConfidence,
  );

  return {
    slug: slugify(pageTitle),
    name: pageTitle,
    organization: ai?.organization ?? String(parsedFallback.organization ?? source.name),
    summary: ai?.summary ?? metaDescription,
    officialUrl: isOfficialInstitutionUrl(directOfficialUrl) ? directOfficialUrl : source.url,
    sourceLandingUrl: isOfficialInstitutionUrl(source.url) ? source.url : null,
    governmentLevel: String(parsedFallback.governmentLevel ?? source.governmentLevel ?? "A confirmer"),
    region: String(parsedFallback.region ?? "Quebec"),
    status: source.type === SourceType.OFFICIAL ? resolvedStatus : ProgramStatus.REVIEW,
    confidence,
    details,
    eligibilityNotes,
    applicationNotes,
    applicantTypes,
    sectors,
    projectStages,
    eligibleExpenses,
    maxAmount: ai?.maxAmount ?? parsedFallback.maxAmount ?? null,
    maxCoveragePct: ai?.maxCoveragePct ?? parsedFallback.maxCoveragePct ?? null,
    openStatusReason: parsedFallback.openStatusReason ?? resolvedReason,
    intakeWindow: {
      rolling: Boolean(ai?.rolling ?? parsedFallback.intakeWindow?.rolling),
      opensAt: parseIsoDate(ai?.opensAt) ?? (parsedFallback.intakeWindow?.opensAt ? new Date(parsedFallback.intakeWindow.opensAt) : null),
      closesAt: candidateCloseDate ?? (parsedFallback.intakeWindow?.closesAt ? new Date(parsedFallback.intakeWindow.closesAt) : null),
    },
    shouldReview: reviewFields.length > 0,
    reviewFields,
  };
}
