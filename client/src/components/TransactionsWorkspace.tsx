import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
  Clock,
  AlertCircle,
  Coins,
  ChevronDown,
  ChevronUp,
  Smartphone,
  IndianRupee,
  Check,
  XCircle,
  Filter,
  Mail,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckoutModal } from "@/components/CheckoutModal";
import { useAuth } from "@/_core/hooks/useAuth";
import { getStoredSessionToken } from "@/lib/sessionToken";
import { toast } from "sonner";

interface TransactionItem {
  signature: string;
  slot: number;
  timestamp: number;
  date: string;
  status: "CONFIRMED" | "FAILED";
  type: string;
  source: string;
  amountSol: number;
  amountFormatted: string;
  creditsNanos: number;
  creditsFormatted: string;
  from: string;
  to: string;
  feeLamports: number;
  feeSol: number;
  description: string;
  explorerUrl: string;
  userEmail?: string | null;
  userName?: string | null;
  matchedOrder?: {
    orderId: string;
    userId: number;
    userEmail?: string | null;
    userName?: string | null;
    status: string;
  } | null;
}

interface SolanaPaidUser {
  orderId: string;
  userId: number | null;
  userEmail: string | null;
  userName: string | null;
  solAmount: number;
  solFormatted: string;
  usdAmount: number;
  usdFormatted: string;
  credits: number;
  creditsFormatted: string;
  signature: string | null;
  explorerUrl: string | null;
  timestamp: string;
  status: string;
}

interface TransactionsApiResponse {
  success: boolean;
  network: string;
  provider_source: string;
  merchant_wallet: string;
  total_transactions: number;
  total_volume_sol: number;
  transactions: TransactionItem[];
  error?: string;
}

interface UPIAdminOrder {
  orderId: string;
  userId: number | null;
  userEmail?: string | null;
  userName?: string | null;
  tierId: string;
  amountInr: number;
  credits: number;
  creditsNanos: number;
  upiId: string;
  merchantName: string;
  upiUri: string;
  status: "PENDING_PAYMENT" | "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED" | "EXPIRED";
  utr: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface TransactionsWorkspaceProps {
  adminMode?: boolean;
}

export function TransactionsWorkspace({ adminMode = false }: TransactionsWorkspaceProps) {
  const { user } = useAuth();
  const isAdmin = adminMode || user?.isAdminSession === true;

  const [activeRail, setActiveRail] = useState<"solana" | "upi">("solana");

  // ---------------------------------------------------------------------------
  // Solana State & Paid Users
  // ---------------------------------------------------------------------------
  const [data, setData] = useState<TransactionsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CONFIRMED" | "FAILED">("ALL");
  const [copiedSignature, setCopiedSignature] = useState<string | null>(null);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const [solanaPaidUsers, setSolanaPaidUsers] = useState<SolanaPaidUser[]>([]);
  const [solanaPaidStats, setSolanaPaidStats] = useState<{
    total_paid_users: number;
    total_transactions: number;
    total_volume_sol: number;
    total_volume_usd: number;
    total_credits: number;
  } | null>(null);
  const [solanaViewMode, setSolanaViewMode] = useState<"paid_users" | "all_feed">("paid_users");
  const [solanaPaidLoading, setSolanaPaidLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // UPI Orders State (Admin queue vs User orders)
  // ---------------------------------------------------------------------------
  const [upiOrders, setUpiOrders] = useState<UPIAdminOrder[]>([]);
  const [upiLoading, setUpiLoading] = useState(false);
  const [upiRefreshing, setUpiRefreshing] = useState(false);
  const [upiFilter, setUpiFilter] = useState<"ALL" | "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED">("ALL");
  const [upiSearchQuery, setUpiSearchQuery] = useState("");
  const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);

  // Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [authAlertOpen, setAuthAlertOpen] = useState(false);
  // user is already available from useAuth

  // Fetch Solana transactions
  const fetchTransactions = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/solana-pay/transactions?limit=30");
      if (!res.ok) {
        throw new Error(`Failed to load transactions (HTTP ${res.status})`);
      }
      const json: TransactionsApiResponse = await res.json();
      if (!json.success && json.error) {
        throw new Error(json.error);
      }
      setData(json);
      setError(null);
      if (isManualRefresh) {
        toast.success("Solana transactions updated from Helius RPC");
      }
    } catch (err: any) {
      console.error("Transactions fetch error:", err);
      setError(err.message || "Unable to retrieve transaction history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch Solana Paid Users from DB
  const fetchSolanaPaidUsers = useCallback(async (isManual = false) => {
    if (isManual) setSolanaPaidLoading(true);
    try {
      const res = await fetch("/api/solana-pay/paid-users");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSolanaPaidUsers(json.payments || []);
          setSolanaPaidStats({
            total_paid_users: json.total_paid_users || 0,
            total_transactions: json.total_transactions || 0,
            total_volume_sol: json.total_volume_sol || 0,
            total_volume_usd: json.total_volume_usd || 0,
            total_credits: json.total_credits || 0,
          });
        }
      }
    } catch (err) {
      console.warn("Error fetching Solana paid users:", err);
    } finally {
      if (isManual) setSolanaPaidLoading(false);
    }
  }, []);

  // Fetch UPI Orders (Admin gets full queue, standard user gets their own orders)
  const fetchUpiOrders = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setUpiRefreshing(true);
    else setUpiLoading(true);

    try {
      const endpoint = isAdmin ? "/api/admin/upi/orders" : "/api/upi/my-orders";
      const token = getStoredSessionToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(endpoint, {
        credentials: "include",
        headers,
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setUpiOrders([]);
          return;
        }
        throw new Error(`Failed to load UPI orders (HTTP ${res.status})`);
      }
      const json = await res.json();
      setUpiOrders(json.orders || []);
      if (isManualRefresh) {
        toast.success(isAdmin ? "Settlement queue updated" : "Your UPI orders updated");
      }
    } catch (err: any) {
      console.error("UPI orders fetch error:", err);
      setUpiOrders([]);
    } finally {
      setUpiLoading(false);
      setUpiRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchTransactions();
    fetchSolanaPaidUsers();
    fetchUpiOrders();

    const interval = setInterval(() => {
      fetchTransactions(false);
      fetchSolanaPaidUsers(false);
      fetchUpiOrders(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchTransactions, fetchSolanaPaidUsers, fetchUpiOrders]);

  const handleCopy = async (text: string, id: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSignature(id);
      toast.success(`${label} copied`);
      setTimeout(() => setCopiedSignature(null), 1800);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // UPI Approve (Admin-only action with authenticated session)
  const handleApproveUpiOrder = async (orderId: string) => {
    if (!isAdmin) {
      toast.error("Unauthorized: Only verified administrators can approve orders.");
      return;
    }
    setApprovingOrderId(orderId);
    try {
      const token = getStoredSessionToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/upi/approve", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ order_id: orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to approve order");
      toast.success(`Order ${orderId} approved! Credits granted to user.`);
      fetchUpiOrders(true);
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    } finally {
      setApprovingOrderId(null);
    }
  };

  // UPI Reject (Admin-only action with authenticated session)
  const handleRejectUpiOrder = async (orderId: string) => {
    if (!isAdmin) {
      toast.error("Unauthorized: Only verified administrators can reject orders.");
      return;
    }
    const reason = window.prompt("Enter reason for rejection:", "UTR reference not found in bank statement") || "Invalid UTR";
    setRejectingOrderId(orderId);
    try {
      const token = getStoredSessionToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/upi/reject", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ order_id: orderId, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reject order");
      toast.info(`Order ${orderId} marked as rejected.`);
      fetchUpiOrders(true);
    } catch (err: any) {
      toast.error(err.message || "Rejection failed");
    } finally {
      setRejectingOrderId(null);
    }
  };

  // Filtered Solana transactions
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    return data.transactions.filter((tx) => {
      if (statusFilter !== "ALL" && tx.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSig = tx.signature.toLowerCase().includes(q);
        const matchesFrom = tx.from.toLowerCase().includes(q);
        const matchesDesc = tx.description.toLowerCase().includes(q);
        const matchesAmount = tx.amountFormatted.toLowerCase().includes(q);
        const matchesEmail = (tx.userEmail || tx.matchedOrder?.userEmail || "").toLowerCase().includes(q);
        const matchesName = (tx.userName || tx.matchedOrder?.userName || "").toLowerCase().includes(q);
        return matchesSig || matchesFrom || matchesDesc || matchesAmount || matchesEmail || matchesName;
      }
      return true;
    });
  }, [data?.transactions, statusFilter, searchQuery]);

  // Filtered Solana Paid Users
  const filteredPaidUsers = useMemo(() => {
    if (!solanaPaidUsers) return [];
    if (!searchQuery.trim()) return solanaPaidUsers;
    const q = searchQuery.toLowerCase().trim();
    return solanaPaidUsers.filter((p) => {
      const matchesEmail = (p.userEmail || "").toLowerCase().includes(q);
      const matchesName = (p.userName || "").toLowerCase().includes(q);
      const matchesOrderId = (p.orderId || "").toLowerCase().includes(q);
      const matchesSig = (p.signature || "").toLowerCase().includes(q);
      const matchesUser = String(p.userId || "").toLowerCase().includes(q);
      const matchesSol = String(p.solAmount).includes(q) || p.solFormatted.toLowerCase().includes(q);
      return matchesEmail || matchesName || matchesOrderId || matchesSig || matchesUser || matchesSol;
    });
  }, [solanaPaidUsers, searchQuery]);

  // Filtered UPI orders
  const filteredUpiOrders = useMemo(() => {
    return upiOrders.filter((order) => {
      if (upiFilter !== "ALL" && order.status !== upiFilter) return false;
      if (upiSearchQuery.trim()) {
        const q = upiSearchQuery.toLowerCase().trim();
        const matchesId = order.orderId.toLowerCase().includes(q);
        const matchesUtr = (order.utr || "").toLowerCase().includes(q);
        const matchesUser = String(order.userId || "").toLowerCase().includes(q);
        const matchesAmount = String(order.amountInr).includes(q);
        const matchesEmail = (order.userEmail || "").toLowerCase().includes(q);
        const matchesName = (order.userName || "").toLowerCase().includes(q);
        return matchesId || matchesUtr || matchesUser || matchesAmount || matchesEmail || matchesName;
      }
      return true;
    });
  }, [upiOrders, upiFilter, upiSearchQuery]);

  const totalVolume = data?.total_volume_sol ?? 0;
  const merchantWallet = data?.merchant_wallet ?? "CUiXiA54MjUCxF1acboThD8R2CwLsqfDidiT7RWJsD7w";

  const totalUpiPending = upiOrders.filter((o) => o.status === "PENDING_VERIFICATION").length;
  const totalUpiCompleted = upiOrders.filter((o) => o.status === "COMPLETED").length;
  const totalUpiVolumeInr = upiOrders
    .filter((o) => o.status === "COMPLETED")
    .reduce((acc, curr) => acc + (curr.amountInr || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Dual-Rail Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          fetchTransactions();
          fetchUpiOrders();
        }}
        initialRail={activeRail === "upi" ? "upi" : "crypto"}
        onSuccess={() => {
          fetchTransactions();
          fetchUpiOrders();
        }}
      />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-semibold tracking-wider uppercase text-[11px]">
              Payment Subsystem • Dual Rail
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px]">
              Zero Gateway Fees
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Settlement & Verification
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl">
            Streamed on-chain Solana Pay transactions via Helius RPC alongside direct Domestic UPI settlements and UTR verification queue.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeRail === "solana") fetchTransactions(true);
              else fetchUpiOrders(true);
            }}
            disabled={refreshing || upiRefreshing || loading}
            className="border-white/15 bg-[#09090b] hover:bg-white/10 text-slate-200 text-xs flex items-center gap-1.5"
          >
            <RefreshCw
              size={13}
              className={refreshing || upiRefreshing ? "animate-spin text-cyan-400" : ""}
            />
            {refreshing || upiRefreshing ? "Refreshing..." : "Refresh Feed"}
          </Button>

          <Button
            size="sm"
            onClick={() => { if (!user) { setAuthAlertOpen(true); return; } setIsCheckoutOpen(true); }}
            className="bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/25"
          >
            <Zap size={14} className="text-cyan-300" />
            Open Checkout Modal
          </Button>
        </div>
      </div>

      {/* Primary Rail Switcher (Solana Pay vs Domestic UPI) */}
      <div className="flex items-center p-1 rounded-xl bg-[#09090b] border border-white/10 max-w-md">
        <button
          type="button"
          onClick={() => setActiveRail("solana")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeRail === "solana"
              ? "bg-gradient-to-r from-purple-600/40 to-cyan-600/40 border border-cyan-500/40 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Wallet size={14} className={activeRail === "solana" ? "text-cyan-400" : "text-slate-400"} />
          <span>Solana Pay (Global)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveRail("upi")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all relative ${
            activeRail === "upi"
              ? "bg-gradient-to-r from-emerald-600/40 to-teal-600/40 border border-emerald-500/40 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Smartphone size={14} className={activeRail === "upi" ? "text-emerald-400" : "text-slate-400"} />
          <span>Domestic UPI (India)</span>
          {totalUpiPending > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-bold animate-pulse">
              {totalUpiPending}
            </span>
          )}
        </button>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: SOLANA PAY VIEW                                           */}
      {/* ==================================================================== */}
      {activeRail === "solana" && (
        <div className="space-y-6">
          {/* Solana Metrics Banner */}
          {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-white/10 bg-[#09090b] backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Settled Volume</span>
                <Coins size={15} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {solanaPaidStats ? solanaPaidStats.total_volume_sol.toFixed(3) : totalVolume.toFixed(3)}{" "}
                <span className="text-sm font-normal text-cyan-400">SOL</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                ~${solanaPaidStats ? solanaPaidStats.total_volume_usd.toFixed(2) : (totalVolume * 250).toFixed(2)} platform credits
              </p>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-[#09090b] backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Paid Users</span>
                <Users size={15} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {solanaPaidStats?.total_paid_users ?? solanaPaidUsers.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Registered verified customers
              </p>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-[#09090b] backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Confirmed Transactions</span>
                <CheckCircle2 size={15} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {solanaPaidStats?.total_transactions ?? data?.total_transactions ?? 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                100% on-chain confirmed
              </p>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-[#09090b] backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Merchant Wallet</span>
                <ShieldCheck size={15} className="text-purple-400" />
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs text-slate-200">
                <span>{merchantWallet.slice(0, 6)}...{merchantWallet.slice(-6)}</span>
                <button
                  onClick={() => handleCopy(merchantWallet, "merchant-wallet", "Merchant address")}
                  className="p-1 hover:text-cyan-400 transition-colors"
                  title="Copy merchant address"
                >
                  <Copy size={12} />
                </button>
              </div>
              <a
                href={`https://explorer.solana.com/address/${merchantWallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-cyan-400 hover:underline inline-flex items-center gap-1 mt-1 font-mono"
              >
                View on Solana Explorer <ExternalLink size={10} />
              </a>
            </div>
          </div>
          )}

          {/* View Mode & Search Toolbar */}
          {isAdmin && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#09090b] p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSolanaViewMode("paid_users")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  solanaViewMode === "paid_users"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Users size={14} className="text-cyan-400" />
                <span>Paid Users Table ({solanaPaidStats?.total_paid_users ?? solanaPaidUsers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSolanaViewMode("all_feed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  solanaViewMode === "all_feed"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Wallet size={14} className="text-purple-400" />
                <span>On-Chain Feed ({filteredTransactions.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    solanaViewMode === "paid_users"
                      ? "Filter by email, name, order ID..."
                      : "Search by signature, wallet, amount..."
                  }
                  className="pl-9 bg-black/40 border-white/10 text-xs text-white placeholder:text-slate-500 h-8 w-60"
                />
              </div>

              {solanaViewMode === "all_feed" && (
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
                  {(["ALL", "CONFIRMED", "FAILED"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                        statusFilter === filter
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {filter === "ALL" ? "All" : filter === "CONFIRMED" ? "Confirmed" : "Failed"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* VIEW A: PAID USERS TABLE */}
          {solanaViewMode === "paid_users" && (
            <div>
              {solanaPaidLoading ? (
                <div className="min-h-56 flex flex-col items-center justify-center gap-3 text-slate-400 bg-[#09090b] rounded-2xl border border-white/5 p-8">
                  <Loader2 size={28} className="animate-spin text-cyan-400" />
                  <p className="text-xs">Loading Solana paid users ledger...</p>
                </div>
              ) : filteredPaidUsers.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-white/10 bg-[#09090b] flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Users size={22} />
                  </div>
                  <h3 className="text-base font-bold text-white">{isAdmin ? "No paid users found" : "No transaction history"}</h3>
                  <p className="text-xs text-slate-400 max-w-md">
                    {searchQuery
                      ? `No paid users matched "${searchQuery}".`
                      : (isAdmin ? "When users pay using Solana Pay, their email ID, amount paid, credits granted, and timestamp will appear in this table." : "Your Solana Pay transaction history will appear here once you complete a payment.")}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => { if (!user) { setAuthAlertOpen(true); return; } setIsCheckoutOpen(true); }}
                    className="mt-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs flex items-center gap-1.5"
                  >
                    <Zap size={13} /> Open Solana Pay Checkout
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-[#09090b] overflow-hidden shadow-lg shadow-black/20">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#121215] border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">User Account & Email</th>
                          <th className="py-3 px-4">Amount Paid</th>
                          <th className="py-3 px-4">Credits Granted</th>
                          <th className="py-3 px-4">Paid Timestamp</th>
                          <th className="py-3 px-4">Order ID & Transaction</th>
                          <th className="py-3 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {filteredPaidUsers.map((p, idx) => (
                          <tr key={p.orderId || idx} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 text-cyan-300 font-semibold text-xs">
                                    <Mail size={12} className="text-cyan-400 shrink-0" />
                                    <span>{p.userEmail || "No email on record"}</span>
                                  </span>
                                  {p.userEmail && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(p.userEmail!, `email-${idx}`, "User email")}
                                      className="text-slate-500 hover:text-cyan-300 p-0.5 transition-colors"
                                      title="Copy email"
                                    >
                                      <Copy size={11} />
                                    </button>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-sans flex items-center gap-1">
                                  <User size={11} className="text-slate-500" />
                                  <span>{p.userName || `User #${p.userId}`}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="text-white font-bold">{p.solFormatted}</div>
                              <div className="text-[11px] text-slate-400">{p.usdFormatted}</div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="text-emerald-400 font-semibold flex items-center gap-1">
                                <Sparkles size={12} />
                                +{p.credits.toLocaleString()}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-slate-300 text-xs font-sans">
                              {p.timestamp ? (
                                <>
                                  <div>
                                    {new Date(p.timestamp).toLocaleDateString(undefined, {
                                      dateStyle: "medium",
                                    })}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    {new Date(p.timestamp).toLocaleTimeString(undefined, {
                                      timeStyle: "short",
                                    })}
                                  </div>
                                </>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="text-slate-300 text-[11px]">{p.orderId}</div>
                              {p.signature && (
                                <a
                                  href={p.explorerUrl || `https://explorer.solana.com/tx/${p.signature}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-0.5 hover:underline font-mono"
                                >
                                  <span>
                                    {p.signature.slice(0, 6)}...{p.signature.slice(-6)}
                                  </span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
                                <CheckCircle2 size={11} className="text-emerald-400" />
                                <span>Confirmed</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW B: HELIUS ON-CHAIN FEED */}
          {solanaViewMode === "all_feed" && (
            <div>
              {loading && (
                <div className="min-h-56 flex flex-col items-center justify-center gap-3 text-slate-400 bg-[#09090b] rounded-2xl border border-white/5 p-8">
                  <Loader2 size={28} className="animate-spin text-cyan-400" />
                  <p className="text-xs">Fetching confirmed blocks and transactions from Helius...</p>
                </div>
              )}

              {!loading && error && (
                <div className="p-6 rounded-2xl border border-red-800/40 bg-red-950/20 text-red-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Failed to connect to Helius RPC</p>
                      <p className="text-slate-300 mt-0.5">{error}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchTransactions(true)}
                    className="border-red-700/50 bg-red-950/40 hover:bg-red-900 text-red-200 shrink-0"
                  >
                    Retry Connection
                  </Button>
                </div>
              )}

              {!loading && !error && filteredTransactions.length === 0 && (
                <div className="p-12 text-center rounded-2xl border border-white/10 bg-[#09090b] flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Wallet size={22} />
                  </div>
                  <h3 className="text-base font-bold text-white">No transactions found</h3>
                  <p className="text-xs text-slate-400 max-w-md">
                    {searchQuery
                      ? `No transactions matched "${searchQuery}".`
                      : "No Solana Pay settlements recorded yet for this merchant wallet."}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => { if (!user) { setAuthAlertOpen(true); return; } setIsCheckoutOpen(true); }}
                    className="mt-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs flex items-center gap-1.5"
                  >
                    <Zap size={13} /> Open Solana Pay Checkout
                  </Button>
                </div>
              )}

              {!loading && !error && filteredTransactions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>
                      Showing <strong className="text-white">{filteredTransactions.length}</strong> of{" "}
                      {data?.total_transactions ?? 0} transactions
                    </span>
                    <span className="text-[11px] font-mono text-cyan-400">Auto-refreshed via Helius</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {filteredTransactions.map((tx) => {
                      const userMail = tx.userEmail || tx.matchedOrder?.userEmail;
                      const uName = tx.userName || tx.matchedOrder?.userName;
                      const formattedDate = new Date(tx.timestamp).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      });

                      return (
                        <div
                          key={tx.signature}
                          className="rounded-xl border border-white/10 bg-[#09090b] hover:border-cyan-500/30 transition-all p-4 flex flex-col gap-3 shadow-lg shadow-black/20"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Confirmed
                              </span>

                              <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                                <ArrowDownLeft size={13} className="text-emerald-400" />
                                Solana Pay Settlement
                              </span>

                              {userMail && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono">
                                  <Mail size={11} className="text-cyan-400" />
                                  <span>{userMail}</span>
                                  {uName && uName !== userMail && (
                                    <span className="text-cyan-400/70">({uName})</span>
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                              <span>{formattedDate}</span>
                              <span className="text-slate-600">•</span>
                              <span>Slot {tx.slot?.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                            <div>
                              <div className="text-[11px] text-slate-400">Settled Amount</div>
                              <div className="text-lg font-bold font-mono text-cyan-300 flex items-center gap-1">
                                {tx.amountFormatted}
                              </div>
                            </div>

                            <div>
                              <div className="text-[11px] text-slate-400">API Credits Granted</div>
                              <div className="text-sm font-semibold font-mono text-emerald-400 flex items-center gap-1">
                                <Sparkles size={13} />
                                {tx.creditsFormatted}
                              </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-2">
                              <a
                                href={tx.explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 underline font-mono"
                              >
                                <span>Solana Explorer</span>
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 2: DOMESTIC UPI VERIFICATION QUEUE                           */}
      {/* ==================================================================== */}
      {activeRail === "upi" && (
        <div className="space-y-6">
          {/* UPI Summary Metrics */}
          {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-white/10 bg-[#09090b] backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>{isAdmin ? "Total UPI Orders" : "My UPI Orders"}</span>
                <Smartphone size={15} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {upiOrders.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {isAdmin ? "Direct merchant VPA settlements" : "Your submitted UPI orders"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-amber-300 text-xs mb-2">
                <span>Pending Verification</span>
                <Clock size={15} className="text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-300">
                {totalUpiPending}
              </div>
              <p className="text-[11px] text-amber-400/80 mt-1">
                {isAdmin
                  ? totalUpiPending > 0
                    ? "Awaiting admin bank statement match"
                    : "All queue items cleared"
                  : totalUpiPending > 0
                  ? "Under review (typically 2-5 min)"
                  : "No pending orders"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-[#09090b] backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Approved & Credited</span>
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {totalUpiCompleted}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {isAdmin ? "Credits deposited into ledger" : "Completed orders deposited"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-[#09090b] backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Total INR Settled</span>
                <IndianRupee size={15} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                ₹{totalUpiVolumeInr.toLocaleString()}
              </div>
              <p className="text-[11px] text-emerald-400 mt-1">₹0.00 gateway commission paid</p>
            </div>
          </div>

          )}

          {/* UPI Filter & Search Toolbar */}
          {isAdmin && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#09090b] p-3 rounded-xl border border-white/10">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={upiSearchQuery}
                onChange={(e) => setUpiSearchQuery(e.target.value)}
                placeholder="Search by 12-digit UTR, Order ID (TF_...), or User..."
                className="pl-9 bg-black/40 border-white/10 text-xs text-white placeholder:text-slate-500 h-9"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/10 self-start sm:self-auto">
              {(["ALL", "PENDING_VERIFICATION", "COMPLETED", "REJECTED"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setUpiFilter(filter)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    upiFilter === filter
                      ? filter === "PENDING_VERIFICATION"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : filter === "COMPLETED"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {filter === "ALL"
                    ? "All"
                    : filter === "PENDING_VERIFICATION"
                    ? `Pending (${totalUpiPending})`
                    : filter === "COMPLETED"
                    ? "Approved"
                    : "Rejected"}
                </button>
              ))}
            </div>
          </div>

          )}

          {/* Orders List */}
          {filteredUpiOrders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-white/10 bg-[#09090b] flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Smartphone size={22} />
              </div>
              <h3 className="text-base font-bold text-white">
                {isAdmin ? "No UPI orders found" : "No UPI orders for your account"}
              </h3>
              <p className="text-xs text-slate-400 max-w-md">
                {upiSearchQuery
                  ? `No UPI orders matched "${upiSearchQuery}".`
                  : isAdmin
                  ? "No UPI payment orders in this view. Orders submitted by users will appear here for settlement."
                  : "You haven't placed any UPI payment orders yet. Open the checkout modal to purchase credits via instant UPI."}
              </p>
              <Button
                size="sm"
                onClick={() => { if (!user) { setAuthAlertOpen(true); return; } setIsCheckoutOpen(true); }}
                className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
              >
                <Zap size={13} /> Open UPI Checkout
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  Showing <strong className="text-white">{filteredUpiOrders.length}</strong> of{" "}
                  {upiOrders.length} UPI orders
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  Anti-Replay Protection Active
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredUpiOrders.map((order) => {
                  const isPending = order.status === "PENDING_VERIFICATION";
                  const isCompleted = order.status === "COMPLETED";
                  const isRejected = order.status === "REJECTED";

                  return (
                    <div
                      key={order.orderId}
                      className={`rounded-xl border transition-all p-4 flex flex-col gap-3 shadow-lg shadow-black/20 ${
                        isPending
                          ? "border-amber-500/40 bg-[#09090b] hover:border-amber-500/70"
                          : isCompleted
                          ? "border-emerald-500/30 bg-[#09090b]"
                          : "border-white/10 bg-[#09090b]"
                      }`}
                    >
                      {/* Top bar: Order ID, Status, Account Email, Timestamp */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isPending
                                ? "bg-amber-950 border border-amber-500/50 text-amber-300"
                                : isCompleted
                                ? "bg-emerald-950 border border-emerald-500/50 text-emerald-300"
                                : isRejected
                                ? "bg-red-950 border border-red-500/50 text-red-300"
                                : "bg-[#121215] border border-white/10 text-slate-400"
                            }`}
                          >
                            {isPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
                            {isCompleted && <CheckCircle2 size={12} className="text-emerald-400" />}
                            {isRejected && <XCircle size={12} className="text-red-400" />}
                            <span>{order.status.replace("_", " ")}</span>
                          </span>

                          <span className="font-mono text-xs text-white font-bold">
                            {order.orderId}
                          </span>

                          {order.userEmail ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-medium shadow-sm">
                              <Mail size={12} className="text-cyan-400 shrink-0" />
                              <span className="font-semibold">{order.userEmail}</span>
                              {order.userName && order.userName !== order.userEmail && (
                                <span className="text-cyan-400/70 font-sans text-[11px]">({order.userName})</span>
                              )}
                            </span>
                          ) : order.userId ? (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                              User #{order.userId}
                            </span>
                          ) : null}
                        </div>

                        <div className="text-xs text-slate-400 font-mono">
                          {new Date(order.createdAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                      </div>

                      {/* Main Data: Amount, Credits, UTR, User Email & Actions */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-center">
                        <div>
                          <div className="text-[11px] text-slate-400">Total Payable</div>
                          <div className="text-lg font-bold font-mono text-white">
                            ₹{order.amountInr}.00
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400">Credits Granted</div>
                          <div className="text-sm font-semibold font-mono text-emerald-400 flex items-center gap-1">
                            <Sparkles size={13} />
                            +{order.credits.toLocaleString()}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400">12-Digit UTR</div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono font-bold text-amber-300">
                              {order.utr || "Not yet submitted"}
                            </span>
                            {order.utr && (
                              <button
                                type="button"
                                onClick={() => handleCopy(order.utr!, order.orderId, "UTR")}
                                className="p-1 text-slate-400 hover:text-white"
                                title="Copy UTR"
                              >
                                <Copy size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400">Account Requester</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {order.userEmail ? (
                              <>
                                <span
                                  className="text-xs font-mono font-semibold text-cyan-300 truncate max-w-[170px]"
                                  title={order.userEmail}
                                >
                                  {order.userEmail}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(order.userEmail!, `upi-mail-${order.orderId}`, "User email")}
                                  className="text-slate-500 hover:text-cyan-300 p-0.5"
                                  title="Copy user email"
                                >
                                  <Copy size={11} />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs font-mono text-slate-500">User #{order.userId || "guest"}</span>
                            )}
                          </div>
                          {order.userName && order.userName !== order.userEmail && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[170px]">
                              {order.userName}
                            </div>
                          )}
                        </div>

                        {/* Admin Action Buttons or Status Badge */}
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            isAdmin ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveUpiOrder(order.orderId)}
                                  disabled={approvingOrderId === order.orderId}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 flex items-center gap-1.5 shadow-md shadow-emerald-950"
                                >
                                  {approvingOrderId === order.orderId ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                  ) : (
                                    <Check size={13} />
                                  )}
                                  <span>Approve & Credit</span>
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectUpiOrder(order.orderId)}
                                  disabled={rejectingOrderId === order.orderId}
                                  className="border-red-500/40 text-red-300 hover:bg-red-950/40 text-xs h-8 px-2.5"
                                  title="Reject order"
                                >
                                  <XCircle size={13} />
                                </Button>
                              </>
                            ) : (
                              <div className="text-xs text-amber-300 font-mono flex items-center gap-1.5 bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-500/30">
                                <Clock size={12} className="animate-pulse text-amber-400" />
                                <span>Awaiting Verification</span>
                              </div>
                            )
                          )}

                          {isCompleted && (
                            <div className="text-right">
                              <div className="text-xs text-emerald-400 font-mono flex items-center justify-end gap-1 font-semibold">
                                <CheckCircle2 size={13} /> Approved & Credited
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {order.verifiedBy ? `By ${order.verifiedBy}` : "Verified"}
                                {order.verifiedAt && ` • ${new Date(order.verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                              </div>
                            </div>
                          )}

                          {isRejected && (
                            <div className="text-xs text-red-400 font-mono text-right">
                              <div>Rejected</div>
                              {order.rejectionReason && (
                                <div className="text-[10px] text-slate-400">{order.rejectionReason}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TransactionsWorkspace;
