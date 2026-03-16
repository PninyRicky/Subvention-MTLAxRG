import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ScanTriggerButton } from "@/components/scan-trigger-button";
import { getViewer } from "@/lib/auth";
import { ensureBootstrapped } from "@/lib/bootstrap";

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

  return (
    <AppShell
      userLabel={viewer.name ?? "Acces partage"}
      action={<ScanTriggerButton />}
    >
      {children}
    </AppShell>
  );
}
