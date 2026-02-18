import {
  integer,
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  bigint,
} from "drizzle-orm/pg-core";

const accountTypeEnum = pgEnum("account_type", ["treasury", "user"]);

const transactionTypeEnum = pgEnum("transaction_type", [
  "topup",
  "bonus",
  "spend",
]);

const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "completed",
  "failed",
]);

const entryDirectionEnum = pgEnum("entry_direction", ["debit", "credit"]);

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  name: text("name").unique().notNull(),
  symbol: text("symbol").unique().notNull(),
  decimals: integer("decimals").notNull(),
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

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  user_id: uuid("user_id").references(() => users.id), //can be null if the type is treasury
  type: accountTypeEnum("type").notNull(),
  asset_id: uuid("asset_id")
    .references(() => assets.id)
    .notNull(),
  balance: bigint("balance", { mode: "bigint" }).default(0n).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  idempotency_key: uuid("idempotency_key").notNull().unique(), //generated in the frontend and helps preventing duplicate transactions
  type: transactionTypeEnum("type").notNull(),
  status: transactionStatusEnum("status").notNull(),
  asset_id: uuid("asset_id")
    .references(() => assets.id)
    .notNull(),
  amount: bigint("amount", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  transaction_id: uuid("transaction_id")
    .references(() => transactions.id)
    .notNull(),
  account_id: uuid("account_id")
    .references(() => accounts.id)
    .notNull(),
  direction: entryDirectionEnum("direction").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
