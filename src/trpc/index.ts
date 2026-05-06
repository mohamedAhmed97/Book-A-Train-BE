import { router } from "./init";
import { authRouter } from "./routers/auth";
import { profileRouter } from "./routers/profile";
import { sessionsRouter } from "./routers/sessions";
import { athletesRouter } from "./routers/athletes";
import { exercisesRouter } from "./routers/exercises";
import { notificationsRouter } from "./routers/notifications";
import { progressRouter } from "./routers/progress";
import { coachesRouter } from "./routers/coaches";
import { friendsRouter } from "./routers/friends";

export const appRouter = router({
  auth: authRouter,
  profile: profileRouter,
  sessions: sessionsRouter,
  athletes: athletesRouter,
  exercises: exercisesRouter,
  notifications: notificationsRouter,
  progress: progressRouter,
  coaches: coachesRouter,
  friends: friendsRouter,
});

export type AppRouter = typeof appRouter;
