import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpRight, CheckCircle2, MessagesSquare, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const DISCORD_INVITE_URL = "https://discord.gg/pnsWamDbe";
const ONBOARDING_DISMISSED_KEY = "tokenforge_onboarding_dismissed";
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

function dismissedAccountIds() {
  try {
    const value = JSON.parse(localStorage.getItem(ONBOARDING_DISMISSED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(value) ? value.filter((id): id is number => typeof id === "number") : []);
  } catch {
    return new Set<number>();
  }
}

function dismissAccount(userId: number) {
  const dismissed = dismissedAccountIds();
  dismissed.add(userId);
  localStorage.setItem(ONBOARDING_DISMISSED_KEY, JSON.stringify(Array.from(dismissed)));
}

export function FirstTimeOnboarding({ user }: { user: { id: number; name?: string | null; createdAt?: Date | string | null } | null | undefined }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.createdAt || dismissedAccountIds().has(user.id)) return;
    const createdAt = new Date(user.createdAt).getTime();
    const accountAge = Date.now() - createdAt;
    if (Number.isFinite(createdAt) && accountAge >= 0 && accountAge <= NEW_ACCOUNT_WINDOW_MS) setOpen(true);
  }, [user?.createdAt, user?.id]);

  const dismiss = () => {
    if (user) dismissAccount(user.id);
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) dismiss(); }}>
      <DialogContent showCloseButton className="overflow-hidden border-[#c9ff73]/20 bg-[#13150f] p-0 text-[#eef3e9] shadow-[0_24px_90px_rgba(0,0,0,.6)] sm:max-w-md">
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#c9ff73]/12 blur-3xl" aria-hidden="true" />
        <div className="relative p-5 sm:p-7">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#c9ff73]/25 bg-[#c9ff73]/10 text-[#c9ff73] shadow-[0_0_0_7px_rgba(201,255,115,.045)]"><Sparkles size={21} /></div>
          <DialogHeader className="mt-5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a6c970]">Welcome to TokenForge</p>
            <DialogTitle className="mt-2 text-2xl font-bold tracking-[-.04em] text-white">Build with the forge, {user.name?.split(" ")[0] || "developer"}.</DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-6 text-[#aeb7a7]">Start with your $50 build credit, then join the community for release notes, practical tips, and help from other builders.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 rounded-xl border border-white/8 bg-black/20 p-3.5">
            <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#5865f2]/15 text-[#aeb9ff]"><MessagesSquare size={16} /></span><div><p className="text-xs font-semibold text-[#ecf2e8]">TokenForge Discord</p><p className="mt-1 text-[11px] leading-5 text-[#929b8e]">Connect with the community before you start your first request.</p></div></div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Button asChild onClick={dismiss} className="h-11 bg-[#c9ff73] font-bold text-[#16210e] hover:bg-[#d9ff99]"><a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">Join Discord <ArrowUpRight size={16} /></a></Button>
            <Button type="button" variant="outline" onClick={dismiss} className="h-11 border-white/12 bg-transparent text-[#d7ded1] hover:bg-white/8 hover:text-white">Continue</Button>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[10px] text-[#7f8a79]"><CheckCircle2 size={12} className="text-[#a6cf68]" />This welcome stays out of your way after dismissal.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
