import OpenAI from "openai";

import { env } from "@/lib/env";

let client: OpenAI | null = null;

export function isAiEnabled() {
  return env.aiEnabled && env.aiApiKey.length > 0;
}

export function getAiClient() {
  if (!isAiEnabled()) {
    return null;
  }

  if (!client) {
    client = new OpenAI({
      apiKey: env.aiApiKey,
      baseURL: env.aiBaseUrl,
      timeout: 20_000,
      maxRetries: 1,
    });
  }

  return client;
}
