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
    const databaseSessionAuth = await verifyDatabaseSessionBearer(request);
    if (databaseSessionAuth) {
      request.auth = databaseSessionAuth;
      return;
    }

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
      image: session.user.image,
      avatar: await loadUserAvatar(session.user.id)
    },
    session: session.session
  };
}

async function verifyDatabaseSessionBearer(
  request: FastifyRequest
): Promise<FastifyRequest["auth"] | null> {
  const token = bearerTokenFrom(request);
  if (!token) return null;

  try {
    const result = await pool.query<{
      session_id: string;
      token: string;
      expires_at: Date | string;
      user_id: string;
      email: string;
      name: string | null;
      image: string | null;
      avatar: number | null;
    }>(
      `
        SELECT s.id AS session_id,
               s.token,
               s.expires_at,
               u.id AS user_id,
               u.email,
               u.name,
               u.image,
               u.avatar
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = $1
          AND s.expires_at > NOW()
        LIMIT 1
      `,
      [token]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      userId: row.user_id,
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        image: row.image,
        avatar: row.avatar
      },
      session: {
        id: row.session_id,
        token: row.token,
        expiresAt: row.expires_at
      }
    };
  } catch (error) {
    request.log.debug({ error }, "Database bearer session verification failed");
    return null;
  }
}

async function verifyJwtBearer(
  request: FastifyRequest
): Promise<FastifyRequest["auth"] | null> {
  const token = bearerTokenFrom(request);
  if (!token) return null;

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
      avatar: number | null;
    }>(
      "SELECT id, email, name, image, avatar FROM users WHERE id = $1",
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

async function loadUserAvatar(userId: string): Promise<number | null> {
  const result = await pool.query<{ avatar: number | null }>(
    "SELECT avatar FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0]?.avatar ?? null;
}

function bearerTokenFrom(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
