import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Sparkles,
  Search,
  Filter,
  Mail,
  UserCheck,
  UserX,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { SectionHeader } from "../common/AdminCommon";

export function AdminAccessRequestsSection() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "denied">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const requestsQuery = trpc.admin.accessRequests.useQuery(
    { status: "all", limit: 150 },
    { refetchInterval: 10_000 }
  );

  const approveMutation = trpc.admin.approveAccessRequest.useMutation({
    onSuccess: (data) => {
      utils.admin.accessRequests.invalidate();
      utils.admin.overview.invalidate();
      toast.success(`Access approved for ${data.email}! Account is now pre-authorized.`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve request");
    },
  });

  const denyMutation = trpc.admin.denyAccessRequest.useMutation({
    onSuccess: (data) => {
      utils.admin.accessRequests.invalidate();
      toast.success(
        `Request for ${data.email} denied. User will receive note on login: "${data.adminNote}"`
      );
    },
    onError: (error) => {
      toast.error(error.message || "Failed to deny request");
    },
  });

  const requests = requestsQuery.data ?? [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Email copied to clipboard");
  };

  const handleApprove = (id: string) => {
    const note = notes[id]?.trim() || undefined;
    approveMutation.mutate({ id, note });
  };

  const handleDeny = (id: string) => {
    const note =
      notes[id]?.trim() ||
      "Your access request was reviewed and denied by the administrator.";
    denyMutation.mutate({ id, note });
  };

  const filteredRequests = requests.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.email.toLowerCase().includes(q) ||
        (r.adminNote && r.adminNote.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const deniedCount = requests.filter((r) => r.status === "denied").length;

  return (
    <section className="dashboard-card space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
        <SectionHeader
          icon={<UserCheck size={18} className="text-[#c9ff73]" />}
          title="Access & Contact Proposals"
          detail="Review access requests submitted via 'Contact administrator' on the login screen. Approved requests can log in directly; denied users receive your note on login and can resubmit anytime."
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => requestsQuery.refetch()}
          disabled={requestsQuery.isFetching}
          className="border-white/10 bg-white/5 text-xs text-[#c6c7d7] hover:bg-white/10 hover:text-white shrink-0 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={`mr-1.5 ${requestsQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics Header Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/8 bg-black/25 p-3.5">
          <p className="text-[11px] font-medium text-[#848598] uppercase tracking-wider">Total Proposals</p>
          <p className="mt-1 text-2xl font-bold text-white font-mono">{requests.length}</p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Pending Review</p>
            <Clock size={14} className="text-amber-400" />
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-300 font-mono">{pendingCount}</p>
        </div>

        <div className="rounded-xl border border-[#c9ff73]/20 bg-[#c9ff73]/5 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-[#c9ff73] uppercase tracking-wider">Approved</p>
            <CheckCircle2 size={14} className="text-[#c9ff73]" />
          </div>
          <p className="mt-1 text-2xl font-bold text-[#c9ff73] font-mono">{approvedCount}</p>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-red-400 uppercase tracking-wider">Denied</p>
            <XCircle size={14} className="text-red-400" />
          </div>
          <p className="mt-1 text-2xl font-bold text-red-300 font-mono">{deniedCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "ghost"}
            onClick={() => setFilter("all")}
            className={`h-8 text-xs font-semibold ${
              filter === "all"
                ? "bg-[#c9ff73] text-[#131d0b] hover:bg-[#d8ff91]"
                : "text-[#a2a3b4] hover:bg-white/8 hover:text-white"
            }`}
          >
            All ({requests.length})
          </Button>

          <Button
            size="sm"
            variant={filter === "pending" ? "default" : "ghost"}
            onClick={() => setFilter("pending")}
            className={`h-8 text-xs font-semibold ${
              filter === "pending"
                ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                : "text-[#a2a3b4] hover:bg-white/8 hover:text-white"
            }`}
          >
            Pending ({pendingCount})
          </Button>

          <Button
            size="sm"
            variant={filter === "approved" ? "default" : "ghost"}
            onClick={() => setFilter("approved")}
            className={`h-8 text-xs font-semibold ${
              filter === "approved"
                ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                : "text-[#a2a3b4] hover:bg-white/8 hover:text-white"
            }`}
          >
            Approved ({approvedCount})
          </Button>

          <Button
            size="sm"
            variant={filter === "denied" ? "default" : "ghost"}
            onClick={() => setFilter("denied")}
            className={`h-8 text-xs font-semibold ${
              filter === "denied"
                ? "bg-red-500 text-white hover:bg-red-400"
                : "text-[#a2a3b4] hover:bg-white/8 hover:text-white"
            }`}
          >
            Denied ({deniedCount})
          </Button>
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#6e7081]" />
          <Input
            type="text"
            placeholder="Search email address or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 border-white/10 bg-black/30 text-xs text-white placeholder:text-[#6e7081] focus:border-[#c9ff73]/50"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {requestsQuery.isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#c9ff73]" />
            <span className="text-xs text-[#8c8d9e]">Loading proposals...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-black/20 py-12 text-center">
            <UserCheck className="mx-auto h-8 w-8 text-[#5f6172] mb-2" />
            <p className="text-sm font-semibold text-white">No access proposals found</p>
            <p className="text-xs text-[#828395] mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "No requests matching your search query."
                : filter !== "all"
                ? `There are no requests with "${filter}" status.`
                : "When users click 'Contact administrator' on the login screen, their requests will appear here for review."}
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isPending = req.status === "pending";
            const isApproved = req.status === "approved";
            const isDenied = req.status === "denied";
            const isResubmission = req.submissionCount > 1;

            return (
              <div
                key={req.id}
                className={`rounded-xl border p-4 transition-all ${
                  isPending
                    ? "border-amber-500/30 bg-amber-500/[.03] shadow-[0_0_15px_rgba(245,158,11,0.04)]"
                    : isApproved
                    ? "border-emerald-500/20 bg-emerald-500/[.02]"
                    : "border-red-500/20 bg-red-500/[.02]"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Email & Meta Details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono flex items-center gap-1.5 truncate">
                        <Mail size={15} className="text-[#c9ff73] shrink-0" />
                        {req.email}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopy(req.email, req.id)}
                        className="rounded p-1 text-[#787a8c] hover:bg-white/10 hover:text-white transition-colors"
                        title="Copy email"
                      >
                        {copiedId === req.id ? (
                          <Check size={13} className="text-[#c9ff73]" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>

                      {/* Status Badge */}
                      {isPending && (
                        <Badge className="bg-amber-400/15 text-amber-300 border-amber-400/30 text-[10px] font-semibold flex items-center gap-1 py-0.5">
                          <Clock size={11} /> Pending review
                        </Badge>
                      )}
                      {isApproved && (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 py-0.5">
                          <CheckCircle2 size={11} /> Approved
                        </Badge>
                      )}
                      {isDenied && (
                        <Badge className="bg-red-500/15 text-red-300 border-red-500/30 text-[10px] font-semibold flex items-center gap-1 py-0.5">
                          <XCircle size={11} /> Denied (not blacklisted)
                        </Badge>
                      )}

                      {/* Resubmission badge */}
                      {isResubmission && (
                        <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[10px] font-mono py-0.5">
                          Proposal #{req.submissionCount}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#868799]">
                      <span>
                        Requested: <span className="text-[#babccb]">{new Date(req.requestedAt).toLocaleString()}</span>
                      </span>
                      {req.resolvedAt && (
                        <span>
                          Reviewed: <span className="text-[#babccb]">{new Date(req.resolvedAt).toLocaleString()}</span>
                          {req.resolvedByUserName && ` by ${req.resolvedByUserName}`}
                        </span>
                      )}
                    </div>

                    {/* Active Denial Note or Admin Note Display */}
                    {req.adminNote && (
                      <div
                        className={`mt-2 rounded-lg border p-2.5 text-xs ${
                          isDenied
                            ? "border-red-500/30 bg-red-500/10 text-red-200"
                            : "border-white/10 bg-white/5 text-[#c4c6d6]"
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                          <div>
                            <span className="font-semibold text-white">Active Login Error Note: </span>
                            <span>"{req.adminNote}"</span>
                            <p className="mt-1 text-[11px] text-[#a5a7b8]">
                              This exact message is shown to the user if they try to log in with this email.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions & Optional Note */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:w-96 shrink-0">
                    <Input
                      type="text"
                      placeholder="Optional note for approval or denial..."
                      value={notes[req.id] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                      className="h-9 text-xs border-white/12 bg-black/35 text-white placeholder:text-[#676878] focus:border-[#c9ff73]/50"
                    />

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Approve Button */}
                      <Button
                        size="sm"
                        onClick={() => handleApprove(req.id)}
                        disabled={approveMutation.isPending}
                        className="h-9 bg-[#c9ff73] text-[#131d0b] hover:bg-[#d8ff91] text-xs font-bold transition-all shadow-sm flex items-center gap-1 px-3"
                      >
                        {approveMutation.isPending && approveMutation.variables?.id === req.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        Approve
                      </Button>

                      {/* Deny Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeny(req.id)}
                        disabled={denyMutation.isPending}
                        className="h-9 border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 text-xs font-semibold flex items-center gap-1 px-3"
                      >
                        {denyMutation.isPending && denyMutation.variables?.id === req.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <UserX size={13} />
                        )}
                        Deny
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
