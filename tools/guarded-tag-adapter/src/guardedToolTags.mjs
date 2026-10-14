import { randomUUID } from "node:crypto";

export class GuardedTagError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GuardedTagError";
    this.code = code;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertSchema(value, schema, path = "arguments") {
  if (!schema || typeof schema !== "object") return;

  if (schema.type === "object") {
    if (!isPlainObject(value)) throw new GuardedTagError("INVALID_SCHEMA", `${path} must be an object.`);
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!(required in value)) throw new GuardedTagError("INVALID_SCHEMA", `${path}.${required} is required.`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) throw new GuardedTagError("INVALID_SCHEMA", `${path}.${key} is not allowed.`);
      }
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in value) assertSchema(value[key], propertySchema, `${path}.${key}`);
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) throw new GuardedTagError("INVALID_SCHEMA", `${path} must be an array.`);
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      throw new GuardedTagError("INVALID_SCHEMA", `${path} requires at least ${schema.minItems} item(s).`);
    }
    if (schema.items) value.forEach((item, index) => assertSchema(item, schema.items, `${path}[${index}]`));
    return;
  }

  if (schema.type === "string" && typeof value !== "string") {
    throw new GuardedTagError("INVALID_SCHEMA", `${path} must be a string.`);
  }
  if (schema.type === "integer" && !Number.isInteger(value)) {
    throw new GuardedTagError("INVALID_SCHEMA", `${path} must be an integer.`);
  }
  if (schema.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new GuardedTagError("INVALID_SCHEMA", `${path} must be a finite number.`);
  }
  if (schema.type === "boolean" && typeof value !== "boolean") {
    throw new GuardedTagError("INVALID_SCHEMA", `${path} must be a boolean.`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) {
    throw new GuardedTagError("INVALID_SCHEMA", `${path} is outside the allowed values.`);
  }
}

function extractSingle(raw, tag) {
  const matches = [...raw.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g"))];
  if (matches.length > 1) throw new GuardedTagError("DUPLICATE_TAG", `Only one <${tag}> block is permitted.`);
  return matches[0] ?? null;
}

function parseToolBody(body) {
  const json = body.trim();
  if (json.startsWith("{")) {
    const value = JSON.parse(json);
    if (!isPlainObject(value) || typeof value.name !== "string" || !isPlainObject(value.arguments)) {
      throw new GuardedTagError("INVALID_TOOL_SHAPE", "JSON tool call requires string name and object arguments.");
    }
    return { name: value.name, arguments: value.arguments };
  }

  const nameMatch = body.match(/^\s*<name>([^<]+)<\/name>\s*<parameters>([\s\S]*)<\/parameters>\s*$/);
  if (!nameMatch) throw new GuardedTagError("INVALID_TOOL_SHAPE", "Tool call must contain JSON or <name>/<parameters> blocks.");
  const name = nameMatch[1].trim();
  const argumentsValue = JSON.parse(nameMatch[2].trim());
  if (!name || !isPlainObject(argumentsValue)) {
    throw new GuardedTagError("INVALID_TOOL_SHAPE", "XML tool call requires a name and object parameters.");
  }
  return { name, arguments: argumentsValue };
}

export function parseGuardedToolTags(raw, allowedTools) {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new GuardedTagError("EMPTY_RESPONSE", "The model did not return a tag response.");
  }
  if (!isPlainObject(allowedTools)) throw new GuardedTagError("INVALID_CONFIG", "Allowed tool definitions are required.");

  const thinking = extractSingle(raw, "think");
  const toolCall = extractSingle(raw, "tool_call");
  const final = extractSingle(raw, "final");
  if (!toolCall) throw new GuardedTagError("MISSING_TOOL_CALL", "A tool request requires exactly one <tool_call> block.");
  if (final) throw new GuardedTagError("MIXED_RESPONSE", "A tool request cannot include <final> content.");

  const outside = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .trim();
  if (outside) throw new GuardedTagError("OUTSIDE_CONTRACT_TEXT", "Text outside approved tag blocks is rejected.");

  let parsed;
  try {
    parsed = parseToolBody(toolCall[1]);
  } catch (error) {
    if (error instanceof GuardedTagError) throw error;
    throw new GuardedTagError("INVALID_JSON", "Tool arguments are not valid JSON.");
  }

  const definition = allowedTools[parsed.name];
  if (!definition) throw new GuardedTagError("UNAUTHORIZED_TOOL", `Tool '${parsed.name}' is not allowed.`);
  assertSchema(parsed.arguments, definition.inputSchema);

  return {
    name: parsed.name,
    input: parsed.arguments,
    reasoningStripped: Boolean(thinking),
  };
}

export function parseGuardedResponse(raw, allowedTools) {
  const toolCall = extractSingle(raw, "tool_call");
  const final = extractSingle(raw, "final");
  const thinking = extractSingle(raw, "think");

  if (toolCall && final) {
    throw new GuardedTagError("MIXED_RESPONSE", "A response cannot mix a tool call and final content.");
  }
  if (toolCall) {
    return { type: "tool_use", ...parseGuardedToolTags(raw, allowedTools) };
  }
  if (!final) throw new GuardedTagError("MISSING_RESPONSE_TAG", "Response needs exactly one <tool_call> or <final> block.");

  const outside = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<final>[\s\S]*?<\/final>/g, "")
    .trim();
  if (outside) throw new GuardedTagError("OUTSIDE_CONTRACT_TEXT", "Text outside approved tag blocks is rejected.");
  if (!final[1].trim()) throw new GuardedTagError("EMPTY_FINAL", "Final content cannot be empty.");

  return { type: "text", text: final[1].trim(), reasoningStripped: Boolean(thinking) };
}

export function toAnthropicToolUseBlock(validatedCall, idFactory = () => `toolu_${randomUUID().replaceAll("-", "")}`) {
  return {
    type: "tool_use",
    id: idFactory(),
    name: validatedCall.name,
    input: validatedCall.input,
  };
}
