import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";

const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.unknown().nullable(),
  read: z.boolean(),
  createdAt: z.date(),
});

export const notificationsRouter = router({
  list: protectedProcedure
    .output(z.array(notificationSchema))
    .query(async ({ ctx }) => {
      const rows = await db.notification.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return rows.map((n: (typeof rows)[number]) => ({ ...n, data: n.data as unknown }));
    }),

  unreadCount: protectedProcedure
    .output(z.object({ count: z.number() }))
    .query(async ({ ctx }) => {
      const count = await db.notification.count({ where: { userId: ctx.userId, read: false } });
      return { count };
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(notificationSchema)
    .mutation(async ({ ctx, input }) => {
      const notification = await db.notification.findFirst({ where: { id: input.id, userId: ctx.userId } });
      if (!notification) throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      const updated = await db.notification.update({ where: { id: input.id }, data: { read: true } });
      return { ...updated, data: updated.data as unknown };
    }),

  markAllRead: protectedProcedure
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      await db.notification.updateMany({ where: { userId: ctx.userId, read: false }, data: { read: true } });
      return { success: true };
    }),
});
