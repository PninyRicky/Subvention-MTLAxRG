import { describe, expect, it } from "vitest";

import { __test__ } from "@/lib/fetch/web-search";

describe("web-search helpers", () => {
  it("retire les urls HelloDarwin des resultats officiels", () => {
    const results = __test__.keepOnlyOfficialResults([
      {
        title: "HelloDarwin",
        url: "https://hellodarwin.com/fr/subventions",
        snippet: "foo",
      },
      {
        title: "Programme officiel",
        url: "https://www.quebec.ca/culture/aide-financiere",
        snippet: "bar",
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.url).toContain("quebec.ca");
  });

  it("dedupe les urls normalisees", () => {
    const results = __test__.dedupeSearchResults([
      {
        title: "A",
        url: "https://www.quebec.ca/programme?utm_source=test",
        snippet: "",
      },
      {
        title: "B",
        url: "https://www.quebec.ca/programme",
        snippet: "",
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe("https://www.quebec.ca/programme");
  });

  it("garde seulement les hints HelloDarwin utiles apres nettoyage", () => {
    const cleaned = __test__.cleanHintText(
      "HelloDarwin Programme de soutien aux organismes https://hellodarwin.com/foo",
    );

    expect(cleaned).not.toContain("HelloDarwin");
    expect(cleaned).not.toContain("http");
    expect(__test__.isLikelyUsefulHint(cleaned)).toBe(true);
    expect(__test__.isLikelyUsefulHint("article marketing generique")).toBe(false);
  });

  it("construit des requetes enrichies avec hints", () => {
    const queries = __test__.buildOfficialSearchQueries(
      "Programme test",
      "https://www.quebec.ca/culture/programme",
      ["Programme de soutien aux organismes culturels volet 2"],
    );

    expect(queries.some((query) => query.includes("site:www.quebec.ca"))).toBe(true);
    expect(
      queries.some(
        (query) =>
          query.includes("soutien") &&
          query.includes("organismes") &&
          query.includes("culturels"),
      ),
    ).toBe(true);
  });
});
