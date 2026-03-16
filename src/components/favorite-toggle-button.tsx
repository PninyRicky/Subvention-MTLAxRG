"use client";

import { startTransition, useEffect, useState } from "react";
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
  const [favorite, setFavorite] = useState(isFavorite);

  useEffect(() => {
    setFavorite(isFavorite);
  }, [isFavorite]);

  async function handleToggle() {
    const nextFavorite = !favorite;
    setFavorite(nextFavorite);
    setPending(true);

    try {
      const response = await fetch(`/api/programs/${programId}/favorite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isFavorite: nextFavorite,
        }),
      });

      if (!response.ok) {
        throw new Error("Impossible de mettre a jour le favori.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setFavorite(!nextFavorite);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant={compact ? "ghost" : "secondary"}
      className={cn(
        compact ? "h-9 px-3" : "",
        favorite ? "border-[color:var(--accent)]/20 bg-[color:var(--accent-soft)] text-[color:var(--accent)]" : "",
        pending ? "opacity-90" : "",
      )}
      onClick={handleToggle}
      disabled={pending}
      aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={favorite}
    >
      <Heart className={cn("h-4 w-4 transition-colors", favorite ? "fill-current" : "")} />
      {!compact ? <span className="ml-2">{favorite ? "Favori" : "Ajouter aux favoris"}</span> : null}
    </Button>
  );
}
