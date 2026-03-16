import { cache } from "react";

import { parseCsvRecords } from "@/lib/csv";
import {
  type TerritoryData,
  getMunicipalityDirectory,
  matchMunicipalityToTerritory,
  matchRegionToTerritory,
  normalizeOfficialPlaceName,
  territorySlug,
} from "@/lib/territories";

type ProgramSourceContext = {
  sourceName?: string | null;
  sourceUrl?: string | null;
};

export type OfficialOrganization = {
  id: string;
  name: string;
  municipality?: string;
  region?: string;
  website?: string;
  email?: string;
  phone?: string;
  sourceLabel: string;
  sourceUrl: string;
};

export type OfficialOrganizationDirectory = {
  organizations: OfficialOrganization[];
  coverageNote: string;
  dataSources: { label: string; url: string }[];
};

const artistCentresUrl =
  "https://www.donneesquebec.ca/recherche/dataset/c25ecf68-0af3-4222-b015-f8ed7bfac1d1/resource/7edf8ce0-6d1c-4b54-b210-40f479921c97/download/centres_artistes_autogeres_qc_2023_2024.csv";
const regionalCouncilsUrl =
  "https://www.donneesquebec.ca/recherche/dataset/bbcede9a-acf9-4dd9-ba62-5b02c36fc2b4/resource/655f4d0c-7986-4b93-a626-e3710cd28738/download/centresregionauxculturemccv1.csv";
const communityMediaUrl =
  "https://www.donneesquebec.ca/recherche/dataset/69f4e3b6-b75a-4158-8645-b517948c28df/resource/7e92de4b-4f33-45cc-a70e-8e83a7bd4d37/download/mediascommunautairesmccv1.csv";
const saguenayDirectoryUrl =
  "https://www.donneesquebec.ca/recherche/dataset/2abea8c0-392a-4e55-b4d4-3b558753b0ae/resource/e1cf9ade-29c3-4a4d-99f4-992239db5af9/download/bottinorganisme.csv";

function cleanRegionName(value: string | null | undefined) {
  return (value ?? "")
    .replace(/^\d+\s+/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueOrganizations(items: OfficialOrganization[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = [territorySlug(item.name), territorySlug(item.municipality ?? ""), item.sourceUrl].join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function fetchOfficialText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
    },
    next: {
      revalidate: 60 * 60 * 24,
    },
  });

  if (!response.ok) {
    throw new Error(`Impossible de charger ${url} (${response.status}).`);
  }

  return response.text();
}

const getArtistCentres = cache(async () => {
  const municipalities = await getMunicipalityDirectory();
  const records = parseCsvRecords(await fetchOfficialText(artistCentresUrl));

  return records
    .map((record) => {
      const municipality = record.Ville?.trim();
      const municipalityMatch = municipalities.find(
        (entry) => entry.normalizedName === normalizeOfficialPlaceName(municipality),
      );

      return {
        id: `artist-centre-${territorySlug(record.Organisme)}`,
        name: record.Organisme?.trim(),
        municipality,
        region: cleanRegionName(record.Region_Quebec),
        website: record.Site_Internet?.trim() || undefined,
        email: record.Courriel?.trim() || undefined,
        phone: record.Telephone?.trim() || undefined,
        mrcName: municipalityMatch?.mrcName,
        sourceLabel: "Centres d'artistes autogérés du Québec",
        sourceUrl: artistCentresUrl,
      };
    })
    .filter((record) => Boolean(record.name));
});

const getRegionalCouncils = cache(async () => {
  const records = parseCsvRecords(await fetchOfficialText(regionalCouncilsUrl));

  return records
    .map((record) => ({
      id: `regional-council-${territorySlug(record.NOM_CLIENT_PARTENAIRE)}`,
      name: record.NOM_CLIENT_PARTENAIRE?.trim(),
      municipality: record.MUNICIPALITE?.trim() || undefined,
      region: cleanRegionName(record.REGION_ADMIN),
      website: record.URL_WEB?.trim() || undefined,
      phone: record.TELEPHONE?.trim() || undefined,
      sourceLabel: "Conseils régionaux de la culture soutenus au fonctionnement",
      sourceUrl: regionalCouncilsUrl,
    }))
    .filter((record) => Boolean(record.name));
});

const getCommunityMedia = cache(async () => {
  const municipalities = await getMunicipalityDirectory();
  const records = parseCsvRecords(await fetchOfficialText(communityMediaUrl));

  return records
    .map((record) => {
      const municipality = record.MUNICIPALITE?.trim();
      const municipalityMatch = municipalities.find(
        (entry) => entry.normalizedName === normalizeOfficialPlaceName(municipality),
      );

      return {
        id: `community-media-${territorySlug(record.NOM_CLIENT_PARTENAIRE)}`,
        name: record.NOM_CLIENT_PARTENAIRE?.trim(),
        municipality,
        region: cleanRegionName(record.REGION_ADMIN),
        mrcName: municipalityMatch?.mrcName,
        sourceLabel: "Médias communautaires reconnus ou soutenus au fonctionnement",
        sourceUrl: communityMediaUrl,
      };
    })
    .filter((record) => Boolean(record.name));
});

const getSaguenayOrganizations = cache(async () => {
  const records = parseCsvRecords(await fetchOfficialText(saguenayDirectoryUrl));

  return records
    .map((record) => ({
      id: `saguenay-org-${territorySlug(record.nom_req)}`,
      name: record.nom_req?.trim(),
      municipality: record.municipalite?.trim() || undefined,
      website: record.site_internet?.trim() || undefined,
      phone: record.telephone_1?.trim() || undefined,
      sourceLabel: "Bottin des organismes de Saguenay",
      sourceUrl: saguenayDirectoryUrl,
    }))
    .filter((record) => Boolean(record.name));
});

async function extractOrganizationsFromSourcePage(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
    },
    next: {
      revalidate: 60 * 60 * 24,
    },
  });

  if (!response.ok) {
    return [] as OfficialOrganization[];
  }

  const html = await response.text();
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);
  const sameHost = new URL(sourceUrl).hostname.replace(/^www\./, "");
  const blockedText = /guide|formulaire|presentation|politique|communique|site internet|annonce|appel|fonds|programme|culture@mrc|conseill/i;
  const blockedExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i;
  const blockedHosts = /(^|\.)gouv\.qc\.ca$|(^|\.)quebec\.ca$|(^|\.)canada\.ca$/i;
  const links = $("article a, .entry-content a, main a")
    .map((_, element) => {
      const anchor = $(element);
      const text = anchor.text().replace(/\s+/g, " ").trim();
      const href = anchor.attr("href")?.trim() ?? "";

      if (!text || text.length < 3 || text.length > 90 || !href.startsWith("http")) {
        return null;
      }

      if (blockedText.test(text) || blockedExtensions.test(href)) {
        return null;
      }

      const linkHost = new URL(href).hostname.replace(/^www\./, "");

      if (linkHost === sameHost || blockedHosts.test(linkHost) || linkHost.includes("facebook.com")) {
        return null;
      }

      return {
        id: `page-link-${territorySlug(text)}-${territorySlug(linkHost)}`,
        name: text,
        sourceLabel: `Répertoire issu de ${new URL(sourceUrl).hostname}`,
        sourceUrl: href,
      } satisfies OfficialOrganization;
    })
    .get()
    .filter((item): item is OfficialOrganization => Boolean(item));

  return uniqueOrganizations(links);
}

function matchesTerritory(
  territory: TerritoryData,
  item: {
    municipality?: string;
    region?: string;
    mrcName?: string;
  },
) {
  if (territory.kind === "unknown" || territory.kind === "province" || territory.kind === "country") {
    return false;
  }

  if (territory.kind === "mrc") {
    return (
      normalizeOfficialPlaceName(item.mrcName) === normalizeOfficialPlaceName(territory.name) ||
      matchMunicipalityToTerritory(territory, item.municipality)
    );
  }

  if (territory.kind === "municipality") {
    return matchMunicipalityToTerritory(territory, item.municipality);
  }

  return matchRegionToTerritory(territory, item.region) || matchMunicipalityToTerritory(territory, item.municipality);
}

export const getOfficialOrganizationsForTerritory = cache(
  async (territory: TerritoryData, context?: ProgramSourceContext) => {
    const shouldUseSourcePage =
      Boolean(context?.sourceUrl) &&
      territory.kind !== "province" &&
      territory.kind !== "country" &&
      territory.kind !== "unknown";

    const [artistCentres, regionalCouncils, communityMedia, saguenayOrganizations, sourcePageOrganizations] =
      await Promise.all([
        getArtistCentres(),
        getRegionalCouncils(),
        getCommunityMedia(),
        getSaguenayOrganizations(),
        shouldUseSourcePage && context?.sourceUrl
          ? extractOrganizationsFromSourcePage(context.sourceUrl)
          : Promise.resolve([]),
      ]);

    const directoryEntries = uniqueOrganizations(
      [...artistCentres, ...regionalCouncils, ...communityMedia, ...saguenayOrganizations].filter((entry) =>
        matchesTerritory(territory, entry),
      ),
    );

    const organizations = uniqueOrganizations([...sourcePageOrganizations, ...directoryEntries]).sort((left, right) =>
      left.name.localeCompare(right.name, "fr"),
    );

    return {
      organizations,
      coverageNote:
        "Répertoire officiel agrégé à partir de jeux de données publics et, lorsqu'ils existent, de répertoires publiés sur des pages MRC ou municipales officielles. La couverture reste partielle selon les territoires.",
      dataSources: [
        { label: "Répertoire des municipalités du Québec", url: "https://donneesouvertes.affmunqc.net/repertoire/MUN.csv" },
        { label: "Centres d'artistes autogérés du Québec", url: artistCentresUrl },
        { label: "Conseils régionaux de la culture soutenus au fonctionnement", url: regionalCouncilsUrl },
        { label: "Médias communautaires soutenus au fonctionnement", url: communityMediaUrl },
        { label: "Bottin des organismes de Saguenay", url: saguenayDirectoryUrl },
      ],
    } satisfies OfficialOrganizationDirectory;
  },
);
