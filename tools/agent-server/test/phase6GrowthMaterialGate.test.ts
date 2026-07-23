import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const gatePath = resolve(repoRoot, "tools/agent-server/phase6-progression-gate.ts");

test("accepts ten authoritative V2 runs with stable growth and dedicated run 8/9 material traces", () => {
  withFixture((root) => {
    const result = runGate(root, validTenRunFixture(), 10);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.ok, true);
    assert.equal(summary.counts.v2Runs, 10);
    assert.equal(summary.counts.materialRunsAccepted, 2);
  });
});

test("rejects low-intellect, medium-willpower, and high-physique direct intensity grants", () => {
  for (const [intensity, attribute] of [["low", "intellect"], ["medium", "willpower"], ["high", "physique"]]) {
    withFixture((root) => {
      const fixture = validTenRunFixture();
      addPermanentAttributeGrowth(fixture[0], intensity, attribute);
      const result = runGate(root, fixture, 10);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      const summary = JSON.parse(result.stdout);
      assert.ok(summary.errorCodes.includes("E_INTENSITY_DIRECT_ATTRIBUTE_MAP"), JSON.stringify(summary));
      assert.ok(summary.errorCodes.includes("E_INTENSITY_GROWTH_SOURCE"), JSON.stringify(summary));
    });
  }
});

test("rejects unchanged growth without a server structured no-change reason", () => {
  withFixture((root) => {
    const fixture = validTenRunFixture();
    delete progressionSection(fixture[1]).noChangeReason;
    const result = runGate(root, fixture, 10);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(JSON.parse(result.stdout).errorCodes.includes("E_STABLE_REASON_REQUIRED"));
  });
});

test("requires event, cost, source material, and before/after hashes for permanent growth", () => {
  withFixture((root) => {
    const fixture = validTenRunFixture();
    addPermanentAttributeGrowth(fixture[0], "low", "strength", { independentSource: true });
    const evidence = progressionSection(fixture[0]).changes[0];
    delete evidence.beforeHash;
    delete evidence.afterHash;
    delete evidence.sourceEventIds;
    delete evidence.costs;
    delete evidence.sourceMaterials;
    const result = runGate(root, fixture, 10);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const codes = JSON.parse(result.stdout).errorCodes;
    for (const code of [
      "E_GROWTH_BEFORE_HASH_MISMATCH",
      "E_GROWTH_AFTER_HASH_MISMATCH",
      "E_GROWTH_EVENT_TRACE_REQUIRED",
      "E_GROWTH_COST_TRACE_REQUIRED",
      "E_GROWTH_SOURCE_MATERIAL_REQUIRED",
    ]) assert.ok(codes.includes(code), `${code}: ${result.stdout}`);
  });
});

test("does not count an ordinary journey reward item as run 8 cultivation material", () => {
  withFixture((root) => {
    const fixture = validTenRunFixture();
    removeMaterial(fixture[7], "cultivation-seed-8");
    fixture[7].runReceipt.snapshots.after.body.economy.warehouse.inventory.items.push({
      itemId: "item-reward-8",
      itemKey: "journey_reward_recording_device",
      kind: "ordinary_reward",
    });
    rehashReceipt(fixture[7]);
    const result = runGate(root, fixture, 10);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const codes = JSON.parse(result.stdout).errorCodes;
    assert.ok(codes.includes("E_RUN8_CULTIVATION_MATERIAL_REQUIRED"), result.stdout);
    assert.ok(codes.includes("E_ORDINARY_REWARD_IS_NOT_ADVANCEMENT_MATERIAL"), result.stdout);
  });
});

test("requires warehouse posting and a traceable later use for dedicated materials", () => {
  withFixture((root) => {
    const fixture = validTenRunFixture();
    fixture[8].runReceipt.snapshots.after.body.economy.warehouse.resources = [];
    const material = fixture[8].runReceipt.snapshots.after.body.economy.materials[0];
    delete material.usageRefs;
    rehashReceipt(fixture[8]);
    const result = runGate(root, fixture, 10);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const codes = JSON.parse(result.stdout).errorCodes;
    assert.ok(codes.includes("E_RUN9_CRAFTING_WAREHOUSE_POSTING_REQUIRED"), result.stdout);
  });
});

test("fails closed on V2 hash or schema omissions", () => {
  withFixture((root) => {
    const tampered = validTenRunFixture();
    tampered[0].runReceipt.snapshots.after.hash = canonicalHash({ tampered: true });
    const tamperResult = runGate(root, tampered, 10);
    assert.equal(tamperResult.status, 1, tamperResult.stdout + tamperResult.stderr);
    assert.ok(JSON.parse(tamperResult.stdout).errorCodes.includes("E_V2_AFTER_HASH_MISMATCH"));

    const missing = validTenRunFixture();
    delete missing[0].runReceipt.snapshots.before.body.progression.skills;
    rehashReceipt(missing[0]);
    const missingResult = runGate(root, missing, 10);
    assert.equal(missingResult.status, 1, missingResult.stdout + missingResult.stderr);
    assert.ok(JSON.parse(missingResult.stdout).errorCodes.includes("E_GROWTH_DOMAIN_SHAPE"));
  });
});

test("allows legacy fixtures only through the explicit fail-closed adapter", () => {
  withFixture((root) => {
    const legacy = {
      adapterVersion: "obsidian-epoch.phase6-progression-fixture-adapter.v1",
      runIndex: 1,
      progressionDelta: {
        before: legacyGrowthSnapshot(),
        after: legacyGrowthSnapshot(),
        stableReason: { code: "canonical_fixture_equal", source: "server" },
      },
    };
    const accepted = runGate(root, [legacy], 1);
    assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);

    const unmarked = structuredClone(legacy);
    delete unmarked.adapterVersion;
    const rejected = runGate(root, [unmarked], 1);
    assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
    assert.ok(JSON.parse(rejected.stdout).errorCodes.includes("E_V2_RECEIPT_OR_EXPLICIT_ADAPTER_REQUIRED"));
  });
});

function validTenRunFixture() {
  return Array.from({ length: 10 }, (_, offset) => makeRun(offset + 1));
}

function makeRun(runIndex) {
  const before = panelBody();
  const after = structuredClone(before);
  const sourceEventId = `event-source-${runIndex}`;
  const settlementEventId = `event-settlement-${runIndex}`;
  if (runIndex === 8) {
    const material = dedicatedMaterial({
      materialId: "cultivation-seed-8",
      materialClass: "cultivation_advancement_material",
      sourceEventId,
      usage: { system: "cultivation_breakthrough", targetRef: "cultivation-stage:2" },
    });
    after.progression.cultivation.resources.materials.push(structuredClone(material));
    after.economy.materials.push(structuredClone(material));
    after.economy.warehouse.resources.push(structuredClone(material));
  }
  if (runIndex === 9) {
    const material = dedicatedMaterial({
      materialId: "star-iron-9",
      materialClass: "forging_material",
      sourceEventId,
      usage: { system: "forging", targetRef: "recipe:phase6-field-blade" },
    });
    after.economy.materials.push(structuredClone(material));
    after.economy.warehouse.resources.push(structuredClone(material));
  }
  const deltas = [{ op: "set", path: ["phase6", "projectionDelta"], eventIds: [sourceEventId, settlementEventId] }];
  const receipt = {
    version: "journey_run_receipt.v2",
    receiptId: `receipt-${runIndex}`,
    runId: `journey-${runIndex}`,
    runIndex,
    authority: { settlement: "server" },
    eventIds: { source: [sourceEventId], settlement: [settlementEventId], derived: [] },
    snapshots: {
      before: { body: before, hash: canonicalHash(before) },
      after: { body: after, hash: canonicalHash(after) },
    },
    deltas,
    integrity: {
      beforeSnapshotHash: canonicalHash(before),
      afterSnapshotHash: canonicalHash(after),
      deltasHash: canonicalHash(deltas),
    },
  };
  return {
    runIndex,
    scenario: {
      intensity: runIndex <= 2 ? "low" : runIndex <= 7 ? "medium" : "high",
      taskType: runIndex === 8 ? "cultivation_material" : runIndex === 9 ? "crafting_material" : "other",
    },
    runReceipt: receipt,
    resultPage: resultPage(receipt.receiptId, [sourceEventId, settlementEventId]),
  };
}

function panelBody() {
  return {
    attributes: { strength: 10, agility: 10, physique: 10, intellect: 10, willpower: 10, spirituality: 10 },
    progression: {
      skills: { advancement: [], definitions: [], learnedNodeIds: [], proficiency: {} },
      talents: [],
      cultivation: {
        functionalStage: { id: "contact", label: "contact", stage: 1, nextStage: 2, bottlenecks: [] },
        resources: { materials: [] },
      },
    },
    economy: {
      materials: [],
      warehouse: { resources: [], inventory: { items: [] } },
    },
  };
}

function dedicatedMaterial({ materialId, materialClass, sourceEventId, usage }) {
  return {
    materialId,
    materialClass,
    quantityMinor: "1",
    sourceEventIds: [sourceEventId],
    usageRefs: [usage],
  };
}

function resultPage(receiptId, events) {
  return {
    payload: {
      receipt: {
        phase6: {
          ok: true,
          verified: true,
          page: {
            deterministic: true,
            receipt: { canonicalEvents: events.map((eventId) => ({ eventId, receiptId })) },
            sections: {
              identityProgression: {
                progression: {
                  mode: "no_change",
                  changes: [],
                  noChangeReason: "canonical_progression_equal",
                  eventIds: events,
                },
              },
              settlement: {
                settlementId: `settlement-${receiptId}`,
                status: "committed",
                eventIds: events,
                economyConservation: { balanced: true },
              },
            },
          },
        },
      },
    },
  };
}

function progressionSection(record) {
  return record.resultPage.payload.receipt.phase6.page.sections.identityProgression.progression;
}

function addPermanentAttributeGrowth(record, intensity, attribute, options = {}) {
  const receipt = record.runReceipt;
  const beforeAttributes = receipt.snapshots.before.body.attributes;
  const afterAttributes = receipt.snapshots.after.body.attributes;
  afterAttributes[attribute] += 1;
  record.scenario.intensity = intensity;
  const eventId = receipt.eventIds.source[0];
  const sourceMaterial = dedicatedMaterial({
    materialId: "training-catalyst-1",
    materialClass: "advancement_material",
    sourceEventId: eventId,
    usage: { system: "cultivation_advancement", targetRef: `attribute:${attribute}` },
  });
  receipt.snapshots.before.body.economy.materials.push(structuredClone(sourceMaterial));
  receipt.snapshots.before.body.economy.warehouse.resources.push(structuredClone(sourceMaterial));
  const section = progressionSection(record);
  section.mode = "changed";
  delete section.noChangeReason;
  section.stableReasons = {
    skills: { code: "canonical_skills_equal", source: "server" },
    talents: { code: "canonical_talents_equal", source: "server" },
    cultivationStage: { code: "canonical_stage_equal", source: "server" },
  };
  section.changes = [{
    domain: "permanentAttributes",
    attribute,
    beforeHash: canonicalHash(beforeAttributes),
    afterHash: canonicalHash(afterAttributes),
    sourceEventIds: [eventId],
    costs: [{ assetKey: "training-catalyst-1", quantityMinor: "1" }],
    sourceMaterials: [{ materialId: "training-catalyst-1", quantityMinor: "1" }],
    source: options.independentSource
      ? { authority: "server", kind: "server_training_event" }
      : { authority: "server", kind: "mission_intensity_reward" },
    grantBasis: options.independentSource ? "verified_training" : "intensity",
  }];
  rehashReceipt(record);
}

function removeMaterial(record, id) {
  const body = record.runReceipt.snapshots.after.body;
  body.progression.cultivation.resources.materials = body.progression.cultivation.resources.materials.filter((item) => item.materialId !== id);
  body.economy.materials = body.economy.materials.filter((item) => item.materialId !== id);
  body.economy.warehouse.resources = body.economy.warehouse.resources.filter((item) => item.materialId !== id);
}

function rehashReceipt(record) {
  const receipt = record.runReceipt;
  receipt.snapshots.before.hash = canonicalHash(receipt.snapshots.before.body);
  receipt.snapshots.after.hash = canonicalHash(receipt.snapshots.after.body);
  receipt.integrity.beforeSnapshotHash = receipt.snapshots.before.hash;
  receipt.integrity.afterSnapshotHash = receipt.snapshots.after.hash;
  receipt.integrity.deltasHash = canonicalHash(receipt.deltas);
}

function legacyGrowthSnapshot() {
  return {
    attributes: { strength: 1 },
    skills: [],
    talents: [],
    cultivation: { functionalStage: { id: "contact", stage: 1 } },
  };
}

function withFixture(fn) {
  const root = mkdtempSync(join(repoRoot, ".phase6-growth-material-gate-"));
  try {
    chmodSync(root, 0o700);
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runGate(root, records, expectedRuns) {
  const inputPath = join(root, `fixture-${crypto.randomBytes(4).toString("hex")}.jsonl`);
  writeFileSync(inputPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  return spawnSync(process.execPath, [
    gatePath,
    "--input", relative(repoRoot, inputPath).split(/[\\/]/).join("/"),
    "--expected-runs", String(expectedRuns),
  ], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function canonicalHash(value) {
  return `sha256:${crypto.createHash("sha256").update(canonicalize(value), "utf8").digest("hex")}`;
}

function canonicalize(value) {
  if (value === undefined || value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}
