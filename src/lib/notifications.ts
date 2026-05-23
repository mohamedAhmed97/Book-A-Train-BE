import { db } from "./db";
import { Prisma, type NotificationType } from "@prisma/client";

type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

export async function createNotification(input: NotificationInput) {
  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? Prisma.JsonNull,
    },
  });
}

export async function createNotifications(inputs: NotificationInput[]) {
  if (inputs.length === 0) return { count: 0 };
  return db.notification.createMany({
    data: inputs.map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data ?? Prisma.JsonNull,
    })),
  });
}
