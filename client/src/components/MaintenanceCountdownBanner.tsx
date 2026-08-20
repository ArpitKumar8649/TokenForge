import { AlertTriangle, TimerReset } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

type CountdownParts = { days: number; hours: number; minutes: number; seconds: number };

function getCountdownParts(remainingMs: number): CountdownParts {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1_000));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor(totalSeconds % 86_400 / 3_600),
    minutes: Math.floor(totalSeconds % 3_600 / 60),
    seconds: totalSeconds % 60,
  };
}

function CountdownUnit({ label, value }: { label: string; value: number }) {
  return <div className="min-w-12 rounded-lg border border-amber-200/20 bg-[#130e08]/45 px-2 py-1.5 text-center shadow-inner shadow-black/20 sm:min-w-15 sm:px-3">
    <strong className="block font-mono text-base font-bold tabular-nums tracking-[.08em] text-amber-100 sm:text-lg">{String(value).padStart(2, "0")}</strong>
    <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[.14em] text-amber-200/65">{label}</span>
  </div>;
}

/** Public, database-backed scheduled-maintenance notice. It disappears locally at zero even before the next refetch. */
export function MaintenanceCountdownBanner() {
  const countdown = trpc.public.maintenanceCountdown.useQuery(undefined, { refetchInterval: 5_000, refetchOnWindowFocus: true });
  const [now, setNow] = useState(() => Date.now());
  const endsAt = countdown.data?.endsAt;

  useEffect(() => {
    setNow(Date.now());
    if (!endsAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  if (!countdown.data || countdown.data.endsAt <= now) return null;
  const parts = getCountdownParts(countdown.data.endsAt - now);
  const note = countdown.data.note || "Scheduled maintenance window";

  return <section className="relative overflow-hidden border-y border-amber-300/20 bg-[linear-gradient(105deg,#24180b,#5d3510_55%,#24180b)] px-4 py-3 text-amber-50 shadow-[0_10px_30px_rgba(63,35,8,.18)]" role="status" aria-live="polite" aria-label={`Maintenance countdown: ${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds remaining`}>
    <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_14%_10%,rgba(251,191,36,.42),transparent_24%),radial-gradient(circle_at_85%_70%,rgba(251,146,60,.28),transparent_28%)]" />
    <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
      <div className="flex min-w-0 items-center gap-2.5 text-center sm:text-left"><span className="grid size-8 shrink-0 place-items-center rounded-full border border-amber-200/25 bg-amber-300/10"><AlertTriangle size={15} className="text-amber-200" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-amber-200/70">Maintenance countdown</p><p className="max-w-md truncate text-xs font-semibold text-amber-50 sm:text-sm" title={note}>{note}</p></div></div>
      <div className="flex items-center gap-1.5" aria-hidden="true"><CountdownUnit label="days" value={parts.days} /><span className="font-mono text-lg font-bold text-amber-100/55">:</span><CountdownUnit label="hours" value={parts.hours} /><span className="font-mono text-lg font-bold text-amber-100/55">:</span><CountdownUnit label="mins" value={parts.minutes} /><span className="font-mono text-lg font-bold text-amber-100/55">:</span><CountdownUnit label="secs" value={parts.seconds} /></div>
      <TimerReset size={15} className="hidden text-amber-200/55 lg:block" aria-hidden="true" />
    </div>
  </section>;
}
