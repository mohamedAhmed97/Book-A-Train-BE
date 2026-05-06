# Book-a-Train API

Backend REST + tRPC API for the Book-a-Train fitness coaching platform. Coaches can create sessions and manage athletes; athletes can book sessions, track workout progress, and connect with friends.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Database:** PostgreSQL via Prisma ORM
- **API:** REST + tRPC
- **Auth:** JWT + bcrypt
- **Docs:** Swagger UI

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/book_a_train` |
| `JWT_SECRET` | Secret key for signing JWTs | — |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000,http://localhost:3002` |

### Database Setup

```bash
# Push schema to the database (development)
npm run db:push

# Or run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### Running the Server

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

The API will be available at `http://localhost:3001`.

## API Overview

### REST Endpoints

| Prefix | Description |
|---|---|
| `POST /api/auth/...` | Register, login |
| `GET/PUT /api/profile/...` | User profile management |
| `GET/POST /api/sessions/...` | Session CRUD |
| `GET/POST /api/exercises/...` | Exercise management |
| `GET/POST /api/progress/...` | Workout progress tracking |
| `GET/POST /api/athletes/...` | Athlete management (coaches) |
| `GET/POST /api/coaches/...` | Coach discovery |
| `GET/POST /api/friends/...` | Friend requests & social |
| `GET/POST /api/notifications/...` | Notifications |

### tRPC

All routes are also available via tRPC at `/trpc`.

### Swagger Docs

Interactive API documentation is available at:

```
http://localhost:3001/api-docs
```

### Health Check

```
GET /health
```

## Data Model

### Roles

- **ATHLETE** — books sessions, tracks progress, connects with friends
- **COACH** — creates sessions, manages athlete roster, has a subscription tier

### Coach Subscription Tiers

| Tier | Athlete Limit |
|---|---|
| `FREE` | 5 |
| `PRO` | — |
| `ELITE` | — |

### Key Entities

- **User** — base account with role (Athlete or Coach)
- **Session** — a training session created by a coach with a schedule, sport, and max capacity
- **Exercise** — individual exercises within a session (sets/reps or duration-based)
- **SessionBooking** — an athlete's confirmed booking for a session
- **WorkoutProgress** — per-exercise completion tracking for a booking
- **Friendship** — social connections between users (pending / accepted / declined)
- **Notification** — in-app notifications for session events, friend requests, etc.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production server |
| `npm run typecheck` | Type-check without emitting |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Push schema changes to DB |
| `npm run db:migrate` | Run Prisma migrations |
