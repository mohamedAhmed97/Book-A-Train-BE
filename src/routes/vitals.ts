import { Router } from "express";
import { db } from "../lib/db";
import { coachesRepo, athletesRepo, vitalsRepo } from "../repos";
import { verifyStreamToken } from "../services/streamToken";
import {
  DEFAULT_MAX_HR,
  subscribeLiveVitals,
  zoneForHeartRate,
  type LiveVitalsEvent,
} from "../services/vitals";

/** Named to distinguish it from the tRPC `vitalsRouter` in trpc/routers/vitals.ts. */
export const vitalsStreamRouter = Router();

/**
 * Proxies and load balancers will drop an idle SSE connection. A comment line
 * every 20s keeps it warm without emitting a real event.
 */
const HEARTBEAT_MS = 20_000;

/**
 * GET /api/vitals/live/:bookingId?token=…
 *
 * Server-sent events carrying watch samples for one booking as they arrive.
 * Used by the coach dashboard's live board; the athlete can also subscribe to
 * their own booking. Auth is the short-lived token from
 * `vitals.liveStreamToken`, because EventSource can't set headers.
 */
vitalsStreamRouter.get("/live/:bookingId", async (req, res) => {
  const bookingId = req.params["bookingId"]!;
  const token = typeof req.query["token"] === "string" ? req.query["token"] : null;

  if (!token) {
    res.status(401).json({ error: "Missing stream token" });
    return;
  }

  const payload = verifyStreamToken(token);
  // The token is scoped to one booking — a token for session A can't be
  // replayed against session B.
  if (!payload || payload.bookingId !== bookingId) {
    res.status(401).json({ error: "Invalid or expired stream token" });
    return;
  }

  const allowed = await canAccessBooking(payload.userId, bookingId);
  if (!allowed) {
    res.status(403).json({ error: "Not allowed to watch this session" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Nginx buffers proxied responses by default, which would batch up events
    // and defeat the point of streaming.
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Prime the client with current state so it renders immediately instead of
  // waiting for the athlete's next upload.
  send("snapshot", await buildSnapshot(bookingId));

  const unsubscribe = subscribeLiveVitals(bookingId, (event: LiveVitalsEvent) => {
    send("vitals", event);
  });

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on("close", cleanup);
  res.on("close", cleanup);
});

async function canAccessBooking(userId: string, bookingId: string): Promise<boolean> {
  const [coach, athlete] = await Promise.all([
    coachesRepo.findByUserId(db, userId),
    athletesRepo.findByUserId(db, userId),
  ]);

  if (coach) {
    const owned = await db.sessionBooking.findFirst({
      where: { id: bookingId, session: { coachId: coach.id } },
      select: { id: true },
    });
    if (owned) return true;
  }

  if (athlete) {
    const own = await db.sessionBooking.findFirst({
      where: { id: bookingId, athleteId: athlete.id },
      select: { id: true },
    });
    if (own) return true;
  }

  return false;
}

async function buildSnapshot(bookingId: string) {
  const booking = await db.sessionBooking.findUnique({
    where: { id: bookingId },
    include: {
      athlete: { include: { user: { select: { name: true } } } },
      session: { select: { title: true, sport: true } },
    },
  });
  if (!booking) return { bookingId, samples: [], summary: null };

  const maxHr = booking.athlete.maxHeartRate ?? DEFAULT_MAX_HR;
  // Every metric the session has captured, not a fixed list — the set is open.
  const [summary, metricSummaries, latest] = await Promise.all([
    vitalsRepo.findSummary(db, bookingId),
    vitalsRepo.listMetricSummaries(db, bookingId),
    vitalsRepo.latestPerMetricForBookings(db, [bookingId]),
  ]);
  const hr = latest.find((s) => s.metric === "HEART_RATE");

  return {
    bookingId,
    athleteName: booking.athlete.user.name,
    sessionTitle: booking.session.title,
    sport: booking.session.sport,
    maxHeartRate: maxHr,
    zone: hr ? zoneForHeartRate(hr.value, maxHr) : null,
    summary,
    metricSummaries,
    samples: latest.map((s) => ({
      metric: s.metric,
      value: s.value,
      unit: s.unit,
      recordedAt: s.recordedAt.toISOString(),
    })),
  };
}
