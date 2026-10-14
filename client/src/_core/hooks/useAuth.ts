import { trpc } from "@/lib/trpc";
import { clearStoredSession, persistSessionToken } from "@/lib/sessionToken";
import { useCallback, useEffect, useMemo, useRef } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // Login is started via startLogin() in the effect below, only when we actually
  // navigate — never during render. startLogin() mints a one-time nonce + writes
  // the state cookie, so calling it per render would overwrite the cookie and
  // desync it from an in-flight login's `state`.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const isLoggingOutRef = useRef(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const sessionTokenQuery = trpc.auth.getSessionToken.useQuery(undefined, {
    enabled: Boolean(meQuery.data) && !isLoggingOutRef.current,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isLoggingOutRef.current) return;
    if (sessionTokenQuery.data?.sessionToken && meQuery.data) {
      persistSessionToken(sessionTokenQuery.data.sessionToken);
    }
  }, [sessionTokenQuery.data?.sessionToken, meQuery.data]);

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(async () => {
    isLoggingOutRef.current = true;
    try {
      // 1. Order: call auth.logout mutation
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      // Even if network or request fails, proceed to wipe local credentials and redirect
      console.warn("[Auth] Logout mutation failed or network error:", error);
    } finally {
      // 2. clearStoredSession() (localStorage + sessionStorage)
      clearStoredSession();
      // 3. utils.auth.me.setData(undefined, null)
      utils.auth.me.setData(undefined, null);
      // utils.auth.getSessionToken also set to null to avoid any resurrection
      utils.auth.getSessionToken.setData(undefined, { sessionToken: null });
      // 4. window.location.href = "/signin" (hard redirect)
      if (typeof window !== "undefined") {
        window.location.href = "/signin";
      }
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    if (!isLoggingOutRef.current && meQuery.data) {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(meQuery.data)
      );
    }
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    window.location.href = redirectPath || "/signin";
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}


