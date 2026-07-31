import assert from "node:assert/strict";
import test from "node:test";

import type {
  CausalEffectV1,
  CausalWorldEventV1,
} from "../lib/epoch/causalContracts.ts";
import { CausalValidationError } from "../lib/epoch/causalContracts.ts";
import {
  parseQuantityMinor,
  resourceBalanceKey,
  validateCausalResourceRules,
  type CausalResourceBalanceSnapshot,
  type CausalResourcePolicy,
  type CausalResourceValidationInput,
  type CausalTitleOwnershipSnapshot,
} from "../lib/epoch/causalResourceRules.ts";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const HASH = `sha256:${"a".repeat(64)}` as const;

function ledgerEffect(
  entries: readonly { readonly accountRef: string; readonly quantityMinor: string }[],
  overrides: Partial<CausalEffectV1> & {
    readonly creationSourceRef?: string;
    readonly destructionSinkRef?: string;
  } = {},
): CausalEffectV1 {
  const { creationSourceRef, destructionSinkRef, ...effectOverrides } = overrides;
  const after: Record<string, unknown> = {
    resourceKey: "coin",
    resourceClass: "currency",
    unit: "minor",
    entries,
  };
  if (creationSourceRef !== undefined) after.creationSourceRef = creationSourceRef;
  if (destructionSinkRef !== undefined) after.destructionSinkRef = destructionSinkRef;
  return {
    effectId: "effect_1",
    effectType: "resource_ledger",
    targetRef: { entityType: "resource_account", entityId: "account_a" },
    operation: "transfer",
    after,
    sourceEventIds: [],
    authorizationRefs: [],
    ...effectOverrides,
  } as CausalEffectV1;
}

function ownershipEffect(
  overrides: Partial<{
    readonly interestType: string;
    readonly holderRef: unknown;
    readonly itemRef: unknown;
    readonly validFromWorldMinute: number;
    readonly validUntilWorldMinute: number | null;
  }> = {},
  effectOverrides: Partial<CausalEffectV1> = {},
): CausalEffectV1 {
  return {
    effectId: "effect_ownership_1",
    effectType: "ownership_interest",
    targetRef: { EntityType: "item", entityId: "item_1" },
    operation: "assign",
    after: {
      interestType: "title",
      holderRef: "player:a",
      itemRef: "item:sword_1",
      ...overrides,
    },
    sourceEventIds: [],
    authorizationRefs: [],
    ...effectOverrides,
  } as CausalEffectV1;
}

function eventFixture(effects: readonly CausalEffectV1[]): CausalWorldEventV1 {
  return {
    eventId: "event_1",
    eventType: "resource_granted",
    schemaVersion: 1,
    registryVersion: "1",
    registryHash: HASH,
    worldId: "world_1",
    namespace: "world",
    stream: {
      streamType: "resource_account",
      streamId: "account_a",
      streamVersion: 1,
    },
    occurredAtWorldMinute: 10,
    recordedAt: "2026-07-20T00:00:00.000Z",
    actorRefs: [{ actorType: "system", actorId: "test" }],
    subjectRefs: [{ entityType: "resource_account", entityId: "account_a" }],
    regionRefs: [],
    command: {
      commandId: "command_1",
      commandType: "test.action",
      idempotencyKey: "idem_1",
      inputHash: HASH,
    },
    causality: { causalParentEventIds: [], rootPressureIds: [] },
    authorizationRefs: ["auth:system"],
    evidenceRefs: [],
    visibilityPolicyRef: "visibility:public",
    versions: {
      rulesetVersion: "ruleset_1",
      contentVersion: "content_1",
      adjudicatorVersion: "adjudicator_1",
    },
    determinism: {
      algorithmId: "deterministic",
      algorithmVersion: "1",
    },
    payload: {},
    effects,
    proof: {
      payloadHash: HASH,
      effectsHash: HASH,
      eventHash: HASH,
    },
  } as CausalWorldEventV1;
}

function validate(
  effects: readonly CausalEffectV1[],
  policy: CausalResourcePolicy = {},
  balances?: CausalResourceBalanceSnapshot,
  ownership?: CausalTitleOwnershipSnapshot,
): readonly CausalValidationError[] {
  return validateCausalResourceRules({
    event: eventFixture(effects),
    policy,
    balances,
    ownership,
  });
}

function codes(errors: readonly { readonly code: string }[]): readonly string[] {
  return errors.map((e) => e.code);
}

// ===========================================================================
// parseQuantityMinor
// ===========================================================================

test("parseQuantityMinor returns bigint for valid positive integer string", () => {
  assert.equal(parseQuantityMinor("0"), 0n);
  assert.equal(parseQuantityMinor("1"), 1n);
  assert.equal(parseQuantityMinor("42"), 42n);
  assert.equal(parseQuantityMinor("999999999999999999"), 999999999999999999n);
});

test("parseQuantityMinor returns bigint for valid negative integer string", () => {
  assert.equal(parseQuantityMinor("-1"), -1n);
  assert.equal(parseQuantityMinor("-42"), -42n);
  assert.equal(parseQuantityMinor("-0"), 0n);
});

test("parseQuantityMinor returns undefined for non-integer strings", () => {
  assert.equal(parseQuantityMinor(""), undefined);
  assert.equal(parseQuantityMinor("abc"), undefined);
  assert.equal(parseQuantityMinor("1.5"), undefined);
  assert.equal(parseQuantityMinor("1e3"), undefined);
  assert.equal(parseQuantityMinor("Infinity"), undefined);
  assert.equal(parseQuantityMinor("NaN"), undefined);
});

test("parseQuantityMinor returns undefined for leading-zero integers", () => {
  assert.equal(parseQuantityMinor("01"), undefined);
  assert.equal(parseQuantityMinor("007"), undefined);
  assert.equal(parseQuantityMinor("-01"), undefined);
});

test("parseQuantityMinor returns undefined for whitespace-padded numbers", () => {
  assert.equal(parseQuantityMinor(" 1"), undefined);
  assert.equal(parseQuantityMinor("1 "), undefined);
  assert.equal(parseQuantityMinor(" 1 "), undefined);
});

// ===========================================================================
// resourceBalanceKey
// ===========================================================================

test("resourceBalanceKey joins resourceKey and unit with colon", () => {
  assert.equal(resourceBalanceKey("coin", "minor"), "coin:minor");
  assert.equal(resourceBalanceKey("iron_ore", "kg"), "iron_ore:kg");
});

// ===========================================================================
// validateCausalResourceRules — empty effects
// ===========================================================================

test("validateCausalResourceRules returns no errors for empty effects array", () => {
  const errors = validate([]);
  assert.equal(errors.length, 0);
});

// ===========================================================================
// validateCausalResourceRules — balanced transfer (no errors)
// ===========================================================================

test("validateCausalResourceRules accepts balanced debit+credit transfer", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-10" },
        { accountRef: "account_b", quantityMinor: "10" },
      ]),
    ],
    {},
    { balances: { account_a: "100" } },
  );
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules accepts single zero-quantity entry", () => {
  const errors = validate([
    ledgerEffect([
      { accountRef: "account_a", quantityMinor: "0" },
    ]),
  ]);
  assert.equal(errors.length, 0);
});

// ===========================================================================
// validateCausalResourceRules — unbalanced transfer errors
// ===========================================================================

test("validateCausalResourceRules errors on unbalanced transfer without source/sink", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-5" },
        { accountRef: "account_b", quantityMinor: "10" },
      ]),
    ],
    {},
    { balances: { account_a: "100" } },
  );
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["RESOURCE_UNBALANCED"]);
});

test("validateCausalResourceRules errors when positive total has no creation source", () => {
  const errors = validate([
    ledgerEffect([
      { accountRef: "account_a", quantityMinor: "10" },
    ]),
  ]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["RESOURCE_SOURCE_DENIED"]);
});

test("validateCausalResourceRules errors when negative total has no destruction sink", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-10" },
      ]),
    ],
    {},
    { balances: { account_a: "100" } },
  );
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["RESOURCE_SINK_DENIED"]);
});

// ===========================================================================
// validateCausalResourceRules — creation source / destruction sink allowed
// ===========================================================================

test("validateCausalResourceRules accepts positive total with allowed creation source ref", () => {
  const errors = validate(
    [
      ledgerEffect(
        [{ accountRef: "account_a", quantityMinor: "100" }],
        { creationSourceRef: "source:mint" },
      ),
    ],
    { allowedCreationSourceRefs: ["source:mint"] },
  );
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules accepts positive total with allowed creation source set", () => {
  const errors = validate(
    [
      ledgerEffect(
        [{ accountRef: "account_a", quantityMinor: "100" }],
        { creationSourceRef: "source:mint" },
      ),
    ],
    { allowedCreationSourceRefs: new Set(["source:mint"]) },
  );
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules accepts positive total with creationSourceAllowed callback", () => {
  const errors = validate(
    [
      ledgerEffect(
        [{ accountRef: "account_a", quantityMinor: "100" }],
        { creationSourceRef: "source:mint" },
      ),
    ],
    {
      creationSourceAllowed: (input) => input.ref === "source:mint",
    },
  );
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules accepts negative total with allowed destruction sink ref", () => {
  const errors = validate(
    [
      ledgerEffect(
        [{ accountRef: "account_a", quantityMinor: "-50" }],
        { destructionSinkRef: "sink:burn" },
      ),
    ],
    { allowedDestructionSinkRefs: ["sink:burn"] },
    { balances: { account_a: "100" } },
  );
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules accepts negative total with destructionSinkAllowed callback", () => {
  const errors = validate(
    [
      ledgerEffect(
        [{ accountRef: "account_a", quantityMinor: "-50" }],
        { destructionSinkRef: "sink:burn" },
      ),
    ],
    {
      destructionSinkAllowed: (input) => input.ref === "sink:burn",
    },
    { balances: { account_a: "100" } },
  );
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules rejects positive total with disallowed creation source", () => {
  const errors = validate(
    [
      ledgerEffect(
        [{ accountRef: "account_a", quantityMinor: "100" }],
        { creationSourceRef: "source:cheater" },
      ),
    ],
    { allowedCreationSourceRefs: ["source:mint"] },
  );
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["RESOURCE_SOURCE_DENIED"]);
});

test("validateCausalResourceRules rejects negative total with disallowed destruction sink", () => {
  const errors = validate(
    [
      ledgerEffect(
        [{ accountRef: "account_a", quantityMinor: "-50" }],
        { destructionSinkRef: "sink:cheater" },
      ),
    ],
    { allowedDestructionSinkRefs: ["sink:burn"] },
    { balances: { account_a: "100" } },
  );
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["RESOURCE_SINK_DENIED"]);
});

// ===========================================================================
// validateCausalResourceRules — balanced transfer must not declare source/sink
// ===========================================================================

test("validateCausalResourceRules errors when balanced transfer declares creation source", () => {
  const errors = validate(
    [
      ledgerEffect(
        [
          { accountRef: "account_a", quantityMinor: "-10" },
          { accountRef: "account_b", quantityMinor: "10" },
        ],
        { creationSourceRef: "source:mint" },
      ),
    ],
    {},
    { balances: { account_a: "100" } },
  );
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["RESOURCE_UNBALANCED"]);
});

// ===========================================================================
// validateCausalResourceRules — negative balance
// ===========================================================================

test("validateCausalResourceRules errors on negative balance exceeding credit limit", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-100" },
        { accountRef: "account_b", quantityMinor: "100" },
      ]),
    ],
    {},
    {
      balances: { account_a: "10" },
      creditLimits: { account_a: "50" },
    },
  );
  // balance 10 + delta(-100) = -90; credit limit 50 => -90 < -50 => error
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["NEGATIVE_BALANCE"]);
});

test("validateCausalResourceRules accepts negative delta within credit limit", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-50" },
        { accountRef: "account_b", quantityMinor: "50" },
      ]),
    ],
    {},
    {
      balances: { account_a: "10" },
      creditLimits: { account_a: "100" },
    },
  );
  // balance 10 + delta(-50) = -40; credit limit 100 => -40 >= -100 => ok
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules accepts debit when balance is sufficient", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-30" },
        { accountRef: "account_b", quantityMinor: "30" },
      ]),
    ],
    {},
    {
      balances: { account_a: "100" },
    },
  );
  assert.equal(errors.length, 0);
});

// ===========================================================================
// validateCausalResourceRules — schema validation errors
// ===========================================================================

test("validateCausalResourceRules errors on missing resourceKey", () => {
  const effect = {
    effectId: "effect_1",
    effectType: "resource_ledger",
    targetRef: { entityType: "resource_account", entityId: "account_a" },
    operation: "transfer",
    after: {
      unit: "minor",
      entries: [{ accountRef: "account_a", quantityMinor: "1" }],
    },
    sourceEventIds: [],
    authorizationRefs: [],
  } as CausalEffectV1;
  const errors = validate([effect]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["CAUSAL_SCHEMA_INVALID"]);
});

test("validateCausalResourceRules errors on empty resourceKey", () => {
  const effect = {
    effectId: "effect_1",
    effectType: "resource_ledger",
    targetRef: { entityType: "resource_account", entityId: "account_a" },
    operation: "transfer",
    after: {
      resourceKey: "",
      unit: "minor",
      entries: [{ accountRef: "account_a", quantityMinor: "1" }],
    },
    sourceEventIds: [],
    authorizationRefs: [],
  } as CausalEffectV1;
  const errors = validate([effect]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["CAUSAL_SCHEMA_INVALID"]);
});

test("validateCausalResourceRules errors on invalid accountRef", () => {
  const errors = validate([
    ledgerEffect([
      { accountRef: "", quantityMinor: "1" },
    ]),
  ]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["CAUSAL_SCHEMA_INVALID"]);
});

test("validateCausalResourceRules errors on non-string quantityMinor", () => {
  const effect = {
    effectId: "effect_1",
    effectType: "resource_ledger",
    targetRef: { entityType: "resource_account", entityId: "account_a" },
    operation: "transfer",
    after: {
      resourceKey: "coin",
      unit: "minor",
      entries: [{ accountRef: "account_a", quantityMinor: 42 }],
    },
    sourceEventIds: [],
    authorizationRefs: [],
  } as unknown as CausalEffectV1;
  const errors = validate([effect]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["CAUSAL_SCHEMA_INVALID"]);
});

test("validateCausalResourceRules errors on non-integer quantityMinor string", () => {
  const errors = validate([
    ledgerEffect([
      { accountRef: "account_a", quantityMinor: "1.5" },
    ]),
  ]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["CAUSAL_SCHEMA_INVALID"]);
});

// ===========================================================================
// validateCausalResourceRules — ownership interest
// ===========================================================================

test("validateCausalResourceRules accepts single title holder", () => {
  const errors = validate([
    ownershipEffect({
      interestType: "title",
      holderRef: "player:a",
      itemRef: "item:sword_1",
    }),
  ]);
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules errors on conflicting title ownership", () => {
  const errors = validate([
    ownershipEffect({
      interestType: "title",
      holderRef: "player:a",
      itemRef: "item:sword_1",
    }),
    ownershipEffect({
      interestType: "title",
      holderRef: "player:b",
      itemRef: "item:sword_1",
    }),
  ]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["OWNERSHIP_CONFLICT"]);
});

test("validateCausalResourceRules errors on title conflict with existing owner", () => {
  const errors = validate(
    [
      ownershipEffect({
        interestType: "title",
        holderRef: "player:b",
        itemRef: "item:sword_1",
      }),
    ],
    {},
    undefined,
    { titleOwners: { "item:sword_1": "player:a" } },
  );
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["OWNERSHIP_CONFLICT"]);
});

test("validateCausalResourceRules allows multiple non-title interest types", () => {
  const errors = validate([
    ownershipEffect({
      interestType: "usage",
      holderRef: "player:a",
      itemRef: "item:sword_1",
    }),
    ownershipEffect({
      interestType: "usage",
      holderRef: "player:b",
      itemRef: "item:sword_1",
    }),
  ]);
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules skips expired ownership interests", () => {
  const expired = eventFixture([
    ownershipEffect({
      interestType: "title",
      holderRef: "player:b",
      itemRef: "item:sword_1",
      validFromWorldMinute: 0,
      validUntilWorldMinute: 5, // expired before occurredAtWorldMinute=10
    }),
  ]);
  const errors = validateCausalResourceRules({
    event: expired,
    policy: {},
    ownership: { titleOwners: { "item:sword_1": "player:a" } },
  });
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules errors on title with missing itemRef", () => {
  const errors = validate([
    ownershipEffect({
      interestType: "title",
      holderRef: "player:a",
      itemRef: undefined,
    }),
  ]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["CAUSAL_SCHEMA_INVALID"]);
});

test("validateCausalResourceRules errors on title with missing holderRef", () => {
  const errors = validate([
    ownershipEffect({
      interestType: "title",
      holderRef: undefined,
      itemRef: "item:sword_1",
    }),
  ]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["CAUSAL_SCHEMA_INVALID"]);
});

// ===========================================================================
// validateCausalResourceRules — mixed effect types
// ===========================================================================

test("validateCausalResourceRules processes multiple effect types together", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-10" },
        { accountRef: "account_b", quantityMinor: "10" },
      ]),
      ownershipEffect({
        interestType: "title",
        holderRef: "player:a",
        itemRef: "item:shield_1",
      }),
    ],
    {},
    { balances: { account_a: "100" } },
  );
  assert.equal(errors.length, 0);
});

test("validateCausalResourceRules accumulates errors from multiple effects", () => {
  const errors = validate([
    // Unbalanced ledger
    ledgerEffect([
      { accountRef: "account_a", quantityMinor: "5" },
    ]),
    // Conflicting ownership
    ownershipEffect({
      interestType: "title",
      holderRef: "player:a",
      itemRef: "item:sword_1",
    }),
    ownershipEffect({
      interestType: "title",
      holderRef: "player:b",
      itemRef: "item:sword_1",
    }),
  ]);
  // Should have RESOURCE_SOURCE_DENIED + OWNERSHIP_CONFLICT
  assert.ok(errors.length >= 2);
  assert.ok(codes(errors).includes("RESOURCE_SOURCE_DENIED"));
  assert.ok(codes(errors).includes("OWNERSHIP_CONFLICT"));
});

// ===========================================================================
// validateCausalResourceRules — CausalValidationError properties
// ===========================================================================

test("validation errors carry correct code and retryable flag", () => {
  const errors = validate([
    ledgerEffect([
      { accountRef: "account_a", quantityMinor: "10" },
    ]),
  ]);
  assert.equal(errors.length, 1);
  const err = errors[0]!;
  assert.ok(err instanceof CausalValidationError);
  assert.equal(err.code, "RESOURCE_SOURCE_DENIED");
  assert.equal(err.retryable, false);
  assert.equal(typeof err.details.message, "string");
  assert.equal(typeof err.details.path, "string");
});

test("NEGATIVE_BALANCE errors are retryable", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-200" },
        { accountRef: "account_b", quantityMinor: "200" },
      ]),
    ],
    {},
    { balances: { account_a: "0" }, creditLimits: { account_a: "0" } },
  );
  assert.ok(errors.length > 0);
  const negErr = errors.find((e) => e.code === "NEGATIVE_BALANCE");
  assert.ok(negErr !== undefined);
  assert.equal(negErr!.retryable, true);
});

test("OWNERSHIP_CONFLICT errors are retryable", () => {
  const errors = validate([
    ownershipEffect({
      interestType: "title",
      holderRef: "player:a",
      itemRef: "item:sword_1",
    }),
    ownershipEffect({
      interestType: "title",
      holderRef: "player:b",
      itemRef: "item:sword_1",
    }),
  ]);
  const conflictErr = errors.find((e) => e.code === "OWNERSHIP_CONFLICT");
  assert.ok(conflictErr !== undefined);
  assert.equal(conflictErr!.retryable, true);
});

// ===========================================================================
// validateCausalResourceRules — balances snapshot key formats
// ===========================================================================

test("balance lookup supports composite resourceKey:unit key", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-30" },
        { accountRef: "account_b", quantityMinor: "30" },
      ]),
    ],
    {},
    {
      balances: { account_a: { "coin:minor": "50" } },
    },
  );
  assert.equal(errors.length, 0);
});

test("balance lookup falls back to bare resourceKey", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "account_a", quantityMinor: "-30" },
        { accountRef: "account_b", quantityMinor: "30" },
      ]),
    ],
    {},
    {
      balances: { account_a: { coin: "50" } },
    },
  );
  assert.equal(errors.length, 0);
});

test("balance lookup defaults to zero for missing account", () => {
  const errors = validate(
    [
      ledgerEffect([
        { accountRef: "unknown_account", quantityMinor: "-10" },
        { accountRef: "account_b", quantityMinor: "10" },
      ]),
    ],
    {},
    { balances: {} },
  );
  // unknown_account has 0 balance, delta -10, credit limit 0 => -10 < 0 => error
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["NEGATIVE_BALANCE"]);
});

// ===========================================================================
// validateCausalResourceRules — ownership with entity object refs
// ===========================================================================

test("ownership interest supports entity object ref format", () => {
  const errors = validate([
    ownershipEffect({
      interestType: "title",
      holderRef: { entityType: "player", entityId: "a" },
      itemRef: { entityType: "item", entityId: "sword_1" },
    }),
  ]);
  assert.equal(errors.length, 0);
});

test("conflicting entity object refs are detected", () => {
  const errors = validate([
    ownershipEffect({
      interestType: "title",
      holderRef: { entityType: "player", entityId: "a" },
      itemRef: { entityType: "item", entityId: "sword_1" },
    }),
    ownershipEffect({
      interestType: "title",
      holderRef: { entityType: "player", entityId: "b" },
      itemRef: { entityType: "item", entityId: "sword_1" },
    }),
  ]);
  assert.ok(errors.length > 0);
  assert.deepEqual(codes(errors), ["OWNERSHIP_CONFLICT"]);
});
