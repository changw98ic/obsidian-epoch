#!/usr/bin/env node
// @ts-nocheck

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_VERSION = "obsidian-epoch.phase6-growth-material-gate.v2";
const RECEIPT_VERSION = "journey_run_receipt.v2";
const LEGACY_ADAPTER_VERSION = "obsidian-epoch.phase6-progression-fixture-adapter.v1";
const MAX_REPORTED_CODES = 64;
const MAX_FLAGS = 64;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;
const GROWTH_DOMAINS = Object.freeze([
  "permanentAttributes",
  "skills",
  "talents",
  "cultivationStage",
]);
const INTENSITY_ATTRIBUTE_MAP = Object.freeze({
  low: "intellect",
  medium: "willpower",
  high: "physique",
});
const CULTIVATION_MATERIAL_CLASSES = new Set([
  "advancement_material",
  "breakthrough_material",
  "cultivation_advancement_material",
  "cultivation_material",
]);
const CRAFTING_MATERIAL_CLASSES = new Set([
  "crafting_material",
  "forging_material",
  "tailoring_material",
]);

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalized(value) {
  return nonEmptyString(value) ? value.trim().toLowerCase() : "";
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value), "utf8").digest("hex")}`;
}

function shortHash(value) {
  return sha256(String(value)).slice(0, 19);
}

function canonicalize(value, seen = new WeakSet()) {
  if (value === undefined || value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw codedError("E_NON_FINITE_NUMBER");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw codedError("E_CANONICAL_VALUE_UNSUPPORTED");
  if (seen.has(value)) throw codedError("E_CANONICAL_CYCLE");
  seen.add(value);
  const rendered = Array.isArray(value)
    ? `[${value.map((entry) => canonicalize(entry, seen)).join(",")}]`
    : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], seen)}`).join(",")}}`;
  seen.delete(value);
  return rendered;
}

function canonicalHash(value) {
  return sha256(canonicalize(value));
}

function parseArguments(argv) {
  const options = { inputPath: undefined, expectedRuns: undefined, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (SECRET_KEY.test(argument) || SECRET_VALUE.test(argument)) throw codedError("E_ARGUMENT_SECRET");
    if (argument === "--input") {
      const value = argv[index + 1];
      if (!value) throw codedError("E_ARGUMENT");
      if (SECRET_KEY.test(value) || SECRET_VALUE.test(value)) throw codedError("E_ARGUMENT_SECRET");
      options.inputPath = value;
      index += 1;
      continue;
    }
    if (argument === "--expected-runs") {
      const value = Number(argv[index + 1]);
      if (!Number.isSafeInteger(value) || value < 1 || value > 10_000) throw codedError("E_ARGUMENT");
      options.expectedRuns = value;
      index += 1;
      continue;
    }
    throw codedError("E_ARGUMENT");
  }
  if (!options.help && !options.inputPath) throw codedError("E_ARGUMENT");
  return options;
}

function repoInputPath(inputPath) {
  const repoRoot = fs.realpathSync(process.cwd());
  const real = fs.realpathSync(path.resolve(process.cwd(), inputPath));
  if (real !== repoRoot && !real.startsWith(`${repoRoot}${path.sep}`)) throw codedError("E_INPUT_OUTSIDE_REPO");
  return real;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function flattenRecords(value, records = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenRecords(entry, records));
    return records;
  }
  if (!isObject(value)) return records;
  for (const key of ["records", "runs", "samples"]) {
    if (Array.isArray(value[key])) return flattenRecords(value[key], records);
  }
  records.push(value);
  return records;
}

function parseRecords(input) {
  const whole = tryParseJson(input.trim());
  if (whole !== undefined) return { records: flattenRecords(whole), parseErrors: 0 };
  const records = [];
  let parseErrors = 0;
  for (const line of input.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = tryParseJson(line.trim());
    if (parsed === undefined) {
      parseErrors += 1;
    } else {
      flattenRecords(parsed, records);
    }
  }
  return { records, parseErrors };
}

function scanForSecrets(value, state) {
  if (Array.isArray(value)) {
    value.forEach((entry) => scanForSecrets(entry, state));
    return;
  }
  if (isObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) state.count += 1;
      scanForSecrets(entry, state);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) state.count += 1;
}

function createFindings() {
  const counts = new Map();
  const flags = [];
  return {
    add(code, identity = code) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
      if (flags.length < MAX_FLAGS) flags.push({ code, hash: shortHash(identity) });
    },
    counts,
    flags,
  };
}

function directRunIndex(record, receipt) {
  const value = record.runIndex ?? receipt?.runIndex;
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function receiptFrom(record) {
  if (isObject(record.runReceipt)) return record.runReceipt;
  if (record.version === RECEIPT_VERSION) return record;
  return undefined;
}

function resultPageFrom(record) {
  if (isObject(record.resultPage)) return record.resultPage;
  if (isObject(record.phase6ResultPage)) return record.phase6ResultPage;
  if (isObject(record.payload?.receipt?.phase6)) return record;
  return undefined;
}

function phase6PageEnvelope(resultPage) {
  if (!isObject(resultPage)) return undefined;
  return resultPage.payload?.receipt?.phase6
    ?? resultPage.receipt?.phase6
    ?? resultPage.phase6;
}

function progressionSection(resultPage) {
  return phase6PageEnvelope(resultPage)?.page?.sections?.identityProgression?.progression;
}

function settlementSection(resultPage) {
  return phase6PageEnvelope(resultPage)?.page?.sections?.settlement;
}

function receiptLinkedFromPage(resultPage, receiptId) {
  const canonicalEvents = phase6PageEnvelope(resultPage)?.page?.receipt?.canonicalEvents;
  return Array.isArray(canonicalEvents)
    && canonicalEvents.some((event) => isObject(event) && event.receiptId === receiptId);
}

function eventIds(value, found = new Set()) {
  if (typeof value === "string") {
    if (value.trim()) found.add(value);
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => eventIds(entry, found));
    return found;
  }
  if (isObject(value)) Object.values(value).forEach((entry) => eventIds(entry, found));
  return found;
}

function growthDomains(body) {
  if (!isObject(body) || !isObject(body.attributes) || !isObject(body.progression)) return undefined;
  const progression = body.progression;
  const stage = progression.cultivation?.functionalStage;
  if (!isObject(progression.skills) || !Array.isArray(progression.talents) || !isObject(stage)) return undefined;
  return {
    permanentAttributes: body.attributes,
    skills: progression.skills,
    talents: progression.talents,
    cultivationStage: stage,
  };
}

function stableReasonValid(reason) {
  if (typeof reason === "string") {
    return /^(?:canonical|server|stable|no_change)[a-z0-9_.:-]{3,}$/i.test(reason.trim());
  }
  return isObject(reason)
    && nonEmptyString(reason.code)
    && normalized(reason.source ?? reason.authority) === "server";
}

function changeDomain(change) {
  const explicit = change?.domain;
  if (GROWTH_DOMAINS.includes(explicit)) return explicit;
  const pathValue = Array.isArray(change?.path) ? change.path.map(String) : [];
  if (pathValue.includes("attributes") || pathValue.includes("permanentAttributes")) return "permanentAttributes";
  if (pathValue.includes("skills")) return "skills";
  if (pathValue.includes("talents")) return "talents";
  if (pathValue.includes("functionalStage") || pathValue.includes("cultivationStage")) return "cultivationStage";
  return undefined;
}

function positiveQuantity(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function traceCostValid(cost) {
  return isObject(cost)
    && nonEmptyString(cost.assetKey ?? cost.materialId ?? cost.resourceId ?? cost.currencyId)
    && positiveQuantity(cost.quantityMinor ?? cost.quantity ?? cost.amount) !== undefined;
}

function sourceMaterialValid(material) {
  return isObject(material)
    && nonEmptyString(material.materialId ?? material.materialKey ?? material.resourceId ?? material.assetKey)
    && positiveQuantity(material.quantityMinor ?? material.quantity ?? material.amount) !== undefined;
}

function changeSourceText(change) {
  const source = change?.source;
  return [
    change?.grantBasis,
    change?.reason,
    change?.reasonCode,
    change?.sourceKind,
    typeof source === "string" ? source : source?.kind,
    isObject(source) ? source.authority : undefined,
  ].filter(nonEmptyString).join(":").toLowerCase();
}

function changeIsServerAuthoritative(change) {
  const source = change?.source;
  return normalized(change?.authority) === "server"
    || normalized(isObject(source) ? source.authority : undefined) === "server"
    || /^(?:server|canonical)[_:.-]/.test(changeSourceText(change));
}

function changeAttributeNames(change, beforeAttributes, afterAttributes) {
  const names = new Set();
  if (nonEmptyString(change.attribute)) names.add(change.attribute);
  if (nonEmptyString(change.attributeId)) names.add(change.attributeId);
  if (Array.isArray(change.path)) {
    const marker = Math.max(change.path.lastIndexOf("attributes"), change.path.lastIndexOf("permanentAttributes"));
    if (marker >= 0 && nonEmptyString(change.path[marker + 1])) names.add(change.path[marker + 1]);
  }
  for (const key of new Set([...Object.keys(beforeAttributes), ...Object.keys(afterAttributes)])) {
    if (canonicalHash(beforeAttributes[key]) !== canonicalHash(afterAttributes[key])) names.add(key);
  }
  return names;
}

function findIntensityPolicyViolation(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return false;
  if (Array.isArray(value)) return value.some((entry) => findIntensityPolicyViolation(entry, depth + 1));
  for (const [key, entry] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (["intensitygrantsattributes", "intensitygrantspermanentattributes"].includes(lower) && entry === true) return true;
    if (["intensityattributemap", "attributebyintensity"].includes(lower) && isObject(entry)) {
      if (normalized(entry.low) === "intellect"
        || normalized(entry.medium) === "willpower"
        || normalized(entry.high) === "physique") return true;
    }
    if (findIntensityPolicyViolation(entry, depth + 1)) return true;
  }
  return false;
}

function explicitIntensity(record, receipt) {
  const value = record.scenario?.intensity
    ?? record.intensity
    ?? receipt.scenario?.intensity
    ?? receipt.outcome?.intensityBand;
  const band = normalized(value);
  return Object.hasOwn(INTENSITY_ATTRIBUTE_MAP, band) ? band : undefined;
}

function validateGrowth(record, receipt, resultPage, runIdentity, findings) {
  const beforeDomains = growthDomains(receipt.snapshots.before.body);
  const afterDomains = growthDomains(receipt.snapshots.after.body);
  if (!beforeDomains || !afterDomains) {
    findings.add("E_GROWTH_DOMAIN_SHAPE", runIdentity);
    return { changedDomains: new Set(), beforeDomains, afterDomains };
  }

  const section = progressionSection(resultPage);
  if (!isObject(section)) {
    findings.add("E_RESULT_PAGE_PROGRESSION_REQUIRED", runIdentity);
    return { changedDomains: new Set(), beforeDomains, afterDomains };
  }
  const changedDomains = new Set(GROWTH_DOMAINS.filter((domain) => (
    canonicalHash(beforeDomains[domain]) !== canonicalHash(afterDomains[domain])
  )));
  const changes = Array.isArray(section.changes) ? section.changes : undefined;
  const sectionEvents = eventIds(section.eventIds);
  if (!changes) findings.add("E_PROGRESSION_CHANGESET_SHAPE", runIdentity);
  if (sectionEvents.size === 0) findings.add("E_PROGRESSION_EVENT_TRACE_REQUIRED", runIdentity);

  if (changedDomains.size === 0) {
    if (section.mode !== "no_change") findings.add("E_PROGRESSION_FALSE_CHANGE", runIdentity);
    if (changes && changes.length > 0) findings.add("E_PROGRESSION_FALSE_CHANGE", runIdentity);
    if (!stableReasonValid(section.noChangeReason)) findings.add("E_STABLE_REASON_REQUIRED", runIdentity);
    return { changedDomains, beforeDomains, afterDomains };
  }

  if (section.mode !== "changed") findings.add("E_PROGRESSION_CHANGE_NOT_DECLARED", runIdentity);
  if (!changes || changes.length === 0) findings.add("E_PROGRESSION_CHANGE_EVIDENCE_REQUIRED", runIdentity);
  const receiptEvents = eventIds(receipt.eventIds);
  const intensity = explicitIntensity(record, receipt);

  for (const domain of GROWTH_DOMAINS) {
    if (!changedDomains.has(domain)) {
      if (!stableReasonValid(section.stableReasons?.[domain])) findings.add("E_DOMAIN_STABLE_REASON_REQUIRED", `${runIdentity}:${domain}`);
      continue;
    }
    const evidence = changes?.find((entry) => isObject(entry) && changeDomain(entry) === domain);
    if (!evidence) {
      findings.add("E_DOMAIN_CHANGE_EVIDENCE_REQUIRED", `${runIdentity}:${domain}`);
      continue;
    }
    const expectedBeforeHash = canonicalHash(beforeDomains[domain]);
    const expectedAfterHash = canonicalHash(afterDomains[domain]);
    if (!HASH_PATTERN.test(evidence.beforeHash ?? "") || evidence.beforeHash !== expectedBeforeHash) {
      findings.add("E_GROWTH_BEFORE_HASH_MISMATCH", `${runIdentity}:${domain}`);
    }
    if (!HASH_PATTERN.test(evidence.afterHash ?? "") || evidence.afterHash !== expectedAfterHash) {
      findings.add("E_GROWTH_AFTER_HASH_MISMATCH", `${runIdentity}:${domain}`);
    }
    const sourceEvents = eventIds(evidence.sourceEventIds ?? evidence.eventIds);
    if (sourceEvents.size === 0 || [...sourceEvents].some((id) => !receiptEvents.has(id)) || ![...sourceEvents].some((id) => sectionEvents.has(id))) {
      findings.add("E_GROWTH_EVENT_TRACE_REQUIRED", `${runIdentity}:${domain}`);
    }
    if (!Array.isArray(evidence.costs) || evidence.costs.length === 0 || evidence.costs.some((cost) => !traceCostValid(cost))) {
      findings.add("E_GROWTH_COST_TRACE_REQUIRED", `${runIdentity}:${domain}`);
    }
    if (!Array.isArray(evidence.sourceMaterials) || evidence.sourceMaterials.length === 0 || evidence.sourceMaterials.some((item) => !sourceMaterialValid(item))) {
      findings.add("E_GROWTH_SOURCE_MATERIAL_REQUIRED", `${runIdentity}:${domain}`);
    }
    if (!changeIsServerAuthoritative(evidence)) findings.add("E_GROWTH_SERVER_SOURCE_REQUIRED", `${runIdentity}:${domain}`);

    const sourceText = changeSourceText(evidence);
    if (/\b(?:mission_)?intensity\b/.test(sourceText)) findings.add("E_INTENSITY_GROWTH_SOURCE", `${runIdentity}:${domain}`);
    if (domain === "permanentAttributes" && intensity) {
      const names = changeAttributeNames(evidence, beforeDomains.permanentAttributes, afterDomains.permanentAttributes);
      if (names.has(INTENSITY_ATTRIBUTE_MAP[intensity]) && /\b(?:mission_)?intensity\b/.test(sourceText)) {
        findings.add("E_INTENSITY_DIRECT_ATTRIBUTE_MAP", `${runIdentity}:${intensity}`);
      }
    }
  }
  return { changedDomains, beforeDomains, afterDomains };
}

function materialId(material) {
  const value = material?.materialId ?? material?.materialKey ?? material?.resourceId ?? material?.assetKey;
  return nonEmptyString(value) ? value : undefined;
}

function materialClass(material) {
  return normalized(material?.materialClass ?? material?.class ?? material?.kind ?? material?.category);
}

function materialQuantity(material) {
  return positiveQuantity(material?.quantityMinor ?? material?.quantity ?? material?.amount) ?? 0;
}

function materialMap(value) {
  const map = new Map();
  if (!Array.isArray(value)) return map;
  for (const entry of value) {
    const id = materialId(entry);
    if (!id) continue;
    const current = map.get(id) ?? { quantity: 0, entries: [] };
    current.quantity += materialQuantity(entry);
    current.entries.push(entry);
    map.set(id, current);
  }
  return map;
}

function materialDelta(beforeMap, afterMap, id) {
  return (afterMap.get(id)?.quantity ?? 0) - (beforeMap.get(id)?.quantity ?? 0);
}

function dedicatedMaterial(material, acceptedClasses) {
  const id = materialId(material);
  return Boolean(id)
    && !/^journey_reward_/i.test(id)
    && acceptedClasses.has(materialClass(material));
}

function materialUsageRefs(record, material) {
  const direct = [material.usageRefs, material.uses, material.eligibleUses].find(Array.isArray) ?? [];
  const audit = Array.isArray(record.materialAcceptance?.usages)
    ? record.materialAcceptance.usages.filter((entry) => materialId(entry) === materialId(material))
    : [];
  return [...direct, ...audit];
}

function usageValid(value, purposePattern) {
  if (!isObject(value)) return false;
  const purpose = [value.system, value.purpose, value.useType, value.kind].filter(nonEmptyString).join(":").toLowerCase();
  const target = value.targetRef ?? value.recipeId ?? value.methodId ?? value.stageId ?? value.blueprintId;
  return purposePattern.test(purpose) && nonEmptyString(target);
}

function newOrdinaryRewardExists(beforeBody, afterBody) {
  const beforeItems = beforeBody.economy?.warehouse?.inventory?.items ?? [];
  const afterItems = afterBody.economy?.warehouse?.inventory?.items ?? [];
  const beforeIds = new Set(beforeItems.map((item) => item?.itemId ?? item?.itemKey).filter(nonEmptyString));
  return afterItems.some((item) => {
    const id = item?.itemId ?? item?.itemKey;
    return nonEmptyString(id) && !beforeIds.has(id) && /^journey_reward_/i.test(item?.itemKey ?? id);
  });
}

function validateMaterialRun(record, receipt, resultPage, runIndex, runIdentity, findings) {
  const cultivation = runIndex === 8;
  const beforeBody = receipt.snapshots.before.body;
  const afterBody = receipt.snapshots.after.body;
  const beforeEconomy = materialMap(beforeBody.economy?.materials);
  const afterEconomy = materialMap(afterBody.economy?.materials);
  const beforeCultivation = materialMap(beforeBody.progression?.cultivation?.resources?.materials);
  const afterCultivation = materialMap(afterBody.progression?.cultivation?.resources?.materials);
  const beforeWarehouse = materialMap(beforeBody.economy?.warehouse?.resources);
  const afterWarehouse = materialMap(afterBody.economy?.warehouse?.resources);
  const sourceBefore = cultivation ? beforeCultivation : beforeEconomy;
  const sourceAfter = cultivation ? afterCultivation : afterEconomy;
  const acceptedClasses = cultivation ? CULTIVATION_MATERIAL_CLASSES : CRAFTING_MATERIAL_CLASSES;
  const candidates = [];
  for (const [id, state] of sourceAfter) {
    const entry = state.entries.find((item) => dedicatedMaterial(item, acceptedClasses));
    if (entry && materialDelta(sourceBefore, sourceAfter, id) > 0) candidates.push(entry);
  }
  const prefix = cultivation ? "RUN8_CULTIVATION" : "RUN9_CRAFTING";
  if (candidates.length === 0) {
    findings.add(`E_${prefix}_MATERIAL_REQUIRED`, runIdentity);
    if (newOrdinaryRewardExists(beforeBody, afterBody)) findings.add("E_ORDINARY_REWARD_IS_NOT_ADVANCEMENT_MATERIAL", runIdentity);
    return false;
  }

  const receiptEvents = eventIds(receipt.eventIds);
  const settlementEvents = eventIds(settlementSection(resultPage)?.eventIds);
  let accepted = false;
  for (const material of candidates) {
    const id = materialId(material);
    if (materialDelta(beforeWarehouse, afterWarehouse, id) <= 0) {
      findings.add(`E_${prefix}_WAREHOUSE_POSTING_REQUIRED`, `${runIdentity}:${id}`);
      continue;
    }
    const sourceEvents = eventIds(material.sourceEventIds ?? material.eventIds);
    if (sourceEvents.size === 0
      || [...sourceEvents].some((eventId) => !receiptEvents.has(eventId))
      || ![...sourceEvents].some((eventId) => settlementEvents.has(eventId))) {
      findings.add(`E_${prefix}_SOURCE_EVENT_REQUIRED`, `${runIdentity}:${id}`);
      continue;
    }
    const purposePattern = cultivation ? /cultivation|breakthrough|advancement/ : /crafting|forging|tailoring/;
    if (!materialUsageRefs(record, material).some((usage) => usageValid(usage, purposePattern))) {
      findings.add(`E_${prefix}_USE_TRACE_REQUIRED`, `${runIdentity}:${id}`);
      continue;
    }
    accepted = true;
  }
  return accepted;
}

function validateV2(record, receipt, resultPage, findings) {
  const runIndex = directRunIndex(record, receipt);
  const runIdentity = `${receipt.receiptId ?? "missing"}:${runIndex ?? "missing"}`;
  if (!runIndex) findings.add("E_RUN_INDEX_REQUIRED", runIdentity);
  if (!nonEmptyString(receipt.receiptId) || !nonEmptyString(receipt.runId)) findings.add("E_RECEIPT_IDENTITY_REQUIRED", runIdentity);
  if (!isObject(receipt.snapshots?.before) || !isObject(receipt.snapshots?.after)) {
    findings.add("E_V2_SNAPSHOTS_REQUIRED", runIdentity);
    return { runIndex, materialAccepted: false };
  }
  const before = receipt.snapshots.before;
  const after = receipt.snapshots.after;
  if (!isObject(before.body) || !HASH_PATTERN.test(before.hash ?? "") || canonicalHash(before.body) !== before.hash) {
    findings.add("E_V2_BEFORE_HASH_MISMATCH", runIdentity);
  }
  if (!isObject(after.body) || !HASH_PATTERN.test(after.hash ?? "") || canonicalHash(after.body) !== after.hash) {
    findings.add("E_V2_AFTER_HASH_MISMATCH", runIdentity);
  }
  if (receipt.integrity?.beforeSnapshotHash !== before.hash) findings.add("E_V2_BEFORE_INTEGRITY_MISMATCH", runIdentity);
  if (receipt.integrity?.afterSnapshotHash !== after.hash) findings.add("E_V2_AFTER_INTEGRITY_MISMATCH", runIdentity);
  if ((!Array.isArray(receipt.deltas) && !isObject(receipt.deltas))
    || !HASH_PATTERN.test(receipt.integrity?.deltasHash ?? "")
    || canonicalHash(receipt.deltas) !== receipt.integrity.deltasHash) {
    findings.add("E_V2_DELTAS_HASH_MISMATCH", runIdentity);
  }

  const phase6 = phase6PageEnvelope(resultPage);
  if (!isObject(phase6)) {
    findings.add("E_RESULT_PAGE_REQUIRED", runIdentity);
  } else {
    if (phase6.verified !== true || phase6.ok !== true || phase6.page?.deterministic !== true) {
      findings.add("E_RESULT_PAGE_NOT_SERVER_VERIFIED", runIdentity);
    }
    if (!receiptLinkedFromPage(resultPage, receipt.receiptId)) findings.add("E_RESULT_PAGE_RECEIPT_LINK_REQUIRED", runIdentity);
    const settlement = settlementSection(resultPage);
    if (!isObject(settlement) || !isObject(settlement.economyConservation) || eventIds(settlement.eventIds).size === 0) {
      findings.add("E_RESULT_PAGE_SETTLEMENT_TRACE_REQUIRED", runIdentity);
    }
  }

  if (findIntensityPolicyViolation(record) || findIntensityPolicyViolation(receipt)) {
    findings.add("E_INTENSITY_ATTRIBUTE_POLICY", runIdentity);
  }
  if (isObject(before.body) && isObject(after.body) && isObject(phase6)) {
    validateGrowth(record, receipt, resultPage, runIdentity, findings);
  }
  let materialAccepted = false;
  if ((runIndex === 8 || runIndex === 9) && isObject(before.body) && isObject(after.body) && isObject(phase6)) {
    materialAccepted = validateMaterialRun(record, receipt, resultPage, runIndex, runIdentity, findings);
  }
  return { runIndex, materialAccepted };
}

function legacyDomains(delta) {
  if (!isObject(delta?.before) || !isObject(delta?.after)) return undefined;
  const stage = (value) => value.cultivationStage ?? value.cultivation?.functionalStage;
  if (!isObject(delta.before.attributes) || !isObject(delta.after.attributes)
    || delta.before.skills === undefined || delta.after.skills === undefined
    || delta.before.talents === undefined || delta.after.talents === undefined
    || stage(delta.before) === undefined || stage(delta.after) === undefined) return undefined;
  return {
    before: {
      permanentAttributes: delta.before.attributes,
      skills: delta.before.skills,
      talents: delta.before.talents,
      cultivationStage: stage(delta.before),
    },
    after: {
      permanentAttributes: delta.after.attributes,
      skills: delta.after.skills,
      talents: delta.after.talents,
      cultivationStage: stage(delta.after),
    },
  };
}

function validateLegacyAdapter(record, findings) {
  const identity = `legacy:${record.runIndex ?? record.requestId ?? "missing"}`;
  const domains = legacyDomains(record.progressionDelta);
  if (!domains) {
    findings.add("E_LEGACY_ADAPTER_SHAPE", identity);
    return;
  }
  const changed = GROWTH_DOMAINS.filter((domain) => canonicalHash(domains.before[domain]) !== canonicalHash(domains.after[domain]));
  if (changed.length === 0) {
    if (!stableReasonValid(record.progressionDelta.stableReason ?? record.progressionDelta.noChangeReason)) {
      findings.add("E_STABLE_REASON_REQUIRED", identity);
    }
    return;
  }
  if (!Array.isArray(record.progressionDelta.changes)) {
    findings.add("E_LEGACY_CHANGE_EVIDENCE_REQUIRED", identity);
    return;
  }
  for (const domain of changed) {
    const evidence = record.progressionDelta.changes.find((entry) => changeDomain(entry) === domain);
    if (!evidence
      || evidence.beforeHash !== canonicalHash(domains.before[domain])
      || evidence.afterHash !== canonicalHash(domains.after[domain])
      || eventIds(evidence.sourceEventIds).size === 0
      || !Array.isArray(evidence.costs) || evidence.costs.length === 0 || evidence.costs.some((cost) => !traceCostValid(cost))
      || !Array.isArray(evidence.sourceMaterials) || evidence.sourceMaterials.length === 0 || evidence.sourceMaterials.some((item) => !sourceMaterialValid(item))
      || !changeIsServerAuthoritative(evidence)) {
      findings.add("E_LEGACY_CHANGE_EVIDENCE_REQUIRED", `${identity}:${domain}`);
    }
  }
}

function gate(input, options) {
  const inputHash = sha256(input);
  const { records, parseErrors } = parseRecords(input);
  const findings = createFindings();
  const secretState = { count: 0 };
  scanForSecrets(records, secretState);
  if (parseErrors > 0) findings.add("E_PARSE");
  if (secretState.count > 0) findings.add("E_SECRET");
  if (records.length === 0) findings.add("E_RECORD_REQUIRED");

  const seenRunIndexes = new Set();
  const seenReceiptIds = new Set();
  let v2Runs = 0;
  let legacyRuns = 0;
  let run8Accepted = false;
  let run9Accepted = false;
  let highestRunIndex = 0;

  for (const [index, record] of records.entries()) {
    const receipt = receiptFrom(record);
    if (receipt) {
      if (receipt.version !== RECEIPT_VERSION) {
        findings.add("E_RECEIPT_VERSION_UNSUPPORTED", `record:${index}`);
        continue;
      }
      const resultPage = resultPageFrom(record);
      if (!resultPage) findings.add("E_RESULT_PAGE_REQUIRED", `record:${index}`);
      const result = validateV2(record, receipt, resultPage, findings);
      v2Runs += 1;
      if (result.runIndex) {
        highestRunIndex = Math.max(highestRunIndex, result.runIndex);
        if (seenRunIndexes.has(result.runIndex)) findings.add("E_RUN_INDEX_DUPLICATE", `run:${result.runIndex}`);
        seenRunIndexes.add(result.runIndex);
        if (result.runIndex === 8) run8Accepted = result.materialAccepted;
        if (result.runIndex === 9) run9Accepted = result.materialAccepted;
      }
      if (nonEmptyString(receipt.receiptId)) {
        if (seenReceiptIds.has(receipt.receiptId)) findings.add("E_RECEIPT_ID_DUPLICATE", receipt.receiptId);
        seenReceiptIds.add(receipt.receiptId);
      }
      continue;
    }
    if (record.adapterVersion === LEGACY_ADAPTER_VERSION) {
      legacyRuns += 1;
      validateLegacyAdapter(record, findings);
      continue;
    }
    findings.add("E_V2_RECEIPT_OR_EXPLICIT_ADAPTER_REQUIRED", `record:${index}`);
  }

  if (options.expectedRuns !== undefined && v2Runs + legacyRuns !== options.expectedRuns) {
    findings.add("E_EXPECTED_RUN_COUNT", `${v2Runs + legacyRuns}:${options.expectedRuns}`);
  }
  const materialCoverageRequired = v2Runs > 0 && (highestRunIndex >= 9 || (options.expectedRuns ?? 0) >= 9);
  if (materialCoverageRequired) {
    if (!seenRunIndexes.has(8)) findings.add("E_RUN8_EVIDENCE_REQUIRED");
    else if (!run8Accepted) findings.add("E_RUN8_MATERIAL_ACCEPTANCE_FAILED");
    if (!seenRunIndexes.has(9)) findings.add("E_RUN9_EVIDENCE_REQUIRED");
    else if (!run9Accepted) findings.add("E_RUN9_MATERIAL_ACCEPTANCE_FAILED");
  }

  const errorCodes = [...findings.counts.keys()].sort().slice(0, MAX_REPORTED_CODES);
  return {
    ok: errorCodes.length === 0,
    schemaVersion: SCHEMA_VERSION,
    counts: {
      records: records.length,
      v2Runs,
      legacyAdapterRuns: legacyRuns,
      uniqueRunIndexes: seenRunIndexes.size,
      materialRunsAccepted: Number(run8Accepted) + Number(run9Accepted),
      parseErrors,
      secretFindings: secretState.count,
      errors: [...findings.counts.values()].reduce((sum, count) => sum + count, 0),
    },
    hash: inputHash,
    errorCodes,
    errorCodeCounts: Object.fromEntries([...findings.counts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    flags: findings.flags,
  };
}

function emit(payload, exitCode) {
  console.log(JSON.stringify(payload));
  process.exit(exitCode);
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      emit({
        ok: true,
        schemaVersion: SCHEMA_VERSION,
        counts: { records: 0, v2Runs: 0, legacyAdapterRuns: 0, errors: 0 },
        hash: shortHash("help"),
        errorCodes: [],
      }, 0);
    }
    const input = fs.readFileSync(repoInputPath(options.inputPath), "utf8");
    const result = gate(input, options);
    emit(result, result.ok ? 0 : 1);
  } catch (error) {
    const code = error?.code || "E_INTERNAL";
    emit({
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      counts: { records: 0, v2Runs: 0, legacyAdapterRuns: 0, errors: 1 },
      hash: shortHash(code),
      errorCodes: [code],
      errorCodeCounts: { [code]: 1 },
      flags: [],
    }, 1);
  }
}

main();
