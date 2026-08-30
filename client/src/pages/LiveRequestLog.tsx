import { useEffect, useRef, useState } from "react";
import { Loader2, Radio } from "lucide-react";

type LiveRequest = {
  requestId: string;
  userId: number;
  modelId: string;
  status: "success" | "rejected" | "provider_error" | "cancelled";
  source: "api" | "playground";
  stream: boolean;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  provider?: string;
  errorMessage?: string;
  userName?: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<LiveRequest["status"], { text: string; cls: string; dot: string }> = {
  success: { text: "Success", cls: "text-[#c9ff73] bg-[#c9ff73]/10 border-[#c9ff73]/25", dot: "bg-[#4ade80]" },
  provider_error: { text: "Provider error", cls: "text-red-300 bg-red-400/10 border-red-300/25", dot: "bg-red-500" },
  rejected: { text: "Rejected", cls: "text-amber-200 bg-amber-300/10 border-amber-300/25", dot: "bg-amber-400" },
  cancelled: { text: "Cancelled", cls: "text-[#a9aab8] bg-white/6 border-white/12", dot: "bg-[#a9aab8]" },
};

const MAX_ROWS = 300;

export default function LiveRequestLog() {
  const [rows, setRows] = useState<LiveRequest[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = new EventSource("/api/admin/live-requests");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("request", event => {
      try {
        const row = JSON.parse(event.data) as LiveRequest;
        setRows(prev => [row, ...prev].slice(0, MAX_ROWS));
      } catch {
        /* ignore malformed event */
      }
    });
    return () => source.close();
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [rows, autoScroll]);

  return (
    <section className="dashboard-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">Live request log</p>
          <h2 className="mt-1 text-lg font-bold text-white">Real-time requests</h2>
          <p className="mt-1 text-[10px] text-[#9091a3]">Streamed over Server-Sent Events as each request settles.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-[10px] ${connected ? "text-[#c9ff73]" : "text-red-300"}`}>
            <Radio size={12} /> {connected ? "Connected" : "Reconnecting…"}
          </span>
          <button
            type="button"
            onClick={() => setAutoScroll(value => !value)}
            className={`rounded-lg border px-2 py-1 text-[10px] ${autoScroll ? "border-[#c9ff73]/25 bg-[#c9ff73]/10 text-[#c9ff73]" : "border-white/12 text-[#a9aab8] hover:bg-white/6"}`}
          >
            {autoScroll ? "Auto-scroll: on" : "Auto-scroll: off"}
          </button>
        </div>
      </div>

      <div className="mt-4 max-h-[34rem] overflow-y-auto overscroll-contain rounded-xl border border-white/8" ref={scrollRef}>
        <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-[#171a18]">
            <tr className="text-[9px] uppercase tracking-[.1em] text-[#858697]">
              <th className="px-3 py-2 w-8">Status</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">In / Out</th>
              <th className="px-3 py-2 text-right">Latency</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-[#858697]">
                  <div className="mx-auto flex w-max items-center gap-2">
                    <Loader2 className="animate-spin" size={14} /> Waiting for requests…
                  </div>
                </td>
              </tr>
            ) : rows.map(row => {
              const status = STATUS_LABEL[row.status] ?? STATUS_LABEL.cancelled;
              return (
                <tr key={row.requestId} className="border-t border-white/6 hover:bg-white/[.02]">
                  <td className="px-3 py-2">
                    <span className="live-dot" style={{ background: status.dot }} aria-hidden="true" />
                    <span className="sr-only">{status.text}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-[#a9aab8]">{new Date(row.createdAt).toLocaleTimeString()}</td>
                  <td className="max-w-[10rem] truncate px-3 py-2 text-[#e6e6ee]">{row.userName ?? `user:${row.userId}`}</td>
                  <td className="max-w-[11rem] truncate px-3 py-2 font-mono text-[#e6e6ee]">{row.modelId}</td>
                  <td className="max-w-[8rem] truncate px-3 py-2 text-[#c9ff73]">{row.provider ?? "—"}</td>
                  <td className="px-3 py-2 text-[#a9aab8]">{row.source}</td>
                  <td className="px-3 py-2"><span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${status.cls}`}>{status.text}</span></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[10px] tabular-nums text-[#e6e6ee]">{row.inputTokens.toLocaleString()} / {row.outputTokens.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[10px] tabular-nums text-[#a9aab8]">{row.latencyMs != null ? `${row.latencyMs}ms` : "—"}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-[10px] text-red-300" title={row.errorMessage}>{row.status === "provider_error" ? (row.errorMessage ?? "—") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 border-t border-white/8 pt-3 text-[10px] text-[#858697]">Shows the last {MAX_ROWS} settled requests. Only requests after this section opened appear; open the tab to begin capturing.</p>
    </section>
  );
}
