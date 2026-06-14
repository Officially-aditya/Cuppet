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
    const serviceAccount = JSON.parse(config.FIREBASE_SERVICE_ACCOUNT);
    
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
