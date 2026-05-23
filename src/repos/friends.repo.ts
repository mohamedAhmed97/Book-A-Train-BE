import type { DBClient } from "./types";

const userMini = { select: { id: true, name: true, role: true, avatar: true } } as const;

export const friendsRepo = {
  listAccepted(db: DBClient, userId: string) {
    return db.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: userMini,
        addressee: userMini,
      },
    });
  },

  listAcceptedIds(db: DBClient, userId: string) {
    return db.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
  },

  listPendingFor(db: DBClient, userId: string) {
    return db.friendship.findMany({
      where: { addresseeId: userId, status: "PENDING" },
      include: { requester: userMini },
    });
  },

  findBetween(db: DBClient, a: string, b: string) {
    return db.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
  },

  findPendingByIdForAddressee(db: DBClient, id: string, addresseeId: string) {
    return db.friendship.findFirst({
      where: { id, addresseeId, status: "PENDING" },
    });
  },

  create(db: DBClient, requesterId: string, addresseeId: string) {
    return db.friendship.create({ data: { requesterId, addresseeId } });
  },

  setStatus(db: DBClient, id: string, status: "ACCEPTED" | "DECLINED") {
    return db.friendship.update({ where: { id }, data: { status } });
  },

  feedFor(db: DBClient, userId: string) {
    return this.listAcceptedIds(db, userId).then((rows) => {
      const friendIds = rows.map((f: { requesterId: string; addresseeId: string }) =>
        f.requesterId === userId ? f.addresseeId : f.requesterId,
      );
      if (friendIds.length === 0) return [];
      return db.workoutProgress.findMany({
        where: { completed: true, booking: { athlete: { userId: { in: friendIds } } } },
        include: {
          booking: {
            include: {
              athlete: { include: { user: { select: { name: true, avatar: true } } } },
              session: { select: { sport: true, title: true, scheduledAt: true } },
            },
          },
          exercise: { select: { name: true } },
        },
        orderBy: { completedAt: "desc" },
        take: 20,
      });
    });
  },
};
