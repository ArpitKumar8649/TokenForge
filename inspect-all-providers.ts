import { 
  getClaudeOpus5RuntimeConfig, 
  getClaudeFable5NvidiaRuntimeConfig, 
  getGlm53RuntimeConfig, 
  getDeepseekV4ProRuntimeConfig, 
  getSonnet46RuntimeConfig, 
  getQwen38MaxRuntimeConfig 
} from "./server/db.js";

async function check(name: string, fn: () => Promise<any>) {
  try {
    const config = await fn();
    console.log(`=== ${name} ===`);
    const providers = config.providers || [config];
    for (const p of providers) {
      console.log(`Provider: id=${p.id || 'single'}, label=${p.label || name}, enabled=${p.enabled}`);
      (p.apiKeys || []).forEach((k: string, i: number) => {
        const hasMask = k.includes("•") || k.includes("…");
        const nonAscii = [];
        for (let j = 0; j < k.length; j++) {
          if (k.charCodeAt(j) < 0x20 || k.charCodeAt(j) > 0x7E) {
            nonAscii.push({ index: j, code: k.charCodeAt(j), char: k[j] });
          }
        }
        console.log(`  Key[${i}]: len=${k.length}, isMasked=${hasMask}, nonAsciiCount=${nonAscii.length}, preview=${k.slice(0, 4)}...${k.slice(-4)}`);
      });
    }
  } catch (e: any) {
    console.log(`Error checking ${name}:`, e.message);
  }
}

async function main() {
  await check("Claude Opus 5", getClaudeOpus5RuntimeConfig);
  await check("Claude Fable 5", getClaudeFable5NvidiaRuntimeConfig);
  await check("GLM 5.3", getGlm53RuntimeConfig);
  await check("Deepseek V4 Pro", getDeepseekV4ProRuntimeConfig);
  await check("Sonnet 4.6", getSonnet46RuntimeConfig);
  await check("Qwen 3.8 Max", getQwen38MaxRuntimeConfig);
  process.exit(0);
}
main();
