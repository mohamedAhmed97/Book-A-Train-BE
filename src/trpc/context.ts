import type { Request } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

export interface Context {
  userId: string | null;
  role: "ATHLETE" | "COACH" | null;
}

export function createContext({ req }: { req: Request }): Context {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return { userId: null, role: null };
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string; role: "ATHLETE" | "COACH" };
    return { userId: payload.userId, role: payload.role };
  } catch {
    return { userId: null, role: null };
  }
}
