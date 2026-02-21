import Elysia from "elysia";
import { UserService } from "./service";
import { UserModel } from "./model";

const userService = new UserService();

export const user = new Elysia({ prefix: "/users" })
  .get(
    "/",
    async ({ query }) => {
      return userService.getUserByEmail(query.email);
    },
    { query: UserModel.emailQuery },
  )
  .get(
    "/:id",
    async ({ params }) => {
      return userService.getUserById(params.id);
    },
    { params: UserModel.idParam },
  );
