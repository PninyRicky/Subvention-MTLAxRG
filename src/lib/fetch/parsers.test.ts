import { SourceType, type SourceRegistry } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { parseProgramFromSource } from "@/lib/fetch/parsers";

const source = {
  id: "source-1",
  name: "SODEC",
  url: "https://sodec.gouv.qc.ca/aide-financiere/",
  type: SourceType.OFFICIAL,
  cadence: "mwf-06:00-toronto",
  description: "Source de test",
  active: true,
  governmentLevel: "Quebec",
  fallbackPayload: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies SourceRegistry;

describe("parseProgramFromSource", () => {
  it("priorise l'URL officielle du fallback", () => {
    const parsed = parseProgramFromSource(source, null, {
      name: "SODEC - Soutien au developpement audiovisuel",
      summary: "Resume de test",
      officialUrl: "https://example.com/programme-direct",
      details: "Details",
      eligibilityNotes: "Eligibilite",
      applicationNotes: "Depot",
    });

    expect(parsed.officialUrl).toBe("https://example.com/programme-direct");
    expect(parsed.details).toBe("Details");
    expect(parsed.eligibilityNotes).toBe("Eligibilite");
    expect(parsed.applicationNotes).toBe("Depot");
  });
});
