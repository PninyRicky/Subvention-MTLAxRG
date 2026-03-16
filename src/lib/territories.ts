import { cache } from "react";

import { parseCsvRecords } from "@/lib/csv";
import { slugify } from "@/lib/utils";

const municipalityDirectoryUrl = "https://donneesouvertes.affmunqc.net/repertoire/MUN.csv";
const mrcDirectoryUrl = "https://donneesouvertes.affmunqc.net/repertoire/MRC_CM_Arg.csv";
const mernMapServerBase = "https://servicescarto.mern.gouv.qc.ca/pes/rest/services/Territoire/SDA_WMS/MapServer";

const municipalityAliases = {
  montreal: "Montréal",
  quebec: "Québec",
};

const regionAliases = {
  montreal: "Montréal",
  outaouais: "Outaouais",
  "capitale nationale": "Capitale-Nationale",
  quebec: "Capitale-Nationale",
};

const mrcAliases = {
  "mrc des collines": "Les Collines-de-l'Outaouais",
  "collines de l outaouais": "Les Collines-de-l'Outaouais",
  "mrc collines de l outaouais": "Les Collines-de-l'Outaouais",
};

type GeoPoint = [number, number];
type PolygonCoordinates = GeoPoint[][];
type MultiPolygonCoordinates = GeoPoint[][][];

export type TerritoryGeometry =
  | {
      type: "Polygon";
      coordinates: PolygonCoordinates;
    }
  | {
      type: "MultiPolygon";
      coordinates: MultiPolygonCoordinates;
    };

export type TerritoryKind = "mrc" | "region" | "municipality" | "province" | "country" | "unknown";

export type TerritoryData = {
  kind: TerritoryKind;
  name: string;
  label: string;
  municipalities: string[];
  regionName?: string;
  geometry: TerritoryGeometry | null;
  notes: string[];
  coverageLabel: string;
};

export type TerritoryProgramInput = {
  name: string;
  organization: string;
  region: string;
  governmentLevel: string;
  summary: string;
  details?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

type MunicipalityDirectoryEntry = {
  name: string;
  regionName: string;
  mrcName: string;
  mrcCode?: string;
  normalizedName: string;
  normalizedRegionName: string;
  normalizedMrcName: string;
};

type MrcDirectoryEntry = {
  name: string;
  regionName: string;
  website?: string;
  email?: string;
  code?: string;
  normalizedName: string;
  normalizedRegionName: string;
};

type ArcGisFeature = {
  geometry?: TerritoryGeometry;
};

function normalizeTerritoryText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function extractTrailingCode(value: string) {
  const match = value.match(/\((\d+)\)\s*$/);
  return match?.[1];
}

function cleanRegionName(value: string) {
  return value
    .replace(/^\d+\s+/, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMrcName(value: string) {
  return value
    .replace(/^MRC\s+/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
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

export const getMunicipalityDirectory = cache(async (): Promise<MunicipalityDirectoryEntry[]> => {
  const raw = await fetchOfficialText(municipalityDirectoryUrl);
  const records = parseCsvRecords(raw);

  return records.flatMap((record) => {
    const name = record.munnom?.trim();
    const regionName = cleanRegionName(record.regadm ?? "");
    const mrcName = cleanMrcName(record.mrc ?? "");

    if (!name || !regionName || !mrcName) {
      return [];
    }

    return [
      {
        name,
        regionName,
        mrcName,
        mrcCode: extractTrailingCode(record.mrc ?? ""),
        normalizedName: normalizeTerritoryText(name),
        normalizedRegionName: normalizeTerritoryText(regionName),
        normalizedMrcName: normalizeTerritoryText(mrcName),
      } satisfies MunicipalityDirectoryEntry,
    ];
  });
});

export const getMrcDirectory = cache(async (): Promise<MrcDirectoryEntry[]> => {
  const raw = await fetchOfficialText(mrcDirectoryUrl);
  const records = parseCsvRecords(raw);

  return records.flatMap((record) => {
    const name = record.mrcnom?.trim();
    const regionName = cleanRegionName(record.mrcregion ?? "");

    if (!name || !regionName) {
      return [];
    }

    return [
      {
        name,
        regionName,
        website: record.mrcweb?.trim() || undefined,
        email: record.mrccourriel?.trim() || undefined,
        code: record.mrccod?.trim() || undefined,
        normalizedName: normalizeTerritoryText(name),
        normalizedRegionName: normalizeTerritoryText(regionName),
      } satisfies MrcDirectoryEntry,
    ];
  });
});

function buildHaystack(program: TerritoryProgramInput) {
  return normalizeTerritoryText(
    [
      program.name,
      program.organization,
      program.region,
      program.summary,
      program.details,
      program.sourceName,
      program.sourceUrl,
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

function inferMunicipality(program: TerritoryProgramInput) {
  const haystack = buildHaystack(program);

  for (const [candidate, resolved] of Object.entries(municipalityAliases)) {
    if (haystack.includes(candidate)) {
      return resolved;
    }
  }

  return null;
}

function inferRegion(program: TerritoryProgramInput) {
  const haystack = buildHaystack(program);

  for (const [candidate, resolved] of Object.entries(regionAliases)) {
    if (haystack.includes(candidate)) {
      return resolved;
    }
  }

  return null;
}

async function inferMrc(program: TerritoryProgramInput) {
  const haystack = buildHaystack(program);

  for (const [candidate, resolved] of Object.entries(mrcAliases)) {
    if (haystack.includes(candidate)) {
      return resolved;
    }
  }

  const mrcDirectory = await getMrcDirectory();

  const matched = mrcDirectory.find((entry) => {
    if (haystack.includes(entry.normalizedName)) {
      return true;
    }

    const simplified = entry.normalizedName
      .replace(/^les\s+/, "")
      .replace(/^la\s+/, "")
      .replace(/^le\s+/, "")
      .replace(/^de\s+/, "")
      .replace(/^du\s+/, "")
      .replace(/^des\s+/, "");

    return simplified.length > 7 && haystack.includes(simplified);
  });

  return matched?.name ?? null;
}

async function fetchTerritoryGeometry(kind: TerritoryKind, name: string) {
  if (!["mrc", "region", "municipality"].includes(kind)) {
    return null;
  }

  const config =
    kind === "mrc"
      ? { layer: 1, field: "MRS_NM_MRC" }
      : kind === "region"
        ? { layer: 0, field: "RES_NM_REG" }
        : { layer: 2, field: "MUS_NM_MUN" };

  const escapedName = name.replace(/'/g, "''");
  const where = `${config.field} like '%${escapedName}%'`;
  const queryUrl = `${mernMapServerBase}/${config.layer}/query?where=${encodeURIComponent(where)}&outFields=*&returnGeometry=true&f=geojson`;
  const response = await fetch(queryUrl, {
    headers: {
      "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
    },
    next: {
      revalidate: 60 * 60 * 24 * 7,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    features?: ArcGisFeature[];
  };

  return payload.features?.[0]?.geometry ?? null;
}

async function getMunicipalitiesForMrc(mrcName: string) {
  const municipalities = await getMunicipalityDirectory();
  const normalizedMrcName = normalizeTerritoryText(mrcName);

  return municipalities
    .filter((entry) => entry.normalizedMrcName === normalizedMrcName)
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "fr"));
}

async function getMunicipalitiesForRegion(regionName: string) {
  const municipalities = await getMunicipalityDirectory();
  const normalizedRegionName = normalizeTerritoryText(regionName);

  return municipalities
    .filter((entry) => entry.normalizedRegionName === normalizedRegionName)
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "fr"));
}

export const getTerritoryDataForProgram = cache(async (program: TerritoryProgramInput) => {
  const municipality = inferMunicipality(program);

  if (municipality) {
    return {
      kind: "municipality",
      name: municipality,
      label: `Ville de ${municipality}`,
      municipalities: [municipality],
      geometry: await fetchTerritoryGeometry("municipality", municipality),
      notes: [
        "Le territoire a ete deduit a partir de l'organisme ou de la source officielle du programme.",
      ],
      coverageLabel: "Territoire municipal détecté",
    } satisfies TerritoryData;
  }

  const mrcName = await inferMrc(program);

  if (mrcName) {
    const mrcDirectory = await getMrcDirectory();
    const entry = mrcDirectory.find((item) => item.name === mrcName);

    return {
      kind: "mrc",
      name: mrcName,
      label: `MRC ${mrcName}`,
      regionName: entry?.regionName,
      municipalities: await getMunicipalitiesForMrc(mrcName),
      geometry: await fetchTerritoryGeometry("mrc", mrcName),
      notes: [
        "Le contour provient du service cartographique officiel du gouvernement du Québec.",
      ],
      coverageLabel: "Territoire MRC détecté",
    } satisfies TerritoryData;
  }

  const regionName = inferRegion(program);

  if (regionName) {
    return {
      kind: "region",
      name: regionName,
      label: `Région ${regionName}`,
      municipalities: await getMunicipalitiesForRegion(regionName),
      geometry: await fetchTerritoryGeometry("region", regionName),
      notes: [
        "Le contour provient du service cartographique officiel du gouvernement du Québec.",
      ],
      coverageLabel: "Territoire régional détecté",
    } satisfies TerritoryData;
  }

  if (normalizeTerritoryText(program.region) === "canada") {
    return {
      kind: "country",
      name: "Canada",
      label: "Canada",
      municipalities: [],
      geometry: null,
      notes: ["Le programme semble national. Aucun contour local détaillé n'est affiché."],
      coverageLabel: "Portée nationale",
    } satisfies TerritoryData;
  }

  if (
    normalizeTerritoryText(program.region) === "quebec" ||
    normalizeTerritoryText(program.governmentLevel) === "quebec"
  ) {
    return {
      kind: "province",
      name: "Québec",
      label: "Québec",
      municipalities: [],
      geometry: null,
      notes: ["Le programme semble couvrir tout le Québec ou une portée trop large pour une MRC précise."],
      coverageLabel: "Portée provinciale",
    } satisfies TerritoryData;
  }

  return {
    kind: "unknown",
    name: program.region,
    label: program.region || "Territoire non précisé",
    municipalities: [],
    geometry: null,
    notes: ["Aucun territoire cartographique suffisamment précis n'a été détecté dans la fiche actuelle."],
    coverageLabel: "Territoire à préciser",
  } satisfies TerritoryData;
});

export function territorySlug(value: string) {
  return slugify(normalizeTerritoryText(value));
}

export function matchMunicipalityToTerritory(territory: TerritoryData, municipality: string | null | undefined) {
  if (!municipality) {
    return false;
  }

  const normalizedMunicipality = normalizeTerritoryText(municipality);

  if (territory.kind === "municipality") {
    return normalizeTerritoryText(territory.name) === normalizedMunicipality;
  }

  return territory.municipalities.some((entry) => normalizeTerritoryText(entry) === normalizedMunicipality);
}

export function matchRegionToTerritory(territory: TerritoryData, region: string | null | undefined) {
  if (!region) {
    return false;
  }

  const normalizedRegion = normalizeTerritoryText(cleanRegionName(region));

  if (territory.kind === "region") {
    return normalizeTerritoryText(territory.name) === normalizedRegion;
  }

  return territory.regionName ? normalizeTerritoryText(territory.regionName) === normalizedRegion : false;
}

export function normalizeOfficialPlaceName(value: string | null | undefined) {
  return normalizeTerritoryText(value);
}
