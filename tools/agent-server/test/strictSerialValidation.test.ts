import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertStrictSerialRoundFields,
  assertStrictSerialRoundNumbering,
  assertStrictSerialCompletionMarkers,
  assertStrictSerialSNumberConsistency,
  checkStrictSerialValidationFile,
  formatStrictSerialValidationAuditOutput,
  validateStrictSerialCompletionMarkers,
  validateStrictSerialRoundNumbering,
  validateStrictSerialSNumberConsistency,
  validateStrictSerialRoundFields,
} from "../../graph-react-app/scripts/check-strict-serial-validation.ts";

const strictReport = readFileSync(
  new URL("../../../docs/superpowers/specs/2026-06-23-agent-explorer-shared-world-strict-serial-validation.md", import.meta.url),
  "utf8",
);
const sharedWorldSpec = readFileSync(
  new URL("../../../docs/superpowers/specs/2026-06-23-agent-explorer-shared-world-spec.md", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(new URL("../../graph-react-app/package.json", import.meta.url), "utf8")) as {
  scripts: Record<string, string>;
};

test("strict serial validation report has the four required fields in every round", () => {
  const result = validateStrictSerialRoundFields(strictReport);

  assert.equal(result.roundCount, 100);
  assert.deepEqual(result.requiredFields, ["当前基线", "攻击", "判定", "立即处置"]);
  assert.deepEqual(result.failures, []);
});

test("strict serial validation checker reports missing round fields", () => {
  const result = validateStrictSerialRoundFields(`
### Round 001 - TEST / incomplete

- 当前基线：baseline.
- 攻击：attack.
- 判定：FAIL.
`);

  assert.equal(result.roundCount, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].round, "001");
  assert.deepEqual(result.failures[0].missingFields, ["立即处置"]);
  assert.throws(
    () => assertStrictSerialRoundFields(`
### Round 001 - TEST / incomplete

- 当前基线：baseline.
- 攻击：attack.
- 判定：FAIL.
`),
    /strict_serial_round_fields_missing:001:立即处置/,
  );
});

test("strict serial validation report has exactly 100 numbered rounds with boundary rounds", () => {
  const result = validateStrictSerialRoundNumbering(strictReport);

  assert.equal(result.expectedRoundCount, 100);
  assert.equal(result.roundCount, 100);
  assert.equal(result.hasRound001, true);
  assert.equal(result.hasRound100, true);
  assert.deepEqual(result.failures, []);
});

test("strict serial validation checker reports missing boundary rounds", () => {
  const markdown = `
### Round 001 - TEST / first

- 当前基线：baseline.
- 攻击：attack.
- 判定：FAIL.
- 立即处置：S001。first.
`;
  const result = validateStrictSerialRoundNumbering(markdown);

  assert.equal(result.roundCount, 1);
  assert.equal(result.hasRound001, true);
  assert.equal(result.hasRound100, false);
  assert.deepEqual(result.failures, ["round_count_mismatch:1", "round_100_missing"]);
  assert.throws(
    () => assertStrictSerialRoundNumbering(markdown),
    /strict_serial_round_numbering_invalid:round_count_mismatch:1;round_100_missing/,
  );
});

test("strict serial validation S numbers match spec section 31", () => {
  const result = validateStrictSerialSNumberConsistency(strictReport, sharedWorldSpec);

  assert.equal(result.strictSNumberCount, 100);
  assert.equal(result.specSNumberCount, 100);
  assert.deepEqual(result.missingInSpec, []);
  assert.deepEqual(result.missingInStrict, []);
});

test("strict serial validation checker reports S numbers missing from spec section 31", () => {
  const result = validateStrictSerialSNumberConsistency(
    `
### Round 001 - TEST / first

- 当前基线：baseline.
- 攻击：attack.
- 判定：FAIL.
- 立即处置：S001。first.

### Round 002 - TEST / second

- 当前基线：baseline.
- 攻击：attack.
- 判定：FAIL.
- 立即处置：S002。second.
`,
    `
## 31. 严格串行验证逐轮修订

#### S001 First
`,
  );

  assert.deepEqual(result.strictSNumbers, ["S001", "S002"]);
  assert.deepEqual(result.specSNumbers, ["S001"]);
  assert.deepEqual(result.missingInSpec, ["S002"]);
  assert.deepEqual(result.missingInStrict, []);
  assert.throws(
    () => assertStrictSerialSNumberConsistency(
      `
### Round 001 - TEST / first

- 当前基线：baseline.
- 攻击：attack.
- 判定：FAIL.
- 立即处置：S001。first.

### Round 002 - TEST / second

- 当前基线：baseline.
- 攻击：attack.
- 判定：FAIL.
- 立即处置：S002。second.
`,
      `
## 31. 严格串行验证逐轮修订

#### S001 First
`,
    ),
    /strict_serial_s_numbers_mismatch:missing_in_spec=S002;missing_in_strict=none/,
  );
});

test("strict serial validation completion artifacts contain no unfinished marker tokens", () => {
  const result = validateStrictSerialCompletionMarkers(strictReport, sharedWorldSpec);

  assert.equal(result.findingCount, 0);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.markers, [
    "TODO",
    "FIXME",
    "TBD",
    "XXX",
    "待办",
    "待实现",
    "未实现",
    "占位",
    "placeholder",
    "not implemented",
  ]);
});

test("strict serial validation checker reports unfinished marker tokens", () => {
  const result = validateStrictSerialCompletionMarkers(
    `
### Round 001 - TEST / first

- 当前基线：baseline.
- 攻击：attack.
- 判定：TODO remove placeholder before completion.
- 立即处置：S001。first.
`,
    `
## 31. 严格串行验证逐轮修订

#### S001 First

待实现：wire this before completion.
`,
  );

  assert.deepEqual(
    result.findings.map((finding) => `${finding.document}:${finding.marker}:${finding.line}`),
    [
      "strict_report:TODO:6",
      "strict_report:placeholder:6",
      "spec_section_31:待实现:5",
    ],
  );
  assert.throws(
    () => assertStrictSerialCompletionMarkers(
      `
### Round 001 - TEST / first

- 当前基线：baseline.
- 攻击：attack.
- 判定：TODO remove placeholder before completion.
- 立即处置：S001。first.
`,
      `
## 31. 严格串行验证逐轮修订

#### S001 First

待实现：wire this before completion.
`,
    ),
    /strict_serial_completion_markers_found:strict_report:TODO:6;strict_report:placeholder:6;spec_section_31:待实现:5/,
  );
});

test("strict serial validation checker formats a mechanical audit output for completion claims", () => {
  const result = checkStrictSerialValidationFile();

  assert.equal(
    formatStrictSerialValidationAuditOutput(result),
    "mechanical audit output: strict_serial_validation=pass; rounds=100; expected_rounds=100; round_001=present; round_100=present; required_fields=4; round_field_failures=0; strict_s_numbers=100; spec_s_numbers=100; missing_in_spec=0; missing_in_strict=0; unfinished_markers=0; scope_marker_failures=0",
  );
});

test("strict serial validation check runs in the standard typecheck gate", () => {
  assert.match(packageJson.scripts.typecheck, /check:strict-serial-validation/);
  assert.equal(packageJson.scripts["check:strict-serial-validation"], "tsx scripts/check-strict-serial-validation.ts");
});
