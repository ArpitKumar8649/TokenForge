import { cn } from "@/lib/utils";
import React, { type ComponentPropsWithoutRef } from "react";

type GlassShineCardProps = ComponentPropsWithoutRef<"section">;

/**
 * A reusable, self-contained dashboard surface. Decorative layers stay behind
 * the content so it remains readable and fully interactive.
 */
export function GlassShineCard({ className, children, ...props }: GlassShineCardProps) {
  return (
    <section
      className={cn(
        "group relative isolate overflow-hidden rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_94%_4%,rgba(121,232,239,.16),transparent_34%),radial-gradient(circle_at_8%_100%,rgba(184,154,255,.13),transparent_36%),linear-gradient(135deg,rgba(14,24,33,.97),rgba(18,19,26,.97))] shadow-[0_22px_56px_rgba(0,0,0,.26),inset_0_1px_rgba(255,255,255,.08)]",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-1/2 top-0 h-full w-[72%] bg-[radial-gradient(ellipse_at_center,rgba(121,232,239,.16),transparent_66%)] opacity-75 blur-2xl [animation:ani_13s_ease-in-out_infinite] motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-full -top-full h-[155%] w-[52%] rotate-12 bg-[linear-gradient(110deg,transparent_28%,rgba(255,255,255,.2)_47%,transparent_66%)] opacity-60 [animation:shine_5.6s_ease-in-out_infinite] motion-reduce:hidden"
      />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
