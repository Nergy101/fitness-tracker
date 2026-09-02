// Push notification subscription types and methods.

import { fetchJSON } from "./client";

export interface PushSubscriptionInfo {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const notificationsApi = {
  subscribePush: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    fetchJSON<{ status: string }>("/api/v1/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    }),
  unsubscribePush: (endpoint: string) =>
    fetchJSON<{ status: string }>(
      `/api/v1/notifications/subscribe?endpoint=${encodeURIComponent(endpoint)}`,
      { method: "DELETE" },
    ),
  sendTestNotification: () =>
    fetchJSON<{ status: string; sent: number }>("/api/v1/notifications/send", {
      method: "POST",
    }),
};
