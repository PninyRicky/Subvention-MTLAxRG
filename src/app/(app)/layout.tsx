import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ScanTriggerButton } from "@/components/scan-trigger-button";
import { getViewer } from "@/lib/auth";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getInstitutionNavLinks } from "@/lib/institutions";
import { getMrcNavLinks, getMrcRegionLinks } from "@/lib/mrcs";

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
  const [institutionLinks, mrcLinks, mrcRegionLinks] = await Promise.all([
    getInstitutionNavLinks(),
    getMrcNavLinks(),
    getMrcRegionLinks(),
  ]);

  return (
    <AppShell
      userLabel={viewer.name ?? "Accès partagé"}
      action={<ScanTriggerButton />}
      institutionLinks={institutionLinks}
      mrcLinks={mrcLinks}
      mrcRegionLinks={mrcRegionLinks}
    >
      {children}
    </AppShell>
  );
}
