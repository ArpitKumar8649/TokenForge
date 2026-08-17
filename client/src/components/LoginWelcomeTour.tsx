import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, ArrowUpRight, Bot, Check, MessagesSquare, Orbit, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DISCORD_INVITE_URL = "https://discord.gg/pnsWamDbe";
export const LOGIN_WELCOME_TOUR_COMPLETED_KEY = "tokenforge_login_welcome_completed";

export type LoginWelcomeUser = {
  id: number;
  name?: string | null;
  createdAt?: Date | string | null;
  lastSignedIn?: Date | string | null;
};

export function loginWelcomeSessionMarker(user: LoginWelcomeUser) {
  const timestamp = new Date(user.lastSignedIn ?? user.createdAt ?? 0).getTime();
  return `${user.id}:${Number.isFinite(timestamp) ? timestamp : "session"}`;
}

export function shouldShowLoginWelcomeTour(marker: string, completedMarker: string | null) {
  return Boolean(marker) && completedMarker !== marker;
}

const tourSteps = [
  {
    eyebrow: "NEW IN THE FORGE",
    title: "Claude Fable 5 is now live.",
    description: "A focused route for advanced reasoning, careful coding, streamed completions, and inspectable thinking summaries in the Playground.",
    detail: "Reasoning · Thinking · Streaming · Coding",
    icon: Sparkles,
    accent: "#cbb7ff",
    iconClassName: "border-[#bda2ff]/35 bg-[#9d79f5]/15 text-[#dfd4ff] shadow-[0_0_0_8px_rgba(157,121,245,.06)]",
    visual: "fable",
  },
  {
    eyebrow: "AVAILABLE NOW",
    title: "Qwen 3.8 Max is ready.",
    description: "Use a high-capacity reasoning route with enforced xhigh reasoning and an expandable Playground thinking view when the provider returns one.",
    detail: "xhigh reasoning · Messages · Chat Completions",
    icon: Orbit,
    accent: "#c9ff73",
    iconClassName: "border-[#c9ff73]/30 bg-[#c9ff73]/10 text-[#d8ff9c] shadow-[0_0_0_8px_rgba(201,255,115,.05)]",
    visual: "qwen",
  },
  {
    eyebrow: "STAY CONNECTED",
    title: "Join the TokenForge Discord.",
    description: "Receive release notes, report issues, and connect with the builders shaping the Forge. Discord verification remains required before a standard workspace can be used.",
    detail: "Release notes · Support · Builder community",
    icon: MessagesSquare,
    accent: "#aab7ff",
    iconClassName: "border-[#8b9cff]/35 bg-[#6273df]/15 text-[#c9d1ff] shadow-[0_0_0_8px_rgba(98,115,223,.06)]",
    visual: "discord",
  },
] as const;

export function LoginWelcomeTour({ user }: { user: LoginWelcomeUser | null | undefined }) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const marker = useMemo(() => (user ? loginWelcomeSessionMarker(user) : ""), [user]);

  useEffect(() => {
    if (!marker || typeof window === "undefined") {
      setOpen(false);
      return;
    }

    let completedMarker: string | null = null;
    try {
      completedMarker = sessionStorage.getItem(LOGIN_WELCOME_TOUR_COMPLETED_KEY);
    } catch {}

    setStep(0);
    setOpen(shouldShowLoginWelcomeTour(marker, completedMarker));
  }, [marker]);

  if (!user) return null;

  const activeStep = tourSteps[step];
  const StepIcon = activeStep.icon;
  const isFinalStep = step === tourSteps.length - 1;
  const firstName = user.name?.trim().split(" ")[0] || "developer";

  const completeTour = () => {
    try {
      sessionStorage.setItem(LOGIN_WELCOME_TOUR_COMPLETED_KEY, marker);
    } catch {}
    setOpen(false);
  };

  const advance = () => {
    if (isFinalStep) {
      completeTour();
      return;
    }
    setStep(current => current + 1);
  };

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (nextOpen) setOpen(true); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
        className="overflow-hidden border-white/10 bg-[#10130f] p-0 text-[#eef3e9] shadow-[0_32px_120px_rgba(0,0,0,.72)] sm:max-w-xl"
      >
        <div className="absolute inset-0 opacity-90" aria-hidden="true">
          <div className={`absolute -right-14 -top-10 h-60 w-60 rounded-full blur-3xl ${activeStep.visual === "fable" ? "bg-[#9d79f5]/25" : activeStep.visual === "qwen" ? "bg-[#c9ff73]/16" : "bg-[#6172df]/22"}`} />
          <div className="absolute -bottom-24 -left-24 h-60 w-60 rounded-full bg-[#fe8e89]/9 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.03)_48%,transparent_100%)]" />
        </div>

        <div className="relative p-5 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2" aria-label={`Step ${step + 1} of ${tourSteps.length}`}>
              {tourSteps.map((tourStep, index) => <span key={tourStep.title} className={`h-1.5 rounded-full transition-all duration-200 ${index === step ? "w-9" : index < step ? "w-4 bg-[#c9ff73]" : "w-4 bg-white/14"}`} style={index === step ? { backgroundColor: activeStep.accent } : undefined} />)}
            </div>
            <span className="font-mono text-[10px] font-bold tracking-[.18em] text-[#98a391]">0{step + 1} / 0{tourSteps.length}</span>
          </div>

          <div className="mt-8 grid gap-7 sm:grid-cols-[1.08fr_.92fr] sm:items-end">
            <div>
              <div className={`grid h-14 w-14 place-items-center rounded-2xl border ${activeStep.iconClassName}`}><StepIcon size={25} strokeWidth={1.8} /></div>
              <DialogHeader className="mt-6 text-left">
                <p className="font-mono text-[10px] font-bold tracking-[.18em] text-[#a8bf83]">{activeStep.eyebrow}</p>
                <DialogTitle className="mt-2 text-3xl font-bold leading-[1.02] tracking-[-.055em] text-white sm:text-[2.15rem]">{step === 0 ? <>{activeStep.title.split(" is ")[0]} <span style={{ color: activeStep.accent }}>is</span> now live.</> : activeStep.title}</DialogTitle>
                <DialogDescription className="pt-3 text-sm leading-6 text-[#aeb7a7]">{step === 0 ? `Welcome back, ${firstName}. ` : ""}{activeStep.description}</DialogDescription>
              </DialogHeader>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-4 shadow-inner">
              <div className="absolute inset-x-0 top-0 h-px bg-white/18" aria-hidden="true" />
              {activeStep.visual === "fable" && <div className="min-h-36"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#cdbfff]"><Bot size={14} /> Claude Fable 5</div><div className="mt-5 space-y-2"><div className="h-2 w-4/5 rounded-full bg-white/13" /><div className="h-2 w-full rounded-full bg-white/9" /><div className="h-2 w-2/3 rounded-full bg-[#bda2ff]/28" /></div><div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#bda2ff]/18 bg-[#bda2ff]/9 px-2.5 py-1 text-[10px] font-semibold text-[#e2d9ff]"><Sparkles size={11} /> Thinking available</div></div>}
              {activeStep.visual === "qwen" && <div className="min-h-36"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#d8ff9c]"><Orbit size={14} /> Qwen 3.8 Max</div><div className="mt-4 rounded-xl border border-[#c9ff73]/16 bg-[#c9ff73]/7 p-3"><p className="font-mono text-[10px] text-[#9ebf70]">REASONING EFFORT</p><p className="mt-1 font-mono text-xl font-bold text-[#e5ffc0]">xhigh</p></div><div className="mt-3 flex items-center gap-2 text-[10px] text-[#9ca99a]"><span className="h-1.5 w-1.5 rounded-full bg-[#c9ff73] shadow-[0_0_10px_#c9ff73]" /> Route available</div></div>}
              {activeStep.visual === "discord" && <div className="min-h-36"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#5865f2]/15 text-[#c6ceff]"><MessagesSquare size={20} /></div><p className="mt-4 text-sm font-semibold text-white">TokenForge Discord</p><p className="mt-1 text-[11px] leading-5 text-[#9fa89b]">A direct line for practical support and platform updates.</p><div className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold text-[#bfc7ff]"><Check size={12} /> Ready when you are</div></div>}
            </div>
          </div>

          <div className="mt-7 rounded-xl border border-white/8 bg-white/[.025] px-3.5 py-3 text-[11px] leading-5 text-[#a4ada0]">{activeStep.detail}</div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {isFinalStep ? <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-[#bfc7ff] transition-colors hover:bg-white/6 hover:text-white">Open Discord <ArrowUpRight size={15} /></a> : <span className="hidden sm:block" />}
            <Button type="button" onClick={advance} className="h-11 min-w-36 bg-[#c9ff73] font-bold text-[#17210f] hover:bg-[#ddffa2] active:scale-[.97]">{isFinalStep ? "Continue" : "Next"} <ArrowRight size={16} /></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
