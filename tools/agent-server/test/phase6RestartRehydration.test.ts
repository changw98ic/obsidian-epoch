import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { after } from "node:test";

import { createJourneyRunReceiptSqliteStore } from "../lib/epoch/journeyRunReceiptStore.ts";
import {
  attachPhase6CommittedResultForPersistence,
  createPhase6CommittedResultSqliteStore,
  phase6CommittedResultsForPersistence,
} from "../lib/epoch/phase6CommittedResultStore.ts";
import {
  createPhase6ExperimentSqliteStore,
  initializePhase6ExperimentSchema,
} from "../lib/epoch/phase6ExperimentStore.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { epochEventsForPersistence } from "../lib/epoch/runtimePublicProjectionRules.ts";
import { journeyEventsForPersistence } from "../lib/epoch/journeyPersistence.ts";
import {
  createAgentWorldMcpRuntime,
  createAgentWorldRemoteMcpRuntime,
  createAgentWorldRuntime,
  type AgentWorldMcpRuntime,
} from "../lib/mcpTools.ts";
import { createAgentHttpServer } from "../lib/httpServer.ts";
import { runWithMcpRequestAuthContext } from "../lib/mcpRequestAuthContext.ts";
import { runWithMcpRequestContext } from "../lib/mcpRequestContext.ts";
import { PlayerMcpAccessTokenStore } from "../lib/playerMcpAccessTokenStore.ts";
import {
  appendSqliteJsonl,
  createAgentSqlitePersistenceStores,
  loadAgentRuntimeOptionsFromSqlite,
} from "../lib/sqliteStore.ts";

type JsonRecord = Record<string, unknown>;

const TEST_RUNTIME_ACTION_SIGNING_PRIVATE_KEY = generateKeyPairSync("ed25519")
  .privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
const previousRuntimeActionSigningPrivateKey = process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = TEST_RUNTIME_ACTION_SIGNING_PRIVATE_KEY;
after(() => {
  if (previousRuntimeActionSigningPrivateKey === undefined) {
    delete process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
  } else {
    process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = previousRuntimeActionSigningPrivateKey;
  }
});

test("public commits survive restart, finalize, and a second restart with readable Phase 6 results", async () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-restart-"));
  const sqlitePath = join(root, "phase6.sqlite");
  try {
    const runtime1 = await openRuntime(sqlitePath, "runtime1", true);
    const journey = await startPhase6Journey(runtime1, "positive");
    const committed = await settleJourney(runtime1, journey, true);
    assert.equal(record(committed.journey).status, "settled");

    const persistedCommits = runtime1.committedStore?.listByJourneyId(journey.journeyId) ?? [];
    assert.ok(persistedCommits.length > 0);
    assert.equal(persistedCommits.length, runtime1.persistedCommits());
    assert.deepEqual(new Set(runtime1.publicCommitTools()), new Set([
      "obsidian_epoch.commit_journey_action_compact",
      "obsidian_epoch.commit_journey_action",
    ]));
    assert.equal(record(record(persistedCommits[0]?.result).journey).journeyId, journey.journeyId);
    const storedHostedEvents = persistedCommits.flatMap((entry) =>
      epochEventsForPersistence(entry.result)
        .filter((event) => event.eventType === "hosted_action_recorded"));
    assert.ok(storedHostedEvents.length > 0, JSON.stringify(persistedCommits));
    assert.ok(
      storedHostedEvents.some((event) => record(record(event).payload).journeyResolution),
      "sidecar must expose authoritative journey resolution evidence",
    );

    runtime1.close();

    const runtime2 = await openRuntime(sqlitePath, "runtime2", true);
    const firstStatus = await statusByJourneyId(runtime2, journey);
    const firstSettlement = record(firstStatus.phase6Settlement);
    const firstReceipt = record(firstSettlement.receipt);
    assert.equal(firstSettlement.ok, true, JSON.stringify(firstSettlement));
    assert.equal(firstReceipt.version, "journey_run_receipt.v2");
    assert.equal(firstReceipt.journeyId, journey.journeyId);
    assert.ok(String(firstReceipt.receiptId || "").length > 0);
    assert.ok(receiptEventIds(firstReceipt).length > 0);

    const sidecarRowsAfterFirstFinalize = runtime2.committedStore?.listByJourneyId(journey.journeyId).length;
    const secondStatus = await statusByJourneyId(runtime2, journey);
    const secondSettlement = record(secondStatus.phase6Settlement);
    const secondReceipt = record(secondSettlement.receipt);
    assert.equal(secondSettlement.ok, true, JSON.stringify(secondSettlement));
    assert.equal(secondReceipt.receiptId, firstReceipt.receiptId);
    assert.deepEqual(secondReceipt, firstReceipt);
    assert.deepEqual(receiptEventIds(secondReceipt), receiptEventIds(firstReceipt));
    assert.equal(
      runtime2.committedStore?.listByJourneyId(journey.journeyId).length,
      sidecarRowsAfterFirstFinalize,
    );
    const pageId = String(firstSettlement.pageId || "");
    assert.ok(pageId);
    assert.equal(rowCount(
      runtime2.database,
      "SELECT COUNT(*) AS count FROM result_pages WHERE page_id = ?",
      pageId,
    ), 1);
    runtime2.close();

    const runtime3 = await openRuntime(sqlitePath, "runtime3", true);
    const fullResult = payload(await runtime3.mcp.callTool("obsidian_epoch.phase6_result", { pageId }));
    const compactResult = payload(await runtime3.mcp.callTool("obsidian_epoch.phase6_result_compact", { pageId }));
    assert.equal(fullResult.pageId, pageId);
    assert.equal(compactResult.pageId, pageId);
    assert.equal(fullResult.receiptId, firstReceipt.receiptId);
    assert.equal(compactResult.receiptId, firstReceipt.receiptId);
    const fullPage = record(fullResult.result);
    const compactPage = record(compactResult.result);
    const fullPageReceipt = record(fullPage.receipt);
    const compactPageReceipt = record(compactPage.receipt);
    assert.equal(fullPageReceipt.receiptId, firstReceipt.receiptId);
    assert.equal(compactPageReceipt.receiptId, firstReceipt.receiptId);
    assert.equal(compactPageReceipt.payloadHash, fullPageReceipt.payloadHash);
    const fullIntegrity = record(record(record(fullPage.sections).audit).integrity);
    const compactIntegrity = record(record(record(compactPage.sections).audit).integrity);
    assert.equal(compactIntegrity.receiptPayloadHash, fullIntegrity.receiptPayloadHash);
    assert.equal(compactIntegrity.resultPagePayloadHash, fullIntegrity.resultPagePayloadHash);
    runtime3.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("failed Phase 6 settlement snapshots identity loss before receipt and accepts a verified reincarnation", async () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-reincarnation-"));
  const sqlitePath = join(root, "phase6.sqlite");
  try {
    const runtime = await openRuntime(sqlitePath, "reincarnation", true);
    const journey = await startPhase6Journey(runtime, "reincarnation");
    const committed = await settleJourney(runtime, journey, false, "skip_first_main");
    assert.equal(record(committed.journey).status, "settled");

    const status = await statusByJourneyId(runtime, journey);
    const settlement = record(status.phase6Settlement);
    const receipt = record(settlement.receipt);
    assert.equal(settlement.ok, true, JSON.stringify(settlement));
    const afterBody = record(record(record(receipt.snapshots).after).body);
    assert.equal(record(record(afterBody.identity).playerIdentity).status, "archived");
    const archiveRow = runtime.database.prepare(`
      SELECT event_id AS eventId
      FROM epoch_events
      WHERE event_type = 'identity_archived' AND agent_id = ?
      ORDER BY record_id DESC
      LIMIT 1
    `).get(journey.agentId) as { readonly eventId?: string } | undefined;
    assert.ok(archiveRow?.eventId);
    assert.ok(receiptEventIds(receipt).includes(archiveRow.eventId));

    const reincarnated = await callAndPersist(runtime, "obsidian_epoch.reincarnate", {
      previousAgentId: journey.agentId,
      identityName: "Phase 6 Reincarnation",
      recoveryCode: journey.recoveryCode,
      idempotencyKey: "phase6-reincarnate-after-run-1",
    });
    const nextAgentId = String(record(reincarnated.value).agentId || "");
    assert.ok(nextAgentId);
    assert.notEqual(nextAgentId, journey.agentId);
    const experimentStatus = payload(await runtime.mcp.callTool("obsidian_epoch.phase6_experiment_status", {
      experimentId: journey.experimentId,
    }));
    assert.equal(experimentStatus.identityId, journey.agentId);
    const nextArchive = payload(await runtime.mcp.callTool("obsidian_epoch.identity_archive", {
      agentId: nextAgentId,
    }));
    const lineage = nextArchive.lineage;
    assert.ok(Array.isArray(lineage));
    assert.ok(lineage.includes(journey.agentId));

    const prepared = await callAndPersist(runtime, "obsidian_epoch.prepare_journey", {
      agentId: nextAgentId,
      destinationRegionId: "灰港",
      taskType: "information_acquisition",
      recoveryCode: journey.recoveryCode,
      idempotencyKey: "prepare-reincarnated-run-2",
    });
    const preparedJourney = record(prepared.journey);
    const nextRun = payload(await runtime.mcp.callTool("obsidian_epoch.begin_phase6_run", {
      commandId: "run-reincarnated-2",
      experimentId: journey.experimentId,
      runIndex: 2,
      scenarioTag: "low-underprepared-information",
      journeyId: preparedJourney.journeyId,
    }));
    assert.equal(record(nextRun.identity).identityId, nextAgentId);
    assert.equal(record(nextRun.explorer).explorerId, journey.explorerId);
    runtime.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("HTTP remote compact commit has one atomic persistence owner and replays idempotently", async () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-http-owner-"));
  const sqlitePath = join(root, "phase6.sqlite");
  const stores = createAgentSqlitePersistenceStores(sqlitePath);
  let journeySequence = 0;
  const realNow = "2026-07-21T00:00:00.000Z";
  const worldNow = "2026-01-01T08:00:00.000Z";
  const runtime = createAgentWorldRuntime({
    journey: {
      idFactory: (kind: "journey" | "event") =>
        `${kind}_http_owner_${String(++journeySequence).padStart(4, "0")}`,
      now: () => realNow,
      worldNow: () => worldNow,
    },
    infiniteWorld: {
      now: () => realNow,
      nowMs: () => Date.parse(realNow),
    },
    worldClock: { nowReal: () => worldNow },
    worldSimulation: { nowReal: () => worldNow },
    epoch: {
      idFactory: createSequentialEpochIdFactory("http_owner"),
      clock: () => new Date(realNow),
      phase6RunAssemblyRepository: createJourneyRunReceiptSqliteStore(stores.database),
      phase6JourneyContextStore: stores.phase6JourneyContextStore,
      phase6ExperimentStore: stores.phase6ExperimentStore,
      phase6CommittedResultStore: createPhase6CommittedResultSqliteStore(stores.database),
      phase6RagTraceStore: stores.phase6RagTraceStore,
    },
  });
  const playerMcpAccessTokens = await PlayerMcpAccessTokenStore.open({
    jsonlPath: join(root, "player-mcp-tokens.jsonl"),
  });
  const server = createAgentHttpServer({
    runtime,
    persistJsonl: (fileName, value) => appendSqliteJsonl(sqlitePath, fileName, value),
    health: { store: { kind: "sqlite", sqlitePath } },
    playerMcpAccessTokens,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const serverBase = `http://127.0.0.1:${address.port}`;

  try {
    const suffix = "http-owner";
    const pairingResponse = await fetch(`${serverBase}/api/epoch/pairing/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: `pair-${suffix}` }),
    });
    const pairing = record(await pairingResponse.json());
    assert.equal(pairingResponse.status, 201, JSON.stringify(pairing));
    const explorerId = String(pairing.explorerId || "");
    const recoveryCode = String(pairing.recoveryCode || "");
    const agentId = String(pairing.agentId || "");
    assert.ok(explorerId);
    assert.ok(recoveryCode);
    assert.ok(agentId);
    const tokenResponse = await fetch(`${serverBase}/api/epoch/mcp/access-tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ explorerId, recoveryCode }),
    });
    const token = record(await tokenResponse.json());
    assert.equal(tokenResponse.status, 201, JSON.stringify(token));
    const remote = createAgentWorldRemoteMcpRuntime({
      serverBase,
      bearerToken: String(token.accessToken || ""),
    });
    const call = async (name: string, args: JsonRecord) => payload(await remote.callTool(name, args));
    const prepared = await call("obsidian_epoch.prepare_journey", {
      agentId,
      destinationRegionId: "灰港",
      taskType: "resource_acquisition",
      mandate: { objective: "Verify HTTP persistence ownership", priorities: ["work"] },
      recoveryCode,
      idempotencyKey: `prepare-${suffix}`,
    });
    const preparedJourney = record(prepared.journey);
    const journeyId = String(preparedJourney.journeyId || "");
    assert.ok(journeyId);
    const experiment = await call("obsidian_epoch.begin_phase6_experiment", {
      commandId: `experiment-${suffix}`,
      identity: { identityId: agentId },
      explorer: { explorerId, displayName: "HTTP Owner" },
    });
    const run = await call("obsidian_epoch.begin_phase6_run", {
      commandId: `run-${suffix}`,
      experimentId: experiment.experimentId,
      runIndex: 1,
      scenarioTag: "low-prepared-resource",
      journeyId,
    });
    const started = await call("obsidian_epoch.start_journey_compact", {
      journeyId,
      expectedVersion: preparedJourney.version,
      startJourneyBinding: run.startJourneyBinding,
      taskGenerationMode: "server_fallback",
      recoveryCode,
      idempotencyKey: `start-${suffix}`,
    });
    assert.equal(record(started.phase6Settlement).status, "captured");
    const proposalResult = await call("obsidian_epoch.propose_journey_step_compact", {
      journeyId,
      expectedVersion: record(started.journey).version,
      recoveryCode,
      idempotencyKey: `propose-${suffix}`,
    });
    const proposal = record(proposalResult.proposal);
    const sceneContract = record(proposal.sceneContract);
    const actionOptions = Array.isArray(sceneContract.actionOptions)
      ? sceneContract.actionOptions.map(record)
      : [];
    const selected = actionOptions.find((option) => option.taskObjectiveId && option.completionKind === "complete")
      ?? actionOptions.find((option) => option.optionKey === "verify_salt_ledger")
      ?? record(actionOptions[0]);
    assert.ok(selected.actionOptionId);
    const signed = record(selected.signed);
    assert.ok(signed.signature);
    const commitArgs = {
      journeyId,
      sceneId: sceneContract.sceneId,
      episodeId: record(proposal.episode).episodeId,
      expectedVersion: proposal.expectedVersion,
      actionOptionId: selected.actionOptionId,
      signature: signed.signature,
      recoveryCode,
      idempotencyKey: `commit-${suffix}`,
    };
    const journeyEventRows = () => stores.database.prepare(`
      SELECT event_id AS eventId, COUNT(*) AS count
      FROM journey_events
      WHERE journey_id = ?
      GROUP BY event_id
      ORDER BY event_id ASC
    `).all(journeyId) as Array<{ readonly eventId: string; readonly count: number }>;
    const eventIdsBeforeCommit = new Set(journeyEventRows().map((row) => row.eventId));
    const committed = await call("obsidian_epoch.commit_journey_action_compact", commitArgs);
    assert.equal(record(committed.journey).journeyId, journeyId);
    const committedStore = createPhase6CommittedResultSqliteStore(stores.database);
    const persisted = committedStore.listByJourneyId(journeyId);
    assert.equal(persisted.length, 1);
    const eventRowsAfterCommit = journeyEventRows();
    assert.ok(eventRowsAfterCommit.some((row) => !eventIdsBeforeCommit.has(row.eventId)));
    assert.ok(eventRowsAfterCommit.every((row) => row.count === 1));
    const journeyEventCountAfterCommit = rowCount(
      stores.database,
      "SELECT COUNT(*) AS count FROM journey_events WHERE journey_id = ?",
      journeyId,
    );

    const replay = await call("obsidian_epoch.commit_journey_action_compact", commitArgs);
    assert.equal(record(replay.journey).journeyId, journeyId);
    const persistedAfterReplay = committedStore.listByJourneyId(journeyId);
    assert.equal(
      persistedAfterReplay.length,
      1,
      JSON.stringify(persistedAfterReplay.map((entry) => ({
        contentHash: entry.contentHash,
        actionId: record(record(entry.result).settledAction).actionId,
        journeyVersion: record(record(entry.result).journey).version,
        duplicate: record(entry.result).duplicate,
        eventIds: epochEventsForPersistence(entry.result).map((event) => event.eventId),
      }))),
    );
    assert.equal(rowCount(
      stores.database,
      "SELECT COUNT(*) AS count FROM journey_events WHERE journey_id = ?",
      journeyId,
    ), journeyEventCountAfterCommit);
    const status = await call("obsidian_epoch.journey_status_compact", { journeyId, recoveryCode });
    assert.equal(record(status.journey).journeyId, journeyId);
    const toolsResponse = await fetch(`${serverBase}/api/epoch/mcp/tools/list`, {
      headers: { authorization: `Bearer ${String(token.accessToken)}` },
    });
    assert.equal(toolsResponse.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
    stores.database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("restart settlement fails closed when the committed-result sidecar is unavailable", async () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-restart-missing-sidecar-"));
  const sqlitePath = join(root, "phase6.sqlite");
  try {
    const runtime1 = await openRuntime(sqlitePath, "missing-runtime1", false);
    const journey = await startPhase6Journey(runtime1, "missing");
    const committed = await settleJourney(runtime1, journey, false);
    assert.equal(record(committed.journey).status, "settled");
    runtime1.close();

    const runtime2 = await openRuntime(sqlitePath, "missing-runtime2", false);
    const status = await statusByJourneyId(runtime2, journey);
    const settlement = record(status.phase6Settlement);
    assert.equal(settlement.ok, false);
    assert.equal(settlement.status, "finalize_failed");
    assert.equal(settlement.error, "phase6_settlement_context_missing:committed_results_sidecar");
    runtime2.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("public commit rolls back command events when the committed-result insert fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "phase6-restart-atomic-failure-"));
  const sqlitePath = join(root, "phase6.sqlite");
  let runtime: RuntimeFixture | undefined;
  try {
    runtime = await openRuntime(sqlitePath, "atomic-runtime", true);
    const journey = await startPhase6Journey(runtime, "atomic");
    const commitArgs = await nextCommitArgs(runtime, journey, 1, record(journey.started.journey));
    const before = persistenceCounts(runtime.database);
    runtime.database.exec(`
      CREATE TRIGGER phase6_test_committed_result_insert_failure
      BEFORE INSERT ON phase6_committed_results BEGIN
        SELECT RAISE(ABORT, 'phase6_atomic_sidecar_failure');
      END;
    `);

    await assert.rejects(
      () => commitWithProductionContext(
        runtime as RuntimeFixture,
        commitArgs,
        "obsidian_epoch.commit_journey_action_compact",
      ),
      /phase6_atomic_sidecar_failure/,
    );
    assert.deepEqual(persistenceCounts(runtime.database), before);
  } finally {
    runtime?.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("committed-result sidecar append is idempotent and rejects recovery credentials", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const store = createPhase6CommittedResultSqliteStore(db);
    const result = { journey: { journeyId: "journey_store_unit" }, settledAction: { actionId: "action_1" } };
    const first = store.append("journey_store_unit", result, "2026-07-21T00:00:00.000Z");
    const duplicate = store.append("journey_store_unit", result, "2026-07-21T00:00:01.000Z");
    assert.equal(duplicate.sequence, first.sequence);
    assert.equal(store.listByJourneyId("journey_store_unit").length, 1);

    for (const key of ["recoveryCode", "authorization", "cookie", "sessionKey", "session_key"]) {
      assert.throws(
        () => store.append("journey_store_unit", { settledAction: { [key]: "must-not-persist" } }),
        /phase6_committed_result_secret_field_rejected/,
      );
    }
  } finally {
    db.close();
  }
});

test("experiment store rejects duplicate journey bindings and fails closed on legacy duplicates", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const store = createPhase6ExperimentSqliteStore(db);
    const identity = { identityId: "identity_unique_journey" };
    const explorer = { explorerId: "explorer_unique_journey", displayName: "Unique Journey" };
    const scenarioMatrix = { id: "matrix_unique_journey", version: "matrix-v1" };
    const versions = { rulesVersion: "rules-v1", catalogVersion: "catalog-v1", codeVersion: "code-v1" };
    store.create({ experimentId: "experiment_unique_1", identity, explorer, scenarioMatrix, versions });
    store.create({ experimentId: "experiment_unique_2", identity, explorer, scenarioMatrix, versions });
    store.registerRun("experiment_unique_1", {
      runIndex: 1,
      identity,
      explorer,
      scenarioMatrix,
      versions,
      seed: { seed: "seed-1" },
      journeyId: "journey_unique_binding",
      runReceipt: { receiptId: "run-receipt-1", receiptVersion: "v1" },
    });
    assert.throws(
      () => store.registerRun("experiment_unique_2", {
        runIndex: 1,
        identity,
        explorer,
        scenarioMatrix,
        versions,
        seed: { seed: "seed-2" },
        journeyId: "journey_unique_binding",
        runReceipt: { receiptId: "run-receipt-2", receiptVersion: "v1" },
      }),
      /phase6_experiment_run_journey_conflict:journey_unique_binding/,
    );

    db.exec("DROP INDEX idx_phase6_experiment_runs_journey_id");
    db.prepare(`
      INSERT INTO phase6_experiment_runs (
        experiment_id, run_index, state, identity_id, cohort_id,
        explorer_id, explorer_display_name, scenario_matrix_id, scenario_matrix_version,
        rules_version, catalog_version, code_version, seed, journey_id,
        run_receipt_id, run_receipt_version, result_receipt_id, result_receipt_version,
        failure_reason, failure_receipt_id, failure_receipt_version, created_at, updated_at
      )
      SELECT
        ?, run_index, state, identity_id, cohort_id,
        explorer_id, explorer_display_name, scenario_matrix_id, scenario_matrix_version,
        rules_version, catalog_version, code_version, ?, journey_id,
        ?, run_receipt_version, result_receipt_id, result_receipt_version,
        failure_reason, failure_receipt_id, failure_receipt_version, created_at, updated_at
      FROM phase6_experiment_runs
      WHERE experiment_id = ? AND run_index = 1
    `).run("experiment_unique_2", "seed-legacy-duplicate", "run-receipt-legacy-duplicate", "experiment_unique_1");
    assert.throws(
      () => initializePhase6ExperimentSchema(db),
      /phase6_experiment_run_journey_conflict:journey_unique_binding/,
    );
  } finally {
    db.close();
  }
});

interface RuntimeFixture {
  readonly mcp: AgentWorldMcpRuntime;
  readonly database: DatabaseSync;
  readonly committedStore?: ReturnType<typeof createPhase6CommittedResultSqliteStore>;
  readonly sqlitePath: string;
  readonly persistedCommits: () => number;
  readonly incrementPersistedCommits: () => void;
  readonly publicCommitTools: () => readonly string[];
  readonly recordPublicCommitTool: (toolName: string) => void;
  readonly close: () => void;
}

interface StartedPhase6Journey {
  readonly journeyId: string;
  readonly experimentId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly recoveryCode: string;
  readonly started: JsonRecord;
}

async function openRuntime(
  sqlitePath: string,
  label: string,
  withCommittedSidecar: boolean,
): Promise<RuntimeFixture> {
  const loaded = await loadAgentRuntimeOptionsFromSqlite(sqlitePath);
  const stores = createAgentSqlitePersistenceStores(sqlitePath);
  const committedStore = withCommittedSidecar
    ? createPhase6CommittedResultSqliteStore(stores.database)
    : undefined;
  const realNow = "2026-07-21T00:00:00.000Z";
  const worldNow = "2026-01-01T08:00:00.000Z";
  let journeySequence = 0;
  let persistedCommits = 0;
  const publicCommitTools: string[] = [];
  const mcp = createAgentWorldMcpRuntime({
    ...loaded,
    ...(withCommittedSidecar ? { sqlitePath } : {}),
    journey: {
      idFactory: (kind: "journey" | "event") =>
        `${kind}_${label}_${String(++journeySequence).padStart(4, "0")}`,
      now: () => realNow,
      worldNow: () => worldNow,
    },
    infiniteWorld: {
      ...record(loaded.infiniteWorld),
      now: () => realNow,
      nowMs: () => Date.parse(realNow),
    },
    worldClock: {
      ...record(loaded.worldClock),
      nowReal: () => worldNow,
    },
    worldSimulation: {
      ...record(loaded.worldSimulation),
      nowReal: () => worldNow,
    },
    epoch: {
      idFactory: createSequentialEpochIdFactory(label),
      clock: () => new Date("2026-07-21T00:00:00.000Z"),
      phase6RunAssemblyRepository: createJourneyRunReceiptSqliteStore(stores.database),
      phase6JourneyContextStore: stores.phase6JourneyContextStore,
      phase6ExperimentStore: stores.phase6ExperimentStore,
      ...(committedStore ? { phase6CommittedResultStore: committedStore } : {}),
      phase6RagTraceStore: stores.phase6RagTraceStore,
    },
  });

  return {
    mcp,
    database: stores.database,
    committedStore,
    sqlitePath,
    persistedCommits: () => persistedCommits,
    incrementPersistedCommits: () => { persistedCommits += 1; },
    publicCommitTools: () => publicCommitTools,
    recordPublicCommitTool: (toolName) => { publicCommitTools.push(toolName); },
    close: () => stores.database.close(),
  };
}

async function startPhase6Journey(runtime: RuntimeFixture, suffix: string): Promise<StartedPhase6Journey> {
  const explorerId = `explorer_phase6_restart_${suffix}`;
  const recoveryCode = Buffer.from(JSON.stringify({
    explorerId,
    localSecret: `local-secret-${suffix}`,
  }), "utf8").toString("base64");
  const identity = await callAndPersist(runtime, "obsidian_epoch.identity", {
    explorerId,
    recoveryCode,
    identityName: `Phase6 Restart ${suffix}`,
    idempotencyKey: `identity-${suffix}`,
  });
  const agentId = String(record(identity.value).agentId || "");
  assert.ok(agentId);

  const prepared = await callAndPersist(runtime, "obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    taskType: "resource_acquisition",
    mandate: { objective: "Verify restart-safe settlement", priorities: ["work"] },
    recoveryCode,
    idempotencyKey: `prepare-${suffix}`,
  });
  const preparedJourney = record(prepared.journey);
  const journeyId = String(preparedJourney.journeyId || "");
  assert.ok(journeyId);

  const experiment = payload(await runtime.mcp.callTool("obsidian_epoch.begin_phase6_experiment", {
    commandId: `experiment-${suffix}`,
    identity: { identityId: agentId },
    explorer: { explorerId, displayName: `Restart ${suffix}` },
  }));
  const run = payload(await runtime.mcp.callTool("obsidian_epoch.begin_phase6_run", {
    commandId: `run-${suffix}`,
    experimentId: experiment.experimentId,
    runIndex: 1,
    scenarioTag: "low-prepared-resource",
    journeyId,
  }));
  const started = await callAndPersist(runtime, "obsidian_epoch.start_journey_compact", {
    journeyId,
    expectedVersion: preparedJourney.version,
    startJourneyBinding: run.startJourneyBinding,
    taskGenerationMode: "server_fallback",
    recoveryCode,
    idempotencyKey: `start-${suffix}`,
  });
  assert.equal(record(started.phase6Settlement).status, "captured");
  return {
    journeyId,
    experimentId: String(experiment.experimentId),
    agentId,
    explorerId,
    recoveryCode,
    started,
  };
}

async function settleJourney(
  runtime: RuntimeFixture,
  input: StartedPhase6Journey,
  assertProductionSidecarOrdering: boolean,
  mode: "complete" | "skip_first_main" = "complete",
) {
  let current = input.started;
  for (let step = 1; step <= 12; step += 1) {
    const currentJourney = record(current.journey);
    if (currentJourney.status === "returning" || currentJourney.status === "settled") return current;
    const commitArgs = await nextCommitArgs(runtime, input, step, currentJourney, mode);

    if (assertProductionSidecarOrdering && step === 1) {
      await assert.rejects(() => commitWithProductionContext(runtime, {
        ...commitArgs,
        signature: `${String(commitArgs.signature)}-invalid`,
        idempotencyKey: `commit-${input.journeyId}-${step}-invalid`,
      }, "obsidian_epoch.commit_journey_action_compact"));
      assert.equal(runtime.committedStore?.listByJourneyId(input.journeyId).length, 0);
    }

    const publicCommitTool = step === 2
      ? "obsidian_epoch.commit_journey_action"
      : "obsidian_epoch.commit_journey_action_compact";
    current = assertProductionSidecarOrdering
      ? await commitWithProductionContext(runtime, commitArgs, publicCommitTool)
      : await callAndPersist(runtime, "obsidian_epoch.commit_journey_action_compact", commitArgs);
  }
  throw new Error(`journey_did_not_settle:${input.journeyId}`);
}

async function nextCommitArgs(
  runtime: RuntimeFixture,
  input: StartedPhase6Journey,
  step: number,
  currentJourney: JsonRecord,
  mode: "complete" | "skip_first_main" = "complete",
) {
  const proposed = await callAndPersist(runtime, "obsidian_epoch.propose_journey_step_compact", {
    journeyId: input.journeyId,
    expectedVersion: currentJourney.version,
    recoveryCode: input.recoveryCode,
    idempotencyKey: `propose-${input.journeyId}-${step}`,
  });
  const proposal = record(proposed.proposal);
  const sceneContract = record(proposal.sceneContract);
  const actionOptions = Array.isArray(sceneContract.actionOptions) ? sceneContract.actionOptions : [];
  const options = actionOptions.map(record);
  const selected = (mode === "skip_first_main" && step === 1
    ? options.find((option) => option.completionKind === "skip")
    : undefined)
    ?? options.find((option) => option.taskObjectiveId && option.completionKind === "complete")
    ?? options.find((option) => option.optionKey === "verify_salt_ledger")
    ?? record(actionOptions[0]);
  assert.ok(selected.actionOptionId);
  const signed = record(selected.signed);
  assert.ok(signed.signature);
  return {
    journeyId: input.journeyId,
    sceneId: sceneContract.sceneId,
    episodeId: record(proposal.episode).episodeId,
    expectedVersion: proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: signed.signature,
    recoveryCode: input.recoveryCode,
    idempotencyKey: `commit-${input.journeyId}-${step}`,
  };
}

async function statusByJourneyId(runtime: RuntimeFixture, journey: StartedPhase6Journey) {
  const persistPartial = Object.assign(
    async (toolName: string, rawResult: unknown) => persistResult(runtime.sqlitePath, toolName, rawResult),
    { supportsPhase6CommittedResultAtomicWrite: true as const },
  );
  const result = await runWithMcpRequestAuthContext({
    kind: "player",
    explorerId: journey.explorerId,
    tokenId: `token-${journey.explorerId}`,
  }, () => runWithMcpRequestContext({
    activeClientRequest: true,
    clientRequestId: `status-${journey.journeyId}`,
    persistPartial,
  }, () => runtime.mcp.callTool("obsidian_epoch.journey_status", {
      journeyId: journey.journeyId,
    })));
  await persistResult(runtime.sqlitePath, "obsidian_epoch.journey_status", result);
  return payload(result);
}

async function commitWithProductionContext(runtime: RuntimeFixture, args: JsonRecord, publicToolName: string) {
  const persistPartial = Object.assign(
    async (toolName: string, rawResult: unknown) => {
      const rowsBeforePersistence = runtime.committedStore?.listByJourneyId(String(args.journeyId)).length ?? 0;
      assert.equal(rowsBeforePersistence, runtime.persistedCommits());
      await persistResult(runtime.sqlitePath, toolName, rawResult);
      runtime.incrementPersistedCommits();
    },
    { supportsPhase6CommittedResultAtomicWrite: true as const },
  );
  const toolResult = await runWithMcpRequestContext({
    activeClientRequest: true,
    clientRequestId: String(args.idempotencyKey || "phase6-commit"),
    persistPartial,
  }, () => runtime.mcp.callTool(publicToolName, args));
  const rowsAfterHandler = runtime.committedStore?.listByJourneyId(String(args.journeyId)).length ?? 0;
  assert.equal(rowsAfterHandler, runtime.persistedCommits());
  runtime.recordPublicCommitTool(publicToolName);
  return payload(toolResult);
}

async function callAndPersist(runtime: RuntimeFixture, toolName: string, args: JsonRecord) {
  const result = await runtime.mcp.callTool(toolName, args);
  await persistResult(runtime.sqlitePath, toolName, result);
  return payload(result);
}

async function persistResult(sqlitePath: string, toolName: string, result: unknown) {
  const journeyEvents = [...journeyEventsForPersistence(result)];
  const epochEvents = [...epochEventsForPersistence(result)];
  const resultPages = embeddedResultPages(result);
  const committedResults = phase6CommittedResultsForPersistence(result);
  if (journeyEvents.length === 0
    && epochEvents.length === 0
    && resultPages.length === 0
    && committedResults.length === 0) return;
  const firstEventId = journeyEvents[0]?.eventId || epochEvents[0]?.eventId;
  const pageIdentity = resultPages
    .map((page) => `${String(page.pageId)}:${String(page.shareVersion || 1)}`)
    .sort()
    .join(",");
  const commandEnvelope = {
    type: "agent_command_commit",
    version: 1,
    command: toolName,
    commandId: `${toolName}:${firstEventId || pageIdentity || committedResults[0]?.journeyId}`,
    journeyEvents,
    epochEvents,
    resultPages,
  };
  for (const committed of committedResults) {
    attachPhase6CommittedResultForPersistence(commandEnvelope, committed);
  }
  await appendSqliteJsonl(sqlitePath, "command-events.jsonl", commandEnvelope);
}

function embeddedResultPages(result: unknown): JsonRecord[] {
  const wrapper = record(result);
  const content = wrapper.content;
  const value = Array.isArray(content)
    ? payload(result as { readonly content: readonly { readonly text: string }[] })
    : wrapper;
  const pages: JsonRecord[] = [];
  const appendPage = (candidate: unknown) => {
    const pageResult = record(candidate);
    if (pageResult.duplicate === true) return;
    const page = record(pageResult.page);
    if (typeof page.pageId === "string") pages.push(page);
  };
  appendPage(value);
  for (const key of ["verification", "departureVerification", "finalVerification"] as const) {
    appendPage(value[key]);
  }
  return [...new Map(pages.map((page) => [String(page.pageId), page])).values()];
}

function payload(result: { readonly content: readonly { readonly text: string }[] }): JsonRecord {
  const value = JSON.parse(result.content[0]?.text ?? "null") as unknown;
  return record(value);
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function receiptEventIds(receipt: JsonRecord) {
  const groups = record(receipt.eventIds);
  return ["source", "settlement", "derived"].flatMap((key) =>
    Array.isArray(groups[key]) ? groups[key] as unknown[] : []);
}

function persistenceCounts(db: DatabaseSync) {
  return {
    commandRecords: rowCount(db, "SELECT COUNT(*) AS count FROM jsonl_records WHERE file_name = 'command-events.jsonl'"),
    commandCommits: rowCount(db, "SELECT COUNT(*) AS count FROM command_commits"),
    epochEvents: rowCount(db, "SELECT COUNT(*) AS count FROM epoch_events"),
    journeyEvents: rowCount(db, "SELECT COUNT(*) AS count FROM journey_events"),
    committedResults: rowCount(db, "SELECT COUNT(*) AS count FROM phase6_committed_results"),
  };
}

function rowCount(db: DatabaseSync, sql: string, ...params: Array<string | number | null>) {
  const row = db.prepare(sql).get(...params) as { readonly count?: unknown } | undefined;
  const count = Number(row?.count);
  assert.ok(Number.isSafeInteger(count));
  return count;
}
