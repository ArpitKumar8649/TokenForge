const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf8');

const targetFunction = `export async function getGpt6AstraQuotaStatus(user: { id: number; role?: string; openId?: string }): Promise<Gpt6AstraQuotaStatus> {
  const isAdmin = user.role === "admin" || user.openId === ADMIN_SESSION_PRINCIPAL_OPEN_ID;
  if (isAdmin) {
    return {
      isAdmin: true,
      isPaidUser: true,
      usedThisMonth: 0,
      maxFreePerMonth: 5,
      remainingMessages: Infinity,
      isUnlimited: true,
      canAccessApi: true,
      canAccessPlayground: true,
    };
  }`;

const newFunction = `export async function getGpt6AstraQuotaStatus(user: { id: number; role?: string; openId?: string }): Promise<Gpt6AstraQuotaStatus> {
  const isAdmin = user.role === "admin" || user.openId === ADMIN_SESSION_PRINCIPAL_OPEN_ID;
  const isExempt = await isUserGpt6AstraPremiumExempt(user);
  if (isAdmin || isExempt) {
    return {
      isAdmin,
      isPaidUser: true,
      usedThisMonth: 0,
      maxFreePerMonth: 5,
      remainingMessages: Infinity,
      isUnlimited: true,
      canAccessApi: true,
      canAccessPlayground: true,
    };
  }`;

code = code.replace(targetFunction, newFunction);
fs.writeFileSync('server/db.ts', code);
