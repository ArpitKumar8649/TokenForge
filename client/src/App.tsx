import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Docs from "./pages/Docs";
import DeveloperDashboard from "./pages/DeveloperDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Qwen38MaxProviderSettings from "./pages/Qwen38MaxProviderSettings";
import AdminSettings from "./pages/AdminSettings";
import DemoWorkspace from "./pages/DemoWorkspace";
import Home from "./pages/Home";
import Legal from "./pages/Legal";
import Models from "./pages/Models";
import Pricing from "./pages/Pricing";
import LocalAuth from "./pages/LocalAuth";
import DiscordVerify from "./pages/DiscordVerify";
import { RouteLoader } from "./components/RouteLoader";
import "./tokenforge-refresh.css";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/models"} component={Models} />
      <Route path={"/docs"} component={Docs} />
      <Route path={"/demo"} component={DemoWorkspace} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/signin"}>{() => <LocalAuth mode="signin" />}</Route>
      <Route path={"/signup"}>{() => <LocalAuth mode="signup" />}</Route>
      <Route path={"/sign-up"}>{() => <LocalAuth mode="signup" />}</Route>
      <Route path={"/verify-discord"}>{() => <DiscordVerify />}</Route>
      <Route path={"/dashboard"}>{() => <DeveloperDashboard section="overview" />}</Route>
      <Route path={"/dashboard/playground"}>{() => <DeveloperDashboard section="playground" />}</Route>
      <Route path={"/dashboard/models"}>{() => <DeveloperDashboard section="models" />}</Route>
      <Route path={"/dashboard/models/:modelId"}>{params => <DeveloperDashboard section="model" modelId={params.modelId} />}</Route>
      <Route path={"/dashboard/keys"}>{() => <DeveloperDashboard section="keys" />}</Route>
      <Route path={"/dashboard/referrals"}>{() => <DeveloperDashboard section="referrals" />}</Route>
      <Route path={"/dashboard/usage"}>{() => <DeveloperDashboard section="usage" />}</Route>
      <Route path={"/dashboard/profile"}>{() => <DeveloperDashboard section="profile" />}</Route>
      <Route path={"/admin/settings"} component={AdminSettings} />
      <Route path={"/admin/qwen3.8-max"} component={Qwen38MaxProviderSettings} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/legal/:page"} component={Legal} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <RouteLoader />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
