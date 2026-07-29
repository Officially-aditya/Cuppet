import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config.js";
import { registerApi } from "./api/index.js";
import { registerPublicErrorHandling } from "./api/public-errors.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 64 * 1024,
    logger:
      config.NODE_ENV === "development"
        ? {
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname"
              }
            }
          }
        : true
  });

  registerPublicErrorHandling(app);

  // Webhook signatures cover the exact request bytes. Preserve those bytes
  // while continuing to expose parsed JSON to existing route handlers.
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (request, body, done) => {
      const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
      request.rawBody = rawBody;
      try {
        done(
          null,
          rawBody.length === 0 ? {} : JSON.parse(rawBody.toString("utf8"))
        );
      } catch (error) {
        done(error as Error);
      }
    }
  );

  await app.register(multipart, {
    limits: {
      fileSize: 15 * 1024 * 1024 // 15MB max file size
    }
  });

  await app.register(cors, {
    origin(origin, callback) {
      const browserExtensionOrigin =
        origin && /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
      if (!origin || config.TRUSTED_ORIGINS.includes(origin) || browserExtensionOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"), false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Cuppet-Expected-User",
      "X-Cuppet-Browser-Token"
    ],
    credentials: true,
    maxAge: 86400
  });

  await app.register(registerApi);

  return app;
}
