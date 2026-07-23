#!/usr/bin/env node
// @ts-nocheck

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "obsidian-epoch.phase6-idempotency-gate.v1";
const MAX_ERRORS = 200;
const MAX_PARSE_ERRORS = 50;
const MAX_EVIDENCE_IDS = 50;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code|operator[-_]?key|client[-_]?secret|signature|share[-_]?token)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;
const VOLATILE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "occurredAt",
  "recordedAt",
  "generatedAt",
  "completedAt",
  "completed_at",
  "timestamp",
  "time",
  "eventId",
  "pageId",
  "urlPath",
  "shareToken",
  "signature",
  "confirmationToken",
  "idempotencyKey",
  "localSecret",
  "newRecoveryCode",
  "recoveryCode",
]);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-idempotency-gate.mjs --command-audit <jsonl> --settlement-audit <jsonl> --store-audit <jsonl> [options]",
    "",
    "Options:",
    "  --command-audit <path>     Command idempotency audit JSON/JSONL. Repeatable.",
    "  --settlement-audit <path>  Settlement audit JSON/JSONL. Repeatable.",
    "  --store-audit <path>       Store audit JSON/JSONL. Repeatable.",
    "  --journey-events <path>    Journey event JSONL evidence. Repeatable.",
    "  --result-pages <path>      Result page JSONL evidence. Repeatable.",
    "  --epoch-events <path>      Epoch event JSONL evidence. Repeatable.",
    "  --input <path>             Extra mixed JSON/JSONL evidence. Repeatable.",
    "",
    "Prints a redacted machine JSON report and exits non-zero when idempotency or evidence gates fail.",
  ].join("\n");
}

function main() {
  let report;
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    report = runGate(options);
  } catch (error) {
    report = failureReport(error?.code || "E_RUNTIME", error?.message || "runtime failure");
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

function parseArguments(argv) {
  const options = {
    commandAudit: [],
    settlementAudit: [],
    storeAudit: [],
    journeyEvents: [],
    resultPages: [],
    epochEvents: [],
    input: [],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (SECRET_KEY.test(argument) || SECRET_VALUE.test(argument)) {
      throw codedError("E_ARGUMENT_SECRET", "secret-like argument rejected");
    }

    const destination = {
      "--command-audit": "commandAudit",
      "--command": "commandAudit",
      "--settlement-audit": "settlementAudit",
      "--settlement": "settlementAudit",
      "--store-audit": "storeAudit",
      "--store": "storeAudit",
      "--journey-events": "journeyEvents",
      "--result-pages": "resultPages",
      "--epoch-events": "epochEvents",
      "--input": "input",
    }[argument];
    if (destination) {
      const value = argv[index + 1];
      if (!value) throw codedError("E_ARGUMENT", `${argument} requires a repository-local path`);
      if (SECRET_KEY.test(value) || SECRET_VALUE.test(value)) {
        throw codedError("E_ARGUMENT_SECRET", `${argument} path rejected`);
      }
      options[destination].push(value);
      index += 1;
      continue;
    }
    throw codedError("E_ARGUMENT", "unknown argument");
  }

  if (!options.help) {
    if (options.commandAudit.length === 0) throw codedError("E_ARGUMENT", "--command-audit is required");
    if (options.settlementAudit.length === 0) throw codedError("E_ARGUMENT", "--settlement-audit is required");
    if (options.storeAudit.length === 0) throw codedError("E_ARGUMENT", "--store-audit is required");
  }
  return options;
}

function runGate(options) {
  const errors = [];
  const sources = loadSources(options, errors);
  const records = sources.flatMap((source) => source.records.map((record) => ({ ...record, role: source.role })));

  const commandReport = analyzeIdempotency(records.filter((record) =>
    ["commandAudit", "settlementAudit", "storeAudit", "input"].includes(record.role),
  ), errors);
  const sideEffectReport = analyzeSideEffects(records, errors);

  const errorCodes = unique(errors.map((error) => error.code));
  const report = {
    ok: errors.length === 0,
    status: errors.length === 0 ? "passed" : "failed",
    schemaVersion: SCHEMA_VERSION,
    metrics: {
      inputFiles: sources.length,
      inputRows: sum(sources.map((source) => source.rowCount)),
      parseErrors: sum(sources.map((source) => source.parseErrors)),
      ...commandReport.metrics,
      sideEffects: sideEffectReport.metrics,
    },
    hashes: {
      inputSetHash: canonicalHash(sources.map((source) => ({
        role: source.role,
        pathHash: source.pathHash,
        sha256: source.sha256,
        rowCount: source.rowCount,
      }))),
      commandIdentitySetHash: setHash(commandReport.identityHashes),
      receiptIdSetHash: setHash(commandReport.receiptIdHashes),
      sideEffectEventIdSetHash: setHash(sideEffectReport.eventIds),
    },
    evidence: {
      files: sources.map((source) => ({
        role: source.role,
        pathHash: source.pathHash,
        sha256: source.sha256,
        rowCount: source.rowCount,
        parseErrors: source.parseErrors,
      })),
      idempotency: commandReport.evidence,
      sideEffects: sideEffectReport.evidence,
    },
    errorCodes,
    errors: errors.slice(0, MAX_ERRORS),
  };
  if (errors.length > MAX_ERRORS) {
    report.truncatedErrors = errors.length - MAX_ERRORS;
  }
  return report;
}

function loadSources(options, errors) {
  const sourceSpecs = [
    ...options.commandAudit.map((inputPath) => ({ role: "commandAudit", inputPath })),
    ...options.settlementAudit.map((inputPath) => ({ role: "settlementAudit", inputPath })),
    ...options.storeAudit.map((inputPath) => ({ role: "storeAudit", inputPath })),
    ...options.journeyEvents.map((inputPath) => ({ role: "journeyEvents", inputPath })),
    ...options.resultPages.map((inputPath) => ({ role: "resultPages", inputPath })),
    ...options.epochEvents.map((inputPath) => ({ role: "epochEvents", inputPath })),
    ...options.input.map((inputPath) => ({ role: "input", inputPath })),
  ];

  return sourceSpecs.map((source) => {
    const file = resolveRepoFile(source.inputPath);
    const buffer = fs.readFileSync(file.real);
    const text = buffer.toString("utf8");
    const parsed = parseRecords(text);
    for (const parseError of parsed.parseErrors.slice(0, MAX_PARSE_ERRORS)) {
      errors.push(error("E_PARSE", {
        role: source.role,
        pathHash: shortHash(file.relative),
        line: parseError.line,
      }));
    }
    if (parsed.records.length === 0) {
      errors.push(error("E_INPUT_EMPTY", {
        role: source.role,
        pathHash: shortHash(file.relative),
      }));
    }
    return {
      role: source.role,
      pathHash: shortHash(file.relative),
      sha256: sha256(buffer),
      rowCount: parsed.records.length,
      parseErrors: parsed.parseErrors.length,
      records: parsed.records.map((record, index) => ({
        value: record,
        sourcePathHash: shortHash(file.relative),
        line: parsed.lines[index] ?? index + 1,
      })),
    };
  });
}

function analyzeIdempotency(records, errors) {
  const entries = records.map((record) => normalizeIdempotencyRecord(record));
  const eligible = entries.filter((entry) => entry.identityKey);
  const grouped = groupBy(eligible, (entry) => entry.identityKey);
  const identityHashes = eligible.map((entry) => shortHash(entry.identityKey));
  const receiptIdHashes = eligible.filter((entry) => entry.receiptId).map((entry) => shortHash(entry.receiptId));
  let repeatedGroups = 0;
  let conflictGroups = 0;
  let provenSingleWriteGroups = 0;
  let duplicateReplays = 0;

  if (eligible.length === 0) {
    errors.push(error("E_IDEMPOTENCY_EVIDENCE_MISSING", { role: "commandAudit" }));
  }

  for (const entry of entries) {
    if (!entry.identityKey) {
      errors.push(error("E_COMMAND_IDENTITY_MISSING", entryLocation(entry)));
    }
    if (!entry.payloadHash && !entry.conflict) {
      errors.push(error("E_PAYLOAD_HASH_MISSING", entryLocation(entry)));
    }
    if (!entry.resultHash && !entry.conflict) {
      errors.push(error("E_RESULT_HASH_MISSING", entryLocation(entry)));
    }
  }

  for (const [identityKey, group] of grouped.entries()) {
    const success = group.filter((entry) => !entry.conflict);
    const payloadHashes = unique(success.map((entry) => entry.payloadHash).filter(Boolean));
    const allPayloadHashes = unique(group.map((entry) => entry.payloadHash).filter(Boolean));
    const groupEvidence = {
      identityHash: shortHash(identityKey),
      attempts: group.length,
      payloadHashCount: allPayloadHashes.length,
    };

    if (group.length > 1) repeatedGroups += 1;
    if (group.some((entry) => entry.duplicate)) duplicateReplays += group.filter((entry) => entry.duplicate).length;

    if (allPayloadHashes.length > 1) {
      conflictGroups += 1;
      if (!group.some((entry) => entry.conflict)) {
        errors.push(error("E_IDEMPOTENCY_CONFLICT_NOT_RECORDED", groupEvidence));
      }
      if (success.length > 1 && unique(success.map((entry) => entry.payloadHash)).length > 1) {
        errors.push(error("E_IDEMPOTENCY_PAYLOAD_CONFLICT_ACCEPTED", groupEvidence));
      }
      const conflictCodes = unique(group.filter((entry) => entry.conflict).map((entry) => entry.errorCode).filter(Boolean));
      if (conflictCodes.length === 0) {
        errors.push(error("E_CONFLICT_ERROR_CODE_MISSING", groupEvidence));
      }
      continue;
    }

    if (group.length <= 1 || payloadHashes.length !== 1) continue;
    const resultHashes = unique(success.map((entry) => entry.resultHash).filter(Boolean));
    if (resultHashes.length !== 1) {
      errors.push(error("E_REPLAY_RESULT_HASH_MISMATCH", groupEvidence));
    }
    if (!group.some((entry) => entry.duplicate || entry.writeCount === 0)) {
      errors.push(error("E_DUPLICATE_REPLAY_EVIDENCE_MISSING", groupEvidence));
    }

    const writeEvidence = group.map((entry) => entry.writeCount).filter((value) => value !== undefined);
    if (writeEvidence.length !== group.length) {
      errors.push(error("E_WRITE_EVIDENCE_MISSING", groupEvidence));
      continue;
    }
    const totalWrites = sum(writeEvidence);
    if (totalWrites !== 1) {
      errors.push(error("E_WRITE_ONCE_VIOLATION", { ...groupEvidence, writeRows: totalWrites }));
    } else {
      provenSingleWriteGroups += 1;
    }
  }

  return {
    metrics: {
      idempotencyAttempts: entries.length,
      idempotencyIdentifiedAttempts: eligible.length,
      idempotencyGroups: grouped.size,
      repeatedIdempotencyGroups: repeatedGroups,
      idempotencyConflictGroups: conflictGroups,
      duplicateReplays,
      provenSingleWriteGroups,
    },
    identityHashes,
    receiptIdHashes,
    evidence: {
      groupCount: grouped.size,
      repeatedGroupCount: repeatedGroups,
      conflictGroupCount: conflictGroups,
      provenSingleWriteGroupCount: provenSingleWriteGroups,
      sampleIdentityHashes: unique(identityHashes).sort().slice(0, MAX_EVIDENCE_IDS),
      sampleReceiptIdHashes: unique(receiptIdHashes).sort().slice(0, MAX_EVIDENCE_IDS),
    },
  };
}

function normalizeIdempotencyRecord(record) {
  const value = record.value;
  const commandId = stringPath(value, [
    ["commandId"],
    ["command_id"],
    ["command", "commandId"],
    ["input", "commandId"],
    ["request", "commandId"],
    ["receipt", "commandId"],
    ["response", "commandId"],
  ]);
  const receiptId = stringPath(value, [
    ["receiptId"],
    ["receipt_id"],
    ["receipt", "receiptId"],
    ["response", "receiptId"],
    ["result", "receiptId"],
    ["runReceipt", "receiptId"],
    ["journeyRunReceipt", "receiptId"],
    ["payload", "receiptId"],
    ["page", "payload", "receipt", "receiptId"],
  ]);
  const idempotencyKey = stringPath(value, [
    ["idempotencyKey"],
    ["idempotency_key"],
    ["command", "idempotencyKey"],
    ["input", "idempotencyKey"],
    ["event", "idempotencyKey"],
    ["page", "idempotencyKey"],
  ]);
  const identityKey = commandId || receiptId || idempotencyKey;
  const conflict = looksConflict(value);
  const payloadHash = normalizedHashValue(value, [
    ["canonicalPayloadHash"],
    ["payloadHash"],
    ["inputHash"],
    ["subjectHash"],
    ["command", "payloadHash"],
    ["command", "subjectHash"],
    ["receipt", "payloadHash"],
    ["response", "payloadHash"],
    ["result", "payloadHash"],
  ]) || hashCandidate(value, [
    ["canonicalPayload"],
    ["payload"],
    ["input"],
    ["request"],
    ["command", "payload"],
    ["command", "input"],
  ]);
  const resultHash = normalizedHashValue(value, [
    ["resultHash"],
    ["responseHash"],
    ["outputHash"],
    ["valueHash"],
    ["receipt", "resultHash"],
    ["response", "resultHash"],
    ["result", "hash"],
  ]) || hashCandidate(value, [
    ["response"],
    ["result"],
    ["value"],
    ["receipt"],
    ["page", "payload", "receipt"],
  ]);
  const writeCount = writeCountEvidence(value);
  return {
    commandId,
    receiptId,
    idempotencyKey,
    identityKey,
    payloadHash,
    resultHash,
    writeCount,
    duplicate: booleanPath(value, [
      ["duplicate"],
      ["replay"],
      ["cached"],
      ["idempotentReplay"],
      ["response", "duplicate"],
      ["result", "duplicate"],
    ]),
    conflict,
    errorCode: stableErrorCode(value),
    role: record.role,
    sourcePathHash: record.sourcePathHash,
    line: record.line,
  };
}

function writeCountEvidence(value) {
  const number = numberPath(value, [
    ["writeCount"],
    ["writeRows"],
    ["rowsWritten"],
    ["rowCount"],
    ["insertedRows"],
    ["storeWrites"],
    ["sideEffectRows"],
    ["metrics", "writeCount"],
    ["metrics", "rowsWritten"],
    ["store", "rowsWritten"],
  ]);
  if (number !== undefined) return number;
  const ids = arrayPath(value, [
    ["rowIds"],
    ["writtenRowIds"],
    ["insertedRowIds"],
    ["storeWriteIds"],
    ["commandRowIds"],
    ["writeEventIds"],
  ]);
  if (ids) return unique(ids.map(String)).length;
  if (looksConflict(value) || booleanPath(value, [["duplicate"], ["replay"], ["cached"], ["response", "duplicate"]])) return 0;
  return undefined;
}

function analyzeSideEffects(records, errors) {
  const buckets = {
    journeyContextCapture: [],
    journeyMarkSettled: [],
    experimentMutation: [],
    resultPageCreation: [],
    economicReward: [],
  };

  for (const record of records) {
    const effects = sideEffectsForRecord(record.value);
    for (const effect of effects) {
      buckets[effect.kind].push({
        ...effect,
        sourcePathHash: record.sourcePathHash,
        line: record.line,
      });
    }
  }

  const metrics = {};
  const evidence = {};
  const allEventIds = [];
  for (const [kind, effects] of Object.entries(buckets)) {
    const eventIds = unique(effects.map((effect) => effect.eventId).filter(Boolean));
    allEventIds.push(...eventIds);
    const duplicateKeys = duplicated(effects.map((effect) => effect.businessKey).filter(Boolean));
    metrics[kind] = {
      rowCount: effects.length,
      eventIdCount: eventIds.length,
      duplicateBusinessKeyCount: duplicateKeys.length,
    };
    evidence[kind] = {
      rowCount: effects.length,
      eventIdsHash: setHash(eventIds),
      sampleEventIdHashes: eventIds.map(shortHash).sort().slice(0, MAX_EVIDENCE_IDS),
      duplicateBusinessKeyHashes: duplicateKeys.map(shortHash).sort().slice(0, MAX_EVIDENCE_IDS),
    };
    if (effects.length === 0) {
      errors.push(error("E_SIDE_EFFECT_EVIDENCE_MISSING", { sideEffect: kind }));
      continue;
    }
    if (eventIds.length === 0) {
      errors.push(error("E_SIDE_EFFECT_EVENT_IDS_MISSING", { sideEffect: kind, rowCount: effects.length }));
    }
    if (duplicateKeys.length > 0) {
      errors.push(error("E_SIDE_EFFECT_DUPLICATE", {
        sideEffect: kind,
        duplicateBusinessKeyCount: duplicateKeys.length,
        duplicateBusinessKeyHashes: duplicateKeys.map(shortHash).sort().slice(0, MAX_EVIDENCE_IDS),
      }));
    }
  }

  return {
    metrics,
    evidence,
    eventIds: allEventIds,
  };
}

function sideEffectsForRecord(value) {
  const event = isRecord(value.event) ? value.event : value;
  const eventType = stringValue(event.eventType) || stringValue(value.type);
  const eventId = stringValue(event.eventId) || stringValue(value.eventId);
  const idempotencyKey = stringValue(event.idempotencyKey) || stringValue(value.idempotencyKey) || stringPath(value, [["page", "idempotencyKey"]]);
  const effects = [];

  const journey = isRecord(event.journey) ? event.journey : {};
  const journeyId = stringValue(event.journeyId) || stringValue(journey.journeyId);
  if (eventType === "journey_episode_recorded" || isRecord(event.episode)) {
    const episode = isRecord(event.episode) ? event.episode : {};
    const episodeId = stringValue(episode.episodeId) || canonicalHash(stableObject(episode.fingerprint || episode));
    effects.push(effect("journeyContextCapture", eventId, idempotencyKey || `${journeyId}:${episodeId}`, {
      journeyId,
      episodeId,
    }));
  }
  if (
    eventType === "journey_settled"
    || eventType === "journey_return_delivered"
    || (eventType === "journey_status_changed" && stringValue(journey.status) === "settled")
    || stringValue(event.status) === "settled"
  ) {
    effects.push(effect("journeyMarkSettled", eventId, idempotencyKey || journeyId, { journeyId }));
  }

  if (looksLikeExperimentMutation(value)) {
    const experimentId = stringPath(value, [
      ["experimentId"],
      ["experiment", "experimentId"],
      ["input", "experimentId"],
      ["response", "experimentId"],
      ["receipt", "experimentId"],
    ]);
    const runIndex = stringPath(value, [
      ["runIndex"],
      ["run", "runIndex"],
      ["input", "runIndex"],
      ["response", "runIndex"],
      ["receipt", "runIndex"],
    ]);
    effects.push(effect("experimentMutation", eventId, idempotencyKey || stringPath(value, [["commandId"], ["command", "commandId"]]) || `${experimentId}:${runIndex}`, {
      experimentId,
      runIndex,
    }));
  }

  const page = isRecord(value.page) ? value.page : value;
  if (value.type === "epoch_result_page" || stringValue(page.pageId) || stringValue(page.urlPath)?.startsWith("/epoch/result/")) {
    const pageId = stringValue(page.pageId);
    const receiptId = stringPath(page, [["payload", "receipt", "receiptId"], ["receipt", "receiptId"]]);
    effects.push(effect("resultPageCreation", pageId || eventId, idempotencyKey || receiptId || pageId, {
      pageId,
      receiptId,
    }));
  }

  if (eventType === "resource_granted" || value.type === "progression_awarded" || isRecord(value.progression)) {
    const rewardKey = idempotencyKey
      || stringValue(value.runTicket)
      || stringPath(value, [["progression", "runTicket"], ["payload", "reason"]])
      || eventId;
    effects.push(effect("economicReward", eventId || stringValue(value.runTicket), rewardKey, {}));
  }
  return effects.filter((entry) => entry.businessKey);
}

function effect(kind, eventId, businessKey, details) {
  return {
    kind,
    eventId: eventId ? String(eventId) : undefined,
    businessKey: businessKey ? `${kind}:${String(businessKey)}` : undefined,
    detailHash: canonicalHash(details),
  };
}

function looksLikeExperimentMutation(value) {
  const type = `${stringValue(value.type) || ""} ${stringValue(value.operation) || ""} ${stringValue(value.eventType) || ""}`.toLowerCase();
  if (/phase6.*experiment|experiment.*(registered|mutated|completed|run|settled|receipt|command)/u.test(type)) return true;
  if (stringPath(value, [["experiment", "experimentId"], ["input", "experimentId"], ["response", "experimentId"]])) return true;
  return false;
}

function parseRecords(input) {
  const whole = tryParseJson(input.trim());
  if (whole !== undefined) {
    return { records: flattenRecords(whole), lines: [], parseErrors: [] };
  }
  const records = [];
  const lines = [];
  const parseErrors = [];
  input.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parsed = extractJsonCandidate(line);
    if (parsed === undefined) {
      parseErrors.push({ line: index + 1 });
      return;
    }
    const before = records.length;
    flattenRecords(parsed, records);
    for (let lineIndex = before; lineIndex < records.length; lineIndex += 1) lines[lineIndex] = index + 1;
  });
  return { records, lines, parseErrors };
}

function flattenRecords(value, records = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenRecords(entry, records));
    return records;
  }
  if (isRecord(value)) {
    for (const key of ["records", "runs", "receipts", "samples", "events", "commands", "settlements", "audits"]) {
      if (Array.isArray(value[key])) return flattenRecords(value[key], records);
    }
    records.push(value);
  }
  return records;
}

function extractJsonCandidate(line) {
  const trimmed = line.trim();
  const direct = tryParseJson(trimmed);
  if (direct !== undefined) return direct;
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    const parsed = tryParseJson(trimmed.slice(objectStart, objectEnd + 1));
    if (parsed !== undefined) return parsed;
  }
  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return tryParseJson(trimmed.slice(arrayStart, arrayEnd + 1));
  }
  return undefined;
}

function tryParseJson(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableObject(entry));
  if (!isRecord(value)) return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (VOLATILE_KEYS.has(key) || SECRET_KEY.test(key)) continue;
    const entry = value[key];
    if (entry === undefined) continue;
    output[key] = stableObject(entry);
  }
  return output;
}

function hashCandidate(value, paths) {
  for (const candidatePath of paths) {
    const candidate = getPath(value, candidatePath);
    if (candidate !== undefined && candidate !== null) return canonicalHash(stableObject(candidate));
  }
  return undefined;
}

function normalizedHashValue(value, paths) {
  const raw = stringPath(value, paths);
  if (!raw) return undefined;
  return raw.startsWith("sha256:") ? raw : `sha256:${raw}`;
}

function stableErrorCode(value) {
  const code = stringPath(value, [
    ["errorCode"],
    ["code"],
    ["error", "code"],
    ["response", "errorCode"],
    ["result", "errorCode"],
  ]);
  if (code) return normalizeCode(code);
  const message = stringPath(value, [["error"], ["message"], ["error", "message"]]);
  if (!message) return undefined;
  if (/idempotency[_ -]?key[_ -]?conflict/i.test(message)) return "idempotency_key_conflict";
  if (/conflicts? with an existing payload/i.test(message)) return "phase6_command_payload_conflict";
  if (/conflict/i.test(message)) return "idempotency_conflict";
  return undefined;
}

function looksConflict(value) {
  const status = stringPath(value, [["status"], ["result", "status"], ["response", "status"]]);
  const code = stableErrorCode(value);
  return /conflict/i.test(status || "") || Boolean(code && /conflict/i.test(code));
}

function normalizeCode(code) {
  return String(code).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function resolveRepoFile(inputPath) {
  if (typeof inputPath !== "string" || inputPath.length === 0 || path.isAbsolute(inputPath)) {
    throw codedError("E_INPUT_PATH", "input path must be repository-relative");
  }
  const repositoryRealPath = fs.realpathSync(repositoryRoot);
  const absolute = path.resolve(repositoryRoot, inputPath);
  let real;
  let stat;
  try {
    real = fs.realpathSync(absolute);
    stat = fs.statSync(real);
  } catch {
    throw codedError("E_INPUT_NOT_FOUND", "input file not found");
  }
  const relative = path.relative(repositoryRealPath, real);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw codedError("E_INPUT_OUTSIDE_REPO", "input file must resolve inside repository");
  }
  if (!stat.isFile()) throw codedError("E_INPUT_NOT_FILE", "input path must be a file");
  return { real, relative: relative.split(path.sep).join("/") };
}

function getPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function stringPath(value, paths) {
  for (const candidatePath of paths) {
    const valueAtPath = getPath(value, candidatePath);
    const string = stringValue(valueAtPath);
    if (string) return string;
  }
  return undefined;
}

function booleanPath(value, paths) {
  for (const candidatePath of paths) {
    const valueAtPath = getPath(value, candidatePath);
    if (typeof valueAtPath === "boolean") return valueAtPath;
  }
  return false;
}

function numberPath(value, paths) {
  for (const candidatePath of paths) {
    const valueAtPath = getPath(value, candidatePath);
    if (typeof valueAtPath === "number" && Number.isSafeInteger(valueAtPath) && valueAtPath >= 0) return valueAtPath;
    if (typeof valueAtPath === "string" && /^(0|[1-9]\d*)$/.test(valueAtPath)) return Number.parseInt(valueAtPath, 10);
  }
  return undefined;
}

function arrayPath(value, paths) {
  for (const candidatePath of paths) {
    const valueAtPath = getPath(value, candidatePath);
    if (Array.isArray(valueAtPath)) return valueAtPath;
  }
  return undefined;
}

function stringValue(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || SECRET_VALUE.test(trimmed)) return undefined;
  return trimmed;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function groupBy(values, keyForValue) {
  const groups = new Map();
  for (const value of values) {
    const key = keyForValue(value);
    const group = groups.get(key) || [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

function unique(values) {
  return [...new Set(values)];
}

function duplicated(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function canonicalHash(value) {
  return sha256(JSON.stringify(value));
}

function setHash(values) {
  return canonicalHash(unique(values).sort());
}

function shortHash(value) {
  return sha256(String(value)).slice(0, 19);
}

function entryLocation(entry) {
  return {
    role: entry.role,
    sourcePathHash: entry.sourcePathHash,
    line: entry.line,
  };
}

function error(code, details = {}) {
  return { code, ...details };
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function failureReport(code, message) {
  return {
    ok: false,
    status: "failed",
    schemaVersion: SCHEMA_VERSION,
    metrics: {},
    hashes: {},
    evidence: {},
    errorCodes: [code],
    errors: [{ code, message }],
  };
}

main();
