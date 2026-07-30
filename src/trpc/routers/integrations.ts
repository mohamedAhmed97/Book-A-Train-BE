import { db } from "../../lib/db";
import { TRPCError } from "@trpc/server";
import { athletesRepo, integrationsRepo } from "../../repos";
import { router, athleteProcedure } from "../init";
import * as strava from "../../services/strava";
import jwt from "jsonwebtoken";

const SERVER_REDIRECT_URI =
  process.env["STRAVA_REDIRECT_URI"] ?? "http://localhost:3001/api/strava/callback";

export const integrationsRouter = router({
  status: athleteProcedure.query(async ({ ctx }) => {
    const athlete = await athletesRepo.findByUserId(db, ctx.userId);
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete not found" });
    const s = await integrationsRepo.findStravaByAthleteId(db, athlete.id);
    return {
      strava: {
        connected: !!s,
        stravaAthleteId: s?.stravaAthleteId ?? null,
      },
    };
  }),

  getStravaAuthUrl: athleteProcedure.query(async ({ ctx }) => {
    if (!strava.isConfigured()) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Strava is not configured on this server",
      });
    }
    const athlete = await athletesRepo.findByUserId(db, ctx.userId);
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete not found" });

    // Encode athleteId in a short-lived signed state param so the server callback
    // can identify the user without any session or cookie.
    const state = jwt.sign(
      { athleteId: athlete.id },
      process.env["JWT_SECRET"] ?? "",
      { expiresIn: "10m" },
    );
    return { url: strava.getAuthUrl(SERVER_REDIRECT_URI, state) };
  }),

  disconnectStrava: athleteProcedure.mutation(async ({ ctx }) => {
    const athlete = await athletesRepo.findByUserId(db, ctx.userId);
    if (!athlete) throw new TRPCError({ code: "NOT_FOUND", message: "Athlete not found" });
    try {
      await integrationsRepo.deleteStrava(db, athlete.id);
    } catch {
      // already disconnected — ignore
    }
    return { success: true };
  }),
});
