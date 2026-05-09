export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Book-a-Train API",
    version: "0.1.0",
    description:
      "REST API for the Book-a-Train fitness coaching platform. Supports both ATHLETE and COACH roles.",
  },
  servers: [{ url: process.env["API_URL"] ?? "http://localhost:3001", description: process.env["API_URL"] ? "Production server" : "Development server" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token obtained from /api/auth/login or /api/auth/register",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      Success: {
        type: "object",
        properties: { success: { type: "boolean", example: true } },
        required: ["success"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["ATHLETE", "COACH"] },
          avatar: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AthleteProfile: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          sport: { type: "string", nullable: true },
          bio: { type: "string", nullable: true },
          goals: { type: "string", nullable: true },
        },
      },
      CoachProfile: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          sport: { type: "string", nullable: true },
          bio: { type: "string", nullable: true },
          subscriptionTier: { type: "string" },
          athleteLimit: { type: "integer" },
        },
      },
      UserWithProfile: {
        allOf: [
          { $ref: "#/components/schemas/User" },
          {
            type: "object",
            properties: {
              athleteProfile: {
                oneOf: [{ $ref: "#/components/schemas/AthleteProfile" }, { type: "null" }],
              },
              coachProfile: {
                oneOf: [{ $ref: "#/components/schemas/CoachProfile" }, { type: "null" }],
              },
            },
          },
        ],
      },
      AuthResponse: {
        type: "object",
        properties: {
          token: { type: "string", description: "JWT token (expires in 7 days)" },
          user: { $ref: "#/components/schemas/User" },
        },
        required: ["token", "user"],
      },
      Exercise: {
        type: "object",
        properties: {
          id: { type: "string" },
          sessionId: { type: "string" },
          name: { type: "string" },
          sets: { type: "integer", nullable: true },
          reps: { type: "integer", nullable: true },
          durationSeconds: { type: "integer", nullable: true },
          restSeconds: { type: "integer", nullable: true },
          notes: { type: "string", nullable: true },
          order: { type: "integer" },
        },
      },
      Session: {
        type: "object",
        properties: {
          id: { type: "string" },
          coachId: { type: "string" },
          title: { type: "string" },
          sport: { type: "string" },
          description: { type: "string", nullable: true },
          location: { type: "string", nullable: true },
          scheduledAt: { type: "string", format: "date-time" },
          durationMinutes: { type: "integer" },
          maxAthletes: { type: "integer" },
          status: {
            type: "string",
            enum: ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"],
          },
          exercises: { type: "array", items: { $ref: "#/components/schemas/Exercise" } },
        },
      },
      SessionBooking: {
        type: "object",
        properties: {
          id: { type: "string" },
          sessionId: { type: "string" },
          athleteId: { type: "string" },
          status: { type: "string", enum: ["CONFIRMED", "CANCELLED"] },
          session: { $ref: "#/components/schemas/Session" },
          progress: { type: "array", items: { $ref: "#/components/schemas/WorkoutProgress" } },
        },
      },
      WorkoutProgress: {
        type: "object",
        properties: {
          id: { type: "string" },
          bookingId: { type: "string" },
          exerciseId: { type: "string" },
          completed: { type: "boolean" },
          completedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      Friendship: {
        type: "object",
        properties: {
          id: { type: "string" },
          requesterId: { type: "string" },
          addresseeId: { type: "string" },
          status: { type: "string", enum: ["PENDING", "ACCEPTED", "DECLINED"] },
          createdAt: { type: "string", format: "date-time" },
          requester: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              avatar: { type: "string", nullable: true },
              role: { type: "string", enum: ["ATHLETE", "COACH"] },
            },
          },
          addressee: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              avatar: { type: "string", nullable: true },
              role: { type: "string", enum: ["ATHLETE", "COACH"] },
            },
          },
        },
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          type: { type: "string", enum: ["FRIEND_REQUEST", "FRIEND_ACCEPTED", "SESSION_REMINDER", "SESSION_CANCELLED"] },
          title: { type: "string" },
          body: { type: "string" },
          data: { type: "object", nullable: true },
          read: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CoachStats: {
        type: "object",
        properties: {
          athleteCount: { type: "integer" },
          sessionCount: { type: "integer" },
          upcomingCount: { type: "integer" },
          subscriptionTier: { type: "string" },
          athleteLimit: { type: "integer" },
        },
      },
      ProgressStats: {
        type: "object",
        properties: {
          totalSessions: { type: "integer" },
          completedExercises: { type: "integer" },
          thisWeekSessions: { type: "integer" },
        },
      },
    },
  },
  tags: [
    { name: "Health", description: "Server health check" },
    { name: "Auth", description: "Register, login, and get current user" },
    { name: "Profile", description: "User profile management" },
    { name: "Sessions", description: "Training session management (coach creates, athletes book)" },
    { name: "Athletes", description: "Coach: manage athlete roster" },
    { name: "Coaches", description: "Athlete: view assigned coaches" },
    { name: "Exercises", description: "Coach: manage exercises within sessions" },
    { name: "Friends", description: "Friend requests and social feed" },
    { name: "Notifications", description: "In-app notifications" },
    { name: "Progress", description: "Workout progress tracking" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── AUTH ────────────────────────────────────────────────────────────────
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "role"],
                properties: {
                  name: { type: "string", minLength: 2, example: "John Doe" },
                  email: { type: "string", format: "email", example: "john@example.com" },
                  password: { type: "string", minLength: 8, example: "password123" },
                  role: { type: "string", enum: ["ATHLETE", "COACH"] },
                  sport: { type: "string", example: "Running" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User registered successfully",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Email already in use", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "john@example.com" },
                  password: { type: "string", example: "password123" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Current user with profile",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserWithProfile" } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── PROFILE ─────────────────────────────────────────────────────────────
    "/api/profile": {
      get: {
        tags: ["Profile"],
        summary: "Get current user's profile",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "User with full profile",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserWithProfile" } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      put: {
        tags: ["Profile"],
        summary: "Update current user's profile",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 2 },
                  phone: { type: "string" },
                  avatar: { type: "string", format: "uri" },
                  sport: { type: "string" },
                  bio: { type: "string", maxLength: 300 },
                  goals: { type: "string", maxLength: 300, description: "Athlete only" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated profile",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserWithProfile" } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/profile/coach-stats": {
      get: {
        tags: ["Profile"],
        summary: "Get coach dashboard stats (COACH only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Coach statistics",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CoachStats" } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can access this", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Coach profile not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── SESSIONS ────────────────────────────────────────────────────────────
    "/api/sessions": {
      get: {
        tags: ["Sessions"],
        summary: "List sessions (COACH: own sessions; ATHLETE: available sessions from coaches)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"] },
            description: "Filter by status (coach only)",
          },
        ],
        responses: {
          "200": {
            description: "List of sessions",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Session" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["Sessions"],
        summary: "Create a new session (COACH only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "sport", "scheduledAt", "durationMinutes"],
                properties: {
                  title: { type: "string", minLength: 1, example: "Morning Run" },
                  sport: { type: "string", minLength: 1, example: "Running" },
                  description: { type: "string" },
                  location: { type: "string", example: "Central Park" },
                  scheduledAt: { type: "string", format: "date-time", example: "2026-05-10T08:00:00Z" },
                  durationMinutes: { type: "integer", minimum: 15, maximum: 480, example: 60 },
                  maxAthletes: { type: "integer", minimum: 1, maximum: 100, default: 10 },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Session created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can create sessions", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/sessions/bookings": {
      get: {
        tags: ["Sessions"],
        summary: "Get athlete's confirmed bookings (ATHLETE only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of bookings with session and progress",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/SessionBooking" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only athletes can access this", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/sessions/today": {
      get: {
        tags: ["Sessions"],
        summary: "Get today's session booking for the athlete (ATHLETE only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Today's booking or null",
            content: {
              "application/json": {
                schema: { oneOf: [{ $ref: "#/components/schemas/SessionBooking" }, { type: "null" }] },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only athletes can access this", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/sessions/{id}": {
      get: {
        tags: ["Sessions"],
        summary: "Get a single session by ID",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Session details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      put: {
        tags: ["Sessions"],
        summary: "Update a session (COACH only, must own the session)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  location: { type: "string" },
                  scheduledAt: { type: "string", format: "date-time" },
                  durationMinutes: { type: "integer" },
                  maxAthletes: { type: "integer" },
                  status: { type: "string", enum: ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated session",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can update sessions", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Sessions"],
        summary: "Cancel a session (COACH only, sets status to CANCELLED)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Cancelled session",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can cancel sessions", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/sessions/{id}/athletes": {
      post: {
        tags: ["Sessions"],
        summary: "Assign athletes to a session (COACH only)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["athleteProfileIds"],
                properties: {
                  athleteProfileIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of AthleteProfile IDs to assign",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Session with updated bookings",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Session" } } },
          },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can assign athletes", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/sessions/{sessionId}/exercises": {
      post: {
        tags: ["Sessions"],
        summary: "Add a single exercise to a session (COACH only)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "sessionId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", minLength: 1, example: "Push-ups" },
                  sets: { type: "integer", minimum: 1 },
                  reps: { type: "integer", minimum: 1 },
                  durationSeconds: { type: "integer", minimum: 1 },
                  restSeconds: { type: "integer", minimum: 0 },
                  notes: { type: "string" },
                  order: { type: "integer", minimum: 0, default: 0 },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Exercise created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Exercise" } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can add exercises", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/sessions/{sessionId}/exercises/bulk": {
      post: {
        tags: ["Sessions"],
        summary: "Bulk add exercises to a session (COACH only)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "sessionId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["exercises"],
                properties: {
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["name"],
                      properties: {
                        name: { type: "string" },
                        sets: { type: "integer" },
                        reps: { type: "integer" },
                        durationSeconds: { type: "integer" },
                        restSeconds: { type: "integer" },
                        notes: { type: "string" },
                        order: { type: "integer", default: 0 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "All exercises for the session",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Exercise" } } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can add exercises", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Session not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── ATHLETES ────────────────────────────────────────────────────────────
    "/api/athletes": {
      get: {
        tags: ["Athletes"],
        summary: "List coach's athletes with recent session history (COACH only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of coach-athlete relations with athlete details",
            content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can access this", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["Athletes"],
        summary: "Add an athlete to the coach's roster by email (COACH only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email", example: "athlete@example.com" } },
              },
            },
          },
        },
        responses: {
          "201": { description: "Athlete added to roster", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Invalid email", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Athlete limit reached or wrong role", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "No athlete found with that email", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/athletes/{athleteProfileId}": {
      delete: {
        tags: ["Athletes"],
        summary: "Remove an athlete from the coach's roster (COACH only)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "athleteProfileId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Athlete removed", content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can remove athletes", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── COACHES ─────────────────────────────────────────────────────────────
    "/api/coaches": {
      get: {
        tags: ["Coaches"],
        summary: "List athlete's coaches (ATHLETE only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of coach-athlete relations with coach details",
            content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only athletes can access this", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── EXERCISES ───────────────────────────────────────────────────────────
    "/api/exercises/{id}": {
      put: {
        tags: ["Exercises"],
        summary: "Update an exercise (COACH only, must own parent session)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  sets: { type: "integer" },
                  reps: { type: "integer" },
                  durationSeconds: { type: "integer" },
                  restSeconds: { type: "integer" },
                  notes: { type: "string" },
                  order: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated exercise",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Exercise" } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can update exercises", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Exercise not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Exercises"],
        summary: "Delete an exercise (COACH only, must own parent session)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Exercise deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only coaches can delete exercises", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Exercise not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── FRIENDS ─────────────────────────────────────────────────────────────
    "/api/friends": {
      get: {
        tags: ["Friends"],
        summary: "List all accepted friends",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of friendships",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Friendship" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/friends/pending": {
      get: {
        tags: ["Friends"],
        summary: "List pending incoming friend requests",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of pending friend requests",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Friendship" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/friends/feed": {
      get: {
        tags: ["Friends"],
        summary: "Get friends' completed workout activity feed",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Activity feed (most recent 20 completed exercises from friends)",
            content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/friends/request": {
      post: {
        tags: ["Friends"],
        summary: "Send a friend request",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["addresseeId"],
                properties: { addresseeId: { type: "string", description: "User ID of the recipient" } },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Friend request sent",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Friendship" } } },
          },
          "400": { description: "Cannot friend yourself", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Friend request already exists", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/friends/{id}/respond": {
      patch: {
        tags: ["Friends"],
        summary: "Accept or decline a friend request",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Friendship ID" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["accept"],
                properties: { accept: { type: "boolean", description: "true to accept, false to decline" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated friendship",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Friendship" } } },
          },
          "400": { description: "Invalid input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Friend request not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── NOTIFICATIONS ───────────────────────────────────────────────────────
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List notifications (most recent 50)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of notifications",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Notification" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/notifications/unread-count": {
      get: {
        tags: ["Notifications"],
        summary: "Get count of unread notifications",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Unread count",
            content: {
              "application/json": {
                schema: { type: "object", properties: { count: { type: "integer" } } },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/notifications/read-all": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark all notifications as read",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "All marked as read", content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark a single notification as read",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Updated notification",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Notification" } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Notification not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── PROGRESS ────────────────────────────────────────────────────────────
    "/api/progress/toggle": {
      post: {
        tags: ["Progress"],
        summary: "Toggle exercise completion for a booking (ATHLETE only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["bookingId", "exerciseId", "completed"],
                properties: {
                  bookingId: { type: "string" },
                  exerciseId: { type: "string" },
                  completed: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Upserted workout progress",
            content: { "application/json": { schema: { $ref: "#/components/schemas/WorkoutProgress" } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only athletes can toggle progress", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Booking not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/progress/stats": {
      get: {
        tags: ["Progress"],
        summary: "Get athlete's overall progress statistics (ATHLETE only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Progress statistics",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProgressStats" } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Only athletes can view stats", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/progress/booking/{bookingId}": {
      get: {
        tags: ["Progress"],
        summary: "Get all progress entries for a specific booking",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "bookingId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "List of workout progress records",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WorkoutProgress" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/progress/session/{sessionId}": {
      get: {
        tags: ["Progress"],
        summary: "Get all athletes' progress for a session (COACH view)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "sessionId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "List of bookings with athlete info and progress",
            content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
};
