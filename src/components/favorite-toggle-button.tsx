"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteToggleButton({
  programId,
  isFavorite,
  compact = false,
}: {
  programId: string;
  isFavorite: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);

    try {
      const response = await fetch(`/api/programs/${programId}/favorite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isFavorite: !isFavorite,
        }),
      });

      if (!response.ok) {
        throw new Error("Impossible de mettre a jour le favori.");
      }

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant={compact ? "ghost" : "secondary"}
      className={cn(compact ? "h-9 px-3" : "", isFavorite ? "border-[color:var(--accent)]/20 bg-[color:var(--accent-soft)] text-[color:var(--accent)]" : "")}
      onClick={handleToggle}
      disabled={pending}
      aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <Heart className={cn("h-4 w-4", isFavorite ? "fill-current" : "")} />
      {!compact ? <span className="ml-2">{isFavorite ? "Favori" : "Ajouter aux favoris"}</span> : null}
    </Button>
  );
}
