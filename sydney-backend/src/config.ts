import "dotenv/config";
import { z } from "zod";
import { ianaTimeZoneSchema } from "./users/time-zone.js";

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
  LLM_PROVIDER: z.enum(["gemini", "anthropic"]).default("gemini"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-lite"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  AGENT_SCHEDULE_TIME_ZONE: ianaTimeZoneSchema.default("Asia/Kolkata"),
  MOBILE_AUTH_CALLBACK_SCHEME: z.string().default("sydney"),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().url().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_OAUTH_SCOPES: z
    .string()
    .default(
      "channels:read,channels:history,groups:read,groups:history,users:read,app_mentions:read"
    ),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_APP_SLUG: z.string().trim().min(1).optional(),
  GMAIL_PUBSUB_VERIFICATION_TOKEN: z.string().optional(),
  GMAIL_PUBSUB_TOPIC: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().url().optional(),
  GITHUB_OAUTH_SCOPES: z.string().default("read:user"),
  NOTION_CLIENT_ID: z.string().optional(),
  NOTION_CLIENT_SECRET: z.string().optional(),
  NOTION_AUTHORIZATION_URL: z.string().url().optional(),
  NOTION_API_VERSION: z.string().default("2026-03-11"),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  ASSISTANT_MAX_CONFIRMED_MEMORIES: z.coerce.number().int().min(1).max(200).default(200),
  ASSISTANT_MAX_UNCONFIRMED_MEMORIES: z.coerce.number().int().min(1).max(200).default(200),
  ASSISTANT_MEMORY_SOURCE_MESSAGE_LIMIT: z.coerce.number().int().min(3).max(5).default(5),
  ASSISTANT_PENDING_ACTION_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  ASSISTANT_AGENT_AUDIT_RETENTION_DAYS: z.coerce.number().int().min(90).max(180).default(180),
  MESSAGE_RETENTION_DAYS: z.coerce.number().int().min(1).max(30).default(30),
  ASSISTANT_ATTACHMENT_CONTEXT_AFTER_BINARY_DAYS: z.coerce.number().int().min(1).max(2).default(1),
  ASSISTANT_STORED_ATTACHMENT_CONTEXT_KB: z.coerce.number().int().min(128).max(256).default(256),
  USER_ACTIVE_UPLOAD_FILE_LIMIT: z.coerce.number().int().min(4).max(500).default(40),
  USER_ACTIVE_UPLOAD_BYTES_MB: z.coerce.number().int().min(15).max(2048).default(250)
});

export const config = envSchema.parse(process.env);
