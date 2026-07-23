import { randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { PoolClient } from "pg";
import { ensureAssistantContact } from "../agents/assistant.js";
import { config } from "../config.js";
import { pool } from "../db/index.js";

const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

type SessionRow = {
  id: string;
  token: string;
  expiresAt: Date | string;
};

export type NativeGoogleSession = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  session: {
    id: string;
    expiresAt: string;
  };
};

export class NativeGoogleAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 401
  ) {
    super(message);
  }
}

export async function createNativeGoogleSession(input: {
  idToken: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<NativeGoogleSession> {
  const profile = await verifyGoogleIdToken(input.idToken);
  const client = await pool.connect();
  let committed = false;

  try {
    await client.query("BEGIN");

    const user = await upsertGoogleUser(client, profile, input.idToken);
    const session = await createSession(client, {
      userId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    await client.query("COMMIT");
    committed = true;
    await ensureAssistantContact(user.id);

    return {
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      },
      session: {
        id: session.id,
        expiresAt: new Date(session.expiresAt).toISOString()
      }
    };
  } catch (error) {
    if (!committed) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const audiences = googleAudiences();
  if (audiences.length === 0) {
    throw new NativeGoogleAuthError(
      "GOOGLE_AUTH_NOT_CONFIGURED",
      "Google sign-in is not configured on the server.",
      503
    );
  }

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(idToken, googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: audiences
    });
    payload = verified.payload;
  } catch {
    throw new NativeGoogleAuthError(
      "INVALID_GOOGLE_TOKEN",
      "Google sign-in could not be verified. Try again."
    );
  }

  const email = stringClaim(payload.email);
  const sub = stringClaim(payload.sub);
  if (!sub || !email) {
    throw new NativeGoogleAuthError(
      "INCOMPLETE_GOOGLE_PROFILE",
      "Google did not return a complete profile.",
      400
    );
  }

  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  if (!emailVerified) {
    throw new NativeGoogleAuthError(
      "GOOGLE_EMAIL_NOT_VERIFIED",
      "Use a Google account with a verified email address.",
      400
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const fallbackName = normalizedEmail.split("@")[0] || "Sydney user";
  return {
    sub,
    email: normalizedEmail,
    emailVerified,
    name: stringClaim(payload.name) ?? fallbackName,
    picture: stringClaim(payload.picture)
  };
}

async function upsertGoogleUser(
  client: PoolClient,
  profile: GoogleProfile,
  idToken: string
): Promise<UserRow> {
  const accountUser = await client.query<UserRow>(
    `
      SELECT u.id, u.email, u.name, u.image
      FROM accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.provider_id = 'google'
        AND a.account_id = $1
      LIMIT 1
    `,
    [profile.sub]
  );

  const existingUser =
    accountUser.rows[0] ?? (await findUserByEmail(client, profile.email));
  const insertedUser =
    existingUser ??
    (
      await client.query<UserRow>(
        `
          INSERT INTO users (email, name, image, email_verified)
          VALUES ($1, $2, $3, $4)
          RETURNING id, email, name, image
        `,
        [profile.email, profile.name, profile.picture, profile.emailVerified]
      )
    ).rows[0];

  if (!insertedUser) {
    throw new Error("Failed to create Google user.");
  }

  const user =
    existingUser ??
    insertedUser;

  const updatedUser = await updateUserProfile(client, {
    userId: user.id,
    name: profile.name,
    picture: profile.picture,
    emailVerified: profile.emailVerified
  });

  await client.query(
    `
      INSERT INTO accounts (user_id, account_id, provider_id, id_token)
      VALUES ($1, $2, 'google', $3)
      ON CONFLICT (provider_id, account_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        id_token = EXCLUDED.id_token,
        updated_at = NOW()
    `,
    [updatedUser.id, profile.sub, idToken]
  );

  return updatedUser;
}

async function findUserByEmail(
  client: PoolClient,
  email: string
): Promise<UserRow | null> {
  const result = await client.query<UserRow>(
    `
      SELECT id, email, name, image
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email]
  );
  return result.rows[0] ?? null;
}

async function updateUserProfile(
  client: PoolClient,
  input: {
    userId: string;
    name: string;
    picture: string | null;
    emailVerified: boolean;
  }
): Promise<UserRow> {
  const result = await client.query<UserRow>(
    `
      UPDATE users
      SET name = COALESCE(NULLIF($2, ''), name),
          image = COALESCE($3, image),
          email_verified = email_verified OR $4::boolean,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, image
    `,
    [input.userId, input.name, input.picture, input.emailVerified]
  );
  const user = result.rows[0];
  if (!user) {
    throw new Error("Failed to update Google user.");
  }
  return user;
}

async function createSession(
  client: PoolClient,
  input: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<SessionRow> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const result = await client.query<SessionRow>(
    `
      INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, token, expires_at AS "expiresAt"
    `,
    [input.userId, token, expiresAt, input.ipAddress ?? null, input.userAgent ?? null]
  );
  const session = result.rows[0];
  if (!session) {
    throw new Error("Failed to create Google session.");
  }
  return session;
}

function googleAudiences(): string[] {
  const defaults = [
    "196727476983-mcou7vm9g1kar5nr9217sq3ljrbtv53g.apps.googleusercontent.com"
  ];
  const configured = [
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_ANDROID_CLIENT_ID
  ].filter((value): value is string => Boolean(value?.trim()));

  return [...new Set([...defaults, ...configured])];
}

function stringClaim(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
