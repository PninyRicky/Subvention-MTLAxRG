import * as cheerio from "cheerio";
import { ProgramStatus, SourceType, type SourceRegistry } from "@prisma/client";

import type { AiProgramAnalysis, AiProgramEntry } from "@/lib/ai/schema";
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
  eligibleProfessionalServices: boolean | null;
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
  eligibleProfessionalServices?: boolean | null;
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
    normalized.includes("depot des demandes") ||
    normalized.includes("dépôt des demandes") ||
    normalized.includes("en tout temps") ||
    normalized.includes("en continu");

  if (deadlineIsInPast) {
    return {
      status: ProgramStatus.CLOSED,
      reason: `La date limite détectée (${candidateCloseDate!.toISOString().slice(0, 10)}) est passée.`,
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
    normalized.includes("aucune nouvelle demande") ||
    normalized.includes("aucun nouvel organisme")
  ) {
    return {
      status: ProgramStatus.CLOSED,
      reason: "La page officielle mentionne une fermeture ou une période de dépôt terminée.",
      confidence: 86,
    };
  }

  if (normalized.includes("en continu") || normalized.includes("en tout temps")) {
    return {
      status: sourceType === SourceType.OFFICIAL ? ProgramStatus.OPEN : ProgramStatus.REVIEW,
      reason: "La page indique explicitement un dépôt en continu ou en tout temps.",
      confidence: sourceType === SourceType.OFFICIAL ? 82 : 52,
    };
  }

  if (hasOpenSignal && (hasRelevantDate || normalized.includes("en cours"))) {
    return {
      status: sourceType === SourceType.OFFICIAL ? ProgramStatus.OPEN : ProgramStatus.REVIEW,
      reason:
        sourceType === SourceType.OFFICIAL
          ? "La source officielle semble active et décrit un dépôt en cours."
          : "Le programme est détecté sur une source secondaire; confirmation officielle requise.",
      confidence: sourceType === SourceType.OFFICIAL ? 72 : 48,
    };
  }

  return {
    status: ProgramStatus.REVIEW,
    reason: "Aucun signal officiel assez clair sur l'ouverture en cours; vérification humaine recommandée.",
    confidence: 42,
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
  "guide",
  "calendrier",
  "cadre",
  "admissibilite",
  "admissibilité",
  "depot",
  "dépôt",
];

const lowValueLinkKeywords = ["contact", "nous joindre", "accueil", "a propos", "carriere", "carrieres"];
const professionalServicesKeywords = [
  "honoraires professionnels",
  "honoraires",
  "consultants",
  "services de consultants",
  "accompagnement",
  "outils numeriques",
  "outils numériques",
  "saas",
  "developpement organisationnel",
  "développement organisationnel",
  "communications",
  "rayonnement",
];
const professionalServicesExclusionKeywords = [
  "honoraires non admissibles",
  "consultants non admissibles",
  "services professionnels non admissibles",
];

function pickDirectOfficialUrl(
  source: SourceRegistry,
  $: cheerio.CheerioAPI | null,
  targetName: string,
  fallbackPayload?: FallbackPayload | null,
) {
  if (fallbackPayload?.officialUrl && isOfficialInstitutionUrl(fallbackPayload.officialUrl)) {
    return fallbackPayload.officialUrl;
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

function detectProfessionalServicesFlag({
  ai,
  bodyText,
  eligibilityNotes,
  applicationNotes,
  details,
  eligibleExpenses,
  fallbackPayload,
}: {
  ai: AiProgramEntry | null;
  bodyText: string;
  eligibilityNotes: string | null;
  applicationNotes: string | null;
  details: string | null;
  eligibleExpenses: string[];
  fallbackPayload: FallbackPayload;
}) {
  if (typeof ai?.eligibleProfessionalServices === "boolean") {
    return ai.eligibleProfessionalServices;
  }

  if (typeof fallbackPayload.eligibleProfessionalServices === "boolean") {
    return fallbackPayload.eligibleProfessionalServices;
  }

  const haystack = [bodyText, eligibilityNotes, applicationNotes, details, ...eligibleExpenses]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (professionalServicesExclusionKeywords.some((keyword) => haystack.includes(keyword))) {
    return false;
  }

  if (professionalServicesKeywords.some((keyword) => haystack.includes(keyword))) {
    return true;
  }

  return null;
}

function buildSlug(source: SourceRegistry, name: string, officialUrl: string) {
  return slugify(`${source.name}-${name}-${officialUrl}`).slice(0, 180);
}

function buildParsedProgram(
  source: SourceRegistry,
  $: cheerio.CheerioAPI | null,
  bodyText: string,
  metaDescription: string,
  pageTitle: string,
  parsedFallback: FallbackPayload,
  ai: AiProgramEntry | null,
): ParsedProgramPayload {
  const name = ai?.programName ?? pageTitle;
  const directOfficialUrl =
    ai?.officialUrl && isOfficialInstitutionUrl(ai.officialUrl)
      ? ai.officialUrl
      : pickDirectOfficialUrl(source, $, name, parsedFallback);
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
          "communications",
          "developpement organisationnel",
          "culture",
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
        ...detectList(bodyText, [
          "photo",
          "video",
          "branding",
          "site web",
          "campagne numerique",
          "preproduction",
          "communications",
          "rayonnement",
          "consultants",
          "honoraires professionnels",
          "outils numeriques",
          "saas",
          "developpement organisationnel",
        ]),
      ]),
    ),
    ai?.eligibleExpenses,
  );
  const details = ai?.details ?? parsedFallback.details ?? extractBodyExcerpt(bodyText, 560) ?? metaDescription;
  const eligibilityNotes =
    ai?.eligibilityNotes ??
    parsedFallback.eligibilityNotes ??
    (applicantTypes.length || eligibleExpenses.length
      ? `Demandeurs détectés: ${applicantTypes.join(", ") || "à confirmer"}. Dépenses repérées: ${eligibleExpenses.join(", ") || "à confirmer"}.`
      : null);
  const applicationNotes =
    ai?.applicationNotes ??
    parsedFallback.applicationNotes ??
    (candidateCloseDate
      ? `Le prochain repère de dépôt détecté est autour du ${candidateCloseDate.toLocaleDateString("fr-CA")}. Toujours revalider sur la page officielle avant dépôt.`
      : "Vérifier la page officielle pour la date limite, les formulaires et les pièces à joindre.");
  const aiStatus = ai?.status ? ProgramStatus[ai.status] : null;
  const resolvedStatus = aiStatus ?? statusInfo.status;
  const resolvedReason = ai?.statusReason ?? parsedFallback.openStatusReason ?? statusInfo.reason;
  const reviewFields: string[] = [];
  const rolling = Boolean(ai?.rolling ?? parsedFallback.intakeWindow?.rolling);

  if (!candidateCloseDate && !rolling) {
    reviewFields.push("dates");
  }
  if (resolvedStatus !== ProgramStatus.OPEN && source.type === SourceType.OFFICIAL) {
    reviewFields.push("status");
  }
  if (ai?.reviewReason) {
    reviewFields.push("volets");
  }
  if (source.type === SourceType.AGGREGATOR || !isOfficialInstitutionUrl(source.url)) {
    reviewFields.push("verification_officielle");
  }

  const regexConfidence = Math.min(95, statusInfo.confidence + ($ ? 10 : 0));
  const confidence = Math.max(
    Number(parsedFallback.confidence ?? 0),
    ai ? Math.max(regexConfidence, ai.confidence ?? 0) : regexConfidence,
  );
  const officialUrl = isOfficialInstitutionUrl(directOfficialUrl) ? directOfficialUrl : source.url;

  return {
    slug: buildSlug(source, name, officialUrl),
    name,
    organization: ai?.organization ?? String(parsedFallback.organization ?? source.name),
    summary: ai?.summary ?? metaDescription,
    officialUrl,
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
    eligibleProfessionalServices: detectProfessionalServicesFlag({
      ai,
      bodyText,
      eligibilityNotes,
      applicationNotes,
      details,
      eligibleExpenses,
      fallbackPayload: parsedFallback,
    }),
    maxAmount: ai?.maxAmount ?? parsedFallback.maxAmount ?? null,
    maxCoveragePct: ai?.maxCoveragePct ?? parsedFallback.maxCoveragePct ?? null,
    openStatusReason: resolvedReason,
    intakeWindow: {
      rolling,
      opensAt:
        parseIsoDate(ai?.opensAt) ??
        (parsedFallback.intakeWindow?.opensAt ? new Date(parsedFallback.intakeWindow.opensAt) : null),
      closesAt:
        candidateCloseDate ??
        (parsedFallback.intakeWindow?.closesAt ? new Date(parsedFallback.intakeWindow.closesAt) : null),
    },
    shouldReview: reviewFields.length > 0,
    reviewFields,
  };
}

export function parseProgramsFromSource(
  source: SourceRegistry,
  html: string | null,
  fallbackPayload?: FallbackPayload | null,
  aiAnalysis?: AiProgramAnalysis | null,
  rawTextOverride?: string | null,
) {
  const parsedFallback = fallbackPayload ?? {};
  const $ = html ? cheerio.load(html) : null;
  const bodyText = rawTextOverride ?? ($ ? $("body").text().replace(/\s+/g, " ").trim() : "");
  const pageTitle = $?.("title").text().trim() || String(parsedFallback.name ?? source.name);
  const metaDescription =
    $?.('meta[name="description"]').attr("content")?.trim() ||
    String(parsedFallback.summary ?? source.description ?? "");
  const candidates = (aiAnalysis?.programs ?? []).filter((entry) => (entry.confidence ?? 0) >= 40);

  if (!candidates.length) {
    return [buildParsedProgram(source, $, bodyText, metaDescription, pageTitle, parsedFallback, null)];
  }

  const programs = candidates.map((entry) =>
    buildParsedProgram(
      source,
      $,
      bodyText,
      metaDescription,
      entry.programName ?? pageTitle,
      parsedFallback,
      entry,
    ),
  );

  return Array.from(new Map(programs.map((program) => [program.slug, program])).values());
}

export function parseProgramFromSource(
  source: SourceRegistry,
  html: string | null,
  fallbackPayload?: FallbackPayload | null,
  aiAnalysis?: AiProgramAnalysis | null,
  rawTextOverride?: string | null,
): ParsedProgramPayload {
  return parseProgramsFromSource(source, html, fallbackPayload, aiAnalysis, rawTextOverride)[0];
}
