"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ScanSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function SegmentScanButton({
  label,
  sourceIds,
  targetSourceId,
  lastScannedAt,
  className,
}: {
  label: string;
  sourceIds: string[];
  targetSourceId?: string | null;
  lastScannedAt?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFresh = useMemo(() => {
    if (!lastScannedAt) {
      return false;
    }

    const lastScanTime = new Date(lastScannedAt).getTime();
    if (Number.isNaN(lastScanTime)) {
      return false;
    }

    return Date.now() - lastScanTime < ONE_DAY_MS;
  }, [lastScannedAt]);

  async function handleClick() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/fetch/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourceIds,
          targetLabel: label,
          targetSourceId: targetSourceId ?? null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Impossible de lancer le scan du segment.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Erreur inconnue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("flex items-center", className)}>
      <Button
        type="button"
        variant="ghost"
        onClick={handleClick}
        disabled={pending || sourceIds.length === 0}
        title={error ?? `Scanner ${label}`}
        aria-label={`Scanner ${label}`}
        className={cn(
          "h-7 w-7 rounded-full border border-black/10 p-0",
          isFresh ? "text-black/28 hover:text-black/55" : "text-black hover:text-black/70",
        )}
      >
        {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
