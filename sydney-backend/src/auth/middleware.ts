import type { FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { importJWK, jwtVerify, type JWTPayload, type JWK } from "jose";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import { auth } from "./index.js";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers)
  });

  if (!session) {
    const jwtAuth = await verifyJwtBearer(request);
    if (jwtAuth) {
      request.auth = jwtAuth;
      return;
    }

    reply.code(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "Sign in required."
      }
    });
    return;
  }

  request.auth = {
    userId: session.user.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image
    },
    session: session.session
  };
}

async function verifyJwtBearer(
  request: FastifyRequest
): Promise<FastifyRequest["auth"] | null> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  const [encodedHeader] = token.split(".");
  if (!encodedHeader) return null;

  try {
    const header = JSON.parse(
      Buffer.from(encodedHeader, "base64url").toString("utf8")
    ) as { kid?: string; alg?: string };

    if (!header.kid) return null;

    const keyResult = await pool.query<{
      id: string;
      publicKey: string;
      alg: string | null;
    }>(
      'SELECT id, "publicKey", alg FROM jwks WHERE id = $1',
      [header.kid]
    );
    const keyRow = keyResult.rows[0];
    if (!keyRow) return null;

    const publicKey = await importJWK(
      JSON.parse(keyRow.publicKey) as JWK,
      header.alg ?? keyRow.alg ?? "EdDSA"
    );

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: config.AUTH_BASE_URL,
      audience: config.AUTH_BASE_URL
    });

    if (!payload.sub) return null;

    const userResult = await pool.query<{
      id: string;
      email: string;
      name: string | null;
      image: string | null;
    }>(
      "SELECT id, email, name, image FROM users WHERE id = $1",
      [payload.sub]
    );
    const user = userResult.rows[0];
    if (!user) return null;

    return {
      userId: user.id,
      user,
      session: {
        type: "jwt",
        payload: payload as JWTPayload
      }
    };
  } catch (error) {
    request.log.debug({ error }, "JWT bearer verification failed");
    return null;
  }
}
