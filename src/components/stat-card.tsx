import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint: string;
  href?: string;
}) {
  const content = (
    <Card className="flex min-h-[170px] flex-col justify-between transition hover:border-black hover:shadow-[0_12px_36px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">{label}</p>
        <ArrowUpRight className="h-4 w-4 text-black/30" />
      </div>
      <div>
        <p className="text-4xl font-medium tracking-[-0.08em]">{value}</p>
        <p className="mt-3 max-w-xs text-sm leading-6 text-black/64">{hint}</p>
      </div>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block rounded-[28px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--accent)]">
      {content}
    </Link>
  );
}
