"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SignInForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Acces refuse.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Acces refuse.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-xl p-8">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-black/55">MTLA.Productions</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.07em]">Connexion interne</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-black/68">
          Acces protege par un mot de passe partage. Une fois entre, tu accedes directement au back-office.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-black/55">Mot de passe</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="MTLAxRG"
            className="h-12 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs leading-5 text-black/55">Protection simple par mot de passe partage pour la V1.</p>
          <Button type="submit" disabled={pending}>
            {pending ? "Verification..." : "Entrer"}
          </Button>
        </div>
      </form>

      {message ? <p className="mt-4 text-sm text-[color:var(--accent)]">{message}</p> : null}
    </Card>
  );
}
