import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config.js";
import { registerApi } from "./api/index.js";

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

  await app.register(multipart, {
    limits: {
      fileSize: 15 * 1024 * 1024 // 15MB max file size
    }
  });

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.TRUSTED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"), false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400
  });

  await app.register(registerApi);

  return app;
}
