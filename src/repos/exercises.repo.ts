import type { DBClient } from "./types";

type ExerciseInput = {
  name: string;
  sets?: number;
  reps?: number;
  durationSeconds?: number;
  restSeconds?: number;
  notes?: string;
  order?: number;
  wodType?: string | null;
};

export const exercisesRepo = {
  listForSession(db: DBClient, sessionId: string) {
    return db.exercise.findMany({ where: { sessionId }, orderBy: { order: "asc" } });
  },

  findById(db: DBClient, id: string) {
    return db.exercise.findUnique({ where: { id } });
  },

  findByIdForCoach(db: DBClient, id: string, coachId: string) {
    return db.exercise.findFirst({ where: { id, session: { coachId } } });
  },

  createOne(db: DBClient, sessionId: string, input: ExerciseInput) {
    return db.exercise.create({
      data: {
        sessionId,
        name: input.name,
        sets: input.sets,
        reps: input.reps,
        durationSeconds: input.durationSeconds,
        restSeconds: input.restSeconds,
        notes: input.notes,
        order: input.order ?? 0,
        wodType: input.wodType || null,
      },
    });
  },

  createMany(db: DBClient, sessionId: string, inputs: ExerciseInput[]) {
    return db.exercise.createMany({
      data: inputs.map((ex) => ({
        sessionId,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        durationSeconds: ex.durationSeconds,
        restSeconds: ex.restSeconds,
        notes: ex.notes,
        order: ex.order ?? 0,
        wodType: ex.wodType || null,
      })),
    });
  },

  update(db: DBClient, id: string, args: Partial<ExerciseInput>) {
    return db.exercise.update({ where: { id }, data: args });
  },

  delete(db: DBClient, id: string) {
    return db.exercise.delete({ where: { id } });
  },
};
