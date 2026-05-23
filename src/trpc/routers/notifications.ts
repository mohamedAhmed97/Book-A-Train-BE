import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { notificationsRepo } from "../../repos";
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
      const rows = await notificationsRepo.listForUser(db, ctx.userId);
      return rows.map((n: (typeof rows)[number]) => ({ ...n, data: n.data as unknown }));
    }),

  unreadCount: protectedProcedure
    .output(z.object({ count: z.number() }))
    .query(async ({ ctx }) => {
      const count = await notificationsRepo.unreadCount(db, ctx.userId);
      return { count };
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(notificationSchema)
    .mutation(async ({ ctx, input }) => {
      const notification = await notificationsRepo.findByIdForUser(db, input.id, ctx.userId);
      if (!notification) throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      const updated = await notificationsRepo.markRead(db, input.id);
      return { ...updated, data: updated.data as unknown };
    }),

  markAllRead: protectedProcedure
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      await notificationsRepo.markAllRead(db, ctx.userId);
      return { success: true };
    }),
});
