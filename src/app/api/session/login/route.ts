import { NextResponse } from "next/server";

import { createAccessToken, sessionCookieName } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;

  if (!body?.password) {
    return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });
  }

  if (body.password !== env.appPassword) {
    return NextResponse.json({ error: "Mot de passe invalide." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: sessionCookieName,
    value: createAccessToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
