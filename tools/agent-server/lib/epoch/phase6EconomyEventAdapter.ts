import type {
  Phase6EconomyEndpoint,
  Phase6EconomyFlowReasonCode,
  Phase6EconomyInventoryBucket,
  Phase6EconomyMinorUnitString,
  Phase6EconomyResourceFlow,
} from "./phase6EconomyAuditRules.ts";

export const PHASE6_ECONOMY_EVENT_ADAPTER_VERSION = "obsidian-epoch-phase6-economy-event-adapter-v0.1.2" as const;

export type Phase6EconomyEventAdapterFindingCode =
  | "PHASE6_ECONOMY_EVENT_UNSUPPORTED"
  | "PHASE6_ECONOMY_EVENT_INVALID_QUANTITY"
  | "PHASE6_ECONOMY_EVENT_MISSING_RESOURCE"
  | "PHASE6_ECONOMY_EVENT_MISSING_ACCOUNT"
  | "PHASE6_ECONOMY_EVENT_MISSING_UNIT"
  | "PHASE6_ECONOMY_EVENT_DUPLICATE_DEDUPE_KEY";

export interface Phase6EconomyEventAdapterFinding {
  readonly code: Phase6EconomyEventAdapterFindingCode;
  readonly message: string;
  readonly path: string;
  readonly sourceEventIds?: readonly string[];
  readonly sourceRef?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Phase6EconomyFlowAdapterRecord {
  readonly flowId: string;
  readonly dedupeKey: string;
  readonly reasonCode: Phase6EconomyFlowReasonCode;
  readonly sourceEventIds: readonly string[];
  readonly sourceRef?: string;
}

export interface Phase6EconomyEventAdapterReport {
  readonly adapterVersion: typeof PHASE6_ECONOMY_EVENT_ADAPTER_VERSION;
  readonly deterministic: true;
  readonly ok: boolean;
  readonly sourceEventCount: number;
  readonly normalizedFlowCount: number;
  readonly unsupportedEventCount: number;
  readonly flowRecords: readonly Phase6EconomyFlowAdapterRecord[];
  readonly duplicateDedupeKeys: readonly {
    readonly dedupeKey: string;
    readonly flowIds: readonly string[];
  }[];
  readonly findings: readonly Phase6EconomyEventAdapterFinding[];
}

export interface Phase6EconomyEventAdapterResult {
  readonly flows: readonly Phase6EconomyResourceFlow[];
  readonly report: Phase6EconomyEventAdapterReport;
}

interface NormalizedFlowDraft {
  readonly assetKey: string;
  readonly unit: string;
  readonly quantityMinor: Phase6EconomyMinorUnitString;
  readonly reasonCode: Phase6EconomyFlowReasonCode;
  readonly source: Phase6EconomyEndpoint;
  readonly sink: Phase6EconomyEndpoint;
  readonly sourceRef?: string;
  readonly sinkRef?: string;
  readonly sourceEventIds: readonly string[];
}

interface DeltaDraft {
  readonly accountRef: string;
  readonly assetKey: string;
  readonly unit: string;
  readonly bucket: Phase6EconomyInventoryBucket;
  readonly quantity: bigint;
  readonly sourceType?: string;
  readonly sinkType?: string;
  readonly sourceRef?: string;
  readonly sinkRef?: string;
  readonly sourceEventIds: readonly string[];
  readonly sourceRefForFlow?: string;
  readonly path: string;
}

const DECIMAL_INTEGER = /^-?(0|[1-9]\d*)$/;
const DEFAULT_BUCKET: Phase6EconomyInventoryBucket = "available";

export function adaptPhase6EconomyEvents(
  events: readonly unknown[],
): Phase6EconomyEventAdapterResult {
  const findings: Phase6EconomyEventAdapterFinding[] = [];
  const drafts: NormalizedFlowDraft[] = [];

  events.forEach((event, index) => {
    const path = `events.${index}`;
    const sourceEventIds = sourceEventIdsFor(event, path);
    const sourceRef = sourceRefFor(event, path);
    const beforeCount = drafts.length;
    normalizeEvent(event, path, sourceEventIds, sourceRef, drafts, findings);

    if (drafts.length === beforeCount && !hasFindingForPath(findings, path) && isEconomyEvent(event)) {
      findings.push({
        code: "PHASE6_ECONOMY_EVENT_UNSUPPORTED",
        message: "event appears to be economy-like but does not match a supported canonical economy shape",
        path,
        sourceEventIds,
        sourceRef,
      });
    }
  });

  const keyed = drafts.map((draft) => {
    const dedupeKey = stableDedupeKey(draft);
    const flow: Phase6EconomyResourceFlow = {
      flowId: `phase6-economy-flow:${stableHash(dedupeKey)}`,
      assetKey: draft.assetKey,
      unit: draft.unit,
      quantityMinor: draft.quantityMinor,
      reasonCode: draft.reasonCode,
      source: draft.source,
      sink: draft.sink,
      sourceRef: draft.sourceRef,
      sinkRef: draft.sinkRef,
      sourceEventIds: draft.sourceEventIds,
    };
    return { flow, dedupeKey };
  });

  const duplicateDedupeKeys = duplicateKeys(keyed);
  duplicateDedupeKeys.forEach((duplicate) => {
    findings.push({
      code: "PHASE6_ECONOMY_EVENT_DUPLICATE_DEDUPE_KEY",
      message: "multiple normalized flows have the same deterministic economy dedupe key",
      path: "flows",
      details: duplicate,
    });
  });

  return {
    flows: keyed.map((entry) => entry.flow),
    report: {
      adapterVersion: PHASE6_ECONOMY_EVENT_ADAPTER_VERSION,
      deterministic: true,
      ok: findings.length === 0,
      sourceEventCount: events.length,
      normalizedFlowCount: keyed.length,
      unsupportedEventCount: findings.filter((finding) => finding.code === "PHASE6_ECONOMY_EVENT_UNSUPPORTED").length,
      flowRecords: keyed.map((entry) => ({
        flowId: entry.flow.flowId,
        dedupeKey: entry.dedupeKey,
        reasonCode: entry.flow.reasonCode,
        sourceEventIds: entry.flow.sourceEventIds || [],
        sourceRef: entry.flow.sourceRef,
      })),
      duplicateDedupeKeys,
      findings,
    },
  };
}

function isEconomyEvent(event: unknown): boolean {
  const record = asRecord(event);
  if (!record) return true;
  const payload = asRecord(record.payload) || record;
  const eventType = (stringField(record, "eventType") || stringField(record, "type") || stringField(payload, "eventType") || stringField(payload, "type") || "").toLowerCase();
  const operation = (stringField(payload, "operation") || "").toLowerCase();
  if (eventType === "resource_granted" || eventType === "resource_spent") return true;
  if (eventType === "item_created") return true;
  if (["purchase", "sell", "craft", "repair"].includes(operation)) return true;
  if (["purchase", "sell", "craft", "repair"].includes(eventType)) return true;
  if (isSingleResourceChange(payload)) return true;
  return ["rewards", "consumption", "consumes", "mints", "burns", "fees", "transfers", "inputs", "outputs", "price", "payments"]
    .some((key) => Array.isArray(payload[key]) && (payload[key] as readonly unknown[]).length > 0);
}

function normalizeEvent(
  event: unknown,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  const record = asRecord(event);
  if (!record) {
    unsupported(path, sourceEventIds, sourceRef, findings, "event is not an object");
    return;
  }

  const payload = asRecord(record.payload) || record;
  const eventType = stringField(record, "eventType") || stringField(record, "type") || stringField(payload, "eventType") || stringField(payload, "type");
  const operation = stringField(payload, "operation") || eventType || "";

  if (Array.isArray(payload.deltas)) {
    normalizeDeltas(payload.deltas, `${path}.payload.deltas`, sourceEventIds, sourceRef, drafts, findings);
    return;
  }
  if (Array.isArray(record.deltas)) {
    normalizeDeltas(record.deltas, `${path}.deltas`, sourceEventIds, sourceRef, drafts, findings);
    return;
  }

  if (eventType === "resource_granted") {
    normalizeGrant(payload, path, sourceEventIds, sourceRef, drafts, findings);
    return;
  }
  if (eventType === "resource_spent") {
    normalizeSpend(payload, path, sourceEventIds, sourceRef, drafts, findings);
    return;
  }
  if (eventType === "item_created") {
    normalizeItemCreated(record, payload, path, sourceEventIds, sourceRef, drafts, findings);
    return;
  }

  if (Array.isArray(payload.rewards)) normalizeSimpleCollection(payload.rewards, `${path}.rewards`, "reward_mint", "mint", sourceEventIds, sourceRef, drafts, findings);
  if (Array.isArray(payload.consumption)) normalizeSimpleCollection(payload.consumption, `${path}.consumption`, "consumption_burn", "burn", sourceEventIds, sourceRef, drafts, findings);
  if (Array.isArray(payload.consumes)) normalizeSimpleCollection(payload.consumes, `${path}.consumes`, "consumption_burn", "burn", sourceEventIds, sourceRef, drafts, findings);
  if (Array.isArray(payload.mints)) normalizeSimpleCollection(payload.mints, `${path}.mints`, "system_mint", "mint", sourceEventIds, sourceRef, drafts, findings);
  if (Array.isArray(payload.burns)) normalizeSimpleCollection(payload.burns, `${path}.burns`, "system_burn", "burn", sourceEventIds, sourceRef, drafts, findings);
  if (Array.isArray(payload.fees)) normalizeSimpleCollection(payload.fees, `${path}.fees`, "market_fee", "fee", sourceEventIds, sourceRef, drafts, findings);
  if (Array.isArray(payload.transfers)) normalizeTransfers(payload.transfers, `${path}.transfers`, sourceEventIds, sourceRef, drafts, findings);

  if (operation === "purchase" || operation === "sell" || operation === "craft" || operation === "repair") {
    normalizeCanonicalOperation(payload, operation, path, sourceEventIds, sourceRef, drafts, findings);
  }

  if (isSingleResourceChange(payload)) {
    normalizeSingleResourceChange(payload, path, sourceEventIds, sourceRef, drafts, findings);
  }
}

function normalizeDeltas(
  values: readonly unknown[],
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  const deltas = values
    .map((value, index) => deltaDraft(value, `${path}.${index}`, sourceEventIds, sourceRef, findings))
    .filter((value): value is DeltaDraft => Boolean(value))
    .sort(compareDeltaDrafts);
  const used = new Set<number>();

  deltas.forEach((debit, debitIndex) => {
    if (used.has(debitIndex) || debit.quantity >= 0n) return;
    const creditIndex = deltas.findIndex((credit, index) =>
      !used.has(index)
      && index !== debitIndex
      && credit.quantity === -debit.quantity
      && credit.assetKey === debit.assetKey
      && credit.unit === debit.unit);
    if (creditIndex < 0) return;
    const credit = deltas[creditIndex];
    used.add(debitIndex);
    used.add(creditIndex);
    drafts.push({
      assetKey: debit.assetKey,
      unit: debit.unit,
      quantityMinor: toMinorUnit(-debit.quantity),
      reasonCode: transferReasonCode(debit, credit),
      source: accountEndpoint(debit.accountRef, debit.bucket),
      sink: accountEndpoint(credit.accountRef, credit.bucket),
      sourceRef: debit.sourceRefForFlow,
      sinkRef: credit.sourceRefForFlow,
      sourceEventIds: sortedUnique([...debit.sourceEventIds, ...credit.sourceEventIds]),
    });
  });

  deltas.forEach((delta, index) => {
    if (used.has(index)) return;
    if (delta.quantity > 0n) {
      drafts.push({
        assetKey: delta.assetKey,
        unit: delta.unit,
        quantityMinor: toMinorUnit(delta.quantity),
        reasonCode: mintReasonCode(delta.sourceType),
        source: systemEndpoint(delta.sourceRef || delta.sourceType || "system:mint"),
        sink: accountEndpoint(delta.accountRef, delta.bucket),
        sourceRef: delta.sourceRefForFlow,
        sourceEventIds: delta.sourceEventIds,
      });
    } else if (delta.quantity < 0n) {
      drafts.push({
        assetKey: delta.assetKey,
        unit: delta.unit,
        quantityMinor: toMinorUnit(-delta.quantity),
        reasonCode: burnReasonCode(delta.sinkType),
        source: accountEndpoint(delta.accountRef, delta.bucket),
        sink: systemEndpoint(delta.sinkRef || delta.sinkType || "system:burn"),
        sourceRef: delta.sourceRefForFlow,
        sourceEventIds: delta.sourceEventIds,
      });
    }
  });
}

function normalizeGrant(
  payload: Readonly<Record<string, unknown>>,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  const draft = resourceDraft(payload, path, sourceEventIds, sourceRef, findings);
  if (!draft) return;
  drafts.push({
    ...draft,
    reasonCode: grantReasonCode(stringField(payload, "reason")),
    source: systemEndpoint("resource_granted"),
    sink: accountEndpoint(accountRef(payload), bucketField(payload)),
  });
}

function normalizeSpend(
  payload: Readonly<Record<string, unknown>>,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  const draft = resourceDraft(payload, path, sourceEventIds, sourceRef, findings);
  if (!draft) return;
  drafts.push({
    ...draft,
    reasonCode: burnReasonCode(stringField(payload, "reason")),
    source: accountEndpoint(accountRef(payload), bucketField(payload)),
    sink: systemEndpoint("resource_spent"),
  });
}

function normalizeItemCreated(
  event: Readonly<Record<string, unknown>>,
  payload: Readonly<Record<string, unknown>>,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  const itemKey = stringField(payload, "itemKey")
    || stringField(payload, "itemId")
    || stringField(event, "aggregateId");
  const agentId = stringField(payload, "agentId") || stringField(event, "agentId");
  if (!itemKey) missingResource(path, sourceEventIds, sourceRef, findings);
  if (!agentId) missingAccount(path, sourceEventIds, sourceRef, findings);
  if (!itemKey || !agentId) return;
  drafts.push({
    assetKey: `item:${itemKey}`,
    unit: "item",
    quantityMinor: "1",
    reasonCode: "system_mint",
    source: systemEndpoint("item_created"),
    sink: accountEndpoint(`agent:${agentId}`, DEFAULT_BUCKET),
    sourceRef,
    sourceEventIds,
  });
}

function normalizeSimpleCollection(
  values: readonly unknown[],
  path: string,
  reasonCode: Phase6EconomyFlowReasonCode,
  direction: "mint" | "burn" | "fee",
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  values.forEach((value, index) => {
    const item = asRecord(value);
    if (!item) {
      unsupported(`${path}.${index}`, sourceEventIds, sourceRef, findings, "resource change entry is not an object");
      return;
    }
    const draft = resourceDraft(item, `${path}.${index}`, sourceEventIds, sourceRef, findings);
    if (!draft) return;
    const account = accountRef(item);
    const recipient = stringField(item, "recipientAccountRef") || stringField(item, "feeAccountRef") || stringField(item, "toAccountRef");
    drafts.push({
      ...draft,
      reasonCode,
      source: direction === "mint" ? systemEndpoint(stringField(item, "sourceRef") || "system:mint") : accountEndpoint(account, bucketField(item)),
      sink: direction === "burn" ? systemEndpoint(stringField(item, "sinkRef") || "system:burn") : accountEndpoint(recipient || account, bucketField(item)),
    });
  });
}

function normalizeTransfers(
  values: readonly unknown[],
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  values.forEach((value, index) => {
    const item = asRecord(value);
    if (!item) {
      unsupported(`${path}.${index}`, sourceEventIds, sourceRef, findings, "transfer entry is not an object");
      return;
    }
    const draft = resourceDraft(item, `${path}.${index}`, sourceEventIds, sourceRef, findings);
    const from = stringField(item, "sourceAccountRef") || stringField(item, "fromAccountRef");
    const to = stringField(item, "sinkAccountRef") || stringField(item, "toAccountRef") || stringField(item, "recipientAccountRef");
    if (!draft || !from || !to) {
      if (!from || !to) missingAccount(`${path}.${index}`, sourceEventIds, sourceRef, findings);
      return;
    }
    drafts.push({
      ...draft,
      reasonCode: "transfer",
      source: accountEndpoint(from, bucketField(item)),
      sink: accountEndpoint(to, bucketField(item, "sinkBucket")),
    });
  });
}

function normalizeCanonicalOperation(
  payload: Readonly<Record<string, unknown>>,
  operation: string,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  if (Array.isArray(payload.inputs)) normalizeSimpleCollection(payload.inputs, `${path}.inputs`, "consumption_burn", "burn", sourceEventIds, sourceRef, drafts, findings);
  if (Array.isArray(payload.outputs)) normalizeSimpleCollection(payload.outputs, `${path}.outputs`, operation === "craft" ? "system_mint" : "reward_mint", "mint", sourceEventIds, sourceRef, drafts, findings);
  if (Array.isArray(payload.price)) normalizeTransfers(payload.price, `${path}.price`, sourceEventIds, sourceRef, drafts, findings);
  if (Array.isArray(payload.payments)) normalizeTransfers(payload.payments, `${path}.payments`, sourceEventIds, sourceRef, drafts, findings);
  normalizeQuotePayment(payload, operation, path, sourceEventIds, sourceRef, drafts, findings);
  normalizeShopInventoryLeg(payload, operation, path, sourceEventIds, sourceRef, drafts, findings);
}

function normalizeQuotePayment(
  payload: Readonly<Record<string, unknown>>,
  operation: string,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  const quote = asRecord(payload.quote);
  if (!quote) return;
  const assetKey = stringField(quote, "priceResourceKey") || stringField(quote, "resourceKey");
  const unit = stringField(quote, "unit");
  const quantity = parseMinorUnit(quote.totalMinor ?? quote.grossMinor);
  const buyer = stringField(payload, "buyerAccountRef") || stringField(payload, "accountRef");
  const merchant = stringField(payload, "merchantAccountRef") || stringField(payload, "sellerAccountRef");
  if (!assetKey || !unit || quantity === undefined || quantity <= 0n || !buyer || !merchant) {
    findings.push({
      code: "PHASE6_ECONOMY_EVENT_UNSUPPORTED",
      message: "shop quote is missing explicit price resource, unit, quantity, buyer, or merchant account",
      path: `${path}.quote`,
      sourceEventIds,
      sourceRef,
    });
    return;
  }
  const from = operation === "sell" ? merchant : buyer;
  const to = operation === "sell" ? buyer : merchant;
  drafts.push({
    assetKey,
    unit,
    quantityMinor: toMinorUnit(quantity),
    reasonCode: "transfer",
    source: accountEndpoint(from, DEFAULT_BUCKET),
    sink: accountEndpoint(to, DEFAULT_BUCKET),
    sourceRef,
    sourceEventIds,
  });

  const fee = parseMinorUnit(quote.feeMinor);
  const feeAccountRef = stringField(payload, "feeAccountRef");
  if (fee && fee > 0n) {
    drafts.push({
      assetKey,
      unit,
      quantityMinor: toMinorUnit(fee),
      reasonCode: "market_fee",
      source: accountEndpoint(from, DEFAULT_BUCKET),
      sink: feeAccountRef ? accountEndpoint(feeAccountRef, DEFAULT_BUCKET) : systemEndpoint("market:fee"),
      sourceRef,
      sourceEventIds,
    });
  }
}

function normalizeShopInventoryLeg(
  payload: Readonly<Record<string, unknown>>,
  operation: string,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  if (operation !== "purchase" && operation !== "sell") return;
  const assetKey = stringField(payload, "itemKey") || stringField(payload, "resourceKey");
  const unit = stringField(payload, "resourceUnit") || stringField(payload, "unit");
  const quantity = parseMinorUnit(payload.quantityMinor ?? payload.quantity);
  const buyer = stringField(payload, "buyerAccountRef") || stringField(payload, "accountRef");
  const merchant = stringField(payload, "merchantAccountRef") || stringField(payload, "sellerAccountRef");
  if (!assetKey && !quantity) return;
  if (!assetKey || !unit || quantity === undefined || quantity <= 0n || !buyer || !merchant) {
    findings.push({
      code: "PHASE6_ECONOMY_EVENT_UNSUPPORTED",
      message: "shop inventory leg is missing explicit item/resource, unit, quantity, buyer, or merchant account",
      path,
      sourceEventIds,
      sourceRef,
    });
    return;
  }
  drafts.push({
    assetKey,
    unit,
    quantityMinor: toMinorUnit(quantity),
    reasonCode: "transfer",
    source: accountEndpoint(operation === "sell" ? buyer : merchant, DEFAULT_BUCKET),
    sink: accountEndpoint(operation === "sell" ? merchant : buyer, DEFAULT_BUCKET),
    sourceRef,
    sourceEventIds,
  });
}

function normalizeSingleResourceChange(
  payload: Readonly<Record<string, unknown>>,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  drafts: NormalizedFlowDraft[],
  findings: Phase6EconomyEventAdapterFinding[],
): void {
  const draft = resourceDraft(payload, path, sourceEventIds, sourceRef, findings);
  if (!draft) return;
  const kind = (stringField(payload, "kind") || stringField(payload, "type") || stringField(payload, "eventType") || "").toLowerCase();
  if (kind.includes("transfer")) {
    const from = stringField(payload, "sourceAccountRef") || stringField(payload, "fromAccountRef");
    const to = stringField(payload, "sinkAccountRef") || stringField(payload, "toAccountRef") || stringField(payload, "recipientAccountRef");
    if (!from || !to) {
      missingAccount(path, sourceEventIds, sourceRef, findings);
      return;
    }
    drafts.push({ ...draft, reasonCode: "transfer", source: accountEndpoint(from, bucketField(payload)), sink: accountEndpoint(to, bucketField(payload, "sinkBucket")) });
    return;
  }
  if (kind.includes("fee")) {
    drafts.push({ ...draft, reasonCode: "market_fee", source: accountEndpoint(accountRef(payload), bucketField(payload)), sink: accountEndpoint(stringField(payload, "feeAccountRef") || accountRef(payload), bucketField(payload)) });
    return;
  }
  if (kind.includes("reward") || kind.includes("mint") || kind.includes("grant")) {
    drafts.push({ ...draft, reasonCode: kind.includes("reward") ? "reward_mint" : "system_mint", source: systemEndpoint(stringField(payload, "sourceRef") || "system:mint"), sink: accountEndpoint(accountRef(payload), bucketField(payload)) });
    return;
  }
  if (kind.includes("consume") || kind.includes("spend") || kind.includes("burn")) {
    drafts.push({ ...draft, reasonCode: kind.includes("consume") ? "consumption_burn" : "system_burn", source: accountEndpoint(accountRef(payload), bucketField(payload)), sink: systemEndpoint(stringField(payload, "sinkRef") || "system:burn") });
  }
}

function deltaDraft(
  value: unknown,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  findings: Phase6EconomyEventAdapterFinding[],
): DeltaDraft | undefined {
  const record = asRecord(value);
  if (!record) {
    unsupported(path, sourceEventIds, sourceRef, findings, "delta entry is not an object");
    return undefined;
  }
  const account = accountRef(record);
  const assetKey = assetKeyField(record);
  const unit = stringField(record, "unit");
  const quantity = minorUnitField(record, findings, path, sourceEventIds, sourceRef);
  if (!account) missingAccount(path, sourceEventIds, sourceRef, findings);
  if (!assetKey) missingResource(path, sourceEventIds, sourceRef, findings);
  if (!unit) missingUnit(path, sourceEventIds, sourceRef, findings);
  if (quantity === undefined || !account || !assetKey || !unit) return undefined;
  if (quantity === 0n) {
    findings.push({ code: "PHASE6_ECONOMY_EVENT_INVALID_QUANTITY", message: "zero quantity cannot be normalized into a resource flow", path, sourceEventIds, sourceRef });
    return undefined;
  }
  return {
    accountRef: account,
    assetKey,
    unit,
    bucket: bucketField(record),
    quantity,
    sourceType: stringField(record, "sourceType"),
    sinkType: stringField(record, "sinkType"),
    sourceRef: stringField(record, "sourceRef"),
    sinkRef: stringField(record, "sinkRef"),
    sourceEventIds: sourceEventIdsFromRecord(record, sourceEventIds),
    sourceRefForFlow: sourceRef,
    path,
  };
}

function resourceDraft(
  record: Readonly<Record<string, unknown>>,
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
  findings: Phase6EconomyEventAdapterFinding[],
): Omit<NormalizedFlowDraft, "reasonCode" | "source" | "sink"> | undefined {
  const assetKey = assetKeyField(record);
  const unit = stringField(record, "unit");
  const quantity = minorUnitField(record, findings, path, sourceEventIds, sourceRef);
  if (!assetKey) missingResource(path, sourceEventIds, sourceRef, findings);
  if (!unit) missingUnit(path, sourceEventIds, sourceRef, findings);
  if (quantity === undefined || !assetKey || !unit) return undefined;
  if (quantity <= 0n) {
    findings.push({ code: "PHASE6_ECONOMY_EVENT_INVALID_QUANTITY", message: "resource flow quantity must be a positive minor-unit integer", path, sourceEventIds, sourceRef });
    return undefined;
  }
  return {
    assetKey,
    unit,
    quantityMinor: toMinorUnit(quantity),
    sourceRef,
    sourceEventIds: sourceEventIdsFromRecord(record, sourceEventIds),
  };
}

function sourceEventIdsFor(value: unknown, fallback: string): readonly string[] {
  const record = asRecord(value);
  if (!record) return [fallback];
  return sourceEventIdsFromRecord(record, stringField(record, "eventId") ? [stringField(record, "eventId") as string] : [fallback]);
}

function sourceEventIdsFromRecord(record: Readonly<Record<string, unknown>>, fallback: readonly string[]): readonly string[] {
  const raw = record.sourceEventIds;
  if (Array.isArray(raw)) {
    const ids = raw.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
    if (ids.length > 0) return sortedUnique(ids);
  }
  const sourceEventId = stringField(record, "sourceEventId");
  if (sourceEventId) return [sourceEventId];
  return fallback;
}

function sourceRefFor(value: unknown, fallback: string): string {
  const record = asRecord(value);
  if (!record) return fallback;
  return stringField(record, "sourceRef")
    || stringField(record, "idempotencyKey")
    || stringField(record, "causationId")
    || stringField(record, "correlationId")
    || stringField(record, "actionId")
    || stringField(record, "eventId")
    || fallback;
}

function isSingleResourceChange(payload: Readonly<Record<string, unknown>>): boolean {
  return Boolean(assetKeyField(payload) && (payload.quantityMinor !== undefined || payload.quantity !== undefined || payload.amount !== undefined));
}

function accountRef(record: Readonly<Record<string, unknown>>): string {
  return stringField(record, "accountRef")
    || stringField(record, "actorAccountRef")
    || stringField(record, "ownerAccountRef")
    || stringField(record, "agentId")
    || stringField(record, "actorExplorerId")
    || "";
}

function assetKeyField(record: Readonly<Record<string, unknown>>): string {
  return stringField(record, "assetKey")
    || stringField(record, "resourceKey")
    || stringField(record, "resourceId")
    || stringField(record, "priceResourceKey")
    || "";
}

function bucketField(record: Readonly<Record<string, unknown>>, field = "bucket"): Phase6EconomyInventoryBucket {
  const value = stringField(record, field);
  return isBucket(value) ? value : DEFAULT_BUCKET;
}

function minorUnitField(
  record: Readonly<Record<string, unknown>>,
  findings: Phase6EconomyEventAdapterFinding[],
  path: string,
  sourceEventIds: readonly string[],
  sourceRef: string,
): bigint | undefined {
  const raw = record.quantityMinor ?? record.quantity ?? record.amount ?? record.feeMinor ?? record.totalMinor;
  const parsed = parseMinorUnit(raw);
  if (parsed === undefined) {
    findings.push({ code: "PHASE6_ECONOMY_EVENT_INVALID_QUANTITY", message: "quantity must be an exact integer minor-unit value", path, sourceEventIds, sourceRef, details: { value: raw } });
  }
  return parsed;
}

function parseMinorUnit(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && DECIMAL_INTEGER.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  return undefined;
}

function toMinorUnit(value: bigint): Phase6EconomyMinorUnitString {
  return value.toString() as Phase6EconomyMinorUnitString;
}

function transferReasonCode(debit: DeltaDraft, credit: DeltaDraft): Phase6EconomyFlowReasonCode {
  if (debit.sinkType === "migration" || credit.sourceType === "migration") return "migration_transfer";
  if (debit.sinkType === "market_fee" || credit.sourceType === "market_fee") return "market_fee";
  if (debit.sinkType === "tax" || credit.sourceType === "tax") return "tax";
  return "transfer";
}

function mintReasonCode(sourceType?: string): Phase6EconomyFlowReasonCode {
  if (sourceType === "recovery") return "recovery_mint";
  if (sourceType === "migration") return "migration_mint";
  if (sourceType === "system_mint") return "system_mint";
  return "reward_mint";
}

function grantReasonCode(reason?: string): Phase6EconomyFlowReasonCode {
  const normalized = (reason || "").toLowerCase();
  if (normalized.includes("recovery")) return "recovery_mint";
  if (normalized.includes("migration")) return "migration_mint";
  if (normalized.includes("system")) return "system_mint";
  return "reward_mint";
}

function burnReasonCode(sinkType?: string): Phase6EconomyFlowReasonCode {
  if (sinkType === "market_fee") return "market_fee";
  if (sinkType === "tax") return "tax";
  if (sinkType === "freeze") return "freeze";
  if (sinkType === "destruction" || sinkType === "wear") return "destruction_burn";
  if (sinkType === "consumption" || sinkType === "crafting" || sinkType === "repair") return "consumption_burn";
  return "system_burn";
}

function accountEndpoint(ref: string, bucket: Phase6EconomyInventoryBucket): Phase6EconomyEndpoint {
  return { kind: "account", ref, bucket };
}

function systemEndpoint(ref: string): Phase6EconomyEndpoint {
  return { kind: "system", ref };
}

function stableDedupeKey(flow: NormalizedFlowDraft): string {
  return stableStringify({
    assetKey: flow.assetKey,
    quantityMinor: flow.quantityMinor,
    reasonCode: flow.reasonCode,
    sink: flow.sink,
    sinkRef: flow.sinkRef,
    source: flow.source,
    sourceEventIds: flow.sourceEventIds,
    sourceRef: flow.sourceRef,
    unit: flow.unit,
  });
}

function duplicateKeys(entries: readonly { readonly flow: Phase6EconomyResourceFlow; readonly dedupeKey: string }[]): readonly { readonly dedupeKey: string; readonly flowIds: readonly string[] }[] {
  const grouped = new Map<string, string[]>();
  entries.forEach((entry) => {
    const group = grouped.get(entry.dedupeKey) || [];
    group.push(entry.flow.flowId);
    grouped.set(entry.dedupeKey, group);
  });
  return [...grouped.entries()]
    .filter(([, flowIds]) => flowIds.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dedupeKey, flowIds]) => ({ dedupeKey, flowIds: [...flowIds].sort() }));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function compareDeltaDrafts(left: DeltaDraft, right: DeltaDraft): number {
  return left.assetKey.localeCompare(right.assetKey)
    || left.unit.localeCompare(right.unit)
    || left.quantity.toString().localeCompare(right.quantity.toString())
    || left.accountRef.localeCompare(right.accountRef)
    || left.path.localeCompare(right.path);
}

function hasFindingForPath(findings: readonly Phase6EconomyEventAdapterFinding[], path: string): boolean {
  return findings.some((finding) => finding.path === path || finding.path.startsWith(`${path}.`));
}

function missingAccount(path: string, sourceEventIds: readonly string[], sourceRef: string, findings: Phase6EconomyEventAdapterFinding[]): void {
  findings.push({ code: "PHASE6_ECONOMY_EVENT_MISSING_ACCOUNT", message: "economy event is missing an explicit account reference", path, sourceEventIds, sourceRef });
}

function missingResource(path: string, sourceEventIds: readonly string[], sourceRef: string, findings: Phase6EconomyEventAdapterFinding[]): void {
  findings.push({ code: "PHASE6_ECONOMY_EVENT_MISSING_RESOURCE", message: "economy event is missing an explicit resource or asset key", path, sourceEventIds, sourceRef });
}

function missingUnit(path: string, sourceEventIds: readonly string[], sourceRef: string, findings: Phase6EconomyEventAdapterFinding[]): void {
  findings.push({ code: "PHASE6_ECONOMY_EVENT_MISSING_UNIT", message: "economy event is missing an explicit unit; adapter will not invent one", path, sourceEventIds, sourceRef });
}

function unsupported(path: string, sourceEventIds: readonly string[], sourceRef: string, findings: Phase6EconomyEventAdapterFinding[], message: string): void {
  findings.push({ code: "PHASE6_ECONOMY_EVENT_UNSUPPORTED", message, path, sourceEventIds, sourceRef });
}

function stringField(record: Readonly<Record<string, unknown>>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : undefined;
}

function isBucket(value: string | undefined): value is Phase6EconomyInventoryBucket {
  return value === "available"
    || value === "reserved"
    || value === "in_transit"
    || value === "held_in_custody"
    || value === "equipped"
    || value === "leased"
    || value === "seized"
    || value === "damaged"
    || value === "consumed"
    || value === "destroyed";
}
