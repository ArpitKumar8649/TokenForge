import React, { useState } from "react";
import {
  CreditCard,
  Smartphone,
  Wallet,
  Zap,
  ShieldCheck,
  X,
  ArrowRight,
  Check,
  Sparkles,
  Percent,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PaygPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPaymentMethod: (method: "card" | "upi" | "crypto", amountUsd: number) => void;
  initialAmountUsd?: number;
}

const PRESET_AMOUNTS = [
  { amount: 10, label: "$10", popular: false },
  { amount: 25, label: "$25", popular: true },
  { amount: 50, label: "$50", popular: false },
  { amount: 100, label: "$100", popular: false },
  { amount: 200, label: "$200", popular: false },
];

export function PaygPaymentModal({
  isOpen,
  onClose,
  onSelectPaymentMethod,
  initialAmountUsd = 25,
}: PaygPaymentModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(initialAmountUsd);
  const [selectedMethod, setSelectedMethod] = useState<"card" | "upi" | "crypto">("upi");

  const creditGrant = selectedAmount * 2; // 100% deposit bonus (2x credit grant)

  const handleProceed = (method?: "card" | "upi" | "crypto") => {
    const targetMethod = method || selectedMethod;
    onSelectPaymentMethod(targetMethod, selectedAmount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl w-full bg-[#0d0d12] border border-white/10 text-white p-0 overflow-hidden shadow-2xl rounded-2xl z-50">
        {/* Modal Header Banner */}
        <div className="relative p-6 sm:p-7 border-b border-white/10 bg-gradient-to-br from-rose-950/40 via-black to-black">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              +100% Compute Bonus (2x Grant)
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Zap className="w-3 h-3 text-amber-400" /> Pay-As-You-Go
            </span>
          </div>

          <DialogTitle className="text-2xl font-bold tracking-tight text-white flex items-center justify-between">
            Deposit Developer Compute Balance
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400 mt-1.5 leading-relaxed">
            Choose your payment rail to deposit funds. Every recharge receives an instant <span className="text-emerald-300 font-semibold">100% bonus compute grant</span> (e.g. deposit ${selectedAmount} → grants ${creditGrant} usable quota) for all official model rates.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6">
          {/* Amount Selection */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Deposit Amount
              </label>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Grants ${creditGrant}.00 Usable Quota
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset.amount}
                  type="button"
                  onClick={() => setSelectedAmount(preset.amount)}
                  className={`relative py-2.5 px-2 rounded-xl text-center font-medium transition-all text-sm cursor-pointer border ${
                    selectedAmount === preset.amount
                      ? "bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/25 font-bold"
                      : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                  }`}
                >
                  {preset.popular && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.2 text-[9px] font-bold uppercase rounded-full bg-amber-400 text-black shadow-sm">
                      Best
                    </span>
                  )}
                  {preset.label}
                  <span className="block text-[10px] font-normal text-emerald-300 mt-0.5">
                    → ${preset.amount * 2}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs">
              <span className="text-slate-300">
                Deposit <strong className="text-white">${selectedAmount}.00</strong>
              </span>
              <span className="text-emerald-300 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Grants ${creditGrant}.00 Balance (+100% Bonus)
              </span>
            </div>
          </div>

          {/* Payment Rail Options */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-3">
              Choose Payment Method
            </label>

            <div className="space-y-3">
              {/* Option 1: Solana Pay */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod("crypto");
                  handleProceed("crypto");
                }}
                className={`w-full p-4 rounded-xl text-left border transition-all flex items-center justify-between gap-4 cursor-pointer group ${
                  selectedMethod === "crypto"
                    ? "bg-purple-950/30 border-purple-500/50 shadow-lg shadow-purple-950/50 ring-1 ring-purple-500/30"
                    : "bg-white/[0.03] hover:bg-white/[0.06] border-white/10"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-base">Solana Pay</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Crypto • Instant
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                      Decentralized on-chain transfer via SOL or Phantom/Solflare with immediate ledger settlement.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-purple-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Pay with SOL</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>

              {/* Option 2: Domestic UPI */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod("upi");
                  handleProceed("upi");
                }}
                className={`w-full p-4 rounded-xl text-left border transition-all flex items-center justify-between gap-4 cursor-pointer group ${
                  selectedMethod === "upi"
                    ? "bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/30"
                    : "bg-white/[0.03] hover:bg-white/[0.06] border-white/10"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-base">Domestic UPI</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Zero Fees • ₹ INR
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                      Instant QR code & UPI ID transfer via Google Pay, PhonePe, Paytm, or BHIM with UTR verification.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Pay with UPI</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>

              {/* Option 3: Card Payment (Under Maintenance) */}
              <div
                className="w-full p-4 rounded-xl text-left border bg-white/[0.02] border-white/5 opacity-60 flex items-center justify-between gap-4 cursor-not-allowed"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-400 shrink-0 border border-white/5">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-300 text-base">Card Payment</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Under Maintenance
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-snug">
                      Card processing is temporarily offline for upgrades. Please choose UPI or Solana Pay.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                  <span>Maintenance</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Security Badge */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Instant automated ledger settlement
            </span>
            <span className="text-slate-500">Credits never expire</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
