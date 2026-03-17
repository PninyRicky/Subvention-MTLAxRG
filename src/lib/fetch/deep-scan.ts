import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";
import type { SourceRegistry } from "@prisma/client";

import { hashContent } from "@/lib/utils";
import { isOfficialInstitutionUrl } from "@/lib/source-registry";

export type CrawlSeedType = "portal" | "program" | "calendar";

export type DiscoveredDocument = {
  url: string;
  title: string | null;
  rawContent: string;
  textContent: string;
  contentHash: string;
  contentKind: "HTML" | "PDF";
  depth: number;
};

const SOURCE_FETCH_TIMEOUT_MS = 8_000;
const SOURCE_FETCH_MAX_ATTEMPTS = 2;
const MAX_DEPTH = 3;
const MAX_HTML_PAGES = 12;
const MAX_PDF_PAGES = 2;
const LINK_BLOCKLIST = ["contact", "carriere", "carrieres", "nouvelles", "faq", "communique", "recherche", "login"];
const LINK_PRIORITY_KEYWORDS = [
  "programme",
  "programmes",
  "subvention",
  "subventions",
  "appel",
  "volet",
  "guide",
  "cadre",
  "normatif",
  "admissibilite",
  "admissibilité",
  "calendrier",
  "depot",
  "dépôt",
  ".pdf",
];

type FetchResult = {
  url: string;
  contentType: string;
  body: string;
  textContent: string;
  title: string | null;
  contentKind: "HTML" | "PDF";
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSeedType(source: SourceRegistry): CrawlSeedType {
  const payload = (source.fallbackPayload ?? null) as Record<string, unknown> | null;
  const explicit = payload?.seedType;

  if (explicit === "portal" || explicit === "program" || explicit === "calendar") {
    return explicit;
  }

  const haystack = `${source.name} ${source.url} ${source.description ?? ""}`.toLowerCase();

  if (haystack.includes("calendrier")) return "calendar";
  if (haystack.includes("programmes/") || haystack.includes("financement") || haystack.includes("aide-financiere")) {
    return "portal";
  }

  return "program";
}

export function isGeneratedRegionalPortalSource(source: SourceRegistry) {
  const payload = (source.fallbackPayload ?? null) as Record<string, unknown> | null;
  const details = typeof payload?.details === "string" ? payload.details.toLowerCase() : "";
  const name = source.name.toLowerCase();

  return (
    source.governmentLevel?.toLowerCase() === "regional" &&
    (name.includes("portail officiel territorial") ||
      details.includes("cette fiche est générée à partir du répertoire officiel des mrc du québec"))
  );
}

function shouldUseDeepScanForSource(source: SourceRegistry, manualMode: boolean) {
  if (!manualMode) {
    return false;
  }

  return !isGeneratedRegionalPortalSource(source);
}

function isPdfUrl(url: string) {
  return url.toLowerCase().endsWith(".pdf");
}

function normalizeUrl(rawUrl: string, baseUrl: string) {
  try {
    const url = new URL(rawUrl, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function getHostnameFamily(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return hostname;
  } catch {
    return "";
  }
}

function isAllowedOfficialUrl(candidateUrl: string, sourceUrl: string) {
  if (!isOfficialInstitutionUrl(candidateUrl)) {
    return false;
  }

  const sourceHost = getHostnameFamily(sourceUrl);
  const candidateHost = getHostnameFamily(candidateUrl);

  if (!sourceHost || !candidateHost) {
    return false;
  }

  return (
    candidateHost === sourceHost ||
    candidateHost.endsWith(`.${sourceHost}`) ||
    sourceHost.endsWith(`.${candidateHost}`)
  );
}

function scoreCandidateLink(href: string, anchorText: string) {
  const haystack = `${href} ${anchorText}`.toLowerCase();

  if (LINK_BLOCKLIST.some((blocked) => haystack.includes(blocked))) {
    return -10;
  }

  let score = 0;
  for (const keyword of LINK_PRIORITY_KEYWORDS) {
    if (haystack.includes(keyword)) {
      score += 2;
    }
  }

  if (isPdfUrl(href)) {
    score += 3;
  }

  return score;
}

async function fetchOfficialDocument(url: string): Promise<FetchResult | null> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= SOURCE_FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
        headers: {
          "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
        },
        next: {
          revalidate: 0,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (isPdfUrl(url) || contentType.includes("pdf")) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const pdf = await pdfParse(buffer);
        const textContent = pdf.text.replace(/\s+/g, " ").trim();

        return {
          url,
          contentType,
          body: textContent,
          textContent,
          title: pdf.info?.Title ?? null,
          contentKind: "PDF",
        };
      }

      const body = await response.text();
      const $ = cheerio.load(body);
      const title = $("title").text().trim() || null;
      const textContent = $("body").text().replace(/\s+/g, " ").trim();

      return {
        url,
        contentType,
        body,
        textContent,
        title,
        contentKind: "HTML",
      };
    } catch (error) {
      lastError = error;

      if (attempt < SOURCE_FETCH_MAX_ATTEMPTS) {
        await wait(350 * attempt);
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(`Echec de collecte profonde pour ${url}:`, lastError);
  }

  return null;
}

function extractCandidateLinks(html: string, currentUrl: string, sourceUrl: string) {
  const $ = cheerio.load(html);
  const links = new Map<string, number>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const text = $(element).text().replace(/\s+/g, " ").trim();

    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) {
      return;
    }

    const absoluteUrl = normalizeUrl(href, currentUrl);
    if (!absoluteUrl || !absoluteUrl.startsWith("http")) {
      return;
    }

    if (!isAllowedOfficialUrl(absoluteUrl, sourceUrl)) {
      return;
    }

    const score = scoreCandidateLink(absoluteUrl, text);
    if (score <= 0) {
      return;
    }

    links.set(absoluteUrl, Math.max(score, links.get(absoluteUrl) ?? 0));
  });

  return [...links.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([url]) => url);
}

export const __testing__ = {
  extractCandidateLinks,
  getSeedType,
  shouldUseDeepScanForSource,
  isGeneratedRegionalPortalSource,
};

export async function discoverSourceDocuments(
  source: SourceRegistry,
  options: {
    manualMode: boolean;
    seedUrls?: string[];
  },
) {
  const documents: DiscoveredDocument[] = [];
  const seedType = getSeedType(source);
  const shouldDeepScan = shouldUseDeepScanForSource(source, options.manualMode);
  const seedUrls = (options.seedUrls?.length ? options.seedUrls : [source.url]).filter(Boolean);
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = seedUrls.map((url) => ({ url, depth: 0 }));
  let htmlCount = 0;
  let pdfCount = 0;

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;

    if (visited.has(current.url) || current.depth > MAX_DEPTH) {
      continue;
    }

    if (!shouldDeepScan && current.depth > 0) {
      continue;
    }

    if ((seedType === "program" || !shouldDeepScan) && current.depth > 0) {
      continue;
    }

    visited.add(current.url);
    const fetched = await fetchOfficialDocument(current.url);

    if (!fetched || !fetched.textContent) {
      continue;
    }

    if (fetched.contentKind === "HTML") {
      if (htmlCount >= MAX_HTML_PAGES) {
        continue;
      }
      htmlCount += 1;
    } else {
      if (pdfCount >= MAX_PDF_PAGES) {
        continue;
      }
      pdfCount += 1;
    }

    documents.push({
      url: fetched.url,
      title: fetched.title,
      rawContent: fetched.body,
      textContent: fetched.textContent,
      contentHash: hashContent(fetched.textContent),
      contentKind: fetched.contentKind,
      depth: current.depth,
    });

    if (!shouldDeepScan || fetched.contentKind !== "HTML" || current.depth >= MAX_DEPTH) {
      continue;
    }

    const candidateLinks = extractCandidateLinks(fetched.body, current.url, source.url);
    for (const candidateUrl of candidateLinks) {
      if (!visited.has(candidateUrl)) {
        queue.push({ url: candidateUrl, depth: current.depth + 1 });
      }
    }
  }

  return {
    documents,
    htmlPageCount: htmlCount,
    pdfCount,
  };
}
