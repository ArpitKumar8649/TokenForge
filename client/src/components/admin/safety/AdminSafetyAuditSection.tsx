import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  User,
  Clock,
  Terminal,
  Cpu,
  Eye,
  AlertTriangle,
  Copy,
  Check,
  Filter,
  Users,
  Trash2,
  Loader2,
} from "lucide-react";
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
import { toast } from "sonner";
import { SectionHeader } from "../common/AdminCommon";

interface SafetyAuditRecord {
  id: number;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  model: string;
  triggerType: string;
  matchedKeywords: string | null;
  userInput: string;
  outputShown: string;
  ipAddress: string | null;
  createdAt: string;
}

export function AdminSafetyAuditSection() {
  const [search, setSearch] = useState("");
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<string>("all");
  const [selectedRecord, setSelectedRecord] = useState<SafetyAuditRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const safetyQuery = trpc.admin.safetyAudit.useQuery(
    {
      limit: 100,
      offset: 0,
      search: search.trim() || undefined,
      triggerType: triggerTypeFilter !== "all" ? triggerTypeFilter : undefined,
    },
    {
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
    }
  );

  const data = safetyQuery.data;
  const logs: SafetyAuditRecord[] = (data?.logs ?? []) as SafetyAuditRecord[];
  const stats = data?.stats ?? { totalProbes: 0, uniqueUsers: 0, topTriggers: {} };

  const utils = trpc.useUtils();
  const clearMutation = trpc.admin.clearSafetyAuditLogs.useMutation({
    onSuccess: () => {
      toast.success("All safety audit records have been permanently deleted.");
      void utils.admin.safetyAudit.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to clear safety audit records");
    },
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTriggerBadge = (type: string, keywords?: string | null) => {
    if (type === "competitor_probe") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
          <AlertTriangle size={12} />
          Competitor Probe
          {keywords && <span className="text-red-300 font-normal">({keywords})</span>}
        </span>
      );
    }
    if (type === "prompt_extraction") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <ShieldAlert size={12} />
          Prompt Extraction
          {keywords && <span className="text-amber-200 font-normal">({keywords})</span>}
        </span>
      );
    }
    if (type === "upstream_leak_scrubbed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
          <ShieldCheck size={12} />
          Upstream Scrubbed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
        <ShieldAlert size={12} />
        Inbound Identity Probe
        {keywords && <span className="text-blue-200 font-normal">({keywords})</span>}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Metrics Banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dashboard-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#9091a3]">Total Flagged Probes</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.totalProbes.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-[#818296]">Keyword-triggered events</p>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
            <ShieldAlert size={22} />
          </div>
        </div>

        <div className="dashboard-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#9091a3]">Unique Probing Accounts</p>
            <p className="mt-1 text-2xl font-bold text-[#c9ff73]">{stats.uniqueUsers.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-[#818296]">Distinct user accounts</p>
          </div>
          <div className="p-3 rounded-xl bg-[#c9ff73]/10 text-[#c9ff73]">
            <Users size={22} />
          </div>
        </div>

        <div className="dashboard-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#9091a3]">Competitor Keywords</p>
            <p className="mt-1 text-2xl font-bold text-amber-400">
              {(stats.topTriggers["competitor_probe"] ?? 0).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-[#818296]">OpenAI, DeepSeek, Qwen, etc.</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="dashboard-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#9091a3]">Prompt Extractions</p>
            <p className="mt-1 text-2xl font-bold text-cyan-400">
              {(stats.topTriggers["prompt_extraction"] ?? 0).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-[#818296]">Jailbreaks & system prompt fishing</p>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Terminal size={22} />
          </div>
        </div>
      </div>

      {/* Main Section */}
      <section className="dashboard-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            icon={<ShieldAlert size={18} className="text-red-400" />}
            title="Safety Audit: Keyword Sanitization & Probe Monitoring"
            detail="Real-time log of user prompts sanitized by keyword filters or identity protection guards, capturing account IDs, user names, probe inputs, and sanitized outputs."
          />
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={logs.length === 0 || clearMutation.isPending}
                  className="bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 hover:text-red-200"
                >
                  {clearMutation.isPending ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <Trash2 size={14} className="mr-1.5" />
                  )}
                  Delete All Messages
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/10 bg-[#141416] text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Safety Audit Messages?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[#9899ac]">
                    This will permanently remove all safety audit probe logs and recorded user messages from the database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearMutation.mutate()}
                    className="bg-red-600 text-white hover:bg-red-700 font-semibold"
                  >
                    Yes, Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              size="sm"
              variant="outline"
              onClick={() => safetyQuery.refetch()}
              disabled={safetyQuery.isFetching}
              className="border-white/12 text-[#d9d8e1] hover:bg-white/10"
            >
              <RefreshCw size={14} className={`mr-1.5 ${safetyQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707184]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by account ID, user name, email, input text, or keywords..."
              className="pl-9 h-10 border-white/10 bg-black/30 text-sm text-white placeholder:text-[#6c6e80]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-lg border border-white/10 text-xs">
            <Filter size={13} className="ml-2 text-[#707184]" />
            <button
              type="button"
              onClick={() => setTriggerTypeFilter("all")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                triggerTypeFilter === "all"
                  ? "bg-[#c9ff73] text-[#17210d] font-semibold"
                  : "text-[#a2a3b5] hover:text-white"
              }`}
            >
              All Events
            </button>
            <button
              type="button"
              onClick={() => setTriggerTypeFilter("competitor_probe")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                triggerTypeFilter === "competitor_probe"
                  ? "bg-red-500/20 text-red-300 font-semibold border border-red-500/30"
                  : "text-[#a2a3b5] hover:text-white"
              }`}
            >
              Competitor Probes
            </button>
            <button
              type="button"
              onClick={() => setTriggerTypeFilter("prompt_extraction")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                triggerTypeFilter === "prompt_extraction"
                  ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30"
                  : "text-[#a2a3b5] hover:text-white"
              }`}
            >
              Prompt Extractions
            </button>
            <button
              type="button"
              onClick={() => setTriggerTypeFilter("inbound_probe")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                triggerTypeFilter === "inbound_probe"
                  ? "bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30"
                  : "text-[#a2a3b5] hover:text-white"
              }`}
            >
              Identity Inquiries
            </button>
          </div>
        </div>

        {/* Safety Audit Events Table */}
        {safetyQuery.isLoading ? (
          <div className="py-16 text-center text-sm text-[#8c8d9f]">
            <RefreshCw className="mx-auto mb-2 animate-spin text-[#c9ff73]" size={20} />
            Loading safety audit events...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center rounded-xl border border-white/5 bg-black/20 p-8">
            <ShieldCheck size={36} className="mx-auto text-[#c9ff73]/80 mb-3" />
            <p className="text-sm font-semibold text-white">No probe instances recorded</p>
            <p className="mt-1 text-xs text-[#8c8d9f] max-w-md mx-auto">
              {search || triggerTypeFilter !== "all"
                ? "No audit records matched your search query or filter. Try clearing filters."
                : "Whenever user input triggers keyword detection or probing sanitization, full account details, input, and sanitized output will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-white/10 bg-black/25 p-4 hover:border-white/20 transition-all"
              >
                {/* Header row: Account Info, Model, Trigger Badge, Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center text-[#c9ff73] font-semibold text-xs border border-white/10">
                      {log.userId ? `#${log.userId}` : "API"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {log.userName || (log.userId ? `Account #${log.userId}` : "Anonymous API Key")}
                        </span>
                        {log.userId && (
                          <Badge variant="outline" className="text-[10px] border-white/15 text-[#9e9fad]">
                            Account ID: {log.userId}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-400">
                          <Cpu size={10} className="mr-1" />
                          {log.model}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#868799]">
                        {log.userEmail || "No registered email"}
                        {log.ipAddress && ` • IP: ${log.ipAddress}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getTriggerBadge(log.triggerType, log.matchedKeywords)}
                    <span className="text-[11px] text-[#717285] flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(log.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}{" "}
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedRecord(log)}
                      className="h-8 px-2 text-xs text-[#c9ff73] hover:bg-[#c9ff73]/10"
                    >
                      <Eye size={13} className="mr-1" /> Inspect
                    </Button>
                  </div>
                </div>

                {/* Input and Output comparison grid */}
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  {/* User Input Section */}
                  <div className="rounded-lg border border-red-500/20 bg-red-950/10 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-red-300 flex items-center gap-1.5">
                          <AlertTriangle size={13} />
                          User Input (Sanitized / Triggered)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(log.userInput, `input-${log.id}`)}
                          className="h-6 px-1.5 text-[10px] text-red-300/80 hover:bg-red-500/10"
                        >
                          {copiedId === `input-${log.id}` ? <Check size={11} /> : <Copy size={11} />}
                          <span className="ml-1">Copy</span>
                        </Button>
                      </div>
                      <p className="text-white/90 whitespace-pre-wrap font-mono text-[11px] max-h-24 overflow-y-auto leading-relaxed bg-black/40 p-2.5 rounded border border-white/5">
                        {log.userInput}
                      </p>
                    </div>
                    {log.matchedKeywords && (
                      <div className="mt-2 text-[10px] text-red-400">
                        <span className="font-medium text-red-300">Detected terms:</span> {log.matchedKeywords}
                      </div>
                    )}
                  </div>

                  {/* Output Shown Section */}
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                          <ShieldCheck size={13} />
                          Output Shown to User
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(log.outputShown, `output-${log.id}`)}
                          className="h-6 px-1.5 text-[10px] text-emerald-300/80 hover:bg-emerald-500/10"
                        >
                          {copiedId === `output-${log.id}` ? <Check size={11} /> : <Copy size={11} />}
                          <span className="ml-1">Copy</span>
                        </Button>
                      </div>
                      <p className="text-white/90 whitespace-pre-wrap font-mono text-[11px] max-h-24 overflow-y-auto leading-relaxed bg-black/40 p-2.5 rounded border border-white/5">
                        {log.outputShown}
                      </p>
                    </div>
                    <div className="mt-2 text-[10px] text-emerald-400">
                      <span className="font-medium text-emerald-300">Defense Status:</span> Upstream identity fully masked; safe brand response returned.
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#121319] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#9192a4] font-semibold">Incident Details</p>
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-1">
                  Safety Audit Incident #{selectedRecord.id}
                  {getTriggerBadge(selectedRecord.triggerType, selectedRecord.matchedKeywords)}
                </h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedRecord(null)}
                className="border-white/15 text-[#c2c3d4] hover:bg-white/10"
              >
                Close
              </Button>
            </div>

            {/* Account Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/40 p-4 rounded-xl border border-white/10 text-xs">
              <div>
                <p className="text-[#7d7e90]">Account ID</p>
                <p className="font-semibold text-white mt-0.5">{selectedRecord.userId ? `#${selectedRecord.userId}` : "N/A"}</p>
              </div>
              <div>
                <p className="text-[#7d7e90]">Name</p>
                <p className="font-semibold text-white mt-0.5">{selectedRecord.userName || "Unknown"}</p>
              </div>
              <div>
                <p className="text-[#7d7e90]">Email</p>
                <p className="font-semibold text-white mt-0.5 truncate">{selectedRecord.userEmail || "N/A"}</p>
              </div>
              <div>
                <p className="text-[#7d7e90]">Model</p>
                <p className="font-semibold text-[#c9ff73] mt-0.5">{selectedRecord.model}</p>
              </div>
            </div>

            {/* Full Input Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-300 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Full Raw User Input (Triggered Sanitization)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(selectedRecord.userInput, "modal-input")}
                  className="h-7 px-2 text-xs text-red-300"
                >
                  <Copy size={12} className="mr-1" /> Copy Input
                </Button>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-950/15 p-4 font-mono text-xs text-white/90 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {selectedRecord.userInput}
              </div>
            </div>

            {/* Full Output Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Output Shown to User (Safe Response)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(selectedRecord.outputShown, "modal-output")}
                  className="h-7 px-2 text-xs text-emerald-300"
                >
                  <Copy size={12} className="mr-1" /> Copy Output
                </Button>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-4 font-mono text-xs text-white/90 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {selectedRecord.outputShown}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-[#828395]">
              <span>Recorded on {new Date(selectedRecord.createdAt).toLocaleString()}</span>
              <Button
                size="sm"
                onClick={() => setSelectedRecord(null)}
                className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
