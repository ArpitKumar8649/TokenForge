import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type Props = {
  baseUrl: string;
  apiKey: string;
  model: string;
  anthropic?: boolean;
  disabled?: boolean;
};

/**
 * Validates an upstream provider's base URL + API key + model with a minimal
 * one-shot completion before the admin saves the credentials. Displays the
 * gateway-level result without exposing the key.
 */
export default function TestProviderConnectionButton({ baseUrl, apiKey, model, anthropic = false, disabled = false }: Props) {
  const probe = trpc.admin.testProviderConnection.useMutation({
    onSuccess: result => {
      // Keep result visible via the returned value below; no toast spam.
    },
  });

  const canTest = Boolean(baseUrl.trim() && apiKey.trim() && model.trim()) && !probe.isPending && !disabled;
  const result = probe.data;
  const ok = result?.ok === true;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="border-white/12 text-[#d9d8e1] hover:bg-white/10"
        disabled={!canTest}
        onClick={() => probe.mutate({ baseUrl, apiKey, model, anthropic })}
      >
        {probe.isPending ? <><Loader2 className="animate-spin" size={14} /> Testing…</> : <><ActivityIcon /> Test connection</>}
      </Button>
      {result && (
        ok
          ? <span className="flex items-center gap-1.5 text-[11px] text-[#c9ff73]"><CheckCircle2 size={14} /> Connected · HTTP {result.status} · {result.latencyMs}ms</span>
          : <span className="flex items-center gap-1.5 text-[11px] text-red-300" title={result.message}><XCircle size={14} /> {result.message.slice(0, 60)}</span>
      )}
    </div>
  );
}

function ActivityIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}
