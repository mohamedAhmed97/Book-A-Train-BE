import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { router, athleteProcedure } from "../init";

export const coachesRouter = router({
  mine: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await db.athleteProfile.findUnique({ where: { userId: ctx.userId } });
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
    return db.coachAthlete.findMany({
      where: { athleteId: athlete.id },
      include: {
        coach: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });
  }),
});
