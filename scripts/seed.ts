import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { config } from "../src/config";

const { assets, users, wallets, transactions, ledgerEntries } = schema;
const { treasuryWalletId: TREASURY_WALLET_ID } = config.wallet;

// Fixed idempotency keys for seed transactions — ensures re-runs are safe
const TREASURY_GENESIS_KEY = "00000000-0000-0000-0000-000000000001";
const ALICE_INIT_KEY = "00000000-0000-0000-0000-000000000002";
const BOB_INIT_KEY = "00000000-0000-0000-0000-000000000003";

const client = postgres(config.db.url);
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding database...");

  // 1. Asset
  const insertedAsset = await db
    .insert(assets)
    .values({ name: "Diamonds", symbol: "DMD" })
    .onConflictDoNothing()
    .returning();

  const diamonds =
    insertedAsset[0] ??
    (await db.query.assets.findFirst({ where: eq(assets.name, "Diamonds") }))!;

  console.log("Asset:", diamonds.symbol);

  // 2. Treasury wallet + genesis ledger entry
  await db
    .insert(wallets)
    .values({
      id: TREASURY_WALLET_ID,
      type: "treasury",
      asset_id: diamonds.id,
      balance: "10000000",
    })
    .onConflictDoNothing();

  const existingGenesisTx = await db.query.transactions.findFirst({
    where: eq(transactions.idempotency_key, TREASURY_GENESIS_KEY),
  });

  if (!existingGenesisTx) {
    const [genesisTx] = await db
      .insert(transactions)
      .values({
        idempotency_key: TREASURY_GENESIS_KEY,
        type: "topup",
        asset_id: diamonds.id,
        amount: "10000000",
      })
      .returning();

    await db.insert(ledgerEntries).values({
      transaction_id: genesisTx.id,
      wallet_id: TREASURY_WALLET_ID,
      direction: "credit",
      amount: "10000000",
    });
  }

  console.log("Treasury wallet ID:", TREASURY_WALLET_ID);

  // 3. Users
  const insertedUsers = await db
    .insert(users)
    .values([
      { name: "Alice", email: "alice@example.com" },
      { name: "Bob", email: "bob@example.com" },
    ])
    .onConflictDoNothing()
    .returning();

  const alice =
    insertedUsers.find((u) => u.email === "alice@example.com") ??
    (await db.query.users.findFirst({
      where: eq(users.email, "alice@example.com"),
    }))!;

  const bob =
    insertedUsers.find((u) => u.email === "bob@example.com") ??
    (await db.query.users.findFirst({
      where: eq(users.email, "bob@example.com"),
    }))!;

  console.log("Users:", alice.name, bob.name);

  // 4. User wallets — create wallet + ledger entries + deduct from treasury
  async function createUserWallet(
    userId: string,
    initialBalance: string,
    idempotencyKey: string,
    label: string,
  ) {
    const existing = await db.query.wallets.findFirst({
      where: eq(wallets.user_id, userId),
    });

    if (existing) {
      console.log(`${label} wallet already exists, skipping`);
      return;
    }

    await db.transaction(async (tx) => {
      const [wallet] = await tx
        .insert(wallets)
        .values({
          user_id: userId,
          type: "user",
          asset_id: diamonds.id,
          balance: initialBalance,
        })
        .returning();

      const [transaction] = await tx
        .insert(transactions)
        .values({
          idempotency_key: idempotencyKey,
          type: "topup",
          asset_id: diamonds.id,
          amount: initialBalance,
        })
        .returning();

      await tx.insert(ledgerEntries).values([
        {
          transaction_id: transaction.id,
          wallet_id: TREASURY_WALLET_ID,
          direction: "debit",
          amount: initialBalance,
        },
        {
          transaction_id: transaction.id,
          wallet_id: wallet.id,
          direction: "credit",
          amount: initialBalance,
        },
      ]);

      await tx
        .update(wallets)
        .set({ balance: sql`balance - ${initialBalance}::numeric` })
        .where(eq(wallets.id, TREASURY_WALLET_ID));
    });

    console.log(`${label} wallet created with balance: ${initialBalance}`);
  }

  await createUserWallet(alice.id, "500", ALICE_INIT_KEY, "Alice");
  await createUserWallet(bob.id, "250", BOB_INIT_KEY, "Bob");

  console.log("Seeding complete.");
}

seed()
  .catch(console.error)
  .finally(() => client.end());
