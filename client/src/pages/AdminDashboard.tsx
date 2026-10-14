import AdminSupport from "./admin/Support";
import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import LiveRequestLog from "./LiveRequestLog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ChartNoAxesCombined,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import "../dashboard.css";

import {
  AdminAccount,
  AdminAuditRecord,
  AdminGlobalModelUsage,
  ManagedProviderKeyMetricGroup,
  SpecialReferralCampaignData,
  ProviderTelemetryItem,
  ManagedModelOverviewItem,
} from "@/components/admin/types";
import { formatTokens, Metric, SectionHeader } from "@/components/admin/common/AdminCommon";
import { AdminUsageChart, EmailProviderChart } from "@/components/admin/overview/AdminCharts";
import { AccountsSection } from "@/components/admin/accounts/AccountsSection";
import { SpecialReferralCampaignSection } from "@/components/admin/campaign/SpecialReferralSection";
import {
  AuditTimeline,
  downloadAuditCsv,
  AnnouncementSection,
  CapacitySection,
  InferenceControlsSection,
} from "@/components/admin/overview/OperationsSections";
import { OperationalControls } from "@/components/admin/controls/OperationalControls";
import { Gpt6PremiumControls } from "@/components/admin/controls/Gpt6PremiumControls";

import { ManagedProviderSelector } from "@/components/admin/providers/ManagedProviderSelector";
import { Sonnet46ProviderBalancerPanel } from "@/components/admin/providers/ProvidersSection";
import { AdminTicketsSection } from "@/components/admin/tickets/AdminTicketsSection";
import { AdminAccessRequestsSection } from "@/components/admin/requests/AdminAccessRequestsSection";
import { AdminSafetyAuditSection } from "@/components/admin/safety/AdminSafetyAuditSection";
import { AdminUserMessageInspector } from "@/components/admin/inspector/AdminUserMessageInspector";
import { TransactionsWorkspace } from "@/components/TransactionsWorkspace";
import { AdminPricingSection } from "@/components/admin/pricing/AdminPricingSection";
import { CacheDebuggerTab } from "@/components/admin/CacheDebuggerTab";

export type AdminSection =
  | "overview"
  | "cache"
  | "accounts"
  | "user-logs"
  | "safety-audit"
  | "pricing"
  | "settlements"
  | "requests"
  | "tickets"
  | "campaign"
  | "controls"
  | "providers"
  | "operations"
  | "gpt6-premium"
  | "announcement"
  | "activity"
  | "live"
  | "live-chat";

export default function AdminDashboard({ initialSection }: { initialSection?: AdminSection } = {}) {
  const { user, loading } = useAuth();
  const isAdminSession = user?.isAdminSession === true;

  const overview = trpc.admin.overview.useQuery(undefined, {
    enabled: isAdminSession,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
  });
  const flags = trpc.admin.flags.useQuery(undefined, { enabled: isAdminSession, refetchInterval: 45_000 });
  const activityFeed = trpc.admin.activity.useQuery({ limit: 40 }, { enabled: isAdminSession, refetchInterval: 45_000 });
  const auditExport = trpc.admin.auditExport.useQuery(undefined, { enabled: false });
  const announcement = trpc.admin.announcement.useQuery(undefined, { enabled: isAdminSession });
  const specialReferralCampaign = trpc.admin.specialReferralCampaign.useQuery(undefined, {
    enabled: isAdminSession,
    refetchInterval: 60_000,
  });

  const utils = trpc.useUtils();
  const [adminPasscode, setAdminPasscode] = useState("");
  const [section, setSection] = useState<AdminSection>(() => {
    if (initialSection) return initialSection;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get("tab") as AdminSection;
      if (tab) return tab;
      if (window.location.pathname.includes("/admin/support") || window.location.pathname.includes("/admin/live-chat")) {
        return "live-chat";
      }
      if (window.location.pathname.includes("/debug/cache") || window.location.pathname.includes("/admin/cache")) {
        return "cache";
      }
    }
    return "overview";
  });
  const [announcementText, setAnnouncementText] = useState("");
  const [modelQuery, setModelQuery] = useState("");

  const modelControl = trpc.admin.setModelEnabled.useMutation({
    onSuccess: () => {
      utils.admin.overview.invalidate();
      toast.success("Model availability updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const modelTierControl = trpc.admin.setModelMinTier.useMutation({
    onSuccess: (data) => {
      utils.admin.overview.invalidate();
      toast.success(`Access tier for ${data.modelId} set to ${data.minTier}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const modelPaygControl = trpc.admin.setModelIsPayg.useMutation({
    onSuccess: (data) => {
      utils.admin.overview.invalidate();
      toast.success(`PAYG tag for ${data.modelId} set to ${data.isPayg ? "PAYG Enabled" : "PAYG Disabled"}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const modelBundleControl = trpc.admin.setModelIsBundle.useMutation({
    onSuccess: (data) => {
      utils.admin.overview.invalidate();
      toast.success(`Bundle access for ${data.modelId} set to ${data.isBundle ? "Bundle Enabled" : "Bundle Disabled"}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const modelTokenPlanControl = trpc.admin.setModelIsTokenPlan.useMutation({
    onSuccess: (data) => {
      utils.admin.overview.invalidate();
      toast.success(`Token Plan tag for ${data.modelId} set to ${data.isTokenPlan ? "Token Plan Enabled" : "Token Plan Disabled"}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const modelCompactScalingControl = trpc.admin.setModelCompactScaling.useMutation({
    onSuccess: (data) => {
      utils.admin.overview.invalidate();
      toast.success(
        data.enabled
          ? `Auto Compact Scaling enabled for ${data.modelId} (${data.triggerTokens.toLocaleString()} tokens)`
          : `Auto Compact Scaling disabled for ${data.modelId}`
      );
    },
    onError: (error) => toast.error(error.message),
  });


  const providerControl = trpc.admin.setProviderEnabled.useMutation({
    onSuccess: (result) => {
      utils.admin.overview.invalidate();
      toast.success(
        result.disabledModels
          ? `Provider paused; ${result.disabledModels} routed model${result.disabledModels === 1 ? "" : "s"} disabled`
          : "Provider availability updated"
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const providerVisionControl = trpc.admin.setProviderSupportsVision.useMutation({
    onSuccess: (result) => {
      utils.admin.overview.invalidate();
      toast.success(
        result.supportsVision
          ? `Multimodal Vision/Image input enabled for ${result.slug}`
          : `Multimodal Vision/Image input disabled for ${result.slug}`
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const providerDocumentsControl = trpc.admin.setProviderSupportsDocuments.useMutation({
    onSuccess: (result) => {
      utils.admin.overview.invalidate();
      toast.success(
        result.supportsDocuments
          ? `Document / PDF input enabled for ${result.slug}`
          : `Document / PDF input disabled for ${result.slug}`
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const unlockAdmin = trpc.admin.unlock.useMutation({
    onSuccess: async () => {
      setAdminPasscode("");
      await utils.auth.me.invalidate();
      toast.success("Administrator access activated; other sessions were signed out");
    },
    onError: (error) => toast.error(error.message),
  });

  const signOutAdmin = trpc.admin.signOut.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Administrator access revoked for this browser");
    },
    onError: (error) => toast.error(error.message),
  });

  const saveAnnouncement = trpc.admin.setAnnouncement.useMutation({
    onSuccess: async (result) => {
      setAnnouncementText(result.text ?? "");
      utils.admin.announcement.setData(undefined, result.text);
      await Promise.all([utils.public.announcement.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(result.text ? "Announcement published across TokenForge" : "Announcement cleared from TokenForge");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (announcement.data !== undefined) setAnnouncementText(announcement.data ?? "");
  }, [announcement.data]);

  const accounts = (overview.data?.accounts ?? []) as AdminAccount[];
  const managedProviderKeyMetrics = (overview.data?.managedProviderKeyMetrics ?? []) as ManagedProviderKeyMetricGroup[];
  const providerTelemetry = (overview.data?.providerTelemetry ?? []) as ProviderTelemetryItem[];
  const emailProviders = overview.data?.emailProviders ?? [];
  const providers = (overview.data?.providers ?? []) as Array<{ slug: string; displayName: string; enabled: boolean }>;
  const models = (overview.data?.models ?? []) as ManagedModelOverviewItem[];

  const downloadAuditExport = async () => {
    const result = await auditExport.refetch();
    if (!result.data) {
      toast.error("Audit export is temporarily unavailable");
      return;
    }
    downloadAuditCsv(result.data);
    toast.success("Privacy-safe audit export downloaded");
  };

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#09090b] text-[#c9ff73]">
        <Loader2 className="animate-spin" size={22} />
      </main>
    );
  }

  if (!isAdminSession) {
    return (
      <main className="min-h-screen bg-[#09090b] px-4 py-8 text-white sm:py-12">
        <section className="relative mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_90%_4%,rgba(201,255,115,.14),transparent_29%),linear-gradient(145deg,#131317,#09090b_72%)] p-6 shadow-2xl sm:p-9">
          <div className="absolute right-[-4rem] top-[-5rem] h-48 w-48 rounded-full border border-[#c9ff73]/15" />
          <div className="relative">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#c9ff73]/20 bg-[#b8fb59]/10 text-[#c9ff73]">
              <KeyRound size={19} />
            </div>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[.19em] text-[#c9ff73]">
              Operations console
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-.04em]">Unlock control plane</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#a8a9b6]">
              Administrator access is independent of a TokenForge developer account. Enter the owner passcode to create
              the only active administrator session; existing sessions are signed out when access is granted.
            </p>
            <form
              className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (adminPasscode.trim()) unlockAdmin.mutate({ passcode: adminPasscode });
              }}
            >
              <label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="admin-passcode">
                Administrator passcode
              </label>
              <Input
                id="admin-passcode"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={adminPasscode}
                onChange={(event) => setAdminPasscode(event.target.value)}
                placeholder="Enter passcode"
                className="mt-2 h-11 border-white/10 bg-black/20 text-white placeholder:text-[#707184]"
                disabled={unlockAdmin.isPending}
              />
              <Button
                type="submit"
                className="mt-4 h-11 w-full bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
                disabled={!adminPasscode.trim() || unlockAdmin.isPending}
              >
                {unlockAdmin.isPending ? (
                  <>
                    <Loader2 className="animate-spin" size={15} /> Verifying access
                  </>
                ) : (
                  "Unlock administrator access"
                )}
              </Button>
              <p className="mt-4 text-[11px] leading-5 text-[#858697]">
                The server verifies and rate-limits passcode attempts. The passcode is never saved in an account
                profile.
              </p>
            </form>
          </div>
        </section>
      </main>
    );
  }

  const metrics = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-4">
      <Metric
        icon={<UsersRound size={17} />}
        label="Accounts"
        value={(overview.data?.totals?.totalAccounts ?? accounts.length).toLocaleString()}
        detail="Total registered accounts"
      />
      <Metric
        icon={<ChartNoAxesCombined size={17} />}
        label="Total tokens processed"
        value={formatTokens(overview.data?.totals?.totalTokens ?? 0)}
        detail="Across every TokenForge account"
        lime
      />
      <Metric
        icon={<Activity size={17} />}
        label="Lifetime requests"
        value={(overview.data?.totals?.totalRequests ?? 0).toLocaleString()}
        detail="Across all accounts"
      />
      <Metric
        icon={<AlertTriangle size={17} />}
        label="Safety signals"
        value={(flags.data?.length ?? 0).toLocaleString()}
        detail="Open account flags"
        warning
      />
    </div>
  );

  const body = loading ? (
    <div className="grid h-80 place-items-center">
      <Loader2 className="animate-spin text-[#c9ff73]" />
    </div>
  ) : overview.error && !overview.data ? (
    <div className="dashboard-card grid min-h-64 place-items-center p-6 text-center">
      <div>
        <AlertTriangle className="mx-auto text-[#f0c180]" size={22} />
        <p className="mt-3 text-sm font-semibold text-white">Live operations data could not load</p>
        <p className="mt-2 max-w-sm text-xs leading-5 text-[#9091a3]">
          Your administrator session is still active. Refresh the control-plane data to try again.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4 border-white/12 text-[#e2e1ea] hover:bg-white/10"
          onClick={() => overview.refetch()}
        >
          Retry live data
        </Button>
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      {overview.error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#f0c180]/20 bg-[#f0c180]/[.06] px-3 py-2 text-[11px] text-[#f0c180]">
          <span>Using the last successfully loaded operations data while a refresh is retried.</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 px-2 text-[#f0c180] hover:bg-[#f0c180]/10 hover:text-[#ffe1a4]"
            onClick={() => overview.refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      {metrics}
      <div className="dashboard-card flex flex-wrap gap-2 p-2">
        {(
          [
            "overview",
            "cache",
            "accounts",
            "user-logs",
            "safety-audit",
            "pricing",
            "settlements",
            "requests",
            "tickets",
            "campaign",
            "controls",
            "providers",
            "operations",
            "gpt6-premium",
            "announcement",
            "activity",
            "live",
            "live-chat",
          ] as const
        ).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={section === item ? "default" : "ghost"}
            onClick={() => setSection(item)}
            className={
              section === item
                ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
                : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
            }
          >
            {item === "overview"
              ? "Overview"
              : item === "cache"
              ? "Prompt Cache"
              : item === "accounts"
              ? "Accounts"
              : item === "user-logs"
              ? "User Messages"
              : item === "safety-audit"
              ? "Safety Audit"
              : item === "pricing"
              ? "Model pricing"
              : item === "settlements"
              ? "Settlements & UPI"
              : item === "payments"
              ? "Payments"
              : item === "requests"
              ? "Access requests"
              : item === "tickets"
              ? "Tickets"
              : item === "campaign"
              ? "Special referral"
              : item === "controls"
              ? "Model controls"
              : item === "providers"
              ? "Provider settings"
              : item === "operations"
              ? "Operations"
              : item === "gpt6-premium"
              ? "GPT-6 Premium"
              : item === "announcement"
              ? "Announcement"
              : item === "live"
              ? "Live requests"
              : item === "live-chat"
              ? "Live Chat"
              : "Activity"}
          </Button>
        ))}
      </div>
      {section === "cache" && (
        <CacheDebuggerTab />
      )}
      {section === "user-logs" && (
        <AdminUserMessageInspector />
      )}
      {section === "safety-audit" && (
        <AdminSafetyAuditSection />
      )}
      {section === "settlements" && (
        <div className="space-y-4">
          <TransactionsWorkspace adminMode={true} />
        </div>
      )}
      {section === "pricing" && (
        <div className="space-y-4">
          <AdminPricingSection />
        </div>
      )}
      {section === "overview" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <AccountsSection activeAdminId={user?.id ?? -1} />
          <section className="dashboard-card">
            <SectionHeader
              icon={<ChartNoAxesCombined size={17} />}
              title="Usage activity"
              detail="Recent request activity across the TokenForge gateway."
            />
            <AdminUsageChart
              usage={overview.data?.usage ?? []}
              modelUsage={(overview.data?.allAccountModelUsage ?? []) as AdminGlobalModelUsage[]}
              loading={overview.isLoading}
            />
          </section>
          <section className="dashboard-card">
            <SectionHeader
              icon={<Mail size={17} />}
              title="Email provider distribution"
              detail="Live account counts by mailbox domain. Individual email addresses are never displayed."
            />
            <div className="mt-5">
              <EmailProviderChart providers={emailProviders} loading={overview.isLoading} />
            </div>
          </section>
          <div className="xl:col-span-2">
            <CapacitySection providers={providers} telemetry={providerTelemetry} />
          </div>
        </div>
      )}
      {section === "accounts" && <AccountsSection activeAdminId={user?.id ?? -1} />}
      {section === "requests" && <AdminAccessRequestsSection />}
      {section === "tickets" && <AdminTicketsSection />}
      {section === "campaign" && (
        <SpecialReferralCampaignSection
          campaign={specialReferralCampaign.data as SpecialReferralCampaignData | undefined}
          loading={specialReferralCampaign.isLoading}
        />
      )}
      {section === "controls" && (
        <InferenceControlsSection
          providers={providers}
          models={models}
          telemetry={providerTelemetry}
          modelQuery={modelQuery}
          onModelQueryChange={setModelQuery}
          onProviderToggle={(slug, enabled) => providerControl.mutate({ slug: slug as never, enabled })}
          onProviderVisionToggle={(slug, supportsVision) => providerVisionControl.mutate({ slug, supportsVision })}
          onProviderDocumentsToggle={(slug, supportsDocuments) => providerDocumentsControl.mutate({ slug, supportsDocuments })}
          onModelToggle={(modelId, enabled) => modelControl.mutate({ modelId: modelId as never, enabled })}
          onModelTierChange={(modelId, minTier) => modelTierControl.mutate({ modelId: modelId as never, minTier })}
          onModelPaygToggle={(modelId, isPayg) => modelPaygControl.mutate({ modelId: modelId as never, isPayg })}
          onModelBundleToggle={(modelId, isBundle) => modelBundleControl.mutate({ modelId: modelId as never, isBundle })}
          onModelTokenPlanToggle={(modelId, isTokenPlan) => modelTokenPlanControl.mutate({ modelId: modelId as never, isTokenPlan })}
          onModelCompactScalingToggle={(modelId, enabled, triggerTokens) =>
            modelCompactScalingControl.mutate({ modelId, enabled, triggerTokens })
          }
          providerPending={providerControl.isPending}
          providerVisionPending={providerVisionControl.isPending}
          providerDocumentsPending={providerDocumentsControl.isPending}
          modelPending={modelControl.isPending}
          modelTierPending={modelTierControl.isPending}
          modelPaygPending={modelPaygControl.isPending}
          modelBundlePending={modelBundleControl.isPending}
          modelTokenPlanPending={modelTokenPlanControl.isPending}
          modelCompactScalingPending={modelCompactScalingControl.isPending}
        />
      )}
      {section === "providers" && <ManagedProviderSelector keyMetrics={managedProviderKeyMetrics} />}
      {section === "operations" && <OperationalControls />}
      {section === "gpt6-premium" && <Gpt6PremiumControls />}
      {section === "announcement" && (
        <AnnouncementSection
          text={announcementText}
          onChange={setAnnouncementText}
          onSave={() => saveAnnouncement.mutate({ text: announcementText })}
          saving={saveAnnouncement.isPending}
          loading={announcement.isLoading}
        />
      )}
      {section === "activity" && (
        <AuditTimeline
          events={(activityFeed.data ?? []) as AdminAuditRecord[]}
          onExport={downloadAuditExport}
          exporting={auditExport.isFetching}
        />

      )}
      {section === "live" && <LiveRequestLog />}
      {section === "live-chat" && <AdminSupport />}
    </div>
  );

  if (typeof window !== "undefined" && window.location.pathname === "/admin/sonnet4.6") {
    return (
      <DashboardLayout>
        <div className="dashboard-page-surface">
          <div className="dashboard-page-content space-y-4">
            <section className="dashboard-card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="dashboard-kicker">Managed provider settings</p>
                <h1 className="mt-1 text-xl font-bold text-white">Claude Sonnet 4.6</h1>
                <p className="mt-1 text-xs leading-5 text-[#9495a7]">
                  Encrypted provider groups, equal-share routing, masked API keys, live health metrics, and
                  administrator-only timestamped diagnostics.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-white/12 text-[#d9d8e1] hover:bg-white/10"
                onClick={() => window.location.assign("/admin")}
              >
                Back to provider settings
              </Button>
            </section>
            <Sonnet46ProviderBalancerPanel
              metrics={managedProviderKeyMetrics.find((item) => item.modelId === "claude-sonnet-4.6")}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page-surface">
        <div className="dashboard-page-content">
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="dashboard-kicker">Operations console</p>
              <h1 className="dashboard-title">Control plane</h1>
              <p className="dashboard-subtitle">
                Passcode-scoped administrator access, live account oversight, inference availability, and safety
                operations.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full border-white/12 text-[#d9d8e1] hover:bg-white/10 sm:w-auto">
                  <LogOut size={15} /> Exit admin mode
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/10 bg-[#09090b] text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke administrator access?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[#a1a2b2]">
                    This browser returns to standard-user access. You can unlock the control plane again only with the
                    owner passcode.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white">
                    Keep admin access
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => signOutAdmin.mutate()}
                    disabled={signOutAdmin.isPending}
                    className="bg-[#ef929b] text-[#271216] hover:bg-[#ffabb2]"
                  >
                    {signOutAdmin.isPending ? "Revoking…" : "Exit admin mode"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {/* Pre-provision a GitHub account; exact, verified GitHub email match is required for activation; Awaiting verified GitHub login */}
          {body}
        </div>
      </div>
    </DashboardLayout>
  );
}
