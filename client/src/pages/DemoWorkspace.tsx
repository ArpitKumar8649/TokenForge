import { PublicNav } from "@/components/PublicNav";
import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { Badge } from "@/components/ui/badge";
import { demoSafetyNotice, publicModels } from "@/lib/tokenforgePresentation";
import { ArrowRight, BarChart3, CircleAlert, KeyRound, LockKeyhole, Sparkles } from "lucide-react";
import { Link } from "wouter";

const activity = [
  { label: "glm-5.2", detail: "Chat completion", status: "Completed", time: "Just now" },
  { label: "grok-4.5", detail: "Streaming request", status: "Completed", time: "12 min ago" },
  { label: "glm-5.2", detail: "Model discovery", status: "Completed", time: "42 min ago" },
];

export default function DemoWorkspace() {
  return (
    <div className="demo-page">
      <PublicNav />
      <main className="demo-shell">
        <section className="demo-hero">
          <div>
            <div className="demo-kicker"><span /> Interactive preview</div>
            <h1>Your TokenForge<br /><em>workspace, in motion.</em></h1>
            <p>This is a safe, read-only tour of the developer workspace. It uses illustrative states only—no account, API key, provider call, or live usage record is exposed or created.</p>
          </div>
          <TokenForgeGlyph className="demo-hero__glyph" />
        </section>

        <section className="demo-grid" aria-label="Read-only TokenForge workspace preview">
          <article className="demo-card demo-card--quota"><div className="demo-card__head"><span>Today’s allowance</span><Badge>Preview</Badge></div><div className="demo-meter"><div className="demo-meter__ring"><strong>68%</strong><span>available</span></div><div><h2>68 requests</h2><p>of 100 daily requests</p></div></div><div className="demo-progress"><i /></div><small>Read-only example of the real quota display.</small></article>
          <article className="demo-card"><div className="demo-card__head"><span>Catalogue</span><Sparkles size={17} /></div><div className="demo-models">{publicModels.map(model => <div key={model.id}><b>{model.name}</b><span>{model.capabilities}</span></div>)}</div><Link href="/models" className="demo-inline-link">See model notes <ArrowRight size={14} /></Link></article>
          <article className="demo-card"><div className="demo-card__head"><span>API credential</span><KeyRound size={17} /></div><code className="demo-key">tf_demo_••••••••preview</code><p className="demo-muted">Demo credentials are visual placeholders. Create, rotate, and revoke real keys only after signing in.</p><Link href="/docs" className="demo-inline-link">Read key security <ArrowRight size={14} /></Link></article>
          <article className="demo-card demo-card--wide"><div className="demo-card__head"><span>Activity</span><BarChart3 size={17} /></div><div className="demo-activity">{activity.map(item => <div key={`${item.label}-${item.time}`}><i /><div><b>{item.label}</b><span>{item.detail}</span></div><em>{item.status}</em><time>{item.time}</time></div>)}</div></article>
          <article className="demo-card demo-card--cta"><LockKeyhole size={21} /><div><h2>Ready to make it yours?</h2><p>Sign in to create your own protected workspace and API key.</p></div><Link href="/dashboard" className="demo-cta">Open sign in <ArrowRight size={15} /></Link></article>
        </section>

        <aside className="demo-notice"><CircleAlert size={16} /> {demoSafetyNotice}</aside>
      </main>
    </div>
  );
}
