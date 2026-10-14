import React, { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SectionHeader } from "../common/AdminCommon";
import { OrcaRouterSlotUsageChart } from "../overview/AdminCharts";

export function OrcaRouterCredentialPanel() {
  const utils = trpc.useUtils();
  const credentials = trpc.admin.orcaRouterCredentials.useQuery(undefined, { refetchInterval: 15_000 });
  const slotUsage = trpc.admin.orcaRouterSlotUsage.useQuery(undefined, { refetchInterval: 15_000 });
  const slotNumbers = Array.from({ length: 15 }, (_, index) => index);
  const [values, setValues] = useState<string[]>(() => Array.from({ length: 15 }, () => ""));
  const [confirmation, setConfirmation] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const phrase = "ROTATE ORCAROUTER CREDENTIALS";

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
            The server probes every submitted key before replacing the pool. If any validation fails, the current
            pool remains active. Plaintext keys are encrypted at rest, omitted from logs and audits, and cleared from
            this page after activation.
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
    </section>
  );
}
