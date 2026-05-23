import type { Prisma, NotificationType } from "@prisma/client";
import { db } from "../lib/db";
import { sendExpoPush, type PushMessage } from "../lib/expoPush";
import { notificationsRepo, pushTokensRepo } from "../repos";

type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

/**
 * Writes notification row(s) AND dispatches a push to every device the
 * recipient(s) have registered. Push failures are logged but never thrown —
 * the in-app row is the source of truth.
 *
 * Use this instead of calling notificationsRepo.createOne/createMany in any
 * place where the user should be alerted on a backgrounded device.
 */
export async function dispatchNotification(input: NotificationInput) {
  const row = await notificationsRepo.createOne(db, input);
  const tokens = await pushTokensRepo.listForUser(db, input.userId);
  if (tokens.length === 0) return row;

  const messages: PushMessage[] = tokens.map((t: { token: string }) => ({
    to: t.token,
    title: input.title,
    body: input.body,
    data: { type: input.type, notificationId: row.id, ...(input.data as object) },
  }));
  const { invalidTokens } = await sendExpoPush(messages);
  if (invalidTokens.length > 0) {
    await pushTokensRepo.removeManyByToken(db, invalidTokens).catch(() => {});
  }
  return row;
}

export async function dispatchNotifications(inputs: NotificationInput[]) {
  if (inputs.length === 0) return { count: 0 };
  const result = await notificationsRepo.createMany(db, inputs);

  const userIds = Array.from(new Set(inputs.map((i) => i.userId)));
  const tokens = await pushTokensRepo.listForUsers(db, userIds);
  if (tokens.length === 0) return result;

  // Group tokens by userId so we can build per-user push messages
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens) {
    const arr = tokensByUser.get(t.userId) ?? [];
    arr.push(t.token);
    tokensByUser.set(t.userId, arr);
  }

  const messages: PushMessage[] = [];
  for (const input of inputs) {
    const userTokens = tokensByUser.get(input.userId) ?? [];
    for (const tok of userTokens) {
      messages.push({
        to: tok,
        title: input.title,
        body: input.body,
        data: { type: input.type, ...(input.data as object) },
      });
    }
  }

  const { invalidTokens } = await sendExpoPush(messages);
  if (invalidTokens.length > 0) {
    await pushTokensRepo.removeManyByToken(db, invalidTokens).catch(() => {});
  }
  return result;
}
