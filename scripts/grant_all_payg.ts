import { getDb } from "../server/db";
import { users, creditAccounts, creditLedger } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import { randomBytes } from "crypto";

async function main() {
  console.log("Starting bulk PAYG grant of $5.00 (5,000,000,000 nanos) to all users...");
  const db = await getDb();
  if (!db) {
    throw new Error("Database not connected");
  }

  const GRANT_NANOS = 5_000_000_000; // $5.00
  const NOTE = "$5.00 Pay-As-You-Go starting compute grant";

  // 1. Ensure all users exist in credit_accounts
  console.log("Ensuring all users have credit_accounts...");
  await db.execute(sql`
    INSERT INTO credit_accounts (userId, balanceNanos, paygBalanceNanos, createdAt, updatedAt)
    SELECT id, 0, 0, NOW(), NOW()
    FROM users
    WHERE id NOT IN (SELECT userId FROM credit_accounts)
  `);

  // 2. Grant $5 to all users in credit_accounts
  console.log("Updating paygBalanceNanos for all accounts...");
  const updateResult = await db.execute(sql`
    UPDATE credit_accounts
    SET paygBalanceNanos = paygBalanceNanos + ${GRANT_NANOS}
  `);
  console.log("Update executed:", updateResult);

  // 3. Insert ledger records in batches
  console.log("Fetching all user IDs to record ledger entries...");
  const allUsers = await db.select({ id: users.id }).from(users);
  console.log(`Found ${allUsers.length} users. Writing ledger records...`);

  const batchId = randomBytes(8).toString("hex");
  const CHUNK_SIZE = 500;
  for (let i = 0; i < allUsers.length; i += CHUNK_SIZE) {
    const chunk = allUsers.slice(i, i + CHUNK_SIZE);
    await db.insert(creditLedger).values(
      chunk.map(u => ({
        userId: u.id,
        kind: "manual_adjustment" as const,
        amountNanos: GRANT_NANOS,
        balanceAfterNanos: GRANT_NANOS,
        referenceId: `bulk-payg-grant:${batchId}:${u.id}`,
        note: NOTE,
      }))
    );
    console.log(`Recorded ledger chunk ${i + 1} - ${Math.min(i + CHUNK_SIZE, allUsers.length)} / ${allUsers.length}`);
  }

  // 4. Verification
  const [totalAccounts] = await db.select({ count: sql`count(*)` }).from(creditAccounts);
  const [accountsWith5OrMore] = await db.select({ count: sql`count(*)` }).from(creditAccounts).where(sql`paygBalanceNanos >= ${GRANT_NANOS}`);
  const sample = await db.select({
    userId: creditAccounts.userId,
    paygBalanceNanos: creditAccounts.paygBalanceNanos,
    balanceNanos: creditAccounts.balanceNanos
  }).from(creditAccounts).limit(5);

  console.log("=== VERIFICATION RESULTS ===");
  console.log("Total accounts:", totalAccounts.count);
  console.log("Accounts with >= $5 PAYG:", accountsWith5OrMore.count);
  console.log("Sample records:", sample);
  console.log("Bulk grant of $5 PAYG to all users COMPLETED SUCCESSFULLY!");
}

main()
  .catch(err => {
    console.error("Failed to grant PAYG credits:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
