import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  (window as any).Buffer = (window as any).Buffer || Buffer;
}

import { trpc } from "@/lib/trpc";
import { getStoredSessionToken } from "@/lib/sessionToken";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

// Ignore benign ResizeObserver notification warnings that happen during layout calculation
if (typeof window !== "undefined") {
  const isResizeObserverError = (msg?: string | null) =>
    typeof msg === "string" &&
    (msg.includes("ResizeObserver loop completed with undelivered notifications") ||
      msg.includes("ResizeObserver loop limit exceeded"));

  window.addEventListener("error", (e) => {
    if (isResizeObserverError(e.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });

  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === "string" && isResizeObserverError(args[0])) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

// Safely load analytics only when configured
const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
if (analyticsEndpoint && analyticsWebsiteId && typeof document !== "undefined") {
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${analyticsEndpoint}/umami`;
  script.setAttribute("data-website-id", analyticsWebsiteId);
  document.head.appendChild(script);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(failureCount, error: any) {
        if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
      refetchOnWindowFocus: false,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  if (window.location.pathname !== "/signin" && window.location.pathname !== "/signup" && window.location.pathname !== "/sign-up") {
    window.location.assign(`/signin?returnTo=${encodeURIComponent(window.location.pathname)}`);
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    // Do not log expected unauthorized errors as console errors
    if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) {
      return;
    }
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) {
      return;
    }
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Persistent session resolution: checks localStorage and sessionStorage
        // so users remain logged in across page refreshes, tab closures, and browser restarts.
        const token = getStoredSessionToken();
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
        return {};
      },
      async fetch(input, init) {
        let lastError: any;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await globalThis.fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });

            // If the response is HTML (e.g. gateway 502/503 during restart or custom error page),
            // prevent JSON.parse/superjson from throwing "Unexpected token '<', <!doctype..."
            const contentType = res.headers.get("content-type") || "";
            if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
              if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
                continue;
              }
              // Return a structured JSON error response that tRPC client can parse safely
              return new Response(
                JSON.stringify([
                  {
                    error: {
                      message: `Service temporarily unavailable (received ${res.status || 503} non-JSON response). Retrying in a moment.`,
                      code: -32000,
                      data: { httpStatus: res.status >= 400 ? res.status : 503 },
                    },
                  },
                ]),
                {
                  status: res.status >= 400 ? res.status : 503,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }

            return res;
          } catch (err: any) {
            lastError = err;
            const isNetworkError =
              err?.name === "TypeError" ||
              (typeof err?.message === "string" &&
                (err.message.includes("fetch") || err.message.includes("NetworkError")));
            if (attempt < 2 && isNetworkError) {
              await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
              continue;
            }
            throw err;
          }
        }
        throw lastError;
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
