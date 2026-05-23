import { Router } from "express";
import { db } from "../lib/db";
import { notificationsRepo } from "../repos";
import { authenticate, type AuthRequest } from "../middleware/auth";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  res.json(await notificationsRepo.listForUser(db, userId));
});

notificationsRouter.get("/unread-count", async (req, res) => {
  const { userId } = req as AuthRequest;
  const count = await notificationsRepo.unreadCount(db, userId);
  res.json({ count });
});

notificationsRouter.patch("/read-all", async (req, res) => {
  const { userId } = req as AuthRequest;
  await notificationsRepo.markAllRead(db, userId);
  res.json({ success: true });
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const notification = await notificationsRepo.findByIdForUser(db, req.params["id"]!, userId);
  if (!notification) { res.status(404).json({ error: "Notification not found" }); return; }
  const updated = await notificationsRepo.markRead(db, req.params["id"]!);
  res.json(updated);
});
