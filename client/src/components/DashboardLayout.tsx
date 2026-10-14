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
import { ArrowLeftRight, Boxes, ChartNoAxesCombined, CreditCard, FlaskConical, Gift, KeyRound, LayoutDashboard, LifeBuoy, LogOut, PanelLeft, Receipt, Settings2, Shield, Ticket, UserRound } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThreeDButton } from "@/components/ui/3d-button";
import { TOKENFORGE_POST_LOGOUT_PATH } from "../../../shared/authNavigation";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { LoginWelcomeTour } from "./LoginWelcomeTour";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { MaintenanceCountdownBanner } from "./MaintenanceCountdownBanner";
import { TokenForgeGlyph } from "./TokenForgeGlyph";
import { PearlAvatar } from "@/components/ui/pearl-avatar";
import { UserTierBadge } from "@/components/UserTierBadge";
import "./dashboard-shell.css";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: FlaskConical, label: "Playground", path: "/dashboard/playground" },
  { icon: Boxes, label: "Models", path: "/dashboard/models" },
  { icon: CreditCard, label: "Pricing", path: "/dashboard/pricing" },
  { icon: KeyRound, label: "API keys", path: "/dashboard/keys" },
  { icon: Ticket, label: "Tickets", path: "/dashboard/tickets" },
  { icon: Gift, label: "Referrals", path: "/dashboard/referrals" },
  { icon: ChartNoAxesCombined, label: "Usage logs", path: "/dashboard/usage" },
  { icon: ArrowLeftRight, label: "Transactions", path: "/dashboard/transactions" },
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
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="h-[42px] px-6 shadow-lg hover:shadow-xl transition-all"><Link href="/signin">Sign in</Link></Button>
            <ThreeDButton href="/signin" />
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
      <LoginWelcomeTour user={user} />
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
              {menuItems.filter(item => !item.adminOnly || user?.isAdminSession === true || user?.role === "admin").map(item => {
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
                <button className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.04] transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <PearlAvatar
                    size={36}
                    letter={user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "A"}
                  />
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-white/90">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <UserTierBadge tier={(user as any)?.tier} size="xs" showTag />
                      {user?.isAdminSession === true && <p className="inline-flex rounded-md bg-[#c9ff73]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#8abd34]">Admin</p>}
                    </div>
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
            {isMobile && <SidebarTrigger className="dashboard-topbar__trigger shrink-0" />}
            <Link href="/dashboard" className="dashboard-topbar__logo shrink-0" aria-label="TokenForge dashboard home">
              <TokenForgeGlyph className="dashboard-topbar__glyph" />
              <span>Token<span>Forge</span></span>
            </Link>
            <span className="dashboard-topbar__divider hidden sm:block" />
            <span className="dashboard-topbar__section hidden sm:inline-block truncate max-w-[120px] md:max-w-[200px]">{activeMenuItem?.label ?? "Workspace"}</span>
          </div>
          <div className="dashboard-topbar__actions">
            <UserTierBadge tier={(user as any)?.tier} size="xs" showTag className="hidden md:inline-flex" />
            <UserTierBadge tier={(user as any)?.tier} size="xs" showTag={false} className="inline-flex md:hidden" />
            {user?.isAdminSession === true && (
              <span className="rounded-md bg-[#c9ff73]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#9fd743] shrink-0">
                Admin<span className="hidden sm:inline"> session</span>
              </span>
            )}
            <span className="dashboard-topbar__status shrink-0">
              <i /> <span className="hidden sm:inline">Gateway </span>ready
            </span>
            <Link href="/docs" className="hidden lg:inline-block">Documentation</Link>
          </div>
        </header>
        <AnnouncementBanner />
        <MaintenanceCountdownBanner />
        <main className="dashboard-main">{children}</main>
        <footer className="dashboard-footer">
          <div><TokenForgeGlyph className="dashboard-footer__glyph" /><span>Token<span>Forge</span> developer workspace</span></div>
          <p>Curated models. Visible limits. Deliberate building. Credits are digital goods delivered instantly and are non-refundable once consumed.</p>
          <nav aria-label="Dashboard footer">
            <Link href="/models">Models</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/legal/terms">Terms of Service</Link>
            <Link href="/legal/privacy">Privacy Policy</Link>
            <Link href="/legal/refund">Refund Policy</Link>
            <a
              href="https://discord.gg/8DS5F6sGsY"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1"
            >
              Contact Details (Discord)
            </a>
          </nav>
        </footer>
      </SidebarInset>
    </>
  );
}
