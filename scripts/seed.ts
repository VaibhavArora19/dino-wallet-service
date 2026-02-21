import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { config } from "../src/config";

const { assets, users, wallets } = schema;
const { treasuryWalletId: TREASURY_WALLET_ID } = config.wallet;

const client = postgres(config.db.url);
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding database...");

  // 1. Asset type
  const insertedAsset = await db
    .insert(assets)
    .values({ name: "Diamonds", symbol: "DMD" })
    .onConflictDoNothing()
    .returning();

  const diamonds =
    insertedAsset[0] ??
    (await db.query.assets.findFirst({ where: eq(assets.name, "Diamonds") }))!;

  console.log("Asset:", diamonds.symbol);

  // 2. Treasury wallet — fixed UUID so TREASURY_WALLET_ID is always known
  await db
    .insert(wallets)
    .values({
      id: TREASURY_WALLET_ID,
      type: "treasury",
      asset_id: diamonds.id,
      balance: "10000000", // 10M starting supply
    })
    .onConflictDoNothing(); // PK conflict on re-run — safe to skip

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

  // 4. User wallets — only insert if they don't already exist
  const aliceWallet = await db.query.wallets.findFirst({
    where: eq(wallets.user_id, alice.id),
  });

  const bobWallet = await db.query.wallets.findFirst({
    where: eq(wallets.user_id, bob.id),
  });

  if (!aliceWallet) {
    await db.insert(wallets).values({
      user_id: alice.id,
      type: "user",
      asset_id: diamonds.id,
      balance: "500",
    });
    console.log("Alice wallet created with balance: 500");
  } else {
    console.log("Alice wallet already exists, skipping");
  }

  if (!bobWallet) {
    await db.insert(wallets).values({
      user_id: bob.id,
      type: "user",
      asset_id: diamonds.id,
      balance: "250",
    });
    console.log("Bob wallet created with balance: 250");
  } else {
    console.log("Bob wallet already exists, skipping");
  }

  console.log("Seeding complete.");
}

seed()
  .catch(console.error)
  .finally(() => client.end());
