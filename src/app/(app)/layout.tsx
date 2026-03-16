import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ScanTriggerButton } from "@/components/scan-trigger-button";
import { getViewer } from "@/lib/auth";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getMrcNavLinks } from "@/lib/mrcs";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  await ensureBootstrapped();
  const mrcLinks = await getMrcNavLinks();

  return (
    <AppShell
      userLabel={viewer.name ?? "Accès partagé"}
      action={<ScanTriggerButton />}
      mrcLinks={mrcLinks}
    >
      {children}
    </AppShell>
  );
}
