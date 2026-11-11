// Applique les migrations SQL du dossier drizzle/ sur la base pointée par DATABASE_URL.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migrations appliquées.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
