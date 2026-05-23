import { z } from "zod";
import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { friendsRepo, notificationsRepo, usersRepo } from "../../repos";
import { router, protectedProcedure } from "../init";

export const friendsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return friendsRepo.listAccepted(db, ctx.userId);
  }),

  pending: protectedProcedure.query(async ({ ctx }) => {
    return friendsRepo.listPendingFor(db, ctx.userId);
  }),

  feed: protectedProcedure.query(async ({ ctx }) => {
    return friendsRepo.feedFor(db, ctx.userId);
  }),

  respond: protectedProcedure
    .input(z.object({ friendshipId: z.string(), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const friendship = await friendsRepo.findPendingByIdForAddressee(db, input.friendshipId, ctx.userId);
      if (!friendship) throw new TRPCError({ code: "NOT_FOUND", message: "Friend request not found" });
      const updated = await friendsRepo.setStatus(db, input.friendshipId, input.accept ? "ACCEPTED" : "DECLINED");
      if (input.accept) {
        const me = await usersRepo.findNameById(db, ctx.userId);
        await notificationsRepo.createOne(db, {
          userId: friendship.requesterId,
          type: "FRIEND_ACCEPTED",
          title: "Friend Request Accepted",
          body: `${me?.name ?? "Someone"} accepted your friend request`,
          data: { friendshipId: friendship.id, byUserId: ctx.userId },
        });
      }
      return updated;
    }),

  send: protectedProcedure
    .input(z.object({ addresseeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.addresseeId === ctx.userId)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot friend yourself" });
      const existing = await friendsRepo.findBetween(db, ctx.userId, input.addresseeId);
      if (existing)
        throw new TRPCError({ code: "CONFLICT", message: "Friend request already exists" });
      const friendship = await friendsRepo.create(db, ctx.userId, input.addresseeId);
      const me = await usersRepo.findNameById(db, ctx.userId);
      await notificationsRepo.createOne(db, {
        userId: input.addresseeId,
        type: "FRIEND_REQUEST",
        title: "New Friend Request",
        body: `${me?.name ?? "Someone"} sent you a friend request`,
        data: { friendshipId: friendship.id, fromUserId: ctx.userId },
      });
      return friendship;
    }),
});
