import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RouteLoader } from "./components/RouteLoader";
import "./tokenforge-refresh.css";

// Lazy-load pages so each route's JavaScript is fetched on demand rather than
// bloating the initial bundle. A crash in one page is isolated by its own
// error boundary (see RouteBoundary) instead of taking down the whole app.
const Home = lazy(() => import("./pages/Home"));
const Models = lazy(() => import("./pages/Models"));
const Docs = lazy(() => import("./pages/Docs"));
const DemoWorkspace = lazy(() => import("./pages/DemoWorkspace"));
const Pricing = lazy(() => import("./pages/Pricing"));
const LocalAuth = lazy(() => import("./pages/LocalAuth"));
const DiscordVerify = lazy(() => import("./pages/DiscordVerify"));
const DeveloperDashboard = lazy(() => import("./pages/DeveloperDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Qwen38MaxProviderSettings = lazy(() => import("./pages/Qwen38MaxProviderSettings"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const Legal = lazy(() => import("./pages/Legal"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
      <Route path={"/signup"}>
        <RouteBoundary><LocalAuth mode="signup" /></RouteBoundary>
      </Route>
      <Route path={"/sign-up"}>
        <RouteBoundary><LocalAuth mode="signup" /></RouteBoundary>
      </Route>
      <Route path={"/verify-discord"}>
        <RouteBoundary><DiscordVerify /></RouteBoundary>
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
      <Route path={"/dashboard/keys"}>
        <RouteBoundary><DeveloperDashboard section="keys" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/referrals"}>
        <RouteBoundary><DeveloperDashboard section="referrals" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/usage"}>
        <RouteBoundary><DeveloperDashboard section="usage" /></RouteBoundary>
      </Route>
      <Route path={"/dashboard/profile"}>
        <RouteBoundary><DeveloperDashboard section="profile" /></RouteBoundary>
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
      <Route path={"/admin"}>
        <RouteBoundary><AdminDashboard /></RouteBoundary>
      </Route>
      <Route path={"/legal/:page"}>
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
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
