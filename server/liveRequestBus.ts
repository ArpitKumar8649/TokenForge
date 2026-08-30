/** In-process fan-out of newly recorded usage events to admin SSE subscribers. */
export type LiveRequestEvent = {
  requestId: string;
  userId: number;
  apiKeyId?: number;
  modelId: string;
  status: "success" | "rejected" | "provider_error" | "cancelled";
  source: "api" | "playground";
  stream: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  chargeNanos: number;
  sourceIpHash?: string;
  latencyMs?: number;
  errorMessage?: string;
  provider?: string;
  createdAt: Date;
  userName?: string | null;
};

type Listener = (event: LiveRequestEvent) => void;

const listeners = new Set<Listener>();

export function subscribeLiveRequests(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishLiveRequest(event: LiveRequestEvent) {
  for (const listener of Array.from(listeners)) {
    try {
      listener(event);
    } catch {
      // A slow or failed subscriber must not block usage recording.
    }
  }
}

export function liveRequestSubscriberCount() {
  return listeners.size;
}
