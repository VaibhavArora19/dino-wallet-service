import { t } from "elysia";

export namespace WalletModel {
  export const assetTransactionBody = t.Object({
    walletId: t.String(),
    idempotencyKey: t.String(),
    amount: t.Number({ minimum: 0.00000001, error: "Amount must be greater than 0" }),
  });

  export type assetTransactionBody = typeof assetTransactionBody.static;

  export const walletParams = t.Object({
    id: t.String(),
  });

  export type walletParams = typeof walletParams.static;
}
