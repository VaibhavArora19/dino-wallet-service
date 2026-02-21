import { eq, sql, desc } from "drizzle-orm";
import { db } from "../../db";
import { redis } from "../../lib/redis";
import { config } from "../../config";
import { WalletError } from "../../lib/errors";
import { ledgerEntries, transactions, wallets } from "../../db/schema";

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24 hours in seconds
const UNIQUE_VIOLATION = "23505"; // Postgres error code for unique_violation

const TREASURY_WALLET_ID = config.wallet.treasuryWalletId;

export class WalletService {
  async topUp(walletId: string, idempotencyKey: string, amount: number) {
    return this.creditWallet(walletId, idempotencyKey, amount, "topup");
  }

  async addBonus(walletId: string, idempotencyKey: string, amount: number) {
    return this.creditWallet(walletId, idempotencyKey, amount, "bonus");
  }

  async spend(walletId: string, idempotencyKey: string, amount: number) {
    return this.debitWallet(walletId, idempotencyKey, amount);
  }

  async getBalance(walletId: string) {
    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.id, walletId),
      columns: { id: true, balance: true, asset_id: true, type: true },
    });

    if (!wallet) throw new WalletError("Wallet not found", 404);

    return wallet;
  }

  async getTransactions(walletId: string, limit = 20, offset = 0) {
    const entries = await db
      .select({
        transactionId: transactions.id,
        type: transactions.type,
        amount: ledgerEntries.amount,
        direction: ledgerEntries.direction,
        createdAt: transactions.createdAt,
      })
      .from(ledgerEntries)
      .innerJoin(transactions, eq(ledgerEntries.transaction_id, transactions.id))
      .where(eq(ledgerEntries.wallet_id, walletId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    return entries;
  }

  private async resolveIdempotency(idempotencyKey: string) {
    const cached = await redis.get(`wallet:idempotency:${idempotencyKey}`);
    if (cached) return JSON.parse(cached);
    return null;
  }

  private async storeIdempotency(idempotencyKey: string, result: unknown) {
    await redis.set(
      `wallet:idempotency:${idempotencyKey}`,
      JSON.stringify(result),
      "EX",
      IDEMPOTENCY_TTL,
    );
  }

  private async creditWallet(
    walletId: string,
    idempotencyKey: string,
    amount: number,
    type: "topup" | "bonus",
  ) {
    const cached = await this.resolveIdempotency(idempotencyKey);
    if (cached) return cached;

    const result = await db
      .transaction(async (tx) => {
        const [wallet] = await tx.execute(
          sql`SELECT * FROM wallets WHERE id = ${walletId} FOR UPDATE`,
        );

        if (!wallet) throw new WalletError("Wallet not found", 404);

        const [treasury] = await tx.execute(
          sql`SELECT * FROM wallets WHERE id = ${TREASURY_WALLET_ID} FOR UPDATE`,
        );

        if (Number(treasury.balance) < amount) {
          throw new WalletError("Treasury insufficient funds", 422);
        }

        const [transaction] = await tx
          .insert(transactions)
          .values({
            idempotency_key: idempotencyKey,
            type,
            asset_id: wallet.asset_id as string,
            amount: String(amount),
          })
          .returning();

        await tx.insert(ledgerEntries).values([
          {
            transaction_id: transaction.id,
            wallet_id: TREASURY_WALLET_ID,
            direction: "debit" as const,
            amount: String(amount),
          },
          {
            transaction_id: transaction.id,
            wallet_id: wallet.id as string,
            direction: "credit" as const,
            amount: String(amount),
          },
        ]);

        await tx
          .update(wallets)
          .set({
            balance: sql`CASE
              WHEN id = ${wallet.id as string}::uuid THEN balance + ${amount}
              WHEN id = ${TREASURY_WALLET_ID}::uuid  THEN balance - ${amount}
            END`,
          })
          .where(sql`id IN (${wallet.id as string}::uuid, ${TREASURY_WALLET_ID}::uuid)`);

        return transaction;
      })
      .catch(async (error) => {
        if (error?.code === UNIQUE_VIOLATION) {
          return db.query.transactions.findFirst({
            where: eq(transactions.idempotency_key, idempotencyKey),
          });
        }
        throw error;
      });

    await this.storeIdempotency(idempotencyKey, result);
    return result;
  }

  private async debitWallet(
    walletId: string,
    idempotencyKey: string,
    amount: number,
  ) {
    const cached = await this.resolveIdempotency(idempotencyKey);
    if (cached) return cached;

    const result = await db
      .transaction(async (tx) => {
        const [wallet] = await tx.execute(
          sql`SELECT * FROM wallets WHERE id = ${walletId} FOR UPDATE`,
        );

        if (!wallet) throw new WalletError("Wallet not found", 404);

        // Lock treasury row for the balance update below
        await tx.execute(
          sql`SELECT id FROM wallets WHERE id = ${TREASURY_WALLET_ID} FOR UPDATE`,
        );

        if (Number(wallet.balance) < amount) {
          throw new WalletError("Insufficient funds", 422);
        }

        const [transaction] = await tx
          .insert(transactions)
          .values({
            idempotency_key: idempotencyKey,
            type: "spend",
            asset_id: wallet.asset_id as string,
            amount: String(amount),
          })
          .returning();

        await tx.insert(ledgerEntries).values([
          {
            transaction_id: transaction.id,
            wallet_id: TREASURY_WALLET_ID,
            direction: "credit" as const,
            amount: String(amount),
          },
          {
            transaction_id: transaction.id,
            wallet_id: wallet.id as string,
            direction: "debit" as const,
            amount: String(amount),
          },
        ]);

        await tx
          .update(wallets)
          .set({
            balance: sql`CASE
              WHEN id = ${wallet.id as string}::uuid THEN balance - ${amount}
              WHEN id = ${TREASURY_WALLET_ID}::uuid  THEN balance + ${amount}
            END`,
          })
          .where(sql`id IN (${wallet.id as string}::uuid, ${TREASURY_WALLET_ID}::uuid)`);

        return transaction;
      })
      .catch(async (error) => {
        if (error?.code === UNIQUE_VIOLATION) {
          return db.query.transactions.findFirst({
            where: eq(transactions.idempotency_key, idempotencyKey),
          });
        }
        throw error;
      });

    await this.storeIdempotency(idempotencyKey, result);
    return result;
  }
}
