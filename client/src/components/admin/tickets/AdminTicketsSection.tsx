import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Ticket,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Sparkles,
  Search,
  Filter,
  CreditCard,
  Mail,
  User,
  ArrowRight,
  ShieldAlert,
  Coins,
} from "lucide-react";
import { SectionHeader } from "../common/AdminCommon";

export function AdminTicketsSection() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<"all" | "pending" | "resolved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  // Mapping of ticketId -> editable approved amount string
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const ticketsQuery = trpc.admin.tickets.useQuery({ limit: 150 }, {
    refetchInterval: 10_000,
  });

  const approveTicket = trpc.admin.approveTicket.useMutation({
    onSuccess: (data) => {
      utils.admin.tickets.invalidate();
      utils.admin.overview.invalidate();
      toast.success(`Ticket ${data.ticketId} approved! $${data.approvedAmountDollars} credited to user wallet.`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve ticket");
    },
  });

  const rejectTicket = trpc.admin.rejectTicket.useMutation({
    onSuccess: (data) => {
      utils.admin.tickets.invalidate();
      toast.success(`Ticket ${data.ticketId} marked as declined.`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to decline ticket");
    },
  });

  const tickets = ticketsQuery.data ?? [];

  const handleAmountChange = (ticketId: string, val: string) => {
    setAmountInputs((prev) => ({ ...prev, [ticketId]: val }));
  };

  const handleApprove = (ticketId: string, defaultRequestedDollars: string) => {
    const rawValue = amountInputs[ticketId] ?? defaultRequestedDollars;
    const amount = parseFloat(rawValue);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid credit amount in USD (e.g. 50)");
      return;
    }
    approveTicket.mutate({
      ticketId,
      approvedAmountDollars: amount,
      adminNote: adminNotes[ticketId]?.trim() || undefined,
    });
  };

  const handleReject = (ticketId: string) => {
    rejectTicket.mutate({
      ticketId,
      adminNote: adminNotes[ticketId]?.trim() || "Declined by administrator.",
    });
  };

  const filteredTickets = tickets.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.userEmail.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.userName && t.userName.toLowerCase().includes(q)) ||
        (t.reason && t.reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const pendingCount = tickets.filter((t) => t.status === "pending").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;
  const totalApprovedDollars = tickets
    .filter((t) => t.status === "resolved" && t.approvedAmountDollars)
    .reduce((sum, t) => sum + Number(t.approvedAmountDollars), 0);

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={<Ticket size={18} className="text-[#c9ff73]" />}
        title="Credit Issue & Support Tickets"
        detail="Review credit requests, adjust approved amounts, and credit balances with automated giveaway ribbon alerts."
      />

      {/* Overview Metric Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-[#9fa0af]">
            <Ticket size={16} />
            <span className="text-[10px] font-bold uppercase tracking-[.14em]">Total Tickets</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-white">{tickets.length}</p>
          <p className="mt-1 text-xs text-[#707184]">Lifetime submitted tickets</p>
        </div>

        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[.03] p-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Clock size={16} />
            <span className="text-[10px] font-bold uppercase tracking-[.14em]">Pending Review</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-300">{pendingCount}</p>
          <p className="mt-1 text-xs text-amber-400/70">Awaiting your approval & credit</p>
        </div>

        <div className="rounded-xl border border-[#c9ff73]/20 bg-[#c9ff73]/[.03] p-4">
          <div className="flex items-center gap-2 text-[#c9ff73]">
            <Coins size={16} />
            <span className="text-[10px] font-bold uppercase tracking-[.14em]">Total Credited</span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[#d8ff91]">
            ${totalApprovedDollars.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-[#a1cb6f]">{resolvedCount} resolved tickets</p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="dashboard-card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "pending", "resolved", "rejected"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={filter === tab ? "default" : "ghost"}
              onClick={() => setFilter(tab)}
              className={
                filter === tab
                  ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
                  : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
              }
            >
              {tab === "all"
                ? `All (${tickets.length})`
                : tab === "pending"
                ? `Pending (${pendingCount})`
                : tab === "resolved"
                ? `Resolved (${resolvedCount})`
                : `Declined (${tickets.filter((t) => t.status === "rejected").length})`}
            </Button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 text-[#707184]" size={15} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email, ID or reason..."
            className="h-9 border-white/10 bg-black/30 pl-9 text-xs text-white placeholder:text-[#555666]"
          />
        </div>
      </div>

      {/* Ticket List Table/Cards */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#09090b]">
        {ticketsQuery.isLoading ? (
          <div className="grid min-h-48 place-items-center p-8">
            <Loader2 className="animate-spin text-[#c9ff73]" size={24} />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-10 text-center">
            <Ticket className="mx-auto text-[#626374]" size={32} />
            <p className="mt-3 text-sm font-bold text-white">No tickets found</p>
            <p className="mt-1 text-xs text-[#808194]">
              {filter === "pending"
                ? "All credit issue tickets have been reviewed and resolved!"
                : "No ticket matches the selected filter or search term."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/8">
            {filteredTickets.map((ticket) => {
              const isPending = ticket.status === "pending";
              const isResolved = ticket.status === "resolved";
              const isRejected = ticket.status === "rejected";
              const currentInput = amountInputs[ticket.id] ?? String(ticket.requestedAmountDollars);

              return (
                <div key={ticket.id} className="p-5 transition-colors hover:bg-white/[.015]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Ticket Details & User Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          {ticket.id}
                        </span>
                        {isPending && (
                          <Badge className="border-0 bg-amber-400/15 text-amber-300">
                            <Clock size={12} className="mr-1" />
                            Pending Review
                          </Badge>
                        )}
                        {isResolved && (
                          <Badge className="border-0 bg-[#c9ff73]/20 font-bold text-[#c9ff73]">
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
                          Submitted {new Date(ticket.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {/* User Email & Account Info */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1 text-xs text-[#e1e2ec]">
                          <Mail size={13} className="text-[#c9ff73]" />
                          <span className="font-semibold text-white">{ticket.userEmail}</span>
                        </div>
                        {ticket.userName && (
                          <div className="flex items-center gap-1 text-xs text-[#9596a7]">
                            <User size={13} />
                            <span>{ticket.userName}</span>
                          </div>
                        )}
                        <span className="text-xs text-[#707184]">User ID: #{ticket.userId}</span>
                      </div>

                      {/* Requested Amount & Reason */}
                      <div className="pt-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[#9596a7]">Requested Amount:</span>
                          <span className="font-mono text-base font-bold text-[#d8ff91]">
                            ${Number(ticket.requestedAmountDollars).toFixed(2)} USD
                          </span>
                        </div>

                        {ticket.reason && (
                          <div className="mt-1.5 rounded-lg border border-white/8 bg-black/20 p-2.5 text-xs text-[#b8b9ca]">
                            <span className="font-semibold text-[#808194]">User Reason: </span>
                            {ticket.reason}
                          </div>
                        )}

                        {isResolved && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#c9ff73]/20 bg-[#c9ff73]/[.06] p-2.5 text-xs text-[#d8ff91]">
                            <Sparkles size={14} className="text-[#c9ff73]" />
                            <span className="font-bold">
                              Approved & Credited: +${Number(ticket.approvedAmountDollars ?? ticket.requestedAmountDollars).toFixed(2)} USD
                            </span>
                            {ticket.resolvedAt && (
                              <span className="text-[#9fc66d]">
                                · on {new Date(ticket.resolvedAt).toLocaleString()}
                              </span>
                            )}
                            {ticket.adminNote && (
                              <span className="block w-full text-[11px] text-[#c0e090]">
                                Note: {ticket.adminNote}
                              </span>
                            )}
                          </div>
                        )}

                        {isRejected && ticket.adminNote && (
                          <div className="mt-2 rounded-lg border border-red-400/20 bg-red-400/[.05] p-2 text-xs text-red-300">
                            <span className="font-bold">Decline reason: </span>
                            {ticket.adminNote}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Admin Action Box (Approve / Amount Input / Reject) */}
                    {isPending && (
                      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-3 lg:w-80">
                        <label className="text-[11px] font-bold text-[#d4d6e2]">
                          Approved Credit Amount (USD):
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-xs font-bold text-[#88899a]">
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={currentInput}
                            onChange={(e) => handleAmountChange(ticket.id, e.target.value)}
                            placeholder={String(ticket.requestedAmountDollars)}
                            className="h-9 border-white/15 bg-black/40 pl-7 font-mono text-sm font-bold text-white focus-visible:border-[#c9ff73]"
                          />
                        </div>

                        <Input
                          type="text"
                          value={adminNotes[ticket.id] ?? ""}
                          onChange={(e) =>
                            setAdminNotes((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                          }
                          placeholder="Admin note to user (optional)..."
                          className="h-8 border-white/10 bg-black/20 text-xs text-white placeholder:text-[#555666]"
                        />

                        <div className="mt-1 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleApprove(ticket.id, String(ticket.requestedAmountDollars))
                            }
                            disabled={approveTicket.isPending}
                            className="flex-1 bg-[#c9ff73] font-bold text-[#141b0f] hover:bg-[#d8ff91]"
                          >
                            {approveTicket.isPending ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : (
                              <>
                                <CheckCircle2 size={14} className="mr-1" />
                                Approve & Credit
                              </>
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReject(ticket.id)}
                            disabled={rejectTicket.isPending}
                            className="text-[#d89098] hover:bg-red-400/10 hover:text-red-200"
                          >
                            {rejectTicket.isPending ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : (
                              <XCircle size={14} />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
