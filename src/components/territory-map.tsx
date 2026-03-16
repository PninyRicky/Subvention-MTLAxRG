import type { TerritoryData, TerritoryGeometry } from "@/lib/territories";

function simplifyRing(ring: [number, number][]) {
  const step = Math.max(1, Math.floor(ring.length / 180));

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

function buildPathData(geometry: TerritoryGeometry) {
  const rings = toRings(geometry).map((ring) => simplifyRing(ring));
  const points = rings.flat();

  if (points.length === 0) {
    return null;
  }

  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const width = 1000;
  const height = 580;
  const padding = 28;
  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;
  const lonSpan = Math.max(maxLon - minLon, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const scale = Math.min(drawableWidth / lonSpan, drawableHeight / latSpan);
  const horizontalOffset = (width - lonSpan * scale) / 2;
  const verticalOffset = (height - latSpan * scale) / 2;

  const project = ([longitude, latitude]: [number, number]) => {
    const x = horizontalOffset + (longitude - minLon) * scale;
    const y = height - (verticalOffset + (latitude - minLat) * scale);
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };

  return rings
    .map((ring) => {
      const [first, ...rest] = ring;

      if (!first) {
        return "";
      }

      return `M ${project(first)} ${rest.map((point) => `L ${project(point)}`).join(" ")} Z`;
    })
    .join(" ");
}

export function TerritoryMap({ territory }: { territory: TerritoryData }) {
  if (!territory.geometry) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
        Aucun contour détaillé n&apos;est disponible pour ce programme, soit parce que sa portée est trop large
        (Québec/Canada), soit parce que la source n&apos;identifie pas encore un territoire cartographique précis.
      </div>
    );
  }

  const pathData = buildPathData(territory.geometry);

  if (!pathData) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-black/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.01),rgba(0,0,0,0.04))]">
      <svg
        viewBox="0 0 1000 580"
        className="h-auto w-full"
        role="img"
        aria-label={`Contour territorial pour ${territory.label}`}
      >
        <rect width="1000" height="580" fill="white" />
        <path
          d={pathData}
          fill="rgba(223, 97, 68, 0.18)"
          stroke="rgba(223, 97, 68, 0.92)"
          strokeWidth="6"
          fillRule="evenodd"
        />
      </svg>
    </div>
  );
}
