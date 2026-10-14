import { Megaphone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import "./announcement-banner.css";

export function AnnouncementBanner() {
  const announcement = trpc.public.announcement.useQuery(undefined, { refetchInterval: 60_000, staleTime: 30_000, refetchOnWindowFocus: true });
  const text = announcement.data?.trim();

  if (!text) return null;

  return (
    <section className="announcement-banner" aria-label="TokenForge announcement" role="status">
      <div className="announcement-banner__label"><Megaphone size={13} aria-hidden="true" /><span>Forge signal</span></div>
      <div className="announcement-banner__viewport">
        <div className="announcement-banner__track">
          <span className="announcement-banner__message">{text}</span>
          <span className="announcement-banner__message" aria-hidden="true">{text}</span>
        </div>
      </div>
    </section>
  );
}
