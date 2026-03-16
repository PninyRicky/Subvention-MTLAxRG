"use client";

import dynamic from "next/dynamic";

import type { TerritoryData } from "@/lib/territories";

const TerritoryMapClient = dynamic(
  () => import("./territory-map-client").then((module) => module.TerritoryMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[24px] border border-black/10 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
        Chargement de la carte interactive…
      </div>
    ),
  },
);

export function TerritoryMap({ territory }: { territory: TerritoryData }) {
  return <TerritoryMapClient territory={territory} />;
}
