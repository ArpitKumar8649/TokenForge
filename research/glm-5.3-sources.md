# GLM 5.3 source notes

## Official sources consulted on 17 August 2026

- Z.AI announced **GLM-5.3** on 14 August 2026 and describes it as a post-training advancement over the GLM-5.2 base model: https://z.ai/blog/glm-5.3
- Z.AI’s developer pricing overview is the authoritative rate source for model catalogue billing: https://docs.z.ai/guides/overview/pricing

## Implementation decision

The TokenForge public model identifier will be `glm-5.3`. The upstream provider identifier remains a server-only value in `TOKENROUTER_GLM53_MODEL`; it will not be embedded in the catalogue, browser payloads, documentation snippets, or client source.

On 17 August 2026, Z.AI’s official pricing page search metadata identifies GLM-5.3 as new, but the extracted public rate table still lists GLM-5.2 at $1.40 input and $4.40 output per million tokens and does not expose a dedicated GLM-5.3 row. TokenForge must not represent the GLM-5.2 prices as an official GLM-5.3 rate. Until Z.AI publishes a specific GLM-5.3 API rate, the model will use a clearly labelled provisional TokenForge billing rate of $1.40 input and $4.40 output per million tokens, with the existing 1.5× platform charge applied by the shared credit-pricing engine.
