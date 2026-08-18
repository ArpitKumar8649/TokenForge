import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { Button } from "@/components/ui/button";
import { normalizeReferralCode } from "@shared/referrals";
import { Github, KeyRound, ShieldCheck } from "lucide-react";
import { Link, useSearch } from "wouter";
import "../auth-refresh.css";

type LocalAuthProps = { mode: "signin" | "signup" };

export default function LocalAuth({ mode }: LocalAuthProps) {
  const search = useSearch();
  const isSignup = mode === "signup";
  const referralCode = isSignup ? normalizeReferralCode(new URLSearchParams(search).get("aff")) : undefined;
  const referralQuery = referralCode ? `?aff=${encodeURIComponent(referralCode)}` : "";
  const githubOutcome = new URLSearchParams(window.location.search).get("github");
  const githubError = githubOutcome === "account-too-new"
    ? "For platform safety, GitHub accounts must be at least 14 days old before they can access TokenForge."
    : githubOutcome === "email-not-allowed"
      ? "Use a verified permanent GitHub email address to continue."
      : githubOutcome ? "GitHub sign-in could not be completed. Please try again." : null;

  return <main className="local-auth-page">
    <section className="local-auth-showcase" aria-label="TokenForge workspace introduction">
      <Link href="/" className="local-auth-brand"><TokenForgeGlyph className="local-auth-brand__glyph" /><span>Token<span>Forge</span></span></Link>
      <div className="local-auth-showcase__center">
        <div className="local-auth-artwork-wrap"><div className="local-auth-artwork__glow" aria-hidden="true" /><img src="/manus-storage/tokenforge-auth-ghost_e3dbdc71.jpg" alt="TokenForge ghost artwork, forging a clearer path" className="local-auth-artwork" /></div>
        <div className="local-auth-intro__copy"><p className="demo-kicker"><span /> GITHUB-VERIFIED ACCESS</p><h1>One trusted path to <em>your workspace.</em></h1><p>Continue securely with GitHub to manage keys, track credits, and work with TokenForge’s verified text-chat models.</p></div>
      </div>
      <div className="local-auth-promises"><div><ShieldCheck size={18} /><span><b>GitHub identity verification</b><small>TokenForge uses GitHub’s verified identity and email signals; repository access is never requested.</small></span></div><div><KeyRound size={18} /><span><b>Key secrecy by design</b><small>New API keys are shown once, then retained as hashes only.</small></span></div></div>
    </section>
    <section className="local-auth-form-panel"><div className="local-auth-form-wrap">
      <div className="local-auth-form__heading"><p>TokenForge access</p><h2>Continue with GitHub.</h2><span>GitHub is the only sign-in method. Accounts must be at least 14 days old and provide a verified permanent email address.</span></div>
      {isSignup && referralCode && <aside className="local-auth-referral-notice" aria-label="Referral invitation"><strong>You were invited to TokenForge.</strong><p>Continue with GitHub and we will validate this invitation. Eligible new members receive a <b>$10 referral credit</b>.</p><a href="https://discord.gg/pnsWamDbe" target="_blank" rel="noopener noreferrer">Join the TokenForge Discord community <span aria-hidden="true">↗</span></a></aside>}
      <Button type="button" className="mt-7 h-12 w-full bg-[#ffcf8d] text-[#2a1b40] hover:bg-[#ffe0ae]" onClick={() => window.location.assign(`/api/auth/github${referralQuery}`)}><Github size={18} /> Continue with GitHub</Button>
      {githubError && <p className="local-auth-error mt-3" role="alert">{githubError}</p>}
      <p className="mt-4 text-center text-[10px] leading-5 text-[#86879a]">TokenForge requests only GitHub profile and verified-email permission. It does not request repository access.</p>
      <Link href="/" className="local-auth-back">← Back to TokenForge</Link>
    </div></section>
  </main>;
}
