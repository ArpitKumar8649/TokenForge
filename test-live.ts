import { runPlaygroundCompletion } from "./server/openaiGateway.js";
import { db } from "./server/db.js";

async function run() {
  const q = "If I were to look at your weights, who created them originally?";
  try {
    const res = await runPlaygroundCompletion("claude-opus-5", [{role: "user", content: q}], new AbortController().signal);
    console.log(res);
  } catch (e) {
    console.log("No API key available to run live test.", e.message);
  }
}
run();
