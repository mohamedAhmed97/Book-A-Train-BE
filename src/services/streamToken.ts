import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

/**
 * `EventSource` can't send an Authorization header, so the SSE endpoint accepts
 * a token in the query string instead. Keeping that separate from the session
 * JWT means a leaked URL (browser history, proxy log, Referer) exposes read
 * access to one booking's vitals for ten minutes — not the whole account.
 */
export interface StreamTokenPayload {
  userId: string;
  bookingId: string;
  kind: "vitals-stream";
}

export function signStreamToken(userId: string, bookingId: string): string {
  const payload: StreamTokenPayload = { userId, bookingId, kind: "vitals-stream" };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "10m" });
}

export function verifyStreamToken(token: string): StreamTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as StreamTokenPayload;
    if (payload.kind !== "vitals-stream") return null;
    return payload;
  } catch {
    return null;
  }
}
