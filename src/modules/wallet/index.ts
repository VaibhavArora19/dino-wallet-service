import Elysia from "elysia";
import { WalletService } from "./service";
import { WalletModel } from "./model";

const walletService = new WalletService();

export const wallet = new Elysia({ prefix: "/wallet" })
  .post(
    "/topup",
    async ({ body }) => {
      return walletService.topUp(
        body.walletId,
        body.idempotencyKey,
        body.amount,
      );
    },
    {
      body: WalletModel.assetTransactionBody,
    },
  )
  .post(
    "/spend",
    async ({ body }) => {
      return walletService.spend(
        body.walletId,
        body.idempotencyKey,
        body.amount,
      );
    },
    {
      body: WalletModel.assetTransactionBody,
    },
  )
  .post(
    "/bonus",
    async ({ body }) => {
      return walletService.addBonus(
        body.walletId,
        body.idempotencyKey,
        body.amount,
      );
    },
    {
      body: WalletModel.assetTransactionBody,
    },
  )
  .get(
    "/:id/balance",
    async ({ params }) => {
      return walletService.getBalance(params.id);
    },
    {
      params: WalletModel.walletParams,
    },
  )
  .get(
    "/:id/balance/verify",
    async ({ params }) => {
      return walletService.verifyBalance(params.id);
    },
    {
      params: WalletModel.walletParams,
    },
  )
  .get(
    "/:id/transactions",
    async ({ params, query }) => {
      return walletService.getTransactions(params.id, query.limit, query.offset);
    },
    {
      params: WalletModel.walletParams,
      query: WalletModel.paginationQuery,
    },
  );
