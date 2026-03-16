"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { ExternalLink, MapPinned, Maximize2, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TerritoryData, TerritoryGeometry } from "@/lib/territories";

const QUEBEC_CENTER = { lat: 52.2, lng: -71.8 };

function toLatLngLiteral(point: [number, number]): google.maps.LatLngLiteral {
  return {
    lat: point[1],
    lng: point[0],
  };
}

function getGeometryPolygons(geometry: TerritoryGeometry): google.maps.LatLngLiteral[][][] {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates.map((ring) => ring.map(toLatLngLiteral))];
  }

  return geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map(toLatLngLiteral)));
}

function extendBoundsFromGeometry(bounds: google.maps.LatLngBounds, geometry: TerritoryGeometry) {
  const polygons = getGeometryPolygons(geometry);

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const point of ring) {
        bounds.extend(point);
      }
    }
  }
}

function createPolygonSet(options: {
  map: google.maps.Map;
  geometry: TerritoryGeometry;
  strokeColor: string;
  strokeWeight: number;
  fillColor: string;
  fillOpacity: number;
  clickable?: boolean;
  zIndex?: number;
  onClick?: () => void;
}) {
  const polygons = getGeometryPolygons(options.geometry).map(
    (paths) =>
      new google.maps.Polygon({
        map: options.map,
        paths,
        strokeColor: options.strokeColor,
        strokeOpacity: 1,
        strokeWeight: options.strokeWeight,
        fillColor: options.fillColor,
        fillOpacity: options.fillOpacity,
        clickable: options.clickable ?? false,
        zIndex: options.zIndex,
      }),
  );

  if (options.onClick) {
    for (const polygon of polygons) {
      polygon.addListener("click", options.onClick);
    }
  }

  return polygons;
}

function clearMapObjects(items: Array<google.maps.Polygon | google.maps.Marker>) {
  for (const item of items) {
    item.setMap(null);
  }
}

function getVisibleMunicipalityLabels(territory: TerritoryData) {
  const maxLabels =
    territory.kind === "mrc"
      ? 24
      : territory.kind === "municipality"
        ? 8
        : territory.kind === "region"
          ? 12
          : 0;

  return territory.municipalityGeometries.slice(0, maxLabels);
}

function InteractiveGoogleTerritoryMap({
  territory,
  apiKey,
}: {
  territory: TerritoryData;
  apiKey: string;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapObjectsRef = useRef<{
    province: google.maps.Polygon[];
    territory: google.maps.Polygon[];
    municipalities: google.maps.Polygon[];
    labels: google.maps.Marker[];
  }>({
    province: [],
    territory: [],
    municipalities: [],
    labels: [],
  });

  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"territory" | "province" | "municipality">("territory");
  const [loadError, setLoadError] = useState<string | null>(null);

  const visibleLabels = useMemo(() => getVisibleMunicipalityLabels(territory), [territory]);
  const selectedMunicipalityData = selectedMunicipality
    ? territory.municipalityGeometries.find((entry) => entry.name === selectedMunicipality) ?? null
    : null;
  const googleMapsTarget = selectedMunicipality ?? territory.label;

  useEffect(() => {
    if (!mapElementRef.current) {
      return;
    }

    let cancelled = false;

    async function loadMap() {
      try {
        setOptions({
          key: apiKey,
          v: "weekly",
          language: "fr",
          region: "CA",
        });

        await importLibrary("maps");

        if (cancelled || !mapElementRef.current) {
          return;
        }

        mapRef.current = new google.maps.Map(mapElementRef.current, {
          center: QUEBEC_CENTER,
          zoom: 5,
          gestureHandling: "greedy",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Impossible de charger Google Maps.");
        }
      }
    }

    void loadMap();

    return () => {
      cancelled = true;
      clearMapObjects(mapObjectsRef.current.province);
      clearMapObjects(mapObjectsRef.current.territory);
      clearMapObjects(mapObjectsRef.current.municipalities);
      clearMapObjects(mapObjectsRef.current.labels);
      mapObjectsRef.current = {
        province: [],
        territory: [],
        municipalities: [],
        labels: [],
      };
      mapRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    clearMapObjects(mapObjectsRef.current.province);
    clearMapObjects(mapObjectsRef.current.territory);
    clearMapObjects(mapObjectsRef.current.municipalities);
    clearMapObjects(mapObjectsRef.current.labels);

    mapObjectsRef.current = {
      province: [],
      territory: [],
      municipalities: [],
      labels: [],
    };

    if (territory.provinceGeometry) {
      mapObjectsRef.current.province = createPolygonSet({
        map,
        geometry: territory.provinceGeometry,
        strokeColor: "rgba(0,0,0,0.22)",
        strokeWeight: 1,
        fillColor: "rgba(0,0,0,0.03)",
        fillOpacity: 0.08,
        zIndex: 1,
      });
    }

    if (territory.geometry) {
      mapObjectsRef.current.territory = createPolygonSet({
        map,
        geometry: territory.geometry,
        strokeColor: "#d64d39",
        strokeWeight: 3,
        fillColor: "#d64d39",
        fillOpacity: 0.18,
        clickable: true,
        zIndex: 20,
        onClick: () => {
          setSelectedMunicipality(null);
          setViewMode("territory");
        },
      });
    }

    mapObjectsRef.current.municipalities = territory.municipalityGeometries.flatMap((municipality) => {
      const selected = municipality.name === selectedMunicipality;
      const polygons = createPolygonSet({
        map,
        geometry: municipality.geometry,
        strokeColor: selected ? "#d64d39" : "rgba(0,0,0,0.24)",
        strokeWeight: selected ? 2.4 : 1.1,
        fillColor: "#d64d39",
        fillOpacity: selected ? 0.26 : 0.08,
        clickable: true,
        zIndex: selected ? 40 : 25,
        onClick: () => {
          setSelectedMunicipality(municipality.name);
          setViewMode("municipality");
        },
      });

      return polygons;
    });

    mapObjectsRef.current.labels = visibleLabels.map(
      (municipality) =>
        new google.maps.Marker({
          map,
          position: toLatLngLiteral(municipality.center),
          title: municipality.name,
          label: {
            text: municipality.name,
            color: "#171717",
            fontSize: "11px",
            fontWeight: "600",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: municipality.name === selectedMunicipality ? 5 : 4,
            fillColor: "#d64d39",
            fillOpacity: 0.95,
            strokeColor: "#ffffff",
            strokeWeight: 1.5,
          },
          zIndex: municipality.name === selectedMunicipality ? 60 : 50,
        }),
    );

    for (const marker of mapObjectsRef.current.labels) {
      marker.addListener("click", () => {
        const clickedMunicipality = marker.getTitle();
        if (!clickedMunicipality) {
          return;
        }
        setSelectedMunicipality(clickedMunicipality);
        setViewMode("municipality");
      });
    }

    const bounds = new google.maps.LatLngBounds();

    if (viewMode === "municipality" && selectedMunicipalityData) {
      extendBoundsFromGeometry(bounds, selectedMunicipalityData.geometry);
    } else if (viewMode === "province" && territory.provinceGeometry) {
      extendBoundsFromGeometry(bounds, territory.provinceGeometry);
    } else if (territory.geometry) {
      extendBoundsFromGeometry(bounds, territory.geometry);
    } else if (territory.provinceGeometry) {
      extendBoundsFromGeometry(bounds, territory.provinceGeometry);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 36);
    } else {
      map.setCenter(QUEBEC_CENTER);
      map.setZoom(5);
    }
  }, [selectedMunicipality, selectedMunicipalityData, territory, viewMode, visibleLabels]);

  if (!territory.provinceGeometry && !territory.geometry) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
        Aucun contour détaillé n&apos;est disponible pour ce programme, soit parce que sa portée est trop large,
        soit parce que la source n&apos;identifie pas encore un territoire cartographique précis.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
        Google Maps n&apos;a pas pu être chargé. Détail: {loadError}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-black/70">
          <MapPinned className="h-4 w-4 text-[color:var(--accent)]" />
          <span>Carte interactive Google</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="h-8 px-3"
            onClick={() => {
              setSelectedMunicipality(null);
              setViewMode("territory");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="secondary"
            className="h-8 px-3"
            onClick={() => {
              setSelectedMunicipality(null);
              setViewMode("province");
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative h-[520px] w-full bg-[#f5f4f0]">
        <div ref={mapElementRef} className="h-full w-full" />

        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge tone={selectedMunicipality ? "eligible" : "default"}>
            {selectedMunicipality ? `Ville sélectionnée: ${selectedMunicipality}` : territory.label}
          </Badge>
          {territory.regionName ? <Badge>{territory.regionName}</Badge> : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-black/8 px-4 py-4 text-sm text-black/62 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p>Clic gauche sur une municipalité pour la sélectionner et recentrer la carte.</p>
          {selectedMunicipalityData ? (
            <p>
              <span className="font-medium text-black">Ville active:</span> {selectedMunicipalityData.name}
            </p>
          ) : (
            <p>
              <span className="font-medium text-black">Vue active:</span> {viewMode === "province" ? "Québec" : territory.label}
            </p>
          )}
        </div>

        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${googleMapsTarget}, Québec, Canada`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-[color:var(--accent)] underline-offset-4 hover:underline"
        >
          Ouvrir dans Google Maps
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

export function GoogleTerritoryMap({
  territory,
  apiKey,
}: {
  territory: TerritoryData;
  apiKey: string;
}) {
  const mapKey = `${territory.kind}:${territory.territoryCode ?? territory.name}:${territory.label}`;

  return <InteractiveGoogleTerritoryMap key={mapKey} territory={territory} apiKey={apiKey} />;
}
