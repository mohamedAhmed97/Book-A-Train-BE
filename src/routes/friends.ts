import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db";
import { authenticate, type AuthRequest } from "../middleware/auth";

export const friendsRouter = Router();
friendsRouter.use(authenticate);

// POST /api/friends/request
friendsRouter.post("/request", async (req, res) => {
  const { userId } = req as AuthRequest;
  const schema = z.object({ addresseeId: z.string() });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }

  if (result.data.addresseeId === userId) {
    res.status(400).json({ error: "Cannot friend yourself" });
    return;
  }

  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: result.data.addresseeId },
        { requesterId: result.data.addresseeId, addresseeId: userId },
      ],
    },
  });
  if (existing) { res.status(409).json({ error: "Friend request already exists" }); return; }

  const friendship = await db.friendship.create({
    data: { requesterId: userId, addresseeId: result.data.addresseeId },
  });

  await db.notification.create({
    data: {
      userId: result.data.addresseeId,
      type: "FRIEND_REQUEST",
      title: "New Friend Request",
      body: "Someone sent you a friend request",
      data: { friendshipId: friendship.id, fromUserId: userId },
    },
  });

  res.status(201).json(friendship);
});

// PATCH /api/friends/:id/respond
friendsRouter.patch("/:id/respond", async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const schema = z.object({ accept: z.boolean() });

  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const friendship = await db.friendship.findFirst({
    where: { id: req.params["id"], addresseeId: userId, status: "PENDING" },
  });
  if (!friendship) { res.status(404).json({ error: "Friend request not found" }); return; }

  const updated = await db.friendship.update({
    where: { id: req.params["id"] },
    data: { status: result.data.accept ? "ACCEPTED" : "DECLINED" },
  });

  if (result.data.accept) {
    await db.notification.create({
      data: {
        userId: friendship.requesterId,
        type: "FRIEND_ACCEPTED",
        title: "Friend Request Accepted",
        body: "Your friend request was accepted",
      },
    });
  }

  res.json(updated);
});

// GET /api/friends
friendsRouter.get("/", async (req, res) => {
  const { userId } = req as AuthRequest;

  const friends = await db.friendship.findMany({
    where: {
      OR: [{ requesterId: userId }, { addresseeId: userId }],
      status: "ACCEPTED",
    },
    include: {
      requester: { select: { id: true, name: true, avatar: true, role: true } },
      addressee: { select: { id: true, name: true, avatar: true, role: true } },
    },
  });
  res.json(friends);
});

// GET /api/friends/pending
friendsRouter.get("/pending", async (req, res) => {
  const { userId } = req as AuthRequest;

  const pending = await db.friendship.findMany({
    where: { addresseeId: userId, status: "PENDING" },
    include: { requester: { select: { id: true, name: true, avatar: true, role: true } } },
  });
  res.json(pending);
});

// GET /api/friends/feed
friendsRouter.get("/feed", async (req, res) => {
  const { userId } = req as AuthRequest;

  const friendships = await db.friendship.findMany({
    where: {
      OR: [{ requesterId: userId }, { addresseeId: userId }],
      status: "ACCEPTED",
    },
    select: { requesterId: true, addresseeId: true },
  });

  const friendIds = friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));

  const feed = await db.workoutProgress.findMany({
    where: { completed: true, booking: { athlete: { userId: { in: friendIds } } } },
    include: {
      booking: {
        include: {
          athlete: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          session: { select: { title: true, sport: true, scheduledAt: true } },
        },
      },
      exercise: { select: { name: true } },
    },
    orderBy: { completedAt: "desc" },
    take: 20,
  });
  res.json(feed);
});
