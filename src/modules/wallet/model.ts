import { t } from "elysia";

export namespace WalletModel {
  export const assetTransactionBody = t.Object({
    walletId: t.String(),
    idempotencyKey: t.String(),
    amount: t.Number(),
  });

  export type assetTransactionBody = typeof assetTransactionBody.static;
}
