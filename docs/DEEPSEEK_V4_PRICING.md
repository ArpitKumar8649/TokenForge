# DeepSeek V4 Pricing Decision

TokenForge currently forwards **both** `deepseek-v4-flash` and `deepseek-v4-pro` aliases to TokenHarbor’s shared `deepseek-v4-flash:free` upstream ID. The gateway therefore applies the official **DeepSeek V4 Flash cache-miss** rates to both aliases: **$0.14 per million input tokens** and **$0.28 per million output tokens**. This preserves a non-zero, transparent promotional-credit deduction while matching the model actually requested upstream.

DeepSeek’s official platform lists native V4 Pro at **$0.435 per million cache-miss input tokens** and **$0.87 per million output tokens**, but TokenForge does not apply those Pro rates while the compatibility alias still executes the Flash model. If the upstream route is later changed to native `deepseek-v4-pro`, update the Pro alias to those official values at the same time.

TokenForge does not receive provider cache-hit accounting through this shared route, so it uses cache-miss input pricing rather than the discounted cache-hit rates. DeepSeek states that pricing may change and its detailed pricing page announces a peak/off-peak schedule effective **2026-08-16 16:00 UTC**; revisit the rate table before that effective date.[1] [2]

| Official native model | Cache-hit input / 1M | Cache-miss input / 1M | Output / 1M | TokenForge treatment now |
|---|---:|---:|---:|---|
| DeepSeek V4 Flash | $0.0028 | $0.14 | $0.28 | Applied to both aliases because both route to Flash. |
| DeepSeek V4 Pro | $0.003625 | $0.435 | $0.87 | Documented only until a native Pro upstream is enabled. |

## References

[1]: https://www.deepseek.com/platform/ "DeepSeek API Platform — V4 series pricing"
[2]: https://api-docs.deepseek.com/quick_start/pricing "DeepSeek API Docs — Models & Pricing"
