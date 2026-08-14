import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";

type LocalAuthProps = { mode: "signin" | "signup" };

export default function LocalAuth({ mode: initialMode }: LocalAuthProps) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = initialMode === "signup";
  const register = trpc.auth.register.useMutation();
  const login = trpc.auth.login.useMutation();
  const pending = register.isPending || login.isPending;
  const error = register.error?.message ?? login.error?.message;

  const finish = async (user: unknown) => {
    utils.auth.me.setData(undefined, user as any);
    await utils.auth.me.invalidate();
    navigate("/dashboard");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSignup) {
      const response = await register.mutateAsync({ email, password, name: name || undefined });
      await finish(response.user);
      return;
    }
    const response = await login.mutateAsync({ email, password });
    await finish(response.user);
  };

  return (
    <main className="local-auth-page">
      <section className="local-auth-intro">
        <Link href="/" className="local-auth-brand"><TokenForgeGlyph className="local-auth-brand__glyph" /><span>Token<span>Forge</span></span></Link>
        <div className="local-auth-intro__copy">
          <p className="demo-kicker"><span /> PRIVATE BY DEFAULT</p>
          <h1>A careful gateway for <em>serious</em> builders.</h1>
          <p>Your API keys remain one-time secrets. Passwords are stored only as salted, one-way derivations; TokenForge never keeps the plaintext.</p>
        </div>
        <div className="local-auth-promises">
          <div><ShieldCheck size={18} /><span><b>Protected workspace</b><small>Keys, quotas, and activity stay behind your session.</small></span></div>
          <div><KeyRound size={18} /><span><b>Key secrecy by design</b><small>New API keys are shown once, then retained as hashes only.</small></span></div>
        </div>
      </section>
      <section className="local-auth-form-panel">
        <div className="local-auth-form-wrap">
          <div className="local-auth-form__heading">
            <p>{isSignup ? "Create a workspace" : "Welcome back"}</p>
            <h2>{isSignup ? "Start building with quiet confidence." : "Sign in to your TokenForge workspace."}</h2>
            <span>{isSignup ? "No billing details are required for the current beta." : "Use the email and password you registered with."}</span>
          </div>
          <form className="local-auth-form" onSubmit={submit}>
            {isSignup && <div className="local-auth-field"><Label htmlFor="name">Name <small>Optional</small></Label><Input id="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Ada Lovelace" maxLength={120} /></div>}
            <div className="local-auth-field"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required maxLength={320} /></div>
            <div className="local-auth-field"><Label htmlFor="password">Password</Label><div className="local-auth-password"><Input id="password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder={isSignup ? "At least 12 characters" : "Your password"} required minLength={12} maxLength={256} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{isSignup && <small className="local-auth-help"><CheckCircle2 size={13} /> Use 12 or more characters.</small>}</div>
            {error && <p className="local-auth-error" role="alert">{error}</p>}
            <Button type="submit" disabled={pending} className="local-auth-submit">{pending ? "Securing your session…" : isSignup ? "Create account" : "Sign in"}<ArrowRight size={16} /></Button>
          </form>
          <p className="local-auth-switch">{isSignup ? "Already have an account?" : "New to TokenForge?"} <Link href={isSignup ? "/signin" : "/signup"}>{isSignup ? "Sign in" : "Create one"}</Link></p>
          <Link href="/" className="local-auth-back">← Back to TokenForge</Link>
        </div>
      </section>
    </main>
  );
}
