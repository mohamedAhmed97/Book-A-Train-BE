import type { DBClient } from "./types";

export const pushTokensRepo = {
  /**
   * Upserts a push token. The same physical device sometimes returns a new
   * token on app reinstall; if the token already exists we move it to the
   * current user.
   */
  upsert(db: DBClient, args: { userId: string; token: string; platform?: string }) {
    return db.pushToken.upsert({
      where: { token: args.token },
      create: { userId: args.userId, token: args.token, platform: args.platform },
      update: { userId: args.userId, platform: args.platform },
    });
  },

  removeByToken(db: DBClient, token: string) {
    return db.pushToken.deleteMany({ where: { token } });
  },

  removeManyByToken(db: DBClient, tokens: string[]) {
    if (tokens.length === 0) return Promise.resolve({ count: 0 });
    return db.pushToken.deleteMany({ where: { token: { in: tokens } } });
  },

  listForUser(db: DBClient, userId: string) {
    return db.pushToken.findMany({ where: { userId }, select: { token: true } });
  },

  listForUsers(db: DBClient, userIds: string[]) {
    if (userIds.length === 0) return Promise.resolve([] as { userId: string; token: string }[]);
    return db.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, token: true },
    });
  },
};
