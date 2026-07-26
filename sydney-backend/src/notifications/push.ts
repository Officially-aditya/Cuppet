import type { Pool } from "pg";
import { cleanPushNotificationText, getFirebaseMessaging } from "./firebase.js";

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushNotification(
  db: Pool,
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
  const messaging = getFirebaseMessaging();
  
  if (!messaging) {
    console.warn("Firebase not initialized. Skipping push notification.");
    return { success: false, sentCount: 0, failedCount: 0 };
  }

  // Get all FCM tokens for the user
  const result = await db.query<{ token: string }>(
    "SELECT token FROM fcm_tokens WHERE user_id = $1",
    [userId]
  );

  if (result.rows.length === 0) {
    console.log(`No FCM tokens found for user ${userId}`);
    return { success: true, sentCount: 0, failedCount: 0 };
  }

  const tokens = result.rows.map((row) => row.token);
  
  const cleanTitle = cleanPushNotificationText(payload.title);
  const cleanBody = cleanPushNotificationText(payload.body);

  // Send notification to all devices
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: cleanTitle,
      body: cleanBody,
    },
    data: payload.data,
    android: {
      priority: "high",
      notification: {
        channelId: "agent_messages",
        priority: "high",
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: cleanTitle,
            body: cleanBody,
          },
          sound: "default",
          badge: 1,
        },
      },
    },
  });

  // Clean up invalid tokens
  if (response.failureCount > 0) {
    const invalidTokens: string[] = [];
    response.responses.forEach((resp: { success: boolean; error?: { code?: string } }, idx: number) => {
      if (!resp.success && 
          (resp.error?.code === "messaging/invalid-registration-token" ||
           resp.error?.code === "messaging/registration-token-not-registered")) {
        const token = tokens[idx];
        if (token) {
          invalidTokens.push(token);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await db.query(
        "DELETE FROM fcm_tokens WHERE token = ANY($1)",
        [invalidTokens]
      );
      console.log(`Removed ${invalidTokens.length} invalid FCM tokens`);
    }
  }

  return {
    success: response.successCount > 0,
    sentCount: response.successCount,
    failedCount: response.failureCount,
  };
}

export async function registerFCMToken(
  db: Pool,
  userId: string,
  token: string,
  deviceInfo?: Record<string, unknown>
): Promise<void> {
  await db.query(
    `INSERT INTO fcm_tokens (user_id, token, device_info)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, token)
     DO UPDATE SET updated_at = NOW(), device_info = EXCLUDED.device_info`,
    [userId, token, deviceInfo ? JSON.stringify(deviceInfo) : null]
  );
}

export async function unregisterFCMToken(
  db: Pool,
  userId: string,
  token: string
): Promise<void> {
  await db.query(
    "DELETE FROM fcm_tokens WHERE user_id = $1 AND token = $2",
    [userId, token]
  );
}

export function cleanText(text: string): string {
  if (!text) return text;
  return text
    // Remove markdown bold/italic markdown symbols
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/__/g, "")
    .replace(/_([^_]+)_/g, "$1") // clean italic underscores
    // Remove markdown headers
    .replace(/^#+\s+/gm, "") // headers at the start of any line
    .replace(/#+/g, "") // any stray header symbols
    // Trim whitespace
    .trim();
}
