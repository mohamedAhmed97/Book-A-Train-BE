import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ── Workout definitions per sport ─────────────────────────────────────────────

type WorkoutDef = {
  name: string;
  sets?: number;
  reps?: number;
  durationSeconds?: number;
  restSeconds?: number;
  notes?: string;
};

const SPORT_WORKOUTS: Record<string, WorkoutDef[]> = {
  Swimming: [
    { name: "Warm-Up Swim",        sets: 2, durationSeconds: 300, restSeconds: 30,  notes: "Easy freestyle, focus on technique" },
    { name: "Freestyle Sprint",    sets: 4, durationSeconds: 60,  restSeconds: 60  },
    { name: "Butterfly Drill",     sets: 3, durationSeconds: 120, restSeconds: 45  },
    { name: "Backstroke Laps",     sets: 3, durationSeconds: 120, restSeconds: 30  },
    { name: "Breaststroke Pull",   sets: 3, durationSeconds: 90,  restSeconds: 45  },
    { name: "Kick Board Drill",    sets: 4, durationSeconds: 60,  restSeconds: 30,  notes: "Focus on kick rhythm" },
    { name: "Pull Buoy",           sets: 3, durationSeconds: 120, restSeconds: 30,  notes: "No legs, focus on pull" },
    { name: "Interval 100m",       sets: 6, durationSeconds: 90,  restSeconds: 60  },
    { name: "Endurance Set",       sets: 1, durationSeconds: 900, notes: "Steady pace, zone 2" },
    { name: "Cool Down",           sets: 1, durationSeconds: 180, notes: "Easy choice of stroke" },
  ],
  Running: [
    { name: "Dynamic Warm-Up",     sets: 1, durationSeconds: 600, notes: "High knees, butt kicks, leg swings" },
    { name: "Easy Jog",            sets: 1, durationSeconds: 600, notes: "Zone 2 pace, conversational" },
    { name: "Interval Sprints",    sets: 8, durationSeconds: 60,  restSeconds: 90,  notes: "80-90% max effort" },
    { name: "Tempo Run",           sets: 1, durationSeconds: 1200, notes: "Comfortably hard pace" },
    { name: "Hill Repeats",        sets: 6, durationSeconds: 60,  restSeconds: 120 },
    { name: "Fartlek Run",         sets: 1, durationSeconds: 1200, notes: "Alternate hard/easy segments" },
    { name: "Long Run",            sets: 1, durationSeconds: 3600, notes: "Easy conversational pace" },
    { name: "Strides",             sets: 4, durationSeconds: 20,  restSeconds: 60,  notes: "Fast but relaxed" },
    { name: "Cool Down Walk/Jog",  sets: 1, durationSeconds: 300 },
    { name: "Stretch",             sets: 1, durationSeconds: 300, notes: "Focus on calves, quads, hamstrings" },
  ],
  Cycling: [
    { name: "Warm-Up Spin",        sets: 1, durationSeconds: 600, notes: "Low resistance, high cadence" },
    { name: "Climbing Intervals",  sets: 5, durationSeconds: 180, restSeconds: 60,  notes: "High resistance, low cadence" },
    { name: "Sprint Efforts",      sets: 6, durationSeconds: 30,  restSeconds: 90,  notes: "Max effort" },
    { name: "Tempo Block",         sets: 3, durationSeconds: 600, restSeconds: 120, notes: "Zone 3-4 effort" },
    { name: "Cadence Drills",      sets: 4, durationSeconds: 120, restSeconds: 60,  notes: "90-110 RPM, low resistance" },
    { name: "Endurance Ride",      sets: 1, durationSeconds: 3600, notes: "Zone 2, steady state" },
    { name: "Over-Unders",         sets: 4, durationSeconds: 300, restSeconds: 120, notes: "Alternate above/below FTP" },
    { name: "Cool Down Spin",      sets: 1, durationSeconds: 300, notes: "Very easy, shake out legs" },
  ],
  Football: [
    { name: "Passing Drills",      sets: 3, reps: 20, restSeconds: 30,  notes: "Short & long range passes" },
    { name: "Dribbling Course",    sets: 4, durationSeconds: 60, restSeconds: 30 },
    { name: "Shooting Practice",   sets: 3, reps: 10, restSeconds: 45,  notes: "Mix of power and placement shots" },
    { name: "Heading Practice",    sets: 3, reps: 15, restSeconds: 30 },
    { name: "One-Two Combination", sets: 4, reps: 10, restSeconds: 30 },
    { name: "Sprint Shuttles",     sets: 6, durationSeconds: 20, restSeconds: 40 },
    { name: "Small-Sided Game",    sets: 2, durationSeconds: 600, restSeconds: 120, notes: "5v5 or 6v6" },
    { name: "Set Piece Practice",  sets: 3, durationSeconds: 300, restSeconds: 60,  notes: "Corners & free kicks" },
    { name: "Positional Drills",   sets: 3, durationSeconds: 120, restSeconds: 45 },
    { name: "Scrimmage",           sets: 1, durationSeconds: 1200 },
  ],
  Basketball: [
    { name: "Free Throws",         sets: 5, reps: 10, restSeconds: 30 },
    { name: "Dribbling Drills",    sets: 3, durationSeconds: 120, restSeconds: 30,  notes: "Crossovers, behind the back, between legs" },
    { name: "Jump Shots",          sets: 4, reps: 12, restSeconds: 45,  notes: "Mid-range focus" },
    { name: "3-Point Practice",    sets: 3, reps: 15, restSeconds: 45 },
    { name: "Lay-Up Lines",        sets: 3, reps: 10, restSeconds: 20 },
    { name: "Defense Slides",      sets: 3, durationSeconds: 60, restSeconds: 30,  notes: "Stay low, active hands" },
    { name: "Pick-and-Roll Drill", sets: 4, reps: 8,  restSeconds: 45 },
    { name: "Rebounding Drill",    sets: 3, reps: 10, restSeconds: 30 },
    { name: "Fast Break Drills",   sets: 4, durationSeconds: 60, restSeconds: 45 },
    { name: "Scrimmage",           sets: 2, durationSeconds: 600, restSeconds: 120 },
  ],
  Tennis: [
    { name: "Forehand Groundstrokes", sets: 4, reps: 20, restSeconds: 30 },
    { name: "Backhand Drills",        sets: 4, reps: 20, restSeconds: 30 },
    { name: "Serve Practice",         sets: 3, reps: 15, restSeconds: 45, notes: "Mix first and second serve" },
    { name: "Volley Drills",          sets: 3, reps: 20, restSeconds: 30 },
    { name: "Overhead Smash",         sets: 3, reps: 12, restSeconds: 45 },
    { name: "Footwork Ladder",        sets: 3, durationSeconds: 60, restSeconds: 30 },
    { name: "Rally Consistency",      sets: 3, durationSeconds: 120, restSeconds: 45, notes: "Keep ball in play, no errors" },
    { name: "Cross-Court Drill",      sets: 4, reps: 15, restSeconds: 30 },
    { name: "Drop Shot Practice",     sets: 3, reps: 10, restSeconds: 30 },
    { name: "Match Play",             sets: 1, durationSeconds: 1800 },
  ],
  CrossFit: [
    // Warm-up & Mobility
    { name: "CF Warm-Up",                sets: 1, durationSeconds: 600,  notes: "3 rounds: 10 air squats, 10 push-ups, 10 sit-ups, 200m jog" },
    { name: "Hip Mobility Flow",         sets: 1, durationSeconds: 300,  notes: "Hip circles, pigeon stretch, thoracic rotation" },
    { name: "Shoulder Prep",             sets: 2, durationSeconds: 180,  restSeconds: 30, notes: "Band pull-aparts, dislocates, wall slides" },
    // Gymnastics
    { name: "Pull-Ups",                  sets: 5, reps: 5,   restSeconds: 90,  notes: "Strict; scale to ring rows" },
    { name: "Kipping Pull-Ups",          sets: 4, reps: 10,  restSeconds: 60 },
    { name: "Chest-to-Bar Pull-Ups",     sets: 4, reps: 7,   restSeconds: 90 },
    { name: "Muscle-Ups",                sets: 3, reps: 3,   restSeconds: 120, notes: "Scale to jumping muscle-ups" },
    { name: "Handstand Hold",            sets: 4, durationSeconds: 30, restSeconds: 45, notes: "Wall-supported or freestanding" },
    { name: "Handstand Push-Ups",        sets: 4, reps: 8,   restSeconds: 60,  notes: "Head to abmat" },
    { name: "Toes-to-Bar",               sets: 4, reps: 10,  restSeconds: 45 },
    { name: "Knees-to-Elbows",           sets: 3, reps: 12,  restSeconds: 30 },
    { name: "Ring Dips",                 sets: 4, reps: 8,   restSeconds: 60,  notes: "Full lockout at top" },
    { name: "L-Sit Hold",                sets: 3, durationSeconds: 20, restSeconds: 40 },
    { name: "Box Jumps",                 sets: 5, reps: 10,  restSeconds: 45,  notes: "Step down, don't jump down" },
    { name: "Double-Unders",             sets: 3, reps: 50,  restSeconds: 60,  notes: "Scale to 100 single-unders" },
    // Weightlifting
    { name: "Back Squat",                sets: 5, reps: 5,   restSeconds: 180, notes: "Build to heavy 5" },
    { name: "Front Squat",               sets: 4, reps: 3,   restSeconds: 180 },
    { name: "Overhead Squat",            sets: 4, reps: 3,   restSeconds: 120, notes: "Focus on depth and stability" },
    { name: "Deadlift",                  sets: 5, reps: 3,   restSeconds: 180, notes: "Conventional, full hip extension" },
    { name: "Romanian Deadlift",         sets: 3, reps: 10,  restSeconds: 90 },
    { name: "Bench Press",               sets: 4, reps: 5,   restSeconds: 120 },
    { name: "Strict Press",              sets: 4, reps: 5,   restSeconds: 120, notes: "No leg drive" },
    { name: "Push Press",                sets: 4, reps: 5,   restSeconds: 90 },
    { name: "Push Jerk",                 sets: 4, reps: 3,   restSeconds: 120 },
    { name: "Split Jerk",                sets: 3, reps: 2,   restSeconds: 150, notes: "Focus on footwork" },
    { name: "Power Clean",               sets: 5, reps: 3,   restSeconds: 120 },
    { name: "Squat Clean",               sets: 4, reps: 2,   restSeconds: 150 },
    { name: "Clean & Jerk",              sets: 4, reps: 1,   restSeconds: 180, notes: "Build to heavy single" },
    { name: "Power Snatch",              sets: 5, reps: 3,   restSeconds: 120 },
    { name: "Squat Snatch",              sets: 4, reps: 2,   restSeconds: 150 },
    { name: "Hang Power Clean",          sets: 4, reps: 4,   restSeconds: 90 },
    { name: "Hang Snatch",               sets: 4, reps: 3,   restSeconds: 90 },
    { name: "Snatch Balance",            sets: 3, reps: 3,   restSeconds: 120 },
    // Benchmark WODs
    { name: "Fran (21-15-9)",            sets: 1, notes: "Thrusters 43kg/30kg + Pull-Ups, for time" },
    { name: "Cindy (20 min AMRAP)",      sets: 1, durationSeconds: 1200, notes: "5 Pull-Ups, 10 Push-Ups, 15 Air Squats" },
    { name: "Murph",                     sets: 1, notes: "1mi Run, 100 Pull-Ups, 200 Push-Ups, 300 Squats, 1mi Run — for time" },
    { name: "Grace (30 C&J for time)",   sets: 1, notes: "30 Clean & Jerks 60kg/43kg, for time" },
    { name: "Isabel (30 Snatches)",      sets: 1, notes: "30 Snatches 60kg/43kg, for time" },
    { name: "DT (5 Rounds)",             sets: 5, notes: "12 Deadlifts, 9 Hang Power Cleans, 6 Push Jerks @ 70kg/47kg" },
    // MetCons
    { name: "AMRAP Chipper",             sets: 1, durationSeconds: 900, notes: "Max rounds: 5 pull-ups, 10 push-ups, 15 squats, 20 sit-ups" },
    { name: "EMOM Barbell Complex",      sets: 10, durationSeconds: 60, notes: "Every minute: 3 power cleans + 3 front squats + 3 push jerks" },
    { name: "Tabata Squats",             sets: 8, durationSeconds: 20, restSeconds: 10, notes: "Max air squats per interval" },
    { name: "Death By Pull-Ups",         sets: 1, notes: "Min 1: 1 pull-up. Min 2: 2 pull-ups. Continue until failure" },
    { name: "KB Swing Intervals",        sets: 6, reps: 20, restSeconds: 30,  notes: "32kg/24kg kettlebell, American swing" },
    { name: "Wall Ball Shots",           sets: 4, reps: 25, restSeconds: 60,  notes: "9kg/6kg to 10ft/9ft target" },
    { name: "Thrusters",                 sets: 4, reps: 10, restSeconds: 90,  notes: "Front squat + push press in one motion" },
    { name: "Row for Calories",          sets: 4, durationSeconds: 60, restSeconds: 60, notes: "Max calories on rower" },
    { name: "Assault Bike Intervals",    sets: 6, durationSeconds: 30, restSeconds: 90, notes: "Max effort on Assault Bike" },
    // Cool Down
    { name: "CF Cool Down",              sets: 1, durationSeconds: 300, notes: "PVC pipe mobility, foam rolling, pigeon stretch" },
  ],
  General: [
    { name: "Warm-Up",              sets: 1, durationSeconds: 300,  notes: "Light cardio and mobility" },
    { name: "Jumping Jacks",        sets: 3, reps: 30,  restSeconds: 30 },
    { name: "Push-Ups",             sets: 3, reps: 15,  restSeconds: 45 },
    { name: "Squats",               sets: 3, reps: 20,  restSeconds: 45 },
    { name: "Lunges",               sets: 3, reps: 12,  restSeconds: 45, notes: "Each leg" },
    { name: "Plank",                sets: 3, durationSeconds: 60, restSeconds: 30 },
    { name: "Burpees",              sets: 4, reps: 10,  restSeconds: 60 },
    { name: "Mountain Climbers",    sets: 3, durationSeconds: 40, restSeconds: 20 },
    { name: "Cardio Intervals",     sets: 5, durationSeconds: 60, restSeconds: 60 },
    { name: "Cool Down Stretch",    sets: 1, durationSeconds: 300 },
  ],
};

// Normalize a free-text sport to one of our keys
function matchSport(sport: string | null | undefined): string {
  if (!sport) return "General";
  const lower = sport.toLowerCase();
  for (const key of Object.keys(SPORT_WORKOUTS)) {
    if (lower.includes(key.toLowerCase())) return key;
  }
  return "General";
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding workout templates…");

  const coaches = await db.coachProfile.findMany({
    include: { user: { select: { name: true } } },
  });

  if (coaches.length === 0) {
    console.log("   No coaches found — skipping.");
    return;
  }

  let totalCreated = 0;

  for (const coach of coaches) {
    const sportKey = matchSport(coach.sports[0]);
    const templates = SPORT_WORKOUTS[sportKey] ?? [];

    // Fetch names already in the library for this coach + sport
    const existing = await db.workoutTemplate.findMany({
      where: { coachId: coach.id, sport: sportKey },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((e) => e.name));

    const toCreate = templates.filter((t) => !existingNames.has(t.name));
    if (toCreate.length === 0) {
      console.log(`   ${coach.user.name} (${sportKey}) — already seeded, skipping.`);
      continue;
    }

    await db.workoutTemplate.createMany({
      data: toCreate.map((t) => ({ coachId: coach.id, sport: sportKey, ...t })),
    });

    console.log(`   ${coach.user.name} (${sportKey}) — created ${toCreate.length} templates.`);
    totalCreated += toCreate.length;
  }

  console.log(`\n✅  Done. Total templates created: ${totalCreated}`);
}

// ── Global fitness tests ───────────────────────────────────────────────────────

type TestDef = {
  name: string;
  description?: string;
  sport?: string;
  unit: string;
};

const GLOBAL_TESTS: TestDef[] = [
  // Cycling
  { name: "FTP Test",                sport: "Cycling",    unit: "watts",         description: "20-minute maximal effort test. FTP = 95% of average power output." },
  { name: "Ramp Test",               sport: "Cycling",    unit: "watts",         description: "Incremental ramp to exhaustion. FTP ≈ 75% of peak 1-minute power." },
  { name: "10-Minute Power Test",    sport: "Cycling",    unit: "watts",         description: "Maximum average power sustained for 10 minutes." },

  // Running
  { name: "Cooper 12-Minute Run",    sport: "Running",    unit: "meters",        description: "Run as far as possible in 12 minutes. VO₂max ≈ (distance − 504.9) / 44.73." },
  { name: "1-Mile Time Trial",       sport: "Running",    unit: "seconds",       description: "Run 1 mile at maximum effort." },
  { name: "5K Time Trial",           sport: "Running",    unit: "seconds",       description: "Race-effort 5 km run." },
  { name: "Beep Test (MSFT)",        sport: "Running",    unit: "level",         description: "Multi-stage fitness test (20 m shuttle). Record the highest level reached." },
  { name: "Yo-Yo Endurance Test",    sport: "Running",    unit: "level",         description: "Yo-Yo intermittent endurance test. Record the highest level reached." },

  // Swimming
  { name: "CSS Test (400/200)",      sport: "Swimming",   unit: "sec/100m",      description: "Critical Swim Speed = (400m time − 200m time) / 2. Lower is faster." },
  { name: "T20 Swim Test",           sport: "Swimming",   unit: "meters",        description: "Total distance covered in 20 minutes of continuous swimming." },
  { name: "400m Time Trial",         sport: "Swimming",   unit: "seconds",       description: "Maximum effort 400 m swim." },

  // Strength — 1RM
  { name: "1RM Back Squat",          sport: "CrossFit",   unit: "kg",            description: "One-rep maximum back squat." },
  { name: "1RM Deadlift",            sport: "CrossFit",   unit: "kg",            description: "One-rep maximum conventional deadlift." },
  { name: "1RM Bench Press",         sport: "CrossFit",   unit: "kg",            description: "One-rep maximum flat bench press." },
  { name: "1RM Overhead Press",      sport: "CrossFit",   unit: "kg",            description: "One-rep maximum strict overhead press." },
  { name: "1RM Clean & Jerk",        sport: "CrossFit",   unit: "kg",            description: "One-rep maximum clean & jerk." },
  { name: "1RM Snatch",              sport: "CrossFit",   unit: "kg",            description: "One-rep maximum snatch." },

  // CrossFit Benchmarks
  { name: "Fran",                    sport: "CrossFit",   unit: "seconds",       description: "21-15-9 Thrusters (43/30 kg) + Pull-Ups, for time." },
  { name: "Grace",                   sport: "CrossFit",   unit: "seconds",       description: "30 Clean & Jerks (60/43 kg), for time." },
  { name: "Isabel",                  sport: "CrossFit",   unit: "seconds",       description: "30 Snatches (60/43 kg), for time." },
  { name: "Cindy",                   sport: "CrossFit",   unit: "rounds",        description: "20-minute AMRAP: 5 Pull-Ups, 10 Push-Ups, 15 Air Squats." },
  { name: "Murph",                   sport: "CrossFit",   unit: "seconds",       description: "1 mi Run, 100 Pull-Ups, 200 Push-Ups, 300 Squats, 1 mi Run — for time." },
  { name: "DT",                      sport: "CrossFit",   unit: "seconds",       description: "5 rounds: 12 Deadlifts, 9 Hang Power Cleans, 6 Push Jerks (70/47 kg)." },

  // Football / Soccer
  { name: "40-Yard Dash",            sport: "Football",   unit: "seconds",       description: "Sprint 40 yards (36.6 m) from a standing start." },
  { name: "Illinois Agility Test",   sport: "Football",   unit: "seconds",       description: "Agility course measuring change-of-direction speed. Lower is better." },
  { name: "Yo-Yo IR1 Test",          sport: "Football",   unit: "level",         description: "Yo-Yo Intermittent Recovery Test Level 1. Record the highest level reached." },

  // Basketball
  { name: "Lane Agility Drill",      sport: "Basketball", unit: "seconds",       description: "NBA Draft Combine agility test around the paint. Lower is better." },
  { name: "3/4-Court Sprint",        sport: "Basketball", unit: "seconds",       description: "Full-effort sprint from baseline to 3/4 court line." },
  { name: "Max Vertical Jump",       sport: "Basketball", unit: "cm",            description: "Highest point reached above standing reach — box jump or Vertec." },

  // General / Multi-sport
  { name: "Max Push-Ups",            unit: "reps",        description: "Maximum push-ups completed with correct form without stopping." },
  { name: "Max Pull-Ups",            unit: "reps",        description: "Maximum strict pull-ups completed without kipping or stopping." },
  { name: "Plank Hold",              unit: "seconds",     description: "Maximum time in a forearm plank position with correct posture." },
  { name: "Sit-and-Reach",           unit: "cm",          description: "Seated hamstring/lower-back flexibility. Record distance past feet." },
];

async function seedGlobalTests() {
  console.log("\n🧪  Seeding global fitness tests…");

  const existing = await db.test.findMany({ where: { isGlobal: true }, select: { name: true } });
  const existingNames = new Set(existing.map((t) => t.name));

  const toCreate = GLOBAL_TESTS.filter((t) => !existingNames.has(t.name));
  if (toCreate.length === 0) {
    console.log("   Already seeded — skipping.");
    return;
  }

  await db.test.createMany({
    data: toCreate.map((t) => ({ ...t, isGlobal: true })),
  });

  console.log(`   Created ${toCreate.length} global tests.`);
}

main()
  .then(() => seedGlobalTests())
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
