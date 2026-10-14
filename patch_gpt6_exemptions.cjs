const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf8');

const newCode = `
export type Gpt6AstraPremiumExemptionEntry = { email: string; updatedAt: string; updatedByUserId: number };
const GPT6_ASTRA_PREMIUM_EXEMPTIONS_SETTING_KEY = "gpt6_astra_premium_exemptions_v1";

export async function getGpt6AstraPremiumExemptions(): Promise<Gpt6AstraPremiumExemptionEntry[]> {
  try {
    const db = await getDb();
    let rawValue: string | undefined;
    if (!db) {
      rawValue = fallbackPlatformSettings.get(GPT6_ASTRA_PREMIUM_EXEMPTIONS_SETTING_KEY)?.value;
    } else {
      const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, GPT6_ASTRA_PREMIUM_EXEMPTIONS_SETTING_KEY)).limit(1))[0];
      rawValue = record?.value;
      if (rawValue) {
        fallbackPlatformSettings.set(GPT6_ASTRA_PREMIUM_EXEMPTIONS_SETTING_KEY, { value: rawValue, updatedAt: record.updatedAt || new Date(), updatedByUserId: record.updatedByUserId });
      }
    }
    if (!rawValue) return [];
    return JSON.parse(rawValue);
  } catch (err) {
    console.error("[GPT6 Premium Exemption Parse Error]", err);
    return [];
  }
}

export async function setGpt6AstraPremiumExemption(
  emailInput: string,
  updatedByUserId: number
): Promise<Gpt6AstraPremiumExemptionEntry[]> {
  const email = normalizeEmail(emailInput);
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address");
  }
  const current = await getGpt6AstraPremiumExemptions();
  const existingIdx = current.findIndex(e => normalizeEmail(e.email) === email);
  const now = new Date().toISOString();
  let updated: Gpt6AstraPremiumExemptionEntry[];
  if (existingIdx >= 0) {
    updated = current.map((entry, idx) => idx === existingIdx ? { email, updatedAt: now, updatedByUserId } : entry);
  } else {
    updated = [{ email, updatedAt: now, updatedByUserId }, ...current];
  }
  const serialized = JSON.stringify(updated);
  fallbackPlatformSettings.set(GPT6_ASTRA_PREMIUM_EXEMPTIONS_SETTING_KEY, { value: serialized, updatedAt: new Date(), updatedByUserId });
  try {
    const db = await getDb();
    if (db) {
      await db.insert(platformSettings).values({
        settingKey: GPT6_ASTRA_PREMIUM_EXEMPTIONS_SETTING_KEY,
        value: serialized,
        updatedByUserId
      }).onDuplicateKeyUpdate({ set: { value: serialized, updatedByUserId, updatedAt: new Date() } });
    }
  } catch (err) {
    console.error("[GPT6 Premium Exemption Persist Error]", err);
  }
  return updated;
}

export async function removeGpt6AstraPremiumExemption(
  emailInput: string,
  updatedByUserId: number
): Promise<Gpt6AstraPremiumExemptionEntry[]> {
  const email = normalizeEmail(emailInput);
  const current = await getGpt6AstraPremiumExemptions();
  const updated = current.filter(e => normalizeEmail(e.email) !== email);
  const serialized = JSON.stringify(updated);
  fallbackPlatformSettings.set(GPT6_ASTRA_PREMIUM_EXEMPTIONS_SETTING_KEY, { value: serialized, updatedAt: new Date(), updatedByUserId });
  try {
    const db = await getDb();
    if (db) {
      await db.insert(platformSettings).values({
        settingKey: GPT6_ASTRA_PREMIUM_EXEMPTIONS_SETTING_KEY,
        value: serialized,
        updatedByUserId
      }).onDuplicateKeyUpdate({ set: { value: serialized, updatedByUserId, updatedAt: new Date() } });
    }
  } catch (err) {
    console.error("[GPT6 Premium Exemption Removal Error]", err);
  }
  return updated;
}

export async function isUserGpt6AstraPremiumExempt(
  target: number | string | { id?: number; email?: string | null } | undefined | null
): Promise<boolean> {
  if (!target) return false;
  try {
    let email: string | null = null;
    if (typeof target === "string") {
      email = target;
    } else if (typeof target === "number") {
      const user = await getUserById(target);
      email = user?.email ?? null;
    } else if (typeof target === "object") {
      if (target.email) {
        email = target.email;
      } else if (typeof target.id === "number") {
        const user = await getUserById(target.id);
        email = user?.email ?? null;
      }
    }

    if (!email) return false;
    const normalized = normalizeEmail(email);
    if (!normalized) return false;

    const exemptions = await getGpt6AstraPremiumExemptions();
    const match = exemptions.find((entry) => normalizeEmail(entry.email) === normalized);
    return !!match;
  } catch (err) {
    console.error("[GPT6 Premium Exemption Check Error]", err);
    return false;
  }
}
`;

code = code.replace(
  'export type MaintenanceCountdown = { endsAt: number; note: string } | null;',
  newCode + '\nexport type MaintenanceCountdown = { endsAt: number; note: string } | null;'
);

// Add to platform settings map
code = code.replace(
  '["platform_maintenance_exemptions_v1", { value: "[]", updatedAt: new Date(), updatedByUserId: null }],',
  '["platform_maintenance_exemptions_v1", { value: "[]", updatedAt: new Date(), updatedByUserId: null }],\n  ["gpt6_astra_premium_exemptions_v1", { value: "[]", updatedAt: new Date(), updatedByUserId: null }],'
);

fs.writeFileSync('server/db.ts', code);
