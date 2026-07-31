#!/usr/bin/env node
// @ts-nocheck

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_VERSION = "obsidian-epoch.phase6-crafting-gate.v1";
const MAX_ERRORS = 200;
const MAX_PARSE_ERRORS = 20;
const MAX_HASHES = 128;
const SECRET_KEY = /(?:secret|token|api[-_]?key|authorization|password|credential|private[-_]?key|access[-_]?key|refresh[-_]?token|session[-_]?key|recovery[-_]?code|operator[-_]?key)/i;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[0-9A-Z]{16})\b/i;
const CRAFT_PROFESSIONS = new Set(["forging", "smithing", "casting", "foundry", "sewing", "tailoring"]);
const HIGH_TIER = /(?:rare|epic|legendary|mythic|high|高级|稀有|史诗|传说|高阶)/i;
const ZERO_OR_FREE = /^(?:0|0\.0+|free|none|waived|免费)$/i;

function usage() {
  return [
    "Usage: node --import tsx ../agent-server/phase6-crafting-gate.ts [--recipes <path>] [--crafts <path>] [--settlements <path>] [--progression <path>] [--input <path>]",
    "",
    "Reads repo-local recipe/craft settlement/profession progression JSON or JSONL and prints a machine JSON gate summary.",
    "Exits non-zero on malformed input, secrets, recipe drift, crafting asset imbalance, duplicate claim, free upgrade, or unlock/profession gate failure.",
  ].join("\n");
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value)).digest("hex")}`;
}

function shortHash(value) {
  return sha256(value).slice(0, 19);
}

function parseArguments(argv) {
  const options = { inputs: [], help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (SECRET_KEY.test(argument) || SECRET_VALUE.test(argument)) throw codedError("E_ARGUMENT_SECRET");
    if (["--input", "--recipes", "--crafts", "--settlements", "--progression"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw codedError("E_ARGUMENT");
      if (SECRET_KEY.test(value) || SECRET_VALUE.test(value)) throw codedError("E_ARGUMENT_SECRET");
      options.inputs.push({ role: argument.slice(2), path: value });
      index += 1;
      continue;
    }
    throw codedError("E_ARGUMENT");
  }
  if (!options.help && options.inputs.length === 0) throw codedError("E_ARGUMENT");
  return options;
}

function repoInputPath(inputPath) {
  const repoRoot = fs.realpathSync(process.cwd());
  const resolved = path.resolve(process.cwd(), inputPath);
  const real = fs.realpathSync(resolved);
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

function extractJsonCandidate(line) {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
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
  if (arrayStart >= 0 && arrayEnd > arrayStart) return tryParseJson(trimmed.slice(arrayStart, arrayEnd + 1));
  return undefined;
}

function flattenRecords(value, records = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => flattenRecords(entry, records));
    return records;
  }
  if (value && typeof value === "object") {
    for (const key of ["records", "runs", "receipts", "samples", "recipes", "crafts", "settlements", "progression"]) {
      if (Array.isArray(value[key])) return flattenRecords(value[key], records);
    }
    records.push(value);
  }
  return records;
}

function parseRecords(input) {
  const wholeDocument = tryParseJson(input.trim());
  if (wholeDocument !== undefined) return { records: flattenRecords(wholeDocument), parseErrors: [] };
  const records = [];
  const parseErrors = [];
  input.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parsed = extractJsonCandidate(line);
    if (parsed === undefined) {
      parseErrors.push({ line: index + 1 });
      return;
    }
    flattenRecords(parsed, records);
  });
  return { records, parseErrors };
}

function scanForSecrets(value, state) {
  if (Array.isArray(value)) {
    value.forEach((entry) => scanForSecrets(entry, state));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) state.secretCount += 1;
      scanForSecrets(entry, state);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) state.secretCount += 1;
}

function getPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function firstValue(record, paths) {
  for (const candidate of paths) {
    const value = getPath(record, candidate);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function hasOwn(value, key) {
  return value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
}

function stringValue(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function normalized(value) {
  return stringValue(value)?.trim().toLowerCase();
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function boolValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["true", "yes", "ok", "success", "succeeded", "complete", "completed"].includes(text)) return true;
    if (["false", "no", "fail", "failed", "error", "rejected"].includes(text)) return false;
  }
  return undefined;
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.entries(value).map(([id, entry]) => {
    if (entry && typeof entry === "object") return { id, ...entry };
    return { id, quantity: entry };
  });
  return [];
}

function hasNonEmpty(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null && value !== "";
}

function findAll(value, predicate, matches = [], depth = 0) {
  if (!value || typeof value !== "object" || depth > 9) return matches;
  if (predicate(value)) matches.push(value);
  if (Array.isArray(value)) {
    value.forEach((entry) => findAll(entry, predicate, matches, depth + 1));
    return matches;
  }
  Object.values(value).forEach((entry) => findAll(entry, predicate, matches, depth + 1));
  return matches;
}

function recordId(record) {
  return stringValue(firstValue(record, [
    ["id"],
    ["craftId"],
    ["craft_id"],
    ["jobId"],
    ["job_id"],
    ["queueId"],
    ["queue_id"],
    ["settlementId"],
    ["settlement_id"],
    ["eventId"],
    ["event_id"],
    ["receiptId"],
    ["receipt_id"],
    ["requestId"],
    ["request_id"],
    ["idempotencyKey"],
    ["idempotency_key"],
  ])) ?? JSON.stringify(record).slice(0, 256);
}

function recipeId(value) {
  return stringValue(firstValue(value, [
    ["recipeId"],
    ["recipe_id"],
    ["recipe", "id"],
    ["recipe", "recipeId"],
    ["id"],
  ]));
}

function recipeVersion(value) {
  return stringValue(firstValue(value, [
    ["recipeVersion"],
    ["recipe_version"],
    ["version"],
    ["recipe", "version"],
    ["recipe", "recipeVersion"],
  ]));
}

function looksLikeRecipe(record) {
  return hasOwn(record, "recipeId")
    || hasOwn(record, "recipe_id")
    || (hasOwn(record, "recipe") && hasNonEmpty(firstValue(record, [["recipe", "materials"], ["recipe", "inputs"], ["recipe", "outputs"]])))
    || (hasNonEmpty(firstValue(record, [["materials"], ["inputs"]])) && hasNonEmpty(firstValue(record, [["outputs"], ["result"], ["results"]])) && hasOwn(record, "version"));
}

function looksLikeCraft(record) {
  const text = normalized(firstValue(record, [["type"], ["kind"], ["eventType"], ["event_type"], ["domain"]])) ?? "";
  return /craft|forge|smith|cast|sew|tailor|制作|铸造|缝纫/.test(text)
    || hasOwn(record, "craftId")
    || hasOwn(record, "craft_id")
    || hasOwn(record, "jobId")
    || hasOwn(record, "job_id")
    || hasOwn(record, "idempotencyKey")
    || hasOwn(record, "idempotency_key")
    || hasNonEmpty(firstValue(record, [["materialsConsumed"], ["materials_consumed"], ["consumed"], ["inputsConsumed"], ["outputs"], ["queue"]]));
}

function looksLikeProgression(record) {
  const text = normalized(firstValue(record, [["profession"], ["professionId"], ["profession_id"], ["skill"], ["skillId"], ["skill_id"], ["type"], ["kind"]])) ?? "";
  return /forging|smithing|casting|foundry|sewing|tailoring|profession|recipe_unlock|skill_unlock|铸造|缝纫/.test(text)
    || hasNonEmpty(firstValue(record, [["professionXp"], ["profession_xp"], ["xpDelta"], ["xp_delta"], ["unlockCost"], ["unlock_cost"], ["recipeUnlockCost"], ["skillUnlockCost"]]));
}

function collectByRole(inputBatches) {
  const recipes = [];
  const crafts = [];
  const progressions = [];
  const all = [];
  for (const batch of inputBatches) {
    for (const record of batch.records) {
      all.push(record);
      if (batch.role === "recipes" || (batch.role === "input" && looksLikeRecipe(record))) recipes.push(record);
      if (["crafts", "settlements"].includes(batch.role) || (batch.role === "input" && looksLikeCraft(record))) crafts.push(record);
      if (batch.role === "progression" || (batch.role === "input" && looksLikeProgression(record))) progressions.push(record);
    }
  }
  return { all, recipes, crafts, progressions };
}

function materialList(value) {
  return arrayValue(firstValue(value, [
    ["materials"],
    ["material"],
    ["inputs"],
    ["input"],
    ["cost"],
    ["costs"],
    ["materialsRequired"],
    ["materials_required"],
    ["materialsConsumed"],
    ["materials_consumed"],
    ["consumed"],
    ["inputsConsumed"],
    ["inputs_consumed"],
  ]));
}

function outputList(value) {
  return arrayValue(firstValue(value, [
    ["outputs"],
    ["output"],
    ["results"],
    ["result"],
    ["produced"],
    ["itemsProduced"],
    ["items_produced"],
    ["yield"],
    ["yields"],
  ]));
}

function lossList(value) {
  return arrayValue(firstValue(value, [["loss"], ["losses"], ["waste"], ["wastes"], ["breakage"], ["scrap"]]));
}

function feeList(value) {
  return arrayValue(firstValue(value, [["fees"], ["fee"], ["手续费"], ["craftingFee"], ["crafting_fee"]]));
}

function itemKey(item) {
  return stringValue(firstValue(item, [["asset"], ["assetId"], ["asset_id"], ["item"], ["itemId"], ["item_id"], ["material"], ["materialId"], ["material_id"], ["id"], ["key"], ["sku"]])) ?? "unknown";
}

function quantity(item) {
  return numberValue(firstValue(item, [["quantity"], ["qty"], ["amount"], ["count"], ["units"], ["value"]])) ?? 0;
}

function sourceId(item) {
  return stringValue(firstValue(item, [
    ["source"],
    ["sourceId"],
    ["source_id"],
    ["sourceEvent"],
    ["sourceEventId"],
    ["source_event_id"],
    ["provenance"],
    ["receiptId"],
    ["receipt_id"],
    ["flowId"],
    ["flow_id"],
  ]));
}

function tierText(item) {
  return stringValue(firstValue(item, [["tier"], ["grade"], ["rarity"], ["quality"], ["level"], ["rank"]])) ?? "";
}

function recipeCost(recipe) {
  return new Map(materialList(recipe).map((item) => [itemKey(item), quantity(item)]));
}

function recipeOutputs(recipe) {
  return new Map(outputList(recipe).map((item) => [itemKey(item), quantity(item)]));
}

function successStatus(craft) {
  const ok = boolValue(firstValue(craft, [["success"], ["ok"], ["succeeded"], ["completed"]]));
  if (ok !== undefined) return ok;
  const status = normalized(firstValue(craft, [["status"], ["state"], ["result"], ["outcome"]]));
  if (!status) return undefined;
  if (/success|succeeded|complete|completed|settled|ok/.test(status)) return true;
  if (/fail|failed|error|cancel|rejected/.test(status)) return false;
  return undefined;
}

function stableSeed(craft) {
  return firstValue(craft, [
    ["seed"],
    ["randomSeed"],
    ["random_seed"],
    ["rngSeed"],
    ["rng_seed"],
    ["qualitySeed"],
    ["quality_seed"],
    ["quality", "seed"],
    ["random", "seed"],
  ]);
}

function qualityEvidence(craft) {
  return firstValue(craft, [
    ["quality"],
    ["qualityRoll"],
    ["quality_roll"],
    ["qualityResult"],
    ["quality_result"],
    ["rarity"],
    ["grade"],
  ]);
}

function idempotencyKey(craft) {
  return stringValue(firstValue(craft, [["idempotencyKey"], ["idempotency_key"], ["requestId"], ["request_id"], ["queueKey"], ["queue_key"]]));
}

function claimKey(craft) {
  return stringValue(firstValue(craft, [["claimId"], ["claim_id"], ["settlementId"], ["settlement_id"], ["receiptId"], ["receipt_id"], ["deliveryId"], ["delivery_id"]]));
}

function hasRefundEvidence(craft) {
  return hasNonEmpty(firstValue(craft, [["refund"], ["refunds"], ["returned"], ["returns"], ["materialsReturned"], ["materials_returned"], ["failureReturn"], ["failure_return"]]));
}

function hasUnlockCost(record) {
  return hasNonEmpty(firstValue(record, [
    ["unlockCost"],
    ["unlock_cost"],
    ["recipeUnlockCost"],
    ["recipe_unlock_cost"],
    ["skillUnlockCost"],
    ["skill_unlock_cost"],
    ["cost"],
    ["costs"],
    ["spent"],
    ["consumed"],
  ]));
}

function addError(errors, code, identity, details = undefined) {
  errors.push({ code, hash: shortHash(identity), ...(details ? { details } : {}) });
}

function countCode(map, code) {
  map.set(code, (map.get(code) ?? 0) + 1);
}

function buildRecipeIndex(recipes, errors) {
  const index = new Map();
  for (const recipe of recipes) {
    const id = recipeId(recipe);
    const version = recipeVersion(recipe);
    const identity = recordId(recipe);
    if (!id) addError(errors, "E_RECIPE_ID_MISSING", identity);
    if (!version) addError(errors, "E_RECIPE_VERSION_MISSING", identity);
    if (!hasNonEmpty(materialList(recipe))) addError(errors, "E_RECIPE_MATERIALS_MISSING", identity);
    if (!hasNonEmpty(outputList(recipe))) addError(errors, "E_RECIPE_OUTPUTS_MISSING", identity);
    if (id && version) {
      const key = `${id}@${version}`;
      if (index.has(key)) addError(errors, "E_RECIPE_VERSION_DUPLICATE", key);
      index.set(key, recipe);
    }
  }
  return index;
}

function validateCraft(craft, recipeIndex, errors, state) {
  const identity = recordId(craft);
  const id = stringValue(firstValue(craft, [["craftId"], ["craft_id"], ["jobId"], ["job_id"], ["id"]])) ?? identity;
  const idKey = idempotencyKey(craft);
  const claimed = claimKey(craft);
  const success = successStatus(craft);
  const rid = recipeId(craft);
  const version = recipeVersion(craft);
  const inputs = materialList(craft);
  const outputs = outputList(craft);
  const losses = lossList(craft);
  const fees = feeList(craft);

  if (idKey) {
    const previous = state.idempotencyKeys.get(idKey);
    const payloadHash = shortHash(JSON.stringify({ rid, version, inputs, outputs, success }));
    if (previous && previous.payloadHash !== payloadHash) addError(errors, "E_QUEUE_IDEMPOTENCY_CONFLICT", idKey);
    state.idempotencyKeys.set(idKey, { payloadHash });
  } else {
    addError(errors, "E_QUEUE_IDEMPOTENCY_MISSING", identity);
  }

  if (claimed) {
    if (state.claims.has(claimed)) addError(errors, "E_DUPLICATE_CLAIM", claimed);
    state.claims.add(claimed);
  }

  if (!rid) addError(errors, "E_CRAFT_RECIPE_MISSING", identity);
  if (!version) addError(errors, "E_CRAFT_RECIPE_VERSION_MISSING", identity);
  const recipe = rid && version ? recipeIndex.get(`${rid}@${version}`) : undefined;
  if (recipeIndex.size > 0 && rid && version && !recipe) addError(errors, "E_RECIPE_VERSION_UNKNOWN", `${rid}@${version}`);

  if (!hasNonEmpty(inputs)) addError(errors, "E_MATERIAL_CONSUMPTION_MISSING", identity);
  if (success === true && !hasNonEmpty(outputs)) addError(errors, "E_OUTPUT_MISSING", identity);
  if (success === false && hasNonEmpty(outputs)) addError(errors, "E_FAILED_CRAFT_OUTPUT", identity);
  if (success === false && !hasRefundEvidence(craft)) addError(errors, "E_FAILURE_RETURN_MISSING", identity);
  if (qualityEvidence(craft) !== undefined && stableSeed(craft) === undefined) addError(errors, "E_QUALITY_SEED_MISSING", identity);
  if (!hasNonEmpty(fees)) addError(errors, "E_FEE_MISSING", identity);

  const seenSources = new Set();
  for (const item of inputs) {
    const key = itemKey(item);
    const qty = quantity(item);
    const source = sourceId(item);
    if (qty <= 0) addError(errors, "E_MATERIAL_CONSUMPTION_NON_POSITIVE", `${identity}:${key}`);
    if (!source) addError(errors, "E_MATERIAL_SOURCE_MISSING", `${identity}:${key}`);
    if (source) {
      const sourceKey = `${source}:${key}`;
      if (seenSources.has(sourceKey)) addError(errors, "E_DUPLICATE_MATERIAL_SOURCE", sourceKey);
      seenSources.add(sourceKey);
    }
    if (HIGH_TIER.test(tierText(item)) && !source) addError(errors, "E_HIGH_TIER_SOURCE_MISSING", `${identity}:${key}`);
    state.assets.add(key);
  }

  for (const item of outputs) {
    const key = itemKey(item);
    const qty = quantity(item);
    if (qty <= 0) addError(errors, "E_OUTPUT_NON_POSITIVE", `${identity}:${key}`);
    if (!sourceId(item) && !id) addError(errors, "E_OUTPUT_SOURCE_MISSING", `${identity}:${key}`);
    if (HIGH_TIER.test(tierText(item)) && !sourceId(item) && success !== true) addError(errors, "E_HIGH_TIER_SOURCE_MISSING", `${identity}:${key}`);
    state.assets.add(key);
  }

  for (const item of losses) {
    const key = itemKey(item);
    const qty = quantity(item);
    if (qty < 0) addError(errors, "E_LOSS_NEGATIVE", `${identity}:${key}`);
    state.assets.add(key);
  }

  for (const fee of fees) {
    const qty = quantity(fee);
    const text = normalized(qty || firstValue(fee, [["amount"], ["quantity"], ["value"], ["kind"]]));
    if (qty < 0 || text === undefined || ZERO_OR_FREE.test(text)) addError(errors, "E_FEE_FREE_OR_INVALID", identity);
  }

  if (recipe) validateAgainstRecipe(craft, recipe, errors, identity);
}

function validateAgainstRecipe(craft, recipe, errors, identity) {
  const required = recipeCost(recipe);
  const produced = recipeOutputs(recipe);
  const consumed = new Map(materialList(craft).map((item) => [itemKey(item), quantity(item)]));
  const outputs = new Map(outputList(craft).map((item) => [itemKey(item), quantity(item)]));
  for (const [key, qty] of required) {
    if ((consumed.get(key) ?? 0) < qty) addError(errors, "E_RECIPE_MATERIAL_UNDERPAID", `${identity}:${key}`);
  }
  if (successStatus(craft) !== true) return;
  for (const [key, qty] of outputs) {
    const expected = produced.get(key);
    if (expected === undefined) addError(errors, "E_FREE_UPGRADE_OUTPUT", `${identity}:${key}`);
    if (expected !== undefined && qty > expected) addError(errors, "E_OUTPUT_EXCEEDS_RECIPE", `${identity}:${key}`);
  }
}

function validateProgression(record, errors, state) {
  const identity = recordId(record);
  const profession = normalized(firstValue(record, [["profession"], ["professionId"], ["profession_id"], ["skill"], ["skillId"], ["skill_id"]]));
  const xp = numberValue(firstValue(record, [["professionXp"], ["profession_xp"], ["xpDelta"], ["xp_delta"], ["experience"], ["experienceDelta"], ["experience_delta"]]));
  const unlock = firstValue(record, [["unlock"], ["unlockId"], ["unlock_id"], ["recipeUnlock"], ["skillUnlock"], ["recipeId"], ["skillId"]]);
  const text = normalized(firstValue(record, [["type"], ["kind"], ["eventType"], ["event_type"], ["action"]])) ?? "";

  if (profession && CRAFT_PROFESSIONS.has(profession)) {
    if (xp === undefined || xp <= 0) addError(errors, "E_PROFESSION_XP_INVALID", identity);
    if (!hasNonEmpty(firstValue(record, [["source"], ["sourceId"], ["craftId"], ["craft_id"], ["jobId"], ["job_id"], ["settlementId"], ["settlement_id"]]))) {
      addError(errors, "E_PROFESSION_XP_SOURCE_MISSING", identity);
    }
    countCode(state.professions, profession);
  }

  if (unlock !== undefined || /unlock|解锁/.test(text)) {
    if (!hasUnlockCost(record)) addError(errors, "E_UNLOCK_COST_MISSING", identity);
    const free = findAll(record, (entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const key = normalized(firstValue(entry, [["cost"], ["amount"], ["quantity"], ["value"]]));
      return key !== undefined && ZERO_OR_FREE.test(key);
    });
    if (free.length > 0) addError(errors, "E_UNLOCK_COST_FREE", identity);
  }
}

function summarize(inputBatches) {
  const parseErrors = inputBatches.flatMap((batch) => batch.parseErrors.map((entry) => ({ ...entry, inputHash: shortHash(batch.path) })));
  const secretState = { secretCount: 0 };
  const { all, recipes, crafts, progressions } = collectByRole(inputBatches);
  all.forEach((record) => scanForSecrets(record, secretState));

  const errors = [];
  parseErrors.slice(0, MAX_PARSE_ERRORS).forEach((entry) => addError(errors, "E_PARSE", `${entry.inputHash}:${entry.line}`));
  if (secretState.secretCount > 0) addError(errors, "E_SECRET_INPUT", `secret-count:${secretState.secretCount}`, { count: secretState.secretCount });
  if (crafts.length === 0) addError(errors, "E_CRAFT_RECORDS_MISSING", "crafts");
  if (recipes.length === 0) addError(errors, "E_RECIPE_RECORDS_MISSING", "recipes");

  const recipeErrors = [];
  const recipeIndex = buildRecipeIndex(recipes, recipeErrors);
  errors.push(...recipeErrors);

  const state = {
    idempotencyKeys: new Map(),
    claims: new Set(),
    assets: new Set(),
    professions: new Map(),
  };
  crafts.forEach((craft) => validateCraft(craft, recipeIndex, errors, state));
  progressions.forEach((record) => validateProgression(record, errors, state));

  const counts = new Map();
  errors.forEach((entry) => countCode(counts, entry.code));
  const limitedErrors = errors.slice(0, MAX_ERRORS).map((entry) => ({
    code: entry.code,
    hash: entry.hash,
    ...(entry.details ? { details: entry.details } : {}),
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    ok: errors.length === 0,
    metrics: {
      inputs: inputBatches.length,
      records: all.length,
      recipes: recipes.length,
      recipeVersions: recipeIndex.size,
      crafts: crafts.length,
      progressionRecords: progressions.length,
      idempotencyKeys: state.idempotencyKeys.size,
      claims: state.claims.size,
      assets: state.assets.size,
      professions: Object.fromEntries([...state.professions.entries()].sort()),
      parseErrors: parseErrors.length,
      secretFindings: secretState.secretCount,
      errors: errors.length,
    },
    hashes: {
      inputs: inputBatches.map((batch) => shortHash(batch.path)).sort().slice(0, MAX_HASHES),
      recipes: recipes.map((record) => shortHash(recordId(record))).sort().slice(0, MAX_HASHES),
      crafts: crafts.map((record) => shortHash(recordId(record))).sort().slice(0, MAX_HASHES),
      progressions: progressions.map((record) => shortHash(recordId(record))).sort().slice(0, MAX_HASHES),
    },
    errorCodes: [...counts.keys()].sort(),
    errorCounts: Object.fromEntries([...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]))),
    errors: limitedErrors,
    truncatedErrors: Math.max(0, errors.length - limitedErrors.length),
  };
}

function readInputs(options) {
  return options.inputs.map((entry) => {
    const realPath = repoInputPath(entry.path);
    const input = fs.readFileSync(realPath, "utf8");
    const parsed = parseRecords(input);
    return {
      role: entry.role,
      path: realPath,
      records: parsed.records,
      parseErrors: parsed.parseErrors,
    };
  });
}

function printAndExit(summary) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = summary.ok ? 0 : 1;
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    printAndExit(summarize(readInputs(options)));
  } catch (errorValue) {
    const code = errorValue && typeof errorValue === "object" && errorValue.code ? String(errorValue.code) : "E_RUNTIME";
    printAndExit({
      schemaVersion: SCHEMA_VERSION,
      ok: false,
      metrics: { inputs: options?.inputs?.length ?? 0, records: 0, errors: 1 },
      hashes: { inputs: [], recipes: [], crafts: [], progressions: [] },
      errorCodes: [code],
      errorCounts: { [code]: 1 },
      errors: [{ code, hash: shortHash(code) }],
      truncatedErrors: 0,
    });
  }
}

main();
