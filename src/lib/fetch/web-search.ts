import { isOfficialInstitutionUrl } from "@/lib/source-registry";

const SEARCH_TIMEOUT_MS = 6_000;
const MAX_RESULTS = 8;
const MAX_SNIPPET_LENGTH = 800;
const RESULTS_PER_QUERY = 4;
const FETCHED_PAGE_COUNT = 5;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

/**
 * Searches DuckDuckGo HTML for grant-related information.
 * Returns plain-text snippets that can be appended to the AI prompt
 * so the model has extra context about deadlines, eligibility, etc.
 */
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

  // Extract result blocks from DuckDuckGo HTML response.
  // Each result lives inside a <div class="result..."> with an <a class="result__a"> and <a class="result__snippet">.
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

    if (!title || !snippet) continue;

    // DuckDuckGo wraps URLs through a redirect; extract the real URL
    let resolvedUrl = rawUrl;
    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      resolvedUrl = decodeURIComponent(uddgMatch[1]);
    }

    results.push({ title, url: resolvedUrl, snippet });
  }

  return results;
}

function buildOfficialSearchQueries(sourceName: string, sourceUrl: string): string[] {
  const domain = safeHostname(sourceUrl);
  const sitePart = domain ? `site:${domain}` : "";
  return [
    `${sourceName} ${sitePart} date limite admissibilite programme`,
    `${sourceName} ${sitePart} OBNL communications rayonnement numerique`,
    `${sourceName} ${sitePart} programme aide fonctionnement organisme`,
  ]
    .map((query) => query.trim())
    .filter(Boolean);
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Fetches the text content of a URL (limited size) for AI enrichment.
 */
async function fetchPageText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      headers: {
        "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
        accept: "text/html",
      },
    });

    if (!response.ok) return null;

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
    score += 8;
  }

  const sourceHostname = safeHostname(sourceUrl);
  if (sourceHostname && safeHostname(result.url) === sourceHostname) {
    score += 10;
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
  ];

  for (const keyword of strongKeywords) {
    if (haystack.includes(keyword)) {
      score += 2;
    }
  }

  const weakOrBadKeywords = ["accueil", "contact", "nous joindre", "a propos", "carriere", "connexion"];
  for (const keyword of weakOrBadKeywords) {
    if (haystack.includes(keyword)) {
      score -= 4;
    }
  }

  return score;
}

export type WebSearchContext = {
  snippets: string;
  sources: string[];
};

/**
 * Performs a web search to gather supplementary context about a funding program.
 * The AI analyzer can use these snippets to better determine deadlines, eligibility, etc.
 */
export async function searchWebForProgramContext(
  sourceName: string,
  sourceUrl: string,
): Promise<WebSearchContext | null> {
  try {
    const queries = buildOfficialSearchQueries(sourceName, sourceUrl);
    const resultSets = await Promise.all(queries.map((query) => searchDuckDuckGo(query)));

    const seen = new Set<string>();
    const allResults: SearchResult[] = [];

    for (const result of resultSets.flatMap((items) => items.slice(0, RESULTS_PER_QUERY))) {
      if (seen.has(result.url)) continue;
      seen.add(result.url);
      allResults.push(result);
    }

    if (allResults.length === 0) return null;

    const rankedResults = allResults
      .map((result) => ({
        ...result,
        relevanceScore: scoreSearchResult(result, sourceUrl),
      }))
      .sort((left, right) => right.relevanceScore - left.relevanceScore);

    const topResults = rankedResults.slice(0, FETCHED_PAGE_COUNT);
    const pageTexts = await Promise.all(
      topResults.map(async (result) => {
        const text = await fetchPageText(result.url);
        return { ...result, pageText: text };
      }),
    );

    const parts: string[] = [];
    const sources: string[] = [];

    for (const result of pageTexts) {
      sources.push(result.url);
      let section = `[${result.title}] (${result.url})\n`;
      if (result.pageText) {
        section += result.pageText;
      } else {
        section += result.snippet;
      }
      parts.push(section);
    }

    const snippets = parts.join("\n---\n").slice(0, 8000);

    return snippets.length > 50 ? { snippets, sources } : null;
  } catch {
    return null;
  }
}
