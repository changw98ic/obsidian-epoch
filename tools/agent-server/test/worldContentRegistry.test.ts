import assert from "node:assert/strict";
import test from "node:test";

import {
  compileWorldContentRegistry,
  DEFAULT_WORLD_CONTENT_REGISTRY_PATH,
  loadWorldContentRegistry,
  validateWorldContentRegistry,
  worldContentRegistryView,
} from "../lib/epoch/worldContentRegistry.ts";

test("canonical world content compiles into the shipped deterministic registry", () => {
  const compiled = compileWorldContentRegistry();
  const shipped = loadWorldContentRegistry(DEFAULT_WORLD_CONTENT_REGISTRY_PATH);
  assert.deepEqual(shipped, compiled);
  assert.deepEqual(compiled.counts, {
    rules: 21,
    systems: 7,
    species: 30,
    factions: 18,
    layers: 6,
    places: 25,
    routes: 15,
  });
  assert.match(compiled.sourceHash, /^sha256:[0-9a-f]{64}$/u);
  assert.ok(compiled.rules.some((entry) => entry.id === "rule_opportunity_server_adjudication"));
  assert.ok(compiled.systems.some((entry) => entry.id === "system_cultivation"));
  assert.ok(compiled.species.some((entry) => entry.id === "species_ashfolk"));
  assert.ok(compiled.factions.some((entry) => entry.id === "faction_wanji_talisman"));
  assert.ok(compiled.places.some((entry) => entry.id === "region_reflective_city"));
});

test("registry view returns canonical place and route metadata without reading Markdown", () => {
  const registry = loadWorldContentRegistry();
  const result = worldContentRegistryView(registry, {
    collection: "places",
    id: "region_quantum_laboratory",
  });
  assert.equal(result.total, 1);
  const item = result.items[0];
  assert.equal(item?.id, "region_quantum_laboratory");
  assert.ok(item && "canonicalText" in item);
  if (!item || !("canonicalText" in item)) throw new Error("canonical_text_missing");
  assert.match(String(item.canonicalText), /量子实验室/u);
  assert.equal(result.sourceHash, registry.sourceHash);
});

test("registry validation rejects duplicate authority IDs and stale declared counts", () => {
  const registry = loadWorldContentRegistry();
  assert.throws(() => validateWorldContentRegistry({
    ...registry,
    rules: [...registry.rules, registry.rules[0]],
    counts: { ...registry.counts, rules: registry.counts.rules + 1 },
  }), /world_content_duplicate_rules_id/u);
  assert.throws(() => validateWorldContentRegistry({
    ...registry,
    counts: { ...registry.counts, places: registry.counts.places + 1 },
  }), /world_content_count_mismatch:places/u);
  assert.throws(() => validateWorldContentRegistry({
    ...registry,
    rules: [{ ...registry.rules[0], canonicalText: `${registry.rules[0]?.canonicalText}tampered` }, ...registry.rules.slice(1)],
  }), /world_content_content_hash_mismatch/u);
});
