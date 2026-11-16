// Crée le premier compte administrateur à partir de SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { assertStrongPassword, hashPassword } from "../auth/password";
import { users } from "./schema";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD sont requis");
  assertStrongPassword(password);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    console.log(`L'utilisateur ${email} existe déjà, rien à faire.`);
  } else {
    await db.insert(users).values({
      email,
      fullName: "Administrateur",
      passwordHash: await hashPassword(password),
      role: "ADMIN",
    });
    console.log(`Administrateur ${email} créé.`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
