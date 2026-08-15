import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { Boxes, ChartNoAxesCombined, FlaskConical, Gift, KeyRound, LayoutDashboard, LogOut, PanelLeft, Settings2, Shield, UserRound } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { TOKENFORGE_POST_LOGOUT_PATH } from "../../../shared/authNavigation";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { FirstTimeOnboarding } from "./FirstTimeOnboarding";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { TokenForgeGlyph } from "./TokenForgeGlyph";
import "./dashboard-shell.css";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: FlaskConical, label: "Playground", path: "/dashboard/playground" },
  { icon: Boxes, label: "Models", path: "/dashboard/models" },
  { icon: KeyRound, label: "API keys", path: "/dashboard/keys" },
  { icon: Gift, label: "Referrals", path: "/dashboard/referrals" },
  { icon: ChartNoAxesCombined, label: "Usage logs", path: "/dashboard/usage" },
  { icon: UserRound, label: "Profile", path: "/dashboard/profile" },
  { icon: Shield, label: "Admin", path: "/admin", adminOnly: true },
  { icon: Settings2, label: "Settings", path: "/admin/settings", adminOnly: true },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires a TokenForge account. Create one or sign in to continue.
            </p>
          </div>
          <div className="w-full grid grid-cols-2 gap-3">
            <Button asChild size="lg" className="shadow-lg hover:shadow-xl transition-all"><Link href="/signin">Sign in</Link></Button>
            <Button asChild variant="outline" size="lg"><Link href="/signup">Create account</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
      <FirstTimeOnboarding user={user} />
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    await logout();
    setLocation(TOKENFORGE_POST_LOGOUT_PATH);
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="dashboard-sidebar-header">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="dashboard-sidebar-brand min-w-0">
                  <TokenForgeGlyph className="dashboard-sidebar-brand__glyph" />
                  <div><span>Token<span>Forge</span></span><small>Developer gateway</small></div>
                </div>
              ) : <TokenForgeGlyph className="dashboard-sidebar-brand__glyph dashboard-sidebar-brand__glyph--collapsed" />}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.filter(item => !item.adminOnly || user?.isAdminSession === true).map(item => {
                const isActive = location === item.path || (item.path === "/dashboard/models" && location.startsWith("/dashboard/models/"));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                    {user?.isAdminSession === true && <p className="mt-1 inline-flex rounded-md bg-[#c9ff73]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#8abd34]">Admin</p>}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => void handleSignOut()}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="dashboard-inset">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar__brand">
            {isMobile && <SidebarTrigger className="dashboard-topbar__trigger" />}
            <Link href="/dashboard" className="dashboard-topbar__logo" aria-label="TokenForge dashboard home">
              <TokenForgeGlyph className="dashboard-topbar__glyph" />
              <span>Token<span>Forge</span></span>
            </Link>
            <span className="dashboard-topbar__divider" />
            <span className="dashboard-topbar__section">{activeMenuItem?.label ?? "Workspace"}</span>
          </div>
          <div className="dashboard-topbar__actions">
            {user?.isAdminSession === true && <span className="rounded-md bg-[#c9ff73]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#9fd743]">Admin session</span>}
            <span className="dashboard-topbar__status"><i /> Gateway ready</span>
            <Link href="/docs">Documentation</Link>
          </div>
        </header>
        <AnnouncementBanner />
        <main className="dashboard-main">{children}</main>
        <footer className="dashboard-footer">
          <div><TokenForgeGlyph className="dashboard-footer__glyph" /><span>Token<span>Forge</span> developer workspace</span></div>
          <p>Curated models. Visible limits. Deliberate building.</p>
          <nav aria-label="Dashboard footer"><Link href="/models">Models</Link><Link href="/pricing">Pricing</Link><Link href="/docs">Docs</Link><Link href="/legal/terms">Trust</Link></nav>
        </footer>
      </SidebarInset>
    </>
  );
}
