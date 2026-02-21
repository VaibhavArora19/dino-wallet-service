import { eq } from "drizzle-orm";
import { db } from "../../db";
import { WalletError } from "../../lib/errors";
import { users } from "../../db/schema";

export class UserService {
  async getUserByEmail(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) throw new WalletError("User not found", 404);

    return user;
  }
}
