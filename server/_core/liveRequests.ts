import type { Express, Request, Response } from "express";
import { subscribeLiveRequests, type LiveRequestEvent } from "../liveRequestBus";
import { sdk } from "./sdk";

const NOT_ADMIN_MSG = "You do not have required permission (10002)";

/** Forwards live usage events to the admin panel as a Server-Sent Events stream. */
export function registerLiveRequestRoutes(app: Express) {
  app.get("/api/admin/live-requests", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!user?.isAdminSession) {
      res.status(403).json({ error: NOT_ADMIN_MSG });
      return;
    }

    res.status(200);
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.setHeader("x-accel-buffering", "no");
    res.flushHeaders();

    let closed = false;
    const send = (event: LiveRequestEvent) => {
      if (closed) return;
      res.write(`event: request\ndata: ${JSON.stringify({ ...event, createdAt: event.createdAt.toISOString() })}\n\n`);
    };

    const unsubscribe = subscribeLiveRequests(send);
    const heartbeat = setInterval(() => {
      if (closed) return;
      res.write(": keep-alive\n\n");
    }, 25_000);

    req.on("close", () => {
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      try { res.end(); } catch { /* already closed */ }
    });

    // Initial readiness so the client knows the stream is open.
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  });
}
