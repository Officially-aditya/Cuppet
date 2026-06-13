import type { FastifyInstance, FastifyReply } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { ensureAssistantContact } from "../agents/assistant.js";
import { config } from "../config.js";
import { auth } from "./index.js";
import {
  createNativeGoogleSession,
  NativeGoogleAuthError
} from "./google-native.js";

const nativeGoogleBodySchema = z.object({
  idToken: z.string().min(1).optional(),
  id_token: z.string().min(1).optional()
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/mobile/google", async (request, reply) => {
    const parsed = nativeGoogleBodySchema.safeParse(request.body);
    const idToken = parsed.success
      ? parsed.data.idToken ?? parsed.data.id_token
      : null;

    if (!idToken) {
      return reply.code(400).send({
        error: {
          code: "MISSING_GOOGLE_ID_TOKEN",
          message: "Google did not return an ID token."
        }
      });
    }

    try {
      const session = await createNativeGoogleSession({
        idToken,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"]
      });
      return reply.send(session);
    } catch (error) {
      if (error instanceof NativeGoogleAuthError) {
        request.log.warn({ error }, "Native Google sign-in failed");
        return reply.code(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message
          }
        });
      }

      request.log.error({ error }, "Native Google sign-in failed");
      return reply.code(500).send({
        error: {
          code: "GOOGLE_SIGN_IN_FAILED",
          message: "Google sign-in failed."
        }
      });
    }
  });

  app.get("/auth/mobile/google/callback", async (request, reply) => {
    const query = request.query as { redirect_uri?: string };
    const redirectUri = resolveMobileGoogleRedirect(query.redirect_uri);

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers)
    });

    if (!session) {
      return redirectMobileAuthError(reply, redirectUri, "missing_session");
    }

    await ensureAssistantContact(session.user.id);

    redirectUri.hash = new URLSearchParams({
      token: session.session.token
    }).toString();

    return reply.redirect(redirectUri.toString());
  });

  app.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(request.url, config.AUTH_BASE_URL);
        const headers = fromNodeHeaders(request.headers);
        const init: RequestInit = {
          method: request.method,
          headers
        };

        if (
          request.method !== "GET" &&
          request.method !== "HEAD" &&
          request.body !== undefined
        ) {
          init.body = JSON.stringify(request.body);
        }

        const response = await auth.handler(new Request(url.toString(), init));
        const responseText = response.body ? await response.text() : null;

        if (
          request.method === "POST" &&
          url.pathname === "/auth/sign-up/email" &&
          response.ok &&
          responseText
        ) {
          const body = JSON.parse(responseText) as {
            user?: { id?: string };
          };

          if (body.user?.id) {
            await ensureAssistantContact(body.user.id);
          }
        }

        reply.status(response.status);
        applyResponseHeaders(reply, response.headers);

        return reply.send(responseText);
      } catch (error) {
        request.log.error({ error }, "Authentication route failed");
        return reply.code(500).send({
          error: {
            code: "AUTH_FAILURE",
            message: "Authentication failed."
          }
        });
      }
    }
  });
}

function applyResponseHeaders(reply: FastifyReply, headers: Headers): void {
  const setCookieHeaders = extractSetCookieHeaders(headers);

  headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      reply.header(key, value);
    }
  });

  if (setCookieHeaders.length > 0) {
    reply.header("set-cookie", setCookieHeaders);
  }
}

function extractSetCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const explicit = withGetSetCookie.getSetCookie?.();
  if (explicit && explicit.length > 0) {
    return explicit;
  }

  const combined = headers.get("set-cookie");
  if (!combined) {
    return [];
  }

  return combined.split(/,(?=\s*[\w!#$%&'*+.^_`|~-]+=)/g);
}

function resolveMobileGoogleRedirect(value?: string): URL {
  const fallback = `${config.MOBILE_AUTH_CALLBACK_SCHEME}://auth/google`;
  const url = new URL(value || fallback);
  const expectedProtocol = `${config.MOBILE_AUTH_CALLBACK_SCHEME}:`;

  if (
    url.protocol !== expectedProtocol ||
    url.hostname !== "auth" ||
    url.pathname !== "/google"
  ) {
    throw new Error("Invalid mobile Google auth callback URL.");
  }

  url.search = "";
  url.hash = "";
  return url;
}

function redirectMobileAuthError(
  reply: FastifyReply,
  redirectUri: URL,
  code: string
) {
  redirectUri.hash = new URLSearchParams({ error: code }).toString();
  return reply.redirect(redirectUri.toString());
}
