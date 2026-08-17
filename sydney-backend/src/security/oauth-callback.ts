import { z } from "zod";
import { config } from "../config.js";
import { callbackSchemeSchema } from "./input-validation.js";

export const webOAuthCallbackScheme = "cuppet-web";

export const oauthCallbackRequestSchema = z
  .object({
    callbackScheme: callbackSchemeSchema.optional(),
    callbackUrl: z.string().trim().url().max(2048).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.callbackScheme && value.callbackUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either callbackScheme or callbackUrl, not both."
      });
    }
    if (value.callbackUrl && !isAllowedWebOAuthCallback(value.callbackUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["callbackUrl"],
        message: "The web OAuth callback URL is not allowed."
      });
    }
  });

export type OAuthCallbackRequest = z.infer<typeof oauthCallbackRequestSchema>;

export function callbackSchemeForRequest(
  input: OAuthCallbackRequest | undefined,
  fallback = config.MOBILE_AUTH_CALLBACK_SCHEME
): string {
  if (input?.callbackUrl) return webOAuthCallbackScheme;
  return input?.callbackScheme ?? fallback;
}

export function callbackResponse(
  callbackScheme: string
): { callbackScheme: string } | { callbackUrl: string } {
  if (callbackScheme === webOAuthCallbackScheme) {
    return { callbackUrl: webOAuthCallbackUrl().toString() };
  }
  return { callbackScheme };
}

export function oauthCallbackRedirect(input: {
  callbackScheme: string;
  nativePath: string;
  flow: "connector" | "access" | "archive";
  params: Record<string, string>;
}): URL {
  const url =
    input.callbackScheme === webOAuthCallbackScheme
      ? webOAuthCallbackUrl()
      : new URL(`${input.callbackScheme}://${input.nativePath}`);

  if (input.callbackScheme === webOAuthCallbackScheme) {
    url.searchParams.set("flow", input.flow);
  }
  for (const [key, value] of Object.entries(input.params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export function isAllowedWebOAuthCallback(value: string | URL): boolean {
  if (!config.WEB_APP_URL) return false;
  try {
    const url = typeof value === "string" ? new URL(value) : value;
    const expected = webOAuthCallbackUrl();
    return (
      url.origin === expected.origin &&
      url.pathname === expected.pathname &&
      url.username === "" &&
      url.password === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

export function webOAuthCallbackUrl(): URL {
  if (!config.WEB_APP_URL) {
    throw new Error("WEB_APP_URL is required for browser OAuth.");
  }
  return new URL("/oauth/callback", config.WEB_APP_URL);
}

export function sanitizeSupportedCallbackScheme(value: string): string {
  const scheme = value.trim();
  if (scheme === webOAuthCallbackScheme) {
    if (!config.WEB_APP_URL) {
      throw new Error("Browser OAuth is not configured.");
    }
    return scheme;
  }
  if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) {
    throw new Error("Invalid callback scheme.");
  }
  return scheme;
}
