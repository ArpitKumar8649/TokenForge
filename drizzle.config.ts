import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// Parse connection URL for TiDB SSL support
const url = new URL(connectionString);
const sslEnabled = url.hostname.includes("tidbcloud.com");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
    ...(sslEnabled ? {
      connection: {
        ssl: { rejectUnauthorized: true },
      },
    } : {}),
  },
});
