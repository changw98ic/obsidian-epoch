import assert from "node:assert/strict";
import test from "node:test";
import { attestationSignatureHex } from "../lib/attestationSigner.ts";
import {
  createAttestationRuntime,
  type EpochAttestedRunnerConfig,
} from "../lib/epoch/attestationRuntime.ts";
import type {
  EpochHostedActionRecord,
  EpochProjection,
  SubmitHostedActionInput,
} from "../lib/epoch/gameCore.ts";
import type { EpochCommandContext, EpochIdFactory } from "../lib/epoch/protocol.ts";
import type { EpochRuntimeResult } from "../lib/epoch/runtime.ts";

function projection(status: "active" | "archived" = "active"): EpochProjection {
  return {
    identities: {
      agent_1: {
        agentId: "agent_1",
        explorerId: "explorer_1",
        identityName: "见证测试员",
        status,
      },
    },
    hostedSessions: {
      session_1: {
        sessionId: "session_1",
        agentId: "agent_1",
        explorerId: "explorer_1",
        regionId: "region_gray_harbor",
        mandate: "见证一次行动",
        channelClass: "server_hosted",
        deliveryTrust: "user_verified_web",
        status: "active",
        actionOptions: [{
          actionOptionId: "option_1",
          optionKey: "observe",
          label: "观察",
          risk: "low",
          explanation: { title: "观察", body: "确认局势。" },
        }],
        actions: [],
        startedAt: "2026-07-06T00:00:00.000Z",
      },
    },
  } as unknown as EpochProjection;
}

function createHarness(input: {
  readonly runners?: readonly EpochAttestedRunnerConfig[];
  readonly nowIso?: string;
  readonly status?: "active" | "archived";
} = {}) {
  let nowMs = Date.parse(input.nowIso || "2026-07-06T00:00:00.000Z");
  let idCounter = 0;
  let submitted: { readonly input: SubmitHostedActionInput; readonly context: EpochCommandContext } | undefined;
  const abuseInputs: Readonly<Record<string, unknown>>[] = [];
  const currentProjection = () => projection(input.status || "active");
  const idFactory: EpochIdFactory = (kind) => `${kind}_${String(idCounter += 1).padStart(4, "0")}`;
  const runtime = createAttestationRuntime({
    clock: () => new Date(nowMs),
    defaultChallengeTtlMs: 5 * 60_000,
    idFactory,
    runners: input.runners || [{
      runnerId: "runner_1",
      secret: "runner_secret",
      keyId: "runner_key",
      trustClass: "remote_attested_runner",
    }],
    project: currentProjection,
    assertAbuseAllowed: (value) => {
      abuseInputs.push(value);
    },
    requireActiveIdentity: (agentId) => {
      const identity = currentProjection().identities[agentId];
      if (!identity) throw new Error("agent_identity_not_found");
      if (identity.status !== "active") throw new Error("agent_identity_archived");
    },
    submitHostedAction: (submitInput, context): EpochRuntimeResult<EpochHostedActionRecord> => {
      submitted = { input: submitInput, context };
      return {
        value: {
          actionId: "action_1",
          sessionId: submitInput.sessionId,
          agentId: "agent_1",
          channelClass: "server_hosted",
          deliveryTrust: context.trustClass,
          actionOptionId: submitInput.actionOptionId,
          optionLabel: "观察",
          explanation: { title: "观察", body: "确认局势。" },
          outcomeSummary: "完成见证。",
          recordedAt: "2026-07-06T00:00:01.000Z",
          signedEnvelope: {},
          attestationId: submitInput.attestation?.attestationId,
        } as unknown as EpochHostedActionRecord,
        events: [],
        projection: currentProjection(),
      };
    },
  });
  return {
    runtime,
    abuseInputs,
    submitted: () => submitted,
    advanceTo: (nextIso: string) => {
      nowMs = Date.parse(nextIso);
    },
  };
}

test("attestation runtime issues public challenges with deterministic signatures", () => {
  const { runtime, abuseInputs } = createHarness();

  const issued = runtime.issueChallenge({
    runnerId: "runner_1",
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    idempotencyKey: "challenge_1",
  });

  assert.deepEqual(Object.keys(issued.challenge).sort(), [
    "actionOptionId",
    "challengeId",
    "expiresAt",
    "issuedAt",
    "runnerId",
    "sessionId",
    "signatureBase",
    "transcriptHash",
  ]);
  assert.equal(issued.challenge.runnerId, "runner_1");
  assert.equal(issued.challenge.expiresAt, "2026-07-06T00:05:00.000Z");
  assert.match(issued.challenge.signatureBase, /obsidian-epoch-alpha1-2026-06-25/);
  assert.equal(abuseInputs.length, 1);

  const duplicate = runtime.issueChallenge({
    runnerId: "runner_1",
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    idempotencyKey: "challenge_1",
  });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.challenge, issued.challenge);

  assert.throws(() => runtime.issueChallenge({
    runnerId: "runner_1",
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:different",
    idempotencyKey: "challenge_1",
  }), /idempotency_key_conflict/);
});

test("attestation runtime validates signatures and consumes challenges before submit", () => {
  const { runtime, submitted } = createHarness();
  const issued = runtime.issueChallenge({
    runnerId: "runner_1",
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    idempotencyKey: "challenge_1",
  });
  const signature = attestationSignatureHex("runner_secret", issued.challenge.signatureBase);

  assert.throws(() => runtime.submitAction({
    runnerId: "runner_1",
    challengeId: issued.challenge.challengeId,
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    signature: "bad",
    idempotencyKey: "submit_bad",
  }), /attestation_signature_invalid/);

  const result = runtime.submitAction({
    runnerId: "runner_1",
    challengeId: issued.challenge.challengeId,
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    signature,
    visibleText: "选择观察。",
    idempotencyKey: "submit_1",
  });

  assert.equal(result.value.attestationId, submitted()?.input.attestation?.attestationId);
  assert.equal(submitted()?.input.attestation?.runnerKeyId, "runner_key");
  assert.equal(submitted()?.input.attestation?.signatureBase, issued.challenge.signatureBase);
  assert.match(submitted()?.input.attestation?.signatureBaseHash || "", /^sha256:/);
  assert.equal(submitted()?.context.actorExplorerId, "runner_1");
  assert.equal(submitted()?.context.trustClass, "remote_attested_runner");
  assert.equal(submitted()?.context.idempotencyKey, "submit_1");

  assert.throws(() => runtime.submitAction({
    runnerId: "runner_1",
    challengeId: issued.challenge.challengeId,
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    signature,
    idempotencyKey: "submit_replay",
  }), /attestation_challenge_already_used/);
});

test("attestation runtime rejects archived identities and expired challenges", () => {
  assert.throws(() => createHarness({ status: "archived" }).runtime.issueChallenge({
    runnerId: "runner_1",
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    idempotencyKey: "challenge_archived",
  }), /agent_identity_archived/);

  const harness = createHarness({
    runners: [{
      runnerId: "runner_short",
      secret: "runner_short_secret",
      challengeTtlMs: 5,
    }],
  });
  const issued = harness.runtime.issueChallenge({
    runnerId: "runner_short",
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    idempotencyKey: "challenge_short",
  });
  harness.advanceTo("2026-07-06T00:00:00.010Z");

  assert.throws(() => harness.runtime.submitAction({
    runnerId: "runner_short",
    challengeId: issued.challenge.challengeId,
    sessionId: "session_1",
    actionOptionId: "option_1",
    transcriptHash: "sha256:transcript",
    signature: attestationSignatureHex("runner_short_secret", issued.challenge.signatureBase),
    idempotencyKey: "submit_expired",
  }), /attestation_challenge_expired/);
});
