# Dino Backend — Wallet Service

A closed-loop virtual currency wallet service built for high-traffic gaming and loyalty rewards platforms. Supports top-ups, spends, bonuses, double-entry ledger, idempotency, and balance verification.

**Stack:** Bun · Elysia · Drizzle ORM · PostgreSQL · Redis

**Live:** https://dino-wallet-service-production.up.railway.app/

---

## Running with Docker (recommended)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) with Docker Compose

### Steps

**1. Clone the repo**
```bash
git clone <repo-url>
cd dino-backend
```

**2. Set up environment**
```bash
cp .env.example .env
```
`.env.example` is pre-filled with values that match the Docker Compose setup. No changes needed to run locally with Docker.

**3. Start all services**
```bash
docker compose up --build
```

This will:
- Start PostgreSQL and Redis
- Run database migrations
- Seed the database (treasury wallet, sample users)
- Start the API server on port `3000`

**5. Verify**
```bash
curl http://localhost:3000
# → "Dino backend is working..."
```

To stop and wipe all data:
```bash
docker compose down -v
```

---

## Running locally (without Docker)

### Prerequisites
- [Bun](https://bun.sh) v1.0+
- PostgreSQL
- Redis

### Steps

**1. Clone and install**
```bash
git clone <repo-url>
cd dino-backend
bun install
```

**2. Set up environment**
```bash
cp .env.example .env
```
Update `.env` with your local connection strings:
```env
DATABASE_URL="postgres://postgres:postgres@localhost:5432/dino"
REDIS_URL="redis://localhost:6379"
TREASURY_WALLET_ID="cb64e0be-c13d-40cc-8151-9b77ad9b709d"
```

**3. Apply migrations**
```bash
bun run migrate
```

**4. Seed the database**
```bash
bun run seed
```

**5. Start the server**
```bash
bun run dev      # hot reload
# or
bun run start    # production
```

---

## API Reference

Base URL: `http://localhost:3000`

All mutation endpoints require an `idempotencyKey` (UUID v4) to guarantee exactly-once processing.

---

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |

---

### Wallet — Mutations

#### Top Up
Credits a user wallet from the treasury.

```
POST /wallet/topup
```

**Body**
```json
{
  "walletId": "uuid",
  "idempotencyKey": "uuid",
  "amount": 100
}
```

**Response**
```json
{
  "id": "uuid",
  "idempotency_key": "uuid",
  "type": "topup",
  "amount": "100.00000000"
}
```

---

#### Spend
Debits a user wallet back to the treasury.

```
POST /wallet/spend
```

**Body**
```json
{
  "walletId": "uuid",
  "idempotencyKey": "uuid",
  "amount": 50
}
```

---

#### Bonus
Credits a user wallet from the treasury as a no-cost reward.

```
POST /wallet/bonus
```

**Body**
```json
{
  "walletId": "uuid",
  "idempotencyKey": "uuid",
  "amount": 25
}
```

---

### Wallet — Queries

#### Get Balance

```
GET /wallet/:id/balance
```

**Response**
```json
{
  "walletId": "uuid",
  "balance": "575.00000000"
}
```

---

#### Verify Balance
Recomputes balance from the double-entry ledger and compares against the stored value. Use for reconciliation audits.

```
GET /wallet/:id/balance/verify
```

**Response**
```json
{
  "walletId": "uuid",
  "storedBalance": "575.00000000",
  "ledgerBalance": "575.00000000",
  "isInSync": true
}
```

---

#### Get Transactions

```
GET /wallet/:id/transactions?limit=20&offset=0
```

**Query params**

| Param | Type | Default | Max |
|-------|------|---------|-----|
| `limit` | number | `20` | `100` |
| `offset` | number | `0` | — |

**Response**
```json
[
  {
    "id": "uuid",
    "type": "topup",
    "amount": "100.00000000",
    "created_at": "2026-01-01T00:00:00.000Z"
  }
]
```

---

## Seeded Data

The seed script creates:

| Entity | Details |
|--------|---------|
| Asset | Diamonds (DMD) |
| Treasury wallet | Fixed ID `cb64e0be-c13d-40cc-8151-9b77ad9b709d`, 10M DMD starting supply |
| Alice | `alice@example.com`, wallet with 500 DMD |
| Bob | `bob@example.com`, wallet with 250 DMD |

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start server with hot reload |
| `bun run start` | Start production server |
| `bun run migrate` | Apply pending migrations |
| `bun run seed` | Seed the database |
| `bunx drizzle-kit generate` | Generate a new migration after changing the schema |
