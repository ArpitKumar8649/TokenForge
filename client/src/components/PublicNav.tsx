import { ArrowUpRight, Hexagon } from "lucide-react";
import { Link, useLocation } from "wouter";

const navItems = [
  { href: "/models", label: "Models" },
  { href: "/docs", label: "Documentation" },
  { href: "/pricing", label: "Pricing" },
  { href: "/legal/terms", label: "Trust" },
];

export function PublicNav() {
  const [location] = useLocation();

  return (
    <header className="public-nav">
      <div className="public-nav__inner">
        <Link href="/" className="brand" aria-label="TokenForge home">
          <span className="brand__mark"><Hexagon size={18} strokeWidth={2.25} /></span>
          <span>Token<span className="brand__accent">Forge</span></span>
        </Link>
        <nav className="public-nav__links" aria-label="Primary navigation">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={`${location === item.href ? "nav-link nav-link--active" : "nav-link"}${item.href === "/pricing" ? " nav-link--pricing" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="public-nav__actions">
          <Link href="/signin" className="sign-in-button">Sign in</Link>
          <Link href="/demo" className="nav-cta">Try the demo <ArrowUpRight size={15} /></Link>
        </div>
        <nav className="public-nav__mobile" aria-label="Mobile navigation">
          <Link href="/models" className={location === "/models" ? "nav-mobile-link nav-mobile-link--active" : "nav-mobile-link"}>Models</Link>
          <Link href="/pricing" className={location === "/pricing" ? "nav-mobile-link nav-mobile-link--active" : "nav-mobile-link"}>Pricing</Link>
          <Link href="/docs" className={location === "/docs" ? "nav-mobile-link nav-mobile-link--active" : "nav-mobile-link"}>Docs</Link>
        </nav>
      </div>
    </header>
  );
}
