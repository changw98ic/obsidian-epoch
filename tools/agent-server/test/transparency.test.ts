import test from "node:test";
import assert from "node:assert/strict";
import {
  createTransparencyLedger,
  hashRecord,
  publicVerificationRecord,
} from "../lib/transparency.ts";

test("hashRecord is deterministic and changes when record changes", () => {
  const first = hashRecord({ type: "run", runTicket: "rt_1", score: 80 });
  const second = hashRecord({ score: 80, runTicket: "rt_1", type: "run" });
  const changed = hashRecord({ type: "run", runTicket: "rt_1", score: 81 });

  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("publicVerificationRecord excludes API keys and transcript text", () => {
  const publicRecord = publicVerificationRecord({
    runTicket: "rt_secret",
    run: {
      transcript: "secret sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
      events: [{ visibleText: "long private scene" }],
    },
    adjudication: { score: 82, rating: "strong", claimSlots: 2, worldImpact: "local" },
    lore: { decisions: [{ status: "canonical", claimId: "claim_echo", claimHash: "sha256:claim_echo_hash" }] },
  });
  const encoded = JSON.stringify(publicRecord);

  assert.equal(publicRecord.runTicket, "rt_secret");
  assert.equal(publicRecord.adjudication.score, 82);
  assert.deepEqual(publicRecord.claimHashes, ["sha256:claim_echo_hash"]);
  assert.equal(publicRecord.scoreHash.length, 64);
  assert.equal(publicRecord.lore.decisions[0]?.claimHash, "sha256:claim_echo_hash");
  assert.doesNotMatch(encoded, /sk-proj-/);
  assert.doesNotMatch(encoded, /long private scene/);
  assert.equal(publicRecord.runHash.length, 64);
});

test("transparency ledger is append-only and verifies hash chain", () => {
  const ledger = createTransparencyLedger();
  const first = ledger.append({ type: "run", runTicket: "rt_1", score: 80 });
  const second = ledger.append({ type: "claim", claimId: "claim_1" });

  assert.equal(first.index, 0);
  assert.equal(second.index, 1);
  assert.equal(ledger.verify().ok, true);
  assert.equal(ledger.entries().length, 2);
});

test("exportBundle includes entries and verification proof without private payloads", () => {
  const ledger = createTransparencyLedger();
  ledger.append(publicVerificationRecord({
    runTicket: "rt_1",
    run: { transcript: "private text" },
    adjudication: { score: 80 },
    lore: { decisions: [] },
  }));
  const bundle = ledger.exportBundle();

  assert.equal(bundle.entries.length, 1);
  assert.equal(bundle.verification.ok, true);
  assert.doesNotMatch(JSON.stringify(bundle), /private text/);
});

test("optional anchor records hashes without requiring a blockchain", () => {
  const ledger = createTransparencyLedger();
  ledger.append({ type: "run", runTicket: "rt_1" });
  const anchor = ledger.createAnchor({ provider: "manual", externalRef: "future-chain-tx" });

  assert.equal(anchor.status, "prepared");
  assert.equal(anchor.provider, "manual");
  assert.equal(anchor.rootHash.length, 64);
});
