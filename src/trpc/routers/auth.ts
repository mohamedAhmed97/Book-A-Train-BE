import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "../../lib/db";
import { usersRepo } from "../../repos";
import { router, publicProcedure } from "../init";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const user = await usersRepo.findByEmail(db, input.email);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } };
    }),

  register: publicProcedure
    .input(z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(["ATHLETE", "COACH"]),
      sport: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const existing = await usersRepo.findByEmail(db, input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });
      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await usersRepo.create(db, {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        sport: input.sport,
      });
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } };
    }),
});
