import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  numeric,
  check,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const accountTypeEnum = pgEnum("account_type", ["treasury", "user"]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "topup",
  "bonus",
  "spend",
]);

export const entryDirectionEnum = pgEnum("entry_direction", ["debit", "credit"]);

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
    index("wallets_user_id_idx").on(table.user_id),
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
    index("transactions_idempotency_key_idx").on(table.idempotency_key),
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
    index("ledger_entries_wallet_id_idx").on(table.wallet_id),
    index("ledger_entries_transaction_id_idx").on(table.transaction_id),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, { fields: [wallets.user_id], references: [users.id] }),
}));
