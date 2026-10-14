# Supplied-document integration notes

## Adopted requirements

The supplied documents informed four changes to the TokenForge draft. A visually distinct public landing page now uses a warm forge palette, editorial typography, responsive motion, and an animated mesh-gradient TokenForge glyph. A branded overlay appears for roughly 2.4 seconds on full reload and client-side route changes, with a reduced-motion fallback. A public, read-only `/demo` workspace presents illustrative quota, catalogue, API-key, and activity surfaces. A `/pricing` page now explains the current free beta and future capacity conversation.

## Security and product-boundary decisions

The requested “functional user access” was **not** implemented as an authenticated-user bypass. Instead, `/demo` is explicitly disconnected from account data, API keys, provider calls, usage records, and administration procedures. This preserves the existing protected API-key lifecycle and prevents demo visitors from receiving a real credential or interacting with model capacity.

The supplied pricing component proposed $0, $49, and $149 recurring plans. TokenForge has no configured billing integration, paid entitlement model, or published paid capacity. The integrated page therefore states only the verified free-beta limits—100 requests, 100,000 tokens, and the existing two-model catalogue—and renders later availability as a waitlist or launch-readiness conversation. It does not imply checkout, billing, unlimited usage, a service level, or unavailable team capabilities.

The supplied visual snippet referenced a `RippleButton` component that was not included in the uploaded material. The final implementation uses the project’s accessible interactive primitives and text links rather than inventing or embedding an undocumented dependency. The `@paper-design/shaders-react` dependency was used for the supplied mesh-gradient visual direction.

## Deferred requirements

No instruction in the supplied material changes the existing launch deferrals: transactional-email configuration, tokenized email verification, live OAuth completion validation, and authenticated end-to-end streaming/quota walkthroughs remain launch-preparation work. These requirements remain separated from the current public draft and are not represented as completed functionality.
