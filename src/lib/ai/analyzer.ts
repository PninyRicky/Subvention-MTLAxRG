import { env } from "@/lib/env";
import { getTorontoLocalDateKey } from "@/lib/dates";
import { searchWebForProgramContext } from "@/lib/fetch/web-search";

import { getAiClient, isAiEnabled } from "./provider";
import { buildSystemPrompt, buildEnrichedUserPrompt, buildUserPrompt } from "./prompts";
import { aiProgramAnalysisSchema, type AiProgramAnalysis, type AiProgramEntry } from "./schema";

export type SourceMetadata = {
  sourceName: string;
  sourceUrl: string;
  governmentLevel: string;
  documentUrl?: string;
  documentType?: "HTML" | "PDF";
  depth?: number;
};

type AnalyzeOptions = {
  allowWebEnrichment?: boolean;
};

/**
 * Minimum confidence threshold below which we trigger a web-search enrichment
 * pass to gather more context (deadlines, eligibility, etc.).
 */
const ENRICHMENT_CONFIDENCE_THRESHOLD = 65;

function shouldEnrichProgram(program: AiProgramEntry): boolean {
  if ((program.confidence ?? 0) < ENRICHMENT_CONFIDENCE_THRESHOLD) return true;
  if (!program.officialUrl) return true;
  if (!program.programName) return true;
  if (!program.closesAt && !program.rolling) return true;
  if (program.status === "REVIEW") return true;
  return false;
}

function needsEnrichment(analysis: AiProgramAnalysis): boolean {
  if (!analysis.programs.length) {
    return true;
  }

  return analysis.programs.some(shouldEnrichProgram);
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
  options: AnalyzeOptions = {},
): Promise<AiProgramAnalysis | null> {
  if (!isAiEnabled()) {
    return null;
  }

  const allowWebEnrichment = options.allowWebEnrichment ?? true;

  const currentDate = getTorontoLocalDateKey();

  try {
    // --- Pass 1: analyze the source page ---
    const firstPass = await callAi([
      { role: "system", content: buildSystemPrompt(currentDate) },
      { role: "user", content: buildUserPrompt(sourceMetadata, bodyText) },
    ]);

    if (!firstPass || !firstPass.programs.length) return null;

    // --- Pass 2: web-search enrichment when needed ---
    if (allowWebEnrichment && needsEnrichment(firstPass)) {
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

        if (enriched && enriched.programs.length > 0) {
          const firstPassConfidence = Math.max(...firstPass.programs.map((program) => program.confidence ?? 0));
          const enrichedConfidence = Math.max(...enriched.programs.map((program) => program.confidence ?? 0));

          if (enrichedConfidence >= firstPassConfidence) {
            return enriched;
          }
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
