import Elysia from "elysia";
import { WalletService } from "./service";
import { WalletModel } from "./model";

export const wallet = new Elysia({ prefix: "/wallet" })
  .post(
    "/topup",
    async ({ body }) => {
      const walletService = new WalletService();

      await walletService.topUp(
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

      await walletService.spend(
        body.walletId,
        body.idempotencyKey,
        body.amount,
      );
    },
    {
      body: WalletModel.assetTransactionBody,
    },
  );
