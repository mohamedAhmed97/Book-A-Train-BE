import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  return next({ ctx: { userId: ctx.userId, role: ctx.role! } });
});

export const coachProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.role !== "COACH") throw new TRPCError({ code: "FORBIDDEN", message: "Coach access required" });
  return next({ ctx: { userId: ctx.userId, role: ctx.role } });
});

export const athleteProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.role !== "ATHLETE") throw new TRPCError({ code: "FORBIDDEN", message: "Athlete access required" });
  return next({ ctx: { userId: ctx.userId, role: ctx.role } });
});
