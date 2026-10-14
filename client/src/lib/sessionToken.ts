import { COOKIE_NAME } from "@shared/const";

const TOKEN_KEY = "tokenforge_session_token";
const COOKIE_STORAGE_KEY = "manus-cookie";

export function persistSessionToken(token: string): void {
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(COOKIE_STORAGE_KEY, `${COOKIE_NAME}=${token}`);
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(COOKIE_STORAGE_KEY, `${COOKIE_NAME}=${token}`);
  } catch {
    // ignore storage access restrictions
  }
}

export function getStoredSessionToken(): string | null {
  try {
    const directToken =
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY);
    if (directToken) return directToken;

    const raw =
      localStorage.getItem(COOKIE_STORAGE_KEY) ||
      sessionStorage.getItem(COOKIE_STORAGE_KEY);
    if (raw) {
      const prefix = `${COOKIE_NAME}=`;
      const pair = raw.split(";").find((s) => s.trim().startsWith(prefix));
      const token = pair?.trim().slice(prefix.length);
      if (token) return token;
    }
  } catch {
    // ignore storage access restrictions
  }
  return null;
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(COOKIE_STORAGE_KEY);
    localStorage.removeItem("manus-runtime-user-info");
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(COOKIE_STORAGE_KEY);
  } catch {
    // ignore storage access restrictions
  }
}
