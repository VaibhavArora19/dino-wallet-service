import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  numeric,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    user_id: uuid("user_id").references(() => users.id), //can be null if the type is treasury
    type: accountTypeEnum("type").notNull(),
    asset_id: uuid("asset_id")
      .references(() => assets.id)
      .notNull(),
    balance: numeric("balance", { precision: 20, scale: 8 }).default("0").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    check("balance_non_negative", sql`${table.balance} >= 0`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    idempotency_key: uuid("idempotency_key").notNull().unique(),
    type: transactionTypeEnum("type").notNull(),
    asset_id: uuid("asset_id")
      .references(() => assets.id)
      .notNull(),
    amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    check("amount_positive", sql`${table.amount} > 0`),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    transaction_id: uuid("transaction_id")
      .references(() => transactions.id)
      .notNull(),
    wallet_id: uuid("wallet_id")
      .references(() => wallets.id)
      .notNull(),
    direction: entryDirectionEnum("direction").notNull(),
    amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    check("amount_positive", sql`${table.amount} > 0`),
  ],
);
