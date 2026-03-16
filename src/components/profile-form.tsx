"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ProfileFormProps = {
  id: string;
  name: string;
  scenario: string;
  description: string;
  criteria: string;
  weights: string;
  thresholds: string;
};

export function ProfileForm({
  id,
  name,
  scenario,
  description,
  criteria,
  weights,
  thresholds,
}: ProfileFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/profiles/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: formData.get("name"),
          scenario: formData.get("scenario"),
          description: formData.get("description"),
          criteria: formData.get("criteria"),
          weights: formData.get("weights"),
          thresholds: formData.get("thresholds"),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Impossible de mettre a jour le profil.");
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
    <Card>
      <form
        action={(formData) => {
          void handleSubmit(formData);
        }}
        className="space-y-5"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-black/55">Nom</span>
            <input
              name="name"
              defaultValue={name}
              className="h-11 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-black/55">Scenario</span>
            <input
              name="scenario"
              defaultValue={scenario}
              className="h-11 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-black/55">Description</span>
          <textarea
            name="description"
            defaultValue={description}
            rows={3}
            className="w-full rounded-[24px] border border-black/10 px-4 py-3 text-sm outline-none transition focus:border-black"
          />
        </label>

        <div className="grid gap-5 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-black/55">Criteres JSON</span>
            <textarea
              name="criteria"
              defaultValue={criteria}
              rows={12}
              className="w-full rounded-[24px] border border-black/10 px-4 py-3 font-mono text-xs outline-none transition focus:border-black"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-black/55">Poids JSON</span>
            <textarea
              name="weights"
              defaultValue={weights}
              rows={12}
              className="w-full rounded-[24px] border border-black/10 px-4 py-3 font-mono text-xs outline-none transition focus:border-black"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-black/55">Seuils JSON</span>
            <textarea
              name="thresholds"
              defaultValue={thresholds}
              rows={12}
              className="w-full rounded-[24px] border border-black/10 px-4 py-3 font-mono text-xs outline-none transition focus:border-black"
            />
          </label>
        </div>

        <div className="flex items-center justify-between">
          {error ? <p className="text-sm text-[color:var(--accent)]">{error}</p> : <div />}
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement..." : "Enregistrer le profil"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
