import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", ["treasury", "user"]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "topup",
  "bonus",
  "spend",
]);

const entryDirectionEnum = pgEnum("entry_direction", ["debit", "credit"]);

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  name: text("name").unique().notNull(),
  symbol: text("symbol").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const wallets = pgTable("wallets", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  user_id: uuid("user_id").references(() => users.id), //can be null if the type is treasury
  type: accountTypeEnum("type").notNull(),
  asset_id: uuid("asset_id")
    .references(() => assets.id)
    .notNull(),
  balance: doublePrecision("balance").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  idempotency_key: uuid("idempotency_key").notNull().unique(), //generated in the frontend and helps preventing duplicate transactions
  type: transactionTypeEnum("type").notNull(),
  asset_id: uuid("asset_id")
    .references(() => assets.id)
    .notNull(),
  amount: doublePrecision("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  transaction_id: uuid("transaction_id")
    .references(() => transactions.id)
    .notNull(),
  wallet_id: uuid("wallet_id")
    .references(() => wallets.id)
    .notNull(),
  direction: entryDirectionEnum("direction").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
