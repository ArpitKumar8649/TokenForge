import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Radio,
  BellOff,
  Volume2,
  VolumeX,
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  Smartphone,
  Filter,
  Search,
  RotateCcw,
  Activity,
  ServerCrash,
  WifiOff,
  Zap,
} from "lucide-react";

export type LiveRequest = {
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
  rawErrorMessage?: string;
  userName?: string | null;
  createdAt: string;
  reasoningReturned?: boolean;
  stopReason?: "end_turn" | "tool_use" | "max_tokens" | "stop" | "tool_calls" | "length" | "refusal" | "none";
  ttftMs?: number | null;
  durationMs?: number | null;
  outcome?: "success" | "client_disconnected" | "truncated" | "upstream_error" | "rejected";
};

type NormalizedOutcome = "success" | "client_disconnected" | "truncated" | "upstream_error" | "rejected";

function getNormalizedOutcome(row: LiveRequest): NormalizedOutcome {
  if (row.outcome) {
    if (row.outcome === "client_disconnected") return "client_disconnected";
    if (row.outcome === "truncated") return "truncated";
    if (row.outcome === "upstream_error") return "upstream_error";
    if (row.outcome === "rejected") return "rejected";
    if (row.outcome === "success") return "success";
  }
  if (
    row.status === "cancelled" ||
    row.rawErrorMessage?.toLowerCase().includes("client disconnected") ||
    row.errorMessage?.toLowerCase().includes("client disconnected")
  ) {
    return "client_disconnected";
  }
  if (row.stopReason === "max_tokens" || row.stopReason === "length") {
    return "truncated";
  }
  if (row.status === "rejected") return "rejected";
  if (row.status === "provider_error") return "upstream_error";
  return "success";
}

function getBaseProviderName(rawProvider?: string): string {
  if (!rawProvider || !rawProvider.trim()) return "Default / Gateway";
  const name = rawProvider.split("(")[0].trim();
  return name || "Default / Gateway";
}

const MAX_ROWS = 300;

function playAlertChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5 alert)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Tone 2: 440 Hz (A4 alert low tone)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(440, now + 0.12);
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.38);
  } catch {
    /* AudioContext may be restricted before user interaction */
  }
}

/**
 * Dispatches an OS-level mobile/desktop notification.
 */
async function sendSystemNotification(req: LiveRequest) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const userDisplay = req.userName ? `${req.userName} (User #${req.userId})` : `User #${req.userId}`;
  const providerDisplay = req.provider || "Default Provider";
  const outcome = getNormalizedOutcome(req);
  const statusDisplay =
    outcome === "client_disconnected"
      ? "Client Disconnected (Socket Dropped)"
      : outcome === "truncated"
      ? "Truncated (Max Tokens Reached)"
      : req.status === "provider_error"
      ? "Provider Error (5xx)"
      : "Rejected Request";

  const errorDisplay = req.rawErrorMessage
    ? `\nDiagnostic: ${req.rawErrorMessage}`
    : req.errorMessage
    ? `\nError: ${req.errorMessage}`
    : "";

  const title = `🚨 Live Failure: ${req.modelId}`;
  const body = `User: ${userDisplay}\nModel: ${req.modelId}\nProvider: ${providerDisplay}\nStatus: ${statusDisplay}${errorDisplay}`;

  const notificationOptions = {
    body,
    icon: "/favicon/favicon-192x192.png",
    badge: "/favicon/favicon-32x32.png",
    vibrate: [300, 100, 300, 100, 300],
    tag: `live-fail-${req.requestId}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: "/admin?tab=live-requests",
      requestId: req.requestId,
    },
  };

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, notificationOptions);
        return;
      }
    } catch {
      // fallback
    }

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        options: notificationOptions,
      });
      return;
    }
  }

  try {
    const notif = new Notification(title, notificationOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch {
    /* ignore fallback errors */
  }
}

function OutcomeBadge({ outcome }: { outcome: NormalizedOutcome }) {
  if (outcome === "success") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-[#c9ff73]/30 bg-[#c9ff73]/10 px-2 py-0.5 text-[9px] font-bold text-[#c9ff73] shadow-sm"
        title="Stream or request completed cleanly with stop reason and message_stop sent"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
        success
      </span>
    );
  }
  if (outcome === "truncated") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold text-amber-300 shadow-sm"
        title="Output cut off because model hit max_tokens limit"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        truncated
      </span>
    );
  }
  if (outcome === "client_disconnected") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold text-rose-300 shadow-sm"
        title="Client closed socket/connection before response finished (upstream aborted immediately to save tokens)"
      >
        <WifiOff size={10} className="text-rose-400" />
        client_disconnected
      </span>
    );
  }
  if (outcome === "upstream_error") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-300 shadow-sm"
        title="Upstream provider timeout or 5xx error"
      >
        <ServerCrash size={10} className="text-red-400" />
        upstream_error
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-[9px] font-bold text-orange-300 shadow-sm"
      title="Request was rejected at preflight or safety check"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
      rejected
    </span>
  );
}

function StopReasonBadge({ stopReason }: { stopReason?: string }) {
  if (!stopReason || stopReason === "none") {
    return <span className="font-mono text-[10px] text-[#6b6d7c]">—</span>;
  }
  if (stopReason === "end_turn" || stopReason === "stop") {
    return (
      <span className="inline-flex items-center rounded border border-[#c9ff73]/25 bg-[#c9ff73]/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-[#c9ff73]">
        {stopReason}
      </span>
    );
  }
  if (stopReason === "tool_use" || stopReason === "tool_calls") {
    return (
      <span className="inline-flex items-center rounded border border-sky-400/35 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[9px] font-medium text-sky-300">
        {stopReason}
      </span>
    );
  }
  if (stopReason === "max_tokens" || stopReason === "length") {
    return (
      <span className="inline-flex items-center rounded border border-amber-400/40 bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
        {stopReason}
      </span>
    );
  }
  if (stopReason === "refusal") {
    return (
      <span className="inline-flex items-center rounded border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 font-mono text-[9px] font-medium text-rose-300">
        refusal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-[#a9aab8]">
      {stopReason}
    </span>
  );
}

function formatTtft(ttftMs?: number | null) {
  if (ttftMs == null || ttftMs <= 0) return <span className="text-[#6b6d7c]">—</span>;
  const isExtreme = ttftMs > 30_000;
  const isWarn = ttftMs > 10_000 && !isExtreme;
  const text = ttftMs >= 1000 ? `${(ttftMs / 1000).toFixed(1)}s` : `${ttftMs}ms`;
  return (
    <span
      className={`font-mono text-[10px] tabular-nums ${
        isExtreme ? "font-bold text-red-400" : isWarn ? "font-medium text-amber-300" : "text-[#a9aab8]"
      }`}
      title={isExtreme ? "Severe TTFT (>30s) — upstream overloaded" : isWarn ? "Slow TTFT (>10s)" : undefined}
    >
      {text}
    </span>
  );
}

function formatDuration(durationMs?: number | null, latencyMs?: number | null) {
  const dur = durationMs ?? latencyMs;
  if (dur == null || dur <= 0) return <span className="text-[#6b6d7c]">—</span>;
  const text = dur >= 1000 ? `${(dur / 1000).toFixed(1)}s` : `${dur}ms`;
  return <span className="font-mono text-[10px] tabular-nums text-[#e6e6ee]">{text}</span>;
}

export default function LiveRequestLog() {
  const [rows, setRows] = useState<LiveRequest[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [sessionFailures, setSessionFailures] = useState(0);
  const [lastAlert, setLastAlert] = useState<{ title: string; detail: string; time: string } | null>(null);

  // Filters
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "non_success" | "success" | "truncated" | "client_disconnected" | "upstream_error">("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Notification & Audio states
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });

  const [desktopAlerts, setDesktopAlerts] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("tokenforge_live_req_notif");
    return stored === "true";
  });

  const [soundAlerts, setSoundAlerts] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("tokenforge_live_req_sound");
    return stored !== "false";
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const isSnapshotDoneRef = useRef(false);
  const desktopAlertsRef = useRef(desktopAlerts);
  const soundAlertsRef = useRef(soundAlerts);

  // Register Service Worker for Mobile & Desktop OS notifications
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(err => {
        console.warn("ServiceWorker registration notice:", err);
      });
    }
  }, []);

  useEffect(() => {
    desktopAlertsRef.current = desktopAlerts;
    localStorage.setItem("tokenforge_live_req_notif", desktopAlerts ? "true" : "false");
  }, [desktopAlerts]);

  useEffect(() => {
    soundAlertsRef.current = soundAlerts;
    localStorage.setItem("tokenforge_live_req_sound", soundAlerts ? "true" : "false");
  }, [soundAlerts]);

  const handleToggleDesktopAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("System notifications are not supported by this browser.");
      return;
    }

    if (Notification.permission === "granted") {
      setDesktopAlerts(prev => !prev);
      return;
    }

    if (Notification.permission === "denied") {
      alert("Notifications are blocked in your browser or device settings. Please allow notifications for TokenForge.");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result === "granted") {
        setDesktopAlerts(true);
        await sendSystemNotification({
          requestId: "test-welcome-" + Date.now(),
          userId: 1,
          userName: "Admin",
          modelId: "Live Alert Ready",
          provider: "TokenForge",
          status: "provider_error",
          source: "api",
          stream: false,
          inputTokens: 0,
          outputTokens: 0,
          errorMessage: "System notifications are active! You will receive mobile/desktop alerts when any request fails.",
          createdAt: new Date().toISOString(),
        });
      } else {
        setDesktopAlerts(false);
      }
    } catch {
      /* ignore */
    }
  };

  const handleTestAlert = async () => {
    if (soundAlerts) {
      playAlertChime();
    }
    const sampleReq: LiveRequest = {
      requestId: "sample-" + Date.now(),
      userId: 42,
      userName: "developer",
      modelId: "claude-opus-5",
      provider: "Kiro",
      status: "provider_error",
      source: "api",
      stream: true,
      inputTokens: 1200,
      outputTokens: 0,
      latencyMs: 342,
      errorMessage: "502 Bad Gateway: Upstream provider connection timeout",
      createdAt: new Date().toISOString(),
      outcome: "upstream_error",
      stopReason: "none",
    };

    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === "granted") {
        setDesktopAlerts(true);
        await sendSystemNotification(sampleReq);
      }
    } else if (Notification.permission === "granted") {
      await sendSystemNotification(sampleReq);
    }

    setLastAlert({
      title: `Test Alert Triggered: ${sampleReq.modelId}`,
      detail: `User: ${sampleReq.userName} · Provider: ${sampleReq.provider} · ${sampleReq.errorMessage}`,
      time: new Date().toLocaleTimeString(),
    });
  };

  useEffect(() => {
    const source = new EventSource("/api/admin/live-requests");
    isSnapshotDoneRef.current = false;

    source.onopen = () => {
      setConnected(true);
      setRows([]);
      isSnapshotDoneRef.current = false;
    };

    source.onerror = () => {
      setConnected(false);
      isSnapshotDoneRef.current = false;
    };

    source.addEventListener("snapshot_done", () => {
      isSnapshotDoneRef.current = true;
    });

    source.addEventListener("request", event => {
      try {
        const row = JSON.parse(event.data) as LiveRequest;
        setRows(prev => [row, ...prev].slice(0, MAX_ROWS));

        const outcome = getNormalizedOutcome(row);
        const isFailure = outcome === "upstream_error" || outcome === "client_disconnected" || row.status === "provider_error" || row.status === "rejected";

        if (isFailure) {
          setSessionFailures(n => n + 1);

          if (isSnapshotDoneRef.current) {
            if (soundAlertsRef.current) {
              playAlertChime();
            }

            if (desktopAlertsRef.current && Notification.permission === "granted") {
              sendSystemNotification(row);
            }

            setLastAlert({
              title: `Live Alert · ${row.modelId}`,
              detail: `User: ${row.userName ?? `User #${row.userId}`} · Provider: ${row.provider ?? "Default"} · ${outcome}: ${row.errorMessage || row.status}`,
              time: new Date().toLocaleTimeString(),
            });
          }
        }
      } catch {
        /* ignore malformed event */
      }
    });

    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [rows, autoScroll]);

  // Per-Provider Summary Calculation
  const providerSummaries = useMemo(() => {
    const map = new Map<string, { total: number; success: number; truncated: number; failed: number; ttftSum: number; ttftCount: number }>();

    for (const r of rows) {
      const base = getBaseProviderName(r.provider);
      let entry = map.get(base);
      if (!entry) {
        entry = { total: 0, success: 0, truncated: 0, failed: 0, ttftSum: 0, ttftCount: 0 };
        map.set(base, entry);
      }
      entry.total += 1;
      const outcome = getNormalizedOutcome(r);
      if (outcome === "success") entry.success += 1;
      else if (outcome === "truncated") entry.truncated += 1;
      else entry.failed += 1;

      if (typeof r.ttftMs === "number" && r.ttftMs > 0) {
        entry.ttftSum += r.ttftMs;
        entry.ttftCount += 1;
      }
    }

    const list = Array.from(map.entries()).map(([name, data]) => {
      const successPct = data.total > 0 ? (data.success / data.total) * 100 : 0;
      const truncatedPct = data.total > 0 ? (data.truncated / data.total) * 100 : 0;
      const failedPct = data.total > 0 ? (data.failed / data.total) * 100 : 0;
      const avgTtft = data.ttftCount > 0 ? Math.round(data.ttftSum / data.ttftCount) : null;
      return {
        provider: name,
        total: data.total,
        success: data.success,
        truncated: data.truncated,
        failed: data.failed,
        successPct,
        truncatedPct,
        failedPct,
        avgTtft,
      };
    });

    // Sort by total requests descending
    list.sort((a, b) => b.total - a.total);
    return list;
  }, [rows]);

  // Overall Aggregate
  const overallSummary = useMemo(() => {
    const total = rows.length;
    if (total === 0) return null;
    let success = 0;
    let truncated = 0;
    let failed = 0;
    let ttftSum = 0;
    let ttftCount = 0;
    for (const r of rows) {
      const o = getNormalizedOutcome(r);
      if (o === "success") success++;
      else if (o === "truncated") truncated++;
      else failed++;

      if (typeof r.ttftMs === "number" && r.ttftMs > 0) {
        ttftSum += r.ttftMs;
        ttftCount++;
      }
    }
    return {
      total,
      successPct: (success / total) * 100,
      truncatedPct: (truncated / total) * 100,
      failedPct: (failed / total) * 100,
      avgTtft: ttftCount > 0 ? Math.round(ttftSum / ttftCount) : null,
      nonSuccessCount: truncated + failed,
    };
  }, [rows]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const outcome = getNormalizedOutcome(r);

      if (outcomeFilter === "non_success" && outcome === "success") return false;
      if (outcomeFilter === "success" && outcome !== "success") return false;
      if (outcomeFilter === "truncated" && outcome !== "truncated") return false;
      if (outcomeFilter === "client_disconnected" && outcome !== "client_disconnected") return false;
      if (outcomeFilter === "upstream_error" && outcome !== "upstream_error" && outcome !== "rejected") return false;

      if (providerFilter !== "all") {
        if (getBaseProviderName(r.provider) !== providerFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchModel = r.modelId.toLowerCase().includes(q);
        const matchUser = (r.userName ?? `user:${r.userId}`).toLowerCase().includes(q);
        const matchReq = r.requestId.toLowerCase().includes(q);
        const matchStop = (r.stopReason ?? "").toLowerCase().includes(q);
        const matchOutcome = outcome.toLowerCase().includes(q);
        const matchDiag = (r.rawErrorMessage || r.errorMessage || "").toLowerCase().includes(q);
        if (!matchModel && !matchUser && !matchReq && !matchStop && !matchOutcome && !matchDiag) return false;
      }

      return true;
    });
  }, [rows, outcomeFilter, providerFilter, searchQuery]);

  const reasoningFallbackCount = rows.filter(
    r => r.reasoningReturned || (r.rawErrorMessage && r.rawErrorMessage.includes("[ReasoningFallback"))
  ).length;

  return (
    <section className="dashboard-card space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">Live request monitor</p>
            {sessionFailures > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                <AlertTriangle size={11} /> {sessionFailures} {sessionFailures === 1 ? "failure" : "failures"} in session
              </span>
            )}
            {reasoningFallbackCount > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                ⚡ {reasoningFallbackCount} reasoning {reasoningFallbackCount === 1 ? "fallback" : "fallbacks"}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-bold text-white">Real-Time Gateway & Upstream Monitor</h2>
          <p className="mt-1 text-[10px] text-[#9091a3]">
            Tracking Finish Reasons, TTFT latency, stream timeouts, and instant client socket disconnects.
          </p>
        </div>

        {/* Action Controls & Notification Settings */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Connection status */}
          <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${connected ? "border-[#c9ff73]/25 bg-[#c9ff73]/10 text-[#c9ff73]" : "border-red-500/25 bg-red-500/10 text-red-300"}`}>
            <Radio size={12} className={connected ? "animate-pulse text-[#c9ff73]" : "text-red-400"} />
            <span>{connected ? "Live Connected" : "Reconnecting…"}</span>
          </span>

          {/* System Notification Toggle */}
          <button
            type="button"
            onClick={handleToggleDesktopAlerts}
            title={
              notifPermission === "denied"
                ? "Notifications blocked in device settings"
                : desktopAlerts
                ? "Click to disable mobile/system notifications"
                : "Click to enable mobile/system push notifications"
            }
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              desktopAlerts && notifPermission === "granted"
                ? "border-[#c9ff73]/30 bg-[#c9ff73]/15 text-[#c9ff73]"
                : notifPermission === "denied"
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-white/12 bg-white/5 text-[#a9aab8] hover:bg-white/10 hover:text-white"
            }`}
          >
            {desktopAlerts && notifPermission === "granted" ? <Smartphone size={13} /> : <BellOff size={13} />}
            <span>
              {notifPermission === "denied"
                ? "Alerts Blocked"
                : desktopAlerts && notifPermission === "granted"
                ? "Device Alerts: ON"
                : "Device Alerts: OFF"}
            </span>
          </button>

          {/* Sound alert toggle */}
          <button
            type="button"
            onClick={() => setSoundAlerts(v => !v)}
            title="Toggle audio tone chime on failure"
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              soundAlerts
                ? "border-[#c9ff73]/30 bg-[#c9ff73]/15 text-[#c9ff73]"
                : "border-white/12 bg-white/5 text-[#a9aab8] hover:bg-white/10 hover:text-white"
            }`}
          >
            {soundAlerts ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{soundAlerts ? "Sound: ON" : "Sound: OFF"}</span>
          </button>

          {/* Test Alert Button */}
          <button
            type="button"
            onClick={handleTestAlert}
            title="Trigger a test phone/system alert notification & audio chime"
            className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-[#e6e6ee] hover:bg-white/10 hover:text-white transition-colors"
          >
            <Play size={11} className="fill-current text-[#c9ff73]" /> Test Alert
          </button>

          {/* Auto scroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(value => !value)}
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${autoScroll ? "border-white/20 bg-white/10 text-[#e6e6ee]" : "border-white/10 text-[#858697] hover:bg-white/5"}`}
          >
            {autoScroll ? "Auto-scroll: On" : "Auto-scroll: Off"}
          </button>
        </div>
      </div>

      {/* Per-Provider Health & Performance Summary */}
      <div className="rounded-xl border border-white/8 bg-[#121413]/70 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[#c9ff73]" />
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#e6e6ee]">Provider Performance Breakdown</h3>
            <span className="text-[10px] text-[#858697]">
              ({rows.length} live requests in buffer)
            </span>
          </div>
          {overallSummary && (
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-[#c9ff73]">
                <b>{overallSummary.successPct.toFixed(1)}%</b> success
              </span>
              <span className="text-amber-300">
                <b>{overallSummary.truncatedPct.toFixed(1)}%</b> truncated
              </span>
              <span className="text-red-300">
                <b>{overallSummary.failedPct.toFixed(1)}%</b> failed
              </span>
              {overallSummary.avgTtft && (
                <span className="text-sky-300">
                  avg TTFT: <b>{formatTtft(overallSummary.avgTtft)}</b>
                </span>
              )}
            </div>
          )}
        </div>

        {providerSummaries.length === 0 ? (
          <p className="text-[11px] text-[#858697] italic py-1">Awaiting live request stream data to generate provider summaries…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {providerSummaries.map(p => {
              const isSelected = providerFilter === p.provider;
              return (
                <button
                  type="button"
                  key={p.provider}
                  onClick={() => setProviderFilter(isSelected ? "all" : p.provider)}
                  className={`flex flex-col justify-between rounded-lg border p-2.5 text-left transition-all ${
                    isSelected
                      ? "border-[#c9ff73]/50 bg-[#c9ff73]/10 ring-1 ring-[#c9ff73]/30"
                      : "border-white/8 bg-[#171a18]/60 hover:border-white/15 hover:bg-[#171a18]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="font-semibold text-[11px] text-[#e6e6ee] truncate" title={p.provider}>
                      {p.provider}
                    </span>
                    <span className="font-mono text-[9px] rounded bg-white/5 px-1.5 py-0.5 text-[#a9aab8]">
                      {p.total} reqs
                    </span>
                  </div>

                  {/* Visual Rate Bar */}
                  <div className="my-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5 flex">
                    <div style={{ width: `${p.successPct}%` }} className="bg-[#4ade80]" title={`Success: ${p.successPct.toFixed(1)}%`} />
                    <div style={{ width: `${p.truncatedPct}%` }} className="bg-amber-400" title={`Truncated: ${p.truncatedPct.toFixed(1)}%`} />
                    <div style={{ width: `${p.failedPct}%` }} className="bg-red-500" title={`Failed: ${p.failedPct.toFixed(1)}%`} />
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
                    <div>
                      <span className="text-[#858697] block">Succ</span>
                      <span className="text-[#c9ff73] font-bold">{p.successPct.toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-[#858697] block">Trunc</span>
                      <span className="text-amber-300 font-bold">{p.truncatedPct.toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-[#858697] block">Fail</span>
                      <span className="text-red-300 font-bold">{p.failedPct.toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-[#858697] block">TTFT</span>
                      <span className="text-sky-300 font-bold">{formatTtft(p.avgTtft)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter and Query Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-white/8 bg-[#121413]/40 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Filter: Non-success only */}
          <button
            type="button"
            onClick={() => setOutcomeFilter(prev => (prev === "non_success" ? "all" : "non_success"))}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
              outcomeFilter === "non_success"
                ? "border-red-500/50 bg-red-500/20 text-red-200 shadow-sm"
                : "border-white/10 bg-white/5 text-[#a9aab8] hover:bg-white/10 hover:text-white"
            }`}
          >
            <Filter size={12} className={outcomeFilter === "non_success" ? "text-red-400" : ""} />
            <span>Non-Success Only</span>
            {overallSummary && overallSummary.nonSuccessCount > 0 && (
              <span className="rounded-full bg-red-500/30 px-1.5 py-0.2 text-[9px] text-red-200">
                {overallSummary.nonSuccessCount}
              </span>
            )}
          </button>

          {/* Outcome Category Select */}
          <select
            value={outcomeFilter}
            onChange={e => setOutcomeFilter(e.target.value as any)}
            className="rounded-lg border border-white/10 bg-[#171a18] px-2.5 py-1.5 text-[11px] text-[#e6e6ee] outline-none hover:border-white/20 focus:border-[#c9ff73]/50"
          >
            <option value="all">All Outcomes</option>
            <option value="non_success">Non-Success (Errors & Truncated)</option>
            <option value="success">Success Only</option>
            <option value="truncated">Truncated Only (max_tokens)</option>
            <option value="client_disconnected">Client Disconnected (Abort)</option>
            <option value="upstream_error">Upstream Provider Error</option>
          </select>

          {/* Provider Select */}
          <select
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#171a18] px-2.5 py-1.5 text-[11px] text-[#e6e6ee] outline-none hover:border-white/20 focus:border-[#c9ff73]/50"
          >
            <option value="all">All Providers</option>
            {providerSummaries.map(p => (
              <option key={p.provider} value={p.provider}>
                {p.provider} ({p.total})
              </option>
            ))}
          </select>

          {/* Reset button if active */}
          {(outcomeFilter !== "all" || providerFilter !== "all" || searchQuery.trim() !== "") && (
            <button
              type="button"
              onClick={() => {
                setOutcomeFilter("all");
                setProviderFilter("all");
                setSearchQuery("");
              }}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-[#a9aab8] hover:text-white"
            >
              <RotateCcw size={11} /> Reset filters
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative min-w-[180px] max-w-xs">
          <Search size={12} className="absolute left-2.5 top-2.5 text-[#858697]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search model, user, request ID…"
            className="w-full rounded-lg border border-white/10 bg-[#171a18] py-1.5 pl-8 pr-3 text-[11px] text-[#e6e6ee] placeholder-[#6b6d7c] outline-none hover:border-white/20 focus:border-[#c9ff73]/50"
          />
        </div>
      </div>

      {/* Latest Failure Toast Banner */}
      {lastAlert && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-950/30 px-3.5 py-2.5 text-[11px] text-red-200 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-300">
              <AlertTriangle size={13} />
            </span>
            <div>
              <p className="font-semibold text-red-200">{lastAlert.title}</p>
              <p className="text-[10px] text-red-300/80">{lastAlert.detail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-red-300/60">{lastAlert.time}</span>
            <button
              type="button"
              onClick={() => setLastAlert(null)}
              className="rounded p-1 text-red-300/60 hover:bg-red-500/20 hover:text-red-200"
              aria-label="Dismiss alert"
            >
              <XCircle size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Live Table */}
      <div className="max-h-[36rem] overflow-y-auto overscroll-contain rounded-xl border border-white/8 bg-[#121413]/50" ref={scrollRef}>
        <table className="w-full min-w-[1050px] border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-[#171a18] shadow-sm">
            <tr className="text-[9px] uppercase tracking-[.1em] text-[#858697]">
              <th className="px-3 py-2 w-8">Dot</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Finish Reason</th>
              <th className="px-3 py-2 text-right">In / Out</th>
              <th className="px-3 py-2 text-right" title="Time To First Token">TTFT</th>
              <th className="px-3 py-2 text-right">Duration</th>
              <th className="px-3 py-2 min-w-[18rem]">Diagnostic & Error</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-12 text-center text-[#858697]">
                  {rows.length === 0 ? (
                    <div className="mx-auto flex w-max items-center gap-2 text-[12px]">
                      <Loader2 className="animate-spin text-[#c9ff73]" size={15} /> Listening for live incoming requests…
                    </div>
                  ) : (
                    <div>No live requests matched your active filter.</div>
                  )}
                </td>
              </tr>
            ) : (
              filteredRows.map(row => {
                const outcome = getNormalizedOutcome(row);
                const isFail = outcome === "upstream_error" || outcome === "client_disconnected" || outcome === "rejected";
                const isTruncated = outcome === "truncated";

                let rowBgCls = "hover:bg-white/[.02]";
                if (isFail) rowBgCls = "bg-red-500/[0.04] hover:bg-red-500/[0.08]";
                else if (isTruncated) rowBgCls = "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]";

                return (
                  <tr key={row.requestId} className={`border-t border-white/6 transition-colors ${rowBgCls}`}>
                    {/* Status Dot */}
                    <td className="px-3 py-2">
                      <span
                        className="live-dot"
                        style={{
                          background:
                            outcome === "success"
                              ? "#4ade80"
                              : outcome === "truncated"
                              ? "#fbbf24"
                              : outcome === "client_disconnected"
                              ? "#f43f5e"
                              : "#ef4444",
                        }}
                        aria-hidden="true"
                      />
                    </td>

                    {/* Time */}
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-[#a9aab8]">
                      {new Date(row.createdAt).toLocaleTimeString()}
                    </td>

                    {/* User */}
                    <td
                      className="max-w-[8.5rem] truncate px-3 py-2 font-medium text-[#e6e6ee]"
                      title={row.userName ? `${row.userName} (ID: ${row.userId})` : `User #${row.userId}`}
                    >
                      {row.userName ?? `user:${row.userId}`}
                    </td>

                    {/* Model */}
                    <td className="max-w-[11rem] truncate px-3 py-2 font-mono text-[#e6e6ee]" title={row.modelId}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{row.modelId}</span>
                        {row.rawErrorMessage && row.rawErrorMessage.includes("[CompactTrigger") && (
                          <span
                            className="inline-flex items-center rounded border border-purple-400/40 bg-purple-500/20 px-1.5 py-0.2 text-[9px] font-bold tracking-wide text-purple-200 shadow-sm"
                            title={row.rawErrorMessage}
                          >
                            COMPACTED (980k)
                          </span>
                        )}
                        {(row.reasoningReturned || (row.rawErrorMessage && row.rawErrorMessage.includes("[ReasoningFallback"))) && (
                          <span
                            className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold tracking-wide text-amber-300 shadow-sm"
                            title="Reasoning fallback: model returned empty content, output reasoning was returned to user"
                          >
                            ⚡ REASONING
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Provider */}
                    <td className="max-w-[13rem] truncate px-3 py-2 font-medium text-[#c9ff73]" title={row.provider ?? "Default"}>
                      {row.provider ? (
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          {row.provider.includes("(") ? (() => {
                            const [name, ...rest] = row.provider.split("(");
                            const rawTag = rest.join("(").replace(/\)+$/, "").trim();
                            const isCurrent = rawTag.toLowerCase().includes("current");
                            const isHistorical = rawTag.toLowerCase().includes("back");
                            const badgeCls = isCurrent
                              ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                              : isHistorical
                              ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
                              : "border-sky-400/30 bg-sky-500/15 text-sky-300";
                            return (
                              <>
                                <span>{name.trim()}</span>
                                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${badgeCls}`}>
                                  {rawTag}
                                </span>
                              </>
                            );
                          })() : (
                            row.provider
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Outcome Badge */}
                    <td className="px-3 py-2">
                      <OutcomeBadge outcome={outcome} />
                    </td>

                    {/* Finish Reason Badge */}
                    <td className="px-3 py-2">
                      <StopReasonBadge stopReason={row.stopReason} />
                    </td>

                    {/* In / Out Tokens */}
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[10px] tabular-nums text-[#e6e6ee]">
                      {row.inputTokens.toLocaleString()} / {row.outputTokens.toLocaleString()}
                    </td>

                    {/* TTFT */}
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[10px] tabular-nums">
                      {formatTtft(row.ttftMs)}
                    </td>

                    {/* Duration */}
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[10px] tabular-nums">
                      {formatDuration(row.durationMs, row.latencyMs)}
                    </td>

                    {/* Diagnostic & Error */}
                    <td
                      className={`max-w-[22rem] px-3 py-2 text-[10px] ${
                        isFail ? "text-red-300" : isTruncated ? "text-amber-200" : "text-[#858697]"
                      }`}
                      title={row.rawErrorMessage || row.errorMessage || undefined}
                    >
                      {row.rawErrorMessage ? (
                        <div className="flex flex-col gap-0.5">
                          {row.rawErrorMessage.includes("[CompactTrigger") ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center rounded border border-purple-400/40 bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-purple-200">
                                AUTO COMPACT
                              </span>
                              <span className="font-mono text-[10px] text-purple-300">{row.rawErrorMessage}</span>
                            </div>
                          ) : row.rawErrorMessage.includes("[ReasoningFallback") ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-300">
                                REASONING FALLBACK
                              </span>
                              <span className="font-mono text-[10px] text-amber-200">
                                Content was empty · Returned model reasoning
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
                                  row.rawErrorMessage.includes("[PRE-FLIGHT]")
                                    ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
                                    : row.rawErrorMessage.includes("Timeout")
                                    ? "border-orange-400/40 bg-orange-500/15 text-orange-300"
                                    : "border-red-400/40 bg-red-500/15 text-red-200"
                                }`}
                              >
                                {row.rawErrorMessage.includes("[PRE-FLIGHT]")
                                  ? "PRE-FLIGHT"
                                  : row.rawErrorMessage.includes("Timeout")
                                  ? "TIMEOUT"
                                  : outcome === "client_disconnected"
                                  ? "CLIENT"
                                  : "UPSTREAM"}
                              </span>
                              <span className="font-mono font-medium text-red-200 break-all">
                                {row.rawErrorMessage.replace(/^\[(?:PRE-FLIGHT|TIMEOUT|UPSTREAM)\]\s*/, "")}
                              </span>
                            </div>
                          )}
                          {row.errorMessage && row.errorMessage !== row.rawErrorMessage && (
                            <span className="text-[9px] text-[#858697] truncate block">Client: {row.errorMessage}</span>
                          )}
                        </div>
                      ) : (
                        row.errorMessage || (isFail ? "Upstream failure" : "—")
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3 text-[10px] text-[#858697]">
        <p>
          Capturing up to {MAX_ROWS} live requests in memory. Phone & system notifications pop up on your device lock screen and notification tray on failure.
        </p>
        <p className="flex items-center gap-1 text-[#a9aab8]">
          <CheckCircle2 size={11} className="text-[#c9ff73]" /> System Service Worker notification engine active
        </p>
      </div>
    </section>
  );
}
