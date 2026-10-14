import { getDb, hashApiKey } from "./server/db.js";
import { users, apiKeys, creditAccounts } from "./drizzle/schema.js";
import crypto from "crypto";

function generateApiKey() {
  return `tf_live_${crypto.randomBytes(32).toString("base64url")}`;
}

async function main() {
  const db = await getDb();
  
  // 1. Find a user or create one
  let userId;
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) {
    userId = existingUsers[0].id;
  } else {
    console.error("NO USERS FOUND. DB MIGHT BE EMPTY!");
    process.exit(1);
  }

  // 3. Create API key
  const rawKey = generateApiKey();
  const hashed = await hashApiKey(rawKey);
  const prefix = rawKey.substring(0, 16) + "…";

  await db.insert(apiKeys).values({
    userId,
    keyPrefix: prefix,
    keyHash: hashed,
    label: "Test Opus 5 Key",
  });

  console.log("SUCCESS_KEY:", rawKey);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
