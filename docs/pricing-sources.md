# TokenForge model-credit pricing basis

Verified on 2026-08-14 (UTC). TokenForge will display charges as an internal, non-withdrawable promotional credit balance. The calculation excludes cached-input, long-context, tool, image, priority, and provider-reseller charges because the current TokenForge gateway receives only standard input and output token counts from its selected upstream route.

| TokenForge model | Standard input rate | Standard output rate | Source |
| --- | ---: | ---: | --- |
| GLM-5.2 | $1.40 per 1M tokens | $4.40 per 1M tokens | [Z.AI developer pricing](https://docs.z.ai/guides/overview/pricing) |
| Grok 4.5 | $2.00 per 1M tokens | $6.00 per 1M tokens | [xAI Grok 4.5 launch](https://x.ai/news/grok-4-5), [xAI developer pricing](https://docs.x.ai/developers/pricing) |

## Implementation rules

- Store amounts as signed **nanodollars** (1 USD = 1,000,000,000 nanodollars) to avoid floating-point drift and avoid rounding every low-cost request up to a cent.
- Grant a one-time $50.00 introductory promotional credit to each user when their credit account is created.
- Grant $5.00 promotional credit only once per UTC calendar day through the authenticated check-in procedure.
- Record every grant and successful request debit as an immutable ledger entry. Rejected and provider-error requests do not debit promotional credit.
- Debit based on provider-reported input and output token usage. The displayed rate is a public reference rate, not a representation of fxqidian wholesale costs or a provider invoice.
