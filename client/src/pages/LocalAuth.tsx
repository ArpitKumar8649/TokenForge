import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { Button } from "@/components/ui/button";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { MaintenanceCountdownBanner } from "@/components/MaintenanceCountdownBanner";
import { persistSessionToken } from "@/lib/sessionToken";
import {
  isSpecialReferralCampaignCode,
  normalizeReferralCampaignCode,
} from "@shared/referrals";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { ContactAdminModal } from "@/components/ContactAdminModal";
import { PearlButton } from "@/components/ui/pearl-button";
import VapourAccent from "@/components/ui/vapour-accent";
import "../auth-refresh.css";

const CLOUDINARY_AUTH_ARTWORK = "https://res.cloudinary.com/m2xoh7ru/image/upload/f_auto,q_auto/IMG_20260904_224738.jpg";

type LocalAuthProps = { mode: "signin" | "signup" };

export default function LocalAuth({ mode }: LocalAuthProps) {
  const search = useSearch();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isContactAdminOpen, setIsContactAdminOpen] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const isSignup = mode === "signup";
  const referralCode = normalizeReferralCampaignCode(new URLSearchParams(search).get("aff"));
  const isSpecialReferralCampaign = isSpecialReferralCampaignCode(referralCode);

  const handleGitHub = () => {
    setGithubLoading(true);
    setErrorMessage(null);
    const referralQuery = referralCode ? `?aff=${encodeURIComponent(referralCode)}` : "";
    // Direct full-page navigation avoids mobile popup blockers and iframe security blocks
    window.location.assign(`/api/auth/github${referralQuery}`);
  };

  // Check URL parameters for OAuth errors
  useEffect(() => {
    const params = new URLSearchParams(search);
    const githubErr = params.get("github");
    if (githubErr) {
      if (githubErr === "account-too-new") {
        setErrorMessage("GitHub accounts must be at least 14 days old to register on TokenForge.");
      } else if (githubErr === "email-not-allowed") {
        setErrorMessage("Your GitHub account email is not allowed. Please use a verified permanent email address.");
      } else if (githubErr === "link-required") {
        setErrorMessage("An account with this email already exists. Please verify with your administrator to link GitHub.");
      } else if (githubErr === "state-error") {
        setErrorMessage("Authorization state mismatch. Please try signing in again.");
      } else if (githubErr === "failed") {
        setErrorMessage("GitHub sign-in could not be completed. Please try again.");
      }
    }
  }, [search]);

  // Listen for OAuth message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      const isAllowedOrigin =
        origin === window.location.origin ||
        origin.endsWith(".run.app") ||
        origin.includes("localhost") ||
        origin.includes("tokenforge") ||
        origin.includes("manus.space");

      if (!isAllowedOrigin) {
        return;
      }
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        if (event.data.token) {
          persistSessionToken(event.data.token);
        }
        setIsSuccess(true);
        setTimeout(() => {
          window.location.assign("/dashboard");
        }, 300);
      } else if (event.data?.type === "OAUTH_AUTH_ERROR") {
        setGithubLoading(false);
        const err = event.data.error;
        if (err === "account-too-new") {
          setErrorMessage("GitHub accounts must be at least 14 days old to register on TokenForge.");
        } else if (err === "email-not-allowed") {
          setErrorMessage("Your GitHub account email is not allowed. Please use a verified permanent email address.");
        } else if (err === "link-required") {
          setErrorMessage("An account with this email already exists. Please verify with your administrator to link GitHub.");
        } else if (err === "state-error") {
          setErrorMessage("Authorization state mismatch. Please try signing in again.");
        } else {
          setErrorMessage("GitHub sign-in could not be completed. Please try again.");
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Handle URL query errors from direct redirects
  useEffect(() => {
    const githubError = new URLSearchParams(search).get("github");
    if (!githubError) return;
    if (githubError === "account-too-new") {
      setErrorMessage("GitHub accounts must be at least 14 days old to register on TokenForge.");
    } else if (githubError === "email-not-allowed") {
      setErrorMessage("Your GitHub account email is not allowed. Please use a verified permanent email address.");
    } else if (githubError === "link-required") {
      setErrorMessage("An account with this email already exists. Please contact administrator to link your account.");
    } else if (githubError === "state-error") {
      setErrorMessage("Authorization state mismatch. Please try signing in again.");
    } else if (githubError === "failed") {
      setErrorMessage("GitHub sign-in could not be completed. Please try again.");
    }
  }, [search]);

  return (
    <>
      <AnnouncementBanner /><MaintenanceCountdownBanner /><main className="local-auth-page">
        <section className="local-auth-showcase" aria-label="TokenForge workspace introduction">
          <Link href="/" className="local-auth-brand">
            <TokenForgeGlyph className="local-auth-brand__glyph" />
            <span>Token<span>Forge</span></span>
          </Link>
          <div className="local-auth-showcase__center">
            <div className="local-auth-artwork-wrap">
              <div className="local-auth-artwork__glow" aria-hidden="true" />
              <img
                src="/manus-storage/tokenforge-auth-ghost_e3dbdc71.jpg"
                alt="TokenForge developer workspace"
                className="local-auth-artwork"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = CLOUDINARY_AUTH_ARTWORK;
                }}
              />
            </div>
            <div className="local-auth-intro__copy">
              <p className="demo-kicker"><span /> SECURE DEVELOPER ACCESS</p>
              <h1>
                One trusted path to
                <VapourAccent
                  texts={["your workspace.", "verified models.", "secure credentials."]}
                  color="#d9ff9c"
                />
              </h1>
              <p>Sign in with verified GitHub OAuth. Access verified models, manage API keys, and monitor usage effortlessly.</p>
            </div>
          </div>
          <div className="local-auth-promises">
            <div>
              <ShieldCheck size={18} />
              <span>
                <b>Verified developer identity</b>
                <small>Instant access with your permanent GitHub developer profile.</small>
              </span>
            </div>
            <div>
              <KeyRound size={18} />
              <span>
                <b>Zero password vulnerability</b>
                <small>No passwords to leak or memorize. Complete key secrecy by design.</small>
              </span>
            </div>
          </div>
        </section>

        <section className="local-auth-form-panel">
          <div className="local-auth-form-wrap">
            <div className="local-auth-form__heading">
              <p>{isSignup ? "Developer registration" : "Workspace access"}</p>
              <h2>{isSignup ? "Create your account." : "Welcome back."}</h2>
              <span>
                Continue with your verified GitHub developer account to enter your workspace.
              </span>
            </div>

            {referralCode && (
              <aside className="local-auth-referral-notice mt-4" aria-label="Referral invitation">
                <strong>{isSpecialReferralCampaign ? "Special invitation activated." : "You were invited to TokenForge."}</strong>
                <p>
                  {isSpecialReferralCampaign ? (
                    <>Verify your account to claim your <b>$150 special referral bonus</b> upon sign-in.</>
                  ) : (
                    <>Eligible new developers receive a <b>$20 referral credit</b> upon verification.</>
                  )}
                </p>
              </aside>
            )}

            <div className="mt-6 space-y-4">
              <PearlButton
                type="button"
                size="hero"
                onClick={handleGitHub}
                disabled={githubLoading || isSuccess}
                className="w-full"
                icon={
                  githubLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#ffcf8d]" />
                  ) : (
                    <svg className="h-5 w-5 fill-current text-white" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  )
                }
              >
                <span>{githubLoading ? "Connecting to GitHub…" : "Continue with GitHub"}</span>
              </PearlButton>

              <p className="text-[11px] text-[#86879a] text-center leading-relaxed">
                GitHub accounts must be at least 14 days old and require a verified permanent GitHub email address.
              </p>

              {errorMessage && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2" role="alert">
                  <span className="font-bold text-red-400 shrink-0">Error:</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {isSuccess && (
                <div className="rounded-lg border border-[#c9ff73]/30 bg-[#c9ff73]/10 p-3 text-xs text-[#c9ff73] flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>Welcome back! Entering your developer workspace…</span>
                </div>
              )}

              <div className="pt-2 flex justify-center">
                <PearlButton
                  type="button"
                  size="compact"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsContactAdminOpen(true);
                  }}
                  className="w-full"
                  label="Contact administrator"
                />
              </div>
            </div>

            <div className="mt-8 border-t border-white/8 pt-4 text-center">
              <p className="text-[11px] leading-5 text-[#86879a]">
                New accounts automatically receive <b>$50 introductory build credit</b> upon initial verification.
              </p>
              <Link href="/" className="local-auth-back mt-3 inline-block text-xs text-[#a1a3b5] hover:text-white">
                ← Back to TokenForge
              </Link>
            </div>
          </div>
        </section>
      </main>

      <ContactAdminModal
        isOpen={isContactAdminOpen}
        onClose={() => setIsContactAdminOpen(false)}
      />
    </>
  );
}
