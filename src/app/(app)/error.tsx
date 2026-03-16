"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="max-w-3xl">
      <p className="text-[11px] uppercase tracking-[0.18em] text-black/55">Erreur d’affichage</p>
      <h1 className="mt-3 text-3xl font-medium tracking-[-0.06em]">La vue demandée n’a pas pu se charger.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-black/66">
        L’application a intercepté l’erreur côté serveur ou côté rendu. Tu peux relancer le chargement sans quitter
        l’écran.
      </p>
      {error.digest ? (
        <p className="mt-4 text-xs tracking-[0.12em] text-black/45">Digest: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <a
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-medium tracking-[0.04em] transition hover:border-black hover:bg-black/[0.03]"
        >
          Retour au dashboard
        </a>
      </div>
    </Card>
  );
}
