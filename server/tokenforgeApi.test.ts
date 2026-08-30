import { describe, expect, it } from "vitest";
import {
  buildTokenForgeCurl,
  buildTokenForgeJavaScript,
  buildTokenForgePython,
  TOKENFORGE_API_BASE_URL,
  TOKENFORGE_API_KEY_PLACEHOLDER,
} from "../shared/tokenforgeApi";

describe("TokenForge hosted API guidance", () => {
  it("uses the assigned hosted production domain rather than the unbound custom hostname", () => {
    expect(TOKENFORGE_API_BASE_URL).toBe("https://tokenforge-api-0mrs.onrender.com");
    expect(buildTokenForgeCurl()).toContain(`${TOKENFORGE_API_BASE_URL}/v1/chat/completions`);
    expect(buildTokenForgeCurl()).toContain(`Authorization: Bearer ${TOKENFORGE_API_KEY_PLACEHOLDER}`);
  });

  it("can render a one-time new API key in the cURL guidance without requiring stored plaintext", () => {
    expect(buildTokenForgeCurl("tf_live_newly_created_example")).toContain(
      "Authorization: Bearer tf_live_newly_created_example",
    );
  });

  it("renders canonical OpenAI-compatible JavaScript and Python quick-starts with a safe placeholder by default", () => {
    const javaScript = buildTokenForgeJavaScript();
    const python = buildTokenForgePython();

    expect(javaScript).toContain('import OpenAI from "openai"');
    expect(javaScript).toContain(`baseURL: "${TOKENFORGE_API_BASE_URL}/v1"`);
    expect(javaScript).toContain(`apiKey: "${TOKENFORGE_API_KEY_PLACEHOLDER}"`);
    expect(python).toContain("from openai import OpenAI");
    expect(python).toContain(`base_url="${TOKENFORGE_API_BASE_URL}/v1"`);
    expect(python).toContain(`api_key="${TOKENFORGE_API_KEY_PLACEHOLDER}"`);
  });

  it("can safely inject a newly created plaintext key into both SDK quick-starts", () => {
    const newKey = "tf_live_newly_created_example";

    expect(buildTokenForgeJavaScript(newKey)).toContain(`apiKey: "${newKey}"`);
    expect(buildTokenForgePython(newKey)).toContain(`api_key="${newKey}"`);
  });
});
