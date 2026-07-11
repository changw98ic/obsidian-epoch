import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STRICT_SERIAL_REQUIRED_FIELDS = ["当前基线", "攻击", "判定", "立即处置"] as const;
export const STRICT_SERIAL_EXPECTED_ROUND_COUNT = 100 as const;
export const STRICT_SERIAL_COMPLETION_MARKERS = [
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
] as const;
export const STRICT_SERIAL_SCOPE_MARKERS = ["MVP 必做", "MVP 简版", "后续增强"] as const;

export type StrictSerialRequiredField = typeof STRICT_SERIAL_REQUIRED_FIELDS[number];
export type StrictSerialCompletionMarker = typeof STRICT_SERIAL_COMPLETION_MARKERS[number];
export type StrictSerialScopeMarker = typeof STRICT_SERIAL_SCOPE_MARKERS[number];
export type StrictSerialCompletionMarkerDocument = "strict_report" | "spec_section_31";

export interface StrictSerialRoundBlock {
  readonly round: string;
  readonly heading: string;
  readonly body: string;
}

export interface StrictSerialRoundFieldFailure {
  readonly round: string;
  readonly heading: string;
  readonly missingFields: readonly StrictSerialRequiredField[];
}

export interface StrictSerialRoundFieldValidationResult {
  readonly requiredFields: readonly StrictSerialRequiredField[];
  readonly roundCount: number;
  readonly failures: readonly StrictSerialRoundFieldFailure[];
}

export interface StrictSerialRoundNumberingResult {
  readonly expectedRoundCount: typeof STRICT_SERIAL_EXPECTED_ROUND_COUNT;
  readonly roundNumbers: readonly string[];
  readonly roundCount: number;
  readonly hasRound001: boolean;
  readonly hasRound100: boolean;
  readonly failures: readonly string[];
}

export interface StrictSerialSNumberConsistencyResult {
  readonly strictSNumbers: readonly string[];
  readonly specSNumbers: readonly string[];
  readonly strictSNumberCount: number;
  readonly specSNumberCount: number;
  readonly missingInSpec: readonly string[];
  readonly missingInStrict: readonly string[];
}

export interface StrictSerialCompletionMarkerFinding {
  readonly document: StrictSerialCompletionMarkerDocument;
  readonly marker: StrictSerialCompletionMarker;
  readonly line: number;
  readonly text: string;
}

export interface StrictSerialCompletionMarkerValidationResult {
  readonly markers: readonly StrictSerialCompletionMarker[];
  readonly findingCount: number;
  readonly findings: readonly StrictSerialCompletionMarkerFinding[];
}

export interface StrictSerialSpecSBlock {
  readonly sNumber: string;
  readonly heading: string;
  readonly body: string;
}

export interface StrictSerialScopeMarkerFailure {
  readonly sNumber: string;
  readonly heading: string;
}

export interface StrictSerialScopeMarkerValidationResult {
  readonly markers: readonly StrictSerialScopeMarker[];
  readonly sNumbers: readonly string[];
  readonly sNumberCount: number;
  readonly failures: readonly StrictSerialScopeMarkerFailure[];
}

export interface StrictSerialValidationFileCheckResult {
  readonly roundFields: StrictSerialRoundFieldValidationResult;
  readonly roundNumbering: StrictSerialRoundNumberingResult;
  readonly sNumbers: StrictSerialSNumberConsistencyResult;
  readonly completionMarkers: StrictSerialCompletionMarkerValidationResult;
  readonly scopeMarkers: StrictSerialScopeMarkerValidationResult;
}

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
export const DEFAULT_STRICT_SERIAL_VALIDATION_PATH = path.resolve(
  SCRIPT_DIR,
  "../../../docs/superpowers/specs/2026-06-23-agent-explorer-shared-world-strict-serial-validation.md",
);
export const DEFAULT_SHARED_WORLD_SPEC_PATH = path.resolve(
  SCRIPT_DIR,
  "../../../docs/superpowers/specs/2026-06-23-agent-explorer-shared-world-spec.md",
);

function roundBlocks(markdown: string): StrictSerialRoundBlock[] {
  const matches = [...markdown.matchAll(/^### Round (\d{3})\b[^\n]*$/gm)];
  return matches.map((match, index) => {
    const heading = match[0];
    const start = (match.index ?? 0) + heading.length;
    const next = matches[index + 1];
    const end = next?.index ?? markdown.length;
    return {
      round: match[1] ?? "000",
      heading,
      body: markdown.slice(start, end),
    };
  });
}

function fieldPattern(field: StrictSerialRequiredField) {
  return new RegExp(`^\\s*-\\s*${field}：`, "m");
}

export function validateStrictSerialRoundFields(markdown: string): StrictSerialRoundFieldValidationResult {
  const rounds = roundBlocks(markdown);
  const failures = rounds
    .map((round) => ({
      round: round.round,
      heading: round.heading,
      missingFields: STRICT_SERIAL_REQUIRED_FIELDS.filter((field) => !fieldPattern(field).test(round.body)),
    }))
    .filter((failure) => failure.missingFields.length > 0);

  return {
    requiredFields: STRICT_SERIAL_REQUIRED_FIELDS,
    roundCount: rounds.length,
    failures,
  };
}

export function assertStrictSerialRoundFields(markdown: string): StrictSerialRoundFieldValidationResult {
  const result = validateStrictSerialRoundFields(markdown);
  if (result.roundCount === 0) {
    throw new Error("strict_serial_rounds_missing");
  }
  if (result.failures.length > 0) {
    throw new Error(`strict_serial_round_fields_missing:${result.failures
      .map((failure) => `${failure.round}:${failure.missingFields.join(",")}`)
      .join(";")}`);
  }
  return result;
}

export function validateStrictSerialRoundNumbering(markdown: string): StrictSerialRoundNumberingResult {
  const roundNumbers = roundBlocks(markdown).map((round) => round.round);
  const roundNumberSet = new Set(roundNumbers);
  const failures: string[] = [];
  if (roundNumbers.length !== STRICT_SERIAL_EXPECTED_ROUND_COUNT) {
    failures.push(`round_count_mismatch:${roundNumbers.length}`);
  }
  if (!roundNumberSet.has("001")) failures.push("round_001_missing");
  if (!roundNumberSet.has("100")) failures.push("round_100_missing");
  return {
    expectedRoundCount: STRICT_SERIAL_EXPECTED_ROUND_COUNT,
    roundNumbers,
    roundCount: roundNumbers.length,
    hasRound001: roundNumberSet.has("001"),
    hasRound100: roundNumberSet.has("100"),
    failures,
  };
}

export function assertStrictSerialRoundNumbering(markdown: string): StrictSerialRoundNumberingResult {
  const result = validateStrictSerialRoundNumbering(markdown);
  if (result.failures.length > 0) {
    throw new Error(`strict_serial_round_numbering_invalid:${result.failures.join(";")}`);
  }
  return result;
}

function uniqueSortedSNumbers(values: Iterable<string>) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function strictSNumbers(markdown: string) {
  return uniqueSortedSNumbers(markdown.match(/S\d{3}/g) || []);
}

function specSection31(markdown: string) {
  const sectionStart = markdown.search(/^## 31\./m);
  if (sectionStart < 0) return "";
  const afterStart = markdown.slice(sectionStart + 1);
  const nextSectionMatch = afterStart.match(/\n## (?!31\.)/);
  const sectionEnd = nextSectionMatch?.index === undefined
    ? markdown.length
    : sectionStart + 1 + nextSectionMatch.index;
  return markdown.slice(sectionStart, sectionEnd);
}

function specSectionSBlocks(markdown: string): StrictSerialSpecSBlock[] {
  const section = specSection31(markdown);
  const matches = [...section.matchAll(/^#### (S\d{3})\b[^\n]*$/gm)];
  return matches.map((match, index) => {
    const heading = match[0];
    const start = (match.index ?? 0) + heading.length;
    const next = matches[index + 1];
    const end = next?.index ?? section.length;
    return {
      sNumber: match[1] ?? "S000",
      heading,
      body: section.slice(start, end),
    };
  });
}

function specSectionSNumbers(markdown: string) {
  return uniqueSortedSNumbers(specSectionSBlocks(markdown).map((block) => block.sNumber));
}

export function validateStrictSerialSNumberConsistency(
  strictMarkdown: string,
  specMarkdown: string,
): StrictSerialSNumberConsistencyResult {
  const strictNumbers = strictSNumbers(strictMarkdown);
  const specNumbers = specSectionSNumbers(specMarkdown);
  const strictNumberSet = new Set(strictNumbers);
  const specNumberSet = new Set(specNumbers);
  return {
    strictSNumbers: strictNumbers,
    specSNumbers: specNumbers,
    strictSNumberCount: strictNumbers.length,
    specSNumberCount: specNumbers.length,
    missingInSpec: strictNumbers.filter((number) => !specNumberSet.has(number)),
    missingInStrict: specNumbers.filter((number) => !strictNumberSet.has(number)),
  };
}

export function assertStrictSerialSNumberConsistency(
  strictMarkdown: string,
  specMarkdown: string,
): StrictSerialSNumberConsistencyResult {
  const result = validateStrictSerialSNumberConsistency(strictMarkdown, specMarkdown);
  if (result.missingInSpec.length > 0 || result.missingInStrict.length > 0) {
    throw new Error(`strict_serial_s_numbers_mismatch:missing_in_spec=${
      result.missingInSpec.length ? result.missingInSpec.join(",") : "none"
    };missing_in_strict=${result.missingInStrict.length ? result.missingInStrict.join(",") : "none"}`);
  }
  return result;
}

function completionMarkerPattern(marker: StrictSerialCompletionMarker) {
  if (/^[A-Z]+$/.test(marker)) {
    return new RegExp(`\\b${marker}\\b`);
  }
  if (marker === "placeholder" || marker === "not implemented") {
    return new RegExp(marker, "i");
  }
  return new RegExp(marker);
}

function completionMarkerFindings(
  document: StrictSerialCompletionMarkerDocument,
  markdown: string,
): StrictSerialCompletionMarkerFinding[] {
  return markdown.split(/\r?\n/).flatMap((line, index) => {
    const lineNumber = index + 1;
    return STRICT_SERIAL_COMPLETION_MARKERS
      .filter((marker) => completionMarkerPattern(marker).test(line))
      .map((marker) => ({
        document,
        marker,
        line: lineNumber,
        text: line.trim(),
      }));
  });
}

export function validateStrictSerialCompletionMarkers(
  strictMarkdown: string,
  specMarkdown: string,
): StrictSerialCompletionMarkerValidationResult {
  const findings = [
    ...completionMarkerFindings("strict_report", strictMarkdown),
    ...completionMarkerFindings("spec_section_31", specSection31(specMarkdown)),
  ];
  return {
    markers: STRICT_SERIAL_COMPLETION_MARKERS,
    findingCount: findings.length,
    findings,
  };
}

export function assertStrictSerialCompletionMarkers(
  strictMarkdown: string,
  specMarkdown: string,
): StrictSerialCompletionMarkerValidationResult {
  const result = validateStrictSerialCompletionMarkers(strictMarkdown, specMarkdown);
  if (result.findings.length > 0) {
    throw new Error(`strict_serial_completion_markers_found:${result.findings
      .map((finding) => `${finding.document}:${finding.marker}:${finding.line}`)
      .join(";")}`);
  }
  return result;
}

export function validateSpecSectionScopeMarkers(specMarkdown: string): StrictSerialScopeMarkerValidationResult {
  const blocks = specSectionSBlocks(specMarkdown);
  const failures = blocks
    .filter((block) => !STRICT_SERIAL_SCOPE_MARKERS.some((marker) => block.body.includes(marker)))
    .map((block) => ({
      sNumber: block.sNumber,
      heading: block.heading,
    }));
  return {
    markers: STRICT_SERIAL_SCOPE_MARKERS,
    sNumbers: blocks.map((block) => block.sNumber),
    sNumberCount: blocks.length,
    failures,
  };
}

export function assertSpecSectionScopeMarkers(specMarkdown: string): StrictSerialScopeMarkerValidationResult {
  const result = validateSpecSectionScopeMarkers(specMarkdown);
  if (result.sNumberCount === 0) {
    throw new Error("strict_serial_scope_marker_s_numbers_missing");
  }
  if (result.failures.length > 0) {
    throw new Error(`strict_serial_scope_markers_missing:${result.failures
      .map((failure) => failure.sNumber)
      .join(",")}`);
  }
  return result;
}

export function checkStrictSerialValidationFile(
  strictReportPath = DEFAULT_STRICT_SERIAL_VALIDATION_PATH,
  sharedWorldSpecPath = DEFAULT_SHARED_WORLD_SPEC_PATH,
): StrictSerialValidationFileCheckResult {
  const strictMarkdown = readFileSync(strictReportPath, "utf8");
  const specMarkdown = readFileSync(sharedWorldSpecPath, "utf8");
  return {
    roundFields: assertStrictSerialRoundFields(strictMarkdown),
    roundNumbering: assertStrictSerialRoundNumbering(strictMarkdown),
    sNumbers: assertStrictSerialSNumberConsistency(strictMarkdown, specMarkdown),
    completionMarkers: assertStrictSerialCompletionMarkers(strictMarkdown, specMarkdown),
    scopeMarkers: assertSpecSectionScopeMarkers(specMarkdown),
  };
}

export function formatStrictSerialValidationAuditOutput(result: StrictSerialValidationFileCheckResult) {
  return [
    "mechanical audit output: strict_serial_validation=pass",
    `rounds=${result.roundNumbering.roundCount}`,
    `expected_rounds=${result.roundNumbering.expectedRoundCount}`,
    `round_001=${result.roundNumbering.hasRound001 ? "present" : "missing"}`,
    `round_100=${result.roundNumbering.hasRound100 ? "present" : "missing"}`,
    `required_fields=${result.roundFields.requiredFields.length}`,
    `round_field_failures=${result.roundFields.failures.length}`,
    `strict_s_numbers=${result.sNumbers.strictSNumberCount}`,
    `spec_s_numbers=${result.sNumbers.specSNumberCount}`,
    `missing_in_spec=${result.sNumbers.missingInSpec.length}`,
    `missing_in_strict=${result.sNumbers.missingInStrict.length}`,
    `unfinished_markers=${result.completionMarkers.findingCount}`,
    `scope_marker_failures=${result.scopeMarkers.failures.length}`,
  ].join("; ");
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const result = checkStrictSerialValidationFile(process.argv[2], process.argv[3]);
  console.log(formatStrictSerialValidationAuditOutput(result));
}
