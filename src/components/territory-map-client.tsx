"use client";

import { useEffect, useMemo, useState } from "react";
import { divIcon, latLngBounds, type LatLngBoundsExpression } from "leaflet";
import { ExternalLink, MapPinned, Maximize2, RotateCcw } from "lucide-react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TerritoryData, TerritoryGeometry } from "@/lib/territories";

const QUEBEC_CENTER: [number, number] = [52.2, -71.8];
const CARTO_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toLatLng(point: [number, number]) {
  return [point[1], point[0]] as [number, number];
}

function geometryToGeoJson(geometry: TerritoryGeometry) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: geometry.type,
      coordinates: geometry.coordinates,
    },
  } as const;
}

function geometryToBounds(geometry: TerritoryGeometry): LatLngBoundsExpression | null {
  const rings =
    geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flatMap((polygon) => polygon);
  const points = rings.flat();

  if (!points.length) {
    return null;
  }

  return latLngBounds(points.map(toLatLng));
}

function buildMunicipalityLabelIcon(name: string) {
  return divIcon({
    className: "territory-map-city-label",
    html: `<span>${escapeHtml(name)}</span>`,
    iconSize: [0, 0],
  });
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

function TerritoryViewportController({
  territory,
  selectedMunicipality,
  viewMode,
}: {
  territory: TerritoryData;
  selectedMunicipality: string | null;
  viewMode: "territory" | "province" | "municipality";
}) {
  const map = useMap();

  const bounds = useMemo(() => {
    if (viewMode === "municipality" && selectedMunicipality) {
      const municipality = territory.municipalityGeometries.find((entry) => entry.name === selectedMunicipality);
      return municipality ? geometryToBounds(municipality.geometry) : null;
    }

    if (viewMode === "province") {
      return territory.provinceGeometry ? geometryToBounds(territory.provinceGeometry) : null;
    }

    return territory.geometry
      ? geometryToBounds(territory.geometry)
      : territory.provinceGeometry
        ? geometryToBounds(territory.provinceGeometry)
        : null;
  }, [selectedMunicipality, territory, viewMode]);

  useEffect(() => {
    if (!bounds) {
      map.setView(QUEBEC_CENTER, 5);
      return;
    }

    map.fitBounds(bounds, {
      padding: [28, 28],
      maxZoom: viewMode === "municipality" ? 11 : territory.kind === "mrc" ? 9 : 7,
    });
  }, [bounds, map, territory.kind, viewMode]);

  return null;
}

function InteractiveTerritoryMap({ territory }: { territory: TerritoryData }) {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"territory" | "province" | "municipality">("territory");

  if (!territory.provinceGeometry && !territory.geometry) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
        Aucun contour détaillé n&apos;est disponible pour ce programme, soit parce que sa portée est trop large,
        soit parce que la source n&apos;identifie pas encore un territoire cartographique précis.
      </div>
    );
  }

  const visibleLabels = getVisibleMunicipalityLabels(territory);
  const selectedMunicipalityData = selectedMunicipality
    ? territory.municipalityGeometries.find((entry) => entry.name === selectedMunicipality) ?? null
    : null;
  const googleMapsTarget = selectedMunicipality ?? territory.label;

  return (
    <div className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-black/70">
          <MapPinned className="h-4 w-4 text-[color:var(--accent)]" />
          <span>Carte interactive</span>
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
        <MapContainer
          key={`${territory.kind}-${territory.territoryCode ?? territory.name}`}
          center={QUEBEC_CENTER}
          zoom={5}
          className="territory-map-canvas h-full w-full"
          zoomControl
          scrollWheelZoom
          doubleClickZoom
          dragging
        >
          <TileLayer attribution={CARTO_ATTRIBUTION} url={CARTO_TILE_URL} />

          <TerritoryViewportController
            territory={territory}
            selectedMunicipality={selectedMunicipality}
            viewMode={viewMode}
          />

          {territory.provinceGeometry ? (
            <GeoJSON
              data={geometryToGeoJson(territory.provinceGeometry)}
              style={{
                color: "rgba(0,0,0,0.24)",
                weight: 1.2,
                fillColor: "rgba(0,0,0,0.02)",
                fillOpacity: 0.12,
              }}
              interactive={false}
            />
          ) : null}

          {territory.geometry ? (
            <GeoJSON
              data={geometryToGeoJson(territory.geometry)}
              style={{
                color: "rgba(214,77,57,0.92)",
                weight: 3,
                fillColor: "rgba(214,77,57,0.18)",
                fillOpacity: 0.22,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedMunicipality(null);
                  setViewMode("territory");
                },
              }}
            >
              <Tooltip sticky>{territory.label}</Tooltip>
            </GeoJSON>
          ) : null}

          {territory.municipalityGeometries.map((municipality) => {
            const selected = municipality.name === selectedMunicipality;

            return (
              <GeoJSON
                key={municipality.name}
                data={geometryToGeoJson(municipality.geometry)}
                style={{
                  color: selected ? "rgba(214,77,57,1)" : "rgba(0,0,0,0.26)",
                  weight: selected ? 2.4 : 1.1,
                  fillColor: selected ? "rgba(214,77,57,0.26)" : "rgba(214,77,57,0.06)",
                  fillOpacity: selected ? 0.32 : 0.12,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedMunicipality(municipality.name);
                    setViewMode("municipality");
                  },
                }}
              >
                <Tooltip sticky>{municipality.name}</Tooltip>
              </GeoJSON>
            );
          })}

          {visibleLabels.map((municipality) => (
            <Marker
              key={`label-${municipality.name}`}
              position={toLatLng(municipality.center)}
              icon={buildMunicipalityLabelIcon(municipality.name)}
              interactive={false}
            />
          ))}
        </MapContainer>

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

export function TerritoryMapClient({ territory }: { territory: TerritoryData }) {
  const mapKey = `${territory.kind}:${territory.territoryCode ?? territory.name}:${territory.label}`;

  return <InteractiveTerritoryMap key={mapKey} territory={territory} />;
}
