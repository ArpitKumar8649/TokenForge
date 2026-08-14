import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { Link, useLocation } from "wouter";

const navItems = [
  { href: "/models", label: "Models" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Documentation" },
  { href: "/legal/terms", label: "Trust" },
];

export function PublicNav() {
  const [location] = useLocation();

  return (
    <header className="public-nav">
      <div className="public-nav__inner">
        <div className="public-nav__cluster">
          <Link href="/" className="brand" aria-label="TokenForge home">
            <span className="brand__mark"><TokenForgeGlyph className="brand__glyph" /></span>
            <span>Token<span className="brand__accent">Forge</span></span>
          </Link>
          <nav className="public-nav__links" aria-label="Primary navigation">
            {navItems.map(item => (
              <Link key={item.href} href={item.href} className={`${location === item.href ? "nav-link nav-link--active" : "nav-link"}${item.href === "/pricing" ? " nav-link--pricing" : ""}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="public-nav__actions">
          <Link href="/signin" className="sign-in-button">Sign in</Link>
          <Link href="/signup" className="nav-cta">Create account</Link>
        </div>
        <div className="public-nav__mobile-actions">
          <Link href="/signin" className="sign-in-button">Sign in</Link>
          <Link href="/signup" className="nav-cta">Join beta</Link>
        </div>
      </div>
    </header>
  );
}
