import { env } from "@/lib/env";
import { getTorontoLocalDateKey } from "@/lib/dates";
import { searchWebForProgramContext } from "@/lib/fetch/web-search";

import { getAiClient, isAiEnabled } from "./provider";
import { buildSystemPrompt, buildEnrichedUserPrompt, buildUserPrompt } from "./prompts";
import { aiProgramAnalysisSchema, type AiProgramAnalysis } from "./schema";

export type SourceMetadata = {
  sourceName: string;
  sourceUrl: string;
  governmentLevel: string;
};

/**
 * Minimum confidence threshold below which we trigger a web-search enrichment
 * pass to gather more context (deadlines, eligibility, etc.).
 */
const ENRICHMENT_CONFIDENCE_THRESHOLD = 65;

function needsEnrichment(analysis: AiProgramAnalysis): boolean {
  if ((analysis.confidence ?? 0) < ENRICHMENT_CONFIDENCE_THRESHOLD) return true;
  if (!analysis.officialUrl) return true;
  if (!analysis.programName) return true;
  if (!analysis.closesAt && !analysis.rolling) return true;
  if (analysis.status === "REVIEW") return true;
  return false;
}

async function callAi(
  messages: { role: "system" | "user"; content: string }[],
): Promise<AiProgramAnalysis | null> {
  const client = getAiClient();
  if (!client) return null;

  const response = await client.chat.completions.create({
    model: env.aiModel,
    messages,
    temperature: 0.1,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return null;

  const parsed = aiProgramAnalysisSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("AI response failed schema validation:", parsed.error.issues);
    }
    return null;
  }

  return parsed.data;
}

export async function analyzeProgramPage(
  bodyText: string,
  sourceMetadata: SourceMetadata,
): Promise<AiProgramAnalysis | null> {
  if (!isAiEnabled()) {
    return null;
  }

  const currentDate = getTorontoLocalDateKey();

  try {
    // --- Pass 1: analyze the source page ---
    const firstPass = await callAi([
      { role: "system", content: buildSystemPrompt(currentDate) },
      { role: "user", content: buildUserPrompt(sourceMetadata, bodyText) },
    ]);

    if (!firstPass) return null;

    // --- Pass 2: web-search enrichment when needed ---
    if (needsEnrichment(firstPass)) {
      const webContext = await searchWebForProgramContext(
        sourceMetadata.sourceName,
        sourceMetadata.sourceUrl,
      );

      if (webContext) {
        const enriched = await callAi([
          { role: "system", content: buildSystemPrompt(currentDate) },
          {
            role: "user",
            content: buildEnrichedUserPrompt(
              sourceMetadata,
              bodyText,
              webContext.snippets,
              webContext.sources,
            ),
          },
        ]);

        if (enriched && (enriched.confidence ?? 0) >= (firstPass.confidence ?? 0)) {
          return enriched;
        }
      }
    }

    return firstPass;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("AI analysis failed:", error instanceof Error ? error.message : error);
    }
    return null;
  }
}
