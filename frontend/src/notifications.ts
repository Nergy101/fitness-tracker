/**
 * Browser push notification helpers.
 *
 * - requestNotificationPermission  — ask the user for push permission
 * - registerPushSubscription       — subscribe via Push API and POST to backend
 * - unsubscribePush                — remove the subscription
 * - getNotificationStatus          — read current permission state
 */

// ─── Types ──────────────────────────────────────────────

interface PushKeyPair {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionInfo {
  endpoint: string;
  keys: PushKeyPair;
}

// ─── Service Worker Helpers ─────────────────────────────

async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────

export type NotificationStatus = "granted" | "denied" | "prompt" | "unsupported";

export function getNotificationStatus(): NotificationStatus {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission as "granted" | "denied" | "prompt";
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    throw new Error("Notifications not supported in this browser");
  }
  return Notification.requestPermission();
}

export async function registerPushSubscription(): Promise<PushSubscriptionInfo | null> {
  const registration = await getSWRegistration();
  if (!registration) {
    console.warn("No service worker registration available");
    return null;
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    // Already subscribed — return existing as JSON
    return existing.toJSON() as unknown as PushSubscriptionInfo;
  }

  // Convert the server's base64 VAPID key to a Uint8Array
  // The backend gives us the public key; we use a hardcoded fallback here.
  // In production you should fetch this from the backend (/api/v1/notifications/vapid-public-key).
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

  if (!vapidPublicKey) {
    console.warn(
      "No VAPID public key configured (set VITE_VAPID_PUBLIC_KEY env var). " +
        "Push subscription will be skipped.",
    );
    return null;
  }

  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey as unknown as BufferSource,
  });

  const json = subscription.toJSON() as unknown as PushSubscriptionInfo;

  // POST to backend
  try {
    const { api } = await import("./api");
    await api.subscribePush(json);
  } catch (err) {
    console.error("Failed to register push subscription with backend", err);
    // Still return the subscription so the caller knows we're subscribed locally
  }

  return json;
}

export async function unsubscribePush(): Promise<void> {
  const registration = await getSWRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;

  await subscription.unsubscribe();

  try {
    const { api } = await import("./api");
    await api.unsubscribePush(endpoint);
  } catch (err) {
    console.error("Failed to unregister push subscription from backend", err);
  }
}

// ─── VAPID Key Helpers ──────────────────────────────────

/**
 * Convert a URL-safe base64 string to a Uint8Array (required by pushManager.subscribe).
 * Adapted from the Web Push standard conversion function.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
