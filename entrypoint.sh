#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Seeding workout templates..."
node dist/seed/seed.js

echo "Starting API server..."
exec node dist/index.js
