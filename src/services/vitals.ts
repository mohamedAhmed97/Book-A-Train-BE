import { EventEmitter } from "node:events";
import { db } from "../lib/db";
import { vitalsRepo, type MetricAggregateInput } from "../repos";
import { metricMeta } from "./metricCatalog";

/** Used when the athlete hasn't recorded a max HR (no birth date on file). */
export const DEFAULT_MAX_HR = 190;

/**
 * Upper bound, as a fraction of max HR, for zones 1–4. Anything above zone 4's
 * ceiling is zone 5.
 */
const ZONE_CEILINGS = [0.6, 0.7, 0.8, 0.9] as const;

/**
 * A single sample is credited with the time until the next sample. Watches go
 * quiet when they lose skin contact, so gaps longer than this are treated as
 * "not wearing it" and contribute nothing rather than inflating a zone.
 */
const MAX_GAP_SEC = 60;

export function zoneForHeartRate(bpm: number, maxHr: number): 1 | 2 | 3 | 4 | 5 {
  const pct = bpm / (maxHr > 0 ? maxHr : DEFAULT_MAX_HR);
  for (let i = 0; i < ZONE_CEILINGS.length; i++) {
    if (pct < ZONE_CEILINGS[i]!) return (i + 1) as 1 | 2 | 3 | 4 | 5;
  }
  return 5;
}

export interface TimedValue {
  value: number;
  recordedAt: Date;
}

/** Seconds spent in each HR zone, keyed 1–5. */
export function computeZoneSeconds(
  samples: TimedValue[],
  maxHr: number,
): Record<1 | 2 | 3 | 4 | 5, number> {
  const zones: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (samples.length === 0) return zones;

  const sorted = [...samples].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1];
    // The last sample gets a nominal 1s rather than being dropped entirely.
    const rawGapSec = next
      ? (next.recordedAt.getTime() - current.recordedAt.getTime()) / 1000
      : 1;
    if (rawGapSec <= 0) continue;
    const gapSec = Math.min(rawGapSec, MAX_GAP_SEC);
    zones[zoneForHeartRate(current.value, maxHr)] += gapSec;
  }

  return zones;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value: number | null, digits = 1): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Every aggregate for one metric. Computed for whatever metrics the session
 * captured, so a record type this code has never heard of still reaches the
 * coach with a usable rollup.
 */
function aggregatesFor(
  metric: string,
  samples: Array<{ value: number; unit: string }>,
): MetricAggregateInput {
  const values = samples.map((s) => s.value);
  const total = values.reduce((sum, v) => sum + v, 0);
  return {
    metric,
    // Samples of one metric always carry the same unit; take it off the first.
    unit: samples[0]?.unit ?? metricMeta(metric).unit,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: total / values.length,
    sum: total,
    last: values[values.length - 1]!,
    count: values.length,
  };
}

/**
 * Recompute the rolled-up summary for one booking from its stored samples.
 * Cheap enough to run on every ingest batch (a session is a few thousand rows
 * at most), which keeps the coach dashboard read path to a single row.
 *
 * Writes two things: the HR-specific headline row (zones, avg/max/min HR) that
 * the athlete and coach screens already read, and a generic rollup per metric
 * covering everything else the watch produced.
 */
export async function recomputeSessionSummary(bookingId: string, maxHr: number) {
  const samples = await vitalsRepo.listSamplesForBooking(db, bookingId);
  if (samples.length === 0) return null;

  const byMetric = new Map<string, typeof samples>();
  for (const sample of samples) {
    const bucket = byMetric.get(sample.metric);
    if (bucket) bucket.push(sample);
    else byMetric.set(sample.metric, [sample]);
  }

  // Samples arrive ordered oldest-first, so `last` is genuinely the latest.
  await vitalsRepo.replaceMetricSummaries(
    db,
    bookingId,
    [...byMetric.entries()].map(([metric, rows]) => aggregatesFor(metric, rows)),
  );

  const valuesOf = (metric: string) => (byMetric.get(metric) ?? []).map((s) => s.value);

  const hr = valuesOf("HEART_RATE");
  const spo2 = valuesOf("SPO2");
  const zones = computeZoneSeconds(byMetric.get("HEART_RATE") ?? [], maxHr);

  // Watches report calories/steps/distance as cumulative-per-interval records,
  // so the session total is the sum of the samples inside the window.
  const sum = (metric: string) => {
    const values = valuesOf(metric);
    return values.length ? values.reduce((total, v) => total + v, 0) : null;
  };
  const totalCalories = sum("CALORIES");
  const totalSteps = sum("STEPS");
  const totalDistanceM = sum("DISTANCE");

  return vitalsRepo.upsertSummary(db, bookingId, {
    avgHeartRate: hr.length ? Math.round(avg(hr)!) : null,
    maxHeartRate: hr.length ? Math.round(Math.max(...hr)) : null,
    minHeartRate: hr.length ? Math.round(Math.min(...hr)) : null,
    zone1Sec: Math.round(zones[1]),
    zone2Sec: Math.round(zones[2]),
    zone3Sec: Math.round(zones[3]),
    zone4Sec: Math.round(zones[4]),
    zone5Sec: Math.round(zones[5]),
    avgHrvMs: round(avg(valuesOf("HRV"))),
    avgSpo2: round(avg(spo2)),
    minSpo2: spo2.length ? Math.min(...spo2) : null,
    avgRespiratoryRate: round(avg(valuesOf("RESPIRATORY_RATE"))),
    avgSkinTempC: round(avg(valuesOf("SKIN_TEMPERATURE"))),
    totalCalories: totalCalories !== null ? Math.round(totalCalories) : null,
    totalSteps: totalSteps !== null ? Math.round(totalSteps) : null,
    totalDistanceM: round(totalDistanceM),
    sampleCount: samples.length,
    computedAt: new Date(),
  });
}

// ── Live bus ───────────────────────────────────────────────────────────────
//
// In-process pub/sub feeding the coach SSE stream. This is deliberately simple
// because the API runs as a single instance (see docker-compose.yml). If the
// API is ever scaled horizontally, swap this for Redis pub/sub — the publish
// and subscribe call sites stay the same.

export interface LiveVitalsEvent {
  bookingId: string;
  athleteId: string;
  athleteName?: string;
  samples: Array<{
    metric: string;
    value: number;
    unit: string;
    recordedAt: string;
  }>;
  /** Latest known HR zone, so the dashboard doesn't recompute it per event. */
  zone: number | null;
  at: string;
}

const bus = new EventEmitter();
// One listener per coach browser tab watching a booking; the default cap of 10
// is far too low for a gym with several coaches on the live board.
bus.setMaxListeners(0);

const channel = (bookingId: string) => `vitals:${bookingId}`;

export function publishLiveVitals(event: LiveVitalsEvent) {
  bus.emit(channel(event.bookingId), event);
}

export function subscribeLiveVitals(
  bookingId: string,
  listener: (event: LiveVitalsEvent) => void,
): () => void {
  bus.on(channel(bookingId), listener);
  return () => bus.off(channel(bookingId), listener);
}
