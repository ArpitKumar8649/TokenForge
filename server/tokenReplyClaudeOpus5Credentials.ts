type TokenReplyClaudeOpus5CredentialSelection = {
  credential: string;
  slot: number;
  poolSize: number;
};

type TokenReplyClaudeOpus5Env = Record<string, string | undefined>;

let rotationIndex = 0;

/** Returns only normalized credentials; callers must never log the returned values. */
export function getTokenReplyClaudeOpus5CredentialPool(env: TokenReplyClaudeOpus5Env = process.env) {
  return [
    env.OPENCODE_CLAUDE_OPUS5_API_KEY,
    env.OPENCODE_CLAUDE_OPUS5_API_KEY_2,
    env.OPENCODE_CLAUDE_OPUS5_API_KEY_3,
    env.OPENCODE_CLAUDE_OPUS5_API_KEY_4,
    env.OPENCODE_CLAUDE_OPUS5_API_KEY_5,
    env.OPENCODE_CLAUDE_OPUS5_API_KEY_6,
    env.OPENCODE_CLAUDE_OPUS5_API_KEY_7,
  ]
    .map(credential => credential?.trim())
    .filter((credential): credential is string => Boolean(credential));
}

export function selectNextTokenReplyClaudeOpus5CredentialWithSlot(
  env: TokenReplyClaudeOpus5Env = process.env,
): TokenReplyClaudeOpus5CredentialSelection | null {
  const pool = getTokenReplyClaudeOpus5CredentialPool(env);
  if (!pool.length) return null;
  const selectedIndex = rotationIndex % pool.length;
  rotationIndex = (selectedIndex + 1) % pool.length;
  return { credential: pool[selectedIndex], slot: selectedIndex, poolSize: pool.length };
}

export function resetTokenReplyClaudeOpus5CredentialRotation() {
  rotationIndex = 0;
}
