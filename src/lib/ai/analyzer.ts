import { env } from "@/lib/env";
import { getTorontoLocalDateKey } from "@/lib/dates";

import { getAiClient, isAiEnabled } from "./provider";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { aiProgramAnalysisSchema, type AiProgramAnalysis } from "./schema";

export type SourceMetadata = {
  sourceName: string;
  sourceUrl: string;
  governmentLevel: string;
};

export async function analyzeProgramPage(
  bodyText: string,
  sourceMetadata: SourceMetadata,
): Promise<AiProgramAnalysis | null> {
  if (!isAiEnabled()) {
    return null;
  }

  const client = getAiClient();

  if (!client) {
    return null;
  }

  const currentDate = getTorontoLocalDateKey();

  try {
    const response = await client.chat.completions.create({
      model: env.aiModel,
      messages: [
        { role: "system", content: buildSystemPrompt(currentDate) },
        { role: "user", content: buildUserPrompt(sourceMetadata, bodyText) },
      ],
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;

    if (!raw) {
      return null;
    }

    const parsed = aiProgramAnalysisSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("AI response failed schema validation:", parsed.error.issues);
      }
      return null;
    }

    return parsed.data;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("AI analysis failed:", error instanceof Error ? error.message : error);
    }
    return null;
  }
}
