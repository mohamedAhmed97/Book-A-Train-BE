/**
 * Creates a coach, adds the given athlete to their roster, and schedules a
 * session starting now — so the athlete's Training tab shows "Start session"
 * and the coach's live board has a card to populate.
 *
 *   node scripts/setup-live-session.mjs <athlete-email>
 */

const API = process.env.API_URL ?? "http://localhost:3001";
const TRPC = `${API}/trpc`;

const athleteEmail = process.argv[2];
if (!athleteEmail) {
  console.error("usage: node scripts/setup-live-session.mjs <athlete-email>");
  process.exit(1);
}

const COACH = {
  email: `coach.live.${Date.now()}@example.com`,
  password: "coachtest123",
  name: "Live Coach",
};

async function call(path, input, token) {
  const res = await fetch(`${TRPC}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

const coach = await call("auth.register", { ...COACH, role: "COACH", sport: "Running" });
console.log("✔ coach created");

await call("athletes.add", { email: athleteEmail }, coach.token);
const roster = await query("athletes.list", undefined, coach.token);
const entry = roster.find((r) => r.athlete.user.email === athleteEmail);
if (!entry) throw new Error(`athlete ${athleteEmail} not found in roster`);
console.log(`✔ ${entry.athlete.user.name} added to roster`);

// Start it a few minutes ago so it reads as in-progress rather than upcoming.
const session = await call(
  "sessions.create",
  {
    title: "Watch Test Session",
    sport: "Running",
    location: "Anywhere",
    scheduledAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    durationMinutes: 90,
  },
  coach.token,
);
console.log("✔ session created");

await call(
  "sessions.assignAthletes",
  { sessionId: session.id, athleteProfileIds: [entry.athlete.id] },
  coach.token,
);
console.log("✔ athlete assigned\n");

console.log(`Athlete app  → Training tab should now show "Watch Test Session" with a Start button`);
console.log(`Coach login  → ${COACH.email} / ${COACH.password}`);
console.log(`Live board   → http://localhost:3002/dashboard/live`);
