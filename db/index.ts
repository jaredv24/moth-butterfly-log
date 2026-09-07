import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
const isRemotePg = !!url && /^postgres(ql)?:\/\//.test(url);

/** Where PGlite persists locally when no Postgres URL is configured. */
export const PGLITE_DIR = process.env.PGLITE_DIR ?? ".pglite";

const globalForDb = globalThis as unknown as {
  __db?: ReturnType<typeof build>;
};

function build() {
  if (isRemotePg) {
    const client = postgres(url!, { max: 1, prepare: false });
    return drizzlePg(client, { schema });
  }
  const client = new PGlite(PGLITE_DIR);
  return drizzlePglite(client, { schema });
}

export const db = globalForDb.__db ?? build();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export const usingPglite = !isRemotePg;
export { schema };
