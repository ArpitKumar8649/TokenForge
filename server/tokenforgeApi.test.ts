import { describe, expect, it } from "vitest";
import {
  buildTokenForgeCurl,
  TOKENFORGE_API_BASE_URL,
  TOKENFORGE_API_KEY_PLACEHOLDER,
} from "../shared/tokenforgeApi";

describe("TokenForge hosted API guidance", () => {
  it("uses the assigned hosted production domain rather than the unbound custom hostname", () => {
    expect(TOKENFORGE_API_BASE_URL).toBe("https://tokengate-cqt9ivzs.manus.space");
    expect(buildTokenForgeCurl()).toContain(`${TOKENFORGE_API_BASE_URL}/v1/chat/completions`);
    expect(buildTokenForgeCurl()).toContain(`Authorization: Bearer ${TOKENFORGE_API_KEY_PLACEHOLDER}`);
  });

  it("can render a one-time new API key in the cURL guidance without requiring stored plaintext", () => {
    expect(buildTokenForgeCurl("tf_live_newly_created_example")).toContain(
      "Authorization: Bearer tf_live_newly_created_example",
    );
  });
});
