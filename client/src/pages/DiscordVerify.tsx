import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { MaintenanceCountdownBanner } from "@/components/MaintenanceCountdownBanner";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, MessageCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link, useLocation } from "wouter";

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  "not-member": {
    title: "We could not find that Discord account in the TokenForge server.",
    body: "Join the TokenForge Discord server first, then return here and run verification again. If you just joined, wait a moment for Discord to update your membership.",
  },
  failed: {
    title: "Discord could not complete the membership check.",
    body: "No access has been granted. Please try again in a moment; if the issue continues, rejoin the server and retry.",
  },
  "state-error": {
    title: "This verification link is no longer valid.",
    body: "For your protection, start the Discord verification step again from this page.",
  },
  "already-linked": {
    title: "This Discord account is already linked to another TokenForge account.",
    body: "Each Discord account can be used to verify only one TokenForge account. If this Discord account previously verified a different TokenForge account, sign in to that account instead — or contact support for help.",
  },
};

function SystemNotices() {
  return <><AnnouncementBanner /><MaintenanceCountdownBanner /></>;
}

export default function DiscordVerify({ embedded = false }: { embedded?: boolean }) {
  const [location] = useLocation();
  const { user, loading } = useAuth();
  const verification = trpc.developer.discordVerificationStatus.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const error = new URLSearchParams(location.split("?")[1] ?? "").get("error") ?? "";
  const errorCopy = ERROR_COPY[error];
  const startVerification = () => {
    window.location.assign("/api/auth/discord");
  };

  if (loading || (Boolean(user) && verification.isLoading)) {
    return <><SystemNotices /><main className="min-h-screen bg-[#0b0c10] px-4 py-10 text-white"><div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center"><Loader2 className="animate-spin text-[#c8ff74]" size={24} /></div></main></>;
  }

  if (!user) {
    return <><SystemNotices /><main className="min-h-screen bg-[#0b0c10] px-4 py-10 text-white"><section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center rounded-3xl border border-white/10 bg-[#12131a] p-6 text-center shadow-2xl sm:p-9"><LockKeyhole className="mx-auto text-[#c8ff74]" size={26} /><p className="mt-5 text-[10px] font-bold uppercase tracking-[.19em] text-[#c8ff74]">TokenForge access</p><h1 className="mt-2 text-2xl font-bold tracking-tight">Sign in before verifying Discord.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#a8a9b6]">Discord verification is linked to your signed-in TokenForge account and cannot be completed anonymously.</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><Button asChild className="bg-[#e7ffc0] text-[#233310] hover:bg-[#f2ffda]"><Link href="/signin">Sign in</Link></Button><Button asChild variant="outline" className="border-white/15 text-white hover:bg-white/5"><Link href="/signup">Create account</Link></Button></div></section></main></>;
  }

  if (verification.data?.administratorBypass || verification.data?.verified) {
    return <><SystemNotices /><main className="min-h-screen bg-[#0b0c10] px-4 py-10 text-white"><section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center rounded-3xl border border-[#c8ff74]/20 bg-[#12131a] p-6 text-center shadow-2xl sm:p-9"><CheckCircle2 className="mx-auto text-[#c8ff74]" size={30} /><p className="mt-5 text-[10px] font-bold uppercase tracking-[.19em] text-[#c8ff74]">{verification.data.administratorBypass ? "Administrator bypass" : "Discord verified"}</p><h1 className="mt-2 text-2xl font-bold tracking-tight">Your workspace is ready.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#a8a9b6]">{verification.data.administratorBypass ? "This active administrator session retains recovery access without a Discord check." : "Your TokenForge account has a confirmed server-membership record."}</p><Button asChild className="mx-auto mt-7 bg-[#e7ffc0] text-[#233310] hover:bg-[#f2ffda]"><Link href="/dashboard">Open dashboard <ArrowRight size={16} /></Link></Button></section></main></>;
  }

  return <><SystemNotices /><main className={`${embedded ? "min-h-screen" : "min-h-screen"} bg-[#0b0c10] px-4 py-7 text-white sm:py-10`}><section className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_90%_5%,rgba(200,255,116,.13),transparent_30%),linear-gradient(145deg,#171820,#101116_68%)] shadow-2xl"><div className="absolute right-[-75px] top-[-90px] h-56 w-56 rounded-full border border-[#c8ff74]/15" /><div className="relative grid gap-7 p-5 sm:p-8 lg:grid-cols-[1.16fr_.84fr] lg:gap-10 lg:p-11"><div><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c8ff74]/25 bg-[#c8ff74]/10 text-[#d9ff9c]"><MessageCircle size={21} /></div><p className="mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-[#c8ff74]">Community membership</p><h1 className="mt-2 max-w-xl text-3xl font-bold tracking-[-.045em] text-white sm:text-4xl">Verify Discord before entering the forge.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-[#b7b8c4]">Connect the Discord account you use with TokenForge and we will check server membership securely.</p>{errorCopy && <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] p-4 text-left"><TriangleAlert className="mt-0.5 shrink-0 text-amber-200" size={18} /><div><p className="text-sm font-semibold text-amber-100">{errorCopy.title}</p><p className="mt-1 text-xs leading-5 text-amber-100/75">{errorCopy.body}</p></div></div>}{verification.error && <div role="alert" className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[.06] p-4 text-sm leading-6 text-red-100">We could not confirm your current verification status. Refresh this page or sign in again before retrying.</div>}<div className="mt-7"><Button className="h-11 bg-[#e7ffc0] px-5 font-semibold text-[#233310] hover:bg-[#f2ffda]" onClick={startVerification} disabled={verification.isFetching}><ShieldCheck size={17} />Connect Discord &amp; verify membership</Button></div></div><aside className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9ca0b0]">Verification path</p><ol className="mt-5 space-y-5"><li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#c8ff74]/12 text-[11px] font-bold text-[#d9ff9c]">1</span><div><p className="text-sm font-semibold">Be a community member</p><p className="mt-1 text-xs leading-5 text-[#9da0af]">The connected Discord account must already be a member of the TokenForge server.</p></div></li><li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#c8ff74]/12 text-[11px] font-bold text-[#d9ff9c]">2</span><div><p className="text-sm font-semibold">Connect your Discord account</p><p className="mt-1 text-xs leading-5 text-[#9da0af]">Discord shows its standard authorization screen. TokenForge requests only the <code className="rounded bg-white/5 px-1 py-0.5 text-[#d9ff9c]">identify</code> scope.</p></div></li><li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#c8ff74]/12 text-[11px] font-bold text-[#d9ff9c]">3</span><div><p className="text-sm font-semibold">Enter the workspace</p><p className="mt-1 text-xs leading-5 text-[#9da0af]">After a successful server membership check, you return directly to your dashboard.</p></div></li></ol><div className="mt-6 border-t border-white/8 pt-5"><div className="flex gap-2 text-[#d9ff9c]"><LockKeyhole size={15} /><p className="text-[10px] font-bold uppercase tracking-[.14em]">Privacy boundary</p></div><p className="mt-2 text-xs leading-5 text-[#a9abb7]">TokenForge does not save your Discord username, user ID, or OAuth tokens. We retain only the successful-verification timestamp. <Link href="/legal/privacy" className="text-[#d9ff9c] underline underline-offset-4">Read the privacy notice</Link>.</p></div></aside></div></section></main></>;
}
