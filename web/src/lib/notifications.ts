import { getApp, getApps, initializeApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { api } from "./api";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export function pushConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
}

export async function enablePushNotifications(): Promise<void> {
  if (!pushConfigured()) throw new Error("Web push is not configured for this deployment yet.");
  if (!(await isSupported()) || !("serviceWorker" in navigator)) throw new Error("This browser does not support web push notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const token = await getToken(getMessaging(app), {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error("The browser did not return a notification token.");
  await api.registerNotification(token);
  window.localStorage.setItem("cuppet-push-token", token);
}

export async function disablePushNotifications(): Promise<void> {
  const stored = window.localStorage.getItem("cuppet-push-token");
  if (stored) await api.unregisterNotification(stored).catch(() => undefined);
  if (getApps().length && (await isSupported())) await deleteToken(getMessaging(getApp())).catch(() => undefined);
  window.localStorage.removeItem("cuppet-push-token");
}
