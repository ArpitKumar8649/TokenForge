export type IdentifiedApiKey = { id: number };

/**
 * Returns a cache-safe key list with the newly created credential visible first.
 * The filter prevents duplicate rows if a concurrent refetch includes the same key.
 */
export function prependCreatedApiKey<T extends IdentifiedApiKey>(current: T[] | undefined, created: T): T[] {
  return [created, ...(current ?? []).filter(key => key.id !== created.id)];
}

export type RevocableApiKey = IdentifiedApiKey & { status: "active" | "revoked"; revokedAt: Date | null };

export function markApiKeyRevoked<T extends RevocableApiKey>(current: T[] | undefined, apiKeyId: number, revokedAt: Date): T[] | undefined {
  return current?.map(key => key.id === apiKeyId ? { ...key, status: "revoked" as const, revokedAt } : key);
}
