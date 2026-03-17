const fallbackSecret = "mtla-dev-secret-change-me";

export const env = {
  appUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  authSecret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? fallbackSecret,
  appPassword: process.env.APP_PASSWORD ?? "MTLAxRG",
  resendApiKey: process.env.RESEND_API_KEY,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  smtpFrom: process.env.SMTP_FROM ?? "noreply@mtla.local",
  cronSecret: process.env.CRON_SECRET ?? "local-cron-secret",
  devAuthBypass: process.env.DEV_AUTH_BYPASS === "true",
  aiApiKey: process.env.AI_API_KEY ?? "",
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://api.deepseek.com",
  aiModel: process.env.AI_MODEL ?? "deepseek-chat",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY ?? "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  aiEnabled: process.env.AI_ENABLED === "true",
};

export const hasSmtpConfig =
  Boolean(env.smtpHost) &&
  Boolean(env.smtpPort) &&
  Boolean(env.smtpUser) &&
  Boolean(env.smtpPassword);

export const hasResendConfig = Boolean(env.resendApiKey) && Boolean(env.smtpFrom);
