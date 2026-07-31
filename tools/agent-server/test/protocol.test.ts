import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTrustClass,
  sourceAuthorityForTrustClass,
  isEpochTrustClass,
  isEpochEventType,
  EPOCH_TRUST_CLASSES,
  EPOCH_EVENT_TYPES,
} from "../lib/epoch/protocol.ts";

// ── normalizeTrustClass ─────────────────────────────────────────────────────

describe("normalizeTrustClass", () => {
  for (const cls of EPOCH_TRUST_CLASSES) {
    it(`returns "${cls}" for valid input`, () => {
      assert.equal(normalizeTrustClass(cls), cls);
    });
  }

  const invalidInputs: Array<[string, unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["number 42", 42],
    ["empty string", ""],
    ["unrecognized string", "not_a_class"],
    ["plain object", {}],
    ["array", []],
  ];

  for (const [label, input] of invalidInputs) {
    it(`returns "untrusted_client" for ${label}`, () => {
      assert.equal(normalizeTrustClass(input), "untrusted_client");
    });
  }
});

// ── sourceAuthorityForTrustClass ────────────────────────────────────────────

describe("sourceAuthorityForTrustClass", () => {
  it('returns "core" for system_worker', () => {
    assert.equal(sourceAuthorityForTrustClass("system_worker"), "core");
  });

  it('returns "low-confidence" for untrusted_client', () => {
    assert.equal(sourceAuthorityForTrustClass("untrusted_client"), "low-confidence");
  });

  const officialClasses = [
    "user_verified_web",
    "server_hosted_agent",
    "host_attested",
    "remote_attested_runner",
  ] as const;

  for (const cls of officialClasses) {
    it(`returns "official" for ${cls}`, () => {
      assert.equal(sourceAuthorityForTrustClass(cls), "official");
    });
  }

  const invalidInputs: Array<[string, unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["number", 42],
    ["empty string", ""],
    ["unrecognized string", "bogus"],
  ];

  for (const [label, input] of invalidInputs) {
    it(`returns "low-confidence" for invalid input (${label})`, () => {
      assert.equal(sourceAuthorityForTrustClass(input), "low-confidence");
    });
  }
});

// ── isEpochTrustClass ───────────────────────────────────────────────────────

describe("isEpochTrustClass", () => {
  for (const cls of EPOCH_TRUST_CLASSES) {
    it(`returns true for "${cls}"`, () => {
      assert.equal(isEpochTrustClass(cls), true);
    });
  }

  const invalidInputs: Array<[string, unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["number", 42],
    ["empty string", ""],
    ["unrecognized string", "not_a_class"],
    ["plain object", {}],
    ["array", []],
  ];

  for (const [label, input] of invalidInputs) {
    it(`returns false for ${label}`, () => {
      assert.equal(isEpochTrustClass(input), false);
    });
  }
});

// ── isEpochEventType ────────────────────────────────────────────────────────

describe("isEpochEventType", () => {
  const sampleValidTypes = [
    "identity_issued",
    "resource_granted",
    "turn_resolved",
    "bounty_created",
    "world_clock_initialized",
    "npc_canonicalized",
  ];

  for (const eventType of sampleValidTypes) {
    it(`returns true for "${eventType}"`, () => {
      assert.equal(isEpochEventType(eventType), true);
    });
  }

  const invalidInputs: Array<[string, unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["number", 42],
    ["empty string", ""],
    ["unrecognized string", "not_an_event_type"],
    ["plain object", {}],
  ];

  for (const [label, input] of invalidInputs) {
    it(`returns false for ${label}`, () => {
      assert.equal(isEpochEventType(input), false);
    });
  }
});
