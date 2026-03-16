"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPinned, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";

import type { TerritoryData, TerritoryGeometry } from "@/lib/territories";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SVG_W = 1000;
const SVG_H = 760;
const PAD = 36;
const MIN_VB_W = 120;
const MIN_VB_H = 92;

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                   */
/* ------------------------------------------------------------------ */

function isFinitePoint(point: unknown): point is [number, number] {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === "number" &&
    Number.isFinite(point[0]) &&
    typeof point[1] === "number" &&
    Number.isFinite(point[1])
  );
}

function normalizeRing(ring: unknown) {
  if (!Array.isArray(ring)) return [] as [number, number][];
  return ring.filter(isFinitePoint) as [number, number][];
}

function simplifyRing(ring: [number, number][], maxPoints = 220) {
  const step = Math.max(1, Math.floor(ring.length / maxPoints));
  if (step === 1) return ring;
  const reduced = ring.filter((_, i) => i % step === 0);
  const last = ring[ring.length - 1];
  if (last && reduced[reduced.length - 1] !== last) reduced.push(last);
  return reduced;
}

function toRings(geometry: TerritoryGeometry) {
  const raw =
    geometry.type === "Polygon"
      ? geometry.coordinates
      : geometry.coordinates.flatMap((p) => p);
  return raw.map(normalizeRing).filter((r) => r.length >= 3);
}

function getBounds(geometry: TerritoryGeometry) {
  const points = toRings(geometry).flat();
  if (points.length === 0) return null;
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

/* ------------------------------------------------------------------ */
/*  Mercator-corrected equirectangular projection                      */
/*  cos(midLat) correction prevents east-west stretching at Quebec's   */
/*  latitude (45°-62° N).                                              */
/* ------------------------------------------------------------------ */

function buildProjection(referenceGeometry: TerritoryGeometry) {
  const bounds = getBounds(referenceGeometry);
  if (!bounds) return null;

  const { minLon, maxLon, minLat, maxLat } = bounds;
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const cos = Math.cos(midLat);

  const drawW = SVG_W - PAD * 2;
  const drawH = SVG_H - PAD * 2;
  const lonSpan = Math.max((maxLon - minLon) * cos, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const scale = Math.min(drawW / lonSpan, drawH / latSpan);
  const offX = (SVG_W - lonSpan * scale) / 2;
  const offY = (SVG_H - latSpan * scale) / 2;

  return (point: [number, number]): [number, number] => {
    const x = offX + (point[0] - minLon) * cos * scale;
    const y = SVG_H - (offY + (point[1] - minLat) * scale);
    return [x, y];
  };
}

/* ------------------------------------------------------------------ */
/*  SVG path builder                                                   */
/* ------------------------------------------------------------------ */

function buildPath(
  geometry: TerritoryGeometry,
  project: (p: [number, number]) => [number, number],
) {
  return toRings(geometry)
    .map((ring) => simplifyRing(ring))
    .map((ring) => {
      const [first, ...rest] = ring;
      if (!first) return "";
      const [sx, sy] = project(first);
      return `M${sx.toFixed(1)},${sy.toFixed(1)} ${rest
        .map((p) => {
          const [x, y] = project(p);
          return `L${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")}Z`;
    })
    .join(" ");
}

/* ------------------------------------------------------------------ */
/*  ViewBox type & helpers                                             */
/* ------------------------------------------------------------------ */

type ViewBox = { x: number; y: number; w: number; h: number };
const FULL_VB: ViewBox = { x: 0, y: 0, w: SVG_W, h: SVG_H };

function getProjectedBounds(
  geometry: TerritoryGeometry,
  project: (p: [number, number]) => [number, number],
): ViewBox | null {
  const pts = toRings(geometry).flat().map(project);
  if (pts.length === 0) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function padViewBox(vb: ViewBox, factor = 0.35): ViewBox {
  const pw = vb.w * factor;
  const ph = vb.h * factor;
  return { x: vb.x - pw, y: vb.y - ph, w: vb.w + pw * 2, h: vb.h + ph * 2 };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeViewBox(viewBox: ViewBox): ViewBox {
  const width = clampNumber(viewBox.w, MIN_VB_W, SVG_W);
  const height = clampNumber(viewBox.h, MIN_VB_H, SVG_H);
  const maxX = SVG_W - width;
  const maxY = SVG_H - height;

  return {
    x: clampNumber(viewBox.x, 0, Math.max(0, maxX)),
    y: clampNumber(viewBox.y, 0, Math.max(0, maxY)),
    w: width,
    h: height,
  };
}

function buildLabelLayout(
  municipalityPaths: { name: string; path: string; point: [number, number] }[],
  maxLabels: number,
) {
  const accepted: { name: string; point: [number, number] }[] = [];

  for (const municipality of municipalityPaths) {
    if (accepted.length >= maxLabels) {
      break;
    }

    const [x, y] = municipality.point;
    const width = Math.max(60, municipality.name.length * 7.2);
    const height = 16;
    const nextBox = {
      left: x + 8,
      right: x + 8 + width,
      top: y - 18,
      bottom: y - 18 + height,
    };

    const overlaps = accepted.some((label) => {
      const [existingX, existingY] = label.point;
      const existingWidth = Math.max(60, label.name.length * 7.2);
      const existingBox = {
        left: existingX + 8,
        right: existingX + 8 + existingWidth,
        top: existingY - 18,
        bottom: existingY - 18 + height,
      };

      return !(
        nextBox.right < existingBox.left ||
        nextBox.left > existingBox.right ||
        nextBox.bottom < existingBox.top ||
        nextBox.top > existingBox.bottom
      );
    });

    if (!overlaps) {
      accepted.push({ name: municipality.name, point: municipality.point });
    }
  }

  return accepted;
}

/* ------------------------------------------------------------------ */
/*  Map model — pre-computed paths + smart initial viewport            */
/* ------------------------------------------------------------------ */

type MapModel = {
  provincePath: string | null;
  territoryPath: string | null;
  municipalityPaths: { name: string; path: string; point: [number, number] }[];
  labels: { name: string; point: [number, number] }[];
  initialViewBox: ViewBox;
};

function buildMapModel(territory: TerritoryData): MapModel | null {
  try {
    const projBase = territory.provinceGeometry ?? territory.geometry;
    if (!projBase) return null;
    const project = buildProjection(projBase);
    if (!project) return null;

    const provincePath = territory.provinceGeometry
      ? buildPath(territory.provinceGeometry, project)
      : null;

    const territoryPath = territory.geometry
      ? buildPath(territory.geometry, project)
      : null;

    const municipalityPaths = territory.municipalityGeometries
      .map((m) => ({
        name: m.name,
        path: buildPath(m.geometry, project),
        point: isFinitePoint(m.center) ? project(m.center) : null,
      }))
      .filter(
        (m): m is { name: string; path: string; point: [number, number] } =>
          Boolean(m.path) && Boolean(m.point),
      );

    // Smart initial viewport: zoom into territory when it exists
    let initialViewBox = FULL_VB;
    if (
      territory.geometry &&
      (territory.kind === "mrc" ||
        territory.kind === "region" ||
        territory.kind === "municipality")
    ) {
      const tBounds = getProjectedBounds(territory.geometry, project);
      if (tBounds && tBounds.w > 0 && tBounds.h > 0) {
        initialViewBox = padViewBox(tBounds, 0.4);
      }
    }

    const maxLabels = territory.kind === "mrc" ? 18 : 12;

    return {
      provincePath,
      territoryPath,
      municipalityPaths,
      labels: buildLabelLayout(municipalityPaths, maxLabels),
      initialViewBox,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TerritoryMap({ territory }: { territory: TerritoryData }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const model = useMemo(() => buildMapModel(territory), [territory]);
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const [viewBox, setViewBox] = useState<ViewBox>(
    () => normalizeViewBox(model?.initialViewBox ?? FULL_VB),
  );
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startVB: ViewBox;
  } | null>(null);

  // Prevent default wheel scroll on the SVG so it zooms instead
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => e.preventDefault();
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, []);

  const zoomBy = useCallback((factor: number, center?: { x: number; y: number }) => {
    setViewBox((vb) => {
      const nw = vb.w * factor;
      const nh = vb.h * factor;
      const anchorX = center?.x ?? vb.x + vb.w / 2;
      const anchorY = center?.y ?? vb.y + vb.h / 2;
      const relX = (anchorX - vb.x) / vb.w;
      const relY = (anchorY - vb.y) / vb.h;

      return normalizeViewBox({
        x: anchorX - nw * relX,
        y: anchorY - nh * relY,
        w: nw,
        h: nh,
      });
    });
  }, []);

  const resetView = useCallback(() => {
    if (model) setViewBox(normalizeViewBox(model.initialViewBox));
  }, [model]);

  const showFullProvince = useCallback(() => setViewBox(FULL_VB), []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const localX = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
      const localY = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
      zoomBy(e.deltaY > 0 ? 1.15 : 0.87, { x: localX, y: localY });
    },
    [viewBox, zoomBy],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      svgRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, startVB: { ...viewBox } };
    },
    [viewBox],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - drag.startX) / rect.width) * drag.startVB.w;
    const dy = ((e.clientY - drag.startY) / rect.height) * drag.startVB.h;
    setViewBox(
      normalizeViewBox({
        ...drag.startVB,
        x: drag.startVB.x - dx,
        y: drag.startVB.y - dy,
      }),
    );
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  /* ---- empty states ---- */

  if (!territory.provinceGeometry && !territory.geometry) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
        Aucun contour détaillé n&apos;est disponible pour ce programme, soit parce que sa portée est trop large
        (Québec/Canada), soit parce que la source n&apos;identifie pas encore un territoire cartographique précis.
      </div>
    );
  }

  if (!model) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
        Le contour officiel du territoire est incomplet ou inutilisable pour l&apos;affichage cartographique.
      </div>
    );
  }

  /* ---- adaptive sizing ---- */
  const fontSize = Math.max(8, Math.min(16, viewBox.w * 0.018));
  const dotR = Math.max(2, fontSize * 0.3);
  const provinceStroke = Math.max(1, viewBox.w * 0.002);
  const munStroke = Math.max(0.5, viewBox.w * 0.0012);
  const territoryStroke = Math.max(2, viewBox.w * 0.005);
  const visibleLabels = model.labels.filter(({ point: [x, y] }) => {
    return x >= viewBox.x && x <= viewBox.x + viewBox.w && y >= viewBox.y && y <= viewBox.y + viewBox.h;
  });

  return (
    <div className="overflow-hidden rounded-[24px] border border-black/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.01),rgba(0,0,0,0.04))]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-black/70">
          <MapPinned className="h-4 w-4 text-[color:var(--accent)]" />
          <span>Carte interactive</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" className="h-8 px-2.5" title="Zoom arrière" onClick={() => zoomBy(1.35)}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" className="h-8 px-2.5" title="Zoom avant" onClick={() => zoomBy(0.7)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" className="h-8 px-2.5" title="Vue complète du Québec" onClick={showFullProvince}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" className="h-8 px-2.5" title="Recentrer sur le territoire" onClick={resetView}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="cursor-grab touch-none select-none active:cursor-grabbing bg-[radial-gradient(circle_at_top,rgba(223,97,68,0.07),transparent_45%),linear-gradient(180deg,#fff,#f7f7f7)]">
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="h-auto w-full"
          style={{ aspectRatio: `${SVG_W} / ${SVG_H}` }}
          role="img"
          aria-label={`Carte interactive du Québec — ${territory.label}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={() => zoomBy(0.75)}
        >
          {/* Province outline (context layer) */}
          {model.provincePath ? (
            <path
              d={model.provincePath}
              fill="rgba(0,0,0,0.03)"
              stroke="rgba(0,0,0,0.10)"
              strokeWidth={provinceStroke}
              fillRule="evenodd"
            />
          ) : null}

          {/* Municipality fills */}
          {model.municipalityPaths.map((m) => (
            <path
              key={m.name}
              d={m.path}
              fill={hoveredName === m.name ? "rgba(223,97,68,0.16)" : "rgba(223,97,68,0.08)"}
              stroke={hoveredName === m.name ? "rgba(223,97,68,0.85)" : "rgba(0,0,0,0.16)"}
              strokeWidth={munStroke}
              fillRule="evenodd"
              vectorEffect="non-scaling-stroke"
              onPointerEnter={() => setHoveredName(m.name)}
              onPointerLeave={() => setHoveredName(null)}
            />
          ))}

          {/* Territory highlight */}
          {model.territoryPath ? (
            <path
              d={model.territoryPath}
              fill="rgba(223,97,68,0.20)"
              stroke="rgba(223,97,68,0.88)"
              strokeWidth={territoryStroke}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              fillRule="evenodd"
            />
          ) : null}

          {/* Labels */}
          {visibleLabels.map((label) => {
            const [x, y] = label.point;
            return (
              <g key={label.name} onPointerEnter={() => setHoveredName(label.name)} onPointerLeave={() => setHoveredName(null)}>
                <circle cx={x} cy={y} r={dotR} fill="rgba(223,97,68,0.90)" />
                <text
                  x={x + dotR * 2.5}
                  y={y - dotR * 1.8}
                  fontSize={fontSize}
                  fontFamily="var(--font-ibm-plex-mono), monospace"
                  fill="rgba(0,0,0,0.74)"
                  stroke="rgba(255,255,255,0.92)"
                  strokeWidth={Math.max(1.2, fontSize * 0.12)}
                  paintOrder="stroke"
                >
                  {label.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center justify-between border-t border-black/8 px-4 py-3 text-xs leading-5 text-black/58">
        <p>
          Clique-glisse pour déplacer la carte, roulette pour zoomer, double-clic pour rapprocher.
        </p>
        <p>{hoveredName ? `Survol: ${hoveredName}` : territory.label}</p>
      </div>
    </div>
  );
}
