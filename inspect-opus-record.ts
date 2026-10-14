import { getClaudeOpus5RuntimeConfig } from "./server/db.js";

async function main() {
  const config = await getClaudeOpus5RuntimeConfig();
  console.log("Providers in DB record:", config.providers.map((p: any) => ({
    id: p.id,
    label: p.label,
    enabled: p.enabled,
    model: p.model,
    baseUrl: p.baseUrl,
    apiKeys: p.apiKeys
  })));
  process.exit(0);
}
main();
