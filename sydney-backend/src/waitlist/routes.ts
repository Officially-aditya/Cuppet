import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db/index.js";

export const waitlistRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    website: z.string().max(200).optional()
  })
  .strict();

const DEFAULT_BLOCKED_EMAIL_DOMAINS = [
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "disposablemail.com",
  "dispostable.com",
  "emailondeck.com",
  "emailfake.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "mail.tm",
  "mailcatch.com",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "mytrashmail.com",
  "sharklasers.com",
  "spam4.me",
  "temp-mail.io",
  "temp-mail.org",
  "tempmail.com",
  "tempmailo.com",
  "tmpmail.com",
  "tmpmail.net",
  "tmpmail.org",
  "trashmail.com",
  "trashmail.me",
  "trashmail.net",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net"
] as const;

const blockedEmailDomains = new Set([
  ...DEFAULT_BLOCKED_EMAIL_DOMAINS,
  ...config.WAITLIST_BLOCKED_EMAIL_DOMAINS.split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
]);

const WAITLIST_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const WAITLIST_RATE_LIMIT_MAX = 5;
const waitlistRateLimits = new Map<
  string,
  { count: number; windowStartedAt: number }
>();

export type WaitlistEmailIssue = "disposable" | "random" | null;

export function waitlistEmailIssue(email: string): WaitlistEmailIssue {
  const at = email.lastIndexOf("@");
  const localPart = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (
    [...blockedEmailDomains].some(
      (blocked) => domain === blocked || domain.endsWith(`.${blocked}`)
    )
  ) {
    return "disposable";
  }

  if (
    /^\d{7,}$/.test(localPart) ||
    /^(.)\1{5,}$/.test(localPart) ||
    (localPart.length >= 16 &&
      /^[a-z0-9]+$/i.test(localPart) &&
      /\d/.test(localPart) &&
      !/[aeiou]/i.test(localPart))
  ) {
    return "random";
  }

  return null;
}

function consumeWaitlistRateLimit(key: string, now = Date.now()): number | null {
  for (const [storedKey, state] of waitlistRateLimits) {
    if (now - state.windowStartedAt >= WAITLIST_RATE_LIMIT_WINDOW_MS) {
      waitlistRateLimits.delete(storedKey);
    }
  }

  const current = waitlistRateLimits.get(key);
  if (!current || now - current.windowStartedAt >= WAITLIST_RATE_LIMIT_WINDOW_MS) {
    waitlistRateLimits.set(key, { count: 1, windowStartedAt: now });
    return null;
  }

  if (current.count >= WAITLIST_RATE_LIMIT_MAX) {
    return Math.ceil(
      (WAITLIST_RATE_LIMIT_WINDOW_MS - (now - current.windowStartedAt)) / 1000
    );
  }

  current.count += 1;
  return null;
}

export async function waitlistRoutes(app: FastifyInstance): Promise<void> {
  app.post("/waitlist", async (request, reply) => {
    const forwardedFor = request.headers["x-forwarded-for"];
    const forwardedClientIp = (
      Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]
    )?.trim();
    const retryAfter = consumeWaitlistRateLimit(
      forwardedClientIp || request.ip || "unknown"
    );
    if (retryAfter != null) {
      reply.header("Retry-After", retryAfter);
      return reply.code(429).send({
        error: {
          code: "WAITLIST_RATE_LIMITED",
          message: "Too many attempts. Please try again in a few minutes."
        }
      });
    }

    const parsed = waitlistRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_EMAIL",
          message: "Enter a valid email address."
        }
      });
    }

    if (parsed.data.website?.trim()) {
      return reply.code(400).send({
        error: {
          code: "SPAM_DETECTED",
          message: "We could not accept that submission."
        }
      });
    }

    const emailIssue = waitlistEmailIssue(parsed.data.email);
    if (emailIssue === "disposable") {
      return reply.code(400).send({
        error: {
          code: "DISPOSABLE_EMAIL",
          message: "Please use a permanent email address."
        }
      });
    }
    if (emailIssue === "random") {
      return reply.code(400).send({
        error: {
          code: "SUSPICIOUS_EMAIL",
          message: "Please enter a real email address."
        }
      });
    }

    try {
      const result = await pool.query<{ id: string }>(
        `
          INSERT INTO waitlists (email)
          VALUES ($1)
          ON CONFLICT DO NOTHING
          RETURNING id
        `,
        [parsed.data.email]
      );

      return reply.code(200).send({
        success: true,
        already_registered: result.rowCount === 0
      });
    } catch (error) {
      request.log.error({ error }, "Failed to save waitlist submission");
      return reply.code(500).send({
        error: {
          code: "WAITLIST_SUBMISSION_FAILED",
          message: "We could not save your email right now. Please try again."
        }
      });
    }
  });
}
