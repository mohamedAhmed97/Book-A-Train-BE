import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import { friendsRepo, usersRepo } from "../repos";
import { dispatchNotification } from "../services/notifications.service";
import { authenticate, type AuthRequest } from "../middleware/auth";

export const friendsRouter = Router();
friendsRouter.use(authenticate);

friendsRouter.post("/request", async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({ addresseeId: z.string() });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }

  if (result.data.addresseeId === userId) {
    res.status(400).json({ error: "Cannot friend yourself" });
    return;
  }

  const existing = await friendsRepo.findBetween(db, userId, result.data.addresseeId);
  if (existing) { res.status(409).json({ error: "Friend request already exists" }); return; }

  const friendship = await friendsRepo.create(db, userId, result.data.addresseeId);
  const me = await usersRepo.findNameById(db, userId);
  await dispatchNotification({
    userId: result.data.addresseeId,
    type: "FRIEND_REQUEST",
    title: "New Friend Request",
    body: `${me?.name ?? "Someone"} sent you a friend request`,
    data: { friendshipId: friendship.id, fromUserId: userId },
  });

  res.status(201).json(friendship);
});

friendsRouter.patch("/:id/respond", async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const schema = z.object({ accept: z.boolean() });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const friendship = await friendsRepo.findPendingByIdForAddressee(db, req.params["id"]!, userId);
  if (!friendship) { res.status(404).json({ error: "Friend request not found" }); return; }

  const updated = await friendsRepo.setStatus(db, req.params["id"]!, result.data.accept ? "ACCEPTED" : "DECLINED");

  if (result.data.accept) {
    const me = await usersRepo.findNameById(db, userId);
    await dispatchNotification({
      userId: friendship.requesterId,
      type: "FRIEND_ACCEPTED",
      title: "Friend Request Accepted",
      body: `${me?.name ?? "Someone"} accepted your friend request`,
      data: { friendshipId: friendship.id, byUserId: userId },
    });
  }

  res.json(updated);
});

friendsRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;
  res.json(await friendsRepo.listAccepted(db, userId));
});

friendsRouter.get("/pending", async (req, res) => {
  const { userId } = req as AuthRequest;
  res.json(await friendsRepo.listPendingFor(db, userId));
});

friendsRouter.get("/feed", async (req, res) => {
  const { userId } = req as AuthRequest;
  res.json(await friendsRepo.feedFor(db, userId));
});
