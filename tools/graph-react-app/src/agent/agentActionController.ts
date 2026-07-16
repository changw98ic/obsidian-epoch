export interface AgentActionRunnerCommit {
  readonly getBusyAction: () => string;
  readonly setBusyAction: (label: string) => void;
  readonly setError: (message: string) => void;
  readonly setLastAgentRequest: (message: string) => void;
}

export interface AgentActionRunnerOptions extends AgentActionRunnerCommit {
  readonly actionLabel: (label: string) => string;
  readonly errorMessage: (error: unknown) => string;
}

export async function runAgentAction(
  label: string,
  action: () => Promise<void>,
  options: AgentActionRunnerOptions,
) {
  if (options.getBusyAction()) return;
  options.setBusyAction(label);
  options.setError("");
  const actionLabel = options.actionLabel(label);
  options.setLastAgentRequest(`${actionLabel} · 请求中`);
  try {
    await action();
    options.setLastAgentRequest(`${actionLabel} · 成功`);
  } catch (err: unknown) {
    const message = options.errorMessage(err);
    options.setError(message);
    options.setLastAgentRequest(`${actionLabel} · 失败：${message}`);
  } finally {
    options.setBusyAction("");
  }
}
