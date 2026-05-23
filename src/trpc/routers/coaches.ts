import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { athletesRepo, coachAthletesRepo } from "../../repos";
import { router, athleteProcedure } from "../init";

export const coachesRouter = router({
  mine: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await athletesRepo.findByUserId(db, ctx.userId);
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete profile not found" });
    return coachAthletesRepo.listForAthlete(db, athlete.id);
  }),
});
