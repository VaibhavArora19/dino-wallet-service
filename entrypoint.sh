#!/bin/sh
set -e

echo "Running migrations..."
bunx drizzle-kit migrate

echo "Running seed..."
bun run seed

echo "Starting app..."
exec bun run src/index.ts
