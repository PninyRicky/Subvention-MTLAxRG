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
  "mrc des maskoutains": "Les Maskoutains",
  "maskoutains": "Les Maskoutains",
  "mrc de rocher perce": "Rocher-Percé",
  "rocher perce": "Rocher-Percé",
  "mrc de coaticook": "Coaticook",
  "mrc du fjord du saguenay": "Le Fjord-du-Saguenay",
  "fjord du saguenay": "Le Fjord-du-Saguenay",
  "mrc de memphremagog": "Memphrémagog",
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
  territoryCode?: string;
  geometry: TerritoryGeometry | null;
  provinceGeometry: TerritoryGeometry | null;
  municipalityGeometries: {
    name: string;
    geometry: TerritoryGeometry;
    center: GeoPoint;
  }[];
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

export type RegionDirectoryEntry = {
  name: string;
  normalizedName: string;
  mrcCount: number;
};

type ArcGisFeature = {
  geometry?: TerritoryGeometry;
  properties?: Record<string, string>;
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

export const getRegionDirectory = cache(async (): Promise<RegionDirectoryEntry[]> => {
  const mrcDirectory = await getMrcDirectory();
  const regions = new Map<string, RegionDirectoryEntry>();

  for (const entry of mrcDirectory) {
    const key = entry.normalizedRegionName;
    const current = regions.get(key);

    if (current) {
      current.mrcCount += 1;
      continue;
    }

    regions.set(key, {
      name: entry.regionName,
      normalizedName: key,
      mrcCount: 1,
    });
  }

  return [...regions.values()].sort((left, right) => left.name.localeCompare(right.name, "fr"));
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

async function inferRegion(program: TerritoryProgramInput) {
  const haystack = buildHaystack(program);

  for (const [candidate, resolved] of Object.entries(regionAliases)) {
    if (haystack.includes(candidate)) {
      return resolved;
    }
  }

  const regionDirectory = await getRegionDirectory();
  const matched = regionDirectory.find((entry) => haystack.includes(entry.normalizedName));

  if (matched) {
    return matched.name;
  }

  return null;
}

async function inferMrc(program: TerritoryProgramInput) {
  const haystack = buildHaystack(program);
  const mrcDirectory = await getMrcDirectory();

  for (const [candidate, resolved] of Object.entries(mrcAliases)) {
    if (haystack.includes(candidate)) {
      const aliasMatch = mrcDirectory.find((entry) => entry.name === resolved);

      if (aliasMatch) {
        return aliasMatch;
      }
    }
  }

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

  return matched ?? null;
}

async function fetchTerritoryGeometry(
  kind: TerritoryKind,
  name: string,
  options?: {
    code?: string;
  },
) {
  if (!["mrc", "region", "municipality"].includes(kind)) {
    return null;
  }

  const config =
    kind === "mrc"
      ? { layer: 1, field: "MRS_NM_MRC", codeField: "MRS_CO_MRC" }
      : kind === "region"
        ? { layer: 0, field: "RES_NM_REG" }
        : { layer: 2, field: "MUS_NM_MUN" };

  const escapedName = name.replace(/'/g, "''");
  const whereClauses = [
    kind === "mrc" && options?.code && "codeField" in config && config.codeField
      ? `${config.codeField}='${options.code}'`
      : null,
    `${config.field}='${escapedName}'`,
    `${config.field} like '%${escapedName}%'`,
  ].filter(Boolean) as string[];

  for (const where of whereClauses) {
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
      continue;
    }

    const payload = (await response.json()) as {
      features?: ArcGisFeature[];
    };
    const geometry = payload.features?.[0]?.geometry ?? null;

    if (geometry) {
      return geometry;
    }
  }

  return null;
}

function getGeometryCenter(geometry: TerritoryGeometry): GeoPoint {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flatMap((polygon) => polygon);
  const points = rings.flat();
  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);
  return [
    (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
  ];
}

function mergeAsMultiPolygon(features: TerritoryGeometry[]) {
  const coordinates = features.flatMap((feature) =>
    feature.type === "Polygon" ? [feature.coordinates] : feature.coordinates,
  );

  if (coordinates.length === 0) {
    return null;
  }

  return {
    type: "MultiPolygon",
    coordinates,
  } satisfies TerritoryGeometry;
}

const getQuebecProvinceGeometry = cache(async () => {
  const queryUrl = `${mernMapServerBase}/0/query?where=${encodeURIComponent("1=1")}&outFields=RES_NM_REG&returnGeometry=true&f=geojson`;
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

  return mergeAsMultiPolygon(
    (payload.features ?? [])
      .map((feature) => feature.geometry)
      .filter((feature): feature is TerritoryGeometry => Boolean(feature)),
  );
});

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

async function getMunicipalityGeometriesForTerritory(
  kind: TerritoryKind,
  territoryName: string,
  municipalityNames: string[],
) {
  if (!["mrc", "region", "municipality"].includes(kind)) {
    return [] as TerritoryData["municipalityGeometries"];
  }

  const municipalityDirectory = await getMunicipalityDirectory();
  let where: string | null = null;

  if (kind === "mrc") {
    const mrcCode = municipalityDirectory.find(
      (entry) => entry.normalizedMrcName === normalizeTerritoryText(territoryName),
    )?.mrcCode;

    where = mrcCode ? `MUS_CO_MRC='${mrcCode}'` : null;
  } else if (kind === "region") {
    if (municipalityNames.length > 18) {
      return [];
    }

    const escaped = municipalityNames.map((name) => `'${name.replace(/'/g, "''")}'`).join(",");
    where = municipalityNames.length > 0 ? `MUS_NM_MUN in (${escaped})` : null;
  } else if (kind === "municipality") {
    where = `MUS_NM_MUN like '%${territoryName.replace(/'/g, "''")}%'`;
  }

  if (!where) {
    return [];
  }

  const queryUrl = `${mernMapServerBase}/2/query?where=${encodeURIComponent(where)}&outFields=MUS_NM_MUN&returnGeometry=true&f=geojson`;
  const response = await fetch(queryUrl, {
    headers: {
      "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
    },
    next: {
      revalidate: 60 * 60 * 24 * 7,
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    features?: ArcGisFeature[];
  };

  return (payload.features ?? [])
    .flatMap((feature) => {
      const geometry = feature.geometry;
      const name = feature.properties?.MUS_NM_MUN;

      if (!geometry || !name) {
        return [];
      }

      return [
        {
          name,
          geometry,
          center: getGeometryCenter(geometry),
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

export const getTerritoryDataForProgram = cache(async (program: TerritoryProgramInput) => {
  const provinceGeometry = await getQuebecProvinceGeometry();
  const municipality = inferMunicipality(program);

  if (municipality) {
    const municipalityGeometries = await getMunicipalityGeometriesForTerritory("municipality", municipality, [municipality]);

    return {
      kind: "municipality",
      name: municipality,
      label: `Ville de ${municipality}`,
      municipalities: [municipality],
      geometry: municipalityGeometries[0]?.geometry ?? (await fetchTerritoryGeometry("municipality", municipality)),
      provinceGeometry,
      municipalityGeometries,
      notes: [
        "Le territoire a été déduit à partir de l'organisme ou de la source officielle du programme.",
      ],
      coverageLabel: "Territoire municipal détecté",
    } satisfies TerritoryData;
  }

  const mrcEntry = await inferMrc(program);

  if (mrcEntry) {
    const municipalities = await getMunicipalitiesForMrc(mrcEntry.name);
    const municipalityGeometries = await getMunicipalityGeometriesForTerritory("mrc", mrcEntry.name, municipalities);

    return {
      kind: "mrc",
      name: mrcEntry.name,
      label: `MRC ${mrcEntry.name}`,
      regionName: mrcEntry.regionName,
      territoryCode: mrcEntry.code,
      municipalities,
      geometry: await fetchTerritoryGeometry("mrc", mrcEntry.name, { code: mrcEntry.code }),
      provinceGeometry,
      municipalityGeometries,
      notes: [
        "Le contour provient du service cartographique officiel du gouvernement du Québec.",
        `Région administrative officielle: ${mrcEntry.regionName}.`,
      ],
      coverageLabel: "Territoire MRC détecté",
    } satisfies TerritoryData;
  }

  const regionName = await inferRegion(program);

  if (regionName) {
    const municipalities = await getMunicipalitiesForRegion(regionName);
    const municipalityGeometries = await getMunicipalityGeometriesForTerritory("region", regionName, municipalities);

    return {
      kind: "region",
      name: regionName,
      label: `Région ${regionName}`,
      territoryCode: undefined,
      municipalities,
      geometry: await fetchTerritoryGeometry("region", regionName),
      provinceGeometry,
      municipalityGeometries,
      notes: [
        "Le contour provient du service cartographique officiel du gouvernement du Québec.",
        municipalityGeometries.length === 0
          ? "Les libellés municipaux sont limités sur les territoires très larges pour garder une carte lisible."
          : "Les municipalités visibles sont positionnées à l'intérieur du territoire détecté.",
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
      provinceGeometry,
      municipalityGeometries: [],
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
      provinceGeometry,
      municipalityGeometries: [],
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
    provinceGeometry,
    municipalityGeometries: [],
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
