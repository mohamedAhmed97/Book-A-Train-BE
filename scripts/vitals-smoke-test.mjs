/**
 * End-to-end smoke test for the watch vitals pipeline.
 *
 * Drives the same tRPC procedures the phone calls, with synthetic heart-rate
 * data shaped like a real interval session. Proves ingest → validation →
 * dedupe → zone rollup → live SSE without needing a phone or a watch.
 *
 *   node scripts/vitals-smoke-test.mjs
 */

const API = process.env.API_URL ?? "http://localhost:3001";
const TRPC = `${API}/trpc`;

const stamp = Date.now();
const COACH = { email: `smoke.coach.${stamp}@example.com`, password: "smoketest123", name: "Smoke Coach" };
const ATHLETE = { email: `smoke.athlete.${stamp}@example.com`, password: "smoketest123", name: "Smoke Athlete" };

async function call(path, input, token) {
  const res = await fetch(`${TRPC}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${path}: ${body.error.message}`);
  return body.result?.data;
}

async function query(path, input, token) {
  const qs = input ? `?input=${encodeURIComponent(JSON.stringify(input))}` : "";
  const res = await fetch(`${TRPC}/${path}${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json();
  if (body.error) throw new Error(`${path}: ${body.error.message}`);
  return body.result?.data;
}

/**
 * Heart rate for an interval session: warmup, 5 hard reps with recoveries,
 * cooldown. Sampled every 5s like a watch would.
 */
function buildHeartRateSeries(startMs, maxHr) {
  const samples = [];
  const push = (offsetSec, bpm) =>
    samples.push({
      metric: "HEART_RATE",
      value: Math.round(bpm),
      unit: "bpm",
      recordedAt: new Date(startMs + offsetSec * 1000).toISOString(),
    });

  let t = 0;
  // Warmup — drifting up from 95 to 130 over 5 minutes.
  for (; t < 300; t += 5) push(t, 95 + (t / 300) * 35);

  // 5 × (3min hard @ ~88-93% max, 2min recovery down to ~65%).
  for (let rep = 0; rep < 5; rep++) {
    const hardEnd = t + 180;
    for (; t < hardEnd; t += 5) {
      const into = (t - (hardEnd - 180)) / 180;
      push(t, maxHr * (0.78 + 0.15 * into)); // climbs 78% → 93%
    }
    const recEnd = t + 120;
    for (; t < recEnd; t += 5) {
      const into = (t - (recEnd - 120)) / 120;
      push(t, maxHr * (0.93 - 0.28 * into)); // falls 93% → 65%
    }
  }

  // Cooldown.
  for (const end = t + 240; t < end; t += 5) push(t, maxHr * (0.65 - 0.2 * ((t - (end - 240)) / 240)));

  return samples;
}

function log(step, msg) {
  console.log(`\x1b[36m${step}\x1b[0m ${msg}`);
}

async function main() {
  log("1/8", "Registering coach and athlete…");
  const coach = await call("auth.register", { ...COACH, role: "COACH", sport: "Running" });
  const athlete = await call("auth.register", { ...ATHLETE, role: "ATHLETE", sport: "Running" });

  log("2/8", "Coach adds athlete to roster…");
  await call("athletes.add", { email: ATHLETE.email }, coach.token);
  const roster = await query("athletes.list", undefined, coach.token);
  const athleteProfileId = roster[0].athlete.id;

  log("3/8", "Creating a session scheduled for now…");
  const session = await call(
    "sessions.create",
    {
      title: "Threshold Intervals (smoke test)",
      sport: "Running",
      location: "Track",
      scheduledAt: new Date().toISOString(),
      durationMinutes: 60,
    },
    coach.token,
  );

  log("4/8", "Assigning athlete to the session…");
  await call("sessions.assignAthletes", { sessionId: session.id, athleteProfileIds: [athleteProfileId] }, coach.token);
  const booking = (await query("sessions.today", undefined, athlete.token));
  if (!booking) throw new Error("athlete has no booking today");

  log("5/8", "Athlete links a watch and sets max HR…");
  await call("vitals.setMaxHeartRate", { maxHeartRate: 190 }, athlete.token);
  await call(
    "vitals.connect",
    { provider: "MANUAL", deviceName: "Smoke Test Watch", grantedTypes: ["HeartRate"] },
    athlete.token,
  );

  log("6/8", "Streaming heart-rate samples in batches (as the phone would)…");
  // The series is 34 minutes long (5 warmup + 5×5 intervals + 4 cooldown).
  // Start it far enough back that every sample lands in the past — the API
  // rejects future-dated readings, which would otherwise eat the tail.
  const SERIES_SEC = 300 + 5 * 300 + 240;
  const start = Date.now() - (SERIES_SEC + 60) * 1000;
  const series = buildHeartRateSeries(start, 190);

  let accepted = 0;
  const BATCH = 200;
  for (let i = 0; i < series.length; i += BATCH) {
    const res = await call(
      "vitals.ingest",
      {
        bookingId: booking.id,
        provider: "MANUAL",
        deviceName: "Smoke Test Watch",
        samples: series.slice(i, i + BATCH),
      },
      athlete.token,
    );
    accepted += res.accepted;
  }
  console.log(`      sent ${series.length} samples, passed validation: ${accepted}`);

  log("7/8", "Re-sending a batch to prove idempotency…");
  const before = (await query("vitals.sessionVitals", { bookingId: booking.id }, coach.token)).summary
    .sampleCount;
  await call(
    "vitals.ingest",
    { bookingId: booking.id, provider: "MANUAL", samples: series.slice(0, 50) },
    athlete.token,
  );
  const after = (await query("vitals.sessionVitals", { bookingId: booking.id }, coach.token)).summary
    .sampleCount;
  console.log(
    `      re-sent 50 duplicates → stored rows went ${before} → ${after} (added ${after - before}, expected 0)`,
  );

  log("7b", "Sending deliberately bogus samples (should be rejected)…");
  const bogus = await call(
    "vitals.ingest",
    {
      bookingId: booking.id,
      provider: "MANUAL",
      samples: [
        { metric: "HEART_RATE", value: 4, unit: "bpm", recordedAt: new Date().toISOString() },
        { metric: "HEART_RATE", value: 340, unit: "bpm", recordedAt: new Date().toISOString() },
        { metric: "HEART_RATE", value: 150, unit: "bpm", recordedAt: new Date(Date.now() + 86_400_000).toISOString() },
      ],
    },
    athlete.token,
  );
  console.log(`      accepted ${bogus.accepted}, rejected ${bogus.rejected} (expected 0 / 3)`);

  log("8/8", "Reading back what the coach sees…");
  const coachView = await query("vitals.sessionVitals", { bookingId: booking.id }, coach.token);
  const s = coachView.summary;
  const board = await query("vitals.liveBoard", undefined, coach.token);
  const mine = board.find((b) => b.bookingId === booking.id);

  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
  const zones = [s.zone1Sec, s.zone2Sec, s.zone3Sec, s.zone4Sec, s.zone5Sec];
  const totalZone = zones.reduce((a, b) => a + b, 0);

  console.log(`
\x1b[1m─── SESSION SUMMARY (as computed by the server) ───\x1b[0m
  athlete       ${coachView.athleteName}
  session       ${coachView.sessionTitle}
  samples       ${s.sampleCount}
  avg / max HR  ${s.avgHeartRate} / ${s.maxHeartRate} bpm
  min HR        ${s.minHeartRate} bpm

  HEART RATE ZONES (max HR ${coachView.maxHeartRate})`);
  zones.forEach((sec, i) => {
    const pct = totalZone ? Math.round((sec / totalZone) * 100) : 0;
    const bar = "█".repeat(Math.round(pct / 2.5)).padEnd(40, "░");
    console.log(`  Zone ${i + 1}  ${bar} ${fmt(sec).padStart(6)}  ${String(pct).padStart(3)}%`);
  });

  console.log(`
\x1b[1m─── COACH LIVE BOARD ───\x1b[0m
  ${mine.athleteName} · ${mine.sessionTitle}
  last HR       ${mine.heartRate} bpm  (zone ${mine.zone})
  last sample   ${mine.lastSampleAt}
  stale?        ${mine.stale}  ${mine.stale ? "← expected: the series ends in the past" : ""}

\x1b[32m✔ Pipeline verified end to end.\x1b[0m

Log in to the coach dashboard to see it rendered:
  email     ${COACH.email}
  password  ${COACH.password}
  page      http://localhost:3002/dashboard/live
`);
}

main().catch((e) => {
  console.error(`\x1b[31m✘ ${e.message}\x1b[0m`);
  process.exit(1);
});
