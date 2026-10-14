import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Mail,
  MessageSquareText,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  UserCheck,
  UserX,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatCredits, SectionHeader, Toggle } from "../common/AdminCommon";
import { OrcaRouterSlotUsageChart } from "../overview/AdminCharts";
import { SetAllUsersCreditCard } from "../accounts/AccountsSection";
import { UserTierBadge, USER_TIER_CONFIGS, UserTier } from "@/components/UserTierBadge";

export function OrcaRouterCredentialPanel() {
  const utils = trpc.useUtils();
  const credentials = trpc.admin.orcaRouterCredentials.useQuery(undefined, { refetchInterval: 15_000 });
  const slotUsage = trpc.admin.orcaRouterSlotUsage.useQuery(undefined, { refetchInterval: 15_000 });
  const maintenance = trpc.admin.platformMaintenance.useQuery(undefined, { refetchInterval: 15_000 });
  const unverifiedCleanup = trpc.admin.discordUnverifiedAccountCleanup.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const slotNumbers = Array.from({ length: 15 }, (_, index) => index);
  const [values, setValues] = useState<string[]>(() => Array.from({ length: 15 }, () => ""));
  const [confirmation, setConfirmation] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const phrase = "ROTATE ORCAROUTER CREDENTIALS";
  const cleanupCount = unverifiedCleanup.data?.count ?? 0;
  const cleanupPhrase = `DELETE ${cleanupCount} UNVERIFIED DISCORD ACCOUNTS`;
  const normalizedValues = values.map((value) => value.trim());
  const canSubmit = normalizedValues.every((value) => value.length >= 20);

  const rotate = trpc.admin.replaceOrcaRouterCredentials.useMutation({
    onSuccess: async () => {
      setValues(Array.from({ length: 15 }, () => ""));
      setConfirmation("");
      setConfirmationOpen(false);
      await Promise.all([
        utils.admin.orcaRouterCredentials.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Fifteen OrcaRouter credential slots validated and activated");
    },
    onError: (error) => toast.error(error.message),
  });

  const setMaintenance = trpc.admin.setPlatformMaintenance.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.admin.platformMaintenance.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(
        result.enabled ? "Global inference maintenance is enabled" : "Global inference maintenance is disabled"
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteUnverified = trpc.admin.deleteDiscordUnverifiedAccounts.useMutation({
    onSuccess: async (result) => {
      setCleanupOpen(false);
      setCleanupConfirmation("");
      await Promise.all([
        utils.admin.discordUnverifiedAccountCleanup.invalidate(),
        utils.admin.accounts.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(
        result.deletedCount
          ? `${result.deletedCount} Discord-unverified account${result.deletedCount === 1 ? "" : "s"} permanently deleted`
          : "No Discord-unverified accounts required cleanup"
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const slots = credentials.data?.slots ?? [];
  const source = credentials.data?.source;
  const updateValue = (slot: number, value: string) =>
    setValues((current) => current.map((item, index) => (index === slot ? value : item)));

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<KeyRound size={17} />}
        title="OrcaRouter credential pool"
        detail="Fifteen encrypted server-side slots are validated before an atomic rotation. Claude Opus 5 and Qwen3.8 27B use healthy slots in round-robin order with automatic failover."
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slotNumbers.map((slot) => {
          const saved = slots.find((item) => item.slot === slot);
          return (
            <div key={slot} className="rounded-xl border border-white/8 bg-black/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white">Credential slot {slot + 1}</p>
                  <p className="mt-1 font-mono text-[10px] text-[#858697]">
                    {saved
                      ? `Stored · •••${saved.fingerprintSuffix}`
                      : source === "environment" && slot === 0
                      ? "Legacy environment fallback"
                      : "Awaiting managed key"}
                  </p>
                </div>
                <Badge
                  className={`border-0 text-[10px] ${
                    saved ? "bg-[#c9ff73]/10 text-[#c9ff73]" : "bg-white/6 text-[#9fa0ad]"
                  }`}
                >
                  {saved ? "Configured" : "Empty"}
                </Badge>
              </div>
              <label
                className="mt-5 block text-[10px] font-bold uppercase tracking-[.12em] text-[#9b9ca9]"
                htmlFor={`orca-router-key-${slot}`}
              >
                Replacement key
              </label>
              <Input
                id={`orca-router-key-${slot}`}
                value={values[slot]}
                onChange={(event) => updateValue(slot, event.target.value)}
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                placeholder="Paste a complete key"
                className="mt-2 h-10 border-white/10 bg-black/20 font-mono text-xs text-white placeholder:text-[#696b78]"
                disabled={rotate.isPending}
              />
              <p className="mt-2 min-h-4 text-[10px] text-[#7f8190]">
                {values[slot].trim()
                  ? "Ready to validate; never displayed after save."
                  : "All fifteen fields are required for rotation."}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-5 rounded-xl border border-white/8 bg-black/15 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#bfc0cb]">
              Per-slot routed requests
            </p>
            <p className="mt-1 text-[10px] leading-5 text-[#7f8190]">
              Anonymous current-runtime totals for the active pool. Slots show routing attempts only; no credential,
              account, or prompt data is retained here.
            </p>
          </div>
          <p className="shrink-0 font-mono text-[9px] text-[#77798b]">Resets on rotation or restart</p>
        </div>
        <OrcaRouterSlotUsageChart usage={slotUsage.data ?? []} loading={slotUsage.isLoading} />
      </div>
      <div className="mt-5 flex flex-col gap-4 rounded-xl border border-[#c9ff73]/15 bg-[#c9ff73]/[.045] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[#e4f5c8]">Atomic fifteen-slot rotation</p>
          <p className="mt-1 max-w-2xl text-[10px] leading-5 text-[#a7aa9a]">
            The server probes every submitted key before replacing the pool. If any validation fails, the current pool
            remains active. Plaintext keys are encrypted at rest, omitted from logs and audits, and cleared from this
            page after activation.
          </p>
        </div>
        <AlertDialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              disabled={!canSubmit || rotate.isPending}
              className="shrink-0 bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
            >
              {rotate.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Validating…
                </>
              ) : (
                "Validate & rotate"
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-[#09090b] text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Activate all fifteen OrcaRouter keys?</AlertDialogTitle>
              <AlertDialogDescription className="text-[#a1a2b2]">
                Each key will be checked server-side. A successful rotation replaces the managed pool atomically and
                starts a new round-robin cycle for Claude Opus 5 and Qwen3.8 27B.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="orca-credential-confirmation">
              Type <span className="font-mono text-[#c9ff73]">{phrase}</span> to confirm
            </label>
            <Input
              id="orca-credential-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              className="border-white/10 bg-black/20 text-white"
            />
            <AlertDialogFooter>
              <AlertDialogCancel
                className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white"
                disabled={rotate.isPending}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmation !== phrase || rotate.isPending}
                onClick={() => rotate.mutate({ credentials: normalizedValues })}
                className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              >
                Confirm rotation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-[#858697]">
        Current source:{" "}
        <span className="font-mono text-[#c6c7d2]">
          {source === "database"
            ? "managed encrypted pool"
            : source === "environment"
            ? "legacy environment fallback"
            : "not configured"}
        </span>
        . Only anonymous slot status and a non-reversible fingerprint suffix are visible.
      </p>
      <div className="mt-6 grid gap-4 border-t border-white/8 pt-6 xl:grid-cols-2">
        <div
          className={`rounded-xl border p-4 ${
            maintenance.data?.enabled ? "border-red-300/30 bg-red-400/[.06]" : "border-white/8 bg-black/15"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-white">Global inference maintenance</p>
              <p className="mt-1 text-[10px] leading-5 text-[#9fa0ad]">
                Blocks every user Playground, OpenAI-compatible, and Anthropic-compatible request before quota, credits,
                or provider work. Administrator controls remain available.
              </p>
            </div>
            <Toggle
              label="Global inference maintenance"
              enabled={Boolean(maintenance.data?.enabled)}
              pending={maintenance.isLoading || setMaintenance.isPending}
              onChange={(enabled) => setMaintenance.mutate({ enabled })}
            />
          </div>
          <p
            className={`mt-3 text-[10px] font-semibold ${
              maintenance.data?.enabled ? "text-red-300" : "text-[#c9ff73]"
            }`}
          >
            {maintenance.data?.enabled
              ? "Maintenance active — user inference is paused."
              : "Inference active — users can make requests."}
          </p>
        </div>
        <div className="rounded-xl border border-red-400/25 bg-red-400/[.045] p-4">
          <p className="text-xs font-bold text-red-200">Discord-unverified account cleanup</p>
          <p className="mt-1 text-[10px] leading-5 text-[#b9a1a8]">
            {cleanupCount.toLocaleString()} regular account{cleanupCount === 1 ? "" : "s"} lack Discord verification.
            This permanently removes their TokenForge data without blocking later fresh signup. A local sign-in shows
            a one-time explanation after cleanup.
          </p>
          <AlertDialog
            open={cleanupOpen}
            onOpenChange={(open) => {
              setCleanupOpen(open);
              if (!open) setCleanupConfirmation("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-4 border-red-400/30 text-red-200 hover:bg-red-400/10 hover:text-red-100"
                disabled={!cleanupCount || unverifiedCleanup.isLoading || deleteUnverified.isPending}
              >
                Review & delete {cleanupCount.toLocaleString()}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-red-400/20 bg-[#09090b] text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Permanently delete {cleanupCount.toLocaleString()} Discord-unverified accounts?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[#a1a2b2]">
                  This removes selected account data, API keys, usage, credits, and sessions. These email addresses are
                  not blocked, and the server rechecks the displayed count before deletion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="discord-unverified-cleanup-confirmation">
                Type <span className="font-mono text-red-200">{cleanupPhrase}</span> to confirm
              </label>
              <Input
                id="discord-unverified-cleanup-confirmation"
                value={cleanupConfirmation}
                onChange={(event) => setCleanupConfirmation(event.target.value)}
                autoComplete="off"
                className="border-red-400/20 bg-black/20 font-mono text-xs text-white"
                disabled={deleteUnverified.isPending}
              />
              <AlertDialogFooter>
                <AlertDialogCancel
                  className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white"
                  disabled={deleteUnverified.isPending}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={cleanupConfirmation.trim() !== cleanupPhrase || deleteUnverified.isPending}
                  onClick={() =>
                    deleteUnverified.mutate({
                      expectedCount: cleanupCount,
                      confirmation: cleanupConfirmation.trim(),
                    })
                  }
                  className="bg-red-300 text-[#3a1219] hover:bg-red-200"
                >
                  Delete {cleanupCount.toLocaleString()} accounts
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </section>
  );
}

const MAINTENANCE_TIER_LIST: UserTier[] = ["free", "starter", "pro", "max", "power", "ultra"];
const DEFAULT_HARDCODED_MAINTENANCE_MSG = "Site entered in maintainence mode due to massive request.";

export function PlatformMaintenanceMessagesConfig() {
  const utils = trpc.useUtils();
  const messagesQuery = trpc.admin.platformMaintenanceMessages.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  const [defaultMessage, setDefaultMessage] = useState("");
  const [tierMessages, setTierMessages] = useState<Record<UserTier, string>>({
    free: "",
    starter: "",
    pro: "",
    max: "",
    power: "",
    ultra: "",
  });
  const [selectedTier, setSelectedTier] = useState<UserTier>("free");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (messagesQuery.data) {
      setDefaultMessage(messagesQuery.data.defaultMessage ?? "");
      setTierMessages({
        free: messagesQuery.data.free ?? "",
        starter: messagesQuery.data.starter ?? "",
        pro: messagesQuery.data.pro ?? "",
        max: messagesQuery.data.max ?? "",
        power: messagesQuery.data.power ?? "",
        ultra: messagesQuery.data.ultra ?? "",
      });
      setHasChanges(false);
    }
  }, [messagesQuery.data]);

  const updateMutation = trpc.admin.setPlatformMaintenanceMessages.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.platformMaintenanceMessages.invalidate(),
        utils.public.platformMaintenanceStatus.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      setHasChanges(false);
      toast.success("Maintenance messages updated successfully");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSave = () => {
    updateMutation.mutate({
      defaultMessage,
      free: tierMessages.free,
      starter: tierMessages.starter,
      pro: tierMessages.pro,
      max: tierMessages.max,
      power: tierMessages.power,
      ultra: tierMessages.ultra,
    });
  };

  const handleResetToSystemDefault = () => {
    setDefaultMessage("");
    setTierMessages({
      free: "",
      starter: "",
      pro: "",
      max: "",
      power: "",
      ultra: "",
    });
    setHasChanges(true);
  };

  const currentTierConfig = USER_TIER_CONFIGS[selectedTier];
  const effectiveMessageForSelectedTier =
    tierMessages[selectedTier]?.trim() ||
    defaultMessage.trim() ||
    DEFAULT_HARDCODED_MAINTENANCE_MSG;

  const countCustomTiers = Object.values(tierMessages).filter((m) => m.trim().length > 0).length;

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-5 xl:col-span-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-[#c9ff73]" />
            <p className="text-xs font-bold text-white uppercase tracking-wider">
              Maintenance Error Messages &amp; Tier Customization
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#9fa0ad]">
            Set the error message returned to users when Global Inference Maintenance is active. Configure a global default message, or write tier-specific messages so users on different membership tiers (e.g. Free, Starter, Pro, Ultra) see their own tailored error response.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {countCustomTiers > 0 && (
            <Badge variant="outline" className="border-[#c9ff73]/30 bg-[#c9ff73]/10 text-[#c9ff73] text-[10px]">
              {countCustomTiers} tier override{countCustomTiers === 1 ? "" : "s"} active
            </Badge>
          )}
          {defaultMessage.trim() ? (
            <Badge variant="outline" className="border-sky-400/30 bg-sky-400/10 text-sky-300 text-[10px]">
              Custom default active
            </Badge>
          ) : (
            <Badge variant="outline" className="border-white/10 bg-white/5 text-[#9fa0ad] text-[10px]">
              System default active
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {/* Universal Default Message Section */}
        <div className="rounded-lg border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <span>Universal Default Maintenance Message</span>
            </label>
            <span className="text-[10px] text-[#858697]">Used when tier has no override</span>
          </div>
          <Textarea
            value={defaultMessage}
            onChange={(e) => {
              setDefaultMessage(e.target.value);
              setHasChanges(true);
            }}
            placeholder={DEFAULT_HARDCODED_MAINTENANCE_MSG}
            rows={3}
            className="w-full border-white/15 bg-black/40 text-xs text-white placeholder:text-[#6f7082] focus-visible:border-[#c9ff73] focus-visible:ring-1 focus-visible:ring-[#c9ff73]"
          />
          <div className="mt-2 flex items-center justify-between text-[10px] text-[#858697]">
            <p>
              Leave empty to use built-in default:{" "}
              <span className="font-mono text-[#c6c7d2]">"{DEFAULT_HARDCODED_MAINTENANCE_MSG}"</span>
            </p>
            {defaultMessage.trim() && (
              <button
                type="button"
                onClick={() => {
                  setDefaultMessage("");
                  setHasChanges(true);
                }}
                className="text-[#fda4af] hover:underline"
              >
                Clear to system default
              </button>
            )}
          </div>
        </div>

        {/* Live Resolved Preview for Selected Tier */}
        <div className="rounded-lg border border-white/8 bg-black/20 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-[#c9ff73]" />
                <span>Live Preview for {currentTierConfig.label}</span>
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 ${
                  tierMessages[selectedTier]?.trim()
                    ? "border-[#c9ff73]/40 bg-[#c9ff73]/10 text-[#c9ff73]"
                    : defaultMessage.trim()
                    ? "border-sky-400/40 bg-sky-400/10 text-sky-300"
                    : "border-white/10 bg-white/5 text-[#9fa0ad]"
                }`}
              >
                {tierMessages[selectedTier]?.trim()
                  ? "Tier override"
                  : defaultMessage.trim()
                  ? "Inherited universal default"
                  : "Built-in fallback"}
              </Badge>
            </div>
            <p className="text-[10px] text-[#858697] mb-2">
              This is the exact JSON error message that a user on {currentTierConfig.label} will receive from API requests and the Playground during maintenance:
            </p>
            <div className="rounded-md border border-red-500/25 bg-red-950/20 p-3 font-mono text-[11px] text-red-200 break-words leading-relaxed">
              "{effectiveMessageForSelectedTier}"
            </div>
          </div>
          <div className="mt-2 text-[10px] text-[#858697]">
            Active tier config: <span className="text-white font-medium">{currentTierConfig.label}</span> ({currentTierConfig.tag})
          </div>
        </div>
      </div>

      {/* Tier-Specific Overrides */}
      <div className="mt-5 border-t border-white/8 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#c9ff73]" />
              <span>Tier-Specific Message Overrides</span>
            </p>
            <p className="mt-0.5 text-[10px] text-[#858697]">
              Select a tier below to customize the maintenance error message for users on that tier.
            </p>
          </div>
          <div className="text-[10px] text-[#858697]">
            Tip: Tiers left blank inherit the default message above.
          </div>
        </div>

        {/* Tier Selector Tab Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {MAINTENANCE_TIER_LIST.map((tier) => {
            const config = USER_TIER_CONFIGS[tier];
            const isSelected = selectedTier === tier;
            const hasCustom = Boolean(tierMessages[tier]?.trim());

            return (
              <button
                key={tier}
                type="button"
                onClick={() => setSelectedTier(tier)}
                className={`flex flex-col items-start gap-1 p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-[#c9ff73] bg-[#c9ff73]/10 shadow-sm shadow-[#c9ff73]/10"
                    : "border-white/8 bg-black/30 hover:border-white/20 hover:bg-black/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-semibold ${isSelected ? "text-white" : "text-[#c6c7d2]"}`}>
                    {config.label}
                  </span>
                  {hasCustom && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c9ff73]" title="Custom message configured" />
                  )}
                </div>
                <span className="text-[9px] text-[#858697] truncate w-full">
                  {hasCustom ? "Custom message" : "Default fallback"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Tier Message Input */}
        <div className="mt-3 rounded-lg border border-white/8 bg-black/20 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <UserTierBadge tier={selectedTier} showTag size="sm" />
              <span className="text-xs font-semibold text-white">Custom message for {currentTierConfig.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {defaultMessage.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setTierMessages((prev) => ({
                      ...prev,
                      [selectedTier]: defaultMessage.trim(),
                    }));
                    setHasChanges(true);
                  }}
                  className="text-[10px] text-[#9fa0ad] hover:text-white underline"
                >
                  Copy default message here
                </button>
              )}
              {tierMessages[selectedTier]?.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setTierMessages((prev) => ({
                      ...prev,
                      [selectedTier]: "",
                    }));
                    setHasChanges(true);
                  }}
                  className="text-[10px] text-[#fda4af] hover:underline"
                >
                  Clear tier override
                </button>
              )}
            </div>
          </div>
          <Textarea
            value={tierMessages[selectedTier]}
            onChange={(e) => {
              const val = e.target.value;
              setTierMessages((prev) => ({ ...prev, [selectedTier]: val }));
              setHasChanges(true);
            }}
            placeholder={`Leave empty to inherit default message: "${defaultMessage.trim() || DEFAULT_HARDCODED_MAINTENANCE_MSG}"`}
            rows={2}
            className="w-full border-white/15 bg-black/40 text-xs text-white placeholder:text-[#6f7082] focus-visible:border-[#c9ff73] focus-visible:ring-1 focus-visible:ring-[#c9ff73]"
          />
          <p className="mt-1.5 text-[10px] text-[#858697]">
            {currentTierConfig.description}. Users with the <strong>{currentTierConfig.label}</strong> tier will see this message whenever maintenance is enabled.
          </p>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!hasChanges || updateMutation.isPending}
            onClick={handleSave}
            className="bg-[#c9ff73] text-black hover:bg-[#b8f060] font-semibold text-xs px-4 h-8"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving messages...
              </>
            ) : (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Save maintenance messages
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={updateMutation.isPending}
            onClick={handleResetToSystemDefault}
            className="border-white/10 text-xs text-[#9fa0ad] hover:text-white h-8"
          >
            <RotateCcw className="mr-1.5 h-3 w-3" />
            Reset all to system default
          </Button>
        </div>
        {hasChanges && (
          <span className="text-[11px] text-amber-300 animate-pulse">
            ● Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}

export function OperationalControls() {
  const utils = trpc.useUtils();
  const maintenance = trpc.admin.platformMaintenance.useQuery(undefined, { refetchInterval: 15_000 });
  const exemptions = trpc.admin.platformMaintenanceExemptions.useQuery(undefined, { refetchInterval: 15_000 });

  const playgroundMaintenance = trpc.admin.playgroundMaintenance.useQuery(undefined, { refetchInterval: 15_000 });
  const maintenanceCountdown = trpc.admin.maintenanceCountdown.useQuery(undefined, { refetchInterval: 15_000 });
  const unverifiedCleanup = trpc.admin.discordUnverifiedAccountCleanup.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const giveawayRecipients = trpc.admin.discordVerifiedGiveawayRecipients.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const giveawayHistory = trpc.admin.giveawayHistory.useQuery();
  const [newExemptEmail, setNewExemptEmail] = useState("");
  const [showExemptionsWhenOff, setShowExemptionsWhenOff] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const [giveawayOpen, setGiveawayOpen] = useState(false);
  const [giveawayAmount, setGiveawayAmount] = useState("");
  const [giveawayAnnouncement, setGiveawayAnnouncement] = useState("");
  const [giveawayConfirmation, setGiveawayConfirmation] = useState("");
  const [countdownDays, setCountdownDays] = useState("");
  const [countdownHours, setCountdownHours] = useState("");
  const [countdownMinutes, setCountdownMinutes] = useState("");
  const [countdownSeconds, setCountdownSeconds] = useState("");
  const [countdownNote, setCountdownNote] = useState("");

  const cleanupCount = unverifiedCleanup.data?.count ?? 0;
  const cleanupPhrase = `DELETE ${cleanupCount} UNVERIFIED DISCORD ACCOUNTS`;
  const giveawayRecipientCount = giveawayRecipients.data?.count ?? 0;
  const parsedGiveawayAmount = Number(giveawayAmount);
  const isValidGiveawayAmount =
    Number.isFinite(parsedGiveawayAmount) &&
    parsedGiveawayAmount > 0 &&
    parsedGiveawayAmount <= 100_000 &&
    Math.round(parsedGiveawayAmount * 100) === parsedGiveawayAmount * 100;
  const giveawayPhrase = isValidGiveawayAmount
    ? `GIVE $${parsedGiveawayAmount.toFixed(2)} TO ${giveawayRecipientCount} ACCOUNTS`
    : "";
  const parseWholeNumber = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : 0);
  const countdownDurationMs =
    (parseWholeNumber(countdownDays) * 86_400 +
      parseWholeNumber(countdownHours) * 3_600 +
      parseWholeNumber(countdownMinutes) * 60 +
      parseWholeNumber(countdownSeconds)) *
    1_000;
  const validCountdownDuration =
    Number.isSafeInteger(countdownDurationMs) &&
    countdownDurationMs >= 1_000 &&
    countdownDurationMs <= 30 * 24 * 60 * 60 * 1_000;

  const setMaintenance = trpc.admin.setPlatformMaintenance.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.admin.platformMaintenance.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(
        result.enabled ? "Global inference maintenance is enabled" : "Global inference maintenance is disabled"
      );
    },
    onError: (error) => toast.error(error.message),
  });



  const setExemptionMutation = trpc.admin.setPlatformMaintenanceExemption.useMutation({
    onSuccess: async (_data, variables) => {
      await Promise.all([
        utils.admin.platformMaintenanceExemptions.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      if (variables.status === "allowed") {
        toast.success(`${variables.email} is allowed (maintenance bypass active)`);
      } else {
        toast.success(`${variables.email} is restricted (maintenance live)`);
      }
      setNewExemptEmail("");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeExemptionMutation = trpc.admin.removePlatformMaintenanceExemption.useMutation({
    onSuccess: async (_data, variables) => {
      await Promise.all([
        utils.admin.platformMaintenanceExemptions.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(`Removed ${variables.email} from maintenance exemptions`);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleAddExemption = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newExemptEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setExemptionMutation.mutate({ email: trimmed, status: "allowed" });
  };

  const setPlaygroundMaintenance = trpc.admin.setPlaygroundMaintenance.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.admin.playgroundMaintenance.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(
        result.enabled ? "Playground maintenance is enabled" : "Playground maintenance is disabled"
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const setCountdown = trpc.admin.setMaintenanceCountdown.useMutation({
    onSuccess: async (result) => {
      if (result) {
        setCountdownDays("");
        setCountdownHours("");
        setCountdownMinutes("");
        setCountdownSeconds("");
        setCountdownNote("");
      }
      await Promise.all([
        utils.admin.maintenanceCountdown.invalidate(),
        utils.public.maintenanceCountdown.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(result ? "Maintenance countdown is now live" : "Maintenance countdown cleared");
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeTimedMaintenance = trpc.admin.resumeTimedMaintenance.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.platformMaintenance.invalidate(),
        utils.admin.maintenanceCountdown.invalidate(),
        utils.public.maintenanceCountdown.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Platform calls resumed; individual model settings were left unchanged");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteUnverified = trpc.admin.deleteDiscordUnverifiedAccounts.useMutation({
    onSuccess: async (result) => {
      setCleanupOpen(false);
      setCleanupConfirmation("");
      await Promise.all([
        utils.admin.discordUnverifiedAccountCleanup.invalidate(),
        utils.admin.accounts.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(
        result.deletedCount
          ? `${result.deletedCount} Discord-unverified account${result.deletedCount === 1 ? "" : "s"} permanently deleted`
          : "No Discord-unverified accounts required cleanup"
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const runGiveaway = trpc.admin.giveDiscordVerifiedAccountsCredit.useMutation({
    onSuccess: async (result) => {
      setGiveawayOpen(false);
      setGiveawayAmount("");
      setGiveawayAnnouncement("");
      setGiveawayConfirmation("");
      await Promise.all([
        utils.admin.discordVerifiedGiveawayRecipients.invalidate(),
        utils.admin.giveawayHistory.invalidate(),
        utils.admin.accounts.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(
        `${formatCredits(result.amountNanos)} credited to ${result.recipientCount.toLocaleString()} registered account${
          result.recipientCount === 1 ? "" : "s"
        } 🎉`
      );
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <SetAllUsersCreditCard />

      <section className="dashboard-card">
        <SectionHeader
          icon={<ShieldAlert size={17} />}
          title="Platform operations"
          detail="Global inference control, scheduled-maintenance messaging, verified-member rewards, and account-safety actions. Provider credentials are managed only as encrypted server configuration and are not displayed in this console."
        />
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div
          className={`rounded-xl border p-4 transition-all ${
            maintenance.data?.enabled
              ? "border-red-300/30 bg-red-400/[.06] xl:col-span-2"
              : showExemptionsWhenOff
              ? "border-white/15 bg-black/20 xl:col-span-2"
              : "border-white/8 bg-black/15"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-white">Global inference maintenance</p>
              <p className="mt-1 text-[10px] leading-5 text-[#9fa0ad]">
                Blocks every user Playground, OpenAI-compatible, and Anthropic-compatible request before quota, credits,
                or provider work. Administrator controls remain available.
              </p>
            </div>
            <Toggle
              label="Global inference maintenance"
              enabled={Boolean(maintenance.data?.enabled)}
              pending={maintenance.isLoading || setMaintenance.isPending}
              onChange={(enabled) => setMaintenance.mutate({ enabled })}
            />
          </div>
          <p
            className={`mt-3 text-[10px] font-semibold ${
              maintenance.data?.enabled ? "text-red-300" : "text-[#c9ff73]"
            }`}
          >
            {maintenance.data?.enabled
              ? "Maintenance active — user inference is paused."
              : "Inference active — users can make requests."}
          </p>

          {/* Maintenance Exemption Controls */}
          {maintenance.data?.enabled ? (
            <div className="mt-4 border-t border-red-300/20 pt-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">Maintenance bypass exemptions</span>
                </div>
                {exemptions.data && exemptions.data.length > 0 && (
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] text-white/80">
                    {exemptions.data.filter((e) => e.status === "allowed").length} allowed / {exemptions.data.length} total
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-[#9fa0ad]">
                Enter a user's email below. When allowed, global inference maintenance will not be implemented for that person, allowing them to make API calls and use the Playground as usual. Click <strong>Restrict</strong> on any user to enforce maintenance for them, or <strong>Allow</strong> to restore bypass.
              </p>

              {/* Email input box */}
              <form onSubmit={handleAddExemption} className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#9fa0ad]" />
                  <Input
                    type="email"
                    placeholder="Enter user email (e.g. user@example.com)"
                    value={newExemptEmail}
                    onChange={(e) => setNewExemptEmail(e.target.value)}
                    className="h-9 border-white/15 bg-black/40 pl-9 text-xs text-white placeholder:text-[#9fa0ad]/60 focus-visible:border-emerald-400 focus-visible:ring-1 focus-visible:ring-emerald-400"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newExemptEmail.trim() || setExemptionMutation.isPending}
                  className="h-9 bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {setExemptionMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Allow Email
                    </>
                  )}
                </Button>
              </form>

              {/* Exemptions List */}
              {exemptions.data && exemptions.data.length > 0 ? (
                <div className="mt-3.5 space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {exemptions.data.map((item) => {
                    const isAllowed = item.status === "allowed";
                    const isPending =
                      (setExemptionMutation.isPending && setExemptionMutation.variables?.email === item.email) ||
                      (removeExemptionMutation.isPending && removeExemptionMutation.variables?.email === item.email);

                    return (
                      <div
                        key={item.email}
                        className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors ${
                          isAllowed
                            ? "border-emerald-500/25 bg-emerald-950/20"
                            : "border-red-500/25 bg-red-950/20"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {isAllowed ? (
                            <UserCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                          ) : (
                            <UserX className="h-4 w-4 shrink-0 text-red-400" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-medium text-white">{item.email}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 leading-4 ${
                                  isAllowed
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                    : "border-red-500/40 bg-red-500/10 text-red-300"
                                }`}
                              >
                                {isAllowed ? "● Allowed (Bypassing maintenance)" : "● Restricted (Maintenance live)"}
                              </Badge>
                              {item.updatedAt && (
                                <span className="text-[9px] text-[#9fa0ad]/60">
                                  {new Date(item.updatedAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {isAllowed ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => setExemptionMutation.mutate({ email: item.email, status: "restricted" })}
                              className="h-7 border-red-500/40 px-2.5 text-[11px] text-red-300 hover:bg-red-500/20 hover:text-red-100"
                            >
                              {isPending ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Lock className="mr-1 h-3 w-3" />
                              )}
                              Restrict
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => setExemptionMutation.mutate({ email: item.email, status: "allowed" })}
                              className="h-7 border-emerald-500/40 px-2.5 text-[11px] text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100"
                            >
                              {isPending ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Unlock className="mr-1 h-3 w-3" />
                              )}
                              Allow
                            </Button>
                          )}

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => removeExemptionMutation.mutate({ email: item.email })}
                            className="h-7 w-7 p-0 text-[#9fa0ad] hover:bg-red-500/15 hover:text-red-400"
                            title="Remove from exemptions list"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-[10px] italic text-[#9fa0ad]/70">
                  No accounts exempted yet. Enter an email above to exempt a user from global maintenance.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3 border-t border-white/8 pt-2.5">
              <button
                type="button"
                onClick={() => setShowExemptionsWhenOff(!showExemptionsWhenOff)}
                className="flex items-center gap-1.5 text-[10px] font-medium text-[#9fa0ad] transition-colors hover:text-white"
              >
                {showExemptionsWhenOff ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <span>
                  {showExemptionsWhenOff ? "Hide" : "Pre-configure"} maintenance exemptions
                  {exemptions.data && exemptions.data.length > 0 ? ` (${exemptions.data.length} configured)` : ""}
                </span>
              </button>

              {showExemptionsWhenOff && (
                <div className="mt-3">
                  <p className="text-[10px] leading-relaxed text-[#9fa0ad]">
                    Pre-configure user exemptions that will automatically apply whenever global inference maintenance is enabled.
                  </p>
                  <form onSubmit={handleAddExemption} className="mt-2.5 flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#9fa0ad]" />
                      <Input
                        type="email"
                        placeholder="Enter user email (e.g. user@example.com)"
                        value={newExemptEmail}
                        onChange={(e) => setNewExemptEmail(e.target.value)}
                        className="h-9 border-white/15 bg-black/40 pl-9 text-xs text-white placeholder:text-[#9fa0ad]/60 focus-visible:border-emerald-400 focus-visible:ring-1 focus-visible:ring-emerald-400"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!newExemptEmail.trim() || setExemptionMutation.isPending}
                      className="h-9 bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {setExemptionMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Allow Email
                        </>
                      )}
                    </Button>
                  </form>

                  {exemptions.data && exemptions.data.length > 0 ? (
                    <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-0.5">
                      {exemptions.data.map((item) => {
                        const isAllowed = item.status === "allowed";
                        const isPending =
                          (setExemptionMutation.isPending && setExemptionMutation.variables?.email === item.email) ||
                          (removeExemptionMutation.isPending && removeExemptionMutation.variables?.email === item.email);

                        return (
                          <div
                            key={item.email}
                            className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors ${
                              isAllowed
                                ? "border-emerald-500/25 bg-emerald-950/20"
                                : "border-red-500/25 bg-red-950/20"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              {isAllowed ? (
                                <UserCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                              ) : (
                                <UserX className="h-4 w-4 shrink-0 text-red-400" />
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-mono text-xs font-medium text-white">{item.email}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1.5 py-0 leading-4 ${
                                      isAllowed
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                        : "border-red-500/40 bg-red-500/10 text-red-300"
                                    }`}
                                  >
                                    {isAllowed ? "● Allowed (Bypassing maintenance)" : "● Restricted (Maintenance active)"}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {isAllowed ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isPending}
                                  onClick={() => setExemptionMutation.mutate({ email: item.email, status: "restricted" })}
                                  className="h-7 border-red-500/40 px-2.5 text-[11px] text-red-300 hover:bg-red-500/20 hover:text-red-100"
                                >
                                  {isPending ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Lock className="mr-1 h-3 w-3" />
                                  )}
                                  Restrict
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isPending}
                                  onClick={() => setExemptionMutation.mutate({ email: item.email, status: "allowed" })}
                                  className="h-7 border-emerald-500/40 px-2.5 text-[11px] text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100"
                                >
                                  {isPending ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Unlock className="mr-1 h-3 w-3" />
                                  )}
                                  Allow
                                </Button>
                              )}

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={isPending}
                                onClick={() => removeExemptionMutation.mutate({ email: item.email })}
                                className="h-7 w-7 p-0 text-[#9fa0ad] hover:bg-red-500/15 hover:text-red-400"
                                title="Remove from exemptions list"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-[10px] italic text-[#9fa0ad]/70">
                      No accounts configured yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          className={`rounded-xl border p-4 ${
            playgroundMaintenance.data?.enabled ? "border-amber-300/30 bg-amber-400/[.06]" : "border-white/8 bg-black/15"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-white">Playground-only maintenance</p>
              <p className="mt-1 text-[10px] leading-5 text-[#9fa0ad]">
                Pauses only the Playground when responses are broken. OpenAI-compatible and Anthropic-compatible API
                requests continue normally.
              </p>
            </div>
            <Toggle
              label="Playground-only maintenance"
              enabled={Boolean(playgroundMaintenance.data?.enabled)}
              pending={playgroundMaintenance.isLoading || setPlaygroundMaintenance.isPending}
              onChange={(enabled) => setPlaygroundMaintenance.mutate({ enabled })}
            />
          </div>
          <p
            className={`mt-3 text-[10px] font-semibold ${
              playgroundMaintenance.data?.enabled ? "text-amber-200" : "text-[#c9ff73]"
            }`}
          >
            {playgroundMaintenance.data?.enabled
              ? "Playground paused — users receive the maintenance message."
              : "Playground active — users can submit requests."}
          </p>
        </div>

        <PlatformMaintenanceMessagesConfig />

        <div
          id="maintenance-countdown-controls"
          className="rounded-xl border border-amber-300/25 bg-amber-400/[.045] p-4 xl:col-span-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold text-amber-100">Automatic maintenance countdown</p>
              <p className="mt-1 max-w-2xl text-[10px] leading-5 text-amber-100/65">
                Shown below the announcement on every public and signed-in page. When this timer reaches zero, every
                user Playground and API request is paused with the maintenance response. Individual model and provider settings are not changed.
              </p>
            </div>
            {maintenanceCountdown.data && (
              <Badge className="shrink-0 border-0 bg-amber-300/10 text-[10px] text-amber-100">
                Active until {new Date(maintenanceCountdown.data.endsAt).toLocaleString()}
              </Badge>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-[9px] font-bold uppercase tracking-[.12em] text-amber-100/60">
              Days
              <Input
                aria-label="Maintenance countdown days"
                type="number"
                min="0"
                max="30"
                inputMode="numeric"
                value={countdownDays}
                onChange={(event) => setCountdownDays(event.target.value)}
                placeholder="0"
                className="mt-1 h-9 border-amber-300/20 bg-black/20 font-mono text-xs text-white placeholder:text-[#767886]"
                disabled={setCountdown.isPending}
              />
            </label>
            <label className="text-[9px] font-bold uppercase tracking-[.12em] text-amber-100/60">
              Hours
              <Input
                aria-label="Maintenance countdown hours"
                type="number"
                min="0"
                max="720"
                inputMode="numeric"
                value={countdownHours}
                onChange={(event) => setCountdownHours(event.target.value)}
                placeholder="0"
                className="mt-1 h-9 border-amber-300/20 bg-black/20 font-mono text-xs text-white placeholder:text-[#767886]"
                disabled={setCountdown.isPending}
              />
            </label>
            <label className="text-[9px] font-bold uppercase tracking-[.12em] text-amber-100/60">
              Minutes
              <Input
                aria-label="Maintenance countdown minutes"
                type="number"
                min="0"
                max="43200"
                inputMode="numeric"
                value={countdownMinutes}
                onChange={(event) => setCountdownMinutes(event.target.value)}
                placeholder="0"
                className="mt-1 h-9 border-amber-300/20 bg-black/20 font-mono text-xs text-white placeholder:text-[#767886]"
                disabled={setCountdown.isPending}
              />
            </label>
            <label className="text-[9px] font-bold uppercase tracking-[.12em] text-amber-100/60">
              Seconds
              <Input
                aria-label="Maintenance countdown seconds"
                type="number"
                min="0"
                max="2592000"
                inputMode="numeric"
                value={countdownSeconds}
                onChange={(event) => setCountdownSeconds(event.target.value)}
                placeholder="0"
                className="mt-1 h-9 border-amber-300/20 bg-black/20 font-mono text-xs text-white placeholder:text-[#767886]"
                disabled={setCountdown.isPending}
              />
            </label>
          </div>
          <label className="mt-3 block text-[9px] font-bold uppercase tracking-[.12em] text-amber-100/60">
            Public note
            <Input
              aria-label="Maintenance countdown public note"
              value={countdownNote}
              onChange={(event) => setCountdownNote(event.target.value)}
              maxLength={200}
              placeholder="Example: Site under maintenance for scheduled updates"
              className="mt-1 h-9 border-amber-300/20 bg-black/20 text-xs text-white placeholder:text-[#767886]"
              disabled={setCountdown.isPending}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-amber-200 text-[#3d2207] hover:bg-amber-100"
              disabled={!validCountdownDuration || setCountdown.isPending}
              onClick={() =>
                setCountdown.mutate({ durationMs: countdownDurationMs, note: countdownNote })
              }
            >
              {setCountdown.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Saving…
                </>
              ) : (
                "Start countdown"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-300/25 text-amber-100 hover:bg-amber-300/10 hover:text-amber-50"
              disabled={!maintenanceCountdown.data || setCountdown.isPending || resumeTimedMaintenance.isPending}
              onClick={() => setCountdown.mutate(null)}
            >
              Clear countdown
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[#c9ff73]/30 text-[#d8ff91] hover:bg-[#c9ff73]/10 hover:text-[#e4f5c8]"
              disabled={
                (!maintenance.data?.enabled && !maintenanceCountdown.data) ||
                resumeTimedMaintenance.isPending ||
                setCountdown.isPending
              }
              onClick={() => resumeTimedMaintenance.mutate()}
            >
              {resumeTimedMaintenance.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Resuming…
                </>
              ) : (
                "Resume platform calls"
              )}
            </Button>
            <p className="text-[10px] text-amber-100/55">
              Maximum duration: 30 days.{" "}
              {validCountdownDuration
                ? `Selected: ${(countdownDurationMs / 3_600_000).toFixed(
                    countdownDurationMs % 3_600_000 ? 2 : 0
                  )} hours.`
                : "Enter at least one second to start."}{" "}
              Resume clears the timer-triggered pause without changing model controls.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-red-400/25 bg-red-400/[.045] p-4">
          <p className="text-xs font-bold text-red-200">Discord-unverified account cleanup</p>
          <p className="mt-1 text-[10px] leading-5 text-[#b9a1a8]">
            {cleanupCount.toLocaleString()} regular account{cleanupCount === 1 ? "" : "s"} lack Discord verification.
            This permanently removes their TokenForge data without blocking later fresh signup. A local sign-in shows a
            one-time explanation after cleanup.
          </p>
          <AlertDialog
            open={cleanupOpen}
            onOpenChange={(open) => {
              setCleanupOpen(open);
              if (!open) setCleanupConfirmation("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-4 border-red-400/30 text-red-200 hover:bg-red-400/10 hover:text-red-100"
                disabled={!cleanupCount || unverifiedCleanup.isLoading || deleteUnverified.isPending}
              >
                Review & delete {cleanupCount.toLocaleString()}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-red-400/20 bg-[#09090b] text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Permanently delete {cleanupCount.toLocaleString()} Discord-unverified accounts?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[#a1a2b2]">
                  This removes selected account data, API keys, usage, credits, and sessions. These email addresses are
                  not blocked, and the server rechecks the displayed count before deletion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="discord-unverified-cleanup-confirmation-op">
                Type <span className="font-mono text-red-200">{cleanupPhrase}</span> to confirm
              </label>
              <Input
                id="discord-unverified-cleanup-confirmation-op"
                value={cleanupConfirmation}
                onChange={(event) => setCleanupConfirmation(event.target.value)}
                autoComplete="off"
                className="border-red-400/20 bg-black/20 font-mono text-xs text-white"
                disabled={deleteUnverified.isPending}
              />
              <AlertDialogFooter>
                <AlertDialogCancel
                  className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white"
                  disabled={deleteUnverified.isPending}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={cleanupConfirmation.trim() !== cleanupPhrase || deleteUnverified.isPending}
                  onClick={() =>
                    deleteUnverified.mutate({
                      expectedCount: cleanupCount,
                      confirmation: cleanupConfirmation.trim(),
                    })
                  }
                  className="bg-red-300 text-[#3a1219] hover:bg-red-200"
                >
                  Delete {cleanupCount.toLocaleString()} accounts
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="rounded-xl border border-[#c9ff73]/25 bg-[#c9ff73]/[.045] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#e4f5c8]">Registered accounts giveaway</p>
              <p className="mt-1 text-[10px] leading-5 text-[#a7aa9a]">
                Credit one USD amount to all registered user accounts. Each recipient receives a
                visible wallet entry; the recipient set is rechecked before any credit is applied.
              </p>
            </div>
            <Badge className="shrink-0 border-0 bg-[#c9ff73]/10 text-[10px] text-[#c9ff73]">
              {giveawayRecipients.isLoading ? "Checking…" : `${giveawayRecipientCount.toLocaleString()} eligible`}
            </Badge>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              aria-label="Giveaway amount in USD"
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              inputMode="decimal"
              value={giveawayAmount}
              onChange={(event) => setGiveawayAmount(event.target.value)}
              placeholder="Amount per account"
              className="h-9 min-w-0 border-[#c9ff73]/20 bg-black/15 px-2 text-xs text-white placeholder:text-[#767886]"
              disabled={runGiveaway.isPending}
            />
            <AlertDialog
              open={giveawayOpen}
              onOpenChange={(open) => {
                setGiveawayOpen(open);
                if (!open) setGiveawayConfirmation("");
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 shrink-0 bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
                  disabled={
                    !isValidGiveawayAmount ||
                    !giveawayRecipientCount ||
                    giveawayRecipients.isLoading ||
                    runGiveaway.isPending
                  }
                >
                  <WalletCards size={14} />
                  Review
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-[#c9ff73]/25 bg-[#09090b] text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Credit all registered accounts?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[#a1a2b2]">
                    This adds{" "}
                    <span className="font-semibold text-[#e4f5c8]">
                      ${isValidGiveawayAmount ? parsedGiveawayAmount.toFixed(2) : "0.00"}
                    </span>{" "}
                    to each of the currently reviewed{" "}
                    <span className="font-semibold text-[#e4f5c8]">
                      {giveawayRecipientCount.toLocaleString()}
                    </span>{" "}
                    registered account{giveawayRecipientCount === 1 ? "" : "s"}, for a total allocation of{" "}
                    <span className="font-semibold text-[#e4f5c8]">
                      $
                      {isValidGiveawayAmount
                        ? (parsedGiveawayAmount * giveawayRecipientCount).toFixed(2)
                        : "0.00"}
                    </span>
                    . Repeating a giveaway creates an additional credit grant.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="discord-verified-giveaway-note">
                    Recipient announcement <span className="font-normal text-[#898b99]">(optional)</span>
                  </label>
                  <Textarea
                    id="discord-verified-giveaway-note"
                    value={giveawayAnnouncement}
                    onChange={(event) => setGiveawayAnnouncement(event.target.value)}
                    maxLength={256}
                    placeholder="Example: Thank you for being a verified TokenForge Discord member."
                    className="min-h-20 border-[#c9ff73]/20 bg-black/20 text-xs text-white placeholder:text-[#767886]"
                    disabled={runGiveaway.isPending}
                  />
                  <p className="text-[10px] text-[#898b99]">Shown only in each recipient’s wallet activity.</p>
                </div>
                <label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="discord-verified-giveaway-confirmation">
                  Type <span className="font-mono text-[#c9ff73]">{giveawayPhrase}</span> to confirm
                </label>
                <Input
                  id="discord-verified-giveaway-confirmation"
                  value={giveawayConfirmation}
                  onChange={(event) => setGiveawayConfirmation(event.target.value)}
                  placeholder={giveawayPhrase}
                  autoComplete="off"
                  className="border-[#c9ff73]/20 bg-black/20 font-mono text-xs text-white"
                  disabled={runGiveaway.isPending}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel
                    className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white"
                    disabled={runGiveaway.isPending}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={giveawayConfirmation.trim() !== giveawayPhrase || runGiveaway.isPending}
                    onClick={() =>
                      runGiveaway.mutate({
                        amountUsd: parsedGiveawayAmount,
                        announcementNote: giveawayAnnouncement.trim() || undefined,
                        expectedRecipientCount: giveawayRecipientCount,
                        confirmation: giveawayConfirmation.trim(),
                      })
                    }
                    className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
                  >
                    {runGiveaway.isPending ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Crediting…
                      </>
                    ) : (
                      "Credit verified accounts"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="mt-3 text-[10px] text-[#909982]">
            The amount is per eligible account. Only completed Discord verification qualifies.
          </p>
        </div>
      </div>
      <div className="mt-5 border-t border-white/8 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-white">Giveaway history</p>
            <p className="mt-1 text-[10px] text-[#8f90a2]">
              Completed administrator grants, including the amount, recipient count, and recipient-facing
              announcement.
            </p>
          </div>
          <Badge className="border-0 bg-white/6 text-[10px] text-[#b9bac8]">
            {giveawayHistory.isLoading ? "Loading…" : `${giveawayHistory.data?.length ?? 0} recorded`}
          </Badge>
        </div>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {giveawayHistory.isLoading ? (
            <div className="grid h-20 place-items-center">
              <Loader2 className="animate-spin text-[#c9ff73]" size={16} />
            </div>
          ) : giveawayHistory.data?.length ? (
            giveawayHistory.data.map((giveaway) => (
              <div key={giveaway.id} className="rounded-xl border border-white/8 bg-black/15 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#e4f5c8]">
                      {formatCredits(giveaway.amountNanos)} per verified account
                    </p>
                    <p className="mt-1 text-[10px] text-[#9193a1]">
                      {giveaway.recipientCount.toLocaleString()} recipient{giveaway.recipientCount === 1 ? "" : "s"} ·{" "}
                      {formatCredits(giveaway.totalAmountNanos)} allocated
                    </p>
                  </div>
                  <time className="text-[10px] text-[#858697]" dateTime={new Date(giveaway.createdAt).toISOString()}>
                    {new Date(giveaway.createdAt).toLocaleString()}
                  </time>
                </div>
                {giveaway.announcementNote && (
                  <p className="mt-3 border-t border-white/8 pt-3 text-[11px] leading-5 text-[#d8d9e4]">
                    “{giveaway.announcementNote}”
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 py-7 text-center text-xs text-[#858697]">
              No completed giveaways have been recorded yet.
            </p>
          )}
        </div>
      </div>
    </section>
    </div>
  );
}
