import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RouteLoader } from "./components/RouteLoader";
import { SupportChatWidget } from "./components/SupportChatWidget";
import "./tokenforge-refresh.css";

function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((error) => {
      return new Promise<{ default: T }>((resolve, reject) => {
        setTimeout(() => {
          factory()
            .then(resolve)
            .catch(() => {
              const retryKey = "tf_chunk_reload";
              if (!sessionStorage.getItem(retryKey)) {
                sessionStorage.setItem(retryKey, "1");
                window.location.reload();
              } else {
                sessionStorage.removeItem(retryKey);
                reject(error);
              }
            });
        }, 800);
      });
    })
  );
}

// Lazy-load pages with automatic retry so transient dev server rebuilds
// or network hiccups do not crash the app into the error boundary.
const Home = lazyWithRetry(() => import("./pages/Home"));
const Models = lazyWithRetry(() => import("./pages/Models"));
const Docs = lazyWithRetry(() => import("./pages/Docs"));
const DemoWorkspace = lazyWithRetry(() => import("./pages/DemoWorkspace"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const LocalAuth = lazyWithRetry(() => import("./pages/LocalAuth"));
const DiscordVerify = lazyWithRetry(() => import("./pages/DiscordVerify"));
const DeveloperDashboard = lazyWithRetry(() => import("./pages/DeveloperDashboard"));
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"));
const Qwen38MaxProviderSettings = lazyWithRetry(() => import("./pages/Qwen38MaxProviderSettings"));
const AdminSettings = lazyWithRetry(() => import("./pages/AdminSettings"));
const Legal = lazyWithRetry(() => import("./pages/Legal"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

function RouteBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"}>
        <RouteBoundary><Home /></RouteBoundary>
      </Route>
      <Route path={"/models"}>
        <RouteBoundary><Models /></RouteBoundary>
      </Route>
      <Route path={"/docs"}>
        <RouteBoundary><Docs /></RouteBoundary>
      </Route>
      <Route path={"/demo"}>
        <RouteBoundary><DemoWorkspace /></RouteBoundary>
      </Route>
      <Route path={"/pricing"}>
        <RouteBoundary><Pricing /></RouteBoundary>
      </Route>
      <Route path={"/signin"}>
        <RouteBoundary><LocalAuth mode="signin" /></RouteBoundary>
      </Route>
      <Route path={"/login"}>
        <Redirect to="/signin" />
      </Route>
      <Route path={"/signup"}>
        <RouteBoundary><LocalAuth mode="signup" /></RouteBoundary>
      </Route>
      <Route path={"/sign-up"}>
        <RouteBoundary><LocalAuth mode="signup" /></RouteBoundary>
      </Route>
      <Route path={"/verify-discord"}>
        <Redirect to="/dashboard" />
      </Route>
      <Route path={"/dashboard"}>
        <RouteBoundary><DeveloperDashboard section="overview" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/playground"}>
        <RouteBoundary><DeveloperDashboard section="playground" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/models"}>
        <RouteBoundary><DeveloperDashboard section="models" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/models/:modelId"}>
        {params => <RouteBoundary><DeveloperDashboard section="model" modelId={params.modelId} /></RouteBoundary>}
      </Route>
      <Route path={"/dashboard/pricing"}>
        <RouteBoundary><DeveloperDashboard section="pricing" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/keys"}>
        <RouteBoundary><DeveloperDashboard section="keys" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/tickets"}>
        <RouteBoundary><DeveloperDashboard section="tickets" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/referrals"}>
        <RouteBoundary><DeveloperDashboard section="referrals" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/usage"}>
        <RouteBoundary><DeveloperDashboard section="usage" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/transactions"}>
        <RouteBoundary><DeveloperDashboard section="transactions" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/payments"}>
        <Redirect to="/dashboard/transactions" />
      </Route>
      <Route path={"/dashboard/profile"}>
        <RouteBoundary><DeveloperDashboard section="profile" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/admin"}>
        <Redirect to="/admin" />
      </Route>
      <Route path={"/dashboard/admin/:rest*"}>
        {(params) => <Redirect to={`/admin/${params.rest ?? ""}`} />}
      </Route>
      <Route path={"/debug/cache"}>
        <RouteBoundary><AdminDashboard initialSection="cache" /></RouteBoundary>
      </Route>
      <Route path={"/admin/cache"}>
        <RouteBoundary><AdminDashboard initialSection="cache" /></RouteBoundary>
      </Route>
      <Route path={"/admin/settings"}>
        <RouteBoundary><AdminSettings /></RouteBoundary>
      </Route>
      <Route path={"/admin/qwen3.8-max"}>
        <RouteBoundary><Qwen38MaxProviderSettings /></RouteBoundary>
      </Route>
      <Route path={"/admin/sonnet4.6"}>
        <RouteBoundary><AdminDashboard /></RouteBoundary>
      </Route>
      <Route path={"/admin/support"}>
        <RouteBoundary><AdminDashboard initialSection="live-chat" /></RouteBoundary>
      </Route>
      <Route path={"/admin/live-chat"}>
        <RouteBoundary><AdminDashboard initialSection="live-chat" /></RouteBoundary>
      </Route>
      <Route path={"/admin"}>
        <RouteBoundary><AdminDashboard /></RouteBoundary>
      </Route>
      <Route path={"/legal/:page"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/legal"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/terms"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/terms-of-service"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/privacy"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/privacy-policy"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/refund"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/refunds"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/refund-policy"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/cancellation"}>
        <RouteBoundary><Legal /></RouteBoundary>
      </Route>
      <Route path={"/404"}>
        <RouteBoundary><NotFound /></RouteBoundary>
      </Route>
      <Route>
        <RouteBoundary><NotFound /></RouteBoundary>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
          <SupportChatWidget />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
