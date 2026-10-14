import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileCode2,
  GitCompare,
  Layers,
  Loader2,
  Power,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function CacheDebuggerTab() {
  const utils = trpc.useUtils();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterSession, setFilterSession] = useState<string | null>(null);

  // Modal states
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedReqAId, setSelectedReqAId] = useState<string | null>(null);
  const [selectedReqBId, setSelectedReqBId] = useState<string | null>(null);
  const [diffField, setDiffField] = useState<"upstream_body" | "incoming_body">("upstream_body");

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailReqId, setDetailReqId] = useState<string | null>(null);

  // Queries
  const statusQuery = trpc.admin.getCacheDebugStatus.useQuery(undefined, {
    refetchInterval: autoRefresh ? 4_000 : false,
  });

  const requestsQuery = trpc.admin.getCacheDebugRequests.useQuery(undefined, {
    refetchInterval: autoRefresh ? 4_000 : false,
  });

  const requestDetailQuery = trpc.admin.getCacheDebugRequestDetail.useQuery(
    { id: detailReqId || "" },
    { enabled: Boolean(detailReqId && detailModalOpen) }
  );

  const diffQuery = trpc.admin.diffCacheDebugRequests.useQuery(
    {
      reqAId: selectedReqAId || "",
      reqBId: selectedReqBId || "",
      field: diffField,
    },
    {
      enabled: Boolean(selectedReqAId && selectedReqBId && diffModalOpen),
    }
  );

  // Optimistic local toggle state
  const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);
  const isEnabled = localEnabled !== null ? localEnabled : (statusQuery.data?.enabled ?? false);

  React.useEffect(() => {
    if (statusQuery.data?.enabled !== undefined && localEnabled === null) {
      setLocalEnabled(statusQuery.data.enabled);
    }
  }, [statusQuery.data?.enabled, localEnabled]);

  // Mutations
  const setStatusMutation = trpc.admin.setCacheDebugStatus.useMutation({
    onMutate: async ({ enabled }) => {
      setLocalEnabled(enabled);
      await utils.admin.getCacheDebugStatus.cancel();
      const prev = utils.admin.getCacheDebugStatus.getData();
      utils.admin.getCacheDebugStatus.setData(undefined, (old) => ({
        enabled,
        count: old?.count ?? 0,
      }));
      return { prev };
    },
    onSuccess: (data) => {
      setLocalEnabled(data.enabled);
      utils.admin.getCacheDebugStatus.setData(undefined, (old) => ({
        enabled: data.enabled,
        count: old?.count ?? 0,
      }));
      toast.success(data.enabled ? "Cache Debugger enabled (capturing live requests)" : "Cache Debugger disabled");
    },
    onError: (err, _vars, context) => {
      if (context?.prev) {
        utils.admin.getCacheDebugStatus.setData(undefined, context.prev);
        setLocalEnabled(context.prev.enabled);
      }
      toast.error(err.message);
    },
  });

  const clearMutation = trpc.admin.clearCacheDebugRequests.useMutation({
    onSuccess: () => {
      toast.success("Debug logs cleared");
      void utils.admin.getCacheDebugRequests.invalidate();
      void utils.admin.getCacheDebugStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const exportMutation = trpc.admin.exportCacheDebugJsonl.useQuery(undefined, {
    enabled: false,
  });

  const handleExportJsonl = async () => {
    try {
      const res = await exportMutation.refetch();
      if (!res.data) {
        toast.error("No debug logs to export");
        return;
      }
      const blob = new Blob([res.data], { type: "application/x-ndjson" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tokenforge-cache-debug-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.jsonl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("JSONL exported successfully");
    } catch {
      toast.error("Failed to export JSONL");
    }
  };

  const requests = requestsQuery.data ?? [];
  const filteredRequests = useMemo(() => {
    if (!filterSession) return requests;
    return requests.filter((r) => r.sessionId === filterSession);
  }, [requests, filterSession]);

  const handleOpenDiffWithPrev = (currReqId: string, sessionId: string) => {
    // Find index of current request
    const idx = requests.findIndex((r) => r.id === currReqId);
    if (idx === -1) return;

    // Look for previous request in the exact same session (index > idx since array is ordered newest-first)
    const prevInSession = requests.slice(idx + 1).find((r) => r.sessionId === sessionId);
    if (prevInSession) {
      setSelectedReqAId(prevInSession.id); // older turn
      setSelectedReqBId(currReqId); // newer turn
      setDiffModalOpen(true);
    } else {
      toast.info(`This is the first recorded turn in session ${sessionId}. Send another prompt in this session to compare consecutive turns.`);
    }
  };

  const handleOpenArbitraryDiff = (reqAId: string, reqBId: string) => {
    setSelectedReqAId(reqAId);
    setSelectedReqBId(reqBId);
    setDiffModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Controls */}
      <div className="dashboard-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
              isEnabled
                ? "border-[#c9ff73]/30 bg-[#c9ff73]/10 text-[#c9ff73]"
                : "border-white/10 bg-white/5 text-[#858697]"
            }`}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Cache Debugger & Byte-by-Byte Diff</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  isEnabled
                    ? "bg-[#c9ff73]/15 text-[#c9ff73] border border-[#c9ff73]/30"
                    : "bg-white/5 text-[#858697] border border-white/10"
                }`}
              >
                {isEnabled ? "Capturing Active" : "Disabled (0 Overhead)"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#a0a1b2]">
              Captures exact incoming and upstream JSON payloads to detect exact character-level breakpoints and verify
              session prefix stability across multi-turn conversations.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <span className="text-xs font-medium text-[#d9d8e1]">Live Logging</span>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => setStatusMutation.mutate({ enabled: checked })}
              disabled={setStatusMutation.isPending}
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void utils.admin.getCacheDebugRequests.invalidate();
              void utils.admin.getCacheDebugStatus.invalidate();
            }}
            className="border-white/10 text-white hover:bg-white/10"
          >
            <RefreshCw size={14} className={requestsQuery.isFetching ? "animate-spin" : ""} />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportJsonl}
            disabled={requests.length === 0}
            className="border-white/10 text-white hover:bg-white/10"
          >
            <Download size={14} className="mr-1.5" />
            Export JSONL
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => clearMutation.mutate()}
            disabled={requests.length === 0 || clearMutation.isPending}
            className="border-rose-500/20 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
          >
            <Trash2 size={14} className="mr-1.5" />
            Clear Logs
          </Button>
        </div>
      </div>

      {/* Session Filter indicator if active */}
      {filterSession && (
        <div className="flex items-center justify-between rounded-xl border border-[#c9ff73]/20 bg-[#c9ff73]/5 px-4 py-2 text-xs text-[#c9ff73]">
          <span>
            Filtered by Session: <code className="font-mono font-bold">{filterSession}</code> ({filteredRequests.length}{" "}
            turns)
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFilterSession(null)}
            className="h-6 px-2 text-xs text-[#c9ff73] hover:bg-[#c9ff73]/10"
          >
            <X size={12} className="mr-1" /> Clear Filter
          </Button>
        </div>
      )}

      {/* Requests Feed Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#c9ff73]" />
            <h3 className="text-sm font-semibold text-white">Recent Requests ({filteredRequests.length})</h3>
          </div>
          <span className="text-[11px] text-[#808193]">In-memory ring buffer (last 100 entries)</span>
        </div>

        {requestsQuery.isLoading ? (
          <div className="grid h-48 place-items-center">
            <Loader2 className="animate-spin text-[#c9ff73]" size={24} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="grid min-h-[220px] place-items-center p-6 text-center">
            <div className="max-w-md">
              <FileCode2 className="mx-auto text-[#606173]" size={28} />
              <p className="mt-3 text-sm font-semibold text-white">No cache debug requests recorded yet</p>
              <p className="mt-1.5 text-xs leading-5 text-[#858697]">
                {!isEnabled
                  ? "Turn on 'Live Logging' above, then send requests via Claude Code, API, or Playground to capture and compare prompt cache diffs."
                  : "Logging is active! Send requests through /v1/messages or /v1/chat/completions to see live byte-by-byte diffs."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-[#808193]">
                <tr>
                  <th className="py-2.5 pl-5 pr-3 font-medium">Time / ID</th>
                  <th className="px-3 py-2.5 font-medium">Session ID</th>
                  <th className="px-3 py-2.5 font-medium">Model / Provider</th>
                  <th className="px-3 py-2.5 font-medium">Input Tokens</th>
                  <th className="px-3 py-2.5 font-medium">Cached Tokens</th>
                  <th className="px-3 py-2.5 font-medium">Cache Hit %</th>
                  <th className="px-3 py-2.5 font-medium">Latency</th>
                  <th className="py-2.5 pl-3 pr-5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#d9d8e1]">
                {filteredRequests.map((req, idx) => {
                  const date = new Date(req.createdAt);
                  const timeFormatted = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

                  return (
                    <tr key={req.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="py-3 pl-5 pr-3">
                        <div className="font-medium text-white">{timeFormatted}</div>
                        <div className="font-mono text-[10px] text-[#707183]">{req.id.slice(0, 16)}</div>
                      </td>

                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setFilterSession(filterSession === req.sessionId ? null : req.sessionId)}
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-[#c9ff73] transition-colors hover:bg-white/10"
                          title="Click to filter this conversation session"
                        >
                          {req.sessionId}
                        </button>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-medium text-white">{req.model}</div>
                        <div className="text-[11px] text-[#808193]">{req.providerLabel}</div>
                      </td>

                      <td className="px-3 py-3 font-mono">
                        {req.promptTokens.toLocaleString()}
                        <span className="ml-1 text-[10px] text-[#707183]">({Math.round(req.upstreamSize / 1024)} KB)</span>
                      </td>

                      <td className="px-3 py-3 font-mono font-medium">
                        {req.cachedTokens > 0 ? (
                          <span className="text-[#c9ff73]">{req.cachedTokens.toLocaleString()}</span>
                        ) : (
                          <span className="text-[#707183]">0</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            req.cachePercent >= 80
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : req.cachePercent >= 20
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {req.cachePercent}%
                        </span>
                      </td>

                      <td className="px-3 py-3 font-mono text-[#808193]">{req.latencyMs}ms</td>

                      <td className="py-3 pl-3 pr-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDiffWithPrev(req.id, req.sessionId)}
                            className="h-7 px-2 text-xs text-[#c9ff73] hover:bg-[#c9ff73]/10"
                            title="Diff byte-for-byte with previous turn in session"
                          >
                            <GitCompare size={13} className="mr-1" />
                            Diff Turn
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDetailReqId(req.id);
                              setDetailModalOpen(true);
                            }}
                            className="h-7 px-2 text-xs text-white hover:bg-white/10"
                            title="View Raw JSON Payload"
                          >
                            <Eye size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Byte-by-Byte Diff Modal */}
      {diffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121216] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#c9ff73]/20 bg-[#c9ff73]/10 text-[#c9ff73]">
                  <GitCompare size={17} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Prompt Cache Byte-by-Byte Diff</h3>
                  <p className="text-xs text-[#808193]">
                    Comparing Request A (earlier turn) vs Request B (subsequent turn)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Field Toggle: Upstream vs Incoming */}
                <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setDiffField("upstream_body")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      diffField === "upstream_body" ? "bg-[#c9ff73] text-[#121216]" : "text-[#858697] hover:text-white"
                    }`}
                  >
                    Upstream Payload
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiffField("incoming_body")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      diffField === "incoming_body" ? "bg-[#c9ff73] text-[#121216]" : "text-[#858697] hover:text-white"
                    }`}
                  >
                    Incoming Client JSON
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setDiffModalOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-[#858697] transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Request Selectors & Metadata comparison */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#808193]">Request A (Base Turn)</span>
                    <select
                      value={selectedReqAId || ""}
                      onChange={(e) => setSelectedReqAId(e.target.value)}
                      className="rounded border border-white/10 bg-[#1a1a22] px-2 py-1 text-xs text-white"
                    >
                      {requests.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.model} · {new Date(r.createdAt).toLocaleTimeString()} ({r.promptTokens} tok, {r.cachedTokens} c)
                        </option>
                      ))}
                    </select>
                  </div>
                  {diffQuery.data && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#707183]">Input Tokens</div>
                        <div className="font-mono font-medium text-white">
                          {diffQuery.data.reqA.promptTokens.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#707183]">Cached</div>
                        <div className="font-mono font-medium text-[#c9ff73]">
                          {diffQuery.data.reqA.cachedTokens.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#707183]">Cache %</div>
                        <div className="font-mono font-medium text-white">{diffQuery.data.reqA.cachePercent}%</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#808193]">Request B (Target Turn)</span>
                    <select
                      value={selectedReqBId || ""}
                      onChange={(e) => setSelectedReqBId(e.target.value)}
                      className="rounded border border-white/10 bg-[#1a1a22] px-2 py-1 text-xs text-white"
                    >
                      {requests.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.model} · {new Date(r.createdAt).toLocaleTimeString()} ({r.promptTokens} tok, {r.cachedTokens} c)
                        </option>
                      ))}
                    </select>
                  </div>
                  {diffQuery.data && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#707183]">Input Tokens</div>
                        <div className="font-mono font-medium text-white">
                          {diffQuery.data.reqB.promptTokens.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#707183]">Cached</div>
                        <div className="font-mono font-medium text-[#c9ff73]">
                          {diffQuery.data.reqB.cachedTokens.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#707183]">Cache %</div>
                        <div className="font-mono font-medium text-white">{diffQuery.data.reqB.cachePercent}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {diffQuery.isLoading ? (
                <div className="grid h-48 place-items-center">
                  <Loader2 className="animate-spin text-[#c9ff73]" size={24} />
                </div>
              ) : diffQuery.data ? (
                <>
                  {/* Summary Diagnosis Banner */}
                  <div
                    className={`rounded-xl border p-4 ${
                      diffQuery.data.isFullPrefixStable
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {diffQuery.data.isFullPrefixStable ? (
                        <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle size={20} className="shrink-0 text-amber-400" />
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {diffQuery.data.isFullPrefixStable
                            ? "Prefix Status: 100% Byte-for-Byte Stable"
                            : `Prefix Breakpoint: Diverged inside "${diffQuery.data.differingPartName}"`}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-[#d9d8e1]">
                          {diffQuery.data.diffExplanation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Prefix Stats Bar */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#707183]">Stable Prefix Tokens</div>
                      <div className="mt-1 font-mono text-base font-bold text-[#c9ff73]">
                        ~{diffQuery.data.stablePrefixTokenEstimate.toLocaleString()} tok
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#707183]">Stable Characters</div>
                      <div className="mt-1 font-mono text-base font-bold text-white">
                        {diffQuery.data.stablePrefixCharLength.toLocaleString()} chars
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#707183]">Req A Matched %</div>
                      <div className="mt-1 font-mono text-base font-bold text-white">
                        {diffQuery.data.stablePrefixPercentA}%
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#707183]">Req B Matched %</div>
                      <div className="mt-1 font-mono text-base font-bold text-white">
                        {diffQuery.data.stablePrefixPercentB}%
                      </div>
                    </div>
                  </div>

                  {/* Exact Character Divergence Side-by-Side View */}
                  {!diffQuery.data.isFullPrefixStable && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          Character Breakpoint Snapshot (150 chars context)
                        </span>
                        <span className="font-mono text-[11px] text-[#808193]">
                          Global Char Index: #{diffQuery.data.firstDifferingGlobalChar.toLocaleString()}
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {/* Request A Divergence */}
                        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3 font-mono text-xs">
                          <div className="mb-2 text-[11px] font-bold text-rose-400">Request A (Base Turn)</div>
                          <div className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-black/50 p-2.5 text-xs text-[#a0a1b2]">
                            <span className="text-emerald-400/80">{diffQuery.data.snippetBefore}</span>
                            <span className="rounded bg-rose-500/40 px-1 py-0.5 font-bold text-white underline">
                              {diffQuery.data.snippetAfterA.slice(0, 30) || "[END OF TEXT]"}
                            </span>
                            <span className="text-[#606172]">{diffQuery.data.snippetAfterA.slice(30)}</span>
                          </div>
                        </div>

                        {/* Request B Divergence */}
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 font-mono text-xs">
                          <div className="mb-2 text-[11px] font-bold text-emerald-400">Request B (Target Turn)</div>
                          <div className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-black/50 p-2.5 text-xs text-[#a0a1b2]">
                            <span className="text-emerald-400/80">{diffQuery.data.snippetBefore}</span>
                            <span className="rounded bg-emerald-500/40 px-1 py-0.5 font-bold text-white underline">
                              {diffQuery.data.snippetAfterB.slice(0, 30) || "[END OF TEXT]"}
                            </span>
                            <span className="text-[#606172]">{diffQuery.data.snippetAfterB.slice(30)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Raw Payload Detail Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121216] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white">Raw Request Payload Details</h3>
                <p className="font-mono text-xs text-[#707183]">{detailReqId}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-[#858697] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {requestDetailQuery.isLoading ? (
                <div className="grid h-48 place-items-center">
                  <Loader2 className="animate-spin text-[#c9ff73]" size={24} />
                </div>
              ) : requestDetailQuery.data ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between font-bold text-white">
                      <span>Upstream JSON Payload (as passed to upstream fetch)</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(requestDetailQuery.data?.upstreamBody || "");
                          toast.success("Upstream JSON copied to clipboard");
                        }}
                        className="h-6 px-2 text-xs text-[#c9ff73]"
                      >
                        <Copy size={12} className="mr-1" /> Copy
                      </Button>
                    </div>
                    <pre className="max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-[#a0a1b2]">
                      {requestDetailQuery.data.upstreamBody}
                    </pre>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between font-bold text-white">
                      <span>Incoming Client Request (from Claude Code / SDK)</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(requestDetailQuery.data?.incomingBody || "");
                          toast.success("Incoming JSON copied to clipboard");
                        }}
                        className="h-6 px-2 text-xs text-[#c9ff73]"
                      >
                        <Copy size={12} className="mr-1" /> Copy
                      </Button>
                    </div>
                    <pre className="max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-[#a0a1b2]">
                      {requestDetailQuery.data.incomingBody}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center text-xs text-[#707183]">Request not found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
