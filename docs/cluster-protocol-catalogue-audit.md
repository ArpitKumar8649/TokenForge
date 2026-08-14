# Cluster Protocol catalogue audit

## Verified on 14 August 2026

TokenForge successfully authenticated against `GET https://api.clusterprotocol.ai/v1/models` using the server-only project credential. The endpoint returned **211** model entries. The requested identifiers `kimi-k3` and `qwen3.7-max` were both present.

The returned model records did **not** expose any of the expected input or output token-cost fields (`price`, `pricing`, `cost`, `input_price`, `output_price`, `input_cost`, or `output_cost`). TokenForge must therefore not fabricate per-model promotional-credit debit rates for the full catalogue.

## Integration consequence

The provider inventory can be discovered and displayed dynamically. Request execution must remain subject to TokenForge's server-side authentication, rate limits, concurrency limits, streaming parser, request logging, and aggregate metering. Before unpriced models are made requestable under the promotional-credit wallet, TokenForge needs an authoritative pricing source or an explicitly approved quota-only trial policy.

## Sources

- Authenticated provider endpoint: `https://api.clusterprotocol.ai/v1/models`
- Cluster Protocol whitepaper overview: https://cluster-protocol.gitbook.io/whitepaper
- Cluster Protocol private AI infrastructure overview: https://www.clusterprotocol.ai/blog/cluster-protocol-the-private-ai-infrastructure-whitepaper---1780408980
