#!/usr/bin/env node
// @ts-nocheck

import crypto from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "obsidian-epoch.phase6-ten-run-evidence.v1";
const RUN_RECEIPT_V2_VERSION = "journey_run_receipt.v2";
const SQLITE_SNAPSHOT_URI = "file:/dev/fd/3?immutable=1";
const OUTPUT_MODE = 0o600;
const MAX_MISSING = 500;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|client[-_]?secret|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /(?:\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/i;
const LEGAL_NO_WORLD_CHANGE_REASONS = new Set([
  "already_applied",
  "duplicate_action",
  "idempotent_replay",
  "no_effect",
  "no_material_change",
  "out_of_scope",
  "read_only",
  "replay_only",
  "unchanged",
  "world_delta_not_required",
]);

const PLAYER_PANEL_DOMAINS = [
  "identity",
  "attribute.physique",
  "attribute.agility",
  "attribute.perception",
  "attribute.intellect",
  "attribute.willpower",
  "attribute.luck",
  "readiness.combat",
  "readiness.survival",
  "readiness.exploration",
  "readiness.social",
  "readiness.stealth",
  "readiness.crafting",
  "readiness.cultivation",
  "readiness.resource",
  "readiness.injury",
  "readiness.world",
  "skills",
  "talents",
  "methods",
  "cultivation",
  "injuries",
  "warehouse",
  "currency",
  "materials",
  "equipment",
  "carrySlots",
  "insurance",
  "production",
  "rag",
  "worldCursor",
];

const REQUIRED_SCORE_DIMS = [
  "objective",
  "causalImpact",
  "execution",
  "risk",
  "integrity",
  "efficiency",
  "survival",
  "antiFarmDecay",
];
const PHASE6_SCENARIO_PROTOCOL = Object.freeze([
  { scenarioTag: "low-prepared-resource", taskType: "resource_acquisition" },
  { scenarioTag: "low-underprepared-information", taskType: "information_acquisition" },
  { scenarioTag: "medium-prepared-structured", taskType: "structured_challenge" },
  { scenarioTag: "medium-borderline-companion", taskType: "companion_support" },
  { scenarioTag: "medium-mismatched-preserve", taskType: "resource_preservation" },
  { scenarioTag: "high-prepared-priority", taskType: "priority_commission" },
  { scenarioTag: "high-underprepared-crisis", taskType: "crisis_retreat" },
  { scenarioTag: "medium-prepared-cultivation", taskType: "cultivation_material" },
  { scenarioTag: "medium-specialist-crafting", taskType: "crafting_material" },
  { scenarioTag: "dynamic-mixed-repeat", taskType: "repeated_route_audit" },
]);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

function usage() {
  return [
    "Usage: node tools/agent-server/phase6-ten-run-evidence.mjs --input sanitized.jsonl --output-dir <empty-repo-dir> --expected-runs 10 --sqlite path",
    "",
    "Derives Phase 6 release-gate input JSONL files from sanitized CDE tool JSONL and authoritative SQLite rows.",
    "Fails non-zero when required evidence is missing, mixed across experiments, secret-like material is present, or output would overwrite data.",
  ].join("\n");
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }

    const repoReal = fs.realpathSync(repositoryRoot);
    const inputPath = repoFilePath(options.input, repoReal, "E_INPUT_PATH");
    const outputDir = prepareOutputDirectory(options.outputDir, repoReal);
    const sqlitePath = repoFilePath(options.sqlite, repoReal, "E_SQLITE_PATH");
    const sqliteAuthority = readSqliteAuthority(sqlitePath);
    const sourceText = fs.readFileSync(inputPath, "utf8");
    const parsed = parseJsonl(sourceText);
    const sourceRecords = parsed.records.map((record, index) => normalizeSourceRecord(record, index + 1));
    const manifest = deriveEvidence({
      inputPath,
      outputDir,
      sourceText,
      parseErrors: parsed.parseErrors,
      sources: sourceRecords,
      expectedRuns: options.expectedRuns,
      sqlitePath: repoSlash(sqlitePath),
      sqliteAuthority,
    });
    writeOutputs(outputDir, manifest);
    process.stdout.write(`${JSON.stringify(redactedManifestForStdout(manifest), null, 2)}\n`);
    process.exitCode = manifest.ok ? 0 : 1;
  } catch (error) {
    const code = error?.code || "E_RUNTIME";
    const manifest = {
      schemaVersion: SCHEMA_VERSION,
      ok: false,
      errorCodes: [code],
      errors: [{ code, messageHash: shortHash(error?.message || code) }],
      artifacts: {},
    };
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    process.exitCode = 1;
  }
}

function parseArguments(argv) {
  const options = { input: undefined, outputDir: undefined, expectedRuns: undefined, sqlite: undefined, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (SECRET_KEY.test(argument) || SECRET_VALUE.test(argument)) throw codedError("E_ARGUMENT_SECRET");
    if (argument === "--input" || argument === "--output-dir" || argument === "--sqlite") {
      const value = argv[index + 1];
      if (!value) throw codedError("E_ARGUMENT");
      if (SECRET_KEY.test(value) || SECRET_VALUE.test(value)) throw codedError("E_ARGUMENT_SECRET");
      options[argument.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
      index += 1;
      continue;
    }
    if (argument === "--expected-runs") {
      const raw = argv[index + 1];
      if (!/^[1-9]\d*$/.test(raw || "")) throw codedError("E_EXPECTED_RUNS");
      options.expectedRuns = Number.parseInt(raw, 10);
      if (!Number.isSafeInteger(options.expectedRuns)) throw codedError("E_EXPECTED_RUNS");
      index += 1;
      continue;
    }
    throw codedError("E_ARGUMENT");
  }
  if (!options.help && (!options.input || !options.outputDir || options.expectedRuns === undefined || !options.sqlite)) throw codedError("E_ARGUMENT_REQUIRED");
  return options;
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function repoFilePath(input, repoReal, code) {
  const resolved = path.resolve(repositoryRoot, input);
  const real = fs.realpathSync(resolved);
  if (!inside(real, repoReal) || !fs.statSync(real).isFile()) throw codedError(code);
  return real;
}

function prepareOutputDirectory(input, repoReal) {
  const resolved = path.resolve(repositoryRoot, input);
  const parent = fs.existsSync(resolved) ? resolved : path.dirname(resolved);
  const parentReal = fs.realpathSync(parent);
  if (!inside(parentReal, repoReal)) throw codedError("E_OUTPUT_OUTSIDE_REPO");
  if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
  const real = fs.realpathSync(resolved);
  if (!inside(real, repoReal) || !fs.statSync(real).isDirectory()) throw codedError("E_OUTPUT_DIR");
  if (fs.readdirSync(real).length > 0) throw codedError("E_OUTPUT_NOT_EMPTY");
  return real;
}

function inside(target, root) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function repoSlash(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}

function parseJsonl(text) {
  const records = [];
  const parseErrors = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      records.push(JSON.parse(line));
    } catch {
      parseErrors.push({ line: index + 1 });
    }
  });
  return { records, parseErrors };
}

function normalizeSourceRecord(record, line) {
  const root = isRecord(record.output) ? record.output : {};
  const binding = bindingFor(record, root);
  const transportVersion = stringValue(root.transportVersion);
  return {
    sourceKind: "sanitized-jsonl",
    sourceLine: line,
    record,
    root,
    binding,
    compactTransport: Boolean(
      String(record.toolName || "").endsWith("_compact")
      || (transportVersion && transportVersion.includes(".compact.")),
    ),
    candidateSha256: canonicalHash({ line, toolName: record.toolName, output: root }),
    marker: {
      playerPanelBefore: record.playerPanelBefore === true,
      playerPanelAfter: record.playerPanelAfter === true,
    },
  };
}

function bindingFor(record, root) {
  return {
    experimentId: stringValue(firstValue(root, [["experimentId"], ["phase6ExperimentId"], ["RunReceipt", "experimentId"], ["runReceipt", "experimentId"]])
      ?? firstValue(record, [["metadata", "experimentId"], ["input", "experimentId"], ["experimentId"]])),
    runIndex: integerValue(firstValue(root, [["runIndex"], ["run_index"], ["RunReceipt", "runIndex"], ["runReceipt", "runIndex"]])
      ?? firstValue(record, [["metadata", "runIndex"], ["input", "runIndex"], ["runIndex"]])),
    journeyId: stringValue(firstValue(root, [["journeyId"], ["journey_id"], ["runId"], ["RunReceipt", "runId"], ["runReceipt", "runId"], ["journey", "journeyId"]])
      ?? firstValue(record, [["input", "journeyId"], ["journeyId"]])),
    receiptId: stringValue(firstValue(root, [["receiptId"], ["receipt_id"], ["RunReceipt", "receiptId"], ["runReceipt", "receiptId"], ["receipt", "receiptId"], ["journeyRunReceipt", "receiptId"]])
      ?? firstValue(record, [["input", "receiptId"], ["receiptId"]])),
  };
}

function validateCdeProtocol(sources, expectedRuns, errors) {
  const successful = (toolName) => sources.filter((source) =>
    source.record?.toolName === toolName && source.record?.ok === true);
  const panelCalls = successful("obsidian_epoch.player_panel");
  if (panelCalls.length !== expectedRuns * 2) {
    errors.push({ code: "E_CDE_PLAYER_PANEL_CALL_COUNT", expected: expectedRuns * 2, actual: panelCalls.length });
  }
  const prepareCalls = successful("obsidian_epoch.prepare_journey");
  const beginCalls = successful("obsidian_epoch.begin_phase6_run");
  for (let runIndex = 1; runIndex <= expectedRuns; runIndex += 1) {
    const expected = PHASE6_SCENARIO_PROTOCOL[runIndex - 1];
    const panels = panelCalls.filter((source) => source.binding.runIndex === runIndex);
    const before = panels.filter((source) => source.marker.playerPanelBefore).length;
    const after = panels.filter((source) => source.marker.playerPanelAfter).length;
    if (panels.length !== 2 || before !== 1 || after !== 1) {
      errors.push({
        code: "E_CDE_PLAYER_PANEL_RUN_PROTOCOL",
        runIndex,
        expected: { calls: 2, before: 1, after: 1 },
        actual: { calls: panels.length, before, after },
      });
    }
    const prepares = prepareCalls.filter((source) => source.binding.runIndex === runIndex);
    const taskTypes = unique(prepares.map((source) => stringValue(firstValue(source.record, [
      ["input", "taskType"], ["input", "task_type"], ["output", "taskType"], ["output", "task", "type"],
    ]))).filter(Boolean));
    if (prepares.length !== 1 || taskTypes.length !== 1 || taskTypes[0] !== expected?.taskType) {
      errors.push({
        code: "E_CDE_PREPARE_SCENARIO_PROTOCOL",
        runIndex,
        expected: expected?.taskType,
        actual: taskTypes,
        calls: prepares.length,
      });
    }
    const begins = beginCalls.filter((source) => source.binding.runIndex === runIndex);
    const scenarioTags = unique(begins.map((source) => stringValue(firstValue(source.record, [
      ["input", "scenarioTag"], ["input", "scenario_tag"], ["output", "scenarioTag"],
      ["output", "scenario", "tag"], ["output", "startJourneyBinding", "scenarioTag"],
      ["output", "startJourneyBinding", "scenarioMatrix", "scenarioTag"],
    ]))).filter(Boolean));
    if (begins.length !== 1 || scenarioTags.length !== 1 || scenarioTags[0] !== expected?.scenarioTag) {
      errors.push({
        code: "E_CDE_BEGIN_SCENARIO_PROTOCOL",
        runIndex,
        expected: expected?.scenarioTag,
        actual: scenarioTags,
        calls: begins.length,
      });
    }
  }
}

function deriveEvidence({ inputPath, outputDir, sourceText, parseErrors, sources, expectedRuns, sqlitePath, sqliteAuthority }) {
  const errors = [];
  const warnings = [];
  const secretFindings = [];
  sources.forEach((source) => scanSecrets(source.root, `source:${source.sourceKind}:${source.sourceLine}.output`, secretFindings));
  if (secretFindings.length > 0) errors.push({ code: "E_SECRET_INPUT", count: secretFindings.length });
  if (parseErrors.length > 0) errors.push({ code: "E_PARSE", count: parseErrors.length });

  const experimentIds = unique(sources.map((source) => source.binding.experimentId).filter(Boolean));
  if (experimentIds.length !== 1) errors.push({ code: "E_EXPERIMENT_BINDING", actual: experimentIds.length });
  const expectedExperimentId = experimentIds.length === 1 ? experimentIds[0] : undefined;
  const scopedSources = expectedExperimentId ? sources.filter((source) => source.binding.experimentId === expectedExperimentId) : sources;
  validateCdeProtocol(scopedSources, expectedRuns, errors);
  const legacyEvidenceSources = scopedSources.filter((source) => !source.compactTransport);
  const sourceReceiptCandidates = collectReceiptCandidates(sources.filter((source) => !source.compactTransport));
  if (sourceReceiptCandidates.length > 0) validateReceiptCandidates(sourceReceiptCandidates, expectedRuns, errors);
  const sqliteReceiptCandidates = collectSqliteReceiptCandidates(sqliteAuthority);
  const receiptContract = validateReceiptCandidates(sqliteReceiptCandidates, expectedRuns, errors);
  validateSourceReceiptAuthority(sourceReceiptCandidates, sqliteAuthority, errors);
  const scopedReceiptCandidates = expectedExperimentId
    ? sqliteReceiptCandidates.filter((candidate) => candidate.binding.experimentId === expectedExperimentId)
    : sqliteReceiptCandidates;
  const authoritativeSources = scopedReceiptCandidates.map((candidate) => candidate.source);
  const authoritativeWorldSources = [
    ...authoritativeSources,
    ...collectSqliteWorldEventSources(sqliteAuthority, scopedReceiptCandidates),
  ];
  const panelSources = [...collectSqlitePanelSources(scopedReceiptCandidates), ...legacyEvidenceSources];

  const legacyEconomy = collectEconomyAudits(legacyEvidenceSources, expectedRuns);
  const legacyProgression = collectProgression(legacyEvidenceSources);
  const legacyRag = collectRagQueries(legacyEvidenceSources);
  const legacyScores = collectScores(legacyEvidenceSources, expectedRuns);
  const formalEconomy = collectSqliteResultPageEconomy(sqliteAuthority, expectedExperimentId, expectedRuns);
  const formalProgression = collectSqliteResultPageProgression(sqliteAuthority, expectedExperimentId);
  const formalScores = collectSqliteResultPageScores(sqliteAuthority, expectedExperimentId, expectedRuns);
  const authoritativeRag = collectSqliteRagTraces(sqliteAuthority, expectedExperimentId);

  const artifacts = {
    "panels-before.jsonl": collectPanels(panelSources, "before", expectedRuns),
    "panels-after.jsonl": collectPanels(panelSources, "after", expectedRuns),
    "receipts.jsonl": collectReceipts(scopedReceiptCandidates, expectedRuns),
    "economy-audit.jsonl": sqliteAuthority.hasResultPageSchema ? formalEconomy : legacyEconomy,
    "progression.jsonl": sqliteAuthority.hasResultPageSchema ? formalProgression : legacyProgression,
    "rag-query-evaluations.jsonl": sqliteAuthority.hasRagTraceSchema ? authoritativeRag : legacyRag,
    "world-evidence.jsonl": collectWorldEvidence(
      sqliteAuthority.hasRequiredSchema ? authoritativeWorldSources : legacyEvidenceSources,
    ),
    "scores.jsonl": sqliteAuthority.hasResultPageSchema ? formalScores : legacyScores,
    "shop.jsonl": collectShop(legacyEvidenceSources),
    "crafting.jsonl": collectCrafting(legacyEvidenceSources),
    "crafting-recipes.jsonl": collectCraftingRole(legacyEvidenceSources, "recipes"),
    "crafting-crafts.jsonl": collectCraftingRole(legacyEvidenceSources, "crafts"),
    "crafting-progression.jsonl": collectCraftingRole(legacyEvidenceSources, "progression"),
  };

  validateBindings(artifacts, expectedRuns, errors);
  validatePanelReceiptHashes(artifacts, errors);
  validateSqliteAuthority(artifacts, expectedRuns, sqliteAuthority, receiptContract, errors);
  validateRequiredEvidence(artifacts, expectedRuns, errors, warnings);

  const artifactSummaries = {};
  for (const [name, artifact] of Object.entries(artifacts)) {
    artifactSummaries[name] = summarizeArtifact(name, artifact.records);
  }

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    ok: errors.length === 0,
    generatedAt: new Date().toISOString(),
    input: {
      path: repoSlash(inputPath),
      sha256: sha256(sourceText),
      expectedRuns,
      sqlite: {
        path: sqlitePath,
        sha256: sqliteAuthority.fileSha256,
        bytes: sqliteAuthority.fileBytes,
      },
    },
    experiment: {
      experimentIdHash: expectedExperimentId ? shortHash(expectedExperimentId) : null,
      actualExperimentCount: experimentIds.length,
      runIndexes: unique(scopedSources.map((source) => source.binding.runIndex).filter((value) => value !== undefined)).sort((a, b) => a - b),
    },
    artifacts: artifactSummaries,
    missing: errors.filter((entry) => entry.code.startsWith("E_MISSING") || entry.code.endsWith("_MISSING")).slice(0, MAX_MISSING),
    errorCodes: unique(errors.map((entry) => entry.code)),
    errors: errors.slice(0, MAX_MISSING),
    truncatedErrors: Math.max(0, errors.length - MAX_MISSING),
    warningCodes: unique(warnings.map((entry) => entry.code)),
    warnings: warnings.slice(0, MAX_MISSING),
    truncatedWarnings: Math.max(0, warnings.length - MAX_MISSING),
    releaseGateInputs: releaseGateInputs(artifactSummaries),
  };
  manifest._records = artifacts;
  return manifest;
}

function collectPanels(sources, phase, expectedRuns) {
  const candidatesByRun = new Map();
  for (const source of sources) {
    const candidates = findAll(source.root, (value) => isRecord(value) && looksLikePanel(value));
    const markerBoost = phase === "before" ? source.marker.playerPanelBefore : source.marker.playerPanelAfter;
    const direct = panelAtExpectedPath(source.root, phase);
    const ordered = direct ? [direct, ...candidates.filter((entry) => entry !== direct)] : candidates;
    for (const panel of ordered) {
      if (!hasPanelRequiredFields(panel)) continue;
      const runIndex = source.binding.runIndex;
      if (!runIndex || runIndex < 1 || runIndex > expectedRuns) continue;
      const candidate = evidenceRecord(source, { playerPanel: panel, groups: groupObject() });
      const runCandidates = candidatesByRun.get(runIndex) ?? [];
      runCandidates.push({ record: candidate, markerBoost, sourceLine: source.sourceLine });
      candidatesByRun.set(runIndex, runCandidates);
      break;
    }
  }
  return {
    records: [...candidatesByRun.entries()]
      .sort(numericEntrySort)
      .map(([, candidates]) => {
        const marked = candidates.find((candidate) => candidate.markerBoost);
        if (marked) return marked.record;
        const sorted = candidates.slice().sort((left, right) => left.sourceLine - right.sourceLine);
        return phase === "before" ? sorted[0].record : sorted[sorted.length - 1].record;
      }),
  };
}

function panelAtExpectedPath(root, phase) {
  const values = phase === "before"
    ? [root.playerPanelBefore, root.beforePlayerPanel, root.before?.playerPanel, root.snapshots?.before?.body]
    : [root.playerPanelAfter, root.afterPlayerPanel, root.after?.playerPanel, root.snapshots?.after?.body];
  return values.find(isRecord);
}

function groupObject() {
  return { primary: true, secondary: true };
}

function hasPanelRequiredFields(panel) {
  return PLAYER_PANEL_DOMAINS.every((domain) => domainValue(panel, domain) !== undefined)
    || hasCanonicalPhase6PanelFields(panel);
}

function hasCanonicalPhase6PanelFields(panel) {
  const attributes = recordAt(panel, ["attributes"]);
  const readiness = recordAt(panel, ["readiness"]);
  const progression = recordAt(panel, ["progression"]);
  const economy = recordAt(panel, ["economy"]);
  return isRecord(panel.identity)
    && ["strength", "agility", "physique", "intellect", "willpower", "spirituality"].every((key) => attributes[key] !== undefined)
    && ["adaptation", "control", "corruptionResistance", "mobility", "offense", "perception", "protection", "reserve", "sustain", "synergy"].every((key) => readiness[key] !== undefined)
    && ["skills", "talents", "cultivation", "injuries"].every((key) => progression[key] !== undefined)
    && ["warehouse", "currencies", "materials", "equipment", "carry", "insurance", "production"].every((key) => economy[key] !== undefined)
    && panel.ragPanel !== undefined
    && panel.worldCursor !== undefined;
}

function recordAt(value, pathSegments) {
  const found = getPath(value, pathSegments);
  return isRecord(found) ? found : {};
}

function looksLikePanel(value) {
  return isRecord(value) && hasPanelRequiredFields(value);
}

function domainValue(panel, domain) {
  const [prefix, key] = domain.split(".");
  if (prefix === "attribute") return firstValue(panel, [["attributes", key], ["baseAttributes", key], ["sixAttributes", key], ["stats", key]]);
  if (prefix === "readiness") return firstValue(panel, [["readiness", key], ["readinessDimensions", key], ["preparedness", key]]);
  const paths = {
    identity: [["identity"], ["playerIdentity"], ["character"], ["player"], ["profile", "identity"]],
    skills: [["skills"], ["abilities", "skills"], ["progression", "skills"]],
    talents: [["talents"], ["abilities", "talents"], ["progression", "talents"]],
    methods: [["methods"], ["cultivationMethods"], ["progression", "methods"]],
    cultivation: [["cultivation"], ["realm"], ["progression", "cultivation"]],
    injuries: [["injuries"], ["wounds"], ["health", "injuries"], ["status", "injuries"]],
    warehouse: [["warehouse"], ["storage", "warehouse"], ["inventory", "warehouse"]],
    currency: [["currency"], ["currencies"], ["money"], ["wallet"], ["economy", "currency"]],
    materials: [["materials"], ["inventory", "materials"], ["warehouse", "materials"]],
    equipment: [["equipment"], ["gear"], ["inventory", "equipment"]],
    carrySlots: [["carrySlots"], ["inventory", "carrySlots"], ["bag", "slots"]],
    insurance: [["insurance"], ["safety", "insurance"], ["economy", "insurance"]],
    production: [["production"], ["crafting", "production"], ["workshop", "production"]],
    rag: [["rag"], ["RAG"], ["memory"], ["retrieval"], ["knowledge"]],
    worldCursor: [["worldCursor"], ["cursor"], ["world", "cursor"], ["world", "canonicalCursor"]],
  };
  return firstValue(panel, paths[domain] || []);
}

function collectReceiptCandidates(sources) {
  const candidates = [];
  for (const source of sources) {
    for (const receipt of findAll(source.root, looksLikeRunReceipt)) {
      const binding = receiptBinding(receipt);
      candidates.push({
        source,
        receipt,
        binding,
        contentSha256: canonicalHash(receipt),
      });
    }
  }
  return candidates;
}

function sqliteEvidenceSource(run, root, sourceKind) {
  const binding = {
    experimentId: run.experimentId,
    runIndex: run.runIndex,
    journeyId: run.journeyId,
    receiptId: run.receiptId,
  };
  return {
    sourceKind,
    sourceLine: run.runIndex,
    record: {},
    root,
    binding,
    compactTransport: false,
    candidateSha256: canonicalHash({ sourceKind, binding, root }),
    marker: { playerPanelBefore: true, playerPanelAfter: true },
  };
}

function collectSqliteReceiptCandidates(sqliteAuthority) {
  if (!sqliteAuthority?.hasRequiredSchema) return [];
  return [...sqliteAuthority.runsByExperimentRun.values()]
    .sort((left, right) => left.experimentId.localeCompare(right.experimentId) || left.runIndex - right.runIndex)
    .flatMap((run) => {
      const authoritative = sqliteAuthority.receiptsById.get(run.receiptId);
      if (!authoritative) return [];
      const source = sqliteEvidenceSource(run, { runReceipt: authoritative.receiptJson }, "authoritative-sqlite-receipt");
      return [{
        source,
        receipt: authoritative.receiptJson,
        binding: receiptBinding(authoritative.receiptJson),
        contentSha256: canonicalHash(authoritative.receiptJson),
      }];
    });
}

function validateSourceReceiptAuthority(sourceCandidates, sqliteAuthority, errors) {
  for (const candidate of sourceCandidates) {
    const receiptId = candidate.binding.receiptId;
    if (!receiptId) continue;
    const authoritative = sqliteAuthority.receiptsById.get(receiptId);
    if (!authoritative) {
      errors.push({ code: "E_SQLITE_RECEIPT_MISSING", runIndex: candidate.binding.runIndex ?? null });
      continue;
    }
    if (canonicalHash(candidate.receipt) !== canonicalHash(authoritative.receiptJson)) {
      errors.push({ code: "E_SQLITE_RECEIPT_CONTENT_MISMATCH", runIndex: candidate.binding.runIndex ?? null });
    }
  }
}

function collectSqlitePanelSources(receiptCandidates) {
  return receiptCandidates.map((candidate) => ({
    ...candidate.source,
    sourceKind: "authoritative-sqlite-panel",
    root: {
      playerPanelBefore: candidate.receipt.snapshots?.before?.body,
      playerPanelAfter: candidate.receipt.snapshots?.after?.body,
    },
  }));
}

function collectSqliteWorldEventSources(sqliteAuthority, receiptCandidates) {
  return receiptCandidates.flatMap((candidate) => receiptEventIds(candidate.receipt).flatMap((eventId) => {
    const event = sqliteAuthority.eventsByJourneyEvent.get(sqliteEventKey(candidate.binding.journeyId, eventId))
      ?? sqliteAuthority.eventsById.get(eventId);
    if (!isRecord(event?.eventJson)) return [];
    return [{
      ...candidate.source,
      sourceKind: "authoritative-sqlite-world-event",
      root: event.eventJson,
      candidateSha256: canonicalHash({
        sourceKind: "authoritative-sqlite-world-event",
        binding: candidate.binding,
        event: event.eventJson,
      }),
    }];
  }));
}

function runForReceipt(sqliteAuthority, receiptId) {
  return [...sqliteAuthority.runsByExperimentRun.values()].find((run) => run.receiptId === receiptId);
}

function scopedSqliteRuns(sqliteAuthority, experimentId, expectedRuns = Number.MAX_SAFE_INTEGER) {
  return [...sqliteAuthority.runsByExperimentRun.values()]
    .filter((run) => (!experimentId || run.experimentId === experimentId) && run.runIndex <= expectedRuns)
    .sort((left, right) => left.runIndex - right.runIndex);
}

function collectSqliteResultPageEconomy(sqliteAuthority, experimentId, expectedRuns) {
  const records = scopedSqliteRuns(sqliteAuthority, experimentId, expectedRuns).flatMap((run) => {
    const page = sqliteAuthority.resultPagesByReceiptId.get(run.receiptId);
    const conservation = page?.sections?.settlement?.economyConservation;
    if (!isRecord(conservation)) return [];
    const source = sqliteEvidenceSource(run, page, "authoritative-sqlite-result-page");
    return [evidenceRecord(source, {
      ok: conservation.conserved === true,
      conserved: conservation.conserved === true,
      assets: Array.isArray(conservation.assets) ? conservation.assets : [],
      feeSplits: [],
      accountBalances: [],
      negativeInventories: [],
      duplicateSources: [],
      findings: Array.isArray(conservation.auditFindingIds) ? conservation.auditFindingIds : [],
    })];
  });
  return { records };
}

function canonicalProgressionForEvidence(snapshotBody) {
  const body = recordAt(snapshotBody, []);
  const progression = recordAt(body, ["progression"]);
  return {
    attributes: body.attributes,
    skills: progression.skills,
    talents: progression.talents,
    cultivation: progression.cultivation,
    injuries: progression.injuries,
  };
}

function collectSqliteResultPageProgression(sqliteAuthority, experimentId) {
  const records = scopedSqliteRuns(sqliteAuthority, experimentId).flatMap((run) => {
    const stored = sqliteAuthority.receiptsById.get(run.receiptId);
    const resultPage = sqliteAuthority.resultPageRecordsByReceiptId.get(run.receiptId);
    if (!stored || !resultPage) return [];
    const receipt = stored.receiptJson;
    const source = sqliteEvidenceSource(run, resultPage, "authoritative-sqlite-progression");
    return [evidenceRecord(source, { runReceipt: receipt, resultPage })];
  });
  return { records };
}

function collectSqliteResultPageScores(sqliteAuthority, experimentId, expectedRuns) {
  const records = scopedSqliteRuns(sqliteAuthority, experimentId, expectedRuns).flatMap((run) => {
    const page = sqliteAuthority.resultPagesByReceiptId.get(run.receiptId);
    const storedPage = sqliteAuthority.resultPageRecordsByReceiptId.get(run.receiptId);
    const storedReceipt = sqliteAuthority.receiptsById.get(run.receiptId);
    const scores = page?.sections?.scores;
    const score = storedReceipt?.receiptJson?.score;
    const phase6 = getPath(storedPage, ["payload", "receipt", "phase6"]);
    if (!Array.isArray(scores)
      || !isRecord(score)
      || phase6?.verified !== true
      || phase6?.ok !== true
      || !resultPageScoreMatchesReceipt(page, score)) return [];
    const source = sqliteEvidenceSource(run, page, "authoritative-sqlite-result-page");
    return [evidenceRecord(source, { score })];
  });
  return { records };
}

function resultPageScoreMatchesReceipt(page, score) {
  const summary = page?.sections?.scoreSummary;
  const dimensions = findScoreDimensions(score);
  const details = page?.sections?.scores;
  if (!isRecord(summary) || !isRecord(dimensions) || !Array.isArray(details)) return false;
  const expectedSummary = {
    contractVersion: score.contractVersion,
    authority: score.authority,
    weightedTotal: score.weightedTotal,
    decay: score.decay,
    total: score.total,
    formula: score.formula,
    context: score.context,
  };
  if (canonicalHash(summary) !== canonicalHash(expectedSummary)) return false;
  if (details.length !== REQUIRED_SCORE_DIMS.length) return false;
  const byDimension = new Map(details.map((detail) => [detail?.dimension, detail]));
  if (byDimension.size !== REQUIRED_SCORE_DIMS.length) return false;
  return REQUIRED_SCORE_DIMS.every((dimension) => {
    const metric = dimensions[dimension];
    const detail = byDimension.get(dimension);
    if (!isRecord(metric) || !isRecord(detail) || detail.source !== "server_authoritative") return false;
    return canonicalHash({
      value: detail.value,
      score: detail.score,
      weightBps: detail.weightBps,
      contribution: detail.contribution,
      reasonCode: detail.reasonCode,
      formula: detail.formula,
      inputs: detail.inputs,
      inputContributions: detail.inputContributions,
      eventIds: detail.eventIds,
    }) === canonicalHash({
      value: metric.value,
      score: metric.value,
      weightBps: metric.weightBps,
      contribution: metric.contribution,
      reasonCode: metric.reasonCode,
      formula: metric.formula,
      inputs: metric.inputs,
      inputContributions: metric.inputContributions,
      eventIds: metric.events,
    });
  });
}

function collectSqliteRagTraces(sqliteAuthority, experimentId) {
  const records = sqliteAuthority.ragTraces
    .filter((entry) => !experimentId || entry.experimentId === experimentId)
    .sort((left, right) => left.runIndex - right.runIndex)
    .map((entry) => evidenceRecord(
      sqliteEvidenceSource(entry, entry.trace, "authoritative-sqlite-rag-trace"),
      { phase6RagTrace: entry.trace },
    ));
  return { records };
}

function collectReceipts(candidates, expectedRuns) {
  const byRun = new Map();
  for (const candidate of candidates) {
    const { source, receipt, binding } = candidate;
    if (!binding.runIndex || binding.runIndex < 1 || binding.runIndex > expectedRuns) continue;
    const record = evidenceRecord({ ...source, binding }, receiptWrapper(receipt));
    if (!byRun.has(binding.runIndex)) byRun.set(binding.runIndex, record);
  }
  return { records: [...byRun.entries()].sort(numericEntrySort).map(([, record]) => record) };
}

function receiptWrapper(receipt) {
  return {
    receiptType: receipt.receiptType,
    version: receipt.version,
    rulesetVersion: receiptVersionValue(receipt, "rules"),
    catalogVersion: receiptVersionValue(receipt, "catalog"),
    codeVersion: receiptVersionValue(receipt, "code"),
    receiptId: receipt.receiptId,
    runId: receipt.runId,
    beforePanelHash: receipt.beforePanelHash ?? receipt.snapshots?.before?.hash ?? receipt.integrity?.beforeSnapshotHash,
    afterPanelHash: receipt.afterPanelHash ?? receipt.snapshots?.after?.hash ?? receipt.integrity?.afterSnapshotHash,
    panelDiffHash: receipt.panelDiffHash,
    snapshots: receipt.snapshots,
    deltas: receipt.deltas,
    integrity: receipt.integrity,
    noChangeReason: receipt.noChangeReason,
    stableReason: receipt.stableReason,
    noChangeReasons: receipt.noChangeReasons,
    stableReasons: receipt.stableReasons,
    domainReasons: receipt.domainReasons,
    score: receipt.score,
    runReceipt: receipt,
  };
}

function receiptBinding(receipt) {
  return {
    experimentId: stringValue(firstValue(receipt, [["experimentId"], ["experiment_id"], ["run", "experimentId"], ["run", "experiment_id"]])),
    runIndex: integerValue(firstValue(receipt, [["runIndex"], ["run_index"], ["run", "runIndex"], ["run", "run_index"]])),
    journeyId: stringValue(firstValue(receipt, [["journeyId"], ["journey_id"], ["run", "journeyId"], ["run", "journey_id"]])),
    receiptId: stringValue(firstValue(receipt, [["receiptId"], ["receipt_id"]])),
  };
}

function receiptSchemaVersion(receipt) {
  return stringValue(firstValue(receipt, [["version"], ["schemaVersion"], ["schema_version"], ["schema"]]));
}

function receiptVersionValue(receipt, kind) {
  if (kind === "rules") {
    return stringValue(firstValue(receipt, [["rulesetVersion"], ["rulesVersion"], ["ruleset_version"], ["rules_version"], ["versions", "rulesetVersion"], ["versions", "rulesVersion"]]));
  }
  if (kind === "catalog") {
    return stringValue(firstValue(receipt, [["catalogVersion"], ["catalog_version"], ["versions", "catalogVersion"]]));
  }
  return stringValue(firstValue(receipt, [["codeVersion"], ["code_version"], ["versions", "codeVersion"]]));
}

function validateReceiptCandidates(candidates, expectedRuns, errors) {
  const byExperimentRun = new Map();
  const byReceiptId = new Map();
  const versions = {
    receiptVersion: new Set(),
    rulesVersion: new Set(),
    catalogVersion: new Set(),
    codeVersion: new Set(),
  };

  for (const candidate of candidates) {
    const { source, receipt, binding } = candidate;
    for (const field of ["experimentId", "runIndex", "journeyId", "receiptId"]) {
      if (binding[field] === undefined) errors.push({ code: "E_RECEIPT_BINDING_MISSING", field, sourceLine: source.sourceLine });
      if (binding[field] !== undefined && source.binding[field] !== undefined && binding[field] !== source.binding[field]) {
        errors.push({ code: "E_RECEIPT_BINDING_CONFLICT", field, sourceLine: source.sourceLine });
      }
    }
    if (!Number.isInteger(binding.runIndex) || binding.runIndex < 1 || binding.runIndex > expectedRuns) {
      errors.push({ code: "E_RECEIPT_RUN_INDEX_INVALID", sourceLine: source.sourceLine });
    }

    validateReceiptAliasAgreement(receipt, source.sourceLine, errors);
    const schemaVersion = receiptSchemaVersion(receipt);
    const rulesVersion = receiptVersionValue(receipt, "rules");
    const catalogVersion = receiptVersionValue(receipt, "catalog");
    const codeVersion = receiptVersionValue(receipt, "code");
    if (schemaVersion !== RUN_RECEIPT_V2_VERSION) errors.push({ code: "E_RECEIPT_V2_REQUIRED", sourceLine: source.sourceLine });
    for (const [field, value] of [["rulesVersion", rulesVersion], ["catalogVersion", catalogVersion], ["codeVersion", codeVersion]]) {
      if (!value) errors.push({ code: "E_RECEIPT_VERSION_MISSING", field, sourceLine: source.sourceLine });
    }
    if (schemaVersion) versions.receiptVersion.add(schemaVersion);
    if (rulesVersion) versions.rulesVersion.add(rulesVersion);
    if (catalogVersion) versions.catalogVersion.add(catalogVersion);
    if (codeVersion) versions.codeVersion.add(codeVersion);

    if (binding.experimentId && Number.isInteger(binding.runIndex)) {
      addReceiptCandidate(byExperimentRun, sqliteRunKey(binding.experimentId, binding.runIndex), candidate);
    }
    if (binding.receiptId) addReceiptCandidate(byReceiptId, binding.receiptId, candidate);
  }

  validateReceiptCandidateGroups(byExperimentRun, "E_RECEIPT_RUN_DUPLICATE", errors);
  validateReceiptCandidateGroups(byReceiptId, "E_RECEIPT_ID_DUPLICATE", errors);
  for (const [field, values] of Object.entries(versions)) {
    if (values.size !== 1) errors.push({ code: "E_RECEIPT_VERSION_INCONSISTENT", field, actual: values.size });
  }
  return Object.fromEntries(Object.entries(versions).map(([field, values]) => [field, values.size === 1 ? [...values][0] : undefined]));
}

function validateReceiptAliasAgreement(receipt, sourceLine, errors) {
  const groups = [
    ["experimentId", [["experimentId"], ["experiment_id"], ["run", "experimentId"], ["run", "experiment_id"]], stringValue],
    ["runIndex", [["runIndex"], ["run_index"], ["run", "runIndex"], ["run", "run_index"]], integerValue],
    ["runId", [["runId"], ["run_id"], ["run", "runId"], ["run", "run_id"]], stringValue],
    ["journeyId", [["journeyId"], ["journey_id"], ["run", "journeyId"], ["run", "journey_id"]], stringValue],
    ["receiptId", [["receiptId"], ["receipt_id"]], stringValue],
    ["rulesVersion", [["rulesetVersion"], ["rulesVersion"], ["ruleset_version"], ["rules_version"], ["versions", "rulesetVersion"], ["versions", "rulesVersion"]], stringValue],
    ["catalogVersion", [["catalogVersion"], ["catalog_version"], ["versions", "catalogVersion"]], stringValue],
    ["codeVersion", [["codeVersion"], ["code_version"], ["versions", "codeVersion"]], stringValue],
  ];
  for (const [field, paths, normalize] of groups) {
    const values = unique(paths.map((segments) => normalize(getPath(receipt, segments))).filter((value) => value !== undefined));
    if (values.length > 1) errors.push({ code: "E_RECEIPT_FIELD_CONFLICT", field, sourceLine });
  }
}

function addReceiptCandidate(map, key, candidate) {
  const entries = map.get(key) ?? [];
  entries.push(candidate);
  map.set(key, entries);
}

function validateReceiptCandidateGroups(groups, duplicateCode, errors) {
  for (const entries of groups.values()) {
    if (entries.length < 2) continue;
    const first = entries[0];
    errors.push({
      code: duplicateCode,
      runIndex: first.binding.runIndex ?? null,
      identityHash: shortHash(duplicateCode === "E_RECEIPT_ID_DUPLICATE" ? first.binding.receiptId : `${first.binding.experimentId}:${first.binding.runIndex}`),
      count: entries.length,
    });
    if (unique(entries.map((entry) => entry.contentSha256)).length > 1) {
      errors.push({ code: "E_RECEIPT_CONTENT_CONFLICT", runIndex: first.binding.runIndex ?? null });
    }
  }
}

function collectEconomyAudits(sources, expectedRuns) {
  return { records: uniqueRecords(sources.flatMap((source) =>
    findAll(source.root, looksLikeEconomyAudit)
      .filter(() => source.binding.runIndex && source.binding.runIndex <= expectedRuns)
      .map((audit) => evidenceRecord(source, audit)))) };
}

function collectProgression(sources) {
  return { records: uniqueRecords(sources.flatMap((source) =>
    progressionDeltas(source.root)
      .map((item) => evidenceRecord(source, item)))) };
}

function progressionDeltas(root) {
  const values = [];
  for (const value of [
    firstValue(root, [["progressionDelta"], ["progression_delta"], ["progressionDeltas"], ["progression_deltas"]]),
    firstValue(root, [["progression", "delta"], ["progression", "deltas"], ["payload", "progressionDelta"], ["payload", "progressionDeltas"]]),
  ]) {
    if (Array.isArray(value)) values.push(...value.filter(isRecord));
    else if (isRecord(value)) values.push(value);
  }
  if (values.length > 0) return values;
  return findAll(root, looksLikeProgression);
}

function collectRagQueries(sources) {
  return { records: uniqueRecords(sources.flatMap((source) => {
    const authoritativeTraces = findAll(source.root, (item) => isRecord(item)
      && item.traceType === "phase6_server_rag_trace"
      && item.authority === "server_retriever_observed");
    const candidates = authoritativeTraces.length > 0
      ? authoritativeTraces
      : findAll(source.root, looksLikeRagQueryEvaluation);
    return candidates.map((item) => evidenceRecord(source, { phase6RagTrace: item }));
  })) };
}

function collectWorldEvidence(sources) {
  return { records: uniqueRecords(sources.flatMap((source) =>
    findAll(source.root, (item) => looksLikeRunReceipt(item) || looksLikeWorldReplay(item))
      .map((item) => evidenceRecord(source, item)))) };
}

function collectScores(sources, expectedRuns) {
  const byRun = new Map();
  for (const source of sources) {
    for (const scoreOwner of findAll(source.root, (item) => isRecord(item) && findScoreObject(item))) {
      const runIndex = source.binding.runIndex;
      if (!runIndex || runIndex < 1 || runIndex > expectedRuns) continue;
      if (!byRun.has(runIndex)) byRun.set(runIndex, evidenceRecord(source, scoreOwner));
    }
  }
  return { records: [...byRun.entries()].sort(numericEntrySort).map(([, record]) => record) };
}

function collectShop(sources) {
  return { records: uniqueRecords(sources.flatMap((source) =>
    findAll(source.root, looksLikeShop)
      .map((item) => evidenceRecord(source, item)))) };
}

function collectCrafting(sources) {
  return { records: uniqueRecords(sources.flatMap((source) =>
    findAll(source.root, (item) => looksLikeCraftRecipe(item) || looksLikeCraft(item) || looksLikeCraftProgression(item))
      .map((item) => evidenceRecord(source, item)))) };
}

function collectCraftingRole(sources, role) {
  return { records: uniqueRecords(sources.flatMap((source) =>
    explicitCraftingRoleRecords(source.root, role).map((item) => evidenceRecord(source, item)))) };
}

function explicitCraftingRoleRecords(root, role) {
  const values = [];
  for (const base of [root, root.crafting, root.payload, root.result]) {
    if (!isRecord(base)) continue;
    const value = base[role];
    if (Array.isArray(value)) values.push(...value.filter(isRecord));
    else if (isRecord(value)) values.push(value);
  }
  return values;
}

function evidenceRecord(source, payload) {
  return {
    experimentId: source.binding.experimentId,
    runIndex: source.binding.runIndex,
    journeyId: source.binding.journeyId,
    receiptId: source.binding.receiptId,
    ...clone(payload),
    _phase6Evidence: {
      sourceKind: source.sourceKind,
      sourceLine: source.sourceLine,
      candidateSha256: source.candidateSha256,
    },
  };
}

function validateBindings(artifacts, expectedRuns, errors) {
  for (const [name, artifact] of Object.entries(artifacts)) {
    artifact.records.forEach((record, index) => {
      for (const key of ["experimentId", "runIndex", "journeyId", "receiptId"]) {
        if (record[key] === undefined || record[key] === null || record[key] === "") {
          errors.push({ code: "E_BINDING_MISSING", artifact: name, record: index + 1, field: key });
        }
      }
      if (!Number.isInteger(record.runIndex) || record.runIndex < 1 || record.runIndex > expectedRuns) {
        errors.push({ code: "E_RUN_INDEX_INVALID", artifact: name, record: index + 1 });
      }
    });
  }
}

function validateRequiredEvidence(artifacts, expectedRuns, errors, warnings = []) {
  for (const [name, minimum] of Object.entries({
    "panels-before.jsonl": expectedRuns,
    "panels-after.jsonl": expectedRuns,
    "receipts.jsonl": expectedRuns,
    "economy-audit.jsonl": expectedRuns,
    "scores.jsonl": expectedRuns,
  })) {
    if (artifacts[name].records.length !== minimum) {
      errors.push({ code: "E_MISSING_REQUIRED_EVIDENCE", artifact: name, expected: minimum, actual: artifacts[name].records.length });
    }
  }
  for (const name of ["progression.jsonl", "rag-query-evaluations.jsonl", "world-evidence.jsonl"]) {
    if (artifacts[name].records.length === 0) {
      errors.push({ code: "E_MISSING_REQUIRED_EVIDENCE", artifact: name, expected: ">0", actual: 0 });
    }
  }
  for (const name of ["shop.jsonl", "crafting-recipes.jsonl", "crafting-crafts.jsonl", "crafting-progression.jsonl"]) {
    if (artifacts[name].records.length === 0) {
      warnings.push({ code: "W_OPTIONAL_GATE_EVIDENCE_MISSING", artifact: name, expected: ">0", actual: 0 });
    }
  }
  const validScores = artifacts["scores.jsonl"].records.filter((record) => Boolean(findScoreObject(record))).length;
  if (validScores !== expectedRuns) {
    errors.push({ code: "E_SCORE_CONTRACT_MISMATCH", expected: expectedRuns, actual: validScores });
  }
  const ragEvaluations = artifacts["rag-query-evaluations.jsonl"].records.filter(looksLikeRagQueryEvaluation).length;
  if (ragEvaluations === 0) {
    errors.push({ code: "E_RAG_EVALUATION_MISSING", expected: ">0", actual: 0 });
  }
}

function validatePanelReceiptHashes(artifacts, errors) {
  const before = new Map(artifacts["panels-before.jsonl"].records.map((record) => [record.runIndex, record.playerPanel]));
  const after = new Map(artifacts["panels-after.jsonl"].records.map((record) => [record.runIndex, record.playerPanel]));
  for (const receipt of artifacts["receipts.jsonl"].records) {
    const beforePanel = before.get(receipt.runIndex);
    const afterPanel = after.get(receipt.runIndex);
    if (!beforePanel || !afterPanel) continue;
    const beforeHash = canonicalHash(beforePanel);
    const afterHash = canonicalHash(afterPanel);
    const diffHash = canonicalHash(diffPanels(beforePanel, afterPanel));
    const reportedBefore = receiptHashValue(receipt, "before");
    const reportedAfter = receiptHashValue(receipt, "after");
    const reportedDiff = firstValue(receipt, [["panelDiffHash"], ["panel_diff_hash"], ["diffHash"], ["playerPanel", "diffHash"], ["hashes", "panelDiff"]]);
    if (!reportedBefore || !hashesEqual(beforeHash, String(reportedBefore))) errors.push({ code: "E_RECEIPT_BEFORE_HASH_MISMATCH", runIndex: receipt.runIndex, expectedHash: shortHash(beforeHash), actualHash: reportedBefore ? shortHash(reportedBefore) : null });
    if (!reportedAfter || !hashesEqual(afterHash, String(reportedAfter))) errors.push({ code: "E_RECEIPT_AFTER_HASH_MISMATCH", runIndex: receipt.runIndex, expectedHash: shortHash(afterHash), actualHash: reportedAfter ? shortHash(reportedAfter) : null });
    if (reportedDiff && !hashesEqual(diffHash, String(reportedDiff))) errors.push({ code: "E_RECEIPT_DIFF_HASH_MISMATCH", runIndex: receipt.runIndex, expectedHash: shortHash(diffHash), actualHash: shortHash(reportedDiff) });
    if (!reportedDiff && receiptSchemaVersion(receipt.runReceipt || receipt) !== RUN_RECEIPT_V2_VERSION) errors.push({ code: "E_RECEIPT_DIFF_HASH_MISMATCH", runIndex: receipt.runIndex, expectedHash: shortHash(diffHash), actualHash: null });
  }
}

function validateSqliteAuthority(artifacts, expectedRuns, sqliteAuthority, receiptContract, errors) {
  if (!sqliteAuthority || !sqliteAuthority.hasRequiredSchema) {
    errors.push({ code: "E_SQLITE_SCHEMA" });
    return;
  }
  for (let runIndex = 1; runIndex <= expectedRuns; runIndex += 1) {
    const receipt = artifacts["receipts.jsonl"].records.find((record) => record.runIndex === runIndex);
    if (!receipt) {
      errors.push({ code: "E_SQLITE_RECEIPT_MISSING", runIndex });
      continue;
    }
    const key = sqliteRunKey(receipt.experimentId, runIndex);
    const run = sqliteAuthority.runsByExperimentRun.get(key);
    if (!run) {
      errors.push({ code: "E_SQLITE_RUN_MISSING", runIndex });
      continue;
    }
    if (run.journeyId !== receipt.journeyId || run.receiptId !== receipt.receiptId) {
      errors.push({ code: "E_SQLITE_RUN_BINDING_MISMATCH", runIndex });
      continue;
    }
    if (run.state !== "complete") errors.push({ code: "E_SQLITE_RUN_INCOMPLETE", runIndex });
    const artifactRunReceipt = receipt.runReceipt || receipt;
    const artifactReceiptVersion = receiptSchemaVersion(artifactRunReceipt);
    if (artifactReceiptVersion !== RUN_RECEIPT_V2_VERSION
      || run.receiptVersion !== RUN_RECEIPT_V2_VERSION
      || receiptContract.receiptVersion !== RUN_RECEIPT_V2_VERSION) {
      errors.push({ code: "E_SQLITE_RECEIPT_VERSION_MISMATCH", runIndex });
    }
    for (const [kind, runField, contractField, code] of [
      ["rules", "rulesVersion", "rulesVersion", "E_SQLITE_RULES_VERSION_MISMATCH"],
      ["catalog", "catalogVersion", "catalogVersion", "E_SQLITE_CATALOG_VERSION_MISMATCH"],
      ["code", "codeVersion", "codeVersion", "E_SQLITE_CODE_VERSION_MISMATCH"],
    ]) {
      const artifactVersion = receiptVersionValue(artifactRunReceipt, kind);
      if (!artifactVersion || artifactVersion !== run[runField] || artifactVersion !== receiptContract[contractField]) {
        errors.push({ code, runIndex });
      }
    }
    const authoritativeReceipt = sqliteAuthority.receiptsById.get(receipt.receiptId);
    if (!authoritativeReceipt || authoritativeReceipt.journeyId !== receipt.journeyId) {
      errors.push({ code: "E_SQLITE_RECEIPT_MISSING", runIndex });
      continue;
    }
    if (!isStrictSha256(authoritativeReceipt.payloadHash)) {
      errors.push({ code: "E_SQLITE_RECEIPT_HASH_MISMATCH", runIndex });
      continue;
    }
    const artifactReceiptHash = canonicalHash(artifactRunReceipt);
    if (artifactReceiptHash !== canonicalHash(authoritativeReceipt.receiptJson)) {
      errors.push({ code: "E_SQLITE_RECEIPT_CONTENT_MISMATCH", runIndex });
    }
    const integrity = artifactRunReceipt.integrity;
    if (isRecord(integrity) && isStrictSha256(integrity.bodyHash)) {
      const body = clone(artifactRunReceipt);
      delete body.integrity;
      const expectedBodyHash = canonicalHash(body);
      if (integrity.bodyHash !== expectedBodyHash || (integrity.payloadHash && integrity.payloadHash !== expectedBodyHash)) {
        errors.push({ code: "E_SQLITE_RECEIPT_INTEGRITY_MISMATCH", runIndex });
      }
    }
    const eventIds = receiptEventIds(artifactRunReceipt);
    for (const eventId of eventIds) {
      const event = sqliteAuthority.eventsByJourneyEvent.get(sqliteEventKey(receipt.journeyId, eventId))
        || sqliteAuthority.eventsById.get(eventId);
      if (!event) {
        errors.push({ code: "E_SQLITE_EVENT_MISSING", runIndex, eventHash: shortHash(eventId) });
      }
    }
  }
}

function summarizeArtifact(name, records) {
  const text = jsonl(records);
  return {
    path: name,
    records: records.length,
    sha256: sha256(text),
    candidateSha256: unique(records.map((record) => record._phase6Evidence?.candidateSha256).filter(Boolean)).sort(),
    bindingHashes: unique(records.map((record) => shortHash(`${record.experimentId}:${record.runIndex}:${record.journeyId}:${record.receiptId}`))).sort(),
  };
}

function writeOutputs(outputDir, manifest) {
  const recordsByArtifact = manifest._records;
  delete manifest._records;
  for (const [name, artifact] of Object.entries(recordsByArtifact)) {
    writePrivateFile(path.join(outputDir, name), jsonl(artifact.records));
  }
  writePrivateFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function writePrivateFile(filePath, text) {
  fs.writeFileSync(filePath, text, { encoding: "utf8", mode: OUTPUT_MODE, flag: "wx" });
  fs.chmodSync(filePath, OUTPUT_MODE);
}

function redactedManifestForStdout(manifest) {
  const cloneManifest = clone(manifest);
  delete cloneManifest._records;
  return cloneManifest;
}

function jsonl(records) {
  return records.map((record) => JSON.stringify(record)).join("\n") + (records.length > 0 ? "\n" : "");
}

function readSqliteAuthority(sqlitePath) {
  const sqlite3 = spawnSync("sqlite3", ["-version"], { encoding: "utf8" });
  if (sqlite3.status !== 0) throw codedError("E_SQLITE3_UNAVAILABLE");
  const snapshotDir = fs.mkdtempSync(path.join(tmpdir(), "phase6-sqlite-snapshot-"));
  fs.chmodSync(snapshotDir, 0o700);
  const snapshotPath = path.join(snapshotDir, "authority.sqlite");
  let snapshotFd;
  try {
    const backup = spawnSync("sqlite3", [sqlitePath, `.backup ${sqliteDotQuote(snapshotPath)}`], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    if (backup.status !== 0 || !fs.existsSync(snapshotPath)) throw codedError("E_SQLITE_SNAPSHOT");
    fs.chmodSync(snapshotPath, 0o400);
    snapshotFd = fs.openSync(snapshotPath, "r");
    const snapshotStat = fs.fstatSync(snapshotFd);
    if (!snapshotStat.isFile() || snapshotStat.size < 1) throw codedError("E_SQLITE_SNAPSHOT");

    // Once unlinked, the inherited descriptor is the only query surface: the
    // source path cannot be swapped between backup, queries, and manifest hash.
    fs.unlinkSync(snapshotPath);
    const tablesResult = sqliteSnapshotCommand(snapshotFd, ["-readonly", SQLITE_SNAPSHOT_URI, ".tables"], 1024 * 1024);
    const tables = tablesResult.split(/\s+/).filter(Boolean).filter((table) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(table));
    const hasRequiredSchema = ["phase6_experiment_runs", "journey_run_receipts", "journey_events"].every((table) => tables.includes(table));
    const authority = {
      fileSha256: undefined,
      fileBytes: snapshotStat.size,
      hasRequiredSchema,
      hasResultPageSchema: tables.includes("result_pages"),
      hasRagTraceSchema: tables.includes("phase6_rag_traces"),
      runsByExperimentRun: new Map(),
      receiptsById: new Map(),
      eventsByJourneyEvent: new Map(),
      eventsById: new Map(),
      resultPagesByReceiptId: new Map(),
      resultPageRecordsByReceiptId: new Map(),
      ragTraces: [],
    };

    if (hasRequiredSchema) {
      const runs = sqliteSnapshotJson(snapshotFd, [
        "select experiment_id as experimentId, run_index as runIndex, state, journey_id as journeyId,",
        "coalesce(result_receipt_id, run_receipt_id) as receiptId, run_receipt_version as runReceiptVersion,",
        "result_receipt_version as resultReceiptVersion, rules_version as rulesVersion, catalog_version as catalogVersion, code_version as codeVersion",
        "from phase6_experiment_runs order by experiment_id, run_index;",
      ].join(" "));
      for (const row of runs) {
        authority.runsByExperimentRun.set(sqliteRunKey(row.experimentId, Number(row.runIndex)), {
          experimentId: String(row.experimentId),
          runIndex: Number(row.runIndex),
          state: stringValue(row.state),
          journeyId: String(row.journeyId),
          receiptId: String(row.receiptId),
          receiptVersion: stringValue(row.resultReceiptVersion) === "v2"
            ? RUN_RECEIPT_V2_VERSION
            : stringValue(row.runReceiptVersion),
          runReceiptVersion: stringValue(row.runReceiptVersion),
          resultReceiptVersion: stringValue(row.resultReceiptVersion),
          rulesVersion: stringValue(row.rulesVersion),
          catalogVersion: stringValue(row.catalogVersion),
          codeVersion: stringValue(row.codeVersion),
        });
      }

      const receipts = sqliteSnapshotJson(snapshotFd, [
        "select receipt_id as receiptId, journey_id as journeyId, payload_hash as payloadHash, receipt_json as receiptJson",
        "from journey_run_receipts order by receipt_id;",
      ].join(" "));
      for (const row of receipts) {
        const receiptJson = typeof row.receiptJson === "string" ? tryJson(row.receiptJson) : row.receiptJson;
        if (!isRecord(receiptJson)) continue;
        authority.receiptsById.set(String(row.receiptId), {
          receiptId: String(row.receiptId),
          journeyId: String(row.journeyId),
          payloadHash: String(row.payloadHash),
          receiptJson,
        });
      }

      const events = sqliteSnapshotJson(snapshotFd, [
        "select event_id as eventId, journey_id as journeyId, event_json as eventJson",
        "from journey_events order by journey_id, event_id;",
      ].join(" "));
      for (const row of events) {
        const event = {
          eventId: String(row.eventId),
          journeyId: String(row.journeyId),
          eventJson: typeof row.eventJson === "string" ? tryJson(row.eventJson) : row.eventJson,
        };
        authority.eventsByJourneyEvent.set(sqliteEventKey(row.journeyId, row.eventId), event);
        authority.eventsById.set(event.eventId, event);
      }

      if (tables.includes("epoch_events")) {
        const epochEvents = sqliteSnapshotJson(snapshotFd, [
          "select event_id as eventId, event_json as eventJson from epoch_events order by event_id;",
        ].join(" "));
        for (const row of epochEvents) {
          authority.eventsById.set(String(row.eventId), {
            eventId: String(row.eventId),
            eventJson: typeof row.eventJson === "string" ? tryJson(row.eventJson) : row.eventJson,
          });
        }
      }

      if (authority.hasResultPageSchema) {
        const pages = sqliteSnapshotJson(snapshotFd, "select page_json as pageJson from result_pages order by created_at, page_id;");
        for (const row of pages) {
          const storedPage = typeof row.pageJson === "string" ? tryJson(row.pageJson) : row.pageJson;
          const phase6 = getPath(storedPage, ["payload", "receipt", "phase6"]);
          const page = phase6?.page;
          const receiptId = stringValue(getPath(page, ["receipt", "receiptId"]));
          if (receiptId && isRecord(page) && isRecord(phase6)) {
            authority.resultPagesByReceiptId.set(receiptId, page);
            authority.resultPageRecordsByReceiptId.set(receiptId, storedPage);
          }
        }
      }

      if (authority.hasRagTraceSchema) {
        const traces = sqliteSnapshotJson(snapshotFd, [
          "select experiment_id as experimentId, run_index as runIndex, run_id as runId, journey_id as journeyId,",
          "trace_json as traceJson from phase6_rag_traces order by experiment_id, run_index, recorded_at;",
        ].join(" "));
        for (const row of traces) {
          const trace = typeof row.traceJson === "string" ? tryJson(row.traceJson) : row.traceJson;
          if (!isRecord(trace)) continue;
          const run = authority.runsByExperimentRun.get(sqliteRunKey(row.experimentId, Number(row.runIndex)));
          if (!run) continue;
          authority.ragTraces.push({
            ...run,
            runId: stringValue(row.runId),
            journeyId: stringValue(row.journeyId) || run.journeyId,
            trace,
          });
        }
      }
    }

    const snapshotBytes = readSnapshotBytes(snapshotFd, snapshotStat.size);
    authority.fileSha256 = `sha256:${crypto.createHash("sha256").update(snapshotBytes).digest("hex")}`;
    return authority;
  } finally {
    if (snapshotFd !== undefined) fs.closeSync(snapshotFd);
    fs.rmSync(snapshotDir, { recursive: true, force: true });
  }
}

function sqliteDotQuote(value) {
  if (/[\r\n]/.test(value)) throw codedError("E_SQLITE_SNAPSHOT");
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function sqliteSnapshotCommand(snapshotFd, args, maxBuffer) {
  const result = spawnSync("sqlite3", args, {
    encoding: "utf8",
    maxBuffer,
    stdio: ["ignore", "pipe", "pipe", snapshotFd],
  });
  if (result.status !== 0) throw codedError("E_SQLITE_READ");
  return result.stdout;
}

function sqliteSnapshotJson(snapshotFd, query) {
  const output = sqliteSnapshotCommand(snapshotFd, ["-readonly", "-json", SQLITE_SNAPSHOT_URI, query], 64 * 1024 * 1024);
  try {
    return JSON.parse(output || "[]");
  } catch {
    throw codedError("E_SQLITE_READ");
  }
}

function readSnapshotBytes(snapshotFd, size) {
  const buffer = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const bytesRead = fs.readSync(snapshotFd, buffer, offset, size - offset, offset);
    if (bytesRead < 1) throw codedError("E_SQLITE_SNAPSHOT");
    offset += bytesRead;
  }
  return buffer;
}

function looksLikeRunReceipt(value) {
  return isRecord(value) && (
    value.receiptType === "journey_run_receipt"
    || value.version === "journey_run_receipt.v2"
    || (value.receiptId !== undefined && value.runId !== undefined && (value.world !== undefined || value.eventIds !== undefined || value.score !== undefined || value.integrity !== undefined))
  );
}

function looksLikeEconomyAudit(value) {
  return isRecord(value) && typeof value.ok === "boolean" && (
    Array.isArray(value.assets)
    || Array.isArray(value.feeSplits)
    || Array.isArray(value.negativeInventories)
    || Array.isArray(value.duplicateSources)
    || Array.isArray(value.findings)
  );
}

function looksLikeProgression(value) {
  return isRecord(value) && (
    value.progressionDelta !== undefined
    || value.progressionDeltas !== undefined
    || value.permanentAttributes !== undefined
    || value.attributeEvidence !== undefined
    || value.stableReason !== undefined
  );
}

function looksLikeRagQueryEvaluation(value) {
  if (!isRecord(value)) return false;
  const trace = isRecord(value.phase6RagTrace) ? value.phase6RagTrace : value;
  const text = [value.type, value.eventType, value.kind, value.metric, value.category, value.evaluationType, value.queryType].filter(Boolean).join(" ");
  const evaluation = isRecord(trace.evaluation) ? trace.evaluation : undefined;
  const strictV2 = /phase6_server_rag_trace\.v2/i.test(String(trace.schemaVersion || trace.version || ""))
    && evaluation
    && Array.isArray(evaluation.expectedRecentKeyFacts)
    && Array.isArray(evaluation.retrievedFactIds)
    && Array.isArray(evaluation.expectedRouteEvidence)
    && Array.isArray(evaluation.returnedRouteEvidence)
    && Number.isFinite(evaluation.metrics?.recentKeyFactRecall?.value)
    && Number.isFinite(evaluation.metrics?.routeSummaryPrecision?.value);
  return strictV2
    || /recent[_ -]?key[_ -]?fact[_ -]?recall|key[_ -]?fact[_ -]?recall|route[_ -]?summary[_ -]?precision|route[_ -]?precision/i.test(text)
    || value.recall !== undefined
    || value.precision !== undefined
    || value.keyFactRecall !== undefined
    || value.routePrecision !== undefined;
}

function looksLikeWorldReplay(value) {
  if (!isRecord(value)) return false;
  const text = [value.type, value.event, value.eventType, value.name].filter(Boolean).join(" ");
  const hasEventId = firstValue(value, [["eventId"], ["event_id"], ["id"], ["payload", "eventId"]]) !== undefined;
  return hasEventId && (/world|replay|causal/i.test(text)
    || value.canonicalCursor !== undefined
    || value.worldCursor !== undefined
    || value.cursor !== undefined);
}

function findScoreObject(value) {
  if (!isRecord(value)) return undefined;
  const candidates = [value.score, value.scoring, value.phase6Score, value.runScore, value.result?.score, value.receipt?.score, value.runReceipt?.score];
  return candidates.find((candidate) => isRecord(candidate) && findScoreDimensions(candidate));
}

function findScoreDimensions(score) {
  const candidates = [score.dimensions, score.dimensionScores, score.breakdown, score.components];
  return candidates.find((candidate) => isRecord(candidate) && REQUIRED_SCORE_DIMS.every((dim) => isRecord(candidate[dim])));
}

function looksLikeShop(value) {
  if (!isRecord(value)) return false;
  const text = [value.operation, value.commandType, value.eventType, value.type].filter(Boolean).join(" ");
  return looksLikeShopOffer(value)
    || (/purchase|sell|sale|shop/i.test(text) && (value.quote || value.deltas || value.payload || value.offerId || value.value || value.resourceCredits || value.resourceSpends))
    || looksLikeEconomyAudit(value);
}

function looksLikeShopOffer(value) {
  return isRecord(value)
    && (typeof value.offerId === "string" || typeof value.id === "string")
    && (Array.isArray(value.costs) || value.baseUnitPriceMinor !== undefined || value.priceMinor !== undefined || value.price !== undefined)
    && Boolean(value.itemKey || value.resourceKey || value.sku || value.assetKey);
}

function looksLikeCraftRecipe(record) {
  return isRecord(record) && (
    record.recipeId !== undefined
    || record.recipe_id !== undefined
    || (isRecord(record.recipe) && (record.recipe.materials || record.recipe.inputs || record.recipe.outputs))
    || ((record.materials || record.inputs) && (record.outputs || record.result || record.results) && record.version !== undefined)
  );
}

function looksLikeCraft(record) {
  if (!isRecord(record)) return false;
  const text = [record.type, record.kind, record.eventType, record.domain].filter(Boolean).join(" ");
  return /craft|forge|smith|cast|sew|tailor|制作|铸造|缝纫/i.test(text)
    || record.craftId !== undefined
    || record.jobId !== undefined
    || record.materialsConsumed !== undefined
    || record.inputsConsumed !== undefined;
}

function looksLikeCraftProgression(record) {
  if (!isRecord(record)) return false;
  const text = [record.profession, record.professionId, record.skill, record.skillId, record.type, record.kind].filter(Boolean).join(" ");
  return /forging|smithing|casting|foundry|sewing|tailoring|profession|recipe_unlock|skill_unlock|铸造|缝纫/i.test(text)
    || record.professionXp !== undefined
    || record.xpDelta !== undefined
    || record.unlockCost !== undefined;
}

function receiptHashValue(receipt, side) {
  return firstValue(receipt, [
    [`${side}PanelHash`],
    [`${side}_panel_hash`],
    ["panelHashes", side],
    ["hashes", "panels", side],
    ["playerPanel", "hashes", side],
    ["runReceipt", "snapshots", side, "hash"],
    ["runReceipt", "integrity", `${side}SnapshotHash`],
  ]);
}

function hashesEqual(actual, expected) {
  return typeof actual === "string" && typeof expected === "string" && isStrictSha256(actual) && isStrictSha256(expected) && actual === expected;
}

function isStrictSha256(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function receiptEventIds(receipt) {
  const ids = [];
  const direct = firstValue(receipt, [["eventIds"], ["event_ids"]]);
  if (Array.isArray(direct)) ids.push(...direct);
  if (isRecord(direct)) {
    for (const group of [direct.source, direct.settlement, direct.derived]) {
      if (Array.isArray(group)) ids.push(...group);
    }
  }
  const world = firstValue(receipt, [["worldDelta", "eventIds"], ["world_delta", "event_ids"], ["world", "eventIds"], ["world", "event_ids"]]);
  if (Array.isArray(world)) ids.push(...world);
  const deltas = firstValue(receipt, [["deltas"], ["events"]]);
  if (Array.isArray(deltas)) {
    for (const entry of deltas) {
      const eventId = isRecord(entry) ? firstValue(entry, [["eventId"], ["event_id"], ["id"]]) : undefined;
      if (eventId) ids.push(eventId);
    }
  }
  return unique(ids.map(stringValue).filter(Boolean));
}

function sqliteRunKey(experimentId, runIndex) {
  return `${experimentId}\u0000${runIndex}`;
}

function sqliteEventKey(journeyId, eventId) {
  return `${journeyId}\u0000${eventId}`;
}

function diffPanels(beforePanel, afterPanel) {
  const changes = [];
  collectDiff(beforePanel, afterPanel, [], changes);
  return changes;
}

function collectDiff(beforeValue, afterValue, pathSegments, changes) {
  const beforeHash = canonicalHash(beforeValue);
  const afterHash = canonicalHash(afterValue);
  if (beforeHash === afterHash) return;
  if (isContainer(beforeValue) && isContainer(afterValue) && Array.isArray(beforeValue) === Array.isArray(afterValue)) {
    const keys = Array.isArray(beforeValue)
      ? [...Array(Math.max(beforeValue.length, afterValue.length)).keys()].map(String)
      : [...new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)])].sort();
    keys.forEach((key) => collectDiff(beforeValue[key], afterValue[key], [...pathSegments, key], changes));
    return;
  }
  changes.push({ pathHash: shortHash(pathSegments.join(".")), beforeHash, afterHash });
}

function isContainer(value) {
  return value && typeof value === "object";
}

function scanSecrets(value, pathLabel, findings) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSecrets(entry, `${pathLabel}[${index}]`, findings));
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      const next = `${pathLabel}.${key}`;
      if (SECRET_KEY.test(key)) findings.push({ pathHash: shortHash(next) });
      scanSecrets(entry, next, findings);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) findings.push({ pathHash: shortHash(pathLabel) });
}

function findAll(value, predicate, matches = [], depth = 0, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || depth > 12 || seen.has(value)) return matches;
  seen.add(value);
  if (predicate(value)) matches.push(value);
  if (Array.isArray(value)) value.forEach((entry) => findAll(entry, predicate, matches, depth + 1, seen));
  else Object.values(value).forEach((entry) => findAll(entry, predicate, matches, depth + 1, seen));
  return matches;
}

function uniqueRecords(records) {
  const seen = new Set();
  const output = [];
  for (const record of records) {
    const key = canonicalHash(record);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(record);
  }
  return output;
}

function firstValue(record, paths) {
  for (const candidate of paths) {
    const value = getPath(record, candidate);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function getPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function stringValue(value) {
  return value === undefined || value === null || value === "" ? undefined : String(value);
}

function integerValue(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : undefined;
}

function numericEntrySort(left, right) {
  return left[0] - right[0];
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value), "utf8").digest("hex")}`;
}

function shortHash(value) {
  return sha256(String(value)).slice(0, 19);
}

function canonicalHash(value) {
  return sha256(canonicalize(value));
}

function canonicalize(value, seen = new WeakSet()) {
  if (value === undefined) return "null";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value !== "object") return JSON.stringify(String(value));
  if (seen.has(value)) throw codedError("E_CANONICAL_CYCLE");
  seen.add(value);
  if (Array.isArray(value)) {
    const result = `[${value.map((entry) => canonicalize(entry, seen)).join(",")}]`;
    seen.delete(value);
    return result;
  }
  const result = `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], seen)}`).join(",")}}`;
  seen.delete(value);
  return result;
}

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values) {
  return [...new Set(values)];
}

function releaseGateInputs(artifacts) {
  const enough = (name, count) => artifacts[name]?.records >= count;
  return {
    playerPanel: enough("panels-before.jsonl", 1) && enough("panels-after.jsonl", 1) && enough("receipts.jsonl", 1),
    economy: enough("economy-audit.jsonl", 1),
    world: enough("world-evidence.jsonl", 1),
    progression: enough("progression.jsonl", 1),
    score: enough("scores.jsonl", 1),
    rag: enough("rag-query-evaluations.jsonl", 1) && enough("receipts.jsonl", 1),
    shop: enough("shop.jsonl", 1),
    crafting: enough("crafting-recipes.jsonl", 1) && enough("crafting-crafts.jsonl", 1) && enough("crafting-progression.jsonl", 1),
  };
}

main();
