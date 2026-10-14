import { getDb } from "./server/db.js";
import { platformSettings } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";
import { decryptProviderRuntimeConfig } from "./server/db.js";

async function main() {
  const db = await getDb();
  const records = await db.select().from(platformSettings);
  console.log("All setting keys:", records.map(r => r.settingKey));
  process.exit(0);
}
main();
