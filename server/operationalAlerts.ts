import { createAccountFlag, markAccountSuspicious } from "./db";
import { notifyOwner } from "./_core/notification";

export type AlertKind = "quota_exceeded" | "rate_circuit" | "suspicious_usage";

const alertCopy: Record<AlertKind, { title: string; description: string }> = {
  quota_exceeded: { title: "TokenForge quota reached", description: "A TokenForge account reached its daily allowance." },
  rate_circuit: { title: "TokenForge rate-limit circuit", description: "A TokenForge account or source IP triggered the rate-limit circuit breaker." },
  suspicious_usage: { title: "TokenForge suspicious usage flag", description: "A TokenForge account was marked for review after repeated rate-limit behavior." },
};

export async function raiseOperationalAlert(kind: AlertKind, input: { userId: number; requestId: string; reason: string }) {
  await createAccountFlag({ userId: input.userId, kind, reason: input.reason });
  if (kind === "suspicious_usage") await markAccountSuspicious(input.userId);
  const copy = alertCopy[kind];
  try {
    await notifyOwner({ title: copy.title, content: `${copy.description}\n\nAccount ID: ${input.userId}\nRequest ID: ${input.requestId}\nReason: ${input.reason}` });
  } catch {
    // Notification delivery must not interrupt a customer API response.
  }
}
