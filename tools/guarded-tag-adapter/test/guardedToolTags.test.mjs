import assert from "node:assert/strict";
import test from "node:test";
import { GuardedTagError, parseGuardedResponse, parseGuardedToolTags, toAnthropicToolUseBlock } from "../src/guardedToolTags.mjs";

const allowedTools = {
  Read: {
    inputSchema: {
      type: "object",
      properties: { file_path: { type: "string" } },
      required: ["file_path"],
      additionalProperties: false,
    },
  },
};

test("accepts one valid JSON tool block and strips reasoning", () => {
  const call = parseGuardedToolTags(
    '<think>private text</think><tool_call>{"name":"Read","arguments":{"file_path":"fixture.txt"}}</tool_call>',
    allowedTools,
  );
  assert.deepEqual(call, { name: "Read", input: { file_path: "fixture.txt" }, reasoningStripped: true });
  assert.deepEqual(toAnthropicToolUseBlock(call, () => "toolu_test"), {
    type: "tool_use", id: "toolu_test", name: "Read", input: { file_path: "fixture.txt" },
  });
});

test("accepts one valid XML ReAct tool block", () => {
  const call = parseGuardedToolTags(
    '<tool_call><name>Read</name><parameters>{"file_path":"fixture.txt"}</parameters></tool_call>',
    allowedTools,
  );
  assert.equal(call.name, "Read");
});

test("accepts one final block while stripping reasoning", () => {
  assert.deepEqual(
    parseGuardedResponse("<think>private</think><final>TOOL_OK</final>", allowedTools),
    { type: "text", text: "TOOL_OK", reasoningStripped: true },
  );
});

for (const [name, raw, code] of [
  ["duplicate tools", '<tool_call>{"name":"Read","arguments":{"file_path":"a"}}</tool_call><tool_call>{"name":"Read","arguments":{"file_path":"b"}}</tool_call>', "DUPLICATE_TAG"],
  ["unauthorized tool", '<tool_call>{"name":"Bash","arguments":{"command":"id"}}</tool_call>', "UNAUTHORIZED_TOOL"],
  ["stray prose", 'calling tool <tool_call>{"name":"Read","arguments":{"file_path":"a"}}</tool_call>', "OUTSIDE_CONTRACT_TEXT"],
  ["invalid schema", '<tool_call>{"name":"Read","arguments":{"path":"a"}}</tool_call>', "INVALID_SCHEMA"],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => parseGuardedToolTags(raw, allowedTools), (error) => error instanceof GuardedTagError && error.code === code);
  });
}
