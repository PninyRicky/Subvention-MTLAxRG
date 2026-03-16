"use client";

import { useState } from "react";
import { MapPinned, Minus, Plus, RotateCcw } from "lucide-react";

import type { TerritoryData, TerritoryGeometry } from "@/lib/territories";
import { Button } from "@/components/ui/button";

const mapWidth = 1000;
const mapHeight = 760;
const mapPadding = 36;

function simplifyRing(ring: [number, number][]) {
  const step = Math.max(1, Math.floor(ring.length / 220));

  if (step === 1) {
    return ring;
  }

  const reduced = ring.filter((_, index) => index % step === 0);
  const lastPoint = ring[ring.length - 1];

  if (lastPoint && reduced[reduced.length - 1] !== lastPoint) {
    reduced.push(lastPoint);
  }

  return reduced;
}

function toRings(geometry: TerritoryGeometry) {
  return geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flatMap((polygon) => polygon);
}

function getBounds(geometry: TerritoryGeometry) {
  const points = toRings(geometry).flat();
  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);

  return {
    minLon: Math.min(...longitudes),
    maxLon: Math.max(...longitudes),
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
  };
}

function buildProjection(geometry: TerritoryGeometry) {
  const { minLon, maxLon, minLat, maxLat } = getBounds(geometry);
  const drawableWidth = mapWidth - mapPadding * 2;
  const drawableHeight = mapHeight - mapPadding * 2;
  const lonSpan = Math.max(maxLon - minLon, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const scale = Math.min(drawableWidth / lonSpan, drawableHeight / latSpan);
  const horizontalOffset = (mapWidth - lonSpan * scale) / 2;
  const verticalOffset = (mapHeight - latSpan * scale) / 2;

  return ([longitude, latitude]: [number, number]) => {
    const x = horizontalOffset + (longitude - minLon) * scale;
    const y = mapHeight - (verticalOffset + (latitude - minLat) * scale);
    return [x, y] as const;
  };
}

function buildPathData(geometry: TerritoryGeometry, project: (point: [number, number]) => readonly [number, number]) {
  const rings = toRings(geometry).map((ring) => simplifyRing(ring));

  return rings
    .map((ring) => {
      const [first, ...rest] = ring;

      if (!first) {
        return "";
      }

      const [firstX, firstY] = project(first);

      return `M ${firstX.toFixed(2)} ${firstY.toFixed(2)} ${rest
        .map((point) => {
          const [x, y] = project(point);
          return `L ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ")} Z`;
    })
    .join(" ");
}

export function TerritoryMap({ territory }: { territory: TerritoryData }) {
  const [zoom, setZoom] = useState(1);

  if (!territory.provinceGeometry && !territory.geometry) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
        Aucun contour détaillé n&apos;est disponible pour ce programme, soit parce que sa portée est trop large
        (Québec/Canada), soit parce que la source n&apos;identifie pas encore un territoire cartographique précis.
      </div>
    );
  }

  const projectionGeometry = territory.provinceGeometry ?? territory.geometry;

  if (!projectionGeometry) {
    return null;
  }

  const project = buildProjection(projectionGeometry);
  const provincePath = territory.provinceGeometry ? buildPathData(territory.provinceGeometry, project) : null;
  const territoryPath = territory.geometry ? buildPathData(territory.geometry, project) : null;
  const municipalityPaths = territory.municipalityGeometries.map((municipality) => ({
    name: municipality.name,
    path: buildPathData(municipality.geometry, project),
    point: project(municipality.center),
  }));
  const labels = municipalityPaths.slice(0, 18);

  return (
    <div className="overflow-hidden rounded-[24px] border border-black/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.01),rgba(0,0,0,0.04))]">
      <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-black/70">
          <MapPinned className="h-4 w-4 text-[color:var(--accent)]" />
          <span>Carte interactive du Québec</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" className="h-9 px-3" onClick={() => setZoom((current) => Math.max(1, current - 0.2))}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="secondary" className="h-9 px-3" onClick={() => setZoom((current) => Math.min(3, current + 0.2))}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="secondary" className="h-9 px-3" onClick={() => setZoom(1)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-auto bg-[radial-gradient(circle_at_top,rgba(223,97,68,0.07),transparent_45%),linear-gradient(180deg,#fff,#f7f7f7)]">
        <svg
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          className="h-auto min-w-full"
          style={{ width: `${Math.round(mapWidth * zoom)}px` }}
          role="img"
          aria-label={`Carte interactive du Québec mettant en évidence ${territory.label}`}
        >
          <rect width={mapWidth} height={mapHeight} fill="white" />

          {provincePath ? (
            <path
              d={provincePath}
              fill="rgba(0,0,0,0.035)"
              stroke="rgba(0,0,0,0.12)"
              strokeWidth="2"
              fillRule="evenodd"
            />
          ) : null}

          {municipalityPaths.map((municipality) =>
            municipality.path ? (
              <path
                key={municipality.name}
                d={municipality.path}
                fill="rgba(223,97,68,0.06)"
                stroke="rgba(0,0,0,0.18)"
                strokeWidth="1.5"
                fillRule="evenodd"
              />
            ) : null,
          )}

          {territoryPath ? (
            <path
              d={territoryPath}
              fill="rgba(223, 97, 68, 0.22)"
              stroke="rgba(223, 97, 68, 0.92)"
              strokeWidth="5"
              fillRule="evenodd"
            />
          ) : null}

          {labels.map((label) => {
            const [x, y] = label.point;
            return (
              <g key={label.name}>
                <circle cx={x} cy={y} r="3.5" fill="rgba(223,97,68,0.92)" />
                <text
                  x={x + 8}
                  y={y - 6}
                  fontSize="18"
                  fontFamily="var(--font-ibm-plex-mono), monospace"
                  fill="rgba(0,0,0,0.78)"
                >
                  {label.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
