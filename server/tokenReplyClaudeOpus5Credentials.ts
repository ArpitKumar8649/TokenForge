type TokenReplyClaudeOpus5CredentialSelection = {
  credential: string;
  slot: number;
  poolSize: number;
};

type TokenReplyClaudeOpus5Env = Record<string, string | undefined>;
type TokenReplyClaudeOpus5CredentialSource = TokenReplyClaudeOpus5Env | string[];

let rotationIndex = 0;

/** Returns only normalized credentials; callers must never log the returned values. */
export function getTokenReplyClaudeOpus5CredentialPool(source: TokenReplyClaudeOpus5CredentialSource = process.env) {
  const credentials = Array.isArray(source) ? source : [
    source.OPENCODE_CLAUDE_OPUS5_API_KEY,
    source.OPENCODE_CLAUDE_OPUS5_API_KEY_2,
    source.OPENCODE_CLAUDE_OPUS5_API_KEY_3,
    source.OPENCODE_CLAUDE_OPUS5_API_KEY_4,
    source.OPENCODE_CLAUDE_OPUS5_API_KEY_5,
    source.OPENCODE_CLAUDE_OPUS5_API_KEY_6,
    source.OPENCODE_CLAUDE_OPUS5_API_KEY_7,
  ];
  return credentials
    .map(credential => credential?.trim())
    .filter((credential): credential is string => Boolean(credential));
}

export function selectNextTokenReplyClaudeOpus5CredentialWithSlot(
  source: TokenReplyClaudeOpus5CredentialSource = process.env,
): TokenReplyClaudeOpus5CredentialSelection | null {
  const pool = getTokenReplyClaudeOpus5CredentialPool(source);
  if (!pool.length) return null;
  const selectedIndex = rotationIndex % pool.length;
  rotationIndex = (selectedIndex + 1) % pool.length;
  return { credential: pool[selectedIndex], slot: selectedIndex, poolSize: pool.length };
}

export function resetTokenReplyClaudeOpus5CredentialRotation() {
  rotationIndex = 0;
}
