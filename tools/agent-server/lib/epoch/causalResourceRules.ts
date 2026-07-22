import type {
  CausalEffectV1,
  CausalWorldEventV1,
} from "./causalContracts.ts";
import { CausalValidationError } from "./causalContracts.ts";

export type CausalResourceErrorCode =
  | "CAUSAL_SCHEMA_INVALID"
  | "RESOURCE_UNBALANCED"
  | "RESOURCE_SOURCE_DENIED"
  | "RESOURCE_SINK_DENIED"
  | "NEGATIVE_BALANCE"
  | "OWNERSHIP_CONFLICT";

export interface CausalResourcePolicy {
  readonly allowedCreationSourceRefs?: readonly string[] | ReadonlySet<string>;
  readonly allowedDestructionSinkRefs?: readonly string[] | ReadonlySet<string>;
  readonly creationSourceAllowed?: (input: CausalResourcePolicyCheckInput) => boolean;
  readonly destructionSinkAllowed?: (input: CausalResourcePolicyCheckInput) => boolean;
}

export interface CausalResourcePolicyCheckInput {
  readonly event: CausalWorldEventV1;
  readonly effect: CausalEffectV1;
  readonly resourceKey: string;
  readonly unit: string;
  readonly ref: string;
}

export interface CausalResourceBalanceSnapshot {
  readonly balances?: Readonly<Record<string, string | Readonly<Record<string, string>>>>;
  readonly creditLimits?: Readonly<Record<string, string | Readonly<Record<string, string>>>>;
}

export interface CausalTitleOwnershipSnapshot {
  readonly titleOwners?: Readonly<Record<string, string | readonly string[] | undefined>>;
}

export interface CausalResourceValidationInput {
  readonly event: CausalWorldEventV1;
  readonly policy: CausalResourcePolicy;
  readonly balances?: CausalResourceBalanceSnapshot;
  readonly ownership?: CausalTitleOwnershipSnapshot;
}

export interface ResourceLedgerEntryV1 {
  readonly accountRef: string;
  readonly quantityMinor: string;
}

export interface ResourceLedgerAfterV1 {
  readonly resourceKey: string;
  readonly unit: string;
  readonly entries: readonly ResourceLedgerEntryV1[];
  readonly creationSourceRef?: string;
  readonly destructionSinkRef?: string;
}

export interface OwnershipInterestAfterV1 {
  readonly interestType: string;
  readonly holderRef: unknown;
  readonly itemRef: unknown;
  readonly validFromWorldMinute?: number;
  readonly validUntilWorldMinute?: number | null;
}

const DECIMAL_INTEGER = /^-?(0|[1-9]\d*)$/;
const RETRYABLE_RESOURCE_CODES: ReadonlySet<CausalResourceErrorCode> = new Set([
  "NEGATIVE_BALANCE",
  "OWNERSHIP_CONFLICT",
]);

export function validateCausalResourceRules(input: CausalResourceValidationInput): readonly CausalValidationError[] {
  const errors: CausalValidationError[] = [];
  const titleOwners = new Map<string, Set<string>>();

  input.event.effects.forEach((effect, index) => {
    const path = `effects.${index}`;
    if (effect.effectType === "resource_ledger") {
      errors.push(...validateResourceLedgerEffect(input, effect, path));
    }
    if (effect.effectType === "ownership_interest") {
      errors.push(...validateOwnershipInterestEffect(input, effect, path, titleOwners));
    }
  });

  return errors;
}

export function parseQuantityMinor(quantityMinor: string): bigint | undefined {
  if (!DECIMAL_INTEGER.test(quantityMinor)) return undefined;
  return BigInt(quantityMinor);
}

export function resourceBalanceKey(resourceKey: string, unit: string): string {
  return `${resourceKey}:${unit}`;
}

function validateResourceLedgerEffect(
  input: CausalResourceValidationInput,
  effect: CausalEffectV1,
  path: string,
): readonly CausalValidationError[] {
  const after = resourceLedgerAfter(effect);
  const errors: CausalValidationError[] = [];
  if (
    typeof after.resourceKey !== "string" ||
    !after.resourceKey ||
    typeof after.unit !== "string" ||
    !after.unit ||
    !Array.isArray(after.entries)
  ) {
    return [resourceError("CAUSAL_SCHEMA_INVALID", "resource ledger after payload is invalid", path, input.event, effect)];
  }

  let total = 0n;
  const accountDeltas = new Map<string, bigint>();
  after.entries.forEach((entry, index) => {
    const entryPath = `${path}.after.entries.${index}`;
    if (!entry || typeof entry.accountRef !== "string" || !entry.accountRef) {
      errors.push(resourceError("CAUSAL_SCHEMA_INVALID", "resource ledger accountRef is invalid", entryPath, input.event, effect));
      return;
    }
    if (typeof entry.quantityMinor !== "string") {
      errors.push(resourceError("CAUSAL_SCHEMA_INVALID", "resource ledger quantityMinor is invalid", entryPath, input.event, effect));
      return;
    }
    const quantity = parseQuantityMinor(entry.quantityMinor);
    if (quantity === undefined) {
      errors.push(resourceError("CAUSAL_SCHEMA_INVALID", "resource ledger quantityMinor must be a decimal integer string", entryPath, input.event, effect));
      return;
    }
    total += quantity;
    accountDeltas.set(entry.accountRef, (accountDeltas.get(entry.accountRef) || 0n) + quantity);
  });
  if (errors.length) return errors;

  const hasPositiveEntry = after.entries.some((entry) => parseQuantityMinor(entry.quantityMinor)! > 0n);
  const hasNegativeEntry = after.entries.some((entry) => parseQuantityMinor(entry.quantityMinor)! < 0n);
  if (total !== 0n && hasPositiveEntry && hasNegativeEntry && !after.creationSourceRef && !after.destructionSinkRef) {
    errors.push(resourceError("RESOURCE_UNBALANCED", "ordinary resource transfer entries must sum to zero", path, input.event, effect));
  } else if (total > 0n) {
    if (!after.creationSourceRef || !creationSourceAllowed(input, effect, after.resourceKey, after.unit, after.creationSourceRef)) {
      errors.push(resourceError("RESOURCE_SOURCE_DENIED", "positive resource ledger total requires an allowed creation source", `${path}.after.creationSourceRef`, input.event, effect));
    }
  } else if (total < 0n) {
    if (!after.destructionSinkRef || !destructionSinkAllowed(input, effect, after.resourceKey, after.unit, after.destructionSinkRef)) {
      errors.push(resourceError("RESOURCE_SINK_DENIED", "negative resource ledger total requires an allowed destruction sink", `${path}.after.destructionSinkRef`, input.event, effect));
    }
  } else if (after.creationSourceRef || after.destructionSinkRef) {
    errors.push(resourceError("RESOURCE_UNBALANCED", "ordinary resource transfer must not declare creation source or destruction sink", path, input.event, effect));
  }

  for (const [accountRef, delta] of accountDeltas) {
    const current = balanceFor(input.balances?.balances, accountRef, after.resourceKey, after.unit);
    const creditLimit = balanceFor(input.balances?.creditLimits, accountRef, after.resourceKey, after.unit);
    if (current + delta < -creditLimit) {
      errors.push(resourceError("NEGATIVE_BALANCE", "resource balance exceeds available balance and credit limit", `${path}.after.entries`, input.event, effect));
    }
  }

  return errors;
}

function validateOwnershipInterestEffect(
  input: CausalResourceValidationInput,
  effect: CausalEffectV1,
  path: string,
  candidateTitleOwners: Map<string, Set<string>>,
): readonly CausalValidationError[] {
  const after = ownershipInterestAfter(effect);
  if (after.interestType !== "title") return [];

  const itemKey = refKey(after.itemRef);
  const holderKey = refKey(after.holderRef);
  if (!itemKey || !holderKey) {
    return [resourceError("CAUSAL_SCHEMA_INVALID", "title ownership interest must include itemRef and holderRef", path, input.event, effect)];
  }
  if (!ownershipIsActiveAt(after, input.event.occurredAtWorldMinute)) return [];

  const owners = candidateTitleOwners.get(itemKey) || new Set<string>();
  owners.add(holderKey);
  candidateTitleOwners.set(itemKey, owners);

  const existingOwners = existingTitleOwners(input.ownership?.titleOwners?.[itemKey]);
  for (const existingOwner of existingOwners) owners.add(existingOwner);
  return owners.size > 1
    ? [resourceError("OWNERSHIP_CONFLICT", "active unique item title cannot have multiple holders", path, input.event, effect)]
    : [];
}

function creationSourceAllowed(
  input: CausalResourceValidationInput,
  effect: CausalEffectV1,
  resourceKey: string,
  unit: string,
  ref: string,
): boolean {
  if (input.policy.creationSourceAllowed) return input.policy.creationSourceAllowed({ event: input.event, effect, resourceKey, unit, ref });
  return refSetHas(input.policy.allowedCreationSourceRefs, ref);
}

function destructionSinkAllowed(
  input: CausalResourceValidationInput,
  effect: CausalEffectV1,
  resourceKey: string,
  unit: string,
  ref: string,
): boolean {
  if (input.policy.destructionSinkAllowed) return input.policy.destructionSinkAllowed({ event: input.event, effect, resourceKey, unit, ref });
  return refSetHas(input.policy.allowedDestructionSinkRefs, ref);
}

function resourceLedgerAfter(effect: CausalEffectV1): Partial<ResourceLedgerAfterV1> {
  const direct = effect as unknown as Partial<ResourceLedgerAfterV1>;
  const after = effect.after as unknown as Partial<ResourceLedgerAfterV1>;
  return {
    resourceKey: after.resourceKey ?? direct.resourceKey,
    unit: after.unit ?? direct.unit,
    entries: after.entries ?? direct.entries,
    creationSourceRef: after.creationSourceRef ?? direct.creationSourceRef,
    destructionSinkRef: after.destructionSinkRef ?? direct.destructionSinkRef,
  };
}

function ownershipInterestAfter(effect: CausalEffectV1): Partial<OwnershipInterestAfterV1> {
  const direct = effect as unknown as Partial<OwnershipInterestAfterV1>;
  const after = effect.after as unknown as Partial<OwnershipInterestAfterV1>;
  return {
    interestType: after.interestType ?? direct.interestType,
    holderRef: after.holderRef ?? direct.holderRef,
    itemRef: after.itemRef ?? direct.itemRef,
    validFromWorldMinute: after.validFromWorldMinute ?? direct.validFromWorldMinute,
    validUntilWorldMinute: after.validUntilWorldMinute ?? direct.validUntilWorldMinute,
  };
}

function refSetHas(refs: readonly string[] | ReadonlySet<string> | undefined, ref: string): boolean {
  if (!refs) return false;
  return Array.isArray(refs) ? refs.includes(ref) : (refs as ReadonlySet<string>).has(ref);
}

function balanceFor(
  balances: Readonly<Record<string, string | Readonly<Record<string, string>>>> | undefined,
  accountRef: string,
  resourceKey: string,
  unit: string,
): bigint {
  const accountBalance = balances?.[accountRef];
  if (typeof accountBalance === "string") return parseQuantityMinor(accountBalance) || 0n;
  const value = accountBalance?.[resourceBalanceKey(resourceKey, unit)] ?? accountBalance?.[resourceKey];
  return typeof value === "string" ? parseQuantityMinor(value) || 0n : 0n;
}

function refKey(ref: unknown): string | undefined {
  if (typeof ref === "string" && ref) return ref;
  if (!ref || typeof ref !== "object") return undefined;
  const record = ref as { readonly entityType?: unknown; readonly entityId?: unknown };
  return typeof record.entityType === "string" && typeof record.entityId === "string"
    ? `${record.entityType}:${record.entityId}`
    : undefined;
}

function ownershipIsActiveAt(after: Partial<OwnershipInterestAfterV1>, worldMinute: number): boolean {
  const from = typeof after.validFromWorldMinute === "number" ? after.validFromWorldMinute : worldMinute;
  const until = typeof after.validUntilWorldMinute === "number" ? after.validUntilWorldMinute : undefined;
  return from <= worldMinute && (until === undefined || worldMinute < until);
}

function existingTitleOwners(value: string | readonly string[] | undefined): readonly string[] {
  if (typeof value === "string") return value ? [value] : [];
  return Array.isArray(value) ? value.filter((owner) => typeof owner === "string" && owner) : [];
}

function resourceError(
  code: CausalResourceErrorCode,
  message: string,
  path: string,
  event: CausalWorldEventV1,
  effect?: CausalEffectV1,
): CausalValidationError {
  return new CausalValidationError(code, {
    message,
    path,
    eventId: event.eventId,
    effectId: effect?.effectId,
    retryable: RETRYABLE_RESOURCE_CODES.has(code),
  });
}
