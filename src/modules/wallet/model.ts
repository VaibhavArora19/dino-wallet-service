import { t } from "elysia";

export namespace WalletModel {
  export const assetTransactionBody = t.Object({
    walletId: t.String(),
    idempotencyKey: t.String({
      pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
      error: "idempotencyKey must be a valid UUID",
    }),
    amount: t.Number({ minimum: 0.00000001, error: "Amount must be greater than 0" }),
  });

  export type assetTransactionBody = typeof assetTransactionBody.static;

  export const walletParams = t.Object({
    id: t.String(),
  });

  export type walletParams = typeof walletParams.static;

  export const paginationQuery = t.Object({
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
    offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
  });

  export type paginationQuery = typeof paginationQuery.static;
}
