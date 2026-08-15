# Pricing and API-key refresh validation

## 2026-08-15

The public Models catalogue renders both DeepSeek V4 aliases with non-zero rates. TypeScript plus focused credit-pricing, gateway, catalogue, and API-key cache tests passed (17 tests). The authenticated API-key screen’s screenshots were captured during its dependent-query loading state; its layout gates dashboard children until `auth.me` succeeds, and request logs confirm that authentication succeeds. The create, revoke, and rotate mutations now update the tRPC list cache synchronously, with regression coverage for insertion, deduplication, and revocation, so the dashboard does not require a page reload to show the changed key state.
