import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

export interface AuthRequest extends Request {
  userId: string;
  role: "COACH" | "ATHLETE";
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string; role: "COACH" | "ATHLETE" };
    (req as AuthRequest).userId = payload.userId;
    (req as AuthRequest).role = payload.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireCoach(req: Request, res: Response, next: NextFunction): void {
  if ((req as AuthRequest).role !== "COACH") {
    res.status(403).json({ error: "Only coaches can do this" });
    return;
  }
  next();
}

export function requireAthlete(req: Request, res: Response, next: NextFunction): void {
  if ((req as AuthRequest).role !== "ATHLETE") {
    res.status(403).json({ error: "Only athletes can do this" });
    return;
  }
  next();
}
