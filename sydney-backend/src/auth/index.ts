import { betterAuth } from "better-auth";
import { bearer, jwt } from "better-auth/plugins";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import { sendPasswordResetEmail } from "./mailer.js";
import { authPublicBasePath, authPublicOrigin } from "./public-url.js";

const socialProviders =
  config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: config.GOOGLE_CLIENT_ID,
          clientSecret: config.GOOGLE_CLIENT_SECRET
        }
      }
    : {};

export const auth = betterAuth({
  appName: "Sydney",
  baseURL: authPublicOrigin,
  basePath: authPublicBasePath,
  database: pool,
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: config.TRUSTED_ORIGINS,
  socialProviders,
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        url
      });
    }
  },
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      idToken: "id_token",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"]
    }
  },
  verification: {
    modelName: "verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  plugins: [
    bearer(),
    jwt()
  ]
});
