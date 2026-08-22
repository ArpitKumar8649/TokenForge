import { getDeepseekV4ProProviderSettings, updateDeepseekV4ProProviderSettings } from "../server/db";

async function main() {
  const settings = await getDeepseekV4ProProviderSettings();
  if (settings.updatedByUserId == null) {
    throw new Error("The DeepSeek V4 Pro override has no administrator audit owner; clear it from the administrator panel instead.");
  }

  const providers = settings.providers.map(provider => ({
    id: provider.id,
    label: provider.label,
    enabled: provider.enabled,
    baseUrl: provider.baseUrl,
    model: provider.model,
    apiKeys: [],
    removeSlots: provider.apiKeyMasks.map(key => key.slot),
  }));
  const clearedCount = settings.providers.reduce((total, provider) => total + provider.apiKeyMasks.length, 0);
  const persisted = await updateDeepseekV4ProProviderSettings({ providers }, settings.updatedByUserId);
  const remainingCount = persisted.providers.reduce((total, provider) => total + provider.apiKeyMasks.length, 0);
  if (remainingCount !== 0) throw new Error("DeepSeek V4 Pro key clear verification failed");
  console.log(`DeepSeek V4 Pro cleared ${clearedCount} stored API-key slot(s); ${remainingCount} remain.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "DeepSeek V4 Pro credential clear failed");
  process.exitCode = 1;
});
