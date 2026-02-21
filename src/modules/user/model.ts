import { t } from "elysia";

export namespace UserModel {
  export const emailQuery = t.Object({
    email: t.String({ format: "email", error: "email must be a valid email address" }),
  });

  export type emailQuery = typeof emailQuery.static;
}
