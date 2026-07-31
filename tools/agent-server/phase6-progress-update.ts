#!/usr/bin/env node
// @ts-nocheck

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAttestationKey, validateExecutionReceipt } from "./phase6-command-runner.ts";

const SCHEMA_VERSION = "obsidian-epoch.phase-progress.v1";
const DEFAULT_LEDGER = ".omx/state/phase-6-observable-ten-run-progress.json";
const ITEM_STATUSES = new Set(["pending", "in_progress", "implemented", "verified", "blocked"]);
const PHASE_STATUSES = new Set(["planned", "active", "blocked", "complete"]);
const EVIDENCE_KINDS = new Set(["artifact", "command", "metric", "review"]);
const DEFAULT_FRESHNESS_POLICY = Object.freeze({ verifiedMaxAgeMinutes: 1440 });
const SHA256_PREFIXED = /^sha256:[a-f0-9]{64}$/;
const FORBIDDEN_EVIDENCE_KEYS = /^(recoveryCode|operatorKey|apiKey|accessToken|refreshToken|authorization)$/i;
const OBVIOUS_SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{12,})\b/i;
const ORDERED_STATUSES = ["pending", "in_progress", "implemented", "verified"];

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

function emit(payload, exitCode = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
}

function fail(code, errors) {
  emit({ ok: false, code, errors: Array.isArray(errors) ? errors : [errors] }, 1);
}

function parseArguments(argv) {
  const options = {
    ledgerPath: path.join(repositoryRoot, DEFAULT_LEDGER),
    replaceRuntimeEvidence: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--item") {
      if (!value) fail("usage", "--item requires an item ID");
      options.itemId = value;
      index += 1;
      continue;
    }
    if (argument === "--status") {
      if (!value) fail("usage", "--status requires a status");
      options.status = value;
      index += 1;
      continue;
    }
    if (argument === "--evidence-json") {
      if (!value) fail("usage", "--evidence-json requires JSON");
      options.evidenceJson = value;
      index += 1;
      continue;
    }
    if (argument === "--blocker-json") {
      if (!value) fail("usage", "--blocker-json requires JSON");
      options.blockerJson = value;
      index += 1;
      continue;
    }
    if (argument === "--ledger") {
      if (!value) fail("usage", "--ledger requires a path");
      options.ledgerPath = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (argument === "--replace-runtime-evidence") {
      options.replaceRuntimeEvidence = true;
      continue;
    }
    fail("usage", `Unknown argument: ${argument}`);
  }

  if (!options.itemId) fail("usage", "--item is required");
  if (!options.status) fail("usage", "--status is required");
  if (!ITEM_STATUSES.has(options.status)) fail("usage", `Unsupported status: ${options.status}`);
  if (options.replaceRuntimeEvidence && options.status !== "verified") {
    fail("usage", "--replace-runtime-evidence requires --status verified");
  }
  return options;
}

function parseJsonArgument(value, label) {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    fail("invalid_json", `${label} is not valid JSON: ${error.message}`);
  }
}

function isRepositoryRelative(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) {
    return false;
  }
  const normalized = path.normalize(candidate);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function resolveRepositoryPath(candidate) {
  return path.resolve(repositoryRoot, candidate);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function prefixedSha256(value) {
  return `sha256:${value}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function evidenceHash(entry) {
  const clone = structuredClone(entry);
  delete clone.evidenceHash;
  return prefixedSha256(sha256Text(canonicalJson(clone)));
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function scanForSecrets(value, trail, errors) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${trail}[${index}]`, errors));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_EVIDENCE_KEYS.test(key)) {
        errors.push(`${trail}.${key} uses a forbidden secret field`);
      }
      scanForSecrets(entry, `${trail}.${key}`, errors);
    }
    return;
  }
  if (typeof value === "string" && OBVIOUS_SECRET_VALUE.test(value)) {
    errors.push(`${trail} appears to contain a secret value`);
  }
}

function validateDate(value, label, errors) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    errors.push(`${label} must be a parseable date or timestamp`);
  }
}

function validateRepositoryFile(candidate, label, errors, options = {}) {
  if (!isRepositoryRelative(candidate)) {
    errors.push(`${label} must be a repository-relative path without traversal`);
    return undefined;
  }

  const absolutePath = resolveRepositoryPath(candidate);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${label} does not exist: ${candidate}`);
    return absolutePath;
  }
  if (options.requireNonEmpty && fs.statSync(absolutePath).size === 0) {
    errors.push(`${label} must reference a non-empty file: ${candidate}`);
  }
  if (options.expectedSha256) {
    if (!/^[a-f0-9]{64}$/.test(options.expectedSha256)) {
      errors.push(`${label} has an invalid sha256 value`);
    } else if (sha256File(absolutePath) !== options.expectedSha256) {
      errors.push(`${label} sha256 does not match: ${candidate}`);
    }
  }
  return absolutePath;
}

function validateFreshnessPolicy(ledger, errors) {
  const value = ledger.freshnessPolicy?.verifiedMaxAgeMinutes;
  if (!Number.isFinite(value) || value <= 0) {
    errors.push("freshnessPolicy.verifiedMaxAgeMinutes must be a positive number");
    return DEFAULT_FRESHNESS_POLICY;
  }
  return { verifiedMaxAgeMinutes: value };
}

function validatePrefixedHash(value, label, errors) {
  if (typeof value !== "string" || !SHA256_PREFIXED.test(value)) {
    errors.push(`${label} must be sha256:<64hex>`);
    return false;
  }
  return true;
}

function validateOutputHash(entry, entryLabel, errors) {
  const outputPath = entry.outputPath ?? entry.sourcePath;
  if (outputPath === undefined) {
    errors.push(`${entryLabel}.outputPath is required for strong runtime evidence`);
    return;
  }
  const absolutePath = validateRepositoryFile(outputPath, `${entryLabel}.outputPath`, errors, { requireNonEmpty: true });
  if (absolutePath && fs.existsSync(absolutePath) && SHA256_PREFIXED.test(entry.outputHash)) {
    const actual = prefixedSha256(sha256File(absolutePath));
    if (actual !== entry.outputHash) {
      errors.push(`${entryLabel}.outputHash does not match: ${outputPath}`);
    }
  }
}

function isRuntimeEvidenceKind(kind) {
  return kind === "command" || kind === "metric";
}

function validateReceiptEvidence(entry, entryLabel, errors) {
  if (typeof entry.receiptPath !== "string" || entry.receiptPath.trim() === "") {
    errors.push(`${entryLabel}.receiptPath is required for strong runtime evidence`);
    return undefined;
  }
  if (!validatePrefixedHash(entry.receiptHash, `${entryLabel}.receiptHash`, errors)) {
    return undefined;
  }
  const receiptAbsolute = validateRepositoryFile(entry.receiptPath, `${entryLabel}.receiptPath`, errors, { requireNonEmpty: true });
  if (!receiptAbsolute || !fs.existsSync(receiptAbsolute)) return undefined;
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptAbsolute, "utf8"));
  } catch {
    errors.push(`${entryLabel}.receiptPath must contain JSON`);
    return undefined;
  }
  const validation = validateExecutionReceipt(receipt);
  for (const message of validation.errors) {
    errors.push(`${entryLabel}.receipt invalid: ${message}`);
  }
  if (receipt.receiptHash !== entry.receiptHash) {
    errors.push(`${entryLabel}.receiptHash does not match receipt`);
  }
  if (entry.receiptPath !== receipt.receiptPath) {
    errors.push(`${entryLabel}.receiptPath does not match signed receiptPath`);
  }
  if (entry.capturedAt !== receipt.endedAt) {
    errors.push(`${entryLabel}.capturedAt must match receipt endedAt`);
  }
  if (entry.kind === "command" && entry.argvHash !== receipt.argvHash) {
    errors.push(`${entryLabel}.argvHash does not match receipt`);
  }
  const boundOutputPath = entry.outputPath ?? entry.sourcePath;
  if (boundOutputPath !== undefined) {
    const output = receipt.outputs?.find((candidate) => candidate.path === boundOutputPath);
    if (!output) {
      errors.push(`${entryLabel}.outputPath is not declared in receipt outputs`);
    } else if (entry.outputHash !== undefined && output.sha256 !== entry.outputHash) {
      errors.push(`${entryLabel}.outputHash does not match receipt output`);
    }
  }
  return receipt;
}

function validateStrongRuntimeEvidence(entry, entryLabel, errors) {
  if (!isRuntimeEvidenceKind(entry.kind)) {
    return false;
  }
  const errorCount = errors.length;
  validateDate(entry.capturedAt, `${entryLabel}.capturedAt`, errors);
  validatePrefixedHash(entry.evidenceHash, `${entryLabel}.evidenceHash`, errors);
  validatePrefixedHash(entry.outputHash, `${entryLabel}.outputHash`, errors);
  validateOutputHash(entry, entryLabel, errors);
  validateReceiptEvidence(entry, entryLabel, errors);

  if (entry.kind === "command") {
    validatePrefixedHash(entry.argvHash, `${entryLabel}.argvHash`, errors);
  }

  if (SHA256_PREFIXED.test(entry.evidenceHash ?? "") && evidenceHash(entry) !== entry.evidenceHash) {
    errors.push(`${entryLabel}.evidenceHash does not match evidence payload`);
  }

  return errors.length === errorCount;
}

function evidenceIsFresh(entry, asOf, freshnessPolicy) {
  if (typeof entry.capturedAt !== "string") {
    return false;
  }
  const capturedAt = Date.parse(entry.capturedAt);
  if (Number.isNaN(capturedAt)) {
    return false;
  }
  const ageMs = asOf.getTime() - capturedAt;
  return ageMs >= 0 && ageMs <= freshnessPolicy.verifiedMaxAgeMinutes * 60 * 1000;
}

function validateEvidence(evidence, item, errors, context) {
  const label = `${item.id}.evidence`;
  if (!Array.isArray(evidence)) {
    errors.push(`${label} must be an array`);
    return { hasRepositoryArtifact: false, hasStrongEvidence: false };
  }

  if ((item.status === "implemented" || item.status === "verified") && evidence.length === 0) {
    errors.push(`${item.id} requires evidence while status is ${item.status}`);
  }
  if (item.status === "pending" && evidence.length > 0) {
    errors.push(`${item.id} cannot retain evidence while status is pending`);
  }

  let hasRepositoryArtifact = false;
  let hasStrongRuntimeEvidence = false;
  let hasCurrentStrongRuntimeEvidence = false;
  evidence.forEach((entry, index) => {
    const entryLabel = `${label}[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${entryLabel} must be an object`);
      return;
    }
    if (!EVIDENCE_KINDS.has(entry.kind)) {
      errors.push(`${entryLabel}.kind must be artifact, command, metric, or review`);
    }
    validateDate(entry.observedAt, `${entryLabel}.observedAt`, errors);
    if (typeof entry.summary !== "string" || entry.summary.trim().length === 0) {
      errors.push(`${entryLabel}.summary must be non-empty`);
    }

    if (entry.kind === "artifact") {
      const absolutePath = validateRepositoryFile(entry.path, `${entryLabel}.path`, errors, {
        expectedSha256: entry.sha256,
      });
      if (absolutePath && fs.existsSync(absolutePath)) {
        hasRepositoryArtifact = true;
      }
    }

    if (entry.kind === "command") {
      if (entry.outputPath !== undefined) {
        validateRepositoryFile(entry.outputPath, `${entryLabel}.outputPath`, errors, {
          expectedSha256: entry.outputHash?.replace(/^sha256:/, ""),
        });
      }
      const isStrong = validateStrongRuntimeEvidence(entry, entryLabel, errors);
      hasStrongRuntimeEvidence = hasStrongRuntimeEvidence || isStrong;
      hasCurrentStrongRuntimeEvidence = hasCurrentStrongRuntimeEvidence || (isStrong && evidenceIsFresh(entry, context.asOf, context.freshnessPolicy));
    }

    if (entry.kind === "metric") {
      if (typeof entry.name !== "string" || entry.name.trim().length === 0) {
        errors.push(`${entryLabel}.name must be non-empty`);
      }
      if (entry.actual === undefined || entry.expected === undefined) {
        errors.push(`${entryLabel} must include actual and expected`);
      }
      if (!["<", "<=", "=", ">=", ">"].includes(entry.comparator)) {
        errors.push(`${entryLabel}.comparator is invalid`);
      }
      if (entry.sourcePath === undefined) {
        errors.push(`${entryLabel}.sourcePath is required`);
      } else {
        validateRepositoryFile(entry.sourcePath, `${entryLabel}.sourcePath`, errors, {
          expectedSha256: entry.sha256,
        });
      }
      const isStrong = validateStrongRuntimeEvidence(entry, entryLabel, errors);
      hasStrongRuntimeEvidence = hasStrongRuntimeEvidence || isStrong;
      hasCurrentStrongRuntimeEvidence = hasCurrentStrongRuntimeEvidence || (isStrong && evidenceIsFresh(entry, context.asOf, context.freshnessPolicy));
    }
  });

  scanForSecrets(evidence, label, errors);
  if (item.status === "implemented" && !hasRepositoryArtifact) {
    errors.push(`${item.id} is implemented without repository artifact evidence`);
  }
  if (item.status === "verified" && !hasStrongRuntimeEvidence) {
    errors.push(`${item.id} is verified without strong runtime evidence`);
  }
  if (item.status === "verified" && !hasCurrentStrongRuntimeEvidence) {
    errors.push(`${item.id} is verified without current strong runtime evidence`);
  }
  return { hasRepositoryArtifact, hasStrongRuntimeEvidence, hasCurrentStrongRuntimeEvidence };
}

function validateDocumentation(ledger, milestones, items, errors, checklistOverrideText) {
  const specAbsolutePath = validateRepositoryFile(ledger.specPath, "specPath", errors);
  const checklistAbsolutePath = validateRepositoryFile(ledger.checklistPath, "checklistPath", errors);
  if (!specAbsolutePath || !checklistAbsolutePath || !fs.existsSync(specAbsolutePath) || !fs.existsSync(checklistAbsolutePath)) {
    return;
  }

  const specText = fs.readFileSync(specAbsolutePath, "utf8");
  const specMarkers = [...specText.matchAll(/<!--\s*phase6-milestone:([A-Z0-9-]+):(\d+)\s*-->/g)]
    .map((match) => ({ id: match[1], weight: Number(match[2]) }));
  const duplicateSpecIds = duplicateValues(specMarkers.map((marker) => marker.id));
  if (duplicateSpecIds.length > 0) {
    errors.push(`Spec contains duplicate milestone markers: ${duplicateSpecIds.join(", ")}`);
  }
  const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
  if (!sameSet(new Set(specMarkers.map((marker) => marker.id)), new Set(milestoneById.keys()))) {
    errors.push("Spec milestone markers do not match ledger milestone IDs");
  }
  for (const marker of specMarkers) {
    const milestone = milestoneById.get(marker.id);
    if (milestone && marker.weight !== milestone.weight) {
      errors.push(`Spec weight for ${marker.id} is ${marker.weight}, ledger weight is ${milestone.weight}`);
    }
  }

  const checklistText = checklistOverrideText ?? fs.readFileSync(checklistAbsolutePath, "utf8");
  const checklistMilestoneIds = [...checklistText.matchAll(/<!--\s*progress-milestone:([A-Z0-9-]+)\s*-->/g)]
    .map((match) => match[1]);
  const checklistRows = [...checklistText.matchAll(/^- \[([ xX])\].*?<!--\s*progress-item:([A-Z0-9-]+)\s*-->/gm)]
    .map((match) => ({ checked: match[1].toLowerCase() === "x", id: match[2] }));

  const duplicateChecklistMilestones = duplicateValues(checklistMilestoneIds);
  const duplicateChecklistItems = duplicateValues(checklistRows.map((row) => row.id));
  if (duplicateChecklistMilestones.length > 0) {
    errors.push(`Checklist contains duplicate milestone markers: ${duplicateChecklistMilestones.join(", ")}`);
  }
  if (duplicateChecklistItems.length > 0) {
    errors.push(`Checklist contains duplicate item markers: ${duplicateChecklistItems.join(", ")}`);
  }
  if (!sameSet(new Set(checklistMilestoneIds), new Set(milestoneById.keys()))) {
    errors.push("Checklist milestone markers do not match ledger milestone IDs");
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  if (!sameSet(new Set(checklistRows.map((row) => row.id)), new Set(itemById.keys()))) {
    errors.push("Checklist item markers do not match ledger item IDs");
  }
  for (const row of checklistRows) {
    const item = itemById.get(row.id);
    if (item && row.checked !== (item.status === "verified")) {
      errors.push(`Checklist checkbox for ${row.id} must be ${item.status === "verified" ? "checked" : "unchecked"}`);
    }
  }
}

function validateLedger(ledger, checklistOverrideText, options = {}) {
  const errors = [];
  const asOf = options.asOf ?? new Date();
  if (ledger.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (ledger.phaseId !== "phase-6-observable-ten-run") {
    errors.push("phaseId must be phase-6-observable-ten-run");
  }
  if (!PHASE_STATUSES.has(ledger.status)) {
    errors.push("phase status must be planned, active, blocked, or complete");
  }
  validateDate(ledger.lastUpdatedAt, "lastUpdatedAt", errors);
  const freshnessPolicy = validateFreshnessPolicy(ledger, errors);
  if (!Array.isArray(ledger.milestones) || ledger.milestones.length === 0) {
    errors.push("milestones must be a non-empty array");
  }

  const milestones = Array.isArray(ledger.milestones) ? ledger.milestones : [];
  const milestoneIds = milestones.map((milestone) => milestone.id);
  const duplicateMilestoneIds = duplicateValues(milestoneIds);
  if (duplicateMilestoneIds.length > 0) {
    errors.push(`Duplicate milestone IDs: ${duplicateMilestoneIds.join(", ")}`);
  }

  const items = [];
  let milestoneWeightTotal = 0;
  for (const milestone of milestones) {
    if (!/^P6-M(?:[1-9]|10)$/.test(milestone.id)) {
      errors.push(`Invalid milestone ID: ${milestone.id}`);
    }
    if (!Number.isInteger(milestone.weight) || milestone.weight <= 0) {
      errors.push(`${milestone.id}.weight must be a positive integer`);
    } else {
      milestoneWeightTotal += milestone.weight;
    }
    if (!Array.isArray(milestone.items) || milestone.items.length === 0) {
      errors.push(`${milestone.id}.items must be a non-empty array`);
      continue;
    }

    let itemWeightTotal = 0;
    for (const item of milestone.items) {
      items.push({ ...item, milestoneId: milestone.id });
      if (!new RegExp(`^${milestone.id}-\\d{2}$`).test(item.id)) {
        errors.push(`${item.id} does not belong to ${milestone.id}`);
      }
      if (!Number.isInteger(item.weight) || item.weight <= 0) {
        errors.push(`${item.id}.weight must be a positive integer`);
      } else {
        itemWeightTotal += item.weight;
      }
      if (!ITEM_STATUSES.has(item.status)) {
        errors.push(`${item.id}.status is invalid`);
      }
      if (item.status === "blocked" && (!item.blocker || typeof item.blocker !== "object" || Array.isArray(item.blocker))) {
        errors.push(`${item.id} must include a structured blocker while blocked`);
      }
      if (item.blocker !== undefined) {
        scanForSecrets(item.blocker, `${item.id}.blocker`, errors);
      }
      validateEvidence(item.evidence, item, errors, { asOf, freshnessPolicy });
    }
    if (itemWeightTotal !== milestone.weight) {
      errors.push(`${milestone.id} item weights total ${itemWeightTotal}, expected ${milestone.weight}`);
    }
  }

  if (milestoneWeightTotal !== 100) {
    errors.push(`Milestone weights total ${milestoneWeightTotal}, expected 100`);
  }
  const duplicateItemIds = duplicateValues(items.map((item) => item.id));
  if (duplicateItemIds.length > 0) {
    errors.push(`Duplicate item IDs: ${duplicateItemIds.join(", ")}`);
  }

  validateDocumentation(ledger, milestones, items, errors, checklistOverrideText);

  const implementedStatuses = new Set(ledger.progressPolicy?.implementedStatuses ?? []);
  const verifiedStatuses = new Set(ledger.progressPolicy?.verifiedStatuses ?? []);
  if (!sameSet(implementedStatuses, new Set(["implemented", "verified"]))) {
    errors.push("progressPolicy.implementedStatuses must be implemented and verified");
  }
  if (!sameSet(verifiedStatuses, new Set(["verified"]))) {
    errors.push("progressPolicy.verifiedStatuses must contain only verified");
  }
  if (ledger.progressPolicy?.completionRequiresVerifiedWeight !== 100) {
    errors.push("progressPolicy.completionRequiresVerifiedWeight must be 100");
  }
  if (ledger.progressPolicy?.derivedPercentagesAreNotStored !== true) {
    errors.push("progressPolicy.derivedPercentagesAreNotStored must be true");
  }

  const verifiedWeight = items
    .filter((item) => verifiedStatuses.has(item.status))
    .reduce((sum, item) => sum + item.weight, 0);
  if (ledger.status === "complete" && verifiedWeight !== 100) {
    errors.push("phase status cannot be complete before verified weight reaches 100");
  }
  if (ledger.status !== "complete" && verifiedWeight === 100) {
    errors.push("phase status must be complete when verified weight reaches 100");
  }

  return { valid: errors.length === 0, errors, items };
}

function findItem(ledger, itemId) {
  for (const milestone of ledger.milestones ?? []) {
    for (const item of milestone.items ?? []) {
      if (item.id === itemId) {
        return { milestone, item };
      }
    }
  }
  return undefined;
}

function allItemsVerified(ledger) {
  const items = (ledger.milestones || []).flatMap((milestone) => milestone.items || []);
  return items.length > 0 && items.every((item) => item.status === "verified");
}

function assertTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return;
  }
  if (fromStatus === "verified") {
    throw new Error("verified items are immutable");
  }
  if (toStatus === "blocked") {
    return;
  }
  if (fromStatus === "blocked" && toStatus === "in_progress") {
    return;
  }
  const fromIndex = ORDERED_STATUSES.indexOf(fromStatus);
  const toIndex = ORDERED_STATUSES.indexOf(toStatus);
  if (fromIndex !== -1 && toIndex === fromIndex + 1) {
    return;
  }
  throw new Error(`Invalid transition: ${fromStatus} -> ${toStatus}`);
}

function normalizeEvidence(evidence) {
  if (evidence === undefined) {
    return [];
  }
  return Array.isArray(evidence) ? evidence : [evidence];
}

function updateChecklistText(checklistText, itemId, checked) {
  const pattern = new RegExp(`^(\\s*- \\[)[ xX](\\].*?<!--\\s*progress-item:${itemId}\\s*-->)$`, "m");
  let matches = 0;
  const nextText = checklistText.replace(pattern, (_match, prefix, suffix) => {
    matches += 1;
    return `${prefix}${checked ? "x" : " "}${suffix}`;
  });
  if (matches !== 1) {
    throw new Error(`Checklist item marker not found exactly once: ${itemId}`);
  }
  return nextText;
}

function writeAtomicPair(files) {
  const prepared = files.map((file, index) => {
    const directory = path.dirname(file.path);
    const tempPath = path.join(directory, `.${path.basename(file.path)}.${process.pid}.${index}.tmp`);
    const backupPath = path.join(directory, `.${path.basename(file.path)}.${process.pid}.${index}.bak`);
    return { ...file, tempPath, backupPath };
  });

  const renamed = [];
  try {
    for (const file of prepared) {
      fs.writeFileSync(file.tempPath, file.content, "utf8");
    }
    for (const file of prepared) {
      fs.renameSync(file.path, file.backupPath);
      renamed.push(file);
    }
    for (const file of prepared) {
      fs.renameSync(file.tempPath, file.path);
    }
    for (const file of prepared) {
      fs.rmSync(file.backupPath);
    }
  } catch (error) {
    for (const file of prepared) {
      if (fs.existsSync(file.tempPath)) {
        fs.rmSync(file.tempPath);
      }
    }
    for (const file of renamed.reverse()) {
      if (fs.existsSync(file.path) && fs.existsSync(file.backupPath)) {
        fs.rmSync(file.path);
      }
      if (fs.existsSync(file.backupPath)) {
        fs.renameSync(file.backupPath, file.path);
      }
    }
    throw error;
  }
}

const options = parseArguments(process.argv.slice(2));
try {
  loadAttestationKey();
} catch (error) {
  fail("attestation_key_invalid", error.message);
}
const newEvidence = normalizeEvidence(parseJsonArgument(options.evidenceJson, "--evidence-json"));
const newBlocker = parseJsonArgument(options.blockerJson, "--blocker-json");
const inputSecretErrors = [];
scanForSecrets(newEvidence, "input.evidence", inputSecretErrors);
if (newBlocker !== undefined) {
  scanForSecrets(newBlocker, "input.blocker", inputSecretErrors);
}
if (inputSecretErrors.length > 0) {
  fail("secret_precheck_failed", inputSecretErrors);
}

let ledger;
let checklistText;
try {
  ledger = JSON.parse(fs.readFileSync(options.ledgerPath, "utf8"));
  const checklistAbsolutePath = resolveRepositoryPath(ledger.checklistPath);
  checklistText = fs.readFileSync(checklistAbsolutePath, "utf8");
} catch (error) {
  fail("read_failed", error.message);
}

const currentValidation = validateLedger(ledger, checklistText);
if (!currentValidation.valid) {
  fail("precheck_failed", currentValidation.errors);
}

const located = findItem(ledger, options.itemId);
if (!located) {
  fail("unknown_item", `No ledger item exists with ID ${options.itemId}`);
}

const previousStatus = located.item.status;
try {
  assertTransition(previousStatus, options.status);
} catch (error) {
  fail("invalid_transition", error.message);
}

const nextLedger = structuredClone(ledger);
const nextLocated = findItem(nextLedger, options.itemId);
nextLocated.item.status = options.status;
if (options.replaceRuntimeEvidence) {
  nextLocated.item.evidence = (Array.isArray(nextLocated.item.evidence) ? nextLocated.item.evidence : [])
    .filter((entry) => !isRuntimeEvidenceKind(entry?.kind));
}
nextLocated.item.evidence = [...(Array.isArray(nextLocated.item.evidence) ? nextLocated.item.evidence : []), ...newEvidence];
if (options.status === "blocked") {
  if (!newBlocker || typeof newBlocker !== "object" || Array.isArray(newBlocker)) {
    fail("missing_blocker", "--blocker-json object is required when status is blocked");
  }
  nextLocated.item.blocker = newBlocker;
} else if (options.status === "in_progress" && previousStatus === "blocked") {
  delete nextLocated.item.blocker;
}
if (allItemsVerified(nextLedger)) {
  nextLedger.status = "complete";
}
nextLedger.lastUpdatedAt = new Date().toISOString();

let nextChecklistText;
try {
  nextChecklistText = updateChecklistText(checklistText, options.itemId, options.status === "verified");
} catch (error) {
  fail("checklist_update_failed", error.message);
}

const nextValidation = validateLedger(nextLedger, nextChecklistText);
if (!nextValidation.valid) {
  fail("candidate_validation_failed", nextValidation.errors);
}

const ledgerContent = `${JSON.stringify(nextLedger, null, 2)}\n`;
const checklistAbsolutePath = resolveRepositoryPath(nextLedger.checklistPath);
try {
  writeAtomicPair([
    { path: options.ledgerPath, content: ledgerContent },
    { path: checklistAbsolutePath, content: nextChecklistText },
  ]);
} catch (error) {
  fail("write_failed", error.message);
}

emit({
  ok: true,
  item: options.itemId,
  previousStatus,
  status: options.status,
  ledgerPath: path.relative(repositoryRoot, options.ledgerPath),
  checklistPath: nextLedger.checklistPath,
  lastUpdatedAt: nextLedger.lastUpdatedAt,
  evidenceAdded: newEvidence.length,
  runtimeEvidenceReplaced: options.replaceRuntimeEvidence,
  blockerUpdated: options.status === "blocked",
});
