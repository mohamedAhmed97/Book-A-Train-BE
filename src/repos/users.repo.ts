import type { Role } from "@prisma/client";
import type { DBClient } from "./types";

export const usersRepo = {
  findByEmail(db: DBClient, email: string) {
    return db.user.findUnique({ where: { email } });
  },

  findByEmailWithAthlete(db: DBClient, email: string) {
    return db.user.findUnique({
      where: { email },
      include: { athleteProfile: true },
    });
  },

  findById(db: DBClient, id: string) {
    return db.user.findUnique({ where: { id } });
  },

  findByIdWithProfiles(db: DBClient, id: string) {
    return db.user.findUnique({
      where: { id },
      include: { athleteProfile: true, coachProfile: true },
    });
  },

  findNameById(db: DBClient, id: string) {
    return db.user.findUnique({ where: { id }, select: { name: true } });
  },

  create(
    db: DBClient,
    args: {
      name: string;
      email: string;
      passwordHash: string;
      role: Role;
      sport?: string | undefined;
    },
  ) {
    return db.user.create({
      data: {
        name: args.name,
        email: args.email,
        passwordHash: args.passwordHash,
        role: args.role,
        ...(args.role === "ATHLETE"
          ? { athleteProfile: { create: { sport: args.sport } } }
          : { coachProfile: { create: { sport: args.sport, athleteLimit: 5 } } }),
      },
    });
  },

  updateBasics(
    db: DBClient,
    id: string,
    args: { name?: string; phone?: string; avatar?: string },
  ) {
    return db.user.update({
      where: { id },
      data: {
        ...(args.name !== undefined && { name: args.name }),
        ...(args.phone !== undefined && { phone: args.phone }),
        ...(args.avatar !== undefined && { avatar: args.avatar }),
      },
    });
  },
};
