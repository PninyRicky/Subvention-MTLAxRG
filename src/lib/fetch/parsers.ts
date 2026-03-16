import * as cheerio from "cheerio";
import { ProgramStatus, SourceType, type SourceRegistry } from "@prisma/client";

import { parseFrenchDateFromText } from "@/lib/dates";
import { slugify } from "@/lib/utils";

export type ParsedProgramPayload = {
  slug: string;
  name: string;
  organization: string;
  summary: string;
  officialUrl: string;
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
  governmentLevel?: string;
  region?: string;
  status?: string;
  confidence?: number;
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

function getStatusFromText(text: string, sourceType: SourceType) {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("ferme") ||
    normalized.includes("fermé") ||
    normalized.includes("closed") ||
    normalized.includes("date limite depassee")
  ) {
    return {
      status: ProgramStatus.CLOSED,
      reason: "La page officielle mentionne une fermeture ou une date limite depassee.",
      confidence: 85,
    };
  }

  if (
    normalized.includes("appel a projets") ||
    normalized.includes("appel de projets") ||
    normalized.includes("soumettre") ||
    normalized.includes("deposer une demande") ||
    normalized.includes("depot des demandes")
  ) {
    return {
      status: sourceType === SourceType.OFFICIAL ? ProgramStatus.OPEN : ProgramStatus.REVIEW,
      reason:
        sourceType === SourceType.OFFICIAL
          ? "La source officielle semble active et decrire un depot en cours."
          : "Le programme est detecte sur une source secondaire; confirmation officielle requise.",
      confidence: sourceType === SourceType.OFFICIAL ? 72 : 48,
    };
  }

  return {
    status: sourceType === SourceType.OFFICIAL ? ProgramStatus.REVIEW : ProgramStatus.REVIEW,
    reason: "Aucun signal assez clair sur l'ouverture; verification humaine recommandee.",
    confidence: 40,
  };
}

function detectList(text: string, dictionary: string[]) {
  const normalized = text.toLowerCase();
  return dictionary.filter((entry) => normalized.includes(entry.toLowerCase()));
}

export function parseProgramFromSource(
  source: SourceRegistry,
  html: string | null,
  fallbackPayload?: FallbackPayload | null,
): ParsedProgramPayload {
  const parsedFallback = fallbackPayload ?? {};
  const $ = html ? cheerio.load(html) : null;
  const bodyText = $ ? $("body").text().replace(/\s+/g, " ").trim() : "";
  const pageTitle = $?.("title").text().trim() || String(parsedFallback.name ?? source.name);
  const metaDescription =
    $?.('meta[name="description"]').attr("content")?.trim() ||
    String(parsedFallback.summary ?? source.description ?? "");

  const statusInfo = getStatusFromText(bodyText || metaDescription, source.type);
  const candidateCloseDate = parseFrenchDateFromText(bodyText);

  const applicantTypes = Array.from(
    new Set([
      ...(parsedFallback.applicantTypes ?? []),
      ...detectList(bodyText, ["OBNL", "organisme", "entreprise", "producteur", "artiste", "collectif"]),
    ]),
  );
  const sectors = Array.from(
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
  );
  const projectStages = Array.from(
    new Set([
      ...(parsedFallback.projectStages ?? []),
      ...detectList(bodyText, ["developpement", "production", "post-production", "diffusion", "creation"]),
    ]),
  );
  const eligibleExpenses = Array.from(
    new Set([
      ...(parsedFallback.eligibleExpenses ?? []),
      ...detectList(bodyText, ["photo", "video", "branding", "site web", "campagne numerique", "preproduction"]),
    ]),
  );

  const reviewFields: string[] = [];
  if (!candidateCloseDate && !(parsedFallback.intakeWindow?.rolling ?? false)) {
    reviewFields.push("dates");
  }
  if (statusInfo.status !== ProgramStatus.OPEN && source.type === SourceType.OFFICIAL) {
    reviewFields.push("status");
  }
  if (source.type === SourceType.AGGREGATOR) {
    reviewFields.push("verification_officielle");
  }

  const confidence = Math.max(
    Number(parsedFallback.confidence ?? 0),
    Math.min(95, statusInfo.confidence + (html ? 10 : 0)),
  );

  return {
    slug: slugify(pageTitle),
    name: pageTitle,
    organization: String(parsedFallback.organization ?? source.name),
    summary: metaDescription,
    officialUrl: source.url,
    governmentLevel: String(parsedFallback.governmentLevel ?? source.governmentLevel ?? "A confirmer"),
    region: String(parsedFallback.region ?? "Quebec"),
    status:
      source.type === SourceType.OFFICIAL
        ? statusInfo.status
        : ProgramStatus.REVIEW,
    confidence,
    applicantTypes,
    sectors,
    projectStages,
    eligibleExpenses,
    maxAmount: parsedFallback.maxAmount ?? null,
    maxCoveragePct: parsedFallback.maxCoveragePct ?? null,
    openStatusReason: parsedFallback.openStatusReason ?? statusInfo.reason,
    intakeWindow: {
      rolling: Boolean(parsedFallback.intakeWindow?.rolling),
      opensAt: parsedFallback.intakeWindow?.opensAt ? new Date(parsedFallback.intakeWindow.opensAt) : null,
      closesAt: candidateCloseDate ?? (parsedFallback.intakeWindow?.closesAt ? new Date(parsedFallback.intakeWindow.closesAt) : null),
    },
    shouldReview: reviewFields.length > 0,
    reviewFields,
  };
}
