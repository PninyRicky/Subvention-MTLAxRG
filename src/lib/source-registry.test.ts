import { describe, expect, it } from "vitest";

import { defaultOfficialSources, isOfficialInstitutionUrl } from "@/lib/source-registry";

describe("isOfficialInstitutionUrl", () => {
  it("autorise les portails publics officiels", () => {
    expect(isOfficialInstitutionUrl("https://sodec.gouv.qc.ca/aide-financiere/")).toBe(true);
    expect(isOfficialInstitutionUrl("https://montreal.ca/programmes")).toBe(true);
    expect(isOfficialInstitutionUrl("https://conseildesarts.ca/financement/subventions")).toBe(true);
    expect(isOfficialInstitutionUrl("https://www.laval.ca/culture/soutien-artistes-organismes-culturels/soutien-professionnels/")).toBe(
      true,
    );
    expect(
      isOfficialInstitutionUrl(
        "https://www.sherbrooke.ca/fr/culture-sports-et-loisirs/soutien-aux-organismes-culturels/appel-de-projets-ponctuels-pour-les-organismes-culturels",
      ),
    ).toBe(true);
    expect(
      isOfficialInstitutionUrl(
        "https://www.gatineau.ca/portail/default.aspx?c=fr-CA&p=guichet_municipal%2Fsubventions_commandites%2Fprogramme_soutien_organismes_culturels",
      ),
    ).toBe(true);
    expect(isOfficialInstitutionUrl("https://portneuf.ca/developpement-economique/fonds/")).toBe(true);
  });

  it("bloque les agregateurs et plateformes tierces", () => {
    expect(isOfficialInstitutionUrl("https://hellodarwin.com/fr/subventions")).toBe(false);
    expect(isOfficialInstitutionUrl("https://example.com/programme")).toBe(false);
  });

  it("garde tous les seeds officiels dans le perimetre autorise", () => {
    expect(defaultOfficialSources.every((source) => isOfficialInstitutionUrl(source.url))).toBe(true);
  });
});
