import { ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <Card className="flex min-h-[170px] flex-col justify-between">
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
}
