import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  QrCode,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  X,
  Sparkles,
  Smartphone,
  IndianRupee,
  Zap,
  Check,
  Lock,
  Wallet,
  ArrowRight,
  Info,
  CreditCard,
  Radio,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { UPI_TIERS, CRYPTO_TIERS, CODING_PLAN_TIERS, getCodingPlanTier, USD_TO_INR_RATE, type UPITier, type CryptoTier, type CodingPlanTier } from "@shared/paymentTiers";

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRail?: "crypto" | "upi" | "card";
  initialPackageUsd?: number;
  initialAmountSol?: number;
  userId?: number;
  isPayg?: boolean;
  isCodingPlan?: boolean;
  codingPlanTierId?: string;
  codingTokens?: number;
  planName?: string;
  onSuccess?: (details: any) => void;
}

interface SolanaOrderData {
  order_id: string;
  usd_amount: number;
  sol_amount: number;
  amount_sol: number;
  sol_usd_price: number;
  solana_pay_url: string;
  reference_pubkey: string;
  merchant_pubkey: string;
  expires_in_seconds: number;
  created_at?: string;
  status?: string;
}

interface UPIOrderData {
  order_id: string;
  amount_inr: number;
  credits: number;
  credits_nanos?: number;
  upi_id: string;
  upi_uri: string;
  direct_upi_uri?: string;
  dynamic_upi_uri?: string;
  is_direct_amount?: boolean;
  status: "PENDING_PAYMENT" | "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED" | "EXPIRED";
  expires_at?: string;
}

type CardPackageId = "starter" | "pro" | "max" | "power" | "ultra";

const CRYPTO_PACKAGES = [
  { usd: 10, label: "Starter", credits: 3000, popular: false },
  { usd: 25, label: "Pro", credits: 8500, popular: true },
  { usd: 50, label: "Max", credits: 18000, popular: false },
  { usd: 100, label: "Power", credits: 40000, popular: false },
  { usd: 200, label: "Ultra", credits: 100000, popular: false },
];

export const CARD_PACKAGES = [
  { id: "starter" as CardPackageId, usd: 10, label: "Starter", credits: 3000, popular: false, desc: "Testing, prototypes & scripts" },
  { id: "pro" as CardPackageId, usd: 25, label: "Pro", credits: 8500, popular: true, desc: "Active builders & pipelines" },
  { id: "max" as CardPackageId, usd: 50, label: "Max", credits: 18000, popular: false, desc: "High-throughput compute" },
  { id: "power" as CardPackageId, usd: 100, label: "Power", credits: 40000, popular: false, desc: "High-volume pipelines & team compute" },
  { id: "ultra" as CardPackageId, usd: 200, label: "Ultra", credits: 100000, popular: false, desc: "Maximum enterprise throughput & agents" },
];

export function CheckoutModal({
  isOpen,
  onClose,
  initialRail = "crypto",
  initialPackageUsd = 25,
  initialAmountSol,
  userId,
  isPayg = false,
  isCodingPlan = false,
  codingPlanTierId,
  codingTokens,
  planName,
  onSuccess,
}: CheckoutModalProps) {
  const [activeRail, setActiveRail] = useState<"crypto" | "upi" | "card">(initialRail);
  const [mounted, setMounted] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const matchedCodingPlan = isCodingPlan ? (getCodingPlanTier(codingPlanTierId || initialPackageUsd) || CODING_PLAN_TIERS[0]) : undefined;

  // Sync initialRail if changed
  useEffect(() => {
    if (isOpen) {
      if (initialRail) {
        setActiveRail(initialRail);
      }
      if (initialPackageUsd) {
        setSelectedUsd(initialPackageUsd);
        const matchedUpi = isCodingPlan && matchedCodingPlan
          ? {
              id: matchedCodingPlan.id,
              name: matchedCodingPlan.name,
              amountUsd: matchedCodingPlan.amountUsd,
              amountInr: matchedCodingPlan.amountInr,
              scanAmountUsd: matchedCodingPlan.scanAmountUsd,
              scanAmountInr: matchedCodingPlan.scanAmountInr,
              credits: matchedCodingPlan.tokensMillions,
              creditsNanos: matchedCodingPlan.tokens,
              description: matchedCodingPlan.description,
            }
          : UPI_TIERS.find((t) => t.amountUsd === initialPackageUsd);
        if (matchedUpi) {
          setSelectedUpiTier(matchedUpi);
        }
        const matchedCard = CARD_PACKAGES.find((c) => c.usd === initialPackageUsd);
        if (matchedCard) {
          setSelectedCardPackage(matchedCard.id as CardPackageId);
        }
      }
    }
  }, [isOpen, initialRail, initialPackageUsd, isCodingPlan, codingPlanTierId]);

  // ---------------------------------------------------------------------------
  // Card Payment State
  // ---------------------------------------------------------------------------
  const [selectedCardPackage, setSelectedCardPackage] = useState<CardPackageId>("starter");
  const [isCardLoading, setIsCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handleCardCheckout = async (planKey?: CardPackageId) => {
    const targetPlan = planKey || selectedCardPackage;
    const planUsd = CARD_PACKAGES.find((c) => c.id === targetPlan)?.usd ?? 25;
    try {
      setIsCardLoading(true);
      setCardError(null);
      const res = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: targetPlan,
          user_id: userId || 1,
          is_payg: isPayg,
          amount_usd: planUsd,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error || "Failed to create checkout session");
      }
      window.location.href = data.checkout_url;
    } catch (err: any) {
      setCardError(err?.message || "Could not initialize card checkout.");
      toast.error(err?.message || "Could not initialize card checkout.");
    } finally {
      setIsCardLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Solana Pay State
  // ---------------------------------------------------------------------------
  const [selectedUsd, setSelectedUsd] = useState<number>(initialPackageUsd);
  const [solOrder, setSolOrder] = useState<SolanaOrderData | null>(null);
  const [solLivePrice, setSolLivePrice] = useState<number>(105.0);
  const [isLoadingSolOrder, setIsLoadingSolOrder] = useState(false);
  const [solOrderError, setSolOrderError] = useState<string | null>(null);
  const [solVerificationStatus, setSolVerificationStatus] = useState<
    "IDLE" | "POLLING" | "CONFIRMED" | "EXPIRED" | "FAILED"
  >("IDLE");
  const [solConfirmedSignature, setSolConfirmedSignature] = useState<string | null>(null);
  const [solSecondsRemaining, setSolSecondsRemaining] = useState<number>(600); // 10 minutes lock
  const [isPhantomSending, setIsPhantomSending] = useState(false);
  const [phantomError, setPhantomError] = useState<string | null>(null);

  const solPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const solCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------------------------------------------------------------------
  // Domestic UPI State
  // ---------------------------------------------------------------------------
  const [selectedUpiTier, setSelectedUpiTier] = useState<UPITier>(UPI_TIERS[1]); // ₹499 Developer default
  const [upiGatewayMode, setUpiGatewayMode] = useState<"cashfree" | "manual">("manual"); // Direct UPI P2P default (Cashfree under maintenance)
  const [upiOrder, setUpiOrder] = useState<UPIOrderData | null>(null);
  const [isLoadingUpiOrder, setIsLoadingUpiOrder] = useState(false);
  const [upiOrderError, setUpiOrderError] = useState<string | null>(null);
  const [forceDirectUpi, setForceDirectUpi] = useState<boolean | null>(null);
  const [enteredUtr, setEnteredUtr] = useState("");
  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [upiStatus, setUpiStatus] = useState<
    "PAY" | "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED"
  >("PAY");
  const [isCheckingUpiStatus, setIsCheckingUpiStatus] = useState(false);
  const upiPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cashfree specific state
  const [cashfreeOrder, setCashfreeOrder] = useState<{
    order_id: string;
    cf_order_id?: string;
    payment_session_id?: string;
    amount_inr: number;
    amount_usd: number;
    credits: number;
  } | null>(null);
  const [isLoadingCashfree, setIsLoadingCashfree] = useState(false);
  const [cashfreeError, setCashfreeError] = useState<string | null>(null);
  const [cashfreeStatus, setCashfreeStatus] = useState<"IDLE" | "CHECKING" | "PAID" | "FAILED">("IDLE");
  const cashfreePollRef = useRef<NodeJS.Timeout | null>(null);

  const utils = trpc.useUtils();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(label);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // ---------------------------------------------------------------------------
  // Solana Pay Logic
  // ---------------------------------------------------------------------------
  const fetchSolLivePrice = useCallback(async () => {
    try {
      const res = await fetch("/api/solana-pay/price");
      if (res.ok) {
        const data = await res.json();
        if (data.sol_usd_price) {
          setSolLivePrice(data.sol_usd_price);
        }
      }
    } catch (err) {
      console.debug("Failed to fetch live SOL price:", err);
    }
  }, []);

  const createSolOrder = useCallback(async () => {
    setIsLoadingSolOrder(true);
    setSolOrderError(null);
    setSolVerificationStatus("IDLE");
    setSolConfirmedSignature(null);
    setPhantomError(null);

    if (solPollIntervalRef.current) clearInterval(solPollIntervalRef.current);
    if (solCountdownIntervalRef.current) clearInterval(solCountdownIntervalRef.current);

    try {
      const matchedCoding = isCodingPlan ? (getCodingPlanTier(codingPlanTierId || selectedUsd) || CODING_PLAN_TIERS[0]) : undefined;
      const res = await fetch("/api/solana-pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          usd_amount: matchedCoding ? matchedCoding.amountUsd : selectedUsd,
          package_usd: matchedCoding ? matchedCoding.amountUsd : selectedUsd,
          tier_id: matchedCoding?.id,
          amount_sol: initialAmountSol,
          is_payg: isPayg,
          is_coding_plan: isCodingPlan,
          label: isCodingPlan ? "TokenForge Coding Plan" : isPayg ? "TokenForge PAYG" : "TokenForge",
          message: isCodingPlan ? `${matchedCoding?.tokensMillions || 250}M Coding Tokens` : isPayg ? `PAYG Deposit $${selectedUsd}` : "API Credits",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.details || `Failed with HTTP ${res.status}`);
      }

      const data: SolanaOrderData = await res.json();
      setSolOrder(data);
      if (data.sol_usd_price) {
        setSolLivePrice(data.sol_usd_price);
      }
      setSolSecondsRemaining(data.expires_in_seconds || 600);
      setSolVerificationStatus("POLLING");
    } catch (err: any) {
      console.error("Solana order creation failed:", err);
      setSolOrderError(err.message || "Failed to create Solana Pay order");
    } finally {
      setIsLoadingSolOrder(false);
    }
  }, [userId, selectedUsd, initialAmountSol]);

  // Solana Countdown timer
  useEffect(() => {
    if (activeRail !== "crypto" || !isOpen || solVerificationStatus !== "POLLING" || !solOrder) {
      if (solCountdownIntervalRef.current) clearInterval(solCountdownIntervalRef.current);
      return;
    }

    solCountdownIntervalRef.current = setInterval(() => {
      setSolSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (solCountdownIntervalRef.current) clearInterval(solCountdownIntervalRef.current);
          if (solPollIntervalRef.current) clearInterval(solPollIntervalRef.current);
          setSolVerificationStatus("EXPIRED");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (solCountdownIntervalRef.current) clearInterval(solCountdownIntervalRef.current);
    };
  }, [activeRail, isOpen, solVerificationStatus, solOrder]);

  // Solana 1.5s Polling
  useEffect(() => {
    if (activeRail !== "crypto" || !isOpen || !solOrder || solVerificationStatus !== "POLLING") {
      if (solPollIntervalRef.current) clearInterval(solPollIntervalRef.current);
      return;
    }

    const checkVerification = async () => {
      try {
        const res = await fetch("/api/solana-pay/verify-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: solOrder.order_id,
            reference_pubkey: solOrder.reference_pubkey,
          }),
        });

        const result = await res.json().catch(() => ({}));

        if (res.ok && (result.status === "PAID" || result.status === "COMPLETED")) {
          if (solPollIntervalRef.current) clearInterval(solPollIntervalRef.current);
          if (solCountdownIntervalRef.current) clearInterval(solCountdownIntervalRef.current);

          setSolConfirmedSignature(result.signature);
          setSolVerificationStatus("CONFIRMED");
          toast.success("Payment Confirmed! Your API credits have been added.");

          (utils as any)?.creditAccounts?.getMyAccount?.invalidate?.();
          if (onSuccess) onSuccess(result.signature);
        } else if (result.status === "EXPIRED") {
          if (solPollIntervalRef.current) clearInterval(solPollIntervalRef.current);
          setSolVerificationStatus("EXPIRED");
        }
      } catch (e) {
        console.debug("Solana Pay polling tick:", e);
      }
    };

    checkVerification();
    solPollIntervalRef.current = setInterval(checkVerification, 1500);

    return () => {
      if (solPollIntervalRef.current) clearInterval(solPollIntervalRef.current);
    };
  }, [activeRail, isOpen, solOrder, solVerificationStatus, utils, onSuccess]);

  // Phantom Wallet 1-Click Pay
  const handlePhantomPay = async () => {
    if (!solOrder) return;
    setPhantomError(null);
    setIsPhantomSending(true);

    try {
      const solana = (window as any).solana;
      if (!solana || !solana.isPhantom) {
        window.open("https://phantom.app/", "_blank");
        throw new Error("Phantom wallet not found. Please install Phantom or scan the QR code.");
      }

      await solana.connect();
      const senderPubkey = solana.publicKey;
      const merchantPubkey = new PublicKey(solOrder.merchant_pubkey);
      const referencePubkey = new PublicKey(solOrder.reference_pubkey);

      const lamports = Math.round(solOrder.sol_amount * LAMPORTS_PER_SOL);
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderPubkey;

      const transferInstruction = SystemProgram.transfer({
        fromPubkey: senderPubkey,
        toPubkey: merchantPubkey,
        lamports,
      });
      transferInstruction.keys.push({
        pubkey: referencePubkey,
        isSigner: false,
        isWritable: false,
      });

      transaction.add(transferInstruction);
      const { signature } = await solana.signAndSendTransaction(transaction);

      toast.info("Transaction broadcast! Awaiting on-chain finality...");
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      const verifyRes = await fetch("/api/solana-pay/verify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: solOrder.order_id,
          reference_pubkey: solOrder.reference_pubkey,
        }),
      });

      if (verifyRes.ok) {
        setSolConfirmedSignature(signature);
        setSolVerificationStatus("CONFIRMED");
        toast.success("Payment Confirmed! Your API credits have been added.");
        (utils as any)?.creditAccounts?.getMyAccount?.invalidate?.();
        if (onSuccess) onSuccess(signature);
      }
    } catch (err: any) {
      console.error("Phantom payment error:", err);
      setPhantomError(err.message || "Failed to submit transaction via Phantom");
    } finally {
      setIsPhantomSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Domestic UPI Logic
  // ---------------------------------------------------------------------------
  const createUpiOrder = useCallback(async () => {
    setIsLoadingUpiOrder(true);
    setUpiOrderError(null);
    setUpiStatus("PAY");
    setEnteredUtr("");
    setUtrError(null);

    if (upiPollIntervalRef.current) clearInterval(upiPollIntervalRef.current);

    try {
      const matchedCoding = isCodingPlan ? (getCodingPlanTier(codingPlanTierId || selectedUsd) || CODING_PLAN_TIERS[0]) : undefined;
      const res = await fetch("/api/upi/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          tier_id: matchedCoding?.id || selectedUpiTier.id,
          amount_inr: matchedCoding?.scanAmountInr || selectedUpiTier.scanAmountInr,
          amount_usd: matchedCoding?.amountUsd || selectedUpiTier.amountUsd,
          credits: matchedCoding ? matchedCoding.tokensMillions : selectedUpiTier.credits,
          is_payg: isPayg,
          is_coding_plan: isCodingPlan,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error("Authentication required: Please sign in to create a UPI payment order.");
        }
        throw new Error(errJson.error || errJson.detail || `Failed with HTTP ${res.status}`);
      }

      const data: UPIOrderData = await res.json();
      setUpiOrder(data);
    } catch (err: any) {
      console.error("UPI order creation note:", err);
      setUpiOrderError(err.message || "Failed to create UPI order");
    } finally {
      setIsLoadingUpiOrder(false);
    }
  }, [userId, selectedUpiTier]);

  // Submit UTR
  const handleSubmitUtr = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!upiOrder) return;

    const cleanUtr = enteredUtr.trim();
    if (!/^\d{12}$/.test(cleanUtr)) {
      setUtrError("UTR must be exactly 12 numeric digits.");
      return;
    }

    setUtrError(null);
    setIsSubmittingUtr(true);

    try {
      const res = await fetch("/api/upi/submit-utr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: upiOrder.order_id,
          utr: cleanUtr,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || "Failed to submit UTR");
      }

      setUpiStatus("PENDING_VERIFICATION");
      toast.success("UTR submitted! Verifying against bank settlements...");
    } catch (err: any) {
      console.error("Submit UTR error:", err);
      setUtrError(err.message || "Failed to submit UTR");
      toast.error(err.message || "Failed to submit UTR");
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  // Poll for UPI Order Status when in PENDING_VERIFICATION
  useEffect(() => {
    if (activeRail !== "upi" || !isOpen || !upiOrder || upiStatus !== "PENDING_VERIFICATION") {
      if (upiPollIntervalRef.current) clearInterval(upiPollIntervalRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/upi/order-status/${upiOrder.order_id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "COMPLETED") {
            if (upiPollIntervalRef.current) clearInterval(upiPollIntervalRef.current);
            setUpiStatus("COMPLETED");
            toast.success("UPI Payment Confirmed! API credits added.");
            (utils as any)?.creditAccounts?.getMyAccount?.invalidate?.();
            if (onSuccess) onSuccess({ orderId: upiOrder.order_id, utr: enteredUtr });
          } else if (data.status === "REJECTED") {
            if (upiPollIntervalRef.current) clearInterval(upiPollIntervalRef.current);
            setUpiStatus("REJECTED");
            setUtrError(data.rejection_reason || "UTR verification was rejected.");
          }
        }
      } catch (err) {
        console.debug("UPI poll status tick:", err);
      }
    };

    checkStatus();
    upiPollIntervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (upiPollIntervalRef.current) clearInterval(upiPollIntervalRef.current);
    };
  }, [activeRail, isOpen, upiOrder, upiStatus, utils, onSuccess, enteredUtr]);

  // Manual check UPI status
  const handleManualCheckUpi = async () => {
    if (!upiOrder) return;
    setIsCheckingUpiStatus(true);
    try {
      const res = await fetch(`/api/upi/order-status/${upiOrder.order_id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "COMPLETED") {
          setUpiStatus("COMPLETED");
          toast.success("Payment verified! Credits added.");
          (utils as any)?.creditAccounts?.getMyAccount?.invalidate?.();
          if (onSuccess) onSuccess({ orderId: upiOrder.order_id, utr: enteredUtr });
        } else if (data.status === "PENDING_VERIFICATION") {
          toast.info("Still awaiting bank confirmation (typically 2-5 mins).");
        } else if (data.status === "REJECTED") {
          setUpiStatus("REJECTED");
          setUtrError(data.rejection_reason || "Payment rejected.");
        }
      }
    } catch {
      toast.error("Network error while checking order status.");
    } finally {
      setIsCheckingUpiStatus(false);
    }
  };

  // Create Cashfree Order
  const createCashfreeOrder = useCallback(async () => {
    setIsLoadingCashfree(true);
    setCashfreeError(null);
    setCashfreeStatus("IDLE");

    try {
      const res = await fetch("/api/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier_id: selectedUpiTier.id,
          user_id: userId,
          is_payg: isPayg,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (res.status === 401) {
          throw new Error("Authentication required: Please sign in to create an order.");
        }
        throw new Error(data.error || data.detail?.message || data.detail || "Failed to create Cashfree order");
      }

      const orderData = data.order || data;
      if (!orderData || !orderData.payment_session_id) {
        throw new Error("Invalid order response received from Cashfree gateway");
      }

      setCashfreeOrder(orderData);
      return orderData;
    } catch (err: any) {
      console.error("Cashfree order creation error:", err);
      const msg = err.message || "Failed to initialize Cashfree gateway.";
      setCashfreeError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsLoadingCashfree(false);
    }
  }, [selectedUpiTier, userId, isPayg]);

  // Launch Cashfree SDK checkout modal
  const handleLaunchCashfreeCheckout = async () => {
    let currentOrder = cashfreeOrder;
    if (!currentOrder || !currentOrder.payment_session_id) {
      currentOrder = await createCashfreeOrder();
    }

    if (!currentOrder || !currentOrder.payment_session_id) {
      toast.error(cashfreeError || "Could not obtain payment session from Cashfree.");
      return;
    }

    const sessionId = currentOrder.payment_session_id;
    const targetOrderId = currentOrder.order_id;

    try {
      let CashfreeSDK = (window as any).Cashfree;
      if (typeof CashfreeSDK !== "function") {
        // Wait or load dynamically
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[src*="cashfree.js"]');
          if (existing) {
            existing.addEventListener("load", () => resolve());
            setTimeout(() => {
              if (typeof (window as any).Cashfree === "function") resolve();
              else reject(new Error("Cashfree SDK failed to initialize."));
            }, 1000);
          } else {
            const script = document.createElement("script");
            script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Cashfree script."));
            document.head.appendChild(script);
          }
        });
        CashfreeSDK = (window as any).Cashfree;
      }

      if (typeof CashfreeSDK !== "function") {
        throw new Error("Cashfree SDK is not available. Please check your network connection.");
      }

      // Initialize Cashfree in sandbox mode
      const cashfree = CashfreeSDK({
        mode: "sandbox",
      });

      setCashfreeStatus("CHECKING");

      cashfree.checkout({
        paymentSessionId: sessionId,
        redirectTarget: "_modal",
      }).then((result: any) => {
        if (result.error) {
          console.error("Cashfree checkout error:", result.error);
          toast.error(result.error.message || "Cashfree payment failed or cancelled.");
          setCashfreeStatus("FAILED");
        }
        if (result.paymentDetails) {
          console.log("Cashfree paymentDetails received:", result.paymentDetails);
        }
        // Poll order status to verify settlement immediately
        pollCashfreeOrderStatus(targetOrderId);
      }).catch((err: any) => {
        console.error("Cashfree checkout catch:", err);
        pollCashfreeOrderStatus(targetOrderId);
      });
    } catch (err: any) {
      console.error("Error triggering Cashfree modal:", err);
      toast.error(err.message || "Error opening Cashfree payment gateway.");
    }
  };

  // Poll Cashfree Order Status
  const pollCashfreeOrderStatus = useCallback(async (orderIdToPoll?: string) => {
    const targetOrderId = orderIdToPoll || cashfreeOrder?.order_id;
    if (!targetOrderId) return;

    setCashfreeStatus("CHECKING");

    try {
      const res = await fetch(`/api/cashfree/order-status/${targetOrderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "PAID") {
          if (cashfreePollRef.current) clearInterval(cashfreePollRef.current);
          setCashfreeStatus("PAID");
          toast.success("Cashfree Payment Verified! Credits granted automatically.");
          (utils as any)?.creditAccounts?.getMyAccount?.invalidate?.();
          if (onSuccess) onSuccess({ orderId: targetOrderId, gateway: "cashfree" });
          return;
        } else if (data.status === "EXPIRED") {
          setCashfreeStatus("FAILED");
          setCashfreeError("Order session expired. Please generate a new one.");
        }
      }
    } catch (err) {
      console.debug("Cashfree status tick error:", err);
    }
  }, [cashfreeOrder, utils, onSuccess]);

  // Polling loop when checking Cashfree status
  useEffect(() => {
    if (activeRail !== "upi" || upiGatewayMode !== "cashfree" || !isOpen || !cashfreeOrder || cashfreeStatus !== "CHECKING") {
      if (cashfreePollRef.current) clearInterval(cashfreePollRef.current);
      return;
    }

    cashfreePollRef.current = setInterval(() => {
      pollCashfreeOrderStatus();
    }, 2500);

    return () => {
      if (cashfreePollRef.current) clearInterval(cashfreePollRef.current);
    };
  }, [activeRail, upiGatewayMode, isOpen, cashfreeOrder, cashfreeStatus, pollCashfreeOrderStatus]);

  // Trigger order creation when modal opens or rail/tier changes
  useEffect(() => {
    if (isOpen) {
      if (activeRail === "crypto") {
        fetchSolLivePrice();
        createSolOrder();
      } else {
        createUpiOrder();
        createCashfreeOrder();
      }
    } else {
      if (solPollIntervalRef.current) clearInterval(solPollIntervalRef.current);
      if (solCountdownIntervalRef.current) clearInterval(solCountdownIntervalRef.current);
      if (upiPollIntervalRef.current) clearInterval(upiPollIntervalRef.current);
      if (cashfreePollRef.current) clearInterval(cashfreePollRef.current);
      setSolOrder(null);
      setUpiOrder(null);
      setCashfreeOrder(null);
      setSolVerificationStatus("IDLE");
      setUpiStatus("PAY");
      setCashfreeStatus("IDLE");
      setEnteredUtr("");
      setUtrError(null);
      setCashfreeError(null);
      setForceDirectUpi(null);
    }
  }, [isOpen, activeRail, selectedUsd, selectedUpiTier, createCashfreeOrder]);

  if (!isOpen || !mounted) return null;

  const minutes = Math.floor(solSecondsRemaining / 60);
  const seconds = solSecondsRemaining % 60;
  const formattedCountdown = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-[#09090b] border border-white/[0.12] rounded-3xl shadow-2xl shadow-black/90 overflow-hidden text-neutral-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle sleek ambient glow - Apple-style subdued warmth */}
        <div className="absolute -top-32 -right-32 w-72 h-72 bg-rose-500/[0.07] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-rose-500/[0.05] rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Bar */}
        <div className="relative px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-lg ${
              isCodingPlan
                ? "bg-gradient-to-tr from-cyan-500 to-blue-500 shadow-cyan-500/25"
                : isPayg
                ? "bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-emerald-500/25"
                : "bg-gradient-to-tr from-rose-500 to-pink-500 shadow-rose-500/25"
            }`}>
              <Zap size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                {isCodingPlan
                  ? `Coding Plan: ${matchedCodingPlan?.tokensMillions || 250}M Tokens ($${matchedCodingPlan?.amountUsd || 25})`
                  : isPayg
                  ? "Deposit Developer Compute Balance"
                  : "Top Up API Compute Units"}
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-medium ${
                  isCodingPlan
                    ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                    : isPayg
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/15 border border-rose-500/30 text-rose-300"
                }`}>
                  {isCodingPlan ? `${matchedCodingPlan?.tokensMillions || 250}M Tokens` : isPayg ? "+100% Bonus (2x)" : "Zero Fee"}
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                {isCodingPlan
                  ? `Instant ${matchedCodingPlan?.tokensMillions || 250} Million tokens allocated directly to your coding allowance.`
                  : isPayg
                  ? "Deposit compute balance directly. Every recharge receives a 100% bonus (2x compute grant) for official model rates."
                  : "Instant compute allocation with high-availability multi-rail settlement"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.1] transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tri-Rail Navigation Tabs - Card, Direct UPI, and Solana Pay */}
        <div className="relative p-1.5 mx-5 mt-4 bg-[#141417] border border-white/[0.08] rounded-2xl grid grid-cols-3 gap-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveRail("card")}
            className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl transition-all cursor-pointer ${
              activeRail === "card"
                ? "bg-[#222227] text-white shadow-sm border border-amber-500/40 font-semibold"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            <CreditCard size={15} className={activeRail === "card" ? "text-amber-400" : "text-neutral-500"} />
            <div className="text-left leading-tight hidden xs:block sm:block">
              <div className="flex items-center gap-1">
                <span className="tracking-tight">Card ($)</span>
                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  MAINTENANCE
                </span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-amber-300/80 font-normal">Under Maintenance</div>
            </div>
            <span className="xs:hidden sm:hidden text-xs font-semibold">Card</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRail("upi")}
            className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl transition-all cursor-pointer ${
              activeRail === "upi"
                ? "bg-[#222227] text-white shadow-sm border border-emerald-500/30 font-semibold"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            <Smartphone size={15} className={activeRail === "upi" ? "text-emerald-400" : "text-neutral-400"} />
            <div className="text-left leading-tight hidden xs:block sm:block">
              <div className="flex items-center gap-1">
                <span className="tracking-tight">UPI (₹)</span>
                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  ACTIVE
                </span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-emerald-300/80 font-normal">Direct P2P QR</div>
            </div>
            <span className="xs:hidden sm:hidden text-xs font-semibold">UPI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRail("crypto")}
            className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl transition-all cursor-pointer ${
              activeRail === "crypto"
                ? "bg-[#222227] text-white shadow-sm border border-rose-500/30 font-semibold"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            <Wallet size={15} className={activeRail === "crypto" ? "text-rose-400" : "text-neutral-400"} />
            <div className="text-left leading-tight hidden xs:block sm:block">
              <div className="flex items-center gap-1">
                <span className="tracking-tight">Solana Pay ($)</span>
                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                  ACTIVE
                </span>
              </div>
              <div className="text-[9px] sm:text-[10px] text-rose-300/80 font-normal">SOL & USDC</div>
            </div>
            <span className="xs:hidden sm:hidden text-xs font-semibold">Solana</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="relative p-5 overflow-y-auto space-y-4">
          {/* ================================================================ */}
          {/* TAB 0: CREDIT / DEBIT CARD (DODO PAYMENTS / GLOBAL)             */}
          {/* ================================================================ */}
          {activeRail === "card" && (
            <div className="space-y-4">
              {/* Maintenance Notice */}
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <AlertCircle size={16} className="text-amber-400 shrink-0" />
                  <span>Card Payments Under Maintenance</span>
                </div>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  International credit & debit card billing (Visa, Mastercard, Amex, Apple Pay) is temporarily offline for scheduled gateway maintenance. Please use <strong className="text-emerald-400">Domestic UPI (₹)</strong> or <strong className="text-purple-400">Solana Pay ($)</strong> for instant credit delivery.
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveRail("upi")}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-medium text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Smartphone size={13} />
                    <span>Pay via Domestic UPI (₹)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRail("crypto")}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-medium text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Wallet size={13} />
                    <span>Pay via Solana Pay ($)</span>
                  </button>
                </div>
              </div>

              {/* Package selector */}
              <div>
                <label className="text-xs font-semibold uppercase text-neutral-400 tracking-wider mb-2.5 block">
                  {isPayg ? "Deposit Amount Preview" : "Card Package Preview"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 opacity-60">
                  {CARD_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedCardPackage(pkg.id as CardPackageId)}
                      className={`relative py-3.5 px-2 rounded-2xl text-center border text-xs font-semibold transition-all cursor-pointer ${
                        selectedCardPackage === pkg.id
                          ? "bg-[#222227] border-amber-500/50 text-white"
                          : "bg-[#121215] border-white/[0.07] text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                      }`}
                    >
                      {pkg.popular && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] text-white font-mono px-2 py-0.5 rounded-full whitespace-nowrap font-bold shadow-sm bg-neutral-700">
                          POPULAR
                        </span>
                      )}
                      <div className="text-base font-bold text-white">${pkg.usd}</div>
                      <div className="text-[11px] font-medium mt-0.5 text-neutral-400">
                        {isPayg ? `+$${pkg.usd * 2} Credit` : `${pkg.credits.toLocaleString()} cr`}
                      </div>
                      <div className="text-[9px] font-normal text-neutral-500 mt-1">{isPayg ? "+100% Bonus" : pkg.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Package Breakdown Box */}
              {(() => {
                const activePkg = CARD_PACKAGES.find(p => p.id === selectedCardPackage) || CARD_PACKAGES[0];
                return (
                  <div className="p-4 rounded-2xl bg-[#121215] border border-white/[0.08] space-y-2.5 opacity-70">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">Total Amount</span>
                      <span className="text-base font-bold font-mono text-white">${activePkg.usd}.00 USD</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                      <span className="text-xs text-neutral-400">
                        {isPayg ? "PAYG Credit Grant (+100% Bonus)" : "Inference Credits"}
                      </span>
                      <span className="text-xs font-bold font-mono text-neutral-300">
                        {isPayg ? `+$${activePkg.usd * 2}.00 USD Balance (2x Grant)` : `+${activePkg.credits.toLocaleString()} Credits`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                      <span className="text-xs text-neutral-400">Gateway Status</span>
                      <span className="text-xs font-mono font-semibold text-amber-400 flex items-center gap-1">
                        <AlertCircle size={12} /> Under Maintenance
                      </span>
                    </div>
                  </div>
                );
              })()}

              {cardError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-400" />
                  <span>{cardError}</span>
                </div>
              )}

              <Button
                type="button"
                disabled={true}
                className="w-full py-4 text-sm font-semibold rounded-xl bg-neutral-800 border border-white/10 text-neutral-400 shadow-none flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
              >
                <AlertCircle size={16} className="text-amber-400" />
                <span>Card Payments Under Maintenance</span>
              </Button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500">
                <Lock size={12} className="text-neutral-500" />
                <span>Card gateway disabled · Please choose UPI or Solana Pay</span>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 1: SOLANA PAY (CRYPTO / GLOBAL)                             */}
          {/* ================================================================ */}
          {activeRail === "crypto" && (
            <div className="space-y-4">
              {/* Package selector */}
              <div>
                <label className="text-xs font-semibold uppercase text-neutral-400 tracking-wider mb-2.5 block">
                  {isPayg ? "Select Deposit Amount" : "Select USD Package"}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CRYPTO_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.usd}
                      type="button"
                      onClick={() => setSelectedUsd(pkg.usd)}
                      className={`relative py-3 px-1.5 rounded-2xl text-center border text-xs font-semibold transition-all cursor-pointer ${
                        selectedUsd === pkg.usd
                          ? isPayg
                            ? "bg-gradient-to-b from-emerald-500/20 to-emerald-950/40 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/40"
                            : "bg-gradient-to-b from-rose-500/20 to-rose-950/40 border-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.18)] ring-1 ring-rose-500/40"
                          : "bg-[#121215] border-white/[0.07] text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                      }`}
                    >
                      {pkg.popular && (
                        <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] text-white font-mono px-2 py-0.5 rounded-full whitespace-nowrap font-bold shadow-sm ${
                          isPayg ? "bg-emerald-600" : "bg-gradient-to-r from-rose-500 to-pink-500"
                        }`}>
                          POPULAR
                        </span>
                      )}
                      <div className="text-sm font-bold text-white">${pkg.usd}</div>
                      <div className={`text-[10px] font-medium ${isPayg ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPayg ? `+$${pkg.usd * 2} Credit` : `${pkg.credits.toLocaleString()} cr`}
                      </div>
                      <div className="text-[9px] font-normal text-neutral-400">{isPayg ? "+100% Bonus" : pkg.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Solana Pay Screen based on status */}
              {solVerificationStatus === "CONFIRMED" ? (
                <div className="p-6 rounded-2xl bg-[#121215] border border-rose-500/30 text-center space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30 shadow-lg shadow-rose-500/20">
                    <CheckCircle2 size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Payment Confirmed!</h3>
                  <p className="text-xs text-neutral-300">
                    {isPayg ? (
                      <>
                        Your on-chain Solana Pay deposit was verified by Helius RPC.{" "}
                        <span className="text-emerald-400 font-semibold font-mono">
                          +${selectedUsd * 2}.00 USD
                        </span>{" "}
                        has been added to your Pay-As-You-Go balance (${selectedUsd} deposit + ${selectedUsd} 100% bonus) to use on official model rates.
                      </>
                    ) : (
                      <>
                        Your on-chain Solana Pay deposit was verified by Helius RPC.{" "}
                        <span className="text-rose-400 font-semibold font-mono">
                          +{(CRYPTO_PACKAGES.find(p => p.usd === selectedUsd)?.credits ?? selectedUsd * 200).toLocaleString()} API Credits
                        </span>{" "}
                        have been credited to your account.
                      </>
                    )}
                  </p>
                  {solConfirmedSignature && (
                    <div className="pt-2">
                      <a
                        href={`https://explorer.solana.com/tx/${solConfirmedSignature}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 underline font-mono"
                      >
                        <span>View on Solana Explorer</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                  <Button
                    onClick={onClose}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25 mt-2 rounded-xl py-2.5 cursor-pointer"
                  >
                    Done
                  </Button>
                </div>
              ) : solVerificationStatus === "EXPIRED" ? (
                <div className="p-6 rounded-2xl bg-[#121215] border border-amber-500/30 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <Clock size={28} />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">Quote Expired</h3>
                  <p className="text-xs text-neutral-400">
                    The 10-minute price lock has expired. Click below to recalculate with the latest Binance spot rate.
                  </p>
                  <Button
                    onClick={createSolOrder}
                    className="bg-rose-500 hover:bg-rose-600 text-white text-xs shadow-md shadow-rose-500/25 rounded-xl py-2.5 cursor-pointer"
                  >
                    <RefreshCw size={14} className="mr-1.5" />
                    Refresh Quote
                  </Button>
                </div>
              ) : (
                <>
                  {/* QR Card & Info */}
                  <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] flex flex-col sm:flex-row items-center gap-5">
                    {/* QR Box */}
                    <div className="bg-white p-3 rounded-2xl shadow-xl shrink-0 flex items-center justify-center">
                      {solOrder?.solana_pay_url ? (
                        <QRCodeSVG
                          value={solOrder.solana_pay_url}
                          size={150}
                          level="M"
                          includeMargin={false}
                        />
                      ) : (
                        <div className="w-[150px] h-[150px] flex items-center justify-center text-neutral-400 text-xs">
                          <RefreshCw size={24} className="animate-spin text-rose-500" />
                        </div>
                      )}
                    </div>

                    {/* Order Details */}
                    <div className="flex-1 w-full space-y-2.5 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <span className="text-neutral-400">Locked Amount</span>
                        <span className="font-mono font-bold text-white text-sm">
                          {solOrder ? `${solOrder.sol_amount} SOL` : "Calculating..."}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <span className="text-neutral-400">Value (USD)</span>
                        <span className="font-mono text-rose-400 font-semibold">${selectedUsd}.00 USD</span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <span className="text-neutral-400">{isPayg ? "Credit Grant (+100% Bonus)" : "Credits Credited"}</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {isPayg
                            ? `+$${selectedUsd * 2}.00 USD (2x Balance)`
                            : `+${(CRYPTO_PACKAGES.find(p => p.usd === selectedUsd)?.credits ?? selectedUsd * 200).toLocaleString()} Credits`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <span className="text-neutral-400">Binance Spot SOL</span>
                        <span className="font-mono text-neutral-300">${solLivePrice.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400 flex items-center gap-1">
                          <Clock size={12} className="text-amber-400" /> Quote Expires In
                        </span>
                        <span className="font-mono text-amber-300 font-semibold">{formattedCountdown}</span>
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Phantom Wallet Button */}
                  <Button
                    type="button"
                    onClick={handlePhantomPay}
                    disabled={isPhantomSending || !solOrder}
                    className="w-full bg-rose-500 hover:bg-rose-600 active:scale-[0.99] text-white font-medium shadow-lg shadow-rose-500/25 text-xs py-3 rounded-xl cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {isPhantomSending ? (
                      <>
                        <RefreshCw size={14} className="animate-spin mr-1.5" />
                        Awaiting Phantom Approval...
                      </>
                    ) : (
                      <>
                        <Wallet size={14} className="mr-1.5" />
                        Pay with Phantom Wallet (1-Click)
                      </>
                    )}
                  </Button>

                  {phantomError && (
                    <p className="text-[11px] text-rose-400 bg-rose-950/30 p-2.5 rounded-xl border border-rose-500/20">
                      {phantomError}
                    </p>
                  )}

                  {/* Manual Copy Solana Pay Link */}
                  {solOrder?.solana_pay_url && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={solOrder.solana_pay_url}
                        className="flex-1 bg-[#121215] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] font-mono text-neutral-400 truncate outline-none"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyText(solOrder.solana_pay_url, "Solana Pay Link")}
                        className="text-xs shrink-0 border-white/[0.1] bg-[#141417] hover:bg-white/[0.06] rounded-xl cursor-pointer"
                      >
                        {copiedKey === "Solana Pay Link" ? (
                          <Check size={13} className="text-rose-400" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Polling indicator */}
                  <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400 pt-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    <span>Monitoring Helius RPC on Solana Mainnet-Beta...</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: DIRECT UPI (INDIA DOMESTIC)                              */}
          {/* ================================================================ */}
          {activeRail === "upi" && (
            <div className="space-y-4">
              {/* Preset INR Tiers */}
              <div>
                <label className="text-xs font-semibold uppercase text-neutral-400 tracking-wider mb-2.5 flex items-center justify-between">
                  <span>{isPayg ? "Select UPI Deposit Amount" : "Select UPI Package"}</span>
                  <span className="text-[10px] text-rose-400 font-mono">1 USD = ₹{USD_TO_INR_RATE} INR · 0% Gateway Fees</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
                  {UPI_TIERS.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedUpiTier(tier)}
                      className={`relative py-3 px-1.5 rounded-2xl text-center border text-xs font-semibold transition-all cursor-pointer ${
                        selectedUpiTier.id === tier.id
                          ? isPayg
                            ? "bg-gradient-to-b from-emerald-500/20 to-emerald-950/40 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/40"
                            : "bg-gradient-to-b from-rose-500/20 to-rose-950/40 border-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.18)] ring-1 ring-rose-500/40"
                          : "bg-[#121215] border-white/[0.07] text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                      }`}
                    >
                      {tier.popular && (
                        <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] text-white font-mono px-2 py-0.5 rounded-full whitespace-nowrap font-bold shadow-sm ${
                          isPayg ? "bg-emerald-600" : "bg-gradient-to-r from-rose-500 to-pink-500"
                        }`}>
                          MOST POPULAR
                        </span>
                      )}
                      <div className="text-sm font-bold text-white">
                        ${tier.amountUsd}
                        {!isPayg && <span className="text-[10px] text-neutral-400 font-normal">/mo</span>}
                      </div>
                      <div className={`text-[11px] font-semibold ${isPayg ? "text-emerald-400" : "text-rose-400"}`}>
                        ₹{tier.amountInr.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {isPayg ? `+$${tier.amountUsd * 2} Credit (2x)` : `${tier.credits.toLocaleString()} Credits`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* UPI Mode Selector: Cashfree Auto-Verify vs Manual UPI (side-by-side) */}
              <div className="p-1.5 rounded-2xl bg-[#141417] border border-white/[0.08] grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setUpiGatewayMode("manual")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                    upiGatewayMode === "manual"
                      ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 text-white shadow-sm font-semibold"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02] border border-transparent"
                  }`}
                >
                  <Building2 size={14} className={upiGatewayMode === "manual" ? "text-emerald-400" : "text-neutral-500"} />
                  <div className="text-left leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">Direct UPI (P2P)</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        ACTIVE · ZERO FEE
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-300/80 font-normal">
                      Scan QR · Enter 12-Digit Ref
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUpiGatewayMode("cashfree")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                    upiGatewayMode === "cashfree"
                      ? "bg-gradient-to-r from-amber-500/20 to-neutral-800/40 border border-amber-500/40 text-white shadow-sm font-semibold"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02] border border-transparent opacity-75"
                  }`}
                >
                  <AlertCircle size={14} className={upiGatewayMode === "cashfree" ? "text-amber-400" : "text-neutral-500"} />
                  <div className="text-left leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">Cashfree UPI</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        MAINTENANCE
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-300/80 font-normal">
                      Under Maintenance
                    </div>
                  </div>
                </button>
              </div>

              {/* Cashfree Flow View */}
              {upiGatewayMode === "cashfree" && (
                <div className="space-y-3">
                  {cashfreeStatus === "PAID" ? (
                    <div className="p-6 rounded-2xl bg-[#121215] border border-emerald-500/40 text-center space-y-3 animate-in zoom-in-95 duration-200">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
                        <CheckCircle2 size={28} />
                      </div>
                      <h3 className="text-lg font-bold text-white tracking-tight">Payment Verified & Settled!</h3>
                      <p className="text-xs text-neutral-300">
                        {isPayg ? (
                          <>
                            Your Cashfree transaction of ₹{selectedUpiTier.amountInr.toLocaleString()} was successfully paid.{" "}
                            <span className="text-emerald-400 font-semibold font-mono">
                              +${selectedUpiTier.amountUsd * 2}.00 USD
                            </span>{" "}
                            has been credited to your Pay-As-You-Go balance with the 100% deposit bonus applied.
                          </>
                        ) : (
                          <>
                            Your Cashfree transaction of ₹{selectedUpiTier.amountInr.toLocaleString()} for {selectedUpiTier.name} was successfully received.{" "}
                            <span className="text-emerald-400 font-semibold font-mono">
                              +{selectedUpiTier.credits.toLocaleString()} API Credits
                            </span>{" "}
                            have been added instantly to your balance.
                          </>
                        )}
                      </p>
                      <Button
                        type="button"
                        onClick={onClose}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs py-2 px-5 rounded-xl cursor-pointer"
                      >
                        Done & Start Generating
                      </Button>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] space-y-4">
                      {/* Maintenance Banner */}
                      <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                        <div className="flex items-center gap-2 font-semibold text-amber-300">
                          <AlertCircle size={16} className="text-amber-400 shrink-0" />
                          <span>Cashfree Gateway Under Maintenance</span>
                        </div>
                        <p className="text-neutral-300 text-[11px] leading-relaxed">
                          Cashfree automated gateway is currently under maintenance before public launch. Please switch to <strong className="text-emerald-400">Direct UPI (P2P)</strong> to pay via QR Code (GPay, PhonePe, Paytm, BHIM) and submit your UTR reference for instant credit verification.
                        </p>
                        <button
                          type="button"
                          onClick={() => setUpiGatewayMode("manual")}
                          className="w-full mt-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md shadow-emerald-950"
                        >
                          <Building2 size={14} />
                          <span>Switch to Direct UPI (P2P QR & UTR)</span>
                        </button>
                      </div>

                      <div className="flex items-start justify-between gap-3 opacity-60">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">Cashfree Automated UPI Checkout</span>
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono font-medium border border-amber-500/30">
                              Under Maintenance
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 leading-relaxed">
                            Pay securely using any UPI app. Webhook auto-verification is currently paused for upgrades.
                          </p>
                        </div>
                      </div>

                      {/* Cashfree Order Summary Breakdown */}
                      <div className="bg-[#09090b] p-3.5 rounded-xl border border-white/[0.06] space-y-2 text-xs opacity-70">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">Gateway Status</span>
                          <span className="font-mono text-amber-400 font-semibold flex items-center gap-1">
                            <AlertCircle size={12} /> Temporarily Offline
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">{isPayg ? "Deposit Tier" : "Package Plan"}</span>
                          <span className="font-mono text-neutral-200 font-semibold">
                            {isPayg ? `$${selectedUpiTier.amountUsd}.00 USD PAYG` : `${selectedUpiTier.name} ($${selectedUpiTier.amountUsd} USD)`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">Total Payable INR</span>
                          <span className="font-mono text-neutral-300 font-bold text-sm">
                            ₹{selectedUpiTier.amountInr.toLocaleString()}.00
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400">{isPayg ? "Credit Grant (+100% Bonus)" : "Credits to Add"}</span>
                          <span className="font-mono text-neutral-300 font-semibold">
                            {isPayg ? `+$${selectedUpiTier.amountUsd * 2}.00 USD (2x Balance)` : `+${selectedUpiTier.credits.toLocaleString()} Credits`}
                          </span>
                        </div>
                      </div>

                      {/* Pay Button / Status - Disabled & Greyed Out */}
                      <div className="space-y-2">
                        <Button
                          type="button"
                          disabled={true}
                          className="w-full bg-neutral-800 border border-white/10 text-neutral-400 font-medium text-xs py-3.5 rounded-xl cursor-not-allowed opacity-80 flex items-center justify-center gap-2"
                        >
                          <AlertCircle size={14} className="text-amber-400" />
                          <span>Cashfree UPI Under Maintenance (Disabled)</span>
                        </Button>

                        <div className="flex items-center justify-center text-[11px] text-neutral-500 px-1 pt-1">
                          <span>Please use the Direct UPI (P2P) option above</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual UPI Flow View */}
              {upiGatewayMode === "manual" && (
                <>
                  {/* UPI State Machine Views */}
                  {upiStatus === "COMPLETED" ? (
                <div className="p-6 rounded-2xl bg-[#121215] border border-rose-500/30 text-center space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30 shadow-lg shadow-rose-500/20">
                    <CheckCircle2 size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Payment Confirmed!</h3>
                  <p className="text-xs text-neutral-300">
                    {isPayg ? (
                      <>
                        Your UPI transaction of ₹{(upiOrder?.amount_inr ?? selectedUpiTier.scanAmountInr).toLocaleString()} was verified.{" "}
                        <span className="text-emerald-400 font-semibold font-mono">
                          +${selectedUpiTier.amountUsd * 2}.00 USD
                        </span>{" "}
                        has been added to your Pay-As-You-Go balance (${selectedUpiTier.amountUsd} deposit + ${selectedUpiTier.amountUsd} 100% bonus) to use on official model rates.
                      </>
                    ) : (
                      <>
                        Your UPI transaction of ₹{(upiOrder?.amount_inr ?? selectedUpiTier.scanAmountInr).toLocaleString()} for {selectedUpiTier.name} (${selectedUpiTier.amountUsd} USD) was verified.{" "}
                        <span className="text-rose-400 font-semibold font-mono">
                          +{selectedUpiTier.credits.toLocaleString()} API Credits
                        </span>{" "}
                        have been credited to your account.
                      </>
                    )}
                  </p>
                  <Button
                    onClick={onClose}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white mt-2 shadow-lg shadow-rose-500/25 rounded-xl py-2.5 cursor-pointer"
                  >
                    Done
                  </Button>
                </div>
              ) : upiStatus === "PENDING_VERIFICATION" ? (
                <div className="p-5 rounded-2xl bg-[#121215] border border-rose-500/30 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-950 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                      <RefreshCw size={16} className="animate-spin" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">UTR Received & Verifying</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Your 12-digit UTR{" "}
                        <span className="font-mono text-rose-300 font-bold">{enteredUtr}</span> is queued for bank reconciliation.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#09090b] p-3.5 rounded-xl border border-white/[0.06] space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Order Reference</span>
                      <span className="font-mono text-neutral-200">{upiOrder?.order_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">{isPayg ? "Deposit" : "Plan"}</span>
                      <span className="font-mono text-neutral-200 font-semibold">
                        {isPayg ? `$${selectedUpiTier.amountUsd}.00 USD PAYG` : `${selectedUpiTier.name} ($${selectedUpiTier.amountUsd} USD)`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Amount on Scan</span>
                      <span className="font-mono text-rose-300 font-semibold">
                        ₹{(upiOrder?.amount_inr ?? selectedUpiTier.scanAmountInr).toLocaleString()}.00
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">{isPayg ? "Credit Grant (+100% Bonus)" : "Credits to Grant"}</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        {isPayg ? `+$${selectedUpiTier.amountUsd * 2}.00 USD (2x Balance)` : `+${selectedUpiTier.credits.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Typical Duration</span>
                      <span className="text-rose-300">2 – 5 minutes</span>
                    </div>
                  </div>

                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleManualCheckUpi}
                      disabled={isCheckingUpiStatus}
                      className="w-full text-xs border-white/[0.1] bg-[#141417] hover:bg-white/[0.06] rounded-xl cursor-pointer py-2.5"
                    >
                      <RefreshCw size={12} className={`mr-1.5 ${isCheckingUpiStatus ? "animate-spin" : ""}`} />
                      Check Status
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Dynamic or Direct UPI QR Code & Instructions */}
                  {(() => {
                    const amountInr = upiOrder?.amount_inr ?? selectedUpiTier.scanAmountInr;
                    const isDirectAmount = upiOrder?.is_direct_amount ?? (amountInr >= 4000);
                    const effectiveIsDirect = forceDirectUpi !== null ? forceDirectUpi : isDirectAmount;
                    const cleanVpa = upiOrder?.upi_id || "tokenforge@upi";
                    const cleanName = encodeURIComponent("TokenForge");
                    const activeUpiUri = effectiveIsDirect
                      ? (upiOrder?.direct_upi_uri || `upi://pay?pa=${cleanVpa}&pn=${cleanName}&cu=INR`)
                      : (upiOrder?.dynamic_upi_uri || upiOrder?.upi_uri);

                    return (
                      <div className="space-y-3">
                        {/* Notice for Direct P2P Mode */}
                        {effectiveIsDirect && (
                          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-start gap-2.5">
                            <Info size={15} className="shrink-0 text-amber-400 mt-0.5" />
                            <div className="space-y-0.5 text-[11px] leading-relaxed">
                              <span className="font-semibold text-white">Direct P2P Transfer (Bypasses ₹5k/₹10k Bank Limit):</span>
                              <p className="text-amber-200/90">
                                Indian banks enforce a ₹2,000–₹5,000 fraud cap on pre-locked dynamic QR codes. This QR opens your app in direct payee mode with standard ₹1,00,000 limits. Scan or pay to <strong className="font-mono text-white">{cleanVpa}</strong>, enter <strong className="font-mono text-white">₹{amountInr.toLocaleString()}</strong>, and enter your 12-digit UTR below.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] flex flex-col sm:flex-row items-center gap-5">
                          {/* QR Code */}
                          <div className="bg-white p-3 rounded-2xl shadow-xl shrink-0 flex flex-col items-center justify-center">
                            {activeUpiUri ? (
                              <>
                                <QRCodeSVG
                                  value={activeUpiUri}
                                  size={150}
                                  level="M"
                                  includeMargin={false}
                                />
                                <span className="text-[10px] text-neutral-800 font-bold mt-1.5 font-mono text-center">
                                  {effectiveIsDirect
                                    ? `Scan & Enter ₹${amountInr.toLocaleString()}`
                                    : `Scan to Pay ₹${amountInr.toLocaleString()}`}
                                </span>
                              </>
                            ) : (
                              <div className="w-[150px] h-[150px] flex items-center justify-center text-neutral-400 text-xs">
                                <RefreshCw size={24} className="animate-spin text-rose-500" />
                              </div>
                            )}

                            {/* Mode toggle button */}
                            <button
                              type="button"
                              onClick={() => setForceDirectUpi(!effectiveIsDirect)}
                              className="text-[9px] font-mono text-neutral-500 hover:text-rose-400 underline mt-1.5 cursor-pointer text-center"
                              title="Toggle between Direct P2P QR and Pre-filled QR"
                            >
                              {effectiveIsDirect ? "Switch to Pre-filled QR" : "Switch to Direct QR (No Limit)"}
                            </button>
                          </div>

                          {/* UPI Details */}
                          <div className="flex-1 w-full space-y-2.5 text-xs">
                            <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                              <span className="text-neutral-400">{isPayg ? "Selected Deposit" : "Selected Plan"}</span>
                              <span className="font-mono font-bold text-white text-sm">
                                {isPayg
                                  ? `$${selectedUpiTier.amountUsd}.00 USD (PAYG)`
                                  : `$${selectedUpiTier.amountUsd} / month (${selectedUpiTier.name})`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                              <div>
                                <span className="text-neutral-400 block">Amount to Pay</span>
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  {effectiveIsDirect ? "Enter in UPI App" : "Pre-filled on Scan"}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyText(String(amountInr), "Amount")}
                                className="font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer text-right"
                                title="Click to copy amount"
                              >
                                <span className="font-bold text-base">₹{amountInr.toLocaleString()}.00</span>
                                <Copy size={11} />
                              </button>
                            </div>

                            <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                              <span className="text-neutral-400">{isPayg ? "Credit Grant (+100% Bonus)" : "Credits Granted"}</span>
                              <span className="font-mono text-emerald-400 font-semibold">
                                {isPayg
                                  ? `+$${selectedUpiTier.amountUsd * 2}.00 USD (2x Balance)`
                                  : `+${selectedUpiTier.credits.toLocaleString()} Credits`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                              <span className="text-neutral-400">Merchant VPA</span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(cleanVpa, "UPI VPA")}
                                className="font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                                title="Click to copy UPI ID"
                              >
                                <span>{cleanVpa}</span>
                                <Copy size={11} />
                              </button>
                            </div>

                            {/* Deep Link to UPI App for mobile devices */}
                            {activeUpiUri && (
                              <a
                                href={activeUpiUri}
                                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 rounded-xl text-[11px] font-medium transition-colors"
                              >
                                <Smartphone size={13} />
                                <span>
                                  {effectiveIsDirect
                                    ? `Open UPI App (Enter ₹${amountInr.toLocaleString()})`
                                    : `Pay ₹${amountInr.toLocaleString()} in UPI App`}
                                </span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 12-Digit UTR Input Form */}
                  <form onSubmit={handleSubmitUtr} className="space-y-3 bg-[#121215] p-4 rounded-2xl border border-white/[0.08]">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span>Enter 12-Digit UTR / Ref Number</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            enteredUtr.length === 12
                              ? "bg-rose-950 text-rose-300 border border-rose-500/40 font-bold"
                              : "text-neutral-400 bg-white/[0.04]"
                          }`}
                        >
                          {enteredUtr.length} / 12 digits
                        </span>
                      </div>

                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={12}
                        placeholder="e.g. 423987123456"
                        value={enteredUtr}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 12);
                          setEnteredUtr(val);
                          if (utrError) setUtrError(null);
                        }}
                        className="w-full bg-[#09090b] border border-white/[0.12] focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40 rounded-xl px-4 py-3 text-sm font-mono text-white tracking-widest outline-none transition-all placeholder:text-neutral-600"
                      />

                      <p className="text-[11px] text-neutral-400 mt-1.5 flex items-start gap-1">
                        <Info size={12} className="shrink-0 mt-0.5 text-neutral-500" />
                        <span>
                          Found in payment receipt on Google Pay, PhonePe, Paytm, or your bank SMS/app.
                        </span>
                      </p>
                    </div>

                    {utrError && (
                      <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{utrError}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={enteredUtr.length !== 12 || isSubmittingUtr || !upiOrder}
                      className="w-full bg-rose-500 hover:bg-rose-600 active:scale-[0.99] text-white font-medium text-xs py-3 rounded-xl shadow-lg shadow-rose-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmittingUtr ? (
                        <>
                          <RefreshCw size={14} className="animate-spin mr-1.5" />
                          Submitting UTR...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={15} className="mr-1.5" />
                          Submit 12-Digit UTR for Verification
                        </>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>

        {/* Footer Security / Rail Guarantees */}
        <div className="relative px-6 py-3.5 bg-black/60 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-rose-400" />
            <span>Non-custodial & direct settlement</span>
          </div>
          <div className="font-mono text-[10px] text-neutral-500">
            {activeRail === "crypto" ? "SOLANA MAINNET-BETA" : "NPCI UPI SPECIFICATION"}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Backward-compatible export
export const SolanaPayCheckoutModal = CheckoutModal;
export default CheckoutModal;
