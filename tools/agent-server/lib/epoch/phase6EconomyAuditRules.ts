export const PHASE6_ECONOMY_AUDIT_RULESET_VERSION = "obsidian-epoch-phase6-economy-audit-v0.1.0" as const;
export const PHASE6_ECONOMY_SNAPSHOT_VERSION = "phase6-economy-snapshot-v1" as const;

const DECIMAL_INTEGER = /^-?(0|[1-9]\d*)$/;

export type Phase6EconomyMinorUnitString = `${bigint}`;

export type Phase6EconomyInventoryBucket =
  | "available"
  | "reserved"
  | "in_transit"
  | "held_in_custody"
  | "equipped"
  | "leased"
  | "seized"
  | "damaged"
  | "consumed"
  | "destroyed";

export type Phase6EconomyEndpointKind = "account" | "system";

export type Phase6EconomyFlowReasonCode =
  | "transfer"
  | "system_mint"
  | "system_burn"
  | "market_fee"
  | "system_fee_burn"
  | "fee_split"
  | "reward_mint"
  | "recovery_mint"
  | "migration_mint"
  | "consumption_burn"
  | "destruction_burn"
  | "tax"
  | "freeze"
  | "unfreeze"
  | "migration_transfer";

export type Phase6EconomyAuditSeverity = "error" | "warning";

export type Phase6EconomyAuditFindingCode =
  | "PHASE6_ECONOMY_INVALID_SNAPSHOT_VERSION"
  | "PHASE6_ECONOMY_INVALID_MINOR_UNIT"
  | "PHASE6_ECONOMY_INVALID_FLOW"
  | "PHASE6_ECONOMY_DUPLICATE_FLOW_ID"
  | "PHASE6_ECONOMY_DUPLICATE_SOURCE"
  | "PHASE6_ECONOMY_FEE_SPLIT_UNBALANCED"
  | "PHASE6_ECONOMY_ACCOUNT_BALANCE_MISMATCH"
  | "PHASE6_ECONOMY_ASSET_CONSERVATION_MISMATCH"
  | "PHASE6_ECONOMY_NEGATIVE_INVENTORY";

export interface Phase6EconomyAuditFinding {
  readonly code: Phase6EconomyAuditFindingCode;
  readonly severity: Phase6EconomyAuditSeverity;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Phase6EconomySnapshotEntry {
  readonly accountRef: string;
  readonly assetKey: string;
  readonly unit: string;
  readonly bucket: Phase6EconomyInventoryBucket;
  readonly quantityMinor: Phase6EconomyMinorUnitString;
}

export interface Phase6EconomySnapshot {
  readonly snapshotVersion: typeof PHASE6_ECONOMY_SNAPSHOT_VERSION;
  readonly snapshotId: string;
  readonly asOfWorldMinute?: number;
  readonly entries: readonly Phase6EconomySnapshotEntry[];
}

export interface Phase6EconomyEndpoint {
  readonly kind: Phase6EconomyEndpointKind;
  readonly ref: string;
  readonly bucket?: Phase6EconomyInventoryBucket;
}

export interface Phase6EconomyFeeSplitEntry {
  readonly splitId: string;
  readonly quantityMinor: Phase6EconomyMinorUnitString;
  readonly recipientAccountRef?: string;
  readonly recipientSystemRef?: string;
  readonly reasonCode: "fee_split" | "system_fee_burn" | "tax";
}

export interface Phase6EconomyResourceFlow {
  readonly flowId: string;
  readonly assetKey: string;
  readonly unit: string;
  readonly quantityMinor: Phase6EconomyMinorUnitString;
  readonly reasonCode: Phase6EconomyFlowReasonCode;
  readonly source: Phase6EconomyEndpoint;
  readonly sink: Phase6EconomyEndpoint;
  readonly sourceRef?: string;
  readonly sinkRef?: string;
  readonly sourceEventIds?: readonly string[];
  readonly feeSplit?: readonly Phase6EconomyFeeSplitEntry[];
}

export interface Phase6EconomyAuditInput {
  readonly previous: Phase6EconomySnapshot;
  readonly next: Phase6EconomySnapshot;
  readonly flows: readonly Phase6EconomyResourceFlow[];
}

export interface Phase6EconomyAssetConservation {
  readonly assetKey: string;
  readonly unit: string;
  readonly openingTotalMinor: Phase6EconomyMinorUnitString;
  readonly closingTotalMinor: Phase6EconomyMinorUnitString;
  readonly systemMintMinor: Phase6EconomyMinorUnitString;
  readonly systemBurnMinor: Phase6EconomyMinorUnitString;
  readonly netSystemDeltaMinor: Phase6EconomyMinorUnitString;
  readonly expectedClosingTotalMinor: Phase6EconomyMinorUnitString;
  readonly unexplainedDeltaMinor: Phase6EconomyMinorUnitString;
  readonly conserved: boolean;
}

export interface Phase6EconomyNegativeInventory {
  readonly accountRef: string;
  readonly assetKey: string;
  readonly unit: string;
  readonly bucket: Phase6EconomyInventoryBucket;
  readonly quantityMinor: Phase6EconomyMinorUnitString;
  readonly source: "computed" | "snapshot";
}

export interface Phase6EconomyDuplicateSource {
  readonly sourceKey: string;
  readonly flowIds: readonly string[];
}

export interface Phase6EconomyAccountBalanceCheck {
  readonly accountRef: string;
  readonly assetKey: string;
  readonly unit: string;
  readonly bucket: Phase6EconomyInventoryBucket;
  readonly openingMinor: Phase6EconomyMinorUnitString;
  readonly flowDeltaMinor: Phase6EconomyMinorUnitString;
  readonly expectedClosingMinor: Phase6EconomyMinorUnitString;
  readonly actualClosingMinor: Phase6EconomyMinorUnitString;
  readonly mismatchMinor: Phase6EconomyMinorUnitString;
}

export interface Phase6EconomyFeeSplitAudit {
  readonly flowId: string;
  readonly feeMinor: Phase6EconomyMinorUnitString;
  readonly accountShareMinor: Phase6EconomyMinorUnitString;
  readonly systemBurnShareMinor: Phase6EconomyMinorUnitString;
  readonly unexplainedShareMinor: Phase6EconomyMinorUnitString;
  readonly balanced: boolean;
}

export interface Phase6EconomyAuditReport {
  readonly rulesetVersion: typeof PHASE6_ECONOMY_AUDIT_RULESET_VERSION;
  readonly previousSnapshotId: string;
  readonly nextSnapshotId: string;
  readonly deterministic: true;
  readonly ok: boolean;
  readonly assets: readonly Phase6EconomyAssetConservation[];
  readonly accountBalances: readonly Phase6EconomyAccountBalanceCheck[];
  readonly feeSplits: readonly Phase6EconomyFeeSplitAudit[];
  readonly duplicateSources: readonly Phase6EconomyDuplicateSource[];
  readonly negativeInventories: readonly Phase6EconomyNegativeInventory[];
  readonly findings: readonly Phase6EconomyAuditFinding[];
}

interface AssetTotals {
  opening: bigint;
  closing: bigint;
  mint: bigint;
  burn: bigint;
}

interface AccountBalance {
  opening: bigint;
  actualClosing: bigint;
  flowDelta: bigint;
}

export function phase6EconomyMinorUnit(value: bigint): Phase6EconomyMinorUnitString {
  return value.toString() as Phase6EconomyMinorUnitString;
}

export function parsePhase6EconomyMinorUnit(value: string): bigint | undefined {
  if (!DECIMAL_INTEGER.test(value)) return undefined;
  return BigInt(value);
}

export function auditPhase6EconomyConservation(input: Phase6EconomyAuditInput): Phase6EconomyAuditReport {
  const findings: Phase6EconomyAuditFinding[] = [];
  const assetTotals = new Map<string, AssetTotals>();
  const accountBalances = new Map<string, AccountBalance>();
  const negativeInventories: Phase6EconomyNegativeInventory[] = [];

  validateSnapshot(input.previous, "previous", findings);
  validateSnapshot(input.next, "next", findings);
  addSnapshot(input.previous, "opening", assetTotals, accountBalances, negativeInventories, findings);
  addSnapshot(input.next, "closing", assetTotals, accountBalances, negativeInventories, findings);

  const seenFlowIds = new Map<string, number>();
  const sourceClaims = new Map<string, string[]>();
  const feeSplits: Phase6EconomyFeeSplitAudit[] = [];

  input.flows.forEach((flow, index) => {
    const path = `flows.${index}`;
    seenFlowIds.set(flow.flowId, (seenFlowIds.get(flow.flowId) || 0) + 1);
    const quantity = parsePositiveMinorUnit(flow.quantityMinor, `${path}.quantityMinor`, findings);
    if (quantity === undefined) return;
    if (!flow.flowId || !flow.assetKey || !flow.unit || !flow.source.ref || !flow.sink.ref) {
      findings.push(finding("PHASE6_ECONOMY_INVALID_FLOW", "resource flow is missing required identity fields", path, "error"));
      return;
    }

    validateFlowReasonShape(flow, path, findings);
    claimSources(flow, sourceClaims);
    applyFlow(flow, quantity, assetTotals, accountBalances);
    const split = auditFeeSplit(flow, quantity, path, findings);
    if (split) feeSplits.push(split);
  });

  for (const [flowId, count] of [...seenFlowIds.entries()].sort(compareEntries)) {
    if (count > 1) {
      findings.push(finding("PHASE6_ECONOMY_DUPLICATE_FLOW_ID", "flowId must be unique within an economy audit", "flows", "error", { flowId, count }));
    }
  }

  const duplicateSources = [...sourceClaims.entries()]
    .filter(([, flowIds]) => flowIds.length > 1)
    .map(([sourceKey, flowIds]) => ({ sourceKey, flowIds: [...flowIds].sort() }));
  duplicateSources.forEach((duplicate) => {
    findings.push(finding("PHASE6_ECONOMY_DUPLICATE_SOURCE", "one source was claimed by multiple resource flows", "flows", "error", duplicate));
  });

  const assets = [...assetTotals.entries()]
    .sort(compareEntries)
    .map(([key, totals]) => assetConservation(key, totals, findings));
  const balances = [...accountBalances.entries()]
    .sort(compareEntries)
    .map(([key, balance]) => accountBalanceCheck(key, balance, findings, negativeInventories));

  const sortedNegativeInventories = negativeInventories.sort((left, right) =>
    left.accountRef.localeCompare(right.accountRef)
    || left.assetKey.localeCompare(right.assetKey)
    || left.unit.localeCompare(right.unit)
    || left.bucket.localeCompare(right.bucket)
    || left.source.localeCompare(right.source));

  return {
    rulesetVersion: PHASE6_ECONOMY_AUDIT_RULESET_VERSION,
    previousSnapshotId: input.previous.snapshotId,
    nextSnapshotId: input.next.snapshotId,
    deterministic: true,
    ok: findings.every((entry) => entry.severity !== "error"),
    assets,
    accountBalances: balances,
    feeSplits: feeSplits.sort((left, right) => left.flowId.localeCompare(right.flowId)),
    duplicateSources,
    negativeInventories: sortedNegativeInventories,
    findings,
  };
}

function validateSnapshot(
  snapshot: Phase6EconomySnapshot,
  path: string,
  findings: Phase6EconomyAuditFinding[],
) {
  if (snapshot.snapshotVersion !== PHASE6_ECONOMY_SNAPSHOT_VERSION) {
    findings.push(finding(
      "PHASE6_ECONOMY_INVALID_SNAPSHOT_VERSION",
      "economy snapshot has an unsupported version",
      `${path}.snapshotVersion`,
      "error",
      { expected: PHASE6_ECONOMY_SNAPSHOT_VERSION, actual: snapshot.snapshotVersion },
    ));
  }
}

function addSnapshot(
  snapshot: Phase6EconomySnapshot,
  side: "opening" | "closing",
  assetTotals: Map<string, AssetTotals>,
  accountBalances: Map<string, AccountBalance>,
  negativeInventories: Phase6EconomyNegativeInventory[],
  findings: Phase6EconomyAuditFinding[],
) {
  snapshot.entries.forEach((entry, index) => {
    const path = `${side === "opening" ? "previous" : "next"}.entries.${index}.quantityMinor`;
    const quantity = parsePhase6EconomyMinorUnit(entry.quantityMinor);
    if (quantity === undefined) {
      findings.push(finding("PHASE6_ECONOMY_INVALID_MINOR_UNIT", "snapshot quantityMinor must be a decimal integer string", path, "error"));
      return;
    }
    const asset = totalsFor(assetTotals, assetKey(entry.assetKey, entry.unit));
    const balance = balanceFor(accountBalances, accountKey(entry.accountRef, entry.assetKey, entry.unit, entry.bucket));
    if (side === "opening") {
      asset.opening += quantity;
      balance.opening += quantity;
    } else {
      asset.closing += quantity;
      balance.actualClosing += quantity;
    }
    if (quantity < 0n) {
      negativeInventories.push({
        accountRef: entry.accountRef,
        assetKey: entry.assetKey,
        unit: entry.unit,
        bucket: entry.bucket,
        quantityMinor: phase6EconomyMinorUnit(quantity),
        source: "snapshot",
      });
    }
  });
}

function applyFlow(
  flow: Phase6EconomyResourceFlow,
  quantity: bigint,
  assetTotals: Map<string, AssetTotals>,
  accountBalances: Map<string, AccountBalance>,
) {
  const totals = totalsFor(assetTotals, assetKey(flow.assetKey, flow.unit));
  if (flow.source.kind === "system" && flow.sink.kind === "account") totals.mint += quantity;
  if (flow.source.kind === "account" && flow.sink.kind === "system") totals.burn += quantity;
  if (flow.source.kind === "account") {
    balanceFor(accountBalances, accountKey(flow.source.ref, flow.assetKey, flow.unit, flow.source.bucket || "available")).flowDelta -= quantity;
  }
  if (flow.sink.kind === "account") {
    balanceFor(accountBalances, accountKey(flow.sink.ref, flow.assetKey, flow.unit, flow.sink.bucket || "available")).flowDelta += quantity;
  }
}

function validateFlowReasonShape(
  flow: Phase6EconomyResourceFlow,
  path: string,
  findings: Phase6EconomyAuditFinding[],
) {
  if (mintReasonCodes.has(flow.reasonCode) && !(flow.source.kind === "system" && flow.sink.kind === "account")) {
    findings.push(finding("PHASE6_ECONOMY_INVALID_FLOW", "mint reason codes require a system source and account sink", `${path}.reasonCode`, "error", { flowId: flow.flowId, reasonCode: flow.reasonCode }));
  }
  if (burnReasonCodes.has(flow.reasonCode) && !(flow.source.kind === "account" && flow.sink.kind === "system")) {
    findings.push(finding("PHASE6_ECONOMY_INVALID_FLOW", "burn reason codes require an account source and system sink", `${path}.reasonCode`, "error", { flowId: flow.flowId, reasonCode: flow.reasonCode }));
  }
  if (transferReasonCodes.has(flow.reasonCode) && !(flow.source.kind === "account" && flow.sink.kind === "account")) {
    findings.push(finding("PHASE6_ECONOMY_INVALID_FLOW", "transfer reason codes require account source and account sink endpoints", `${path}.reasonCode`, "error", { flowId: flow.flowId, reasonCode: flow.reasonCode }));
  }
}

function auditFeeSplit(
  flow: Phase6EconomyResourceFlow,
  quantity: bigint,
  path: string,
  findings: Phase6EconomyAuditFinding[],
): Phase6EconomyFeeSplitAudit | undefined {
  if (!flow.feeSplit && flow.reasonCode !== "market_fee" && flow.reasonCode !== "fee_split" && flow.reasonCode !== "system_fee_burn") return undefined;
  let accountShare = 0n;
  let systemBurnShare = 0n;
  for (const [index, split] of (flow.feeSplit || []).entries()) {
    const splitQuantity = parsePositiveMinorUnit(split.quantityMinor, `${path}.feeSplit.${index}.quantityMinor`, findings);
    if (splitQuantity === undefined) continue;
    if (split.recipientAccountRef) accountShare += splitQuantity;
    if (split.recipientSystemRef || split.reasonCode === "system_fee_burn") systemBurnShare += splitQuantity;
  }
  const unexplained = quantity - accountShare - systemBurnShare;
  const balanced = unexplained === 0n;
  if (!balanced) {
    findings.push(finding("PHASE6_ECONOMY_FEE_SPLIT_UNBALANCED", "fee split shares must explain the full fee amount", `${path}.feeSplit`, "error", {
      flowId: flow.flowId,
      unexplainedShareMinor: phase6EconomyMinorUnit(unexplained),
    }));
  }
  return {
    flowId: flow.flowId,
    feeMinor: phase6EconomyMinorUnit(quantity),
    accountShareMinor: phase6EconomyMinorUnit(accountShare),
    systemBurnShareMinor: phase6EconomyMinorUnit(systemBurnShare),
    unexplainedShareMinor: phase6EconomyMinorUnit(unexplained),
    balanced,
  };
}

function claimSources(flow: Phase6EconomyResourceFlow, sourceClaims: Map<string, string[]>) {
  const sourceRefs = [
    ...(flow.sourceRef ? [flow.sourceRef] : []),
    ...(flow.sourceEventIds || []),
  ].sort();
  for (const sourceRef of sourceRefs) {
    const key = `${flow.assetKey}:${flow.unit}:${sourceRef}`;
    sourceClaims.set(key, [...(sourceClaims.get(key) || []), flow.flowId]);
  }
}

function assetConservation(
  key: string,
  totals: AssetTotals,
  findings: Phase6EconomyAuditFinding[],
): Phase6EconomyAssetConservation {
  const [assetKeyValue, unit] = splitKey(key);
  const netSystemDelta = totals.mint - totals.burn;
  const expectedClosing = totals.opening + netSystemDelta;
  const unexplainedDelta = totals.closing - expectedClosing;
  const conserved = unexplainedDelta === 0n;
  if (!conserved) {
    findings.push(finding("PHASE6_ECONOMY_ASSET_CONSERVATION_MISMATCH", "asset closing total is not explained by opening total plus system mint/burn", "assets", "error", {
      assetKey: assetKeyValue,
      unit,
      unexplainedDeltaMinor: phase6EconomyMinorUnit(unexplainedDelta),
    }));
  }
  return {
    assetKey: assetKeyValue,
    unit,
    openingTotalMinor: phase6EconomyMinorUnit(totals.opening),
    closingTotalMinor: phase6EconomyMinorUnit(totals.closing),
    systemMintMinor: phase6EconomyMinorUnit(totals.mint),
    systemBurnMinor: phase6EconomyMinorUnit(totals.burn),
    netSystemDeltaMinor: phase6EconomyMinorUnit(netSystemDelta),
    expectedClosingTotalMinor: phase6EconomyMinorUnit(expectedClosing),
    unexplainedDeltaMinor: phase6EconomyMinorUnit(unexplainedDelta),
    conserved,
  };
}

function accountBalanceCheck(
  key: string,
  balance: AccountBalance,
  findings: Phase6EconomyAuditFinding[],
  negativeInventories: Phase6EconomyNegativeInventory[],
): Phase6EconomyAccountBalanceCheck {
  const [accountRef, assetKeyValue, unit, bucket] = splitAccountKey(key);
  const expectedClosing = balance.opening + balance.flowDelta;
  const mismatch = balance.actualClosing - expectedClosing;
  if (mismatch !== 0n) {
    findings.push(finding("PHASE6_ECONOMY_ACCOUNT_BALANCE_MISMATCH", "account bucket closing balance is not explained by opening balance plus resource flows", "accountBalances", "error", {
      accountRef,
      assetKey: assetKeyValue,
      unit,
      bucket,
      mismatchMinor: phase6EconomyMinorUnit(mismatch),
    }));
  }
  if (expectedClosing < 0n) {
    negativeInventories.push({
      accountRef,
      assetKey: assetKeyValue,
      unit,
      bucket,
      quantityMinor: phase6EconomyMinorUnit(expectedClosing),
      source: "computed",
    });
    findings.push(finding("PHASE6_ECONOMY_NEGATIVE_INVENTORY", "resource flows produce a negative account bucket balance", "accountBalances", "error", {
      accountRef,
      assetKey: assetKeyValue,
      unit,
      bucket,
      quantityMinor: phase6EconomyMinorUnit(expectedClosing),
    }));
  }
  return {
    accountRef,
    assetKey: assetKeyValue,
    unit,
    bucket,
    openingMinor: phase6EconomyMinorUnit(balance.opening),
    flowDeltaMinor: phase6EconomyMinorUnit(balance.flowDelta),
    expectedClosingMinor: phase6EconomyMinorUnit(expectedClosing),
    actualClosingMinor: phase6EconomyMinorUnit(balance.actualClosing),
    mismatchMinor: phase6EconomyMinorUnit(mismatch),
  };
}

function parsePositiveMinorUnit(
  value: string,
  path: string,
  findings: Phase6EconomyAuditFinding[],
): bigint | undefined {
  const parsed = parsePhase6EconomyMinorUnit(value);
  if (parsed === undefined || parsed <= 0n) {
    findings.push(finding("PHASE6_ECONOMY_INVALID_MINOR_UNIT", "resource flow quantityMinor must be a positive decimal integer string", path, "error", { value }));
    return undefined;
  }
  return parsed;
}

function totalsFor(map: Map<string, AssetTotals>, key: string): AssetTotals {
  const existing = map.get(key);
  if (existing) return existing;
  const created = { opening: 0n, closing: 0n, mint: 0n, burn: 0n };
  map.set(key, created);
  return created;
}

function balanceFor(map: Map<string, AccountBalance>, key: string): AccountBalance {
  const existing = map.get(key);
  if (existing) return existing;
  const created = { opening: 0n, actualClosing: 0n, flowDelta: 0n };
  map.set(key, created);
  return created;
}

function assetKey(assetKeyValue: string, unit: string): string {
  return `${assetKeyValue}\u0000${unit}`;
}

function accountKey(accountRef: string, assetKeyValue: string, unit: string, bucket: Phase6EconomyInventoryBucket): string {
  return `${accountRef}\u0000${assetKeyValue}\u0000${unit}\u0000${bucket}`;
}

function splitKey(key: string): readonly [string, string] {
  const [assetKeyValue, unit] = key.split("\u0000");
  return [assetKeyValue || "", unit || ""];
}

function splitAccountKey(key: string): readonly [string, string, string, Phase6EconomyInventoryBucket] {
  const [accountRef, assetKeyValue, unit, bucket] = key.split("\u0000");
  return [accountRef || "", assetKeyValue || "", unit || "", (bucket || "available") as Phase6EconomyInventoryBucket];
}

function compareEntries(left: readonly [string, unknown], right: readonly [string, unknown]) {
  return left[0].localeCompare(right[0]);
}

const mintReasonCodes: ReadonlySet<Phase6EconomyFlowReasonCode> = new Set([
  "system_mint",
  "reward_mint",
  "recovery_mint",
  "migration_mint",
]);

const burnReasonCodes: ReadonlySet<Phase6EconomyFlowReasonCode> = new Set([
  "system_burn",
  "system_fee_burn",
  "consumption_burn",
  "destruction_burn",
]);

const transferReasonCodes: ReadonlySet<Phase6EconomyFlowReasonCode> = new Set([
  "transfer",
  "market_fee",
  "fee_split",
  "tax",
  "freeze",
  "unfreeze",
  "migration_transfer",
]);

function finding(
  code: Phase6EconomyAuditFindingCode,
  message: string,
  path: string,
  severity: Phase6EconomyAuditSeverity,
  details?: Readonly<Record<string, unknown>>,
): Phase6EconomyAuditFinding {
  return { code, message, path, severity, ...(details ? { details } : {}) };
}
