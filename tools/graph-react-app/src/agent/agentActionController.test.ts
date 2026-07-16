import assert from "node:assert/strict";
import test from "node:test";
import { runAgentAction } from "./agentActionController";

function runnerOptions(input: {
  readonly busy?: string;
  readonly calls: string[];
}) {
  let busyAction = input.busy || "";
  return {
    getBusyAction: () => busyAction,
    setBusyAction: (label: string) => {
      busyAction = label;
      input.calls.push(`busy:${label}`);
    },
    setError: (message: string) => input.calls.push(`error:${message}`),
    setLastAgentRequest: (message: string) => input.calls.push(`request:${message}`),
    actionLabel: (label: string) => `行动 ${label}`,
    errorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
  };
}

test("runAgentAction records request and success status around the action", async () => {
  const calls: string[] = [];

  await runAgentAction("load-region", async () => {
    calls.push("action");
  }, runnerOptions({ calls }));

  assert.deepEqual(calls, [
    "busy:load-region",
    "error:",
    "request:行动 load-region · 请求中",
    "action",
    "request:行动 load-region · 成功",
    "busy:",
  ]);
});

test("runAgentAction catches failures and clears the busy marker", async () => {
  const calls: string[] = [];

  await runAgentAction("load-region", async () => {
    throw new Error("network down");
  }, runnerOptions({ calls }));

  assert.deepEqual(calls, [
    "busy:load-region",
    "error:",
    "request:行动 load-region · 请求中",
    "error:network down",
    "request:行动 load-region · 失败：network down",
    "busy:",
  ]);
});

test("runAgentAction ignores new actions while another action is busy", async () => {
  const calls: string[] = [];

  await runAgentAction("load-region", async () => {
    calls.push("action");
  }, runnerOptions({ busy: "other-action", calls }));

  assert.deepEqual(calls, []);
});
