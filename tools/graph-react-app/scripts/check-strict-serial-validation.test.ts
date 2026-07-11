import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  STRICT_SERIAL_SCOPE_MARKERS,
  assertSpecSectionScopeMarkers,
  checkStrictSerialValidationFile,
  formatStrictSerialValidationAuditOutput,
  validateSpecSectionScopeMarkers,
} from "./check-strict-serial-validation";

const specMarkdown = readFileSync(
  new URL("../../../docs/superpowers/specs/2026-06-23-agent-explorer-shared-world-spec.md", import.meta.url),
  "utf8",
);

test("strict serial validation enforces MVP scope markers for every section 31 S item", () => {
  const result = validateSpecSectionScopeMarkers(specMarkdown);
  assert.deepEqual(STRICT_SERIAL_SCOPE_MARKERS, ["MVP 必做", "MVP 简版", "后续增强"]);
  assert.equal(result.sNumberCount, 100);
  assert.equal(result.failures.length, 0);
  assert.ok(result.sNumbers.includes("S020"));
  assert.doesNotThrow(() => assertSpecSectionScopeMarkers(specMarkdown));
});

test("strict serial audit output reports scope marker failures", () => {
  const result = checkStrictSerialValidationFile();
  assert.equal(result.scopeMarkers.failures.length, 0);
  assert.match(formatStrictSerialValidationAuditOutput(result), /scope_marker_failures=0/);
});
