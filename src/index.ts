import { Elysia } from "elysia";
import { wallet } from "./modules/wallet";
import { WalletError } from "./lib/errors";

const app = new Elysia()
  .onError(({ error, set }) => {
    if (error instanceof WalletError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    set.status = 500;
    return { error: "Internal server error" };
  })
  .get("/", () => "Dino backend is working...")
  .use(wallet)
  .listen(3000);

console.log(
  `🦊 Server is running at ${app.server?.hostname}:${app.server?.port}`,
);
