import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Eye,
  Search,
  RefreshCw,
  User,
  Clock,
  Terminal,
  Cpu,
  Trash2,
  Copy,
  Check,
  Filter,
  Users,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "../common/AdminCommon";

interface UserInteractionRecord {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  model: string;
  provider?: string | null;
  source: string;
  userInput: string;
  outputResponse: string;
  ipAddress: string | null;
  createdAt: string;
}

/** Formats an ISO date string into a clear, readable 12-hour timestamp */
function format12HourTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

export function AdminUserMessageInspector() {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();

  const logsQuery = trpc.admin.userInteractionLogs.useQuery(
    {
      userId: selectedUserId,
      search: search.trim() || undefined,
      model: modelFilter !== "all" ? modelFilter : undefined,
      limit: 100,
      offset: 0,
    },
    {
      refetchInterval: 10_000,
      refetchIntervalInBackground: false,
    }
  );

  const clearAllMutation = trpc.admin.clearUserInteractionLogs.useMutation({
    onSuccess: () => {
      toast.success(
        selectedUserId
          ? "Logged messages for the selected user have been cleared."
          : "All inspected user message logs have been permanently deleted."
      );
      void utils.admin.userInteractionLogs.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to clear user message logs");
    },
  });

  const deleteSingleMutation = trpc.admin.deleteUserInteractionLog.useMutation({
    onSuccess: () => {
      toast.success("Log entry deleted");
      void utils.admin.userInteractionLogs.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete log entry");
    },
  });

  const data = logsQuery.data;
  const logs: UserInteractionRecord[] = (data?.logs ?? []) as UserInteractionRecord[];
  const total = data?.total ?? 0;
  const uniqueUsers = data?.uniqueUsers ?? 0;
  const monitoredUsers = (data?.monitoredUsers ?? []) as Array<{ id: number; name: string | null; email: string | null }>;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dashboard-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#9091a3]">Logged Conversations</p>
            <p className="mt-1 text-2xl font-bold text-cyan-400">{total.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-[#818296]">Total monitored prompt/response turns</p>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
            <MessageSquare size={22} />
          </div>
        </div>

        <div className="dashboard-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#9091a3]">Active Monitored Users</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{monitoredUsers.length}</p>
            <p className="mt-0.5 text-[11px] text-[#818296]">Accounts with inspection toggled ON</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Eye size={22} />
          </div>
        </div>

        <div className="dashboard-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#9091a3]">Accounts with Logs</p>
            <p className="mt-1 text-2xl font-bold text-white">{uniqueUsers}</p>
            <p className="mt-0.5 text-[11px] text-[#818296]">Distinct users with recorded turns</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 text-[#c9c8d2]">
            <Users size={22} />
          </div>
        </div>

        <div className="dashboard-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#9091a3]">Timestamp Standard</p>
            <p className="mt-1 text-lg font-bold text-[#c9ff73]">12-Hour Format</p>
            <p className="mt-0.5 text-[11px] text-[#818296]">hh:mm:ss a (AM / PM)</p>
          </div>
          <div className="p-3 rounded-xl bg-[#c9ff73]/10 text-[#c9ff73]">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Main Inspection Feed Container */}
      <section className="dashboard-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            icon={<Eye size={18} className="text-cyan-400" />}
            title="User Message Inspector: Live Prompts & AI Responses"
            detail="Real-time log of full user input prompts and AI model responses for accounts where inspection is toggled ON. Formatted with 12-hour timestamps."
          />
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={logs.length === 0 || clearAllMutation.isPending}
                  className="bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 hover:text-red-200"
                >
                  {clearAllMutation.isPending ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <Trash2 size={14} className="mr-1.5" />
                  )}
                  {selectedUserId ? "Clear User Logs" : "Delete All Logs"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/10 bg-[#141416] text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {selectedUserId
                      ? "Delete Inspected Logs for Selected User?"
                      : "Delete All Inspected User Messages?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[#9899ac]">
                    This will permanently delete all recorded user prompts and AI completion logs from the database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearAllMutation.mutate({ userId: selectedUserId })}
                    className="bg-red-600 text-white hover:bg-red-700 font-semibold"
                  >
                    Yes, Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              size="sm"
              variant="outline"
              onClick={() => logsQuery.refetch()}
              disabled={logsQuery.isFetching}
              className="border-white/12 text-[#d9d8e1] hover:bg-white/10"
            >
              <RefreshCw size={14} className={`mr-1.5 ${logsQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707184]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts, AI completions, user name, or email..."
              className="pl-9 h-10 border-white/10 bg-black/30 text-sm text-white placeholder:text-[#6c6e80]"
            />
          </div>

          {/* User Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white">
            <User size={13} className="text-[#707184]" />
            <span className="text-[#8f90a2]">User:</span>
            <select
              value={selectedUserId ?? "all"}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedUserId(val === "all" ? undefined : Number(val));
              }}
              className="bg-transparent text-white text-xs outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#141416] text-white">All Users</option>
              {monitoredUsers.map((u) => (
                <option key={u.id} value={u.id} className="bg-[#141416] text-white">
                  {u.name || u.email || `User #${u.id}`} ({u.email || `#${u.id}`})
                </option>
              ))}
            </select>
          </div>

          {/* Model Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white">
            <Cpu size={13} className="text-[#707184]" />
            <span className="text-[#8f90a2]">Model:</span>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="bg-transparent text-white text-xs outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#141416] text-white">All Models</option>
              <option value="claude-opus-5" className="bg-[#141416] text-white">Claude Opus 5</option>
              <option value="claude-fable-5.1" className="bg-[#141416] text-white">Claude Fable 5.1</option>
              <option value="glm-5.3" className="bg-[#141416] text-white">GLM 5.3</option>
              <option value="claude-sonnet-4.6" className="bg-[#141416] text-white">Claude Sonnet 4.6</option>
              <option value="deepseek-v4-pro" className="bg-[#141416] text-white">DeepSeek V4 Pro</option>
              <option value="qwen3.8-max" className="bg-[#141416] text-white">Qwen 3.8 Max</option>
              <option value="gpt-6-astra" className="bg-[#141416] text-white">GPT-6 Astra</option>
              <option value="kimi-k3" className="bg-[#141416] text-white">Kimi K3</option>
            </select>
          </div>
        </div>

        {/* Monitored Users Quick Bar */}
        {monitoredUsers.length > 0 && (
          <div className="p-2.5 rounded-lg bg-cyan-500/[0.06] border border-cyan-500/20 text-xs flex flex-wrap items-center gap-2">
            <span className="text-cyan-300 font-medium flex items-center gap-1">
              <Eye size={13} /> Active Monitored Users:
            </span>
            {monitoredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUserId(selectedUserId === u.id ? undefined : u.id)}
                className={`px-2 py-0.5 rounded border transition-all text-[11px] font-semibold cursor-pointer ${
                  selectedUserId === u.id
                    ? "bg-cyan-500/30 border-cyan-400 text-cyan-200"
                    : "bg-black/30 border-cyan-500/20 text-cyan-300/80 hover:bg-cyan-500/15"
                }`}
              >
                {u.name || u.email || `User #${u.id}`}
              </button>
            ))}
          </div>
        )}

        {/* Logs Feed */}
        {logsQuery.isLoading ? (
          <div className="py-16 text-center text-[#9091a3] flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-cyan-400" size={24} />
            <p className="text-xs">Loading inspected user conversations...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-[#818296] border border-dashed border-white/10 rounded-xl p-8 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Eye size={22} />
            </div>
            <p className="text-sm font-semibold text-white">No Monitored Messages Found</p>
            <p className="text-xs max-w-md mx-auto text-[#9091a3] leading-relaxed">
              To start logging full user inputs and AI outputs, go to the <strong>Accounts</strong> tab and click <strong>"Inspect: ON"</strong> beside any user.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const isExpanded = expandedIds.has(log.id);
              const formattedTime = format12HourTime(log.createdAt);

              return (
                <div
                  key={log.id}
                  className="rounded-xl border border-white/10 bg-[#121214] p-4 transition-all hover:border-cyan-500/30 space-y-3"
                >
                  {/* Header: User Info, Model, 12-Hour Timestamp, Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {log.userName || "Unnamed User"}
                      </span>
                      <span className="text-xs text-[#8f90a2] font-mono">
                        ({log.userEmail || `User ID: ${log.userId}`})
                      </span>
                      <Badge className="border-0 bg-cyan-500/15 text-cyan-300 font-mono text-[10px]">
                        User #{log.userId}
                      </Badge>
                      <Badge className="border-0 bg-purple-500/15 text-purple-300 font-semibold text-[10px]">
                        {log.model}
                      </Badge>
                      {log.provider && (
                        <Badge className="border-0 bg-emerald-500/15 text-emerald-300 font-semibold text-[10px]">
                          Provider: {log.provider}
                        </Badge>
                      )}
                      <Badge className="border-0 bg-white/5 text-[#a2a3b5] text-[10px] uppercase">
                        {log.source}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-[#c9ff73] font-mono bg-black/40 px-2.5 py-1 rounded-md border border-white/5">
                        <Clock size={12} className="text-[#c9ff73]" />
                        <span>{formattedTime}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteSingleMutation.mutate({ id: log.id })}
                        disabled={deleteSingleMutation.isPending}
                        className="h-7 w-7 p-0 text-[#8f90a2] hover:text-red-400 hover:bg-red-500/10"
                        title="Delete this record"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>

                  {/* Message Content: User Input & AI Response */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* User Prompt */}
                    <div className="rounded-lg bg-black/40 border border-white/5 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#8f90a2] font-semibold border-b border-white/5 pb-1.5">
                        <span className="flex items-center gap-1.5 text-amber-300">
                          <User size={13} /> User Prompt (Input)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(log.userInput, `input-${log.id}`)}
                          className="h-6 px-2 text-[10px] text-[#9091a3] hover:text-white"
                        >
                          {copiedId === `input-${log.id}` ? (
                            <Check size={11} className="text-emerald-400 mr-1" />
                          ) : (
                            <Copy size={11} className="mr-1" />
                          )}
                          Copy
                        </Button>
                      </div>
                      <div
                        className={`text-xs text-[#e2e1ea] font-mono whitespace-pre-wrap break-words leading-relaxed overflow-hidden ${
                          !isExpanded && log.userInput.length > 300 ? "max-h-24 relative" : ""
                        }`}
                      >
                        {log.userInput}
                        {!isExpanded && log.userInput.length > 300 && (
                          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#121214] to-transparent" />
                        )}
                      </div>
                    </div>

                    {/* AI Model Output */}
                    <div className="rounded-lg bg-cyan-950/20 border border-cyan-500/15 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#8f90a2] font-semibold border-b border-white/5 pb-1.5">
                        <span className="flex items-center gap-1.5 text-cyan-300">
                          <Sparkles size={13} /> AI Response (Output)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(log.outputResponse, `output-${log.id}`)}
                          className="h-6 px-2 text-[10px] text-cyan-300/80 hover:text-cyan-200"
                        >
                          {copiedId === `output-${log.id}` ? (
                            <Check size={11} className="text-emerald-400 mr-1" />
                          ) : (
                            <Copy size={11} className="mr-1" />
                          )}
                          Copy
                        </Button>
                      </div>
                      <div
                        className={`text-xs text-[#c9ff73]/90 font-mono whitespace-pre-wrap break-words leading-relaxed overflow-hidden ${
                          !isExpanded && log.outputResponse.length > 300 ? "max-h-24 relative" : ""
                        }`}
                      >
                        {log.outputResponse}
                        {!isExpanded && log.outputResponse.length > 300 && (
                          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#121214] to-transparent" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expand / Collapse Toggle if content is long */}
                  {(log.userInput.length > 300 || log.outputResponse.length > 300) && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.id)}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={12} /> Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown size={12} /> Expand Full Conversation
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
