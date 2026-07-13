import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  AUTH_BASE_URL: z.string().url().default("http://localhost:3000"),
  TRUSTED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  VAULT_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "VAULT_ENCRYPTION_KEY must be 64 hex chars"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-lite"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  AGENT_SCHEDULE_TIME_ZONE: z.string().default("Asia/Kolkata"),
  RUN_AGENT_WORKER_IN_API: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  MOBILE_AUTH_CALLBACK_SCHEME: z.string().default("sydney"),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().url().optional(),
  GITHUB_OAUTH_SCOPES: z.string().default("read:user"),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional()
});

export const config = envSchema.parse(process.env);
