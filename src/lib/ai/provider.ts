import OpenAI from "openai";

import { env } from "@/lib/env";

type ProviderPreset = "default" | "deepseek" | "xai";

const clients: Partial<Record<ProviderPreset, OpenAI>> = {};

export function isAiEnabled() {
  return env.aiEnabled && (env.aiApiKey.length > 0 || env.deepseekApiKey.length > 0);
}

export function getAiClient(preset: ProviderPreset = "default") {
  if (preset === "xai") {
    return getXaiClient();
  }

  if (!isAiEnabled()) {
    return null;
  }

  if (!clients[preset]) {
    const apiKey = preset === "deepseek" ? env.deepseekApiKey : env.aiApiKey;
    const baseURL = preset === "deepseek" ? env.deepseekBaseUrl : env.aiBaseUrl;

    if (!apiKey) {
      return null;
    }

    clients[preset] = new OpenAI({
      apiKey,
      baseURL,
      timeout: 20_000,
      maxRetries: 1,
    });
  }

  return clients[preset] ?? null;
}

export function isXaiSearchEnabled() {
  return env.xaiApiKey.length > 0;
}

export function getXaiClient(): OpenAI | null {
  if (!isXaiSearchEnabled()) {
    return null;
  }

  if (!clients.xai) {
    clients.xai = new OpenAI({
      apiKey: env.xaiApiKey,
      baseURL: "https://api.x.ai/v1",
      timeout: 30_000,
      maxRetries: 1,
    });
  }

  return clients.xai;
}
