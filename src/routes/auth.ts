import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../lib/db";
import { authenticate, type AuthRequest } from "../middleware/auth";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["ATHLETE", "COACH"]),
    sport: z.string().optional(),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors.map((e) => e.message).join(", ") });
    return;
  }

  const { name, email, password, role, sport } = result.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      ...(role === "ATHLETE"
        ? { athleteProfile: { create: { sport } } }
        : { coachProfile: { create: { sport, athleteLimit: 5 } } }),
    },
  });

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
});

authRouter.post("/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string() });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password } = result.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
});

authRouter.get("/me", authenticate, async (req, res) => {
  const { userId } = req as AuthRequest;
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { athleteProfile: true, coachProfile: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { passwordHash: _, ...safe } = user;
  res.json(safe);
});
