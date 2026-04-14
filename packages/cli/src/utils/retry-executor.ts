/** Retry executor with exponential backoff and jitter for resilient LLM/sidecar calls. */

export type RetryOptions = {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms (default: 30_000) */
  maxDelayMs?: number;
  /** Exponential multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add jitter to avoid thundering herd (default: true) */
  jitter?: boolean;
  /** Retry on these error codes (default: 429, 500, 502, 503, 504) */
  retryableStatuses?: number[];
};

const DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, opts: Required<RetryOptions>): number {
  const exponential = opts.initialDelayMs * opts.backoffMultiplier ** attempt;
  const capped = Math.min(exponential, opts.maxDelayMs);
  if (!opts.jitter) return capped;
  // Add ±25% jitter
  const jitterRange = capped * 0.25;
  return capped + (Math.random() - 0.5) * 2 * jitterRange;
}

function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  if (error instanceof Error) {
    // Check HTTP status in error message or properties
    const statusMatch = (error as unknown as Record<string, unknown>).status as number | undefined;
    if (statusMatch && retryableStatuses.includes(statusMatch)) return true;

    const message = error.message.toLowerCase();
    if (message.includes("rate limit") || message.includes("429")) return true;
    if (message.includes("too many requests")) return true;
    if (message.includes("service unavailable")) return true;
    if (message.includes("gateway timeout")) return true;

    // Network errors worth retrying
    if (message.includes("econnreset") || message.includes("econnrefused")) return true;
    if (message.includes("etimedout") || message.includes("socket hang up")) return true;
  }
  return false;
}

/**
 * Execute an async operation with exponential backoff retry.
 * Preserves error.cause chain per InariCode standards.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const options: Required<RetryOptions> = {
    maxRetries: opts.maxRetries ?? 3,
    initialDelayMs: opts.initialDelayMs ?? 1000,
    maxDelayMs: opts.maxDelayMs ?? 30_000,
    backoffMultiplier: opts.backoffMultiplier ?? 2,
    jitter: opts.jitter ?? true,
    retryableStatuses: opts.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.maxRetries) break;

      if (!isRetryableError(error, options.retryableStatuses)) {
        throw error; // Non-retryable, fail immediately
      }

      const delay = calculateDelay(attempt, options);
      // Log retry attempt if JSON logging is enabled
      if (process.env.INARI_LOG === "json") {
        const logLine = JSON.stringify({
          event: "retry_attempt",
          attempt,
          maxRetries: options.maxRetries,
          delayMs: Math.round(delay),
          error: error instanceof Error ? error.message : String(error),
        });
        process.stderr.write(`${logLine}\n`);
      }

      await sleep(delay);
    }
  }

  // Exhausted retries — rethrow with cause chain
  const err = lastError instanceof Error ? lastError : new Error(String(lastError));
  if (lastError instanceof Error && err !== lastError) {
    err.cause = lastError;
  }
  throw err;
}
