import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "default" | "open" | "review" | "closed" | "eligible";

const toneClasses: Record<BadgeTone, string> = {
  default: "border-black/10 bg-black/[0.04] text-black",
  open: "border-emerald-600/20 bg-emerald-600/10 text-emerald-700",
  review: "border-amber-500/20 bg-amber-500/10 text-amber-700",
  closed: "border-zinc-300 bg-zinc-100 text-zinc-600",
  eligible: "border-[var(--accent)]/20 bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em]",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
