import { getDb, hashApiKey } from "./server/db.js";
import { users, apiKeys, creditAccounts } from "./drizzle/schema.js";
import crypto from "crypto";

function generateApiKey() {
  return `tf_live_${crypto.randomBytes(32).toString("base64url")}`;
}

async function main() {
  const db = await getDb();
  
  // 1. Create a user
  const email = `test-opus5-${Date.now()}@example.com`;
  const [userResult] = await db.insert(users).values({
    email,
    openId: email,
    name: "Test User",
    loginMethod: "github",
    role: "developer",
  });
  
  const userId = userResult.insertId;

  // 2. Grant credits
  await db.insert(creditAccounts).values({
    userId,
    usdCents: 1000,
    allowanceUsdCents: 0,
    ledgerCursorId: null,
  });

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

  console.log(rawKey);
  process.exit(0);
}

main().catch(console.error);
