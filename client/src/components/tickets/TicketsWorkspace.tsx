import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Ticket,
  Plus,
  Coins,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Sparkles,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";

export function TicketsWorkspace() {
  const utils = trpc.useUtils();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [amountStr, setAmountStr] = useState("50");
  const [reason, setReason] = useState("");

  const ticketsQuery = trpc.developer.tickets.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  const createTicket = trpc.developer.createCreditTicket.useMutation({
    onSuccess: () => {
      utils.developer.tickets.invalidate();
      setIsFormOpen(false);
      setAmountStr("50");
      setReason("");
      toast.success("Credit issue ticket published successfully! Administrators will review your request.");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to publish credit issue ticket");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid credit amount in USD (e.g. 50)");
      return;
    }
    createTicket.mutate({
      requestedAmountDollars: amount,
      reason: reason.trim() || undefined,
    });
  };

  const tickets = ticketsQuery.data ?? [];
  const pendingCount = tickets.filter((t) => t.status === "pending").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;
  const totalApprovedDollars = tickets
    .filter((t) => t.status === "resolved" && t.approvedAmountDollars)
    .reduce((sum, t) => sum + Number(t.approvedAmountDollars), 0);

  const quickAmounts = [25, 50, 100, 200, 500];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="dashboard-page-intro flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#c9ff73]">
            Support & Account Care
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Tickets & Credit Requests
          </h1>
          <span className="mt-1 text-xs text-[#9fa0af]">
            Submit a credit issue or request additional build credits for high-throughput model development.
          </span>
        </div>
        <Button
          onClick={() => setIsFormOpen((prev) => !prev)}
          className="bg-[#c9ff73] font-bold text-[#141b0f] shadow-lg shadow-[#c9ff73]/15 transition-all hover:bg-[#d8ff91] hover:shadow-xl"
        >
          {isFormOpen ? (
            "Cancel Ticket"
          ) : (
            <>
              <Plus size={16} className="mr-1.5" />
              Credit Issue Button
            </>
          )}
        </Button>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#09090b] p-4">
          <div className="flex items-center gap-2 text-[#9fa0af]">
            <Ticket size={16} />
            <p className="text-[10px] font-bold uppercase tracking-[.14em]">Total Tickets</p>
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{tickets.length}</p>
          <p className="mt-1 text-xs text-[#808194]">Submitted by your account</p>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-[#191612] p-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Clock size={16} />
            <p className="text-[10px] font-bold uppercase tracking-[.14em]">Pending Review</p>
          </div>
          <p className="mt-3 text-2xl font-bold text-amber-300">{pendingCount}</p>
          <p className="mt-1 text-xs text-amber-400/70">Awaiting admin review & approval</p>
        </div>

        <div className="rounded-2xl border border-[#c9ff73]/20 bg-[#121a11] p-4">
          <div className="flex items-center gap-2 text-[#c9ff73]">
            <Coins size={16} />
            <p className="text-[10px] font-bold uppercase tracking-[.14em]">Granted Via Tickets</p>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#d8ff91]">
            ${totalApprovedDollars.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-[#a0c56d]">
            {resolvedCount} ticket{resolvedCount === 1 ? "" : "s"} resolved & credited
          </p>
        </div>
      </div>

      {/* Credit Issue Form Drawer/Card */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-2xl border border-[#c9ff73]/30 bg-gradient-to-b from-[#141812] to-[#09090b] p-5 shadow-2xl sm:p-6"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#c9ff73]/30 bg-[#c9ff73]/15 text-[#d8ff9d]">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#c9ff73]">
                New Ticket Request
              </p>
              <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">
                Report a Credit Issue or Request Extra Credits
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#b0c0aa]">
                Specify the additional credit amount you need in USD. When the admin approves your ticket, the credits are deposited immediately with an illuminated giveaway banner alert.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#d4d6e2]">
                Extra Amount Requested (USD) <span className="text-[#c9ff73]">*</span>
              </label>
              <div className="relative mt-2">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 font-mono text-sm font-bold text-[#9fa0af]">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  max="10000"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="50.00"
                  className="h-11 border-white/15 bg-black/40 pl-8 font-mono text-base font-bold text-white placeholder:text-[#555666] focus-visible:border-[#c9ff73] focus-visible:ring-1 focus-visible:ring-[#c9ff73]"
                  required
                />
              </div>

              {/* Quick Select Buttons */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-[#8e90a0]">Quick amounts:</span>
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountStr(String(amt))}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${
                      amountStr === String(amt)
                        ? "border-[#c9ff73] bg-[#c9ff73]/20 text-[#d8ff91]"
                        : "border-white/10 bg-black/20 text-[#a0a1b2] hover:border-white/20 hover:text-white"
                    }`}
                  >
                    +${amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#d4d6e2]">
                Issue Details / Reason for Extra Credit (Optional)
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., We are benchmarking large prompt batches with Claude Opus 5 & Qwen 3.8 Max and ran low on build credits. Would appreciate additional quota."
                rows={3}
                className="mt-2 border-white/15 bg-black/40 text-xs text-white placeholder:text-[#5a5b6c] focus-visible:border-[#c9ff73] focus-visible:ring-1 focus-visible:ring-[#c9ff73]"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-[11px] text-[#9fa0af]">
              <ShieldCheck size={14} className="text-[#c9ff73]" />
              <span>Requests are reviewed and resolved directly from the admin operations panel.</span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsFormOpen(false)}
                className="text-[#9fa0af] hover:bg-white/5 hover:text-white"
                disabled={createTicket.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTicket.isPending || !amountStr}
                className="bg-[#c9ff73] font-bold text-[#141b0f] hover:bg-[#d8ff91]"
              >
                {createTicket.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 animate-spin" size={15} />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5" size={15} />
                    Publish Ticket
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Ticket List Section */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#09090b]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#c9ff73]">
              Your Ticket History
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-white">Submitted Tickets & Status</h2>
          </div>
          {ticketsQuery.isFetching && (
            <div className="flex items-center gap-1.5 text-xs text-[#808194]">
              <Loader2 className="animate-spin" size={14} />
              <span>Updating...</span>
            </div>
          )}
        </div>

        {ticketsQuery.isLoading ? (
          <div className="grid min-h-48 place-items-center p-8">
            <Loader2 className="animate-spin text-[#c9ff73]" size={24} />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <Ticket className="mx-auto text-[#626374]" size={36} />
            <p className="mt-3 text-base font-bold text-white">No tickets submitted yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#88899a]">
              Need extra credits for building or testing models? Click the "Credit Issue Button" above to publish your request.
            </p>
            <Button
              onClick={() => setIsFormOpen(true)}
              size="sm"
              className="mt-4 bg-[#c9ff73] font-bold text-[#141b0f] hover:bg-[#d8ff91]"
            >
              <Plus size={14} className="mr-1" />
              Open First Ticket
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/8">
            {tickets.map((ticket) => {
              const isResolved = ticket.status === "resolved";
              const isPending = ticket.status === "pending";
              const isRejected = ticket.status === "rejected";

              return (
                <div key={ticket.id} className="p-5 transition-colors hover:bg-white/[.015]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#d4d6e2]">
                          {ticket.id}
                        </span>
                        {isPending && (
                          <Badge className="border-0 bg-amber-400/15 text-amber-300">
                            <Clock size={12} className="mr-1" />
                            Pending Review
                          </Badge>
                        )}
                        {isResolved && (
                          <Badge className="border-0 bg-[#c9ff73]/20 font-bold text-[#c9ff73] shadow-sm shadow-[#c9ff73]/20">
                            <CheckCircle2 size={12} className="mr-1" />
                            Resolved
                          </Badge>
                        )}
                        {isRejected && (
                          <Badge className="border-0 bg-red-400/15 text-red-300">
                            <XCircle size={12} className="mr-1" />
                            Declined
                          </Badge>
                        )}
                        <span className="text-[11px] text-[#707184]">
                          {new Date(ticket.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#9596a7]">Requested:</span>
                        <span className="font-mono text-sm font-bold text-white">
                          ${Number(ticket.requestedAmountDollars).toFixed(2)} USD
                        </span>
                        {isResolved && ticket.approvedAmountDollars && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-[#c9ff73]/30 bg-[#c9ff73]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#d8ff91]">
                            <Sparkles size={11} />
                            +${Number(ticket.approvedAmountDollars).toFixed(2)} Credited
                          </span>
                        )}
                      </div>

                      {ticket.reason && (
                        <p className="mt-1 text-xs leading-5 text-[#b0b1c2]">
                          <span className="font-medium text-[#7d7e90]">Reason: </span>
                          {ticket.reason}
                        </p>
                      )}

                      {isResolved && ticket.adminNote && (
                        <div className="mt-2 rounded-lg border border-[#c9ff73]/20 bg-[#c9ff73]/[.05] p-2.5 text-xs text-[#d8ff91]">
                          <span className="font-bold text-[#c9ff73]">Admin Note: </span>
                          {ticket.adminNote}
                        </div>
                      )}

                      {isRejected && ticket.adminNote && (
                        <div className="mt-2 rounded-lg border border-red-400/20 bg-red-400/[.05] p-2.5 text-xs text-red-300">
                          <span className="font-bold">Admin Note: </span>
                          {ticket.adminNote}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      {isResolved && (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c9ff73]">
                            Credited to Wallet
                          </span>
                          <span className="mt-0.5 font-mono text-xs text-[#808194]">
                            Resolved {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                      )}
                      {isPending && (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                            In Queue
                          </span>
                          <span className="mt-0.5 text-xs text-[#808194]">
                            Waiting for administrator action
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
