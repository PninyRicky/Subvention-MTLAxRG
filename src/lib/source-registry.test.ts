import { describe, expect, it } from "vitest";

import { isOfficialInstitutionUrl } from "@/lib/source-registry";

describe("isOfficialInstitutionUrl", () => {
  it("autorise les portails publics officiels", () => {
    expect(isOfficialInstitutionUrl("https://sodec.gouv.qc.ca/aide-financiere/")).toBe(true);
    expect(isOfficialInstitutionUrl("https://montreal.ca/programmes")).toBe(true);
    expect(isOfficialInstitutionUrl("https://conseildesarts.ca/financement/subventions")).toBe(true);
  });

  it("bloque les agregateurs et plateformes tierces", () => {
    expect(isOfficialInstitutionUrl("https://hellodarwin.com/fr/subventions")).toBe(false);
    expect(isOfficialInstitutionUrl("https://example.com/programme")).toBe(false);
  });
});
