/** Concurrency-limited async executor for tool calls to prevent resource exhaustion. */

type PendingTask<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class ConcurrencyPool {
  private concurrency: number;
  private running = 0;
  private queue: PendingTask<unknown>[] = [];

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
  }

  /** Execute a task, respecting concurrency limits. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.concurrency) {
      this.running++;
      try {
        return await fn();
      } finally {
        this.running--;
        this.processQueue();
      }
    }

    // Queue the task
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject } as PendingTask<unknown>);
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.concurrency) return;

    const task = this.queue.shift()!;
    this.running++;
    task
      .fn()
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        this.running--;
        this.processQueue();
      });
  }

  /** Get current stats for observability */
  stats(): { running: number; queued: number; concurrency: number } {
    return { running: this.running, queued: this.queue.length, concurrency: this.concurrency };
  }
}

/** Default global tool executor with concurrency limit of 3 */
const defaultPool = new ConcurrencyPool(3);

/**
 * Execute a tool through the concurrency-limited pool.
 * Use for I/O-heavy operations like codebase_search or file reads.
 */
export async function executeTool<T>(fn: () => Promise<T>): Promise<T> {
  return defaultPool.run(fn);
}

/** Create a custom pool with different concurrency limits */
export function createConcurrencyPool(concurrency: number): ConcurrencyPool {
  return new ConcurrencyPool(concurrency);
}
