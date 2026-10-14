import { getClaudeOpus5RuntimeConfig } from "./server/db.js";

async function main() {
  const config = await getClaudeOpus5RuntimeConfig();
  console.log("Providers count:", config.providers.length);
  for (const p of config.providers) {
    console.log("--- Provider:", p.id, p.label, p.model, p.baseUrl, "enabled:", p.enabled);
    console.log("  apiKeys count:", p.apiKeys.length);
    p.apiKeys.forEach((k, i) => {
      const len = k.length;
      const invalidChars: { code: number; char: string; index: number }[] = [];
      for (let j = 0; j < k.length; j++) {
        const code = k.charCodeAt(j);
        // Valid header value chars: 0x20 to 0x7E, or tab 0x09
        if (code < 0x20 || code > 0x7E) {
          invalidChars.push({ code, char: JSON.stringify(k[j]), index: j });
        }
      }
      console.log(`  Key [${i}]: length=${len}, startsWith=${k.slice(0, 8)}..., invalidChars=`, invalidChars);
    });
  }
  process.exit(0);
}
main().catch(console.error);
