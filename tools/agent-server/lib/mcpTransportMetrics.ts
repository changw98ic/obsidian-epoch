type SamplingTerminal = "success" | "timeout" | "user_rejected" | "rate_limited" | "invalid_result" | "disconnect" | "provider_error" | "other";

function percentile(values: readonly number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

export class McpTransportMetrics {
  #sessionsCreated = 0;
  #sessionsClosed = 0;
  #samplingCapableSessions = 0;
  #streamsOpened = 0;
  #serverRequests = 0;
  #responsesMatched = 0;
  #responsesUnknown = 0;
  #toolSuccess = 0;
  #toolFailure = 0;
  readonly #toolDurations: number[] = [];
  readonly #sampling = new Map<SamplingTerminal, number>();

  sessionCreated() { this.#sessionsCreated += 1; }
  sessionInitialized(samplingCapable: boolean) { if (samplingCapable) this.#samplingCapableSessions += 1; }
  sessionClosed() { this.#sessionsClosed += 1; }
  streamOpened() { this.#streamsOpened += 1; }
  serverRequest() { this.#serverRequests += 1; }
  response(matched: boolean) { matched ? this.#responsesMatched += 1 : this.#responsesUnknown += 1; }
  toolCall(durationMs: number, success: boolean) {
    success ? this.#toolSuccess += 1 : this.#toolFailure += 1;
    this.#toolDurations.push(Math.max(0, durationMs));
    if (this.#toolDurations.length > 1_024) this.#toolDurations.shift();
  }
  samplingTerminal(details: Record<string, unknown>) {
    const value = details.outcome === "success"
      ? "success"
      : typeof details.fallback === "string" && [
          "timeout", "user_rejected", "rate_limited", "invalid_result", "disconnect", "provider_error",
        ].includes(details.fallback)
        ? details.fallback as SamplingTerminal
        : "other";
    this.#sampling.set(value, (this.#sampling.get(value) || 0) + 1);
  }
  snapshot() {
    const sampling = Object.fromEntries(this.#sampling);
    const samplingTotal = Object.values(sampling).reduce((sum, value) => sum + value, 0);
    const toolTotal = this.#toolSuccess + this.#toolFailure;
    const samplingTimeoutRate = samplingTotal ? Number(sampling.timeout || 0) / samplingTotal : 0;
    const toolFailureRate = toolTotal ? this.#toolFailure / toolTotal : 0;
    return {
      transport: {
        sessionsCreated: this.#sessionsCreated,
        sessionsClosed: this.#sessionsClosed,
        activeSessions: this.#sessionsCreated - this.#sessionsClosed,
        samplingCapableSessions: this.#samplingCapableSessions,
        streamsOpened: this.#streamsOpened,
        serverRequests: this.#serverRequests,
        responsesMatched: this.#responsesMatched,
        responsesUnknown: this.#responsesUnknown,
      },
      sampling: { total: samplingTotal, ...sampling },
      tools: {
        total: toolTotal,
        success: this.#toolSuccess,
        failure: this.#toolFailure,
        latencyMs: {
          p50: percentile(this.#toolDurations, 0.5),
          p95: percentile(this.#toolDurations, 0.95),
          p99: percentile(this.#toolDurations, 0.99),
        },
      },
      errorBudget: {
        samplingTimeoutRate,
        samplingTimeoutAlert: samplingTotal >= 20 && samplingTimeoutRate > 0.05,
        toolFailureRate,
        toolFailureAlert: toolTotal >= 20 && toolFailureRate > 0.01,
      },
    };
  }
}

export function createMcpTransportMetrics() {
  return new McpTransportMetrics();
}
