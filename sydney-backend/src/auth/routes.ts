import type { FastifyInstance, FastifyReply } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { ensureAssistantContact } from "../agents/assistant.js";
import { config } from "../config.js";
import { auth } from "./index.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
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
        response.headers.forEach((value, key) => reply.header(key, value));

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
