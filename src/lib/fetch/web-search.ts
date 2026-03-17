import { z } from "zod";

import { getXaiClient, isXaiSearchEnabled } from "@/lib/ai/provider";
import { env } from "@/lib/env";
import { isOfficialInstitutionUrl } from "@/lib/source-registry";

const SEARCH_TIMEOUT_MS = 6_000;
const MAX_RESULTS = 8;
const MAX_SNIPPET_LENGTH = 800;
const RESULTS_PER_QUERY = 4;
const FETCHED_PAGE_COUNT = 5;
const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HINTS = 3;
const MAX_HINT_QUERIES = 2;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type WebSearchContext = {
  snippets: string;
  sources: string[];
};

type CachedSearchContext = {
  expiresAt: number;
  value: WebSearchContext | null;
};

const HELLODARWIN_HOSTS = new Set(["hellodarwin.com", "www.hellodarwin.com"]);
const searchCache = new Map<string, CachedSearchContext>();

const xaiSearchResponseSchema = z.object({
  results: z
    .array(
      z.object({
        title: z.string().default(""),
        url: z.string().url(),
        snippet: z.string().default(""),
      }),
    )
    .default([]),
});

function buildCacheKey(sourceName: string, sourceUrl: string) {
  return `${sourceName}::${sourceUrl}`.toLowerCase().trim();
}

function getCachedContext(cacheKey: string) {
  const entry = searchCache.get(cacheKey);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt < Date.now()) {
    searchCache.delete(cacheKey);
    return undefined;
  }

  return entry.value;
}

function setCachedContext(cacheKey: string, value: WebSearchContext | null) {
  searchCache.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    value,
  });

  if (searchCache.size > 250) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) {
      searchCache.delete(oldestKey);
    }
  }
}

function isHelloDarwinUrl(url: string): boolean {
  try {
    return HELLODARWIN_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function normalizeSearchUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";

    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_eid|mc_cid)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }

    const normalized = parsed.toString().replace(/\/$/, "");
    return normalized;
  } catch {
    return url.trim();
  }
}

function cleanHintText(value: string) {
  return value
    .replace(/HelloDarwin/gi, "")
    .replace(/hellodarwin\.com/gi, "")
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyUsefulHint(value: string) {
  const normalized = value.toLowerCase();
  const requiredSignals = ["programme", "subvention", "aide", "fonds", "volet"];
  return requiredSignals.some((signal) => normalized.includes(signal));
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, kl: "ca-fr" });
  const url = `https://html.duckduckgo.com/html/?${params.toString()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: {
      "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
      accept: "text/html",
    },
  });

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const results: SearchResult[] = [];
  const resultBlocks = html.split(/class="result\s/);

  for (const block of resultBlocks.slice(1, MAX_RESULTS + 1)) {
    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)/);
    const hrefMatch = block.match(/class="result__a"\s+href="([^"]+)"/);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)(?:<\/a>|<\/td>)/);

    const title = titleMatch?.[1]?.trim() ?? "";
    const rawUrl = hrefMatch?.[1] ?? "";
    const snippet = (snippetMatch?.[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_SNIPPET_LENGTH);

    if (!title || !snippet) {
      continue;
    }

    let resolvedUrl = rawUrl;
    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      resolvedUrl = decodeURIComponent(uddgMatch[1]);
    }

    results.push({
      title,
      url: normalizeSearchUrl(resolvedUrl),
      snippet,
    });
  }

  return results;
}

async function discoverHelloDarwinHints(sourceName: string): Promise<string[]> {
  try {
    const query = `site:hellodarwin.com "${sourceName}" subvention programme`;
    const results = await searchDuckDuckGo(query);

    return results
      .slice(0, MAX_HINTS)
      .map((result) => cleanHintText(`${result.title} ${result.snippet}`))
      .filter((hint) => hint.length > 20)
      .filter(isLikelyUsefulHint)
      .map((hint) => hint.slice(0, 220));
  } catch {
    return [];
  }
}

function buildOfficialSearchQueries(sourceName: string, sourceUrl: string, hints: string[] = []): string[] {
  const domain = safeHostname(sourceUrl);
  const sitePart = domain ? `site:${domain}` : "";

  const siteQueries = sitePart
    ? [
        `${sourceName} ${sitePart} date limite admissibilite programme`,
        `${sourceName} ${sitePart} volet guide depot calendrier`,
        `${sourceName} ${sitePart} depenses admissibles honoraires professionnels`,
      ]
    : [`${sourceName} date limite admissibilite programme officiel`];

  const broadQueries = [
    `"${sourceName}" programme officiel Quebec Canada subvention organisme`,
    `"${sourceName}" OBNL communications rayonnement developpement organisationnel`,
    `"${sourceName}" depenses admissibles consultants honoraires professionnels`,
  ];

  const hintQueries = hints.slice(0, MAX_HINT_QUERIES).map((hint) => {
    const compactHint = hint
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 8)
      .join(" ");
    return `${compactHint} programme officiel subvention Quebec Canada`;
  });

  return [...siteQueries, ...broadQueries, ...hintQueries].map((query) => query.trim()).filter(Boolean);
}

async function searchWithXai(query: string): Promise<SearchResult[]> {
  const client = getXaiClient();
  if (!client) {
    return [];
  }

  try {
    const response = await client.chat.completions.create({
      model: env.xaiModel,
      messages: [
        {
          role: "system",
          content:
            "Tu fais de la recherche web pour des programmes de subventions Quebec/Canada. " +
            'Retourne strictement un JSON valide de la forme {"results":[{"title":"","url":"","snippet":""}]}. ' +
            "Ne retourne que des pages plausiblement officielles ou institutionnelles. Aucun commentaire hors JSON.",
        },
        { role: "user", content: query },
      ],
      response_format: { type: "json_object" },
      // @ts-expect-error xAI-specific extension
      search_mode: "auto",
    });

    const raw = response.choices?.[0]?.message?.content ?? "";
    const parsed = xaiSearchResponseSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      return [];
    }

    return parsed.data.results.slice(0, MAX_RESULTS).map((result) => ({
      title: result.title.trim(),
      url: normalizeSearchUrl(result.url),
      snippet: result.snippet.trim().slice(0, MAX_SNIPPET_LENGTH),
    }));
  } catch {
    return [];
  }
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      headers: {
        "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
        accept: "text/html",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
  } catch {
    return null;
  }
}

function scoreSearchResult(result: SearchResult, sourceUrl: string) {
  let score = 0;
  const haystack = `${result.title} ${result.url} ${result.snippet}`.toLowerCase();

  if (isOfficialInstitutionUrl(result.url)) {
    score += 15;
  }

  const sourceHostname = safeHostname(sourceUrl);
  if (sourceHostname && safeHostname(result.url) === sourceHostname) {
    score += 12;
  }

  const strongKeywords = [
    "programme",
    "subvention",
    "aide",
    "fonds",
    "date limite",
    "depot",
    "dépôt",
    "organisme",
    "obnl",
    "rayonnement",
    "communication",
    "numerique",
    "numérique",
    "fonctionnement",
    "partenariat",
    "image de marque",
    "branding",
    "marketing",
    "developpement organisationnel",
    "développement organisationnel",
    "strategie numerique",
    "stratégie numérique",
    "visibilite",
    "visibilité",
    "promotion",
    "site web",
    "mediation",
    "médiation",
    "participation culturelle",
    "volet",
    "guide",
    "admissibilite",
    "admissibilité",
    "cadre normatif",
    "calendrier",
    "honoraires professionnels",
    "consultants",
  ];

  for (const keyword of strongKeywords) {
    if (haystack.includes(keyword)) {
      score += 2;
    }
  }

  const weakKeywords = ["accueil", "contact", "nous joindre", "a propos", "carriere", "connexion"];
  for (const keyword of weakKeywords) {
    if (haystack.includes(keyword)) {
      score -= 5;
    }
  }

  return score;
}

function dedupeSearchResults(results: SearchResult[]) {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const result of results) {
    const normalizedUrl = normalizeSearchUrl(result.url);
    if (!normalizedUrl || seen.has(normalizedUrl)) {
      continue;
    }

    seen.add(normalizedUrl);
    deduped.push({
      ...result,
      url: normalizedUrl,
    });
  }

  return deduped;
}

function keepOnlyOfficialResults(results: SearchResult[]) {
  return results.filter((result) => isOfficialInstitutionUrl(result.url));
}

export async function searchWebForProgramContext(
  sourceName: string,
  sourceUrl: string,
): Promise<WebSearchContext | null> {
  const cacheKey = buildCacheKey(sourceName, sourceUrl);
  const cached = getCachedContext(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  try {
    const helloDarwinHintsPromise = discoverHelloDarwinHints(sourceName);
    const xaiPromise = isXaiSearchEnabled()
      ? searchWithXai(
          `Trouve les pages officielles québécoises et canadiennes pour le programme "${sourceName}". ` +
            `Cherche les pages de programme, volet, guide, cadre normatif, calendrier, dépenses admissibles et dates limites. ` +
            `Priorise quebec.ca, gouv.qc.ca, canada.ca, gc.ca, conseils des arts, téléfilm, municipalités et MRC.`,
        )
      : Promise.resolve([]);

    const helloDarwinHints = await helloDarwinHintsPromise;
    const queries = buildOfficialSearchQueries(sourceName, sourceUrl, helloDarwinHints);
    const duckDuckGoSettled = await Promise.allSettled(queries.map((query) => searchDuckDuckGo(query)));
    const xaiResults = await xaiPromise;

    const ddgResults = duckDuckGoSettled
      .filter((result): result is PromiseFulfilledResult<SearchResult[]> => result.status === "fulfilled")
      .flatMap((result) => result.value.slice(0, RESULTS_PER_QUERY));

    const merged = dedupeSearchResults(
      [...ddgResults, ...xaiResults].filter((result) => !isHelloDarwinUrl(result.url)),
    );
    const officialResults = keepOnlyOfficialResults(merged);

    if (!officialResults.length) {
      setCachedContext(cacheKey, null);
      return null;
    }

    const rankedResults = officialResults
      .map((result) => ({
        ...result,
        relevanceScore: scoreSearchResult(result, sourceUrl),
      }))
      .sort((left, right) => right.relevanceScore - left.relevanceScore)
      .slice(0, FETCHED_PAGE_COUNT);

    const pageTexts = await Promise.all(
      rankedResults.map(async (result) => {
        const pageText = await fetchPageText(result.url);
        return {
          ...result,
          pageText,
        };
      }),
    );

    const sections = pageTexts
      .filter((result) => Boolean(result.pageText || result.snippet))
      .map((result) => {
        const content = result.pageText ?? result.snippet;
        return `[${result.title || result.url}] (${result.url})\n${content}`;
      });

    const sources = pageTexts.map((result) => result.url);
    const snippets = sections.join("\n---\n").slice(0, 8000);
    const value = snippets.length > 50 ? { snippets, sources } : null;

    setCachedContext(cacheKey, value);
    return value;
  } catch {
    setCachedContext(cacheKey, null);
    return null;
  }
}

export const __test__ = {
  isHelloDarwinUrl,
  cleanHintText,
  isLikelyUsefulHint,
  normalizeSearchUrl,
  dedupeSearchResults,
  keepOnlyOfficialResults,
  buildOfficialSearchQueries,
};

export type { WebSearchContext, SearchResult };
