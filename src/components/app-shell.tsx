"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, FolderSearch2, MapPinned, Radar, ScanSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
  },
  {
    href: "/programmes",
    label: "Programmes",
    icon: FolderSearch2,
  },
  {
    href: "/profils",
    label: "Profils",
    icon: Radar,
  },
  {
    href: "/scans",
    label: "Scans",
    icon: ScanSearch,
  },
];

export function AppShell({
  children,
  userLabel,
  action,
  institutionLinks = [],
  mrcLinks = [],
}: {
  children: React.ReactNode;
  userLabel: string;
  action?: React.ReactNode;
  institutionLinks?: { slug: string; label: string; count: number; href: string }[];
  mrcLinks?: { slug: string; name: string; count: number; href: string; regionName: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupedMrcLinks = useMemo(
    () =>
      Object.entries(
        mrcLinks.reduce<Record<string, typeof mrcLinks>>((groups, mrc) => {
          const bucket = groups[mrc.regionName] ?? [];
          bucket.push(mrc);
          groups[mrc.regionName] = bucket;
          return groups;
        }, {}),
      ).sort(([left], [right]) => left.localeCompare(right, "fr")),
    [mrcLinks],
  );
  const activeInstitutionSlug = pathname === "/programmes" ? searchParams.get("institution") : null;
  const activeMrcSlug = pathname === "/mrcs" ? searchParams.get("mrc") : null;
  const activeMrcRegion = activeMrcSlug
    ? groupedMrcLinks.find(([, entries]) => entries.some((entry) => entry.slug === activeMrcSlug))?.[0] ?? null
    : null;
  const [institutionsOpen, setInstitutionsOpen] = useState(Boolean(activeInstitutionSlug));
  const [mrcOpen, setMrcOpen] = useState(Boolean(pathname === "/mrcs" || activeMrcSlug));
  const [openRegions, setOpenRegions] = useState<Record<string, boolean>>(
    activeMrcRegion ? { [activeMrcRegion]: true } : {},
  );

  async function handleLogout() {
    await fetch("/api/session/logout", {
      method: "POST",
    });
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto grid min-h-screen max-w-[1480px] grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-6">
        <aside className="rounded-[32px] border border-black/10 bg-white p-6">
          <div className="flex items-center gap-3 border-b border-black/10 pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 text-xs font-semibold uppercase tracking-[0.2em]">
              MTLA
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/55">Back-office</p>
              <h1 className="text-lg font-medium tracking-[-0.03em]">MTLA Subventions</h1>
            </div>
          </div>

          <nav className="mt-6 space-y-1.5">
            {navigation.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                      active
                        ? "bg-black !text-white"
                        : "text-black/72 hover:bg-black/[0.04] hover:text-black",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "!text-white" : "")} />
                    <span className={cn(active ? "!text-white" : "")}>{item.label}</span>
                  </Link>

                  {item.href === "/programmes" && (institutionLinks.length > 0 || mrcLinks.length > 0) ? (
                    <div className="ml-6 mt-2 border-l border-black/10 pl-3">
                      {institutionLinks.length > 0 ? (
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => setInstitutionsOpen((current) => !current)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-black/60 transition hover:bg-black/[0.03] hover:text-black"
                          >
                            <span className="uppercase tracking-[0.18em] text-black/38">Institutions</span>
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 transition",
                                institutionsOpen ? "rotate-180 text-black/60" : "text-black/35",
                              )}
                            />
                          </button>

                          {institutionsOpen ? (
                            <div className="space-y-1">
                              {institutionLinks.map((institution) => {
                                const activeInstitution = pathname === "/programmes" && activeInstitutionSlug === institution.slug;

                                return (
                                  <Link
                                    key={institution.slug}
                                    href={institution.href}
                                    className={cn(
                                      "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition",
                                      activeInstitution
                                        ? "bg-black/[0.06] text-black"
                                        : "text-black/60 hover:bg-black/[0.03] hover:text-black",
                                    )}
                                  >
                                    <span className="truncate">{institution.label}</span>
                                    <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-black/40">
                                      {institution.count}
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {mrcLinks.length > 0 ? (
                        <div className={cn("space-y-1", institutionLinks.length > 0 ? "mt-3" : "mt-0")}>
                          <button
                            type="button"
                            onClick={() => setMrcOpen((current) => !current)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition hover:bg-black/[0.03]"
                          >
                            <span className="flex items-center gap-2 text-black/60">
                              <MapPinned className="h-3.5 w-3.5" />
                              <span className="uppercase tracking-[0.16em]">MRC</span>
                            </span>
                            <ChevronDown
                              className={cn("h-3.5 w-3.5 transition", mrcOpen ? "rotate-180 text-black/60" : "text-black/35")}
                            />
                          </button>

                          {mrcOpen ? (
                            <div className="space-y-2">
                              <Link
                                href="/mrcs"
                                className={cn(
                                  "flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition",
                                  pathname === "/mrcs" && !activeMrcSlug
                                    ? "bg-black/[0.06] text-black"
                                    : "text-black/60 hover:bg-black/[0.03] hover:text-black",
                                )}
                              >
                                <MapPinned className="h-3.5 w-3.5" />
                                <span>Toutes les MRC</span>
                              </Link>

                              {groupedMrcLinks.map(([regionName, entries]) => {
                                const regionOpen = openRegions[regionName] ?? regionName === activeMrcRegion;

                                return (
                                  <div key={regionName} className="space-y-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenRegions((current) => ({
                                          ...current,
                                          [regionName]: !regionOpen,
                                        }))
                                      }
                                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-black/60 transition hover:bg-black/[0.03] hover:text-black"
                                    >
                                      <span className="truncate uppercase tracking-[0.18em] text-black/38">{regionName}</span>
                                      <ChevronDown
                                        className={cn(
                                          "h-3.5 w-3.5 transition",
                                          regionOpen ? "rotate-180 text-black/60" : "text-black/35",
                                        )}
                                      />
                                    </button>

                                    {regionOpen ? (
                                      <div className="space-y-1">
                                        {entries.map((mrc) => {
                                          const activeMrc = pathname === "/mrcs" && activeMrcSlug === mrc.slug;

                                          return (
                                            <Link
                                              key={mrc.slug}
                                              href={mrc.href}
                                              className={cn(
                                                "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs transition",
                                                activeMrc
                                                  ? "bg-black/[0.06] text-black"
                                                  : "text-black/60 hover:bg-black/[0.03] hover:text-black",
                                              )}
                                            >
                                              <span className="truncate">{mrc.name}</span>
                                              <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-black/40">
                                                {mrc.count}
                                              </span>
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col gap-6">
          <header className="flex flex-col gap-4 rounded-[32px] border border-black/10 bg-white px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-black/55">MTLA.Productions</p>
              <p className="mt-1 text-2xl font-medium tracking-[-0.05em]">Veille interne de subventions</p>
            </div>
            <div className="flex items-center gap-3">
              {action}
              <div className="hidden rounded-full border border-black/10 px-4 py-2 text-sm text-black/72 sm:block">
                {userLabel}
              </div>
              <Button variant="secondary" onClick={() => void handleLogout()}>
                Sortir
              </Button>
            </div>
          </header>

          <main className="pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
