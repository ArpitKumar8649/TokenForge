import { getDb } from "./server/db.js";
import { loginAttempts } from "./drizzle/schema.js";

async function main() {
  const db = await getDb();
  await db.delete(loginAttempts);
  console.log("CLEARED_BLOCKS");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
