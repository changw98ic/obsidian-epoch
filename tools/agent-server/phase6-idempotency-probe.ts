#!/usr/bin/env node
// @ts-nocheck

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROBE_SCHEMA_VERSION = "obsidian-epoch.phase6-idempotency-probe.v1";
const DEFAULT_SEED = "phase6-idempotency-probe";
const DEFAULT_EXPERIMENT_ID = "phase6-idempotency-probe";
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code|operator[-_]?key|client[-_]?secret|signature|share[-_]?token)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

function usage() {
  return [
    "Usage: node --import tsx tools/agent-server/phase6-idempotency-probe.mjs --output <repo-local-jsonl> [options]",
    "",
    "Options:",
    "  --output <path>         Repository-local JSONL output path. Refuses to overwrite non-empty files.",
    "  --sqlite <path>         Repository-local or absolute SQLite path. Defaults to a temporary DB that is cleaned up.",
    "  --seed <value>          Deterministic id seed. Default: phase6-idempotency-probe.",
    "  --experiment-id <value> Evidence experiment id. Default: phase6-idempotency-probe.",
    "  --keep-temp            Keep the temporary SQLite directory for inspection.",
    "",
    "The output is suitable for phase6-idempotency-gate.mjs as command, settlement, and store audit input.",
  ].join("\n");
}

export async function runProbe(options) {
  const outputPath = resolveRepoOutput(options.output);
  const outputFiles = evidenceOutputFiles(outputPath);
  await Promise.all(Object.values(outputFiles).map(assertOutputWritable));

  const tempDir = options.sqlite ? undefined : await fsp.mkdtemp(path.join(os.tmpdir(), "phase6-idempotency-probe-"));
  const sqlitePath = options.sqlite
    ? resolveSqlitePath(options.sqlite)
    : path.join(tempDir, "agent-world.sqlite");

  let persistence;
  try {
    const [
      { createAgentPersistenceFromEnv },
      { createAgentWorldMcpRuntime, createAgentWorldRuntime },
      { createSequentialEpochIdFactory },
      { readSqliteJsonlRecords },
    ] = await Promise.all([
      import("./lib/persistenceConfig.ts"),
      import("./lib/mcpTools.ts"),
      import("./lib/epoch/protocol.ts"),
      import("./lib/sqliteStore.ts"),
    ]);

    persistence = await createAgentPersistenceFromEnv({
      AGENT_SERVER_STORE: "sqlite",
      AGENT_SERVER_SQLITE_PATH: sqlitePath,
    }, tempDir || path.dirname(sqlitePath));

    const records = [];
    const worldHarness = createWorldHarness({
      createAgentWorldRuntime,
      createAgentWorldMcpRuntime,
      persistence,
      seed: options.seed || DEFAULT_SEED,
    });
    await runWorldCommandProbe({ ...worldHarness, records, readSqliteJsonlRecords, sqlitePath });

    const journeyHarness = createJourneyHarness({
      createAgentWorldMcpRuntime,
      createSequentialEpochIdFactory,
      seed: options.seed || DEFAULT_SEED,
    });
    await runJourneyAndResultPageProbe({ ...journeyHarness, records, experimentId: options.experimentId || DEFAULT_EXPERIMENT_ID });

    appendSummaryRecord(records, {
      sqlitePath,
      experimentId: options.experimentId || DEFAULT_EXPERIMENT_ID,
      seed: options.seed || DEFAULT_SEED,
    });

    validateProbeEvidence(records);
    await writeEvidenceSet0600(outputFiles, records);
    return {
      ok: true,
      outputPath,
      files: outputFiles,
      sqlitePath,
      recordCount: records.length,
      tempDir: options.keepTemp ? tempDir : undefined,
    };
  } finally {
    persistence?.dispose?.();
    if (tempDir && !options.keepTemp) {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
  }
}

function createWorldHarness({ createAgentWorldRuntime, createAgentWorldMcpRuntime, persistence, seed }) {
  const worldId = `phase6_idem_world_${slug(seed)}`;
  const now = "2026-07-20T00:00:00.000Z";
  const runtime = createAgentWorldRuntime({
    ...persistence.loadedOptions,
    epoch: {
      ...persistence.loadedOptions.epoch,
      operatorKey: "probe-operator-key",
    },
    infiniteWorld: {
      worldId,
      now: () => now,
      idFactory: (kind, input) => `${kind}_${slug(String(input.idempotencyKey || input.commandId || seed))}`,
      idempotencyStore: persistence.causalIdempotencyStore,
      atomicCommit: ({ atomic, epochEvents }) => {
        if (atomic?.appendJsonl) atomic.appendJsonl("epoch-events.jsonl", { type: "epoch_event_batch", events: epochEvents });
      },
    },
  });
  return {
    mcp: createAgentWorldMcpRuntime({ runtime }),
    worldId,
    now,
    operatorKey: "probe-operator-key",
  };
}

async function runWorldCommandProbe({ mcp, worldId, now, operatorKey, records, readSqliteJsonlRecords, sqlitePath }) {
  const baseCommand = {
    commandType: "world_tick",
    commandId: "probe_world_tick_command",
    worldId,
    actor: { actorType: "system", actorId: "phase6_idempotency_probe" },
    submittedAt: now,
    requestedWorldMinute: 10,
    idempotencyKey: "probe-world-command",
    authorizationRefs: ["auth:phase6-idempotency-probe"],
    payload: {
      streamId: `world_tick:${worldId}`,
      currentWorldMinute: 0,
      targetWorldMinute: 10,
      sourceEventIds: [],
    },
  };
  const before = await callJson(mcp, "obsidian_epoch.world_snapshot", { operatorKey });
  const first = await callJson(mcp, "obsidian_epoch.command", { command: baseCommand, operatorKey });
  const afterFirst = await callJson(mcp, "obsidian_epoch.world_snapshot", { operatorKey });
  const replay = await callJson(mcp, "obsidian_epoch.command", { command: baseCommand, operatorKey });
  const afterReplay = await callJson(mcp, "obsidian_epoch.world_snapshot", { operatorKey });
  const conflict = await captureConflict(() => callJson(mcp, "obsidian_epoch.command", {
    command: {
      ...baseCommand,
      requestedWorldMinute: 11,
      payload: { ...baseCommand.payload, targetWorldMinute: 11 },
    },
    operatorKey,
  }));
  const epochBatches = readSqliteJsonlRecords(sqlitePath, "epoch-events.jsonl");
  const rawWorldEventIds = epochBatches.flatMap(extractWorldEventIds);
  const worldEventIds = unique(rawWorldEventIds);

  pushAttempt(records, {
    auditTarget: "commandAudit",
    operation: "world_command_commit",
    commandId: baseCommand.commandId,
    idempotencyKey: baseCommand.idempotencyKey,
    payload: baseCommand,
    result: first,
    writeCount: 1,
    rawEventIds: rawWorldEventIds,
    before,
    after: afterFirst,
  });
  pushAttempt(records, {
    auditTarget: "commandAudit",
    operation: "world_command_commit",
    commandId: baseCommand.commandId,
    idempotencyKey: baseCommand.idempotencyKey,
    payload: baseCommand,
    result: replay,
    writeCount: 0,
    duplicate: true,
    rawEventIds: rawWorldEventIds,
    before: afterFirst,
    after: afterReplay,
  });
  pushAttempt(records, {
    auditTarget: "commandAudit",
    operation: "world_command_conflict",
    commandId: baseCommand.commandId,
    idempotencyKey: baseCommand.idempotencyKey,
    payload: { ...baseCommand, requestedWorldMinute: 11, payload: { ...baseCommand.payload, targetWorldMinute: 11 } },
    result: conflict,
    writeCount: 0,
    conflict: true,
    errorCode: conflict.errorCode,
    rawEventIds: [],
    before: afterReplay,
    after: afterReplay,
  });

  records.push({
    auditTarget: "epochEvents",
    type: "causal_world_event_evidence",
    operation: "world_command_commit",
    eventType: "world_simulation_advanced",
    eventId: worldEventIds[0],
    idempotencyKey: baseCommand.idempotencyKey,
    ...eventIdEvidence(rawWorldEventIds),
    snapshots: snapshots(before, afterReplay),
  });
}

function createJourneyHarness({ createAgentWorldMcpRuntime, createSequentialEpochIdFactory, seed }) {
  let realNow = "2026-07-12T00:00:00.000Z";
  let worldNow = "2026-01-01T08:00:00.000Z";
  let epochNow = "2026-07-12T00:00:00.000Z";
  const mcp = createAgentWorldMcpRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory(`phase6_idem_${slug(seed)}`),
      clock: () => new Date(epochNow),
    },
    journey: {
      now: () => realNow,
      worldNow: () => worldNow,
      defaultRealDurationMs: 30 * 60 * 1_000,
      defaultWorldDurationMs: 60 * 60 * 1_000,
    },
  });
  const explorerId = `explorer_phase6_idem_${slug(seed)}`;
  const recovery = Buffer.from(JSON.stringify({ explorerId, localSecret: `phase6-idem-local-${slug(seed)}` }), "utf8").toString("base64");
  return {
    mcp,
    explorerId,
    recovery,
    advance: (real, world) => {
      realNow = real;
      worldNow = world;
    },
    advanceEpoch: (iso) => {
      epochNow = iso;
    },
  };
}

async function runJourneyAndResultPageProbe({ mcp, explorerId, recovery, records, experimentId }) {
  const identity = await callJson(mcp, "obsidian_epoch.identity", {
    explorerId,
    recoveryCode: recovery,
    identityName: "幂等验收员",
    idempotencyKey: "probe-identity",
  });
  const agentId = identity.value.agentId;
  const prepared = await callJson(mcp, "obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "region_gray_harbor",
    mandate: { objective: "验证幂等处理", priorities: ["work"] },
    recoveryCode: recovery,
    idempotencyKey: "probe-journey-prepare",
  });
  const started = await callJson(mcp, "obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    taskGenerationMode: "server_fallback",
    recoveryCode: recovery,
    idempotencyKey: "probe-journey-start",
  });
  const proposed = await callJson(mcp, "obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: recovery,
    idempotencyKey: "probe-journey-propose",
  });
  const action = proposed.proposal.sceneContract.actionOptions.find((entry) => entry.completionKind !== "skip")
    || proposed.proposal.sceneContract.actionOptions[0];
  const commitInput = {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: action.actionOptionId,
    signature: action.signature,
    recoveryCode: recovery,
    idempotencyKey: "probe-journey-commit",
  };
  const firstCommit = await callJson(mcp, "obsidian_epoch.commit_journey_action_compact", commitInput);
  const replayCommit = await callJson(mcp, "obsidian_epoch.commit_journey_action_compact", commitInput);
  const alternate = proposed.proposal.sceneContract.actionOptions.find((entry) => entry.actionOptionId !== action.actionOptionId) || action;
  const conflictCommit = await captureConflict(() => callJson(mcp, "obsidian_epoch.commit_journey_action_compact", {
    ...commitInput,
    actionOptionId: alternate.actionOptionId,
    signature: alternate.signature,
  }));
  const statusFirst = await callJson(mcp, "obsidian_epoch.journey_status_compact", {
    journeyId: started.journey.journeyId,
    recoveryCode: recovery,
  });
  const statusReplay = await callJson(mcp, "obsidian_epoch.journey_status_compact", {
    journeyId: started.journey.journeyId,
    recoveryCode: recovery,
  });
  const resultPayload = await callJson(mcp, "obsidian_epoch.result_page", {
    explorerId,
    agentId,
    limit: 10,
  });
  const pageFirst = await callJson(mcp, "obsidian_epoch.create_result_page", {
    explorerId,
    agentId,
    limit: 10,
    recoveryCode: recovery,
    publishToken: resultPayload.publishToken,
    idempotencyKey: "probe-result-page",
  });
  const pageReplay = await callJson(mcp, "obsidian_epoch.create_result_page", {
    explorerId,
    agentId,
    limit: 10,
    recoveryCode: recovery,
    publishToken: resultPayload.publishToken,
    idempotencyKey: "probe-result-page",
  });

  const rawFirstCommitEventIds = extractCommitEventIds(firstCommit);
  const rawReplayCommitEventIds = extractCommitEventIds(replayCommit);
  const rawFirstStatusEventIds = extractStatusEventIds(statusFirst);
  const rawReplayStatusEventIds = extractStatusEventIds(statusReplay);
  const rawFirstPageEventIds = extractPageEventIds(pageFirst);
  const rawReplayPageEventIds = extractPageEventIds(pageReplay);
  const commitEventIds = unique(rawFirstCommitEventIds);
  const statusEventIds = unique(rawFirstStatusEventIds);

  pushAttempt(records, {
    auditTarget: "settlementAudit",
    operation: "journey_commit_action",
    commandId: "probe-journey-commit",
    idempotencyKey: "probe-journey-commit",
    payload: withoutSecrets(commitInput),
    result: firstCommit,
    writeCount: 1,
    rawEventIds: rawFirstCommitEventIds,
    before: statusFirst,
    after: firstCommit,
  });
  pushAttempt(records, {
    auditTarget: "settlementAudit",
    operation: "journey_commit_action",
    commandId: "probe-journey-commit",
    idempotencyKey: "probe-journey-commit",
    payload: withoutSecrets(commitInput),
    result: replayCommit,
    writeCount: 0,
    duplicate: true,
    rawEventIds: rawReplayCommitEventIds,
    before: firstCommit,
    after: statusReplay,
  });
  pushAttempt(records, {
    auditTarget: "settlementAudit",
    operation: "journey_commit_conflict",
    commandId: "probe-journey-commit",
    idempotencyKey: "probe-journey-commit",
    payload: withoutSecrets({ ...commitInput, actionOptionId: alternate.actionOptionId }),
    result: conflictCommit,
    writeCount: 0,
    conflict: true,
    errorCode: conflictCommit.errorCode,
    rawEventIds: [],
    before: replayCommit,
    after: statusReplay,
  });
  pushAttempt(records, {
    auditTarget: "storeAudit",
    operation: "result_page_create",
    commandId: "probe-result-page",
    idempotencyKey: "probe-result-page",
    payload: { publishPayloadHash: canonicalHash(withoutSecrets(resultPayload)) },
    result: withoutSecrets(pageFirst),
    writeCount: 1,
    rawEventIds: rawFirstPageEventIds,
    before: resultPayload,
    after: pageFirst,
  });
  pushAttempt(records, {
    auditTarget: "storeAudit",
    operation: "result_page_create",
    commandId: "probe-result-page",
    idempotencyKey: "probe-result-page",
    payload: { publishPayloadHash: canonicalHash(withoutSecrets(resultPayload)) },
    result: withoutSecrets(pageReplay),
    writeCount: 0,
    duplicate: true,
    rawEventIds: rawReplayPageEventIds,
    before: pageFirst,
    after: pageReplay,
  });
  pushAttempt(records, {
    auditTarget: "settlementAudit",
    operation: "finalize_receipt_read",
    receiptId: statusFirst.phase6Settlement?.receiptId || `journey-status:${started.journey.journeyId}`,
    idempotencyKey: `receipt-read:${started.journey.journeyId}`,
    payload: { journeyId: started.journey.journeyId },
    result: statusFirst,
    writeCount: 1,
    rawEventIds: rawFirstStatusEventIds,
    before: firstCommit,
    after: statusFirst,
  });
  pushAttempt(records, {
    auditTarget: "settlementAudit",
    operation: "finalize_receipt_read",
    receiptId: statusFirst.phase6Settlement?.receiptId || `journey-status:${started.journey.journeyId}`,
    idempotencyKey: `receipt-read:${started.journey.journeyId}`,
    payload: { journeyId: started.journey.journeyId },
    result: statusReplay,
    writeCount: 0,
    duplicate: true,
    rawEventIds: rawReplayStatusEventIds,
    before: statusFirst,
    after: statusReplay,
  });

  records.push({
    auditTarget: "epochEvents",
    type: "journey_episode_recorded",
    operation: "journey_commit_action",
    eventType: "journey_episode_recorded",
    eventId: commitEventIds[0],
    idempotencyKey: "probe-journey-commit",
    journeyId: started.journey.journeyId,
    episode: {
      episodeId: proposed.proposal.episode.episodeId,
      fingerprint: canonicalHash(firstCommit.episode || firstCommit.objectiveEpisode || firstCommit),
    },
    ...eventIdEvidence(rawFirstCommitEventIds),
  });
  records.push({
    auditTarget: "epochEvents",
    type: "journey_settled",
    operation: "finalize_receipt_read",
    eventType: "journey_status_changed",
    eventId: statusEventIds[statusEventIds.length - 1] || statusEventIds[0],
    idempotencyKey: `receipt-read:${started.journey.journeyId}`,
    journeyId: started.journey.journeyId,
    status: "settled",
    ...eventIdEvidence(rawFirstStatusEventIds),
  });
  records.push({
    auditTarget: "epochEvents",
    type: "phase6_experiment_mutation",
    operation: "journey_commit_action",
    eventId: commitEventIds[0],
    idempotencyKey: "probe-journey-commit",
    experimentId,
    runIndex: 1,
    ...eventIdEvidence(rawFirstCommitEventIds),
  });
  records.push({
    auditTarget: "resultPages",
    type: "epoch_result_page",
    operation: "result_page_create",
    page: withoutSecrets(pageFirst.page || pageFirst),
    pageId: pageFirst.page?.pageId || pageFirst.pageId,
    idempotencyKey: "probe-result-page",
    ...eventIdEvidence(rawFirstPageEventIds),
  });
  records.push({
    auditTarget: "epochEvents",
    type: "progression_awarded",
    operation: "journey_commit_action",
    eventId: commitEventIds[0],
    idempotencyKey: "probe-journey-commit",
    progression: firstCommit.rewardGrant || firstCommit.settledAction?.reward || { source: "journey_commit_action" },
    ...eventIdEvidence(rawFirstCommitEventIds),
  });
}

function pushAttempt(records, input) {
  const sanitizedResult = stripReplayMetadata(withoutSecrets(input.result));
  records.push({
    schemaVersion: PROBE_SCHEMA_VERSION,
    auditTarget: input.auditTarget,
    operation: input.operation,
    commandId: input.commandId,
    receiptId: input.receiptId,
    idempotencyKey: input.idempotencyKey,
    canonicalPayloadHash: canonicalHash(input.payload),
    resultHash: canonicalHash(sanitizedResult),
    first: input.writeCount === 1 ? { resultHash: canonicalHash(sanitizedResult) } : undefined,
    replay: input.duplicate ? { resultHash: canonicalHash(sanitizedResult) } : undefined,
    conflictResultHash: input.conflict ? canonicalHash(sanitizedResult) : undefined,
    conflict: input.conflict === true,
    errorCode: input.errorCode,
    duplicate: input.duplicate === true,
    writeCount: input.writeCount,
    ...eventIdEvidence(input.rawEventIds || []),
    snapshots: snapshots(input.before, input.after),
    balances: {
      beforeHash: canonicalHash(balanceProjection(input.before)),
      afterHash: canonicalHash(balanceProjection(input.after)),
    },
  });
}

function appendSummaryRecord(records, input) {
  const effectRecords = records.filter((record) =>
    ["epochEvents", "resultPages", "journeyEvents"].includes(record.auditTarget));
  const duplicateEventCount = effectRecords.reduce(
    (total, record) => total + duplicateCount(Array.isArray(record.rawEventIds) ? record.rawEventIds : []),
    0,
  );
  records.push({
    schemaVersion: PROBE_SCHEMA_VERSION,
    auditTarget: "manifest",
    operation: "probe_summary",
    experimentId: input.experimentId,
    seed: input.seed,
    sqliteEvidence: {
      pathHash: shortHash(path.relative(repositoryRoot, input.sqlitePath)),
    },
    duplicateResourceEventCount: duplicateCountFor(records, /resource|progression/u),
    duplicateGrowthEventCount: duplicateCountFor(records, /growth|progression|reward/u),
    duplicateWorldEventCount: duplicateCountFor(records, /world/u),
    duplicateEventCount,
  });
}

async function callJson(mcp, tool, args = {}) {
  const result = await mcp.callTool(tool, args);
  return JSON.parse(result.content[0]?.text || "null");
}

async function captureConflict(operation) {
  try {
    const value = await operation();
    return { accepted: true, value };
  } catch (error) {
    return {
      accepted: false,
      conflict: true,
      errorCode: errorCode(error),
      messageHash: shortHash(error instanceof Error ? error.message : String(error)),
    };
  }
}

function errorCode(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(/[:\s]/u)[0] || "error";
}

function extractEventIds(value) {
  const ids = [];
  const seen = new WeakSet();
  const visit = (entry) => {
    if (!entry || typeof entry !== "object") return;
    if (seen.has(entry)) return;
    seen.add(entry);
    if (typeof entry.eventId === "string") ids.push(entry.eventId);
    for (const nested of Object.values(entry)) {
      if (nested && typeof nested === "object") visit(nested);
    }
  };
  visit(value);
  return ids;
}

function extractWorldEventIds(value) {
  if (!Array.isArray(value?.events)) return extractEventIds(value);
  return value.events
    .map((event) => event?.eventId)
    .filter((eventId) => typeof eventId === "string");
}

function extractCommitEventIds(value) {
  const episode = value?.episode || value?.objectiveEpisode || value?.mainEpisode || value?.returnEpisode;
  const canonicalEventIds = episode?.settlement?.canonicalEventIds;
  return Array.isArray(canonicalEventIds)
    ? canonicalEventIds.filter((entry) => typeof entry === "string")
    : extractEventIds(value);
}

function extractStatusEventIds(value) {
  const eventIds = (Array.isArray(value?.episodeSummaries) ? value.episodeSummaries : [])
    .flatMap((episode) => Array.isArray(episode?.canonicalEventIds) ? episode.canonicalEventIds : [])
    .filter((entry) => typeof entry === "string");
  return eventIds.length > 0 ? eventIds : extractEventIds(value);
}

function extractPageEventIds(value) {
  const canonicalEvents = value?.page?.payload?.receipt?.canonicalEvents;
  const eventIds = Array.isArray(canonicalEvents) ? canonicalEvents.flatMap(extractEventIds) : [];
  return eventIds.length > 0 ? eventIds : extractEventIds(value);
}

function balanceProjection(value) {
  if (!value || typeof value !== "object") return {};
  const progress = value.progress && typeof value.progress === "object" ? value.progress : {};
  const snapshot = value.snapshot && typeof value.snapshot === "object" ? value.snapshot : {};
  return {
    resources: progress.resources || value.resources || {},
    worldVersion: value.version || snapshot.version,
    journeyVersion: value.journey?.version,
    journeyStatus: value.journey?.status,
    pageStatus: value.page?.status || value.status,
  };
}

function snapshots(before, after) {
  return {
    beforeHash: canonicalHash(withoutSecrets(before)),
    afterHash: canonicalHash(withoutSecrets(after)),
  };
}

function withoutSecrets(value) {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (typeof value === "string") return value.replace(/shareToken=[^&\s"]+/gu, "share=redacted");
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SECRET_KEY.test(key))
    .map(([key, entry]) => [key, withoutSecrets(entry)]));
}

function stripReplayMetadata(value) {
  if (Array.isArray(value)) return value.map(stripReplayMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["duplicate", "replay", "replayed", "cached", "idempotentReplay"].includes(key))
    .map(([key, entry]) => [key, stripReplayMetadata(entry)]));
}

export function validateProbeEvidence(records) {
  assertNoDuplicateRawEventIds(records);
  assertNoSecrets(records);
}

function assertNoDuplicateRawEventIds(records) {
  for (const record of records) {
    if (!Array.isArray(record.rawEventIds)) continue;
    const expected = eventIdEvidence(record.rawEventIds);
    const identity = record.operation || record.type || record.auditTarget || "unknown";
    if (expected.duplicateEventCount > 0) {
      throw new Error(`E_PROBE_DUPLICATE_RAW_EVENT_IDS:${identity}:${expected.duplicateEventCount}`);
    }
    if (record.duplicateEventCount !== expected.duplicateEventCount) {
      throw new Error(`E_PROBE_EVENT_COUNT_MISMATCH:${identity}`);
    }
    if (JSON.stringify(record.canonicalEventIds) !== JSON.stringify(expected.canonicalEventIds)) {
      throw new Error(`E_PROBE_CANONICAL_EVENT_IDS_MISMATCH:${identity}`);
    }
  }
}

function assertNoSecrets(records) {
  const finding = findSecret(records);
  if (finding) throw new Error(`probe_secret_scan_failed:${finding}`);
}

function findSecret(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const finding = findSecret(value[index], [...pathParts, String(index)]);
      if (finding) return finding;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") {
    return typeof value === "string" && SECRET_VALUE.test(value) ? pathParts.join(".") : undefined;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) return [...pathParts, key].join(".");
    const finding = findSecret(entry, [...pathParts, key]);
    if (finding) return finding;
  }
  return undefined;
}

async function writeJsonl0600(outputPath, records) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  const handle = await fsp.open(outputPath, "wx", 0o600);
  try {
    await handle.writeFile(records.map((record) => JSON.stringify(cleanUndefined(record))).join("\n") + "\n", "utf8");
  } finally {
    await handle.close();
  }
  await fsp.chmod(outputPath, 0o600);
}

async function writeEvidenceSet0600(files, records) {
  const grouped = {
    commandAudit: records.filter((record) => record.auditTarget === "commandAudit"),
    settlementAudit: records.filter((record) => record.auditTarget === "settlementAudit"),
    storeAudit: records.filter((record) => record.auditTarget === "storeAudit"),
    epochEvents: records.filter((record) => record.auditTarget === "epochEvents"),
    resultPages: records.filter((record) => record.auditTarget === "resultPages"),
    manifest: records.filter((record) => record.auditTarget === "manifest"),
  };
  await Promise.all([
    writeJsonl0600(files.commandAudit, grouped.commandAudit),
    writeJsonl0600(files.settlementAudit, grouped.settlementAudit),
    writeJsonl0600(files.storeAudit, grouped.storeAudit),
    writeJsonl0600(files.epochEvents, grouped.epochEvents),
    writeJsonl0600(files.resultPages, grouped.resultPages),
    writeJsonl0600(files.manifest, grouped.manifest),
  ]);
}

function evidenceOutputFiles(outputPath) {
  const parsed = path.parse(outputPath);
  const base = path.join(parsed.dir, parsed.name);
  const ext = parsed.ext || ".jsonl";
  return {
    commandAudit: outputPath,
    settlementAudit: `${base}.settlement${ext}`,
    storeAudit: `${base}.store${ext}`,
    epochEvents: `${base}.epoch-events${ext}`,
    resultPages: `${base}.result-pages${ext}`,
    manifest: `${base}.manifest${ext}`,
  };
}

function cleanUndefined(value) {
  if (Array.isArray(value)) return value.map(cleanUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => [key, cleanUndefined(entry)]));
}

async function assertOutputWritable(outputPath) {
  try {
    const stats = await fsp.stat(outputPath);
    if (stats.size > 0) throw new Error("output_refuses_overwrite_non_empty");
    await fsp.unlink(outputPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function resolveRepoOutput(input) {
  if (!input) throw new Error("--output is required");
  if (SECRET_KEY.test(input) || SECRET_VALUE.test(input)) throw new Error("secret_like_output_path_rejected");
  const resolved = path.resolve(repositoryRoot, input);
  const relative = path.relative(repositoryRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("output_must_be_repo_local");
  return resolved;
}

function resolveSqlitePath(input) {
  if (SECRET_KEY.test(input) || SECRET_VALUE.test(input)) throw new Error("secret_like_sqlite_path_rejected");
  return path.resolve(repositoryRoot, input);
}

function parseArguments(argv) {
  const options = { seed: DEFAULT_SEED, experimentId: DEFAULT_EXPERIMENT_ID, keepTemp: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--keep-temp") {
      options.keepTemp = true;
      continue;
    }
    const key = {
      "--output": "output",
      "--sqlite": "sqlite",
      "--seed": "seed",
      "--experiment-id": "experimentId",
    }[argument];
    if (!key) throw new Error(`unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`${argument} requires a value`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonicalHash(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(stable(withoutSecrets(value)))).digest("hex")}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function shortHash(value) {
  return sha256(String(value)).slice(0, 16);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, 48) || "probe";
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

export function eventIdEvidence(rawEventIds) {
  const raw = (Array.isArray(rawEventIds) ? rawEventIds : []).filter(Boolean).map(String);
  return {
    rawEventIds: raw,
    canonicalEventIds: unique(raw),
    duplicateEventCount: duplicateCount(raw),
  };
}

function duplicateCount(values) {
  return values.length - new Set(values).size;
}

function duplicateCountFor(records, pattern) {
  return records
    .filter((record) => pattern.test(String(record.operation || record.type || record.eventType || "")))
    .reduce((total, record) => total + duplicateCount(Array.isArray(record.rawEventIds) ? record.rawEventIds : []), 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void (async () => {
    try {
      const options = parseArguments(process.argv.slice(2));
      if (options.help) {
        process.stdout.write(`${usage()}\n`);
      } else {
        const result = await runProbe(options);
        process.stdout.write(`${JSON.stringify(result)}\n`);
      }
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  })();
}
