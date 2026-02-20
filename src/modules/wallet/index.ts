import Elysia from "elysia";
import { WalletService } from "./service";
import { WalletModel } from "./model";

export const wallet = new Elysia({ prefix: "/wallet" })
  .post(
    "/topup",
    async ({ body }) => {
      const walletService = new WalletService();

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
      const walletService = new WalletService();

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
      const walletService = new WalletService();

      return walletService.addBonus(
        body.walletId,
        body.idempotencyKey,
        body.amount,
      );
    },
    {
      body: WalletModel.assetTransactionBody,
    },
  );
