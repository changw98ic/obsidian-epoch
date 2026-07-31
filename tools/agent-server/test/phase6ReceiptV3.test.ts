import assert from "node:assert/strict";
import test from "node:test";

import {
  createPhase6ExperimentRuntime,
  type Phase6ResultReceipt,
} from "../lib/epoch/phase6ExperimentRuntime.ts";
import type { Phase6Experiment } from "../lib/epoch/phase6ExperimentRules.ts";
import {
  PHASE6_MATRIX_VERSION,
  PHASE6_AUTHORITATIVE_SCENARIO_MATRIX,
} from "../lib/epoch/phase6ScenarioMatrixRules.ts";
import type {
  Phase6ExperimentRuntimeTransactionStore,
  Phase6ExperimentRuntimeCommandRecord,
} from "../lib/epoch/phase6ExperimentRuntime.ts";

function makeInMemoryStore() {
  const experiments = new Map<string, Phase6Experiment>();
  const commands = new Map<string, Phase6ExperimentRuntimeCommandRecord>();

  const transactionStore: Phase6ExperimentRuntimeTransactionStore = {
    loadExperiment: async (id) => experiments.get(id),
    saveExperiment: async (exp) => { experiments.set(exp.experimentId, exp); },
    loadCommand: async (id) => commands.get(id),
    saveCommand: async (record) => { commands.set(record.commandId, record); },
  };

  return {
    store: {
      transaction: async <T>(fn: (store: Phase6ExperimentRuntimeTransactionStore) => T | Promise<T>) => fn(transactionStore),
    },
    experiments,
    commands,
  };
}

function makeReceipt(overrides?: Partial<Phase6ResultReceipt>): Phase6ResultReceipt {
  return {
    receiptId: "receipt-v2-1",
    receiptVersion: "journey_run_receipt.v2",
    experimentId: "exp-1",
    runIndex: 1,
    identity: { identityId: "identity-1" },
    explorer: { explorerId: "explorer-1" },
    versions: { rulesVersion: "v1", catalogVersion: "v1", codeVersion: "v1" },
    seed: { seed: "seed-1" },
    scenarioTag: "low-prepared-resource",
    matrixSnapshot: PHASE6_AUTHORITATIVE_SCENARIO_MATRIX,
    matrixVersion: PHASE6_MATRIX_VERSION,
    ...overrides,
  };
}

test("Phase6ResultReceipt: binds the canonical run-receipt version", () => {
  const receipt = makeReceipt();
  assert.equal(receipt.receiptVersion, "journey_run_receipt.v2");
  assert.equal(receipt.matrixVersion, PHASE6_MATRIX_VERSION);
  assert.equal(receipt.scenarioTag, "low-prepared-resource");
  assert.ok(receipt.matrixSnapshot);
});

test("completeRunWithReceipt: accepts the canonical run receipt", async () => {
  const { store } = makeInMemoryStore();
  const runtime = createPhase6ExperimentRuntime({ store, now: () => new Date() });

  const matrix = { ...PHASE6_AUTHORITATIVE_SCENARIO_MATRIX, matrixVersion: PHASE6_MATRIX_VERSION };
  const experiment = await runtime.createExperiment({
    commandId: "cmd-create",
    experimentId: "exp-1",
    identity: { identityId: "identity-1" },
    explorer: { explorerId: "explorer-1" },
    scenarioMatrix: matrix,
    versions: { rulesVersion: "v1", catalogVersion: "v1", codeVersion: "v1" },
  });

  await runtime.startRun({
    commandId: "cmd-start",
    experimentId: "exp-1",
    run: {
      runIndex: 1,
      identity: { identityId: "identity-1" },
      explorer: { explorerId: "explorer-1" },
      scenarioMatrix: matrix,
      versions: { rulesVersion: "v1", catalogVersion: "v1", codeVersion: "v1" },
      seed: { seed: "seed-1" },
      runReceipt: { receiptId: "run-receipt-1" },
    },
  });

  const receipt = makeReceipt();
  const completedRun = await runtime.completeRunWithReceipt({
    commandId: "cmd-complete",
    experimentId: "exp-1",
    runIndex: 1,
    receipt,
  });

  assert.equal(completedRun.state, "complete");
  assert.ok(completedRun.resultReceipt);
});

test("completeRunWithReceipt: rejects a canonical receipt with a wrong matrix version", async () => {
  const { store } = makeInMemoryStore();
  const runtime = createPhase6ExperimentRuntime({ store, now: () => new Date() });

  const matrix = { ...PHASE6_AUTHORITATIVE_SCENARIO_MATRIX, matrixVersion: PHASE6_MATRIX_VERSION };
  await runtime.createExperiment({
    commandId: "cmd-create",
    experimentId: "exp-1",
    identity: { identityId: "identity-1" },
    explorer: { explorerId: "explorer-1" },
    scenarioMatrix: matrix,
    versions: { rulesVersion: "v1", catalogVersion: "v1", codeVersion: "v1" },
  });

  await runtime.startRun({
    commandId: "cmd-start",
    experimentId: "exp-1",
    run: {
      runIndex: 1,
      identity: { identityId: "identity-1" },
      explorer: { explorerId: "explorer-1" },
      scenarioMatrix: matrix,
      versions: { rulesVersion: "v1", catalogVersion: "v1", codeVersion: "v1" },
      seed: { seed: "seed-1" },
      runReceipt: { receiptId: "run-receipt-1" },
    },
  });

  const badReceipt = makeReceipt({ matrixVersion: "phase6-matrix-v2" as typeof PHASE6_MATRIX_VERSION });
  await assert.rejects(
    () => runtime.completeRunWithReceipt({
      commandId: "cmd-complete",
      experimentId: "exp-1",
      runIndex: 1,
      receipt: badReceipt,
    }),
    /matrixVersion does not match/,
  );
});
