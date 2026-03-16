import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const viewer = await getViewer();

  if (viewer) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-12">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-black/55">MTLA.Productions</p>
          <h1 className="mt-3 text-6xl font-medium tracking-[-0.08em]">Subventions</h1>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
