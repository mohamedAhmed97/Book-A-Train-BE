import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";

export const friendsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: ctx.userId }, { addresseeId: ctx.userId }],
      },
      include: {
        requester: { select: { id: true, name: true, role: true, avatar: true } },
        addressee: { select: { id: true, name: true, role: true, avatar: true } },
      },
    });
  }),

  pending: protectedProcedure.query(async ({ ctx }) => {
    return db.friendship.findMany({
      where: { addresseeId: ctx.userId, status: "PENDING" },
      include: {
        requester: { select: { id: true, name: true, role: true, avatar: true } },
      },
    });
  }),

  feed: protectedProcedure.query(async ({ ctx }) => {
    const friendships = await db.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: ctx.userId }, { addresseeId: ctx.userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    const friendIds = friendships.map((f: { requesterId: string; addresseeId: string }) =>
      f.requesterId === ctx.userId ? f.addresseeId : f.requesterId
    );
    if (friendIds.length === 0) return [];
    return db.workoutProgress.findMany({
      where: { completed: true, booking: { athlete: { userId: { in: friendIds } } } },
      include: {
        booking: {
          include: {
            athlete: { include: { user: { select: { name: true } } } },
            session: { select: { sport: true, title: true } },
          },
        },
        exercise: { select: { name: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    });
  }),

  respond: protectedProcedure
    .input(z.object({ friendshipId: z.string(), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const friendship = await db.friendship.findFirst({
        where: { id: input.friendshipId, addresseeId: ctx.userId, status: "PENDING" },
      });
      if (!friendship) throw new TRPCError({ code: "NOT_FOUND", message: "Friend request not found" });
      const updated = await db.friendship.update({
        where: { id: input.friendshipId },
        data: { status: input.accept ? "ACCEPTED" : "DECLINED" },
      });
      if (input.accept) {
        await db.notification.create({
          data: {
            userId: friendship.requesterId,
            type: "FRIEND_ACCEPTED",
            title: "Friend Request Accepted",
            body: "Your friend request was accepted",
            data: { friendshipId: friendship.id, byUserId: ctx.userId },
          },
        });
      }
      return updated;
    }),

  send: protectedProcedure
    .input(z.object({ addresseeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.addresseeId === ctx.userId)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot friend yourself" });
      const existing = await db.friendship.findFirst({
        where: {
          OR: [
            { requesterId: ctx.userId, addresseeId: input.addresseeId },
            { requesterId: input.addresseeId, addresseeId: ctx.userId },
          ],
        },
      });
      if (existing)
        throw new TRPCError({ code: "CONFLICT", message: "Friend request already exists" });
      const friendship = await db.friendship.create({
        data: { requesterId: ctx.userId, addresseeId: input.addresseeId },
      });
      await db.notification.create({
        data: {
          userId: input.addresseeId,
          type: "FRIEND_REQUEST",
          title: "New Friend Request",
          body: "Someone sent you a friend request",
          data: { friendshipId: friendship.id, fromUserId: ctx.userId },
        },
      });
      return friendship;
    }),
});
