import { describe, expect, it } from "vitest";
import { getTokenRouterCredentialPool } from "./tokenRouterCredentials";

const runLiveProbe = process.env.RUN_TOKENFORGE_GLM53_TOOL_PROBE === "1";
const liveIt = runLiveProbe ? it : it.skip;
const baseUrl = process.env.TOKENROUTER_BASE_URL?.replace(/\/$/, "");
const model = process.env.TOKENROUTER_GLM53_MODEL?.trim();

describe("TokenRouter GLM 5.3 tool-result continuation", () => {
	liveIt("reports whether an authentic provider tool-call reasoning field can be replayed for a native continuation", async () => {
		expect(baseUrl).toBeTruthy();
		expect(model).toBeTruthy();

		const initialPayload = {
			model,
			messages: [
				{ role: "system", content: "Use the provided repository tools when required." },
				{ role: "user", content: "Inspect the repository root with the List tool." },
			],
			tools: [{
				type: "function",
        function: {
          name: "List",
          description: "List a repository directory.",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        },
			}],
			tool_choice: "required",
			max_tokens: 128,
			stream: false,
		};

		const results: Array<{ slot: number; initialStatus: number; continuationStatus?: number; hasReasoningContent?: boolean; response: string }> = [];
		for (const [index, credential] of getTokenRouterCredentialPool().entries()) {
			let initialResponse: Response;
			try {
				initialResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
					method: "POST",
					headers: { Authorization: `Bearer ${credential}`, Accept: "application/json", "Content-Type": "application/json" },
					body: JSON.stringify(initialPayload),
					signal: AbortSignal.timeout(30_000),
				});
			} catch (error) {
				results.push({ slot: index + 1, initialStatus: 0, response: error instanceof Error ? error.message : "Network error" });
				continue;
			}
			const initialText = await initialResponse.text();
			if (!initialResponse.ok) {
				results.push({ slot: index + 1, initialStatus: initialResponse.status, response: initialText.slice(0, 1_000) });
				continue;
			}

			const initialPayloadJson = JSON.parse(initialText) as { choices?: Array<{ message?: Record<string, unknown> }> };
			const assistantMessage = initialPayloadJson.choices?.[0]?.message;
			const toolCalls = Array.isArray(assistantMessage?.tool_calls) ? assistantMessage.tool_calls as Array<{ id?: unknown }> : [];
			const hasReasoningContent = typeof assistantMessage?.reasoning_content === "string" && assistantMessage.reasoning_content.length > 0;
			const toolCallId = typeof toolCalls[0]?.id === "string" ? toolCalls[0].id : undefined;
			if (!assistantMessage || !toolCallId) {
				results.push({ slot: index + 1, initialStatus: initialResponse.status, hasReasoningContent, response: initialText.slice(0, 1_000) });
				continue;
			}

			let continuationResponse: Response;
			try {
				continuationResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
					method: "POST",
					headers: { Authorization: `Bearer ${credential}`, Accept: "application/json", "Content-Type": "application/json" },
					body: JSON.stringify({
						...initialPayload,
						tool_choice: "auto",
						messages: [
							...initialPayload.messages,
							assistantMessage,
							{ role: "tool", tool_call_id: toolCallId, content: "README.md\npackage.json\nserver" },
						],
					}),
					signal: AbortSignal.timeout(30_000),
				});
			} catch (error) {
				results.push({ slot: index + 1, initialStatus: initialResponse.status, hasReasoningContent, response: error instanceof Error ? error.message : "Network error" });
				continue;
			}
			const continuationText = await continuationResponse.text();
			console.info("[GLM 5.3 native tool continuation]", { slot: index + 1, initialStatus: initialResponse.status, continuationStatus: continuationResponse.status, hasReasoningContent });
			results.push({ slot: index + 1, initialStatus: initialResponse.status, continuationStatus: continuationResponse.status, hasReasoningContent, response: continuationText.slice(0, 1_000) });
			if (continuationResponse.ok) return;
		}

		throw new Error(`GLM 5.3 native tool-result continuation was not accepted by any TokenRouter slot: ${JSON.stringify(results)}`);
	}, 275_000);
});
