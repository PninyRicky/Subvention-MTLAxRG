"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      await signIn("email", {
        email,
        callbackUrl: "/dashboard",
        redirect: false,
      });
      setMessage("Lien envoye. Verifie ta boite courriel ou les logs dev si SMTP n'est pas configure.");
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
          Acces par magic link pour l’equipe. En local, si aucun SMTP n’est configure, le lien est trace dans les logs serveur.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-black/55">Courriel</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="prenom@mtla.productions"
            className="h-12 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none transition focus:border-black"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs leading-5 text-black/55">Roles par defaut: premier utilisateur = admin, suivants = analysts.</p>
          <Button type="submit" disabled={pending}>
            {pending ? "Envoi..." : "Recevoir un lien"}
          </Button>
        </div>
      </form>

      {message ? <p className="mt-4 text-sm text-[color:var(--accent)]">{message}</p> : null}
    </Card>
  );
}
