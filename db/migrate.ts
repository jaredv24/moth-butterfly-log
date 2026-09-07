import "dotenv/config";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { db, usingPglite } from "./index";

async function main() {
  const config = { migrationsFolder: "./db/migrations" };
  if (usingPglite) {
    console.log("Applying migrations to local PGlite database…");
    // @ts-expect-error — driver-specific db instance
    await migratePglite(db, config);
  } else {
    console.log("Applying migrations to Postgres…");
    // @ts-expect-error — driver-specific db instance
    await migratePg(db, config);
  }
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
