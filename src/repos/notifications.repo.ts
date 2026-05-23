import { Prisma, type NotificationType } from "@prisma/client";
import type { DBClient } from "./types";

type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

export const notificationsRepo = {
  listForUser(db: DBClient, userId: string, take = 50) {
    return db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  unreadCount(db: DBClient, userId: string) {
    return db.notification.count({ where: { userId, read: false } });
  },

  findByIdForUser(db: DBClient, id: string, userId: string) {
    return db.notification.findFirst({ where: { id, userId } });
  },

  markRead(db: DBClient, id: string) {
    return db.notification.update({ where: { id }, data: { read: true } });
  },

  markAllRead(db: DBClient, userId: string) {
    return db.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  },

  createOne(db: DBClient, input: NotificationInput) {
    return db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? Prisma.JsonNull,
      },
    });
  },

  createMany(db: DBClient, inputs: NotificationInput[]) {
    if (inputs.length === 0) return Promise.resolve({ count: 0 });
    return db.notification.createMany({
      data: inputs.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data ?? Prisma.JsonNull,
      })),
    });
  },
};
