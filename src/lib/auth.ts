import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { AppRole } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import nodemailer from "nodemailer";

import { env, hasResendConfig, hasSmtpConfig } from "@/lib/env";
import { prisma } from "@/lib/prisma";

async function sendVerificationRequest({
  identifier,
  url,
  provider,
}: {
  identifier: string;
  url: string;
  provider: { from?: string };
}) {
  if (hasResendConfig) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: provider.from ?? env.smtpFrom,
        to: [identifier],
        subject: "Connexion MTLA Subventions",
        text: `Votre lien de connexion: ${url}`,
        html: `<p>Votre lien de connexion MTLA Subventions:</p><p><a href="${url}">${url}</a></p>`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erreur Resend", errorText);
      throw new Error(`Resend a refuse l'envoi: ${errorText}`);
    }

    return;
  }

  const transport = hasSmtpConfig
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: Number(env.smtpPort) === 465,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPassword,
        },
      })
    : nodemailer.createTransport({
        jsonTransport: true,
      });

  await transport.sendMail({
    to: identifier,
    from: provider.from ?? env.smtpFrom,
    subject: "Connexion MTLA Subventions",
    text: `Votre lien de connexion: ${url}`,
    html: `<p>Votre lien de connexion MTLA Subventions:</p><p><a href="${url}">${url}</a></p>`,
  });

  if (!hasSmtpConfig) {
    console.info(`Lien magic link dev pour ${identifier}: ${url}`);
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: env.authSecret,
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    EmailProvider({
      from: env.smtpFrom,
      sendVerificationRequest,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user.role as AppRole | undefined) ?? AppRole.ANALYST;
      }
      return session;
    },
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      const existing = await prisma.user.findUnique({
        where: {
          email: user.email,
        },
      });

      if (existing) {
        return true;
      }

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          role: AppRole.ADMIN,
        },
      });

      return true;
    },
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getViewer() {
  const session = await getSession();

  if (session?.user) {
    return session.user;
  }

  if (env.devAuthBypass) {
    return {
      id: "dev-admin",
      email: "dev@mtla.local",
      name: "Dev Admin",
      role: AppRole.ADMIN,
    };
  }

  return null;
}
