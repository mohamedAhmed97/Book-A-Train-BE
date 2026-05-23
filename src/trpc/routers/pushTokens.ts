import { z } from "zod";
import { db } from "../../lib/db";
import { pushTokensRepo } from "../../repos";
import { router, protectedProcedure } from "../init";

export const pushTokensRouter = router({
  register: protectedProcedure
    .input(z.object({
      token: z.string().min(10),
      platform: z.enum(["ios", "android", "web"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const row = await pushTokensRepo.upsert(db, {
        userId: ctx.userId,
        token: input.token,
        platform: input.platform,
      });
      return { id: row.id };
    }),

  unregister: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      await pushTokensRepo.removeByToken(db, input.token);
      return { success: true };
    }),
});
