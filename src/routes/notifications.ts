import { Router } from "express";
import { db } from "../lib/db";
import { authenticate, type AuthRequest } from "../middleware/auth";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// GET /api/notifications
notificationsRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
});

// GET /api/notifications/unread-count
notificationsRouter.get("/unread-count", async (req, res) => {
  const { userId } = req as AuthRequest;
  const count = await db.notification.count({ where: { userId, read: false } });
  res.json({ count });
});

// PATCH /api/notifications/read-all
notificationsRouter.patch("/read-all", async (req, res) => {
  const { userId } = req as AuthRequest;
  await db.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  res.json({ success: true });
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch("/:id/read", async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const notification = await db.notification.findFirst({ where: { id: req.params["id"], userId } });
  if (!notification) { res.status(404).json({ error: "Notification not found" }); return; }

  const updated = await db.notification.update({ where: { id: req.params["id"] }, data: { read: true } });
  res.json(updated);
});
