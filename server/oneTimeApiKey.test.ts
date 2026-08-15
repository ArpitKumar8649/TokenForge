import { afterEach, describe, expect, it } from "vitest";
import { clearOneTimeApiKey, getOneTimeApiKey, rememberOneTimeApiKey } from "../shared/oneTimeApiKey";

describe("one-time dashboard API key memory", () => {
  afterEach(() => clearOneTimeApiKey());

  it("keeps a newly revealed key in page memory only until it is cleared", () => {
    expect(getOneTimeApiKey()).toBeNull();

    rememberOneTimeApiKey("tf_live_newly_created_example");
    expect(getOneTimeApiKey()).toBe("tf_live_newly_created_example");

    clearOneTimeApiKey();
    expect(getOneTimeApiKey()).toBeNull();
  });
});
