/**
 * Thin wrapper over the Expo Push API.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * No auth needed for unlimited free tier as of this writing — we just POST
 * a JSON array to /--/api/v2/push/send. Expo handles APNs + FCM delivery.
 *
 * The send is fire-and-forget from the caller's perspective: the BE writes
 * the notification row first (so the in-app list is authoritative) and then
 * tries to dispatch a push as a side-effect. A failed push never blocks the
 * mutation.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN_PREFIX = "ExponentPushToken[";

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
};

type Ticket =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message: string;
      details?: { error?: string; expoPushToken?: string };
    };

export type SendResult = { tickets: Ticket[]; invalidTokens: string[] };

export function isExpoPushToken(token: string): boolean {
  return token.startsWith(EXPO_TOKEN_PREFIX) && token.endsWith("]");
}

/**
 * Send a batch of push messages. Drops any with invalid token format up
 * front. Returns the parsed tickets plus the list of tokens Expo rejected
 * with DeviceNotRegistered (so the caller can prune them from the DB).
 */
export async function sendExpoPush(messages: PushMessage[]): Promise<SendResult> {
  const valid = messages.filter((m) => isExpoPushToken(m.to));
  if (valid.length === 0) return { tickets: [], invalidTokens: [] };

  let tickets: Ticket[] = [];
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify(valid.map((m) => ({ sound: "default", priority: "high", ...m }))),
    });
    if (!res.ok) {
      console.error(`[expoPush] HTTP ${res.status}: ${await res.text()}`);
      return { tickets: [], invalidTokens: [] };
    }
    const json = (await res.json()) as { data?: Ticket[] };
    tickets = json.data ?? [];
  } catch (err) {
    console.error("[expoPush] dispatch failed", err);
    return { tickets: [], invalidTokens: [] };
  }

  const invalidTokens: string[] = [];
  tickets.forEach((t, i) => {
    if (t.status === "error" && t.details?.error === "DeviceNotRegistered") {
      const tok = valid[i]?.to;
      if (tok) invalidTokens.push(tok);
    }
  });

  return { tickets, invalidTokens };
}
