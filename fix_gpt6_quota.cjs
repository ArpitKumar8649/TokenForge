const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf8');

const oldFuncStart = `export async function getGpt6AstraQuotaStatus(user: { id: number; role?: string; openId?: string }): Promise<Gpt6AstraQuotaStatus> {
  const isAdmin = user.role === "admin" || user.openId === ADMIN_SESSION_PRINCIPAL_OPEN_ID;
  const isExempt = await isUserGpt6AstraPremiumExempt(user);`;

const newFuncStart = `export async function getGpt6AstraQuotaStatus(user: { id: number; role?: string; openId?: string }): Promise<Gpt6AstraQuotaStatus> {
  let role = user.role;
  let openId = user.openId;

  if (role === undefined || openId === undefined) {
    const userRow = await getUserById(user.id);
    if (userRow) {
      if (role === undefined) role = userRow.role;
      if (openId === undefined) openId = userRow.openId;
    }
  }

  const isAdmin = role === "admin" || openId === ADMIN_SESSION_PRINCIPAL_OPEN_ID;
  const isExempt = await isUserGpt6AstraPremiumExempt(user);`;

if (code.includes(oldFuncStart)) {
  code = code.replace(oldFuncStart, newFuncStart);
  fs.writeFileSync('server/db.ts', code);
  console.log("Successfully replaced getGpt6AstraQuotaStatus logic");
} else {
  console.log("Could not find the function start to replace");
}
