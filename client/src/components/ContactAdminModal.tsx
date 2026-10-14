import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert,
  Mail,
  Loader2,
  X,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface ContactAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function ContactAdminModal({
  isOpen,
  onClose,
  defaultEmail = "",
}: ContactAdminModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync defaultEmail when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail);
      setIsSubmitted(false);
      setCountdown(5);
      setErrorMessage(null);
    }
  }, [isOpen, defaultEmail]);

  // 5-second countdown timer after successful submission
  useEffect(() => {
    if (!isSubmitted || !isOpen) return;

    if (countdown <= 0) {
      onClose();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted, isOpen, countdown, onClose]);

  const submitMutation = trpc.auth.submitAccessRequest.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
      setCountdown(5);
      setErrorMessage(null);
    },
    onError: (err) => {
      setErrorMessage(err.message || "Failed to submit request. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    setErrorMessage(null);
    submitMutation.mutate({ email: cleanEmail });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && !submitMutation.isPending) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#09090b] p-6 shadow-2xl text-white sm:p-7"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 rounded-lg p-1.5 text-[#86879a] hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>

          {!isSubmitted ? (
            /* Input Form State */
            <div>
              <div className="flex items-center gap-2.5 mb-2 text-[#c9ff73]">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c9ff73]/10 border border-[#c9ff73]/25">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Contact Administrator
                  </h3>
                  <p className="text-[11px] text-[#9394a5]">
                    Request or review workspace account access
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-[#a8a9bb]">
                Enter your email address below. Your request will be directly submitted to the administrator for review and provisioning.
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="contact-admin-email"
                    className="block text-xs font-semibold text-[#d4d5e2] mb-1.5 flex items-center gap-1.5"
                  >
                    <Mail size={13} className="text-[#c9ff73]" /> Email Address
                  </label>
                  <Input
                    id="contact-admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="developer@gmail.com"
                    autoFocus
                    required
                    disabled={submitMutation.isPending}
                    className="h-11 border-white/15 bg-black/35 text-sm text-white placeholder:text-[#676878] focus:border-[#c9ff73]/60 focus:ring-1 focus:ring-[#c9ff73]/60"
                  />
                  <p className="mt-1.5 text-[11px] text-[#78798c]">
                    If previously denied or awaiting review, submitting again will refresh your proposal for the administrator.
                  </p>
                </div>

                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300"
                    role="alert"
                  >
                    {errorMessage}
                  </motion.div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={submitMutation.isPending}
                    className="h-10 text-xs text-[#a4a5b8] hover:bg-white/8 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!email.trim() || submitMutation.isPending}
                    className="h-10 bg-[#c9ff73] text-xs font-bold text-[#15200c] hover:bg-[#d8ff91] shadow-md transition-all flex items-center gap-2"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting request…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Submit Request
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* Success State with Animated Tick & Auto-closing Countdown */
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="py-4 text-center"
            >
              {/* Spring Animated Tick Graphic */}
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#c9ff73]/15 text-[#c9ff73] border border-[#c9ff73]/30 shadow-[0_0_30px_rgba(201,255,115,0.28)]"
              >
                <svg
                  className="h-10 w-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.polyline
                    points="20 6 9 17 4 12"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 }}
                  />
                </svg>
              </motion.div>

              <h3 className="mt-5 text-lg font-bold text-white">
                Request Sent to Administrator
              </h3>

              <div className="mt-3 rounded-xl border border-[#c9ff73]/20 bg-[#c9ff73]/10 p-4 text-xs font-medium text-[#c9ff73] leading-relaxed">
                Administrator will give access soon , try login again after some time
              </div>

              <div className="mt-2 text-[11px] text-[#8e8f9f] font-mono">
                Account: <span className="text-white">{email}</span>
              </div>

              {/* Countdown Indicator */}
              <div className="mt-6 flex flex-col items-center justify-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-xs text-[#a5a6b7]">
                  <Clock size={13} className="text-[#c9ff73] animate-pulse" />
                  <span>
                    Closing in <b className="text-white font-mono">{countdown}</b> secs...
                  </span>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-36 h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full bg-[#c9ff73]"
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 5, ease: "linear" }}
                  />
                </div>
              </div>

              <div className="mt-5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="h-8 border-white/15 bg-transparent text-xs text-[#b8b9c9] hover:bg-white/8 hover:text-white"
                >
                  Close now
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
