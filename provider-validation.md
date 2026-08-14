# Selected Provider Validation Record

## Observed Interface

On 14 August 2026, the public landing page at `https://fxqidian.de5.net` described an OpenAI-compatible interface. It displayed `POST /v1/chat/completions`, bearer-token authentication, a `model` and `messages` request body, a response containing `choices` and `usage.total_tokens`, and `stream · sse` support. Its public model catalogue will be deliberately limited in TokenForge to the user-specified `glm-5.2` and `grok-4.5` identifiers.

The provider’s linked New API documentation identifies the upstream software as New API and advertises unified API routing across model providers. Its front page also states that the New API project itself has not sold API access or authorized agents/resellers. This statement applies to the open-source project, not necessarily to the separately operated selected endpoint, but it means TokenForge must not represent the software project as an authorization of the selected service.

## Implementation Decision

TokenForge will integrate the selected endpoint only through a server-side adapter. The provider credential will be stored as a deployment secret, never in frontend code or client responses. The adapter will send OpenAI-compatible chat-completions requests, proxy SSE streaming, normalize upstream failures, and keep the exact two-model catalogue documented above.

## Curated Catalogue Descriptions

| Model | TokenForge catalogue description | Capability labels | Source qualification |
|---|---|---|---|
| `glm-5.2` | A flagship long-horizon model for complex engineering, coding, and extended-context work. Z.AI documents a 1M-token context window and support for reasoning modes, streaming, structured output, and tool-oriented workflows. | Long context, reasoning, streaming, coding | The selected provider’s model mapping and entitlement must be confirmed independently; these descriptions summarize Z.AI’s own documentation. |
| `grok-4.5` | A high-performance reasoning model positioned by SpaceXAI for coding, agentic tasks, and knowledge work, with particular emphasis on engineering tasks and end-to-end application development. | Reasoning, coding, agentic workflows, streaming when supported upstream | The selected provider’s model mapping, latency, context length, and individual feature availability must be verified per request; this copy summarizes SpaceXAI’s public announcement. |

These entries intentionally avoid publishing unverified benchmark, pricing, latency, context, modality, licence, or tool-calling claims for the selected provider. TokenForge will surface only capabilities that its adapter and current upstream behaviour confirm.

## Open Items Before Public Launch

The selected endpoint does not expose complete public commercial terms, data-processing terms, rate limits, or model-license evidence on the pages inspected. Before public access is enabled, the platform owner must independently confirm permission to offer multi-tenant access, expected rate limits, retention/data handling, and the individual model licences. Until then, the implementation will remain capacity-controlled and present provider availability as a beta integration rather than an unrestricted service.

## Sources

1. [Selected provider landing page](https://fxqidian.de5.net)
2. [New API documentation](https://docs.newapi.pro/en)
3. [Z.AI GLM-5.2 overview](https://docs.z.ai/guides/llm/glm-5.2)
4. [SpaceXAI Grok 4.5 announcement](https://x.ai/news/grok-4-5)
