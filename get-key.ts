import { getDb } from "./server/db.js";
import { apiKeys } from "./drizzle/schema.js";

async function main() {
  const db = await getDb();
  
  // Just find any API key in the database
  const keys = await db.select().from(apiKeys).limit(1);
  if (keys.length > 0) {
    console.log("FOUND_KEY_HASH_PREFIX:", keys[0].keyPrefix);
  } else {
    console.log("NO_API_KEYS_FOUND");
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
