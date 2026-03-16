const fallbackSecret = "mtla-dev-secret-change-me";

export const env = {
  appUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  authSecret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? fallbackSecret,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  smtpFrom: process.env.SMTP_FROM ?? "noreply@mtla.local",
  cronSecret: process.env.CRON_SECRET ?? "local-cron-secret",
  devAuthBypass: process.env.DEV_AUTH_BYPASS === "true",
};

export const hasSmtpConfig =
  Boolean(env.smtpHost) &&
  Boolean(env.smtpPort) &&
  Boolean(env.smtpUser) &&
  Boolean(env.smtpPassword);
