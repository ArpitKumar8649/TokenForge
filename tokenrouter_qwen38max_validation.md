# TokenRouter Qwen 3.8 Max Compatibility Notes

Validated on 16 August 2026 using server-only configuration against `https://api.tokenrouter.com` and the configured upstream model `qwen/qwen3.8-max-free`.

| Probe | Result | Integration implication |
|---|---:|---|
| OpenAI-compatible `POST /v1/chat/completions` baseline | HTTP 200 | The configured credential and route are usable. |
| OpenAI-compatible request with `reasoning_effort: "max"` | HTTP 400 | The literal `max` value is rejected. |
| Provider validation message | Accepts `low`, `medium`, or `xhigh` | `xhigh` is the provider’s highest supported reasoning setting. |
| OpenAI-compatible request with `reasoning_effort: "xhigh"` | HTTP 200 | TokenForge may enforce the provider’s highest setting for this model. |
| Native Anthropic `POST /v1/messages` baseline | HTTP 200 | The upstream accepts Messages payloads and returns separate thinking and text blocks. |

The validated response shapes included an OpenAI-compatible `reasoning_content` field and an Anthropic-compatible `thinking` block. No credentials, prompts beyond minimal probes, account data, or model-output content are recorded in this note.

## Catalogue and Pricing Verification

The public TokenRouter Models page was opened for the exact route. At the time of review, its client-rendered catalogue had not populated beyond loading placeholders in the browser session, so this visual inspection does not establish a price.

The public Qwen3.8 Max page at https://openrouter.ai/qwen/qwen3.8-max was then used as the rate reference. On 16 August 2026, it listed a published base rate of **$2.00 per million input tokens** and **$6.00 per million output tokens**. TokenForge stores these as upstream catalogue rates; its centralized 1.5× platform multiplier produces customer-facing credit rates of **$3.00/M input** and **$9.00/M output**. The page also documents the Qwen3.8 Max route and its reasoning-capable API use case.
