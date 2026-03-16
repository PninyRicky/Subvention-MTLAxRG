import { createHash } from "node:crypto";

import { AppRole } from "@prisma/client";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

export const sessionCookieName = "mtla_access";

export function createAccessToken() {
  return createHash("sha256").update(`${env.authSecret}:${env.appPassword}`).digest("hex");
}

export async function getViewer() {
  if (env.devAuthBypass) {
    return {
      id: "dev-admin",
      email: "acces-partage",
      name: "Acces MTLAxRG",
      role: AppRole.ADMIN,
    };
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(sessionCookieName)?.value;

  if (accessToken !== createAccessToken()) {
    return null;
  }

  return {
    id: "shared-access",
    email: "acces-partage",
    name: "Acces MTLAxRG",
    role: AppRole.ADMIN,
  };
}
