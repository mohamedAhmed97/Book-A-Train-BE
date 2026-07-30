import type { DBClient } from "./types";

export const integrationsRepo = {
  findStravaByAthleteId(db: DBClient, athleteId: string) {
    return db.stravaIntegration.findUnique({ where: { athleteId } });
  },

  upsertStrava(
    db: DBClient,
    data: {
      athleteId: string;
      stravaAthleteId: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
      scope: string;
    },
  ) {
    return db.stravaIntegration.upsert({
      where: { athleteId: data.athleteId },
      create: data,
      update: {
        stravaAthleteId: data.stravaAthleteId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        scope: data.scope,
      },
    });
  },

  updateStravaTokens(
    db: DBClient,
    athleteId: string,
    data: { accessToken: string; refreshToken: string; expiresAt: Date },
  ) {
    return db.stravaIntegration.update({ where: { athleteId }, data });
  },

  deleteStrava(db: DBClient, athleteId: string) {
    return db.stravaIntegration.delete({ where: { athleteId } });
  },
};
