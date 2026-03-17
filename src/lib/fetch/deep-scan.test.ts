import { SourceType, type SourceRegistry } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { __testing__ } from "@/lib/fetch/deep-scan";

const source = {
  id: "source-1",
  name: "Québec - Portail officiel",
  url: "https://www.quebec.ca/culture/aide-financiere",
  type: SourceType.OFFICIAL,
  cadence: "mwf-06:00-toronto",
  description: "Source de test",
  active: true,
  governmentLevel: "Quebec",
  fallbackPayload: {
    seedType: "portal",
  },
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies SourceRegistry;

describe("deep-scan", () => {
  it("retient les liens officiels pertinents et ignore les liens faibles", () => {
    const links = __testing__.extractCandidateLinks(
      `
        <html>
          <body>
            <a href="/culture/aide-financiere/volet-1">Volet 1</a>
            <a href="/nous-joindre">Nous joindre</a>
            <a href="https://hellodarwin.com/programme">Annuaire externe</a>
            <a href="/documents/guide-programme.pdf">Guide PDF</a>
          </body>
        </html>
      `,
      source.url,
      source.url,
    );

    expect(links).toHaveLength(2);
    expect(links.some((link) => link.includes("volet-1"))).toBe(true);
    expect(links.some((link) => link.includes(".pdf"))).toBe(true);
  });

  it("reconnait le seedType explicite", () => {
    expect(__testing__.getSeedType(source)).toBe("portal");
  });
});
