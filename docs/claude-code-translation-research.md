# Claude Code Translation Research

## Findings

Two implementation references were reviewed on 17 August 2026 before revising TokenForge's TokenRouter-backed Claude Code route.

| Requirement | Translation implication |
| --- | --- |
| Claude Code sends Anthropic Messages requests | TokenForge must accept and return Anthropic-compatible payloads at `/v1/messages`. |
| TokenRouter Claude routes are OpenAI-compatible for the validated chat path | The gateway should translate incoming Messages requests to Chat Completions instead of relying on the provider's native Messages endpoint. |
| Claude Code relies on streaming, tool calls, and tool-result continuation | The translator must preserve Anthropic SSE event framing, map tool definitions and `tool_use`/`tool_result` blocks, and retain stable tool-call identifiers across turns. |
| Model backends may have cache-sensitive prompt admission | TokenForge should consolidate injected model guidance into a single concise system message before forwarding. |

## Sources

1. [Olla: Anthropic API Translation](https://thushan.github.io/olla/integrations/api-translation/anthropic/) documents Anthropic-to-OpenAI request and response translation, SSE conversion, and Claude Code integration.
2. [UniClaudeProxy](https://github.com/vibheksoni/UniClaudeProxy) describes Claude Code support through Anthropic-to-OpenAI translation, including SSE output and tool-call identifier conversion.
