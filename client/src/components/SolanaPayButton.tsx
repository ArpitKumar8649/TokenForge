import { useAuth } from "@/_core/hooks/useAuth";
import React, { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { encodeURL } from "@solana/pay";
import BigNumber from "bignumber.js";
import { Sparkles, Wallet, Smartphone, CreditCard } from "lucide-react";
import { PearlButton } from "@/components/ui/pearl-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SolanaPayCheckoutModal } from "./SolanaPayCheckoutModal";

export interface SolanaPayButtonProps {
  /**
   * Amount in USDC (e.g. 10, 25, 50, 100) or SOL
   */
  amount?: number;
  /**
   * Accepted currency: USDC or SOL
   */
  currency?: "USDC" | "SOL";
  /**
   * Merchant recipient wallet address.
   * Defaults to user's specified address: 8hYwznReXFgmLcvUEg6KRoPqRmdiZU6WBRqSBqk9arYm
   */
  recipient?: string;
  /**
   * Label for the transaction in wallet
   */
  label?: string;
  /**
   * Message shown to user during approval
   */
  message?: string;
  /**
   * Optional custom button label
   */
  buttonText?: string;
  /**
   * Visual style variant
   */
  variant?: "default" | "outline" | "gradient" | "compact";
  /**
   * Extra CSS class names
   */
  className?: string;
  /**
   * Current user ID for balance crediting
   */
  userId?: number;
  /**
   * Default active tab: "card" (Credit/Debit Card), "crypto" (Solana Pay) or "upi" (Direct UPI)
   */
  initialRail?: "crypto" | "upi" | "card";
  /**
   * Callback invoked once transaction is verified on-chain
   */
  onSuccess?: (signature: string, orderId: string) => void;
}

export const DEFAULT_MERCHANT_WALLET = "CUiXiA54MjUCxF1acboThD8R2CwLsqfDidiT7RWJsD7w";
export const DEVNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Mainnet USDC mint

/**
 * SolanaPayButton:
 * Component that integrates with the @solana/pay SDK to allow users to pay for
 * API credits directly to the merchant wallet address with zero gateway fees.
 */
export function SolanaPayButton({
  amount = 25,
  currency = "SOL",
  recipient = DEFAULT_MERCHANT_WALLET,
  label = "TokenForge",
  message = "TokenForge API Credits Top-up",
  buttonText,
  variant = "gradient",
  className = "",
  userId,
  initialRail = "crypto",
  onSuccess,
}: SolanaPayButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authAlertOpen, setAuthAlertOpen] = useState(false);
  const { user } = useAuth();

  // Helper using @solana/pay SDK encodeURL for client-side generation
  const buildClientSdkSolanaPayUrl = (referencePubkey: PublicKey) => {
    try {
      const recipientPubkey = new PublicKey(recipient);
      const paymentAmount = new BigNumber(amount);
      const splToken = currency === "USDC" ? new PublicKey(DEVNET_USDC_MINT) : undefined;

      const url = encodeURL({
        recipient: recipientPubkey as any,
        amount: paymentAmount as any,
        splToken: splToken as any,
        reference: referencePubkey as any,
        label,
        message,
      } as any);

      return url.toString();
    } catch (e) {
      console.error("Failed to build client-side @solana/pay URL:", e);
      return `solana:${recipient}?amount=${amount}&label=${encodeURIComponent(label)}`;
    }
  };

  const displayText =
    buttonText ||
    (initialRail === "card"
      ? "Pay with Card"
      : initialRail === "upi"
      ? "Buy with UPI (₹)"
      : currency === "USDC"
      ? `Buy with Solana (${amount} USDC)`
      : `Buy with Solana Pay`);

  const iconElement =
    initialRail === "card" ? (
      <span className="flex items-center text-[#fda4af]">
        <CreditCard size={15} />
      </span>
    ) : initialRail === "upi" ? (
      <span className="flex items-center text-[#ffcf8d]">
        <Smartphone size={15} />
      </span>
    ) : (
      <span className="flex items-center text-[#c8ff74]">
        <Wallet size={15} />
      </span>
    );

  const badgeText = initialRail === "card" ? "Global" : initialRail === "upi" ? "Zero Fee" : "Mainnet";
  const badgeColor =
    initialRail === "card"
      ? "text-rose-300 border-rose-500/30"
      : initialRail === "upi"
      ? "text-amber-300 border-amber-500/30"
      : "text-emerald-300 border-emerald-500/30";

  return (
    <>
            <AlertDialog open={authAlertOpen} onOpenChange={setAuthAlertOpen}>
        <AlertDialogContent className="bg-[#09090b] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Authentication Required</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Please sign in to your account first to proceed with the payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => window.location.href = "/signin"} className="bg-[#befe6c] text-black hover:bg-[#befe6c]/90">
              Sign In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PearlButton
        type="button"
        size={variant === "compact" ? "compact" : "default"}
        onClick={() => { if (!user) { setAuthAlertOpen(true); return; } setIsModalOpen(true); }}
        className={`${className || ""}`}
        icon={iconElement}
      >
        <span className="flex items-center gap-2 font-medium">
          <span>{displayText}</span>
          <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 ${badgeColor} border`}>
            {badgeText}
          </span>
        </span>
      </PearlButton>

      <SolanaPayCheckoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialRail={initialRail}
        initialPackageUsd={typeof amount === "number" && amount >= 1 ? amount : 25}
        userId={userId}
        onSuccess={(details?: any) => {
          if (typeof details === "string") {
            onSuccess?.(details, "");
          } else {
            onSuccess?.(details?.signature || "", details?.orderId || "");
          }
        }}
      />
    </>
  );
}

export default SolanaPayButton;
