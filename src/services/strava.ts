const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_BASE = "https://www.strava.com/api/v3";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not configured`);
  return v;
}

export function isConfigured(): boolean {
  return !!(process.env["STRAVA_CLIENT_ID"] && process.env["STRAVA_CLIENT_SECRET"]);
}

export function getAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "auto",
    scope: "activity:write,read",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava auth failed: ${body}`);
  }
  const data = (await res.json()) as any;
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: new Date((data.expires_at as number) * 1000),
    stravaAthleteId: String(data.athlete?.id ?? ""),
    scope: (data.scope as string) ?? "",
  };
}

export async function refreshTokens(refreshToken: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error("Strava token refresh failed");
  const data = (await res.json()) as any;
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: new Date((data.expires_at as number) * 1000),
  };
}

const SPORT_TYPE: Record<string, string> = {
  Running: "Run",
  Cycling: "Ride",
  Swimming: "Swim",
  Football: "Soccer",
  Basketball: "Basketball",
  Tennis: "Tennis",
  Weightlifting: "WeightTraining",
  Yoga: "Yoga",
};

export async function createActivity(
  accessToken: string,
  data: {
    name: string;
    sport: string;
    startDate: Date;
    elapsedSec: number;
    distanceM?: number;
    description?: string;
    calories?: number;
  },
): Promise<string> {
  const res = await fetch(`${API_BASE}/activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: data.name,
      sport_type: SPORT_TYPE[data.sport] ?? "Workout",
      start_date_local: data.startDate.toISOString(),
      elapsed_time: Math.round(data.elapsedSec),
      description: data.description ?? "",
      distance: data.distanceM ?? 0,
      ...(data.calories != null ? { calories: data.calories } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava create activity failed: ${body}`);
  }
  const activity = (await res.json()) as any;
  return String(activity.id);
}
