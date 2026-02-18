import { eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { WalletError } from "../../lib/errors";
import { ledgerEntries, transactions, wallets } from "../../db/schema";

const TREASURY_WALLET_ID = "TREASURY_ACCOUNT_ID"; //TODO: replace with actual treasury wallet id

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

  private async creditWallet(
    walletId: string,
    idempotencyKey: string,
    amount: number,
    type: "topup" | "bonus",
  ) {
    //TODO: check for idempotency key in redis
    await db.transaction(async (tx) => {
      const [wallet] = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${walletId} FOR UPDATE`,
      );

      if (!wallet) throw new WalletError("Wallet not found", 404);

      const [treasury] = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${TREASURY_WALLET_ID} FOR UPDATE`,
      );

      if ((treasury.balance as bigint) < amount) {
        throw new WalletError("Treasury insufficient funds", 422);
      }

      const [transaction] = await tx
        .insert(transactions)
        .values({
          idempotency_key: idempotencyKey,
          type,
          asset_id: wallet.asset_id as string,
          amount,
        })
        .returning();

      await tx.insert(ledgerEntries).values([
        {
          transaction_id: transaction.id,
          wallet_id: TREASURY_WALLET_ID,
          direction: "debit",
        },
        {
          transaction_id: transaction.id,
          wallet_id: wallet.id as string,
          direction: "credit",
        },
      ]);

      //Increase balance in user wallet
      await tx
        .update(wallets)
        .set({ balance: sql`balance + ${amount}` })
        .where(eq(wallets.id, wallet.id as string));

      //Decrease balance from treasury wallet
      await tx
        .update(wallets)
        .set({ balance: sql`balance - ${amount}` })
        .where(eq(wallets.id, TREASURY_WALLET_ID));

      return transaction;
    });
  }

  private async debitWallet(
    walletId: string,
    idempotencyKey: string,
    amount: number,
  ) {
    //TODO: check for idempotency key in redis

    await db.transaction(async (tx) => {
      const [wallet] = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${walletId} FOR UPDATE`,
      );

      if (!wallet) throw new WalletError("Wallet not found", 404);

      const [treasury] = await tx.execute(
        sql`SELECT * FROM wallets WHERE id = ${TREASURY_WALLET_ID} FOR UPDATE`,
      );

      if ((treasury.balance as bigint) < amount) {
        throw new WalletError("Treasury insufficient funds", 422);
      }

      const [transaction] = await tx
        .insert(transactions)
        .values({
          idempotency_key: idempotencyKey,
          type: "spend",
          asset_id: wallet.asset_id as string,
          amount,
        })
        .returning();

      await tx.insert(ledgerEntries).values([
        {
          transaction_id: transaction.id,
          wallet_id: TREASURY_WALLET_ID,
          direction: "credit",
        },
        {
          transaction_id: transaction.id,
          wallet_id: wallet.id as string,
          direction: "debit",
        },
      ]);

      //Decrease balance from user wallet
      await tx
        .update(wallets)
        .set({ balance: sql`balance - ${amount}` })
        .where(eq(wallets.id, wallet.id as string));

      //Increase balance in treasury wallet
      await tx
        .update(wallets)
        .set({ balance: sql`balance + ${amount}` })
        .where(eq(wallets.id, TREASURY_WALLET_ID));
      return transaction;
    });
  }
}
