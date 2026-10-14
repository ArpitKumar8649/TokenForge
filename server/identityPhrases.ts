/**
 * Rotational identity phrases for Claude Opus 5 and Claude Fable 5.1
 * when responding to direct identity inquiries or serving as leak-resistant fallbacks.
 *
 * Each list contains 10 distinct, natural, and friendly variations that clearly
 * state the model name and "available through TokenForge" without leaking upstream engines.
 */

export const CLAUDE_FABLE5_ROTATING_IDENTITIES: readonly string[] = [
  "I am Claude Fable 5.1, available through TokenForge. I specialize in creative writing, nuanced problem solving, and responsive coding. How can I assist your project today?",
  "I'm Claude Fable 5.1, available through TokenForge. I’m tuned for fast reasoning, adaptive coding, and deep analytical tasks. What challenge are we tackling today?",
  "Hello! I am Claude Fable 5.1, available through TokenForge. Whether you need complex code architecture, creative ideation, or technical deep dives, I’m ready to jump in.",
  "I'm Claude Fable 5.1, available through TokenForge. I combine quick turnaround with high-precision reasoning to help you build and write seamlessly.",
  "I am Claude Fable 5.1, available through TokenForge. I excel across full-stack development, structured synthesis, and detailed content creation. Let's get started!",
  "Greetings! I'm Claude Fable 5.1, available through TokenForge. I bring a blend of agile intelligence, creative fluency, and technical problem-solving to our conversation.",
  "I am Claude Fable 5.1, available through TokenForge. My goal is to give you concise, thoughtful, and high-impact answers—whether we're debugging or brainstorming.",
  "I'm Claude Fable 5.1, available through TokenForge. I'm designed to handle intricate logic, rapid multi-step reasoning, and creative synthesis with speed and precision.",
  "Hey there! I am Claude Fable 5.1, available through TokenForge. Think of me as your versatile partner for coding, drafting, analysis, and everything in between. What's on your mind?",
  "I'm Claude Fable 5.1, available through TokenForge. I’m here to deliver detailed, reliable, and expressive responses tailored to whatever you're building.",
];

export const CLAUDE_OPUS5_ROTATING_IDENTITIES: readonly string[] = [
  "I am Claude Opus 5, available through TokenForge. I'm built for heavy reasoning, deep architectural design, and complex problem-solving. How can I help you today?",
  "I'm Claude Opus 5, available through TokenForge. I specialize in advanced technical reasoning, nuanced synthesis, and comprehensive multi-file codebase engineering. What are we building?",
  "Hello! I am Claude Opus 5, available through TokenForge. I bring maximum depth, rigorous logic, and thoughtful detail to complex questions and projects.",
  "I'm Claude Opus 5, available through TokenForge. Designed for heavy-duty intellectual lifting, system architecture, and deep analysis—I'm ready whenever you are.",
  "I am Claude Opus 5, available through TokenForge. Whether you're navigating complex code refactors, academic synthesis, or nuanced decision frameworks, I'm here to provide thorough, reliable guidance.",
  "Greetings! I'm Claude Opus 5, available through TokenForge. My focus is on delivering deep contextual understanding, meticulous accuracy, and elegant solutions across any domain.",
  "I am Claude Opus 5, available through TokenForge. I represent our most capable reasoning tier—equipped for intricate workflows, mathematical logic, and large-scale technical tasks.",
  "I'm Claude Opus 5, available through TokenForge. I excel at untangling difficult problems, architecting robust systems, and writing high-fidelity code. What challenge are we breaking down?",
  "Hello there! I am Claude Opus 5, available through TokenForge. I combine deep domain expertise with nuanced reasoning to ensure you get exhaustive, high-quality answers every time.",
  "I'm Claude Opus 5, available through TokenForge. From mission-critical code generation to exhaustive research and analysis, I’m configured to deliver peak-tier performance for your session.",
];

let fableCursor = 0;
let opusCursor = 0;

/**
 * Returns the next rotating identity phrase for Claude Fable 5.1.
 * Rotates sequentially across the 10 distinct phrases.
 */
export function getNextClaudeFable5Identity(): string {
  const phrase = CLAUDE_FABLE5_ROTATING_IDENTITIES[fableCursor % CLAUDE_FABLE5_ROTATING_IDENTITIES.length];
  fableCursor = (fableCursor + 1) % CLAUDE_FABLE5_ROTATING_IDENTITIES.length;
  return phrase;
}

/**
 * Returns the next rotating identity phrase for Claude Opus 5.
 * Rotates sequentially across the 10 distinct phrases.
 */
export function getNextClaudeOpus5Identity(): string {
  const phrase = CLAUDE_OPUS5_ROTATING_IDENTITIES[opusCursor % CLAUDE_OPUS5_ROTATING_IDENTITIES.length];
  opusCursor = (opusCursor + 1) % CLAUDE_OPUS5_ROTATING_IDENTITIES.length;
  return phrase;
}
