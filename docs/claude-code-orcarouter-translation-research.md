# Claude Code Compatibility Research: OrcaRouter Translation

## Scope

TokenForge will retain its existing OpenAI-compatible `/v1/chat/completions` path for both OrcaRouter-backed routes. A separate Anthropic-compatible `/v1/messages` adapter is required for `claude-opus-5` and `qwen3.8-27b` so Claude Code can submit Anthropic-style Messages payloads without passing unsupported content-block objects to an OpenAI-compatible upstream.

## Official Messages Contract

Anthropic’s Messages API is stateless: callers submit the entire conversation history in `messages`, use a top-level `system` field for global instructions, and receive an assistant response whose `content` is an array of typed blocks.[1] Anthropic documents basic user/assistant conversational turns as well as structured content such as text, images, and tool-use blocks.[1]

Claude Code can send content arrays rather than a plain string. The observed TokenForge error, `Unsupported content block at messages[n].content[0]`, is consistent with the existing native path forwarding those Anthropic block objects unchanged to an upstream route that accepts only OpenAI-style chat content. A compatibility adapter must therefore convert supported Anthropic request blocks into a safe OpenAI-style `messages` payload and convert the OpenAI-shaped response back to an Anthropic Messages response.

## Tool-Use Requirements

For client-side tool use, Anthropic documents an assistant `tool_use` block with an `id`, `name`, and structured `input`; the matching caller result is a user `tool_result` block referring to the original ID.[2] The result blocks must immediately follow their tool-use turn and come first in their user content array.[2]

Claude Code can also retain `thinking` or `redacted_thinking` blocks in assistant history. Anthropic requires those signed blocks to be replayed unchanged when a caller continues against its native Messages API.[3] An OpenAI-compatible upstream cannot verify or use those Anthropic signatures, so TokenForge will accept and omit them from the translated upstream transcript rather than leak private reasoning summaries, invent a signature, or reject the entire multi-turn conversation.

The adapter retains safe textual tool-result context but does not elevate untrusted tool output into system instructions. It translates standard `tool_use` definitions and responses between the Anthropic and OpenAI-compatible structures where the upstream emits them, returns generated text as Anthropic `text` blocks, and rejects unsupported image, document, and provider-specific non-textual blocks with an accurate 400 error rather than silently corrupting the conversation.

## Translation Boundary

| Input or output | Adapter behavior |
| --- | --- |
| Top-level Anthropic `system` text/blocks | Convert safe textual content into an OpenAI `system` message. |
| `user` and `assistant` text content | Convert to OpenAI chat messages with equivalent role and plain text. |
| `tool_use` / `tool_result` blocks | Preserve as labelled, serialized text context, including matching identifiers; never place tool-result data in a system message. |
| `thinking` / `redacted_thinking` history | Accept assistant-only blocks but omit their private, upstream-incompatible payload from the OpenAI transcript. |
| Image, document, search, computer-use, and provider-specific blocks | Return a transparent unsupported-content-block validation error. |
| OpenAI completion response | Return an Anthropic-style `message` object with a typed text content block and mapped token usage. |
| OpenAI streaming response | Convert upstream SSE text deltas to Anthropic Messages SSE events. |

## References

[1]: https://platform.claude.com/docs/en/build-with-claude/working-with-messages "Using the Messages API — Claude Platform Docs"
[2]: https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls "Handle tool calls — Claude Platform Docs"
[3]: https://platform.claude.com/docs/en/build-with-claude/thinking "Thinking — Claude Platform Docs"
