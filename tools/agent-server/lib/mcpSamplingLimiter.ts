export interface McpSamplingLimiterOptions {
  readonly maxConcurrent?: number;
  readonly maxRequestsPerMinute?: number;
  readonly maxTokensPerMinute?: number;
  readonly now?: () => number;
}

export type McpSamplingLimitReason = "concurrency" | "request_rate" | "token_budget";

export class McpSamplingLimiter {
  readonly #maxConcurrent: number;
  readonly #maxRequestsPerMinute: number;
  readonly #maxTokensPerMinute: number;
  readonly #now: () => number;
  readonly #usage: { at: number; tokens: number }[] = [];
  #concurrent = 0;

  constructor(options: McpSamplingLimiterOptions = {}) {
    this.#maxConcurrent = options.maxConcurrent ?? 2;
    this.#maxRequestsPerMinute = options.maxRequestsPerMinute ?? 30;
    this.#maxTokensPerMinute = options.maxTokensPerMinute ?? 12_000;
    this.#now = options.now ?? Date.now;
  }

  acquire(maxTokens: number | undefined): { readonly release: () => void } | { readonly denied: McpSamplingLimitReason } {
    const now = this.#now();
    while (this.#usage[0] && this.#usage[0].at <= now - 60_000) this.#usage.shift();
    if (this.#concurrent >= this.#maxConcurrent) return { denied: "concurrency" };
    if (this.#usage.length >= this.#maxRequestsPerMinute) return { denied: "request_rate" };
    const requestedTokens = typeof maxTokens === "number" && Number.isFinite(maxTokens) && maxTokens > 0 ? Math.ceil(maxTokens) : 0;
    const usedTokens = this.#usage.reduce((sum, entry) => sum + entry.tokens, 0);
    if (usedTokens + requestedTokens > this.#maxTokensPerMinute) return { denied: "token_budget" };
    this.#usage.push({ at: now, tokens: requestedTokens });
    this.#concurrent += 1;
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        this.#concurrent -= 1;
      },
    };
  }

  snapshot() {
    return {
      concurrent: this.#concurrent,
      requestsInWindow: this.#usage.length,
      tokensInWindow: this.#usage.reduce((sum, entry) => sum + entry.tokens, 0),
      limits: {
        maxConcurrent: this.#maxConcurrent,
        maxRequestsPerMinute: this.#maxRequestsPerMinute,
        maxTokensPerMinute: this.#maxTokensPerMinute,
      },
    };
  }
}

export function createMcpSamplingLimiter(options: McpSamplingLimiterOptions = {}) {
  return new McpSamplingLimiter(options);
}
