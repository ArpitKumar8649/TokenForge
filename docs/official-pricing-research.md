# Official original-provider pricing research

## Qwen family — Alibaba Cloud Model Studio

**Source:** https://www.alibabacloud.com/help/en/model-studio/model-pricing

The official Alibaba Cloud Model Studio documentation states that its model API calls are normally billed on a pay-as-you-go basis and identifies separate input and output token prices. It also notes that pricing can differ by deployment scope, context tier, cache treatment, batch mode, and limited-time promotions.

For the provider identifier `qwen3.7-max`, the official table describes it as equivalent to `qwen3.7-max-2026-05-20`. The documented **International list price** is **$2.50 per 1M input tokens** and **$7.50 per 1M output tokens**. The same page also presents different global and regional effective/list-price rows, including promotional discounts. TokenForge must therefore publish the selected basis explicitly as the **official International list price**, not represent it as the Cluster Protocol settlement rate.

### Implementation status

- Verified source exists for the Qwen3.7-Max family.
- Use only documented non-promotional list prices in a stable credit-rate mapping.
- Do not infer prices for other Qwen entries from this one row: exact model IDs and tier rules require separate matching.

## Kimi family — Moonshot AI Kimi API Platform

**Sources:** https://platform.kimi.ai/docs/pricing/chat-k3 and https://platform.kimi.ai/docs/pricing/chat

Moonshot’s official Kimi K3 page identifies K3 as its flagship model for long-horizon coding and end-to-end knowledge work, with a 1M-token context window. The page also documents support for automatic context caching, tool calls, JSON mode, structured output, partial mode, and internet search. Its rendered first-party price table lists the exact `kimi-k3` row at **$3.00 per 1M cache-miss input tokens**, **$0.30 per 1M cache-hit input tokens**, and **$15.00 per 1M output tokens**.

Moonshot’s official K2.5 page lists `kimi-k2.5` at **$0.60 cache-miss input / $3.00 output per 1M tokens**, but describes it as a **multi-modal** model with text, image, and video inputs. Cluster Protocol’s `kimi-k2-5` normalized alias is therefore deliberately excluded from this strictly text/chat-only release. The remaining K2-family aliases require their own exact first-party model page and a text-only eligibility review before activation.

### Implementation status

- Official Kimi K3 documentation, capability source, and rendered numerical price table verified.
- The current wallet can apply the official cache-miss input rate and output rate, but it does not yet model cache-hit discounts.

## OpenAI family — OpenAI API pricing

**Sources:** https://developers.openai.com/api/docs/pricing and https://developers.openai.com/api/docs/models/compare

OpenAI’s official pricing documentation exposes separate input, cached-input, and output rates, and its model comparison page confirms that prices and capability metadata are associated with **exact model identifiers**. This supports a conservative matching rule for Cluster Protocol inventory entries: activate a credit-settlement entry only where the exact original model ID appears in current official documentation.

The rendered first-party standard-pricing table exposes exact cache-miss input/output rates for compatible provider identifiers: `gpt-4.1` **$2.00 / $8.00**, `gpt-4.1-mini` **$0.40 / $1.60**, `gpt-4.1-nano` **$0.10 / $0.40**, `gpt-4o` **$2.50 / $10.00**, `gpt-4o-mini` **$0.15 / $0.60**, `gpt-5` **$1.25 / $10.00**, `gpt-5-mini` **$0.25 / $2.00**, `gpt-5-nano` **$0.05 / $0.40**, `gpt-5.4` **$2.50 / $15.00**, `gpt-5.5` **$5.00 / $30.00**, `o3` **$2.00 / $8.00**, `o3-pro` **$20.00 / $80.00**, and `o4-mini` **$1.10 / $4.40**, all per 1M tokens.

The current official page does not expose exact rows for the provider’s revision-specific Codex identifiers `gpt-5.1-codex`, `gpt-5.1-codex-mini`, `gpt-5.2-codex`, or `gpt-5.3-codex`; TokenForge must not inherit neighbouring GPT prices for them. Image, audio, transcription, embedding, and other modality-specific identifiers also stay excluded from the per-token chat-credit rate map.

## Claude family — Anthropic Claude Platform

**Sources:** https://platform.claude.com/docs/en/about-claude/pricing and https://platform.claude.com/docs/en/about-claude/models/overview

Anthropic’s official pricing documentation lists distinct base-input, cache, and output rates. For catalogue identifiers that match current named models, the relevant first-party list prices are:

| Original model | Input / 1M | Output / 1M |
|---|---:|---:|
| Claude Opus 4.5 | $5.00 | $25.00 |
| Claude Opus 4.6 | $5.00 | $25.00 |
| Claude Opus 4.7 | $5.00 | $25.00 |
| Claude Sonnet 4.5 | $3.00 | $15.00 |
| Claude Sonnet 4.6 | $3.00 | $15.00 |
| Claude Haiku 4.5 | $1.00 | $5.00 |

The provider inventory also contains `claude-3.5-haiku`, `claude-3.7-sonnet`, `claude-opus-4`, and `claude-sonnet-4`. Anthropic’s current source labels the first three older lines as retired or partner-specific, while the exact legacy provider IDs need distinct original-source verification before TokenForge can set a stable base rate. Do not substitute current Claude 4.x / 5.x rates for differently named legacy IDs.

## Gemini family — Google AI for Developers

**Sources:** https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/models

Google’s official Gemini documentation publishes model IDs, stability status, and per-million-token rates. It makes clear that text, image, audio, media, tool, and experimental models use different endpoints and pricing approaches; TokenForge’s OpenAI-compatible chat gateway can only price and activate exact chat-compatible identifiers.

The current rendered official paid-tier table provides fixed text rates for the exact identifiers `gemini-2.5-flash` at **$0.30 input / $2.50 output per 1M tokens** and `gemini-2.5-flash-lite` at **$0.10 / $0.40**. It separately lists audio input and context-cache charges; TokenForge’s chat gateway is text-only and can use the corresponding regular text cache-miss input rates.

`gemini-2.5-pro` uses a 200K-prompt threshold ($1.25 / $10.00 at or below the threshold; $2.50 / $15.00 above it) and is excluded until tier-aware wallet settlement is implemented. `gemini-2.0-flash` is shown as deprecated and shut down; it is excluded even though its historical paid text row is available. The current page’s Gemini 3 pricing is for newer exact variants rather than the Cluster Protocol aliases `gemini-3-flash` and `gemini-3.1-pro`, so those aliases also remain excluded rather than inheriting near-match rates.

Do not apply regular text token prices to Gemini Live, TTS, image, video, music, embedding, computer-use, deep-research, robotics, or experimental entries. Those require separate request shapes and/or non-text billing units and remain outside this chat-completions rate map.

## DeepSeek family — DeepSeek API

**Source:** https://api-docs.deepseek.com/quick_start/pricing

DeepSeek’s official current price table publishes only `deepseek-v4-flash` and `deepseek-v4-pro` under its new peak/off-peak schedule effective August 16, 2026. The table lists separate cache-hit, cache-miss, and output rates: V4 Flash is $0.007 / $0.22 / $0.66 off-peak and $0.014 / $0.44 / $1.32 peak; V4 Pro is $0.022 / $0.66 / $1.98 off-peak and $0.044 / $1.32 / $3.96 peak, all per 1M tokens. Their varying time-of-day price and cached-input billing cannot be modeled accurately by the current simple input/output wallet structure. Only models with an exact compatible fixed-rate rule should be considered for activation; legacy V3 and R1 aliases remain unpriced here.

## Grok family — xAI

**Source:** https://docs.x.ai/developers/pricing

xAI’s official pricing page identifies the current text API family and warns that pricing may vary by short versus long context, cached input, priority processing, and tool usage. Its rendered text API table lists the exact `grok-4.3` short-context rate at **$1.25 per 1M input tokens** and **$2.50 per 1M output tokens**; its long-context rate is $2.50 / $5.00 when the prompt reaches 200K tokens. TokenForge’s flat wallet can use the published short-context base rate only if the catalogue’s output-token cap keeps requests safely below that threshold.

The same source has distinct `grok-4.20-0309-*` rows, while the Cluster Protocol catalogue offers only `grok-4.20`; it must stay excluded unless the provider confirms that alias’s exact variant and billed context rule. The inventory’s `grok-3`, `grok-3-mini`, `grok-4`, `grok-4-fast`, and `grok-code-fast-1` do not receive a rate merely because a newer Grok page exists.

## GLM family — Z.AI

**Source:** https://docs.z.ai/guides/overview/pricing

Z.AI publishes a table that matches several exact provider IDs with simple input/output per-million-token rates: `glm-5.2` $1.40 / $4.40, `glm-5.1` $1.40 / $4.40, `glm-5` $1.00 / $3.20, `glm-4.7` $0.60 / $2.20, and `glm-4.6` $0.60 / $2.20. `glm-4.7-flash` is listed as free, while visual, OCR, image, video, ASR, and agent variants use different modalities or fixed per-use prices and must not be routed through this text chat gateway unless separate request and billing support is implemented.

## Qwen 3.7 family — Alibaba Cloud Model Studio

**Sources:** https://www.alibabacloud.com/help/en/model-studio/model-pricing and https://help.aliyun.com/en/model-studio/qwen3-7-max-us

Alibaba Cloud’s official Model Studio table identifies `qwen3.7-max` as equivalent to `qwen3.7-max-2026-05-20` in the international deployment. It publishes a list rate of **$2.50 / 1M input tokens** and **$7.50 / 1M output tokens** for the international version, subject to a limited-time 50% promotion; the source records standard list pricing, not promotion-dependent prices. The separate US-Virginia page publishes CNY rates of 18.736 input and 56.207 output per 1M tokens, with additional cache rates; it must not be mixed with the international USD rate. Model Studio also publishes Qwen 3.7 Plus and other Qwen variants with tiered, deployment-specific, and thinking-mode prices. Only the exact `qwen3.7-max` mapping is immediately compatible with the existing two-rate token wallet; tiers, cache pricing, non-text models, and differently deployed variants require explicit support.

## Cohere and Perplexity leads — official pricing references

**Sources:** https://cohere.com/pricing and https://docs.perplexity.ai/docs/getting-started/pricing

The first-party Cohere generative-model panel lists **Command A+** as **$0 / Free** for API-key and model-download access, and separately lists Command R at $0.15 input / $0.60 output per 1M tokens. Cluster Protocol’s `command-a` is not the separately priced Command R model. It is excluded from TokenForge’s credit-debit catalogue: assigning it Command R’s rate would be an invented price, while a $0 activation would not represent a wallet-deductible original-provider rate.

Perplexity’s official pricing documentation identifies Sonar Pro token prices as **$3.00 per 1M input tokens** and **$15.00 per 1M output tokens**, while also documenting additional request and search-context fees. The provider inventory contains `sonar`, `sonar-pro`, `sonar-reasoning-pro`, and `sonar-deep-research`; these models cannot use only the base token rate unless the additional per-request/search components are accounted for or excluded.

## Mistral family — Mistral API

**Source:** https://docs.mistral.ai/inference/pricing

Mistral’s official rendered USD table lists standard API token prices for Mistral Large 3 at **$0.50 input / $1.50 output per 1M tokens**, Mistral Medium 3.5 at **$1.50 / $7.50**, and Mistral Small 4 at **$0.15 / $0.60**. It also lists cached-input discounts for each model. The authenticated provider inventory contains exact compatible identifiers `mistral-large-3` and `mistral-small-4`, which can be mapped to those two official rows using cache-miss input rates. It contains `mistral-medium-3`, not the documented `mistral-medium-3.5`, so Medium remains excluded rather than inheriting the 3.5 rate.

The inventory’s `mistral-small-3.2-24b`, `mistral-nemo-12b-instruct`, and legacy Devstral variants do not exactly match current rows in the source table. They remain out of the two-rate catalogue unless their own first-party price rows are independently verified.

## MiniMax family — MiniMax API

**Source:** https://platform.minimax.io/docs/guides/pricing-paygo

MiniMax’s rendered official pay-as-you-go LLM table lists **MiniMax-M2**, **MiniMax-M2.5**, and **MiniMax-M2.7** at **$0.30 per 1M input tokens** and **$1.20 per 1M output tokens** on its standard tier; it also separately lists cache read/write charges. Cluster Protocol’s normalized identifiers `minimax-m2`, `minimax-m2-5`, and `minimax-m2-7` correspond to those source labels and can use the documented standard cache-miss input and output prices.

The source lists MiniMax-M3 with a 512K-token context threshold and a permanent promotional discount, so its actual charge depends on request context size. It is excluded from the current flat two-rate wallet. `minimax-m1` does not appear in the current standard table and remains unpriced pending its own first-party legacy row.

## Conservative text/chat activation set

The first implementation will activate only 33 models whose source rate can be represented by the existing cache-miss input/output settlement structure, plus the two already-supported direct models. The retained entries are: six current Claude models; four GLM models (`glm-5.2` through the existing direct adapter, plus `glm-5.1`, `glm-5`, and normalized `glm-4-7`); ten standard GPT models; three OpenAI reasoning models (`o3`, `o3-pro`, `o4-mini`); `grok-4.5` through the existing direct adapter; `kimi-k3`; two Gemini Flash models; two Mistral models; three MiniMax M2 variants; and `qwen3.7-max`.

`grok-4.3` is retained as a researched candidate but excluded from this flat-rate release because the xAI price doubles after a 200K-token input threshold. All remaining inventory entries are excluded because they are non-text modalities, open-weight models without an original-provider API token price, have an unverified or inexact alias, are retired, or require cache, context, request, search, media, or time-of-day price components not represented by the current settlement contract.
