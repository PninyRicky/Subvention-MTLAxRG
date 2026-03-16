"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FolderSearch2, Radar, ScanSearch } from "lucide-react";

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
}: {
  children: React.ReactNode;
  userLabel: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();

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
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    active ? "bg-black text-white" : "text-black/72 hover:bg-black/[0.04] hover:text-black",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 rounded-[28px] border border-black/10 bg-[color:var(--accent-soft)] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--accent)]">Style MTLA</p>
            <p className="mt-2 text-sm leading-6 text-black/72">
              Interface editoriale noir sur blanc avec une accentuation minimale pour les actions importantes.
            </p>
          </div>
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
              <Button variant="secondary" onClick={() => window.location.assign("/api/auth/signout?callbackUrl=/sign-in")}>
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
