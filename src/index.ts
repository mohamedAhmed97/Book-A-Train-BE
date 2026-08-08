import "dotenv/config";
import "express-async-errors";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";
import { sessionsRouter } from "./routes/sessions";
import { exercisesRouter } from "./routes/exercises";
import { progressRouter } from "./routes/progress";
import { athletesRouter } from "./routes/athletes";
import { coachesRouter } from "./routes/coaches";
import { friendsRouter } from "./routes/friends";
import { notificationsRouter } from "./routes/notifications";
import { stravaRouter } from "./routes/strava";
import { vitalsStreamRouter } from "./routes/vitals";
import { appRouter } from "./trpc";
import { createContext } from "./trpc/context";
import { swaggerSpec } from "./swagger";

const app = express();
const PORT = process.env["PORT"] ?? 3001;
const origins = (process.env["CORS_ORIGINS"] ?? "http://localhost:3000,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3002")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser clients (curl, mobile app native fetch) which send no Origin header
    if (!origin) return callback(null, true);
    if (origins.includes(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api/progress", progressRouter);
app.use("/api/athletes", athletesRouter);
app.use("/api/coaches", coachesRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/strava", stravaRouter);
app.use("/api/vitals", vitalsStreamRouter);

app.use("/api-docs", swaggerUi.serve as unknown as RequestHandler[], swaggerUi.setup(swaggerSpec) as unknown as RequestHandler);

app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🏋️  Book-a-Train API running on http://localhost:${PORT}`);
});
