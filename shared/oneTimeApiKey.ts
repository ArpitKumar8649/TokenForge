let activePageApiKey: string | null = null;

/**
 * Holds a newly revealed plaintext API key only in browser memory. It is never
 * written to localStorage, sessionStorage, the URL, or a server request.
 */
export function rememberOneTimeApiKey(apiKey: string): void {
  activePageApiKey = apiKey;
}

export function getOneTimeApiKey(): string | null {
  return activePageApiKey;
}

export function clearOneTimeApiKey(): void {
  activePageApiKey = null;
}
