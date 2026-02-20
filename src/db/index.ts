import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { config } from "../config";
import * as schema from "./schema";

const queryClient = postgres(config.db.url);

export const db: PostgresJsDatabase<typeof schema> = drizzle(queryClient, {
  schema,
});
