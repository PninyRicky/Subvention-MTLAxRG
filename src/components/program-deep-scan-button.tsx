"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ProgramDeepScanButton({ programId }: { programId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/programs/${programId}/scan`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Impossible de lancer le scan approfondi.");
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
    <div className="flex flex-col items-end gap-2">
      <Button variant="secondary" onClick={handleClick} disabled={pending}>
        {pending ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Radar className="mr-2 h-4 w-4" />
        )}
        Scanner ce programme
      </Button>
      {error ? <p className="max-w-[260px] text-right text-xs text-[color:var(--accent)]">{error}</p> : null}
    </div>
  );
}
