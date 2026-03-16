"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardFilterParams = {
  status?: string;
  region?: string;
  focus?: string;
};

function buildFilterHref(
  params: DashboardFilterParams,
  key: "status" | "region" | "focus",
  value: string,
) {
  const search = new URLSearchParams();
  const nextParams = {
    status: params.status,
    region: params.region,
    focus: params.focus,
  };

  nextParams[key] = nextParams[key] === value ? undefined : value;

  Object.entries(nextParams).forEach(([entryKey, entryValue]) => {
    if (entryValue) {
      search.set(entryKey, entryValue);
    }
  });

  const query = search.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center rounded-full border px-4 text-sm transition",
        active
          ? "border-black bg-black text-white"
          : "border-black/10 bg-white text-black/72 hover:border-black hover:text-black",
      )}
    >
      {children}
    </Link>
  );
}

export function DashboardFilters({
  params,
}: {
  params: DashboardFilterParams;
}) {
  const hasActiveFilter = Boolean(params.status || params.region || params.focus);
  const [open, setOpen] = useState(hasActiveFilter);

  return (
    <div className="mb-5 border-b border-black/10 pb-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Filtres</p>
          <p className="mt-2 text-sm leading-6 text-black/62">
            Sélectionne rapidement les attributs à filtrer pour les priorités du dashboard.
          </p>
        </div>

        <Button variant="secondary" className="gap-2" onClick={() => setOpen((current) => !current)}>
          <Filter className="h-4 w-4" />
          Filtrer
          <ChevronDown className={cn("h-4 w-4 transition", open ? "rotate-180" : "rotate-0")} />
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-black/45">Statut</span>
            <FilterChip href={buildFilterHref(params, "status", "OPEN")} active={params.status === "OPEN"}>
              Ouverts
            </FilterChip>
            <FilterChip href={buildFilterHref(params, "status", "REVIEW")} active={params.status === "REVIEW"}>
              À vérifier
            </FilterChip>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-black/45">Zone</span>
            <FilterChip href={buildFilterHref(params, "region", "quebec")} active={params.region === "quebec"}>
              Région de Québec
            </FilterChip>
            <FilterChip href={buildFilterHref(params, "region", "montreal")} active={params.region === "montreal"}>
              Région de Montréal
            </FilterChip>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-black/45">Famille</span>
            <FilterChip
              href={buildFilterHref(params, "focus", "cinema-creation")}
              active={params.focus === "cinema-creation"}
            >
              Cinéma et création culturelle
            </FilterChip>
            <FilterChip
              href={buildFilterHref(params, "focus", "obnl-development")}
              active={params.focus === "obnl-development"}
            >
              OBNL et développement des organismes
            </FilterChip>
          </div>
        </div>
      ) : null}
    </div>
  );
}
