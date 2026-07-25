import { initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { config } from "../config.js";

let firebaseApp: App | null = null;

export function initializeFirebase(): App | null {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (!config.FIREBASE_SERVICE_ACCOUNT) {
    console.warn("FIREBASE_SERVICE_ACCOUNT not configured. Push notifications disabled.");
    return null;
  }

  try {
    let raw = config.FIREBASE_SERVICE_ACCOUNT.trim();
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
      raw = raw.slice(1, -1).trim();
    }
    const serviceAccount = JSON.parse(raw);
    
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });

    console.log("Firebase Admin SDK initialized successfully");
    return firebaseApp;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    return null;
  }
}

export function getFirebaseMessaging(): Messaging | null {
  const app = firebaseApp || initializeFirebase();
  return app ? getMessaging(app) : null;
}

export function cleanPushNotificationText(text: string, maxLength = 120): string {
  if (!text) return "";
  const cleaned = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

