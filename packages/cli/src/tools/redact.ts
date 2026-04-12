/**
 * Best-effort redaction of secrets from tool output before it reaches the model or terminal.
 */

const AWS_KEY = /\bAKIA[0-9A-Z]{16}\b/g;
const OPENAI_SK = /\bsk-proj-[A-Za-z0-9_-]+\b/g;
const OPENAI_LONG = /\bsk-[A-Za-z0-9]{48,}\b/g;
const ANTHROPIC_SK = /\bsk-ant-[A-Za-z0-9\-_]{40,}\b/gi;
const ASSIGN_SECRET =
  /\b(api[_-]?key|apikey|client_secret|secret|password|token|bearer)\b\s*[:=]\s*[^\s"'`]{8,}/gi;

export function redactToolOutput(text: string): string {
  let s = text;
  s = s.replace(AWS_KEY, "[REDACTED]");
  s = s.replace(OPENAI_SK, "[REDACTED]");
  s = s.replace(OPENAI_LONG, "[REDACTED]");
  s = s.replace(ANTHROPIC_SK, "[REDACTED]");
  s = s.replace(ASSIGN_SECRET, (m) => m.replace(/[:=]\s*[^\s"'`]{8,}/, ":= [REDACTED]"));
  return s;
}
