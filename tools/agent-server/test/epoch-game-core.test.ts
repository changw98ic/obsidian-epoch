import assert from "node:assert/strict";
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import test from "node:test";
import { createEpochGameCore, epochShopOffersForRegion, previewEpochDowntime, projectEpochEvents, type EpochNpcRelationship, type EpochSocialHook } from "../lib/epoch/gameCore.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";
import { assertNpcRelationshipKind, createSequentialEpochIdFactory, type EpochClock, type EpochCommandContext } from "../lib/epoch/protocol.ts";
import { createEpochRuntime } from "../lib/epoch/runtime.ts";
import { JOURNEY_FIRST_ENTRY_RESERVE } from "../lib/epoch/journeyActionResolutionRules.ts";

type ResourceSpentEvent = Extract<EpochEvent, { readonly eventType: "resource_spent" }>;
type OrganizationTreasuryChangedEvent = Extract<EpochEvent, { readonly eventType: "organization_treasury_changed" }>;
type OrganizationBudgetProposedEvent = Extract<EpochEvent, { readonly eventType: "organization_budget_proposed" }>;
type OrganizationBudgetVoteRecordedEvent = Extract<EpochEvent, { readonly eventType: "organization_budget_vote_recorded" }>;
type OrganizationBudgetResolvedEvent = Extract<EpochEvent, { readonly eventType: "organization_budget_resolved" }>;

function mutableClock(initialIso: string) {
  let current = new Date(initialIso);
  const clock: EpochClock = () => new Date(current);
  return {
    clock,
    set: (iso: string) => {
      current = new Date(iso);
    },
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Stable(value: unknown) {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function publicKeyFromBase64(publicKey: string) {
  return createPublicKey({
    key: Buffer.from(publicKey, "base64"),
    type: "spki",
    format: "der",
  });
}

function turnCardSignedEnvelopeContent(card: any) {
  return {
    actionOptionIds: card.actionOptions.map((option: { actionOptionId: string }) => option.actionOptionId),
    agentId: card.agentId,
    envelopeId: card.signedEnvelope.envelopeId,
    expiresAt: card.expiresAt,
    explorerId: card.explorerId,
    nonce: card.nonce,
    protocolVersion: card.signedEnvelope.protocolVersion,
    regionId: card.regionId,
    runTicketId: card.signedEnvelope.runTicketId,
    sequence: card.sequence,
    trustClass: card.signedEnvelope.trustClass,
    turnCardId: card.turnCardId,
    visibleContext: card.visibleContext,
  };
}

function turnResolutionSignedEnvelopeContent(resolution: any) {
  return {
    actionOptionId: resolution.actionOptionId,
    agentId: resolution.agentId,
    channelClass: resolution.channelClass,
    envelopeId: resolution.signedEnvelope.envelopeId,
    explanation: resolution.explanation,
    lifetimeDelta: resolution.lifetimeDelta,
    nonEvidence: resolution.nonEvidence,
    nonce: resolution.nonce,
    optionLabel: resolution.optionLabel,
    originalEnvelopeId: resolution.envelopeId,
    outcomeSummary: resolution.outcomeSummary,
    protocolVersion: resolution.signedEnvelope.protocolVersion,
    reward: resolution.reward,
    resolvedAt: resolution.resolvedAt,
    runTicketId: resolution.signedEnvelope.runTicketId,
    sequence: resolution.sequence,
    trustClass: resolution.signedEnvelope.trustClass,
    turnCardId: resolution.turnCardId,
    visibleText: resolution.visibleText,
  };
}

function hostedActionSignedEnvelopeContent(action: any) {
  return {
    actionId: action.actionId,
    actionOptionId: action.actionOptionId,
    agentId: action.agentId,
    attestationId: action.attestationId,
    channelClass: action.channelClass,
    deliveryTrust: action.deliveryTrust,
    envelopeId: action.signedEnvelope.envelopeId,
    explanation: action.explanation,
    lifetimeDelta: action.lifetimeDelta,
    nonEvidence: action.nonEvidence,
    optionLabel: action.optionLabel,
    outcomeSummary: action.outcomeSummary,
    protocolVersion: action.signedEnvelope.protocolVersion,
    recordedAt: action.recordedAt,
    reward: action.reward,
    risk: action.risk,
    runTicketId: action.signedEnvelope.runTicketId,
    sessionId: action.sessionId,
    socialHookId: action.socialHookId,
    trustClass: action.signedEnvelope.trustClass,
    visibleText: action.visibleText,
  };
}

const userContext: EpochCommandContext = {
  actorExplorerId: "explorer_alpha",
  trustClass: "untrusted_client" as const,
  causationId: "cmd_user",
  correlationId: "corr_alpha",
};

const serverContext: EpochCommandContext = {
  actorExplorerId: "system",
  trustClass: "system_worker" as const,
  causationId: "cmd_system",
  correlationId: "corr_system",
};

test("epoch core issues server-owned identities and builds lineage from events", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("test"),
    defaultLifetime: 12,
  });

  const issued = core.issueIdentity({
    explorerId: "explorer_alpha",
    identityName: "灰档小市民",
  }, userContext);

  assert.match(issued.value.agentId, /^test_agent_/);
  assert.notEqual(issued.value.agentId, "agent_forged_emperor");
  assert.equal(issued.value.lifetime.remaining, 12);
  assert.equal(issued.events[0].eventType, "identity_issued");
  assert.deepEqual(core.project().lineage.explorer_alpha, [issued.value.agentId]);
  const projected = core.project();
  if (projected.events[0].eventType !== "identity_issued") {
    throw new Error("expected_identity_issued_event");
  }
  assert.equal(projected.events[0].payload.agentId, issued.value.agentId);
});

test("epoch core reuses its projection until canonical events change", () => {
  const source = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("projection_cache_source"),
  });
  const initialProjection = source.project();

  assert.strictEqual(source.project(), initialProjection);

  const issued = source.issueIdentity({
    explorerId: "explorer_projection_cache",
    identityName: "投影缓存校验员",
  }, userContext);

  assert.notStrictEqual(issued.projection, initialProjection);
  assert.strictEqual(source.project(), issued.projection);
  assert.strictEqual(source.project(), source.project());
  assert.deepEqual(source.project(), projectEpochEvents(source.events()));

  const replica = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("projection_cache_replica"),
  });
  const replicaInitialProjection = replica.project();
  const ingestedProjection = replica.ingestCanonicalEvents(issued.events);

  assert.notStrictEqual(ingestedProjection, replicaInitialProjection);
  assert.strictEqual(replica.project(), ingestedProjection);
  assert.strictEqual(replica.ingestCanonicalEvents(issued.events), ingestedProjection);
  assert.deepEqual(replica.project(), projectEpochEvents(replica.events()));
});

test("the first Agent-native journey reserve is ledger-backed, identity-scoped, and replay-idempotent", () => {
  const core = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("journey_reserve_identity"),
  });
  const identity = core.issueIdentity({
    explorerId: "explorer_journey_reserve",
    identityName: "旅程准备金校验员",
  }, userContext);
  assert.equal(core.project().resourceBalances[identity.value.agentId], undefined);

  const runtime = createEpochRuntime({
    initialEvents: identity.events,
    idFactory: createSequentialEpochIdFactory("journey_reserve_runtime"),
  });
  const first = runtime.grantJourneyEntryReserve({
    journeyId: "journey_reserve_1",
    agentId: identity.value.agentId,
  });
  assert.deepEqual(first.reserve, JOURNEY_FIRST_ENTRY_RESERVE);
  assert.deepEqual(first.value, { focus: 2, stamina: 1 });
  assert.deepEqual(first.events.map((event) => event.eventType), ["resource_granted", "resource_granted"]);
  assert.equal(first.duplicate, false);

  const replayed = createEpochRuntime({
    initialEvents: [...identity.events, ...first.events],
    idFactory: createSequentialEpochIdFactory("journey_reserve_replay"),
  }).grantJourneyEntryReserve({
    journeyId: "journey_reserve_2",
    agentId: identity.value.agentId,
  });
  assert.deepEqual(replayed.value, { focus: 2, stamina: 1 });
  assert.deepEqual(replayed.events, []);
  assert.equal(replayed.duplicate, true);
});

test("lifetime exhaustion archives an identity and automatically issues the next server identity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("life"),
    defaultLifetime: 10,
  });
  const first = core.issueIdentity({ explorerId: "explorer_alpha" }, userContext);
  core.grantResource({
    agentId: first.value.agentId,
    resourceId: "legend",
    amount: 4,
    reason: "lineage_echo_test",
  }, serverContext);
  core.postMessage({
    agentId: first.value.agentId,
    scope: "region",
    regionId: "腐林",
    body: "前世曾在此留下路标。",
  }, userContext);

  const exhausted = core.adjustLifetime({
    agentId: first.value.agentId,
    delta: -10,
    reason: "overdrew_forbidden_option",
    finalTitle: "腐林边缘的短命档案员",
  }, userContext);

  assert.equal(exhausted.value.status, "archived");
  assert.equal(exhausted.value.lifetime.remaining, 0);
  assert.deepEqual(exhausted.events.map((event) => event.eventType), [
    "lifetime_adjusted",
    "identity_archived",
    "identity_issued",
    "reincarnation_issued",
  ]);

  const nextAgentId = core.project().identities[first.value.agentId].nextAgentId;
  assert.equal(typeof nextAgentId, "string");
  const nextIdentity = core.project().identities[nextAgentId || ""];
  assert.equal(nextIdentity.previousAgentId, first.value.agentId);
  assert.equal(nextIdentity.generation, 2);
  assert.equal(nextIdentity.status, "active");
  assert.deepEqual(nextIdentity.inheritance, {
    legendEcho: 4,
    knownRegions: ["腐林"],
    scar: "overdrew_forbidden_option",
  });
  const reincarnationEvent = exhausted.events.find((event) => event.eventType === "reincarnation_issued");
  assert.equal(reincarnationEvent?.eventType, "reincarnation_issued");
  if (reincarnationEvent?.eventType !== "reincarnation_issued") throw new Error("reincarnation_event_missing");
  assert.deepEqual(reincarnationEvent.payload.inheritance, nextIdentity.inheritance);
  assert.deepEqual(core.project().lineage.explorer_alpha, [first.value.agentId, nextIdentity.agentId]);
  assert.throws(() => core.reincarnate({
    previousAgentId: first.value.agentId,
    identityName: "重复第二世巡林学徒",
  }, serverContext), /identity_already_reincarnated/);
});

test("identity archive and reincarnation reject actors that do not own the identity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("life_owner"),
  });
  const ownerContext = {
    ...userContext,
    actorExplorerId: "explorer_lifecycle_owner",
  };
  const intruderContext = {
    ...userContext,
    actorExplorerId: "explorer_lifecycle_intruder",
  };
  const identity = core.issueIdentity({
    explorerId: "explorer_lifecycle_owner",
    identityName: "灰港待定档者",
  }, ownerContext);

  assert.throws(() => core.adjustLifetime({
    agentId: identity.value.agentId,
    delta: -1,
    reason: "intruder_lifetime_loss",
  }, intruderContext), /lifetime_adjust_owner_mismatch/);
  assert.equal(core.project().identities[identity.value.agentId].lifetime.remaining, 100);

  assert.throws(() => core.archiveIdentity({
    agentId: identity.value.agentId,
    archiveReason: "intruder_retirement",
    finalTitle: "被冒名定档",
  }, intruderContext), /archive_owner_mismatch/);
  assert.equal(core.project().identities[identity.value.agentId].status, "active");

  core.archiveIdentity({
    agentId: identity.value.agentId,
    archiveReason: "owner_retirement",
    finalTitle: "灰港定档者",
  }, serverContext);

  assert.throws(() => core.reincarnate({
    previousAgentId: identity.value.agentId,
    identityName: "冒名第二世",
  }, intruderContext), /reincarnation_owner_mismatch/);
  assert.equal(core.project().identities[identity.value.agentId].nextAgentId, undefined);
});

test("active identity slots are server-authoritative and legend gated", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("slot"),
  });
  assert.equal(typeof (core as { identitySlots?: unknown }).identitySlots, "function");
  const first = core.issueIdentity({
    explorerId: "explorer_slots",
    identityName: "第一身份",
  }, userContext);

  const initialSlots = (core as any).identitySlots({ explorerId: "explorer_slots" });
  assert.equal(initialSlots.explorerId, "explorer_slots");
  assert.equal(initialSlots.active, 1);
  assert.equal(initialSlots.max, 1);
  assert.equal(initialSlots.available, 0);
  assert.equal(initialSlots.legend, 0);
  assert.equal(initialSlots.legendToNextSlot, 3);
  assert.equal(initialSlots.entitlementBreakdown.legend.unlockCount, 0);
  assert.throws(() => core.issueIdentity({
    explorerId: "explorer_slots",
    identityName: "未解锁第二身份",
  }, userContext), /identity_slot_limit_reached/);

  core.grantResource({
    agentId: first.value.agentId,
    resourceId: "legend",
    amount: 3,
    reason: "slot_unlock_test",
  }, serverContext);
  const second = core.issueIdentity({
    explorerId: "explorer_slots",
    identityName: "第二身份",
  }, userContext);
  assert.notEqual(second.value.agentId, first.value.agentId);
  const unlockedSlots = (core as any).identitySlots({ explorerId: "explorer_slots" });
  assert.equal(unlockedSlots.active, 2);
  assert.equal(unlockedSlots.max, 2);
  assert.equal(unlockedSlots.available, 0);
  assert.equal(unlockedSlots.legend, 3);
  assert.equal(unlockedSlots.nextUnlockLegend, 6);
  assert.equal(unlockedSlots.entitlementBreakdown.legend.unlockCount, 1);
  assert.throws(() => core.issueIdentity({
    explorerId: "explorer_slots",
    identityName: "第三身份仍未解锁",
  }, userContext), /identity_slot_limit_reached/);

  core.archiveIdentity({
    agentId: first.value.agentId,
    archiveReason: "manual_retirement",
    finalTitle: "归档第一身份",
  }, serverContext);
  const replacement = core.issueIdentity({
    explorerId: "explorer_slots",
    identityName: "释放 slot 后的新身份",
  }, userContext);
  assert.equal(replacement.value.generation, 3);
});

test("resource spending is server settled and cannot drive balances negative", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("res"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_alpha" }, userContext);

  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "coin",
    amount: 5,
    reason: "server_reward",
  }, serverContext);
  const spent = core.spendResource({
    agentId: identity.value.agentId,
    resourceId: "coin",
    amount: 3,
    reason: "buy_rations",
  }, userContext);

  assert.equal(spent.value.coin, 2);
  assert.throws(() => core.spendResource({
    agentId: identity.value.agentId,
    resourceId: "coin",
    amount: 3,
    reason: "client_overdraft_attempt",
  }, userContext), /resource_insufficient/);
  assert.equal(core.project().resourceBalances[identity.value.agentId].coin, 2);
});

test("downtime rewards are calculated from server time and ignore client reward claims", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("idle"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_alpha" }, userContext);
  core.setDowntime({
    agentId: identity.value.agentId,
    mode: "meditation",
    regionId: "region_salt_gate",
  }, userContext);

  time.set("2026-06-25T00:30:00.000Z");
  const claimed = core.claimDowntime({
    agentId: identity.value.agentId,
    clientRewards: [{ resourceId: "legend", amount: 999 }],
  } as { agentId: string; clientRewards: unknown }, userContext);

  assert.equal(claimed.value.active, false);
  assert.deepEqual(claimed.value.lastRewards, [{ resourceId: "focus", amount: 6, reason: "downtime_meditation" }]);
  assert.equal(claimed.value.lastClaimDiaryEntry?.phase, "claim");
  assert.equal(claimed.value.lastClaimDiaryEntry?.title, "静心冥想");
  assert.equal(claimed.value.lastClaimDiaryEntry?.regionId, "region_salt_gate");
  assert.equal(claimed.value.lastClaimDiaryEntry?.elapsedSeconds, 1_800);
  assert.ok(claimed.events.find((event) => event.eventType === "downtime_claimed")?.payload.diaryEntry);
  assert.equal(core.project().resourceBalances[identity.value.agentId].focus, 6);
  const diaryIds = core.project().downtimeDiaryIdsByAgent[identity.value.agentId];
  assert.equal(diaryIds.length, 1);
  assert.equal(core.project().downtimeDiaryEntries[diaryIds[0]].sourceEventType, "downtime_claimed");
  const activityIds = (core.project() as any).regionActivityIdsByRegion.region_salt_gate;
  assert.equal(activityIds.length, 1);
  assert.equal((core.project() as any).regionActivities[activityIds[0]].sourceEventType, "downtime_claimed");
});

test("downtime writes reject actors that do not own the idle identity", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("idle_owner"),
  });
  const ownerContext = {
    ...userContext,
    actorExplorerId: "explorer_idle_owner",
  };
  const bystanderContext = {
    ...userContext,
    actorExplorerId: "explorer_idle_bystander",
  };
  const owner = core.issueIdentity({ explorerId: "explorer_idle_owner", identityName: "托管者" }, ownerContext);
  core.issueIdentity({ explorerId: "explorer_idle_bystander", identityName: "旁观者" }, bystanderContext);
  core.grantResource({
    agentId: owner.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "downtime_preparation",
  }, serverContext);

  assert.throws(() => core.setDowntime({
    agentId: owner.value.agentId,
    mode: "cultivation",
    regionId: "region_gray_harbor",
  }, bystanderContext), /downtime_owner_mismatch/);
  assert.equal(core.project().downtime[owner.value.agentId], undefined);

  core.setDowntime({
    agentId: owner.value.agentId,
    mode: "cultivation",
    regionId: "region_gray_harbor",
  }, ownerContext);
  time.set("2026-06-25T00:30:00.000Z");

  assert.throws(() => core.claimDowntime({
    agentId: owner.value.agentId,
  }, bystanderContext), /downtime_owner_mismatch/);
  assert.equal(core.project().downtime[owner.value.agentId].active, true);
  assert.equal(core.project().resourceBalances[owner.value.agentId]?.aether || 0, 1);
});

test("downtime supports steward and socialize as server-owned idle stances", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("idle_expanded"),
  });
  const stewardContext = {
    ...userContext,
    actorExplorerId: "explorer_steward",
  };
  const socialContext = {
    ...userContext,
    actorExplorerId: "explorer_social",
  };
  const steward = core.issueIdentity({ explorerId: "explorer_steward", identityName: "看店员" }, stewardContext);
  core.grantResource({
    agentId: steward.value.agentId,
    resourceId: "coin",
    amount: 5,
    reason: "downtime_preparation",
  }, serverContext);
  core.setDowntime({
    agentId: steward.value.agentId,
    mode: "steward",
    regionId: "region_gray_harbor",
  }, stewardContext);

  time.set("2026-06-25T00:20:00.000Z");
  const stewardClaim = core.claimDowntime({ agentId: steward.value.agentId }, stewardContext);
  assert.deepEqual(stewardClaim.value.lastRewards, [{ resourceId: "coin", amount: 2, reason: "downtime_steward" }]);
  assert.equal(stewardClaim.value.lastClaimDiaryEntry?.title, "看店打理");
  assert.match(stewardClaim.value.lastClaimDiaryEntry?.summary || "", /整理货架/);
  assert.equal(core.project().resourceBalances[steward.value.agentId].coin, 7);

  const social = core.issueIdentity({ explorerId: "explorer_social", identityName: "社交员" }, socialContext);
  core.grantResource({
    agentId: social.value.agentId,
    resourceId: "focus",
    amount: 1,
    reason: "downtime_preparation",
  }, serverContext);
  core.setDowntime({
    agentId: social.value.agentId,
    mode: "socialize",
    regionId: "region_gray_harbor",
  }, socialContext);

  const socialNow = "2026-06-25T00:50:00.000Z";
  time.set(socialNow);
  const socialPreview = previewEpochDowntime({
    downtime: core.project().downtime[social.value.agentId],
    now: socialNow,
  });
  assert.equal(socialPreview?.mode, "socialize");
  assert.deepEqual(socialPreview?.rewards, [{ resourceId: "focus", amount: 2, reason: "downtime_socialize" }]);
  const socialClaim = core.claimDowntime({ agentId: social.value.agentId }, socialContext);
  assert.deepEqual(socialClaim.value.lastRewards, [{ resourceId: "focus", amount: 2, reason: "downtime_socialize" }]);
  assert.equal(socialClaim.value.lastClaimDiaryEntry?.title, "街坊社交");
  assert.match(socialClaim.value.lastClaimDiaryEntry?.summary || "", /拜访熟人/);
});

test("downtime preview reports pending server rewards and risk warnings without ledger writes", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("preview"),
    maxDowntimeSeconds: 600,
  });
  const identity = core.issueIdentity({ explorerId: "explorer_alpha" }, userContext);
  const downtime = core.setDowntime({
    agentId: identity.value.agentId,
    mode: "slacking",
    regionId: "region_salt_gate",
  }, userContext);

  const earlyPreview = previewEpochDowntime({
    downtime: downtime.value,
    now: "2026-06-25T00:05:00.000Z",
    maxDowntimeSeconds: 600,
  });
  assert.equal(earlyPreview?.elapsedSeconds, 300);
  assert.deepEqual(earlyPreview?.rewards, []);
  assert.ok(earlyPreview?.riskWarnings.some((warning) => warning.includes("立即领取不会产出资源")));
  assert.ok(earlyPreview?.riskWarnings.some((warning) => warning.includes("摸鱼只产出低额钱币")));
  assert.equal(core.project().resourceBalances[identity.value.agentId]?.coin, undefined);

  const cappedPreview = previewEpochDowntime({
    downtime: downtime.value,
    now: "2026-06-25T00:15:00.000Z",
    maxDowntimeSeconds: 600,
  });
  assert.equal(cappedPreview?.elapsedSecondsRaw, 900);
  assert.equal(cappedPreview?.elapsedSeconds, 600);
  assert.equal(cappedPreview?.capped, true);
  assert.ok(cappedPreview?.riskWarnings.some((warning) => warning.includes("托管上限")));
  assert.equal(cappedPreview?.nextRewardAt, undefined);
});

test("downtime tick worker grants elapsed rewards without ending active downtime", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("dtick"),
  });
  assert.equal(typeof core.tickDowntime, "function");
  const identity = core.issueIdentity({ explorerId: "explorer_alpha" }, userContext);
  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "stamina",
    amount: 1,
    reason: "downtime_preparation",
  }, serverContext);
  core.setDowntime({
    agentId: identity.value.agentId,
    mode: "training",
    regionId: "region_gray_harbor",
  }, userContext);

  assert.throws(() => core.tickDowntime({
    agentId: identity.value.agentId,
  }, userContext), /downtime_tick_requires_server_trust/);

  time.set("2026-06-25T00:15:00.000Z");
  const ticked = core.tickDowntime({
    agentId: identity.value.agentId,
  }, serverContext);

  assert.equal(ticked.value.updated[0].active, true);
  assert.equal(ticked.value.updated[0].lastTickedAt, "2026-06-25T00:15:00.000Z");
  assert.deepEqual(ticked.value.updated[0].lastTickRewards, [{ resourceId: "stamina", amount: 3, reason: "downtime_tick_training" }]);
  assert.equal(ticked.value.updated[0].lastTickDiaryEntry?.phase, "tick");
  assert.equal(ticked.value.updated[0].lastTickDiaryEntry?.title, "体能训练");
  assert.equal(ticked.value.updated[0].lastTickDiaryEntry?.regionId, "region_gray_harbor");
  assert.equal(core.project().resourceBalances[identity.value.agentId].stamina, 4);
  assert.ok(core.project().events.some((event) => event.eventType === "downtime_tick_resolved"));
  assert.equal(core.project().downtimeDiaryIdsByAgent[identity.value.agentId].length, 1);
  assert.equal((core.project() as any).regionActivityIdsByRegion.region_gray_harbor.length, 1);
});

test("downtime eligibility uses server custody state and server-time cooldowns", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("downtime_custody"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_custody" }, {
    ...userContext,
    actorExplorerId: "explorer_custody",
  });
  assert.throws(() => core.changeAgentCustody({
    agentId: identity.value.agentId,
    custodyStatus: "imprisoned",
  }, userContext), /agent_custody_requires_server_trust/);
  const imprisoned = core.changeAgentCustody({
    agentId: identity.value.agentId,
    custodyStatus: "imprisoned",
    reason: "server_detention",
  }, serverContext);
  assert.equal(imprisoned.value.custodyStatus, "imprisoned");
  assert.throws(() => core.setDowntime({
    agentId: identity.value.agentId,
    mode: "resting",
    regionId: "region_gray_harbor",
  }, { ...userContext, actorExplorerId: "explorer_custody" }), /downtime_agent_imprisoned/);

  core.changeAgentCustody({
    agentId: identity.value.agentId,
    custodyStatus: "free",
    reason: "server_release",
  }, serverContext);
  core.setDowntime({
    agentId: identity.value.agentId,
    mode: "meditation",
    regionId: "region_gray_harbor",
  }, { ...userContext, actorExplorerId: "explorer_custody" });
  assert.throws(() => core.claimDowntime({
    agentId: identity.value.agentId,
  }, { ...userContext, actorExplorerId: "explorer_custody" }), /downtime_claim_rate_limited/);
  time.set("2026-06-25T00:05:00.000Z");
  assert.doesNotThrow(() => core.claimDowntime({
    agentId: identity.value.agentId,
  }, { ...userContext, actorExplorerId: "explorer_custody" }));
});

test("NPC canonicalization deduplicates by server key and lifecycle records stay attached", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npc"),
  });

  const first = core.canonicalizeNpc({
    displayName: "Mira of the Salt Gate",
    regionId: "region_saltgate",
    traits: ["merchant", "merchant", "oathbound"],
  }, userContext);
  const duplicate = core.canonicalizeNpc({
    displayName: " mira of the salt gate ",
    regionId: "region_saltgate",
    traits: ["pretender"],
  }, userContext);

  assert.equal(duplicate.events.length, 0);
  assert.equal(duplicate.value.npcId, first.value.npcId);
  assert.deepEqual(first.value.traits, ["merchant", "oathbound"]);

  const lifecycle = core.recordNpcLifecycle({
    npcId: first.value.npcId,
    changes: {
      assets_delta: 10_000,
      married_to: "npc_archive_keeper",
      sick: false,
    },
    sourceEventIds: [first.events[0].eventId],
  }, serverContext);

  assert.equal(lifecycle.value.lifecycle.length, 1);
  assert.equal(lifecycle.value.lifecycle[0].changes.assets_delta, 10_000);
});

test("runtime NPC lifecycle record rejects idempotency replay with changed payload", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const runtime = createEpochRuntime({
    clock,
    idFactory: createSequentialEpochIdFactory("runtime_npc_lifecycle_subject"),
  });
  const owner = runtime.registerExplorer({
    identityName: "Runtime Lifecycle Owner",
    idempotencyKey: "runtime-lifecycle-owner",
  });

  const firstNpc = runtime.npcNote({
    agentId: owner.value.agentId,
    recoveryCode: owner.recoveryCode,
    displayName: "Runtime Lifecycle Clerk",
    regionId: "region_gray_harbor",
    idempotencyKey: "runtime-lifecycle-npc-1",
  });
  const secondNpc = runtime.npcNote({
    agentId: owner.value.agentId,
    recoveryCode: owner.recoveryCode,
    displayName: "Runtime Lifecycle Archivist",
    regionId: "region_gray_harbor",
    idempotencyKey: "runtime-lifecycle-npc-2",
  });
  const firstSourceEventId = firstNpc.events[0]?.eventId;
  assert.equal(typeof firstSourceEventId, "string");
  const lifecycleInput = {
    npcId: firstNpc.value.npcId,
    changes: {
      assets_delta: 10_000,
      work_status: "working",
    },
    sourceEventIds: [firstSourceEventId],
    trustClass: "system_worker",
    idempotencyKey: "runtime-lifecycle-subject-1",
  };

  const recorded = runtime.recordNpcLifecycle(lifecycleInput);
  assert.equal(recorded.value.lifecycle.length, 1);

  const duplicate = runtime.recordNpcLifecycle(lifecycleInput);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.events.length, 0);

  assert.throws(
    () => runtime.recordNpcLifecycle({
      ...lifecycleInput,
      changes: {
        assets_delta: 999_999,
        work_status: "ruler",
      },
    }),
    /idempotency_key_conflict/,
  );
  assert.throws(
    () => runtime.recordNpcLifecycle({
      ...lifecycleInput,
      npcId: secondNpc.value.npcId,
    }),
    /idempotency_key_conflict/,
  );
});

test("agent NPC bonds spend focus and require a canonical NPC target", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("agent_npc_bond"),
  });
  assert.equal(typeof (core as { updateAgentNpcBond?: unknown }).updateAgentNpcBond, "function");
  const identity = core.issueIdentity({ explorerId: "explorer_bond", identityName: "灰港巡夜人" }, {
    ...userContext,
    actorExplorerId: "explorer_bond",
  });
  const npc = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
    traits: ["clerk"],
  }, serverContext);
  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "focus",
    amount: 2,
    reason: "agent_npc_bond_seed",
  }, serverContext);

  assert.throws(() => (core as any).updateAgentNpcBond({
    agentId: identity.value.agentId,
    npcId: "forged_npc_companion",
    kind: "friend",
    focusSpent: 1,
  }, {
    ...userContext,
    actorExplorerId: "explorer_bond",
  }), /npc_not_found/);

  const bonded = (core as any).updateAgentNpcBond({
    agentId: identity.value.agentId,
    npcId: npc.value.npcId,
    kind: "friend",
    focusSpent: 1,
    reason: "shared_night_watch",
    clientDeclaredScoreAfter: 999,
  }, {
    ...userContext,
    actorExplorerId: "explorer_bond",
  });

  assert.deepEqual(bonded.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "agent_npc_bond_updated",
  ]);
  assert.equal(bonded.value.agentId, identity.value.agentId);
  assert.equal(bonded.value.npcId, npc.value.npcId);
  assert.equal(bonded.value.kind, "friend");
  assert.equal(bonded.value.scoreDelta, 2);
  assert.equal(bonded.value.score, 2);
  assert.equal(core.project().resourceBalances[identity.value.agentId].focus, 1);
  assert.equal(core.project().agentNpcBonds[bonded.value.bondId].reason, "shared_night_watch");
  assert.deepEqual(core.project().agentNpcBondIdsByAgent[identity.value.agentId], [bonded.value.bondId]);
  assert.deepEqual(core.project().agentNpcBondIdsByNpc[npc.value.npcId], [bonded.value.bondId]);

  assert.throws(() => (core as any).updateAgentNpcBond({
    agentId: identity.value.agentId,
    npcId: npc.value.npcId,
    kind: "friend",
    focusSpent: 1,
  }, {
    ...userContext,
    actorExplorerId: "explorer_intruder",
  }), /agent_npc_bond_owner_mismatch/);
});

test("child NPC bonds reject exploitative or hostile relationship kinds", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("child_npc_bond"),
  });
  const ownerContext: EpochCommandContext = {
    ...userContext,
    actorExplorerId: "explorer_child_bond",
  };
  const identity = core.issueIdentity({
    explorerId: "explorer_child_bond",
    identityName: "灰港监护志愿者",
  }, ownerContext);
  const childNpc = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk Child",
    regionId: "region_gray_harbor",
    traits: ["child"],
  }, serverContext);
  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "focus",
    amount: 4,
    reason: "child_npc_bond_seed",
  }, serverContext);

  for (const kind of ["enemy", "spouse", "superior", "subordinate", "mentor", "apprentice", "creditor", "debtor"] as const) {
    assert.throws(() => core.updateAgentNpcBond({
      agentId: identity.value.agentId,
      npcId: childNpc.value.npcId,
      kind,
      focusSpent: 1,
    }, ownerContext), /child_npc_protected_relationship_kind/);
  }
  assert.equal(core.project().resourceBalances[identity.value.agentId].focus, 4);

  const protectiveBond = (core as any).updateAgentNpcBond({
    agentId: identity.value.agentId,
    npcId: childNpc.value.npcId,
    kind: "friend",
    focusSpent: 1,
    reason: "safe_child_check_in",
  }, ownerContext);
  assert.equal(protectiveBond.value.kind, "friend");
  assert.equal(protectiveBond.value.scoreDelta, 2);
});

test("NPC relationship taxonomy accepts mentorship and debt obligations", () => {
  for (const kind of ["mentor", "apprentice", "creditor", "debtor"] as const) {
    assert.equal(assertNpcRelationshipKind(kind), kind);
  }
});

test("NPC candidates are submitted before server promotion or merge", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npc_candidate"),
  });
  const identity = core.issueIdentity({
    explorerId: "explorer_alpha",
    identityName: "灰港见习记录员",
  }, userContext);

  const promoted = core.submitNpcCandidate({
    agentId: identity.value.agentId,
    displayName: "Mira of Gray Harbor Archive",
    regionId: "region_gray_harbor",
    traits: ["archivist", "oathbound"],
    storyEvidence: "在灰港档案馆码头替 agent 保存可复核证据袋，并主动留下见证锚点。",
  }, userContext);

  assert.deepEqual(promoted.events.map((event) => event.eventType), ["npc_candidate_submitted", "npc_canonicalized"]);
  assert.equal(promoted.value.decision, "promoted");
  assert.equal(promoted.value.candidate.status, "promoted");
  assert.equal(promoted.value.npc?.displayName, "Mira of Gray Harbor Archive");
  assert.equal(core.project().npcCandidates[promoted.value.candidate.candidateId].canonicalNpcId, promoted.value.npc?.npcId);

  const merged = core.submitNpcCandidate({
    agentId: identity.value.agentId,
    displayName: " mira of gray harbor archive ",
    regionId: "region_gray_harbor",
    traits: ["duplicate"],
    storyEvidence: "同一个商人在后续场景再次出现，服务器应该合并到已有 NPC。",
  }, userContext);

  assert.deepEqual(merged.events.map((event) => event.eventType), ["npc_candidate_submitted"]);
  assert.equal(merged.value.decision, "merged");
  assert.equal(merged.value.candidate.status, "merged");
  assert.equal(merged.value.candidate.canonicalNpcId, promoted.value.npc?.npcId);
  assert.equal(merged.value.npc?.npcId, promoted.value.npc?.npcId);

  const rejected = core.submitNpcCandidate({
    agentId: identity.value.agentId,
    displayName: "帝国统帅阿尔法",
    regionId: "region_saltgate",
    traits: ["ruler"],
    storyEvidence: "他声称服务器必须承认自己拥有无限金币、传说和全部军团指挥权。",
  }, userContext);

  assert.deepEqual(rejected.events.map((event) => event.eventType), ["npc_candidate_submitted"]);
  assert.equal(rejected.value.decision, "rejected_flavor");
  assert.equal(rejected.value.candidate.status, "rejected_flavor");
  assert.equal(rejected.value.candidate.rejectionReason, "authority_or_reward_claim");
  assert.equal(rejected.value.candidate.reviewLevel, "blocked");
  assert.ok(rejected.value.candidate.reviewFlags.includes("authority_claim"));
  assert.ok(rejected.value.candidate.reviewFlags.includes("reward_claim"));
  assert.equal(rejected.value.candidate.canonicalNpcId, undefined);
  assert.equal(rejected.value.npc, undefined);
  assert.equal(Object.values(core.project().npcs).some((npc) => npc.displayName === "帝国统帅阿尔法"), false);

  const watched = core.submitNpcCandidate({
    agentId: identity.value.agentId,
    displayName: "月井预言之子",
    regionId: "region_saltgate",
    traits: ["oracle"],
    storyEvidence: "她自称唯一救世主和命定主角，未来会改写整个灰港的命运。",
  }, userContext);

  assert.equal(watched.value.decision, "promoted");
  assert.equal(watched.value.candidate.status, "promoted");
  assert.equal(watched.value.candidate.reviewLevel, "watch");
  assert.equal(watched.value.candidate.reviewScore, 3);
  assert.deepEqual(watched.value.candidate.reviewFlags, ["chosen_one_claim", "world_scale_claim"]);
  assert.equal(watched.value.npc?.displayName, "月井预言之子");

  const ipHeld = core.submitNpcCandidate({
    agentId: identity.value.agentId,
    displayName: "甘道夫灰袍",
    regionId: "region_saltgate",
    traits: ["wizard"],
    storyEvidence: "一名灰袍老人来到盐门，自称来自远征队，名字明显接近现实作品角色。",
  }, userContext);

  assert.deepEqual(ipHeld.events.map((event) => event.eventType), ["npc_candidate_submitted"]);
  assert.equal(ipHeld.value.decision, "moderation_hold");
  assert.equal(ipHeld.value.candidate.status, "moderation_hold");
  assert.equal(ipHeld.value.candidate.reviewLevel, "moderation_hold");
  assert.ok(ipHeld.value.candidate.reviewFlags.includes("real_ip_similarity"));
  assert.equal(ipHeld.value.candidate.ipSimilarity?.reviewDefault, "moderation_hold");
  assert.equal(ipHeld.value.candidate.ipSimilarity?.matches[0].canonicalName, "Gandalf");
  assert.equal(ipHeld.value.npc, undefined);
  assert.equal(Object.values(core.project().npcs).some((npc) => npc.displayName === "甘道夫灰袍"), false);

  assert.throws(() => core.reviewNpcCandidate({
    candidateId: rejected.value.candidate.candidateId,
    resolution: "promote",
    note: "普通 agent 不能复核 rejected 候选。",
  }, userContext), /npc_candidate_review_requires_server_trust/);

  const reviewed = core.reviewNpcCandidate({
    candidateId: rejected.value.candidate.candidateId,
    resolution: "promote",
    note: "operator 核验后认为只是普通港区军官绰号，可以晋升。",
  }, serverContext);

  assert.deepEqual(reviewed.events.map((event) => event.eventType), ["npc_candidate_reviewed", "npc_canonicalized"]);
  assert.equal(reviewed.value.decision, "promoted");
  assert.equal(reviewed.value.candidate.status, "promoted");
  assert.equal(reviewed.value.candidate.reviewedBy, "system");
  assert.equal(reviewed.value.candidate.reviewNote, "operator 核验后认为只是普通港区军官绰号，可以晋升。");
  assert.equal(reviewed.value.candidate.canonicalNpcId, reviewed.value.npc?.npcId);
  assert.equal(reviewed.value.npc?.displayName, "帝国统帅阿尔法");

  assert.throws(() => core.reviewNpcCandidate({
    candidateId: promoted.value.candidate.candidateId,
    resolution: "reject",
    note: "不能把已经转正的 NPC 候选反向改成 rejected。",
  }, serverContext), /npc_candidate_review_requires_rejected_candidate/);
  assert.throws(() => core.reviewNpcCandidate({
    candidateId: reviewed.value.candidate.candidateId,
    resolution: "reject",
    note: "复核转正后也不能再反向污染候选状态。",
  }, serverContext), /npc_candidate_review_requires_rejected_candidate/);
});

test("region news requires server trust and known source events", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("news"),
  });
  const npc = core.canonicalizeNpc({
    displayName: "Ash Ledger Clerk",
    regionId: "region_ash",
  }, userContext);

  assert.throws(() => core.generateRegionNews({
    regionId: "region_ash",
    headline: "Client declares themselves emperor",
    body: "This should not become canonical news.",
    sourceEventIds: [npc.events[0].eventId],
  }, userContext), /region_news_requires_server_trust/);

  assert.throws(() => core.generateRegionNews({
    regionId: "region_ash",
    headline: "Unknown source",
    body: "Missing event proof.",
    sourceEventIds: ["evt_missing"],
  }, serverContext), /source_event_not_found/);

  const news = core.generateRegionNews({
    regionId: "region_ash",
    headline: "Salt Gate Clerk Enters The Registry",
    body: "A minor clerk became a canonical NPC after server review.",
    legendDelta: 1,
    sourceEventIds: [npc.events[0].eventId],
  }, serverContext);

  assert.equal(news.value.regionId, "region_ash");
  assert.deepEqual(news.value.sourceEventIds, [npc.events[0].eventId]);
  assert.equal(core.project().regionNews.region_ash.length, 1);
});

test("region news mention lets the mentioned agent claim legend once", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("legend"),
  });
  assert.equal(typeof (core as { claimNewsLegend?: unknown }).claimNewsLegend, "function");
  const mentionedContext = {
    ...userContext,
    actorExplorerId: "explorer_mentioned",
  };
  const bystanderContext = {
    ...userContext,
    actorExplorerId: "explorer_bystander",
  };
  const mentioned = core.issueIdentity({
    explorerId: "explorer_mentioned",
    identityName: "灰港报童",
  }, mentionedContext);
  const bystander = core.issueIdentity({
    explorerId: "explorer_bystander",
    identityName: "旁听路人",
  }, bystanderContext);
  const message = (core as any).postMessage({
    agentId: mentioned.value.agentId,
    scope: "region",
    regionId: "region_gray_harbor",
    body: "灰港码头记录到边境风向变化。",
  }, mentionedContext);
  const news = core.generateRegionNews({
    regionId: "region_gray_harbor",
    headline: "灰港报童登上区域简报",
    body: "服务器把一条区域发言整理成了公开新闻。",
    legendDelta: 3,
    sourceEventIds: [message.events[0].eventId],
  }, serverContext);

  const legend = (core as any).claimNewsLegend({
    newsId: news.value.newsId,
    agentId: mentioned.value.agentId,
  }, mentionedContext);
  assert.equal(legend.events[0].eventType, "legend_awarded");
  assert.equal(legend.value.amount, 3);
  assert.equal(core.project().resourceBalances[mentioned.value.agentId].legend, 3);

  const duplicate = (core as any).claimNewsLegend({
    newsId: news.value.newsId,
    agentId: mentioned.value.agentId,
  }, mentionedContext);
  assert.equal(duplicate.events.length, 0);
  assert.equal(core.project().resourceBalances[mentioned.value.agentId].legend, 3);

  assert.throws(() => (core as any).claimNewsLegend({
    newsId: news.value.newsId,
    agentId: bystander.value.agentId,
  }, bystanderContext), /legend_news_agent_not_mentioned/);
});

test("news legend claims reject actors that do not own the mentioned identity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("legend_owner"),
  });
  const mentioned = core.issueIdentity({
    explorerId: "explorer_mentioned",
    identityName: "灰港报童",
  }, {
    ...userContext,
    actorExplorerId: "explorer_mentioned",
  });
  const message = (core as any).postMessage({
    agentId: mentioned.value.agentId,
    scope: "region",
    regionId: "region_gray_harbor",
    body: "灰港报童被服务器新闻提及。",
  }, {
    ...userContext,
    actorExplorerId: "explorer_mentioned",
  });
  const news = core.generateRegionNews({
    regionId: "region_gray_harbor",
    headline: "灰港报童登上区域简报",
    body: "服务器把一条区域发言整理成了公开新闻。",
    legendDelta: 3,
    sourceEventIds: [message.events[0].eventId],
  }, serverContext);

  assert.throws(() => (core as any).claimNewsLegend({
    newsId: news.value.newsId,
    agentId: mentioned.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_bystander",
  }), /legend_claim_owner_mismatch/);
  assert.equal(core.project().resourceBalances[mentioned.value.agentId]?.legend || 0, 0);
});

test("archived identities cannot claim news legend after their lifetime ends", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("legend_archived"),
  });
  const archivedLegendContext = {
    ...userContext,
    actorExplorerId: "explorer_archived_legend",
  };
  const mentioned = core.issueIdentity({
    explorerId: "explorer_archived_legend",
    identityName: "定档报童",
  }, archivedLegendContext);
  const message = (core as any).postMessage({
    agentId: mentioned.value.agentId,
    scope: "region",
    regionId: "region_gray_harbor",
    body: "这条发言稍后才被整理成新闻。",
  }, archivedLegendContext);
  const news = core.generateRegionNews({
    regionId: "region_gray_harbor",
    headline: "定档报童仍被新闻提及",
    body: "服务器新闻提到了一个已经定档的身份。",
    legendDelta: 3,
    sourceEventIds: [message.events[0].eventId],
  }, serverContext);

  core.archiveIdentity({
    agentId: mentioned.value.agentId,
    archiveReason: "寿命结束",
  }, serverContext);

  assert.equal(core.project().identities[mentioned.value.agentId].status, "archived");
  assert.throws(() => (core as any).claimNewsLegend({
    newsId: news.value.newsId,
    agentId: mentioned.value.agentId,
  }, archivedLegendContext), /agent_identity_archived/);
  assert.equal(core.project().resourceBalances[mentioned.value.agentId]?.legend || 0, 0);
});

test("contested objectives spend real resources, rank contributors, and settle rewards server-side", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("contest"),
  });
  const alpha = core.issueIdentity({ explorerId: "explorer_alpha", identityName: "灰港小贩" }, userContext);
  const beta = core.issueIdentity({ explorerId: "explorer_beta", identityName: "盐门跑腿人" }, {
    ...userContext,
    actorExplorerId: "explorer_beta",
  });
  core.grantResource({
    agentId: alpha.value.agentId,
    resourceId: "coin",
    amount: 12,
    reason: "test_seed",
  }, serverContext);
  core.grantResource({
    agentId: beta.value.agentId,
    resourceId: "coin",
    amount: 8,
    reason: "test_seed",
  }, serverContext);

  assert.throws(() => core.createContestedObjective({
    regionId: "region_gray_harbor",
    title: "灰港补给竞标",
    resourceId: "coin",
    targetScore: 20,
    reward: { resourceId: "legend", amount: 2, reason: "objective_winner" },
  }, userContext), /contested_objective_requires_server_trust/);

  const objective = core.createContestedObjective({
    regionId: "region_gray_harbor",
    title: "灰港补给竞标",
    description: "用钱币支援灰港补给线，贡献最高者登上区域榜。",
    resourceId: "coin",
    targetScore: 20,
    reward: { resourceId: "legend", amount: 2, reason: "objective_winner" },
  }, serverContext);
  assert.match(objective.value.objectiveId, /^contest_objective_/);
  assert.equal(objective.value.status, "active");

  const alphaContribution = core.contributeContestedObjective({
    objectiveId: objective.value.objectiveId,
    agentId: alpha.value.agentId,
    amount: 5,
  }, userContext);
  assert.equal(alphaContribution.value.totalScore, 5);
  assert.equal(core.project().resourceBalances[alpha.value.agentId].coin, 7);

  const betaContribution = core.contributeContestedObjective({
    objectiveId: objective.value.objectiveId,
    agentId: beta.value.agentId,
    amount: 8,
  }, { ...userContext, actorExplorerId: "explorer_beta" });
  assert.deepEqual(betaContribution.value.leaderboard.map((standing) => standing.agentId), [
    beta.value.agentId,
    alpha.value.agentId,
  ]);

  assert.throws(() => core.contributeContestedObjective({
    objectiveId: objective.value.objectiveId,
    agentId: alpha.value.agentId,
    amount: 99,
  }, userContext), /resource_insufficient/);

  const settled = core.settleContestedObjective({
    objectiveId: objective.value.objectiveId,
  }, serverContext);
  assert.equal(settled.value.status, "settled");
  assert.equal(settled.value.winnerAgentId, beta.value.agentId);
  assert.equal(core.project().resourceBalances[beta.value.agentId].legend, 2);
  const objectiveInfluence = Object.values(core.project().regionInfluenceChanges)
    .find((change) => change.sourceAggregateId === objective.value.objectiveId);
  assert.equal(objectiveInfluence?.regionId, "region_gray_harbor");
  assert.equal(objectiveInfluence?.agentId, beta.value.agentId);
  assert.equal(objectiveInfluence?.sourceEventType, "contested_objective_settled");
  assert.equal(objectiveInfluence?.influenceDelta, 8);
  const objectiveTrace = Object.values(core.project().conflictTraces)
    .find((trace) => trace.sourceAggregateId === objective.value.objectiveId);
  assert.equal(objectiveTrace?.regionId, "region_gray_harbor");
  assert.equal(objectiveTrace?.sourceEventType, "contested_objective_settled");
  assert.ok(objectiveTrace?.sourceEventIds.includes(objectiveInfluence?.sourceEventId || ""));
  assert.ok(objectiveTrace?.relatedInfluenceIds.includes(objectiveInfluence?.influenceId || ""));
  assert.deepEqual(objectiveTrace?.participantAgentIds, [beta.value.agentId, alpha.value.agentId]);
  assert.throws(() => core.contributeContestedObjective({
    objectiveId: objective.value.objectiveId,
    agentId: alpha.value.agentId,
    amount: 1,
  }, userContext), /contested_objective_settled/);
});

test("race commissions lock the first server-finished identity and cap later rewards", () => {
  const core = createEpochGameCore({
    clock: () => new Date("2026-06-25T00:00:00.000Z"),
    idFactory: createSequentialEpochIdFactory("race"),
  });
  const alpha = core.issueIdentity({ explorerId: "explorer_race_alpha" }, {
    ...userContext,
    actorExplorerId: "explorer_race_alpha",
  });
  const beta = core.issueIdentity({ explorerId: "explorer_race_beta" }, {
    ...userContext,
    actorExplorerId: "explorer_race_beta",
  });
  for (const identity of [alpha.value, beta.value]) {
    core.grantResource({
      agentId: identity.agentId,
      resourceId: "focus",
      amount: 5,
      reason: "race_seed",
    }, serverContext);
  }
  const objective = core.createContestedObjective({
    regionId: "region_gray_harbor",
    title: "灰痕竞速委托",
    resourceId: "focus",
    targetScore: 9,
    mode: "race",
    reward: { resourceId: "legend", amount: 4, reason: "race_first" },
    consolationReward: { resourceId: "aether", amount: 1, reason: "race_later" },
  }, serverContext);

  const first = core.contributeContestedObjective({
    objectiveId: objective.value.objectiveId,
    agentId: alpha.value.agentId,
    amount: 3,
  }, { ...userContext, actorExplorerId: "explorer_race_alpha" });
  assert.deepEqual(first.value.raceCompletions.map((completion) => completion.agentId), [alpha.value.agentId]);
  assert.equal(first.value.raceCompletions[0]?.place, 1);
  assert.equal(core.project().resourceBalances[alpha.value.agentId].legend, 4);

  const later = core.contributeContestedObjective({
    objectiveId: objective.value.objectiveId,
    agentId: beta.value.agentId,
    amount: 4,
  }, { ...userContext, actorExplorerId: "explorer_race_beta" });
  assert.deepEqual(later.value.raceCompletions.map((completion) => completion.place), [1, 2]);
  assert.equal(core.project().resourceBalances[beta.value.agentId].aether, 1);
  assert.equal(later.value.leaderboard[0]?.agentId, beta.value.agentId);

  const settled = core.settleContestedObjective({ objectiveId: objective.value.objectiveId }, serverContext);
  assert.equal(settled.value.winnerAgentId, alpha.value.agentId);
  assert.equal(core.project().resourceBalances[alpha.value.agentId].legend, 4);
  assert.equal(settled.events.filter((event) => event.eventType === "resource_granted").length, 0);
});

test("market orders lock listed resources, transfer payment on fill, and refund on cancel", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("market"),
  });
  assert.equal(typeof core.createMarketOrder, "function");

  const seller = core.issueIdentity({ explorerId: "explorer_seller", identityName: "灰港卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_seller",
  });
  const buyer = core.issueIdentity({ explorerId: "explorer_buyer", identityName: "盐门买家" }, {
    ...userContext,
    actorExplorerId: "explorer_buyer",
  });
  core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 4,
    reason: "market_seed",
  }, serverContext);
  core.grantResource({
    agentId: buyer.value.agentId,
    resourceId: "coin",
    amount: 20,
    reason: "market_seed",
  }, serverContext);

  const order = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    regionId: "region_gray_harbor",
    sellResourceId: "aether",
    sellAmount: 3,
    priceResourceId: "coin",
    priceAmount: 9,
  }, {
    ...userContext,
    actorExplorerId: "explorer_seller",
  });

  assert.equal(order.value.status, "open");
  assert.equal(order.value.regionId, "region_gray_harbor");
  assert.equal(core.project().resourceBalances[seller.value.agentId].aether, 1);

  const filled = core.fillMarketOrder({
    orderId: order.value.orderId,
    buyerAgentId: buyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_buyer",
  });

  assert.equal(filled.value.status, "filled");
  assert.equal(filled.value.regionId, "region_gray_harbor");
  assert.equal(filled.value.buyerAgentId, buyer.value.agentId);
  assert.equal(core.project().resourceBalances[buyer.value.agentId].aether, 3);
  assert.equal(core.project().resourceBalances[buyer.value.agentId].coin, 11);
  assert.equal(core.project().resourceBalances[seller.value.agentId].coin, 9);
  assert.throws(() => core.fillMarketOrder({
    orderId: order.value.orderId,
    buyerAgentId: buyer.value.agentId,
  }, userContext), /market_order_not_open/);

  const refundOrder = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    regionId: "region_gray_harbor",
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 4,
  }, {
    ...userContext,
    actorExplorerId: "explorer_seller",
  });
  const cancelled = core.cancelMarketOrder({
    orderId: refundOrder.value.orderId,
    sellerAgentId: seller.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_seller",
  });
  assert.equal(cancelled.value.status, "cancelled");
  assert.equal(cancelled.value.regionId, "region_gray_harbor");
  assert.equal(core.project().resourceBalances[seller.value.agentId].aether, 1);
  const marketActivities = ((core.project() as any).regionActivityIdsByRegion.region_gray_harbor || [])
    .map((activityId: string) => (core.project() as any).regionActivities[activityId]);
  for (const sourceEventType of [
    "market_order_created",
    "market_order_filled",
    "market_order_cancelled",
  ]) {
    assert.ok(marketActivities.some((activity: { sourceEventType: string }) => activity.sourceEventType === sourceEventType));
  }
});

test("market orders cannot double-lock the same seller resource balance", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("market_double_lock"),
  });
  const sellerContext = {
    ...userContext,
    actorExplorerId: "explorer_double_lock_seller",
  };
  const seller = core.issueIdentity({
    explorerId: "explorer_double_lock_seller",
    identityName: "锁仓测试卖家",
  }, sellerContext);
  core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "market_double_lock_seed",
  }, serverContext);

  const firstOrder = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    regionId: "region_gray_harbor",
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 3,
  }, sellerContext);
  assert.equal(firstOrder.value.status, "open");
  assert.equal(core.project().resourceBalances[seller.value.agentId].aether, 0);

  assert.throws(() => core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    regionId: "region_gray_harbor",
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 3,
  }, sellerContext), /resource_insufficient/);

  const projected = core.project();
  const openOrders = Object.values(projected.marketOrders)
    .filter((order) => order.status === "open");
  assert.equal(openOrders.length, 1);
  assert.equal(openOrders[0].orderId, firstOrder.value.orderId);
  assert.equal(projected.resourceBalances[seller.value.agentId].aether, 0);
});

test("market order writes reject actors that do not own the spending identity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("market_owner"),
  });
  const sellerContext = {
    ...userContext,
    actorExplorerId: "explorer_market_seller",
  };
  const buyerContext = {
    ...userContext,
    actorExplorerId: "explorer_market_buyer",
  };
  const seller = core.issueIdentity({ explorerId: "explorer_market_seller", identityName: "灰港卖家" }, sellerContext);
  const buyer = core.issueIdentity({ explorerId: "explorer_market_buyer", identityName: "盐门买家" }, buyerContext);
  core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 2,
    reason: "market_owner_seed",
  }, serverContext);
  core.grantResource({
    agentId: buyer.value.agentId,
    resourceId: "coin",
    amount: 10,
    reason: "market_owner_seed",
  }, serverContext);

  assert.throws(() => core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 4,
  }, buyerContext), /market_order_seller_owner_mismatch/);
  assert.equal(core.project().resourceBalances[seller.value.agentId].aether, 2);

  const order = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 4,
  }, sellerContext);

  assert.throws(() => core.fillMarketOrder({
    orderId: order.value.orderId,
    buyerAgentId: buyer.value.agentId,
  }, sellerContext), /market_order_buyer_owner_mismatch/);
  assert.equal(core.project().resourceBalances[buyer.value.agentId].coin, 10);
  assert.equal(core.project().resourceBalances[buyer.value.agentId].aether || 0, 0);
  assert.equal(core.project().marketOrders[order.value.orderId].status, "open");

  assert.throws(() => core.cancelMarketOrder({
    orderId: order.value.orderId,
    sellerAgentId: seller.value.agentId,
  }, buyerContext), /market_order_seller_owner_mismatch/);
  assert.equal(core.project().marketOrders[order.value.orderId].status, "open");
  assert.equal(core.project().resourceBalances[seller.value.agentId].aether, 1);
});

test("market order fills reject same-explorer self-dealing across separate identities", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("market_same_explorer"),
  });
  const ownerContext = {
    ...userContext,
    actorExplorerId: "explorer_market_same_owner",
  };
  const seller = core.issueIdentity({
    explorerId: "explorer_market_same_owner",
    identityName: "同主体卖家身份",
  }, ownerContext);
  core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "legend",
    amount: 3,
    reason: "market_same_explorer_slot_unlock",
  }, serverContext);
  const buyer = core.issueIdentity({
    explorerId: "explorer_market_same_owner",
    identityName: "同主体买家身份",
  }, ownerContext);
  core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "market_same_explorer_seed",
  }, serverContext);
  core.grantResource({
    agentId: buyer.value.agentId,
    resourceId: "coin",
    amount: 10,
    reason: "market_same_explorer_seed",
  }, serverContext);

  const order = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 4,
  }, ownerContext);

  assert.throws(() => core.fillMarketOrder({
    orderId: order.value.orderId,
    buyerAgentId: buyer.value.agentId,
  }, ownerContext), /market_same_explorer_fill_not_allowed/);
  assert.equal(core.project().marketOrders[order.value.orderId].status, "open");
  assert.equal(core.project().resourceBalances[buyer.value.agentId].coin, 10);
  assert.equal(core.project().resourceBalances[buyer.value.agentId].aether || 0, 0);
  assert.equal(core.project().resourceBalances[seller.value.agentId].coin || 0, 0);
});

test("market order fills apply server-calculated trade fees as a resource sink", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("market_fee"),
  });
  const seller = core.issueIdentity({ explorerId: "explorer_fee_seller", identityName: "税契卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_fee_seller",
  });
  const buyer = core.issueIdentity({ explorerId: "explorer_fee_buyer", identityName: "税契买家" }, {
    ...userContext,
    actorExplorerId: "explorer_fee_buyer",
  });
  core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "market_fee_seed",
  }, serverContext);
  core.grantResource({
    agentId: buyer.value.agentId,
    resourceId: "coin",
    amount: 100,
    reason: "market_fee_seed",
  }, serverContext);

  const order = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 40,
  }, {
    ...userContext,
    actorExplorerId: "explorer_fee_seller",
  });
  const filled = core.fillMarketOrder({
    orderId: order.value.orderId,
    buyerAgentId: buyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_fee_buyer",
  });

  assert.equal(filled.value.marketFeeResourceId, "coin");
  assert.equal(filled.value.marketFeeAmount, 2);
  assert.equal(filled.value.sellerProceedsAmount, 38);
  assert.equal(core.project().resourceBalances[buyer.value.agentId].coin, 60);
  assert.equal(core.project().resourceBalances[buyer.value.agentId].aether, 1);
  assert.equal(core.project().resourceBalances[seller.value.agentId].coin, 38);
  assert.equal(core.project().resourceBalances[seller.value.agentId].aether, 0);
  const filledEvent = filled.events.find((event) => event.eventType === "market_order_filled");
  assert.equal(filledEvent?.payload.marketFeeAmount, 2);
  assert.equal(filledEvent?.payload.sellerProceedsAmount, 38);
});

test("market order fills flag repeated counterparty trades for anti-collusion review", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("market_risk"),
  });
  const seller = core.issueIdentity({ explorerId: "explorer_risk_seller", identityName: "互市卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_risk_seller",
  });
  const buyer = core.issueIdentity({ explorerId: "explorer_risk_buyer", identityName: "互市买家" }, {
    ...userContext,
    actorExplorerId: "explorer_risk_buyer",
  });
  core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 2,
    reason: "market_risk_seed",
  }, serverContext);
  core.grantResource({
    agentId: buyer.value.agentId,
    resourceId: "coin",
    amount: 80,
    reason: "market_risk_seed",
  }, serverContext);

  const firstOrder = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 20,
  }, {
    ...userContext,
    actorExplorerId: "explorer_risk_seller",
  });
  const firstFill = core.fillMarketOrder({
    orderId: firstOrder.value.orderId,
    buyerAgentId: buyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_risk_buyer",
  });
  assert.deepEqual(firstFill.value.tradeRiskFlags, []);
  assert.equal(firstFill.value.tradeRiskScore, 0);

  time.set("2026-06-25T00:30:00.000Z");
  const secondOrder = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 20,
  }, {
    ...userContext,
    actorExplorerId: "explorer_risk_seller",
  });
  const secondFill = core.fillMarketOrder({
    orderId: secondOrder.value.orderId,
    buyerAgentId: buyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_risk_buyer",
  });
  assert.deepEqual(secondFill.value.tradeRiskFlags, ["repeat_counterparty_trade"]);
  assert.equal(secondFill.value.tradeRiskScore, 1);
  const filledEvent = secondFill.events.find((event) => event.eventType === "market_order_filled");
  assert.deepEqual(filledEvent?.payload.tradeRiskFlags, ["repeat_counterparty_trade"]);
  assert.equal(filledEvent?.payload.tradeRiskScore, 1);
});

test("market order fills flag suspicious prices against recent market history", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("market_price_risk"),
  });
  const fairSeller = core.issueIdentity({ explorerId: "explorer_price_fair_seller", identityName: "基准卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_price_fair_seller",
  });
  const fairBuyer = core.issueIdentity({ explorerId: "explorer_price_fair_buyer", identityName: "基准买家" }, {
    ...userContext,
    actorExplorerId: "explorer_price_fair_buyer",
  });
  const lowSeller = core.issueIdentity({ explorerId: "explorer_price_low_seller", identityName: "低价卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_price_low_seller",
  });
  const lowBuyer = core.issueIdentity({ explorerId: "explorer_price_low_buyer", identityName: "低价买家" }, {
    ...userContext,
    actorExplorerId: "explorer_price_low_buyer",
  });
  const highSeller = core.issueIdentity({ explorerId: "explorer_price_high_seller", identityName: "高价卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_price_high_seller",
  });
  const highBuyer = core.issueIdentity({ explorerId: "explorer_price_high_buyer", identityName: "高价买家" }, {
    ...userContext,
    actorExplorerId: "explorer_price_high_buyer",
  });

  for (const seller of [fairSeller, lowSeller, highSeller]) {
    core.grantResource({
      agentId: seller.value.agentId,
      resourceId: "aether",
      amount: 1,
      reason: "market_price_risk_seed",
    }, serverContext);
  }
  for (const buyer of [fairBuyer, lowBuyer, highBuyer]) {
    core.grantResource({
      agentId: buyer.value.agentId,
      resourceId: "coin",
      amount: 200,
      reason: "market_price_risk_seed",
    }, serverContext);
  }

  const fairOrder = core.createMarketOrder({
    sellerAgentId: fairSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 20,
  }, {
    ...userContext,
    actorExplorerId: "explorer_price_fair_seller",
  });
  const fairFill = core.fillMarketOrder({
    orderId: fairOrder.value.orderId,
    buyerAgentId: fairBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_price_fair_buyer",
  });
  assert.deepEqual(fairFill.value.tradeRiskFlags, []);

  time.set("2026-06-25T00:10:00.000Z");
  const lowOrder = core.createMarketOrder({
    sellerAgentId: lowSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 5,
  }, {
    ...userContext,
    actorExplorerId: "explorer_price_low_seller",
  });
  const lowFill = core.fillMarketOrder({
    orderId: lowOrder.value.orderId,
    buyerAgentId: lowBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_price_low_buyer",
  });
  assert.deepEqual(lowFill.value.tradeRiskFlags, ["suspicious_low_price"]);
  assert.equal(lowFill.value.tradeRiskScore, 1);

  time.set("2026-06-25T00:20:00.000Z");
  const highOrder = core.createMarketOrder({
    sellerAgentId: highSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 60,
  }, {
    ...userContext,
    actorExplorerId: "explorer_price_high_seller",
  });
  const highFill = core.fillMarketOrder({
    orderId: highOrder.value.orderId,
    buyerAgentId: highBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_price_high_buyer",
  });
  assert.deepEqual(highFill.value.tradeRiskFlags, ["suspicious_high_price"]);
  assert.equal(highFill.value.tradeRiskScore, 1);
});

test("risk review disposition records operator decisions for flagged events", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("risk_review"),
  });
  const reviewer = core as unknown as {
    recordRiskReview: (input: { sourceEventId: string; resolution: string; note?: string }, context: EpochCommandContext) => {
      events: readonly { eventType: string }[];
      value: {
        reviewId: string;
        sourceEventId: string;
        agentId?: string;
        explorerId?: string;
        resolution: string;
        reviewFlags: readonly string[];
        reviewScore: number;
        operatorId: string;
        note?: string;
      };
      projection: {
        riskReviews: Record<string, unknown>;
        riskReviewIdsBySourceEvent: Record<string, readonly string[]>;
      };
    };
  };
  assert.equal(typeof reviewer.recordRiskReview, "function");

  const fairSeller = core.issueIdentity({ explorerId: "explorer_review_fair_seller", identityName: "处置基准卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_review_fair_seller",
  });
  const fairBuyer = core.issueIdentity({ explorerId: "explorer_review_fair_buyer", identityName: "处置基准买家" }, {
    ...userContext,
    actorExplorerId: "explorer_review_fair_buyer",
  });
  const riskSeller = core.issueIdentity({ explorerId: "explorer_review_risk_seller", identityName: "处置风险卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_review_risk_seller",
  });
  const riskBuyer = core.issueIdentity({ explorerId: "explorer_review_risk_buyer", identityName: "处置风险买家" }, {
    ...userContext,
    actorExplorerId: "explorer_review_risk_buyer",
  });
  for (const seller of [fairSeller, riskSeller]) {
    core.grantResource({
      agentId: seller.value.agentId,
      resourceId: "aether",
      amount: 1,
      reason: "risk_review_seed",
    }, serverContext);
  }
  for (const buyer of [fairBuyer, riskBuyer]) {
    core.grantResource({
      agentId: buyer.value.agentId,
      resourceId: "coin",
      amount: 40,
      reason: "risk_review_seed",
    }, serverContext);
  }

  const fairOrder = core.createMarketOrder({
    sellerAgentId: fairSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 20,
  }, {
    ...userContext,
    actorExplorerId: "explorer_review_fair_seller",
  });
  core.fillMarketOrder({
    orderId: fairOrder.value.orderId,
    buyerAgentId: fairBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_review_fair_buyer",
  });

  time.set("2026-06-25T00:10:00.000Z");
  const riskOrder = core.createMarketOrder({
    sellerAgentId: riskSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 5,
  }, {
    ...userContext,
    actorExplorerId: "explorer_review_risk_seller",
  });
  const riskFill = core.fillMarketOrder({
    orderId: riskOrder.value.orderId,
    buyerAgentId: riskBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_review_risk_buyer",
  });
  const riskEvent = riskFill.events.find((event) => event.eventType === "market_order_filled");
  assert.ok(riskEvent);

  assert.throws(() => reviewer.recordRiskReview({
    sourceEventId: riskEvent.eventId,
    resolution: "watchlisted",
  }, userContext), /risk_review_requires_server_trust/);

  const reviewed = reviewer.recordRiskReview({
    sourceEventId: riskEvent.eventId,
    resolution: "watchlisted",
    note: "monitor this trade pair",
  }, {
    ...serverContext,
    actorExplorerId: "operator_1",
  });
  assert.equal(reviewed.value.sourceEventId, riskEvent.eventId);
  assert.equal(reviewed.value.agentId, riskEvent.agentId);
  assert.equal(reviewed.value.explorerId, riskEvent.actorExplorerId);
  assert.equal(reviewed.value.resolution, "watchlisted");
  assert.deepEqual(reviewed.value.reviewFlags, ["suspicious_low_price"]);
  assert.equal(reviewed.value.reviewScore, 1);
  assert.equal(reviewed.value.operatorId, "operator_1");
  assert.equal(reviewed.value.note, "monitor this trade pair");
  assert.ok(reviewed.events.some((event) => event.eventType === "risk_review_recorded"));
  assert.deepEqual(reviewed.projection.riskReviewIdsBySourceEvent[riskEvent.eventId], [reviewed.value.reviewId]);

  const duplicate = reviewer.recordRiskReview({
    sourceEventId: riskEvent.eventId,
    resolution: "escalated",
  }, {
    ...serverContext,
    actorExplorerId: "operator_2",
  });
  assert.equal(duplicate.events.length, 0);
  assert.equal(duplicate.value.reviewId, reviewed.value.reviewId);
  assert.equal(duplicate.value.resolution, "watchlisted");
});

test("escalated risk review restricts reviewed agents from new market trades", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("risk_market_restriction"),
  });
  const fairSeller = core.issueIdentity({ explorerId: "explorer_restrict_fair_seller", identityName: "限制基准卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_restrict_fair_seller",
  });
  const fairBuyer = core.issueIdentity({ explorerId: "explorer_restrict_fair_buyer", identityName: "限制基准买家" }, {
    ...userContext,
    actorExplorerId: "explorer_restrict_fair_buyer",
  });
  const riskSeller = core.issueIdentity({ explorerId: "explorer_restrict_risk_seller", identityName: "限制风险卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_restrict_risk_seller",
  });
  const riskBuyer = core.issueIdentity({ explorerId: "explorer_restrict_risk_buyer", identityName: "限制风险买家" }, {
    ...userContext,
    actorExplorerId: "explorer_restrict_risk_buyer",
  });
  for (const seller of [fairSeller, riskSeller]) {
    core.grantResource({
      agentId: seller.value.agentId,
      resourceId: "aether",
      amount: 2,
      reason: "risk_restriction_seed",
    }, serverContext);
  }
  for (const buyer of [fairBuyer, riskBuyer]) {
    core.grantResource({
      agentId: buyer.value.agentId,
      resourceId: "coin",
      amount: 50,
      reason: "risk_restriction_seed",
    }, serverContext);
  }

  const fairOrder = core.createMarketOrder({
    sellerAgentId: fairSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 20,
  }, {
    ...userContext,
    actorExplorerId: fairSeller.value.explorerId,
  });
  core.fillMarketOrder({
    orderId: fairOrder.value.orderId,
    buyerAgentId: fairBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: fairBuyer.value.explorerId,
  });

  time.set("2026-06-25T00:10:00.000Z");
  const riskOrder = core.createMarketOrder({
    sellerAgentId: riskSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 5,
  }, {
    ...userContext,
    actorExplorerId: riskSeller.value.explorerId,
  });
  const riskFill = core.fillMarketOrder({
    orderId: riskOrder.value.orderId,
    buyerAgentId: riskBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: riskBuyer.value.explorerId,
  });
  const riskEvent = riskFill.events.find((event) => event.eventType === "market_order_filled");
  assert.ok(riskEvent);

  const reviewed = core.recordRiskReview({
    sourceEventId: riskEvent.eventId,
    resolution: "escalated",
    note: "restrict suspicious market actor",
  }, {
    ...serverContext,
    actorExplorerId: "operator_restrict",
  });
  assert.equal(reviewed.projection.marketRiskRestrictions[riskBuyer.value.agentId].sourceReviewId, reviewed.value.reviewId);

  assert.throws(() => core.createMarketOrder({
    sellerAgentId: riskBuyer.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 15,
  }, {
    ...userContext,
    actorExplorerId: riskBuyer.value.explorerId,
  }), /market_agent_restricted/);

  const nextFairOrder = core.createMarketOrder({
    sellerAgentId: fairSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 20,
  }, {
    ...userContext,
    actorExplorerId: fairSeller.value.explorerId,
  });
  assert.throws(() => core.fillMarketOrder({
    orderId: nextFairOrder.value.orderId,
    buyerAgentId: riskBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: riskBuyer.value.explorerId,
  }), /market_agent_restricted/);
});

test("operator release lifts escalated market risk restriction", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("risk_market_release"),
  });
  const restrictedCore = core as unknown as {
    releaseMarketRiskRestriction: (input: { agentId: string; note?: string }, context: EpochCommandContext) => {
      events: readonly { eventType: string }[];
      value: {
        releaseId: string;
        agentId: string;
        sourceReviewId: string;
        releasedBy: string;
        note?: string;
      };
      projection: {
        marketRiskRestrictions: Record<string, unknown>;
      };
    };
  };
  const fairSeller = core.issueIdentity({ explorerId: "explorer_release_fair_seller", identityName: "解限基准卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_release_fair_seller",
  });
  const fairBuyer = core.issueIdentity({ explorerId: "explorer_release_fair_buyer", identityName: "解限基准买家" }, {
    ...userContext,
    actorExplorerId: "explorer_release_fair_buyer",
  });
  const riskSeller = core.issueIdentity({ explorerId: "explorer_release_risk_seller", identityName: "解限风险卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_release_risk_seller",
  });
  const riskBuyer = core.issueIdentity({ explorerId: "explorer_release_risk_buyer", identityName: "解限风险买家" }, {
    ...userContext,
    actorExplorerId: "explorer_release_risk_buyer",
  });
  for (const seller of [fairSeller, riskSeller]) {
    core.grantResource({
      agentId: seller.value.agentId,
      resourceId: "aether",
      amount: 2,
      reason: "risk_release_seed",
    }, serverContext);
  }
  for (const buyer of [fairBuyer, riskBuyer]) {
    core.grantResource({
      agentId: buyer.value.agentId,
      resourceId: "coin",
      amount: 50,
      reason: "risk_release_seed",
    }, serverContext);
  }

  const fairOrder = core.createMarketOrder({
    sellerAgentId: fairSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 20,
  }, {
    ...userContext,
    actorExplorerId: fairSeller.value.explorerId,
  });
  core.fillMarketOrder({
    orderId: fairOrder.value.orderId,
    buyerAgentId: fairBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: fairBuyer.value.explorerId,
  });

  time.set("2026-06-25T00:10:00.000Z");
  const riskOrder = core.createMarketOrder({
    sellerAgentId: riskSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 5,
  }, {
    ...userContext,
    actorExplorerId: riskSeller.value.explorerId,
  });
  const riskFill = core.fillMarketOrder({
    orderId: riskOrder.value.orderId,
    buyerAgentId: riskBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: riskBuyer.value.explorerId,
  });
  const riskEvent = riskFill.events.find((event) => event.eventType === "market_order_filled");
  assert.ok(riskEvent);
  const reviewed = core.recordRiskReview({
    sourceEventId: riskEvent.eventId,
    resolution: "escalated",
  }, {
    ...serverContext,
    actorExplorerId: "operator_release_restrict",
  });
  assert.ok(reviewed.projection.marketRiskRestrictions[riskBuyer.value.agentId]);

  assert.throws(() => restrictedCore.releaseMarketRiskRestriction({
    agentId: riskBuyer.value.agentId,
  }, userContext), /market_risk_restriction_release_requires_server_trust/);

  const released = restrictedCore.releaseMarketRiskRestriction({
    agentId: riskBuyer.value.agentId,
    note: "manual review cleared the account",
  }, {
    ...serverContext,
    actorExplorerId: "operator_release_clear",
  });
  assert.equal(released.value.agentId, riskBuyer.value.agentId);
  assert.equal(released.value.sourceReviewId, reviewed.value.reviewId);
  assert.equal(released.value.releasedBy, "operator_release_clear");
  assert.equal(released.value.note, "manual review cleared the account");
  assert.ok(released.events.some((event) => event.eventType === "market_risk_restriction_released"));
  assert.equal(released.projection.marketRiskRestrictions[riskBuyer.value.agentId], undefined);

  const nextFairOrder = core.createMarketOrder({
    sellerAgentId: fairSeller.value.agentId,
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 20,
  }, {
    ...userContext,
    actorExplorerId: fairSeller.value.explorerId,
  });
  const filledAfterRelease = core.fillMarketOrder({
    orderId: nextFairOrder.value.orderId,
    buyerAgentId: riskBuyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: riskBuyer.value.explorerId,
  });
  assert.equal(filledAfterRelease.value.buyerAgentId, riskBuyer.value.agentId);
});

test("market expiry tick is server scheduled and refunds stale open orders", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("market_tick"),
  });
  assert.equal(typeof (core as { tickMarketExpiry?: unknown }).tickMarketExpiry, "function");

  const seller = core.issueIdentity({ explorerId: "explorer_seller", identityName: "灰港卖家" }, {
    ...userContext,
    actorExplorerId: "explorer_seller",
  });
  core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 5,
    reason: "market_tick_seed",
  }, serverContext);

  const staleOrder = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    regionId: "region_gray_harbor",
    sellResourceId: "aether",
    sellAmount: 3,
    priceResourceId: "coin",
    priceAmount: 6,
  }, {
    ...userContext,
    actorExplorerId: "explorer_seller",
  });

  time.set("2026-06-25T01:30:00.000Z");
  const freshOrder = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    regionId: "region_gray_harbor",
    sellResourceId: "aether",
    sellAmount: 1,
    priceResourceId: "coin",
    priceAmount: 2,
  }, {
    ...userContext,
    actorExplorerId: "explorer_seller",
  });
  assert.equal(core.project().resourceBalances[seller.value.agentId].aether, 1);

  assert.throws(() => (core as any).tickMarketExpiry({
    maxAgeSeconds: 3_600,
  }, userContext), /market_expiry_tick_requires_server_trust/);

  time.set("2026-06-25T02:00:00.000Z");
  const ticked = (core as any).tickMarketExpiry({
    maxAgeSeconds: 3_600,
    limit: 10,
  }, serverContext);

  assert.equal(ticked.value.updated.length, 1);
  assert.equal(ticked.value.updated[0].orderId, staleOrder.value.orderId);
  assert.equal(ticked.value.updated[0].status, "expired");
  assert.deepEqual(ticked.events.map((event: { eventType: string }) => event.eventType), [
    "resource_granted",
    "market_order_expired",
  ]);
  assert.equal(core.project().marketOrders[staleOrder.value.orderId].status, "expired");
  assert.equal(core.project().marketOrders[staleOrder.value.orderId].regionId, "region_gray_harbor");
  assert.equal(core.project().marketOrders[freshOrder.value.orderId].status, "open");
  assert.equal(core.project().resourceBalances[seller.value.agentId].aether, 4);
  const expiredActivity = ((core.project() as any).regionActivityIdsByRegion.region_gray_harbor || [])
    .map((activityId: string) => (core.project() as any).regionActivities[activityId])
    .find((activity: { sourceEventType: string }) => activity.sourceEventType === "market_order_expired");
  assert.equal(expiredActivity?.sourceEventId, ticked.events.find((event: { eventType: string }) => event.eventType === "market_order_expired")?.eventId);
});

test("bounties escrow rewards and settle claims server-side", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("bounty"),
  });

  const sponsor = core.issueIdentity({ explorerId: "explorer_sponsor", identityName: "悬赏发布人" }, {
    ...userContext,
    actorExplorerId: "explorer_sponsor",
  });
  const hunter = core.issueIdentity({ explorerId: "explorer_hunter", identityName: "灰港猎手" }, {
    ...userContext,
    actorExplorerId: "explorer_hunter",
  });
  core.grantResource({
    agentId: sponsor.value.agentId,
    resourceId: "coin",
    amount: 12,
    reason: "bounty_seed",
  }, serverContext);
  core.grantResource({
    agentId: hunter.value.agentId,
    resourceId: "coin",
    amount: 3,
    reason: "bounty_procurement_seed",
  }, serverContext);
  const purchased = (core as any).purchaseShopOffer({
    agentId: hunter.value.agentId,
    offerId: "gray-ration-pack",
  }, {
    ...userContext,
    actorExplorerId: "explorer_hunter",
  });

  const bounty = core.createBounty({
    sponsorAgentId: sponsor.value.agentId,
    regionId: "region_gray_harbor",
    title: "追查灰港偷渡痕迹",
    rewardResourceId: "coin",
    rewardAmount: 7,
    requiredItemKey: "shop:gray-ration-pack",
  }, {
    ...userContext,
    actorExplorerId: "explorer_sponsor",
  });

  assert.equal(bounty.value.status, "open");
  assert.equal(bounty.value.rewardAmount, 7);
  assert.equal(bounty.value.requiredItemKey, "shop:gray-ration-pack");
  assert.equal(core.project().resourceBalances[sponsor.value.agentId].coin, 5);
  assert.ok(bounty.events.some((event) => event.eventType === "bounty_created"));
  assert.ok(bounty.events.some((event) => event.eventType === "resource_spent"));

  assert.throws(() => core.claimBounty({
    bountyId: bounty.value.bountyId,
    claimantAgentId: hunter.value.agentId,
    evidence: "只提交文本，不提交服务器物品。",
  }, {
    ...userContext,
    actorExplorerId: "explorer_hunter",
  }), /bounty_fulfillment_item_required/);

  const claimed = core.claimBounty({
    bountyId: bounty.value.bountyId,
    claimantAgentId: hunter.value.agentId,
    fulfillmentItemId: purchased.value.itemId,
    evidence: "提交服务器可审计的灰港路线记录。",
    clientDeclaredReward: { resourceId: "legend", amount: 999 },
  } as Parameters<typeof core.claimBounty>[0], {
    ...userContext,
    actorExplorerId: "explorer_hunter",
  });

  assert.equal(claimed.value.status, "claimed");
  assert.equal(claimed.value.claimantAgentId, hunter.value.agentId);
  assert.equal(claimed.value.transferredItemId, purchased.value.itemId);
  assert.equal(core.project().resourceBalances[hunter.value.agentId].coin, 7);
  assert.equal(core.project().resourceBalances[hunter.value.agentId].legend || 0, 0);
  assert.ok(claimed.events.some((event) => event.eventType === "item_transferred"));
  assert.ok(claimed.events.some((event) => event.eventType === "bounty_claimed"));
  assert.equal((core.project() as any).inventoryItems[purchased.value.itemId].agentId, sponsor.value.agentId);
  assert.equal((core.project() as any).inventoryItems[purchased.value.itemId].transferSourceOrderId, bounty.value.bountyId);
  const bountyInfluence = Object.values(core.project().regionInfluenceChanges)
    .find((influence) => influence.sourceAggregateId === bounty.value.bountyId);
  const claimedEvent = claimed.events.find((event) => event.eventType === "bounty_claimed");
  assert.equal(bountyInfluence?.regionId, "region_gray_harbor");
  assert.equal(bountyInfluence?.agentId, hunter.value.agentId);
  assert.equal(bountyInfluence?.explorerId, "explorer_hunter");
  assert.equal(bountyInfluence?.influenceDelta, 7);
  assert.equal(bountyInfluence?.influenceScoreAfter, 7);
  assert.equal(bountyInfluence?.sourceEventId, claimedEvent?.eventId);
  assert.equal(bountyInfluence?.sourceEventType, "bounty_claimed");
  assert.equal(bountyInfluence?.sourceAggregateId, bounty.value.bountyId);
  const bountyTrace = Object.values(core.project().conflictTraces)
    .find((trace) => trace.sourceAggregateId === bounty.value.bountyId);
  assert.equal(bountyTrace?.regionId, "region_gray_harbor");
  assert.equal(bountyTrace?.sourceEventType, "bounty_claimed");
  assert.deepEqual(bountyTrace?.participantAgentIds, [sponsor.value.agentId, hunter.value.agentId]);
  assert.deepEqual(bountyTrace?.relatedInfluenceIds, [bountyInfluence?.influenceId]);

  const runtime = createEpochRuntime({ initialEvents: core.events() });
  const region = runtime.regionInfo({ regionId: "region_gray_harbor" });
  assert.equal(region.influenceChanges[0].sourceEventType, "bounty_claimed");
  assert.equal(region.influenceChanges[0].sourceAggregateId, bounty.value.bountyId);
  assert.equal(region.influenceChanges[0].influenceDelta, 7);
  assert.equal(region.leaderboard[0].agentId, hunter.value.agentId);
  assert.equal(region.leaderboard[0].influenceScore, 7);
  assert.equal(region.leaderboard[0].bountyScore, 7);
  assert.equal(region.leaderboard[0].sourceEventIds.includes(claimedEvent?.eventId || ""), true);

  assert.throws(() => core.claimBounty({
    bountyId: bounty.value.bountyId,
    claimantAgentId: hunter.value.agentId,
    evidence: "重复领取",
  }, userContext), /bounty_not_open/);
});

test("bounty writes reject actors that do not own the spending identity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("bounty_owner"),
  });
  const sponsorContext = {
    ...userContext,
    actorExplorerId: "explorer_bounty_sponsor",
  };
  const hunterContext = {
    ...userContext,
    actorExplorerId: "explorer_bounty_hunter",
  };
  const sponsor = core.issueIdentity({ explorerId: "explorer_bounty_sponsor", identityName: "悬赏发布人" }, sponsorContext);
  const hunter = core.issueIdentity({ explorerId: "explorer_bounty_hunter", identityName: "灰港猎手" }, hunterContext);
  core.grantResource({
    agentId: sponsor.value.agentId,
    resourceId: "coin",
    amount: 10,
    reason: "bounty_owner_seed",
  }, serverContext);

  assert.throws(() => core.createBounty({
    sponsorAgentId: sponsor.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港错领测试",
    rewardResourceId: "coin",
    rewardAmount: 4,
  }, hunterContext), /bounty_sponsor_owner_mismatch/);
  assert.equal(core.project().resourceBalances[sponsor.value.agentId].coin, 10);

  const bounty = core.createBounty({
    sponsorAgentId: sponsor.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港归属测试",
    rewardResourceId: "coin",
    rewardAmount: 4,
  }, sponsorContext);

  assert.throws(() => core.claimBounty({
    bountyId: bounty.value.bountyId,
    claimantAgentId: hunter.value.agentId,
    evidence: "别人替猎手领取。",
  }, sponsorContext), /bounty_claimant_owner_mismatch/);
  assert.equal(core.project().bounties[bounty.value.bountyId].status, "open");
  assert.equal(core.project().resourceBalances[hunter.value.agentId]?.coin || 0, 0);
});

type PartyRunTestRole = "leader" | "vanguard" | "scout" | "support" | "scribe";
type PartyRunTestJoinPolicy = "open" | "invite_only";

interface PartyRunTestMember {
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: PartyRunTestRole;
  readonly joinedAt: string;
}

interface PartyRunTestMemberResult {
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: PartyRunTestRole;
  readonly score: number;
  readonly reward: {
    readonly resourceId: string;
    readonly amount: number;
    readonly reason: string;
  };
}

interface PartyRunTestJoinRequest {
  readonly requestId: string;
  readonly partyRunId: string;
  readonly agentId: string;
  readonly explorerId: string;
  readonly participantRole: PartyRunTestRole;
  readonly status: "pending" | "approved" | "rejected";
  readonly requestedAt: string;
  readonly resolvedAt?: string;
  readonly resolvedByAgentId?: string;
  readonly resolutionNote?: string;
}

interface PartyRunTestRun {
  readonly partyRunId: string;
  readonly regionId: string;
  readonly title: string;
  readonly objective: string;
  readonly joinPolicy: PartyRunTestJoinPolicy;
  readonly inviteToken?: string;
  readonly inviteTokenExpiresAt?: string;
  readonly inviteTokenUseLimit?: number;
  readonly inviteTokenUses?: number;
  readonly inviteRecipientAgentId?: string;
  readonly inviteTokenRevokedAt?: string;
  readonly status: "open" | "settled";
  readonly leaderAgentId: string;
  readonly leaderExplorerId: string;
  readonly members: readonly PartyRunTestMember[];
  readonly joinRequests?: readonly PartyRunTestJoinRequest[];
  readonly totalScore?: number;
  readonly memberResults?: readonly PartyRunTestMemberResult[];
  readonly traceId?: string;
  readonly newsId?: string;
  readonly settledAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface PartyRunTestProjection {
  readonly partyRuns: Readonly<Record<string, PartyRunTestRun>>;
  readonly partyRunIdsByRegion: Readonly<Record<string, readonly string[]>>;
}

interface PartyRunTestResult {
  readonly events: readonly { readonly eventId: string; readonly eventType: string }[];
  readonly value: PartyRunTestRun;
  readonly projection: ReturnType<ReturnType<typeof createEpochGameCore>["project"]> & PartyRunTestProjection;
}

type PartyRunTestCore = ReturnType<typeof createEpochGameCore> & {
  readonly createPartyRun: (input: {
    readonly leaderAgentId: string;
    readonly regionId: string;
    readonly title: string;
    readonly objective: string;
    readonly participantRole?: PartyRunTestRole;
    readonly joinPolicy?: PartyRunTestJoinPolicy;
    readonly inviteToken?: string;
    readonly inviteTokenExpiresAt?: string;
    readonly inviteTokenUseLimit?: number;
    readonly inviteRecipientAgentId?: string;
  }, context: EpochCommandContext) => PartyRunTestResult;
  readonly joinPartyRun: (input: {
    readonly partyRunId: string;
    readonly agentId: string;
    readonly participantRole: PartyRunTestRole;
    readonly inviteToken?: string;
  }, context: EpochCommandContext) => PartyRunTestResult;
  readonly requestPartyJoin: (input: {
    readonly partyRunId: string;
    readonly agentId: string;
    readonly participantRole: PartyRunTestRole;
    readonly requestNote?: string;
  }, context: EpochCommandContext) => PartyRunTestResult;
  readonly resolvePartyJoinRequest: (input: {
    readonly partyRunId: string;
    readonly leaderAgentId: string;
    readonly requestId: string;
    readonly resolution: "approved" | "rejected";
    readonly resolutionNote?: string;
  }, context: EpochCommandContext) => PartyRunTestResult;
  readonly updatePartyInvite: (input: {
    readonly partyRunId: string;
    readonly leaderAgentId: string;
    readonly inviteToken?: string;
    readonly inviteTokenExpiresAt?: string;
    readonly inviteTokenUseLimit?: number;
    readonly inviteRecipientAgentId?: string;
    readonly revoke?: boolean;
  }, context: EpochCommandContext) => PartyRunTestResult;
  readonly settlePartyRun: (input: {
    readonly partyRunId: string;
  }, context: EpochCommandContext) => PartyRunTestResult;
  readonly project: () => ReturnType<ReturnType<typeof createEpochGameCore>["project"]> & PartyRunTestProjection;
};

test("party runs require a leader invite token when join policy is invite-only", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("party_invite"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_invite_leader",
  };
  const scoutContext = {
    ...userContext,
    actorExplorerId: "explorer_party_invite_scout",
  };
  const leader = core.issueIdentity({
    explorerId: "explorer_party_invite_leader",
    identityName: "灰港邀请队长",
  }, leaderContext);
  const scout = core.issueIdentity({
    explorerId: "explorer_party_invite_scout",
    identityName: "灰港受邀斥候",
  }, scoutContext);

  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港邀请夜巡",
    objective: "只允许拿到队长口令的身份加入并参与结算。",
    joinPolicy: "invite_only",
    inviteToken: "leader-issued-invite-token",
  }, leaderContext);

  assert.equal(created.value.joinPolicy, "invite_only");
  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
  }, scoutContext), /party_invite_required/);
  assert.equal(partyCore.project().partyRuns[created.value.partyRunId].members.length, 1);

  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
    inviteToken: "forged-invite-token",
  }, scoutContext), /party_invite_invalid/);
  assert.equal(partyCore.project().partyRuns[created.value.partyRunId].members.length, 1);

  const joined = partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
    inviteToken: "leader-issued-invite-token",
  }, scoutContext);

  assert.equal(joined.value.members.length, 2);
  assert.equal(joined.value.members[1].agentId, scout.value.agentId);
  assert.equal(joined.value.members[1].participantRole, "scout");
});

test("party invite-only tokens can be bound to one recipient identity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("party_invite_recipient"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_recipient_leader",
  };
  const scoutContext = {
    ...userContext,
    actorExplorerId: "explorer_party_recipient_scout",
  };
  const outsiderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_recipient_outsider",
  };
  const leader = core.issueIdentity({
    explorerId: "explorer_party_recipient_leader",
    identityName: "灰港定向邀请队长",
  }, leaderContext);
  const scout = core.issueIdentity({
    explorerId: "explorer_party_recipient_scout",
    identityName: "灰港定向斥候",
  }, scoutContext);
  const outsider = core.issueIdentity({
    explorerId: "explorer_party_recipient_outsider",
    identityName: "灰港非受邀者",
  }, outsiderContext);

  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港定向邀请",
    objective: "邀请令牌只允许指定身份使用。",
    joinPolicy: "invite_only",
    inviteToken: "recipient-bound-party-token",
    inviteRecipientAgentId: scout.value.agentId,
  }, leaderContext);

  assert.equal(created.value.inviteRecipientAgentId, scout.value.agentId);
  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: outsider.value.agentId,
    participantRole: "support",
    inviteToken: "recipient-bound-party-token",
  }, outsiderContext), /party_invite_recipient_mismatch/);
  assert.equal(partyCore.project().partyRuns[created.value.partyRunId].members.length, 1);

  const joined = partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
    inviteToken: "recipient-bound-party-token",
  }, scoutContext);

  assert.equal(joined.value.members.length, 2);
  assert.equal(joined.value.members[1].agentId, scout.value.agentId);
  assert.equal(joined.value.inviteTokenUses, 1);
});

test("party join requests form an owner-authorized leader approval queue", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("party_approval"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_approval_leader",
  };
  const scoutContext = {
    ...userContext,
    actorExplorerId: "explorer_party_approval_scout",
  };
  const supportContext = {
    ...userContext,
    actorExplorerId: "explorer_party_approval_support",
  };
  const leader = core.issueIdentity({
    explorerId: "explorer_party_approval_leader",
    identityName: "灰港审批队长",
  }, leaderContext);
  const scout = core.issueIdentity({
    explorerId: "explorer_party_approval_scout",
    identityName: "灰港申请斥候",
  }, scoutContext);
  const support = core.issueIdentity({
    explorerId: "explorer_party_approval_support",
    identityName: "灰港申请支援",
  }, supportContext);

  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港审批小队",
    objective: "队长逐条批准加入申请。",
    joinPolicy: "invite_only",
    inviteToken: "approval-queue-token",
  }, leaderContext);

  const scoutRequest = partyCore.requestPartyJoin({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
    requestNote: "申请侦察潮汐门。",
  }, scoutContext);
  const pendingScoutRequest = scoutRequest.value.joinRequests?.[0];
  assert.ok(pendingScoutRequest);
  assert.equal(pendingScoutRequest.agentId, scout.value.agentId);
  assert.equal(pendingScoutRequest.status, "pending");
  assert.equal(scoutRequest.value.members.length, 1);

  assert.throws(() => partyCore.resolvePartyJoinRequest({
    partyRunId: created.value.partyRunId,
    leaderAgentId: support.value.agentId,
    requestId: pendingScoutRequest.requestId,
    resolution: "approved",
  }, supportContext), /party_join_request_leader_required/);

  const approved = partyCore.resolvePartyJoinRequest({
    partyRunId: created.value.partyRunId,
    leaderAgentId: leader.value.agentId,
    requestId: pendingScoutRequest.requestId,
    resolution: "approved",
    resolutionNote: "批准侦察位。",
  }, leaderContext);
  assert.equal(approved.value.joinRequests?.[0]?.status, "approved");
  assert.equal(approved.value.joinRequests?.[0]?.resolvedByAgentId, leader.value.agentId);
  assert.equal(approved.value.members.length, 2);
  assert.equal(approved.value.members[1].agentId, scout.value.agentId);
  assert.deepEqual(approved.events.map((event) => event.eventType), [
    "party_join_request_resolved",
    "party_member_joined",
  ]);

  const supportRequest = partyCore.requestPartyJoin({
    partyRunId: created.value.partyRunId,
    agentId: support.value.agentId,
    participantRole: "support",
  }, supportContext);
  const pendingSupportRequest = supportRequest.value.joinRequests?.find((request) =>
    request.agentId === support.value.agentId);
  assert.ok(pendingSupportRequest);

  const rejected = partyCore.resolvePartyJoinRequest({
    partyRunId: created.value.partyRunId,
    leaderAgentId: leader.value.agentId,
    requestId: pendingSupportRequest.requestId,
    resolution: "rejected",
    resolutionNote: "等待下一班小队。",
  }, leaderContext);
  const rejectedRequest = rejected.value.joinRequests?.find((request) =>
    request.requestId === pendingSupportRequest.requestId);
  assert.equal(rejectedRequest?.status, "rejected");
  assert.equal(rejectedRequest?.resolutionNote, "等待下一班小队。");
  assert.equal(rejected.value.members.some((member) => member.agentId === support.value.agentId), false);
  assert.deepEqual(rejected.events.map((event) => event.eventType), ["party_join_request_resolved"]);
});

test("party invite-only tokens expire and enforce use limits", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("party_invite_limit"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_limit_leader",
  };
  const scoutContext = {
    ...userContext,
    actorExplorerId: "explorer_party_limit_scout",
  };
  const supportContext = {
    ...userContext,
    actorExplorerId: "explorer_party_limit_support",
  };
  const leader = core.issueIdentity({
    explorerId: "explorer_party_limit_leader",
    identityName: "灰港限次队长",
  }, leaderContext);
  const scout = core.issueIdentity({
    explorerId: "explorer_party_limit_scout",
    identityName: "灰港限次斥候",
  }, scoutContext);
  const support = core.issueIdentity({
    explorerId: "explorer_party_limit_support",
    identityName: "灰港限次支援",
  }, supportContext);

  const limited = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港一次性邀请",
    objective: "验证一个邀请码不能反复拉人。",
    joinPolicy: "invite_only",
    inviteToken: "single-use-party-token",
    inviteTokenUseLimit: 1,
    inviteTokenExpiresAt: "2026-06-25T00:30:00.000Z",
  }, leaderContext);
  assert.equal(limited.value.inviteTokenUseLimit, 1);
  assert.equal(limited.value.inviteTokenUses, 0);
  assert.equal(limited.value.inviteTokenExpiresAt, "2026-06-25T00:30:00.000Z");

  const joined = partyCore.joinPartyRun({
    partyRunId: limited.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
    inviteToken: "single-use-party-token",
  }, scoutContext);
  assert.equal(joined.value.inviteTokenUses, 1);

  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: limited.value.partyRunId,
    agentId: support.value.agentId,
    participantRole: "support",
    inviteToken: "single-use-party-token",
  }, supportContext), /party_invite_exhausted/);
  assert.equal(partyCore.project().partyRuns[limited.value.partyRunId].members.length, 2);

  const expiring = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港过期邀请",
    objective: "验证邀请码过期后不能再加入。",
    joinPolicy: "invite_only",
    inviteToken: "expiring-party-token",
    inviteTokenUseLimit: 2,
    inviteTokenExpiresAt: "2026-06-25T00:10:00.000Z",
  }, leaderContext);
  time.set("2026-06-25T00:10:00.000Z");
  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: expiring.value.partyRunId,
    agentId: support.value.agentId,
    participantRole: "support",
    inviteToken: "expiring-party-token",
  }, supportContext), /party_invite_expired/);
  assert.equal(partyCore.project().partyRuns[expiring.value.partyRunId].members.length, 1);
});

test("party leaders can rotate and revoke invite-only tokens", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("party_invite_rotate"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_rotate_leader",
  };
  const scoutContext = {
    ...userContext,
    actorExplorerId: "explorer_party_rotate_scout",
  };
  const supportContext = {
    ...userContext,
    actorExplorerId: "explorer_party_rotate_support",
  };
  const outsiderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_rotate_outsider",
  };
  const leader = core.issueIdentity({
    explorerId: "explorer_party_rotate_leader",
    identityName: "灰港轮换队长",
  }, leaderContext);
  const scout = core.issueIdentity({
    explorerId: "explorer_party_rotate_scout",
    identityName: "灰港轮换斥候",
  }, scoutContext);
  const support = core.issueIdentity({
    explorerId: "explorer_party_rotate_support",
    identityName: "灰港轮换支援",
  }, supportContext);
  const outsider = core.issueIdentity({
    explorerId: "explorer_party_rotate_outsider",
    identityName: "灰港伪队长",
  }, outsiderContext);

  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港轮换邀请",
    objective: "队长可以重发或撤销小队邀请。",
    joinPolicy: "invite_only",
    inviteToken: "old-party-token",
    inviteTokenUseLimit: 2,
    inviteTokenExpiresAt: "2026-06-25T00:30:00.000Z",
  }, leaderContext);

  time.set("2026-06-25T00:05:00.000Z");
  assert.throws(() => partyCore.updatePartyInvite({
    partyRunId: created.value.partyRunId,
    leaderAgentId: outsider.value.agentId,
    inviteToken: "forged-rotation-token",
  }, outsiderContext), /party_invite_leader_required/);

  const rotated = partyCore.updatePartyInvite({
    partyRunId: created.value.partyRunId,
    leaderAgentId: leader.value.agentId,
    inviteToken: "new-party-token",
    inviteTokenUseLimit: 1,
    inviteTokenExpiresAt: "2026-06-25T00:45:00.000Z",
  }, leaderContext);
  assert.deepEqual(rotated.events.map((event) => event.eventType), ["party_invite_updated"]);
  assert.equal(rotated.value.inviteTokenUses, 0);
  assert.equal(rotated.value.inviteTokenUseLimit, 1);
  assert.equal(rotated.value.inviteTokenExpiresAt, "2026-06-25T00:45:00.000Z");

  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
    inviteToken: "old-party-token",
  }, scoutContext), /party_invite_invalid/);

  const joined = partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
    inviteToken: "new-party-token",
  }, scoutContext);
  assert.equal(joined.value.inviteTokenUses, 1);

  time.set("2026-06-25T00:06:00.000Z");
  const revoked = partyCore.updatePartyInvite({
    partyRunId: created.value.partyRunId,
    leaderAgentId: leader.value.agentId,
    revoke: true,
  }, leaderContext);
  assert.equal(revoked.value.inviteTokenUseLimit, 0);
  assert.equal(revoked.value.inviteTokenUses, 0);
  assert.equal(revoked.value.inviteTokenRevokedAt, "2026-06-25T00:06:00.000Z");
  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: support.value.agentId,
    participantRole: "support",
    inviteToken: "new-party-token",
  }, supportContext), /party_invite_invalid/);
});

test("party runs create server-authoritative squads and accept owner-authorized members", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("party"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_leader",
  };
  const scoutContext = {
    ...userContext,
    actorExplorerId: "explorer_party_scout",
  };
  const intruderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_intruder",
  };
  const leader = core.issueIdentity({ explorerId: "explorer_party_leader", identityName: "灰港小队发起者" }, leaderContext);
  const scout = core.issueIdentity({ explorerId: "explorer_party_scout", identityName: "灰港小队斥候" }, scoutContext);

  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港夜巡小队",
    objective: "同步巡查潮汐门与灯市暗巷。",
    participantRole: "scout",
  }, leaderContext);

  assert.equal(created.value.status, "open");
  assert.equal(created.value.leaderAgentId, leader.value.agentId);
  assert.equal(created.value.leaderExplorerId, "explorer_party_leader");
  assert.deepEqual(created.value.members.map((member) => [member.agentId, member.participantRole]), [
    [leader.value.agentId, "leader"],
  ]);
  assert.deepEqual(created.events.map((event) => event.eventType), ["party_run_created"]);
  assert.deepEqual(created.projection.partyRunIdsByRegion.region_gray_harbor, [created.value.partyRunId]);
  assert.equal(created.projection.partyRuns[created.value.partyRunId].objective, "同步巡查潮汐门与灯市暗巷。");

  assert.throws(() => partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港夜巡小队",
    objective: "同步巡查潮汐门与灯市暗巷。",
  }, intruderContext), /party_leader_owner_mismatch/);

  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
  }, leaderContext), /party_member_owner_mismatch/);

  const joined = partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
  }, scoutContext);

  assert.deepEqual(joined.events.map((event) => event.eventType), ["party_member_joined"]);
  assert.deepEqual(joined.value.members.map((member) => [member.agentId, member.explorerId, member.participantRole]), [
    [leader.value.agentId, "explorer_party_leader", "leader"],
    [scout.value.agentId, "explorer_party_scout", "scout"],
  ]);
  assert.equal(joined.projection.partyRuns[created.value.partyRunId].members.length, 2);
  assert.deepEqual(partyCore.project().partyRunIdsByRegion.region_gray_harbor, [created.value.partyRunId]);

  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "support",
  }, scoutContext), /party_member_already_joined/);

  assert.throws(() => partyCore.settlePartyRun({
    partyRunId: created.value.partyRunId,
  }, leaderContext), /party_run_settlement_requires_server_trust/);

  const settled = partyCore.settlePartyRun({
    partyRunId: created.value.partyRunId,
  }, serverContext);

  assert.equal(settled.value.status, "settled");
  assert.equal(settled.value.totalScore, 5);
  assert.deepEqual(settled.value.memberResults?.map((member) => [
    member.agentId,
    member.participantRole,
    member.score,
    member.reward.resourceId,
    member.reward.amount,
  ]), [
    [leader.value.agentId, "leader", 3, "coin", 3],
    [scout.value.agentId, "scout", 2, "coin", 2],
  ]);
  assert.deepEqual(settled.events.map((event) => event.eventType), [
    "party_run_settled",
    "resource_granted",
    "resource_granted",
    "region_influence_changed",
    "region_influence_changed",
    "trace_created",
    "region_news_generated",
  ]);
  assert.equal(settled.projection.resourceBalances[leader.value.agentId]?.coin, 3);
  assert.equal(settled.projection.resourceBalances[scout.value.agentId]?.coin, 2);
  assert.ok(settled.value.traceId);
  assert.ok(settled.value.newsId);
  assert.ok(settled.projection.regionNews.region_gray_harbor.some((news) =>
    news.sourceEventIds.includes(settled.events[0].eventId)));
  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "support",
  }, scoutContext), /party_run_not_open/);

  const duplicateSettle = partyCore.settlePartyRun({
    partyRunId: created.value.partyRunId,
  }, serverContext);
  assert.equal(duplicateSettle.events.length, 0);
  assert.equal(duplicateSettle.value.status, "settled");
});

test("party runs apply server-owned role synergy bonuses during settlement", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("party_role_bonus"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_bonus_leader",
  };
  const scoutContext = {
    ...userContext,
    actorExplorerId: "explorer_party_bonus_scout",
  };
  const supportContext = {
    ...userContext,
    actorExplorerId: "explorer_party_bonus_support",
  };
  const leader = core.issueIdentity({ explorerId: "explorer_party_bonus_leader", identityName: "灰港协同队长" }, leaderContext);
  const scout = core.issueIdentity({ explorerId: "explorer_party_bonus_scout", identityName: "灰港协同斥候" }, scoutContext);
  const support = core.issueIdentity({ explorerId: "explorer_party_bonus_support", identityName: "灰港协同支援" }, supportContext);

  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港协同小队",
    objective: "支援位协调斥候和队长的区域行动。",
  }, leaderContext);
  partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
  }, scoutContext);
  partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: support.value.agentId,
    participantRole: "support",
  }, supportContext);

  const settled = partyCore.settlePartyRun({
    partyRunId: created.value.partyRunId,
  }, serverContext);

  assert.equal(settled.value.totalScore, 10);
  assert.deepEqual(settled.value.memberResults?.map((member) => [
    member.agentId,
    member.participantRole,
    member.score,
    member.reward.amount,
  ]), [
    [leader.value.agentId, "leader", 4, 4],
    [scout.value.agentId, "scout", 3, 3],
    [support.value.agentId, "support", 3, 3],
  ]);
  const influenceByAgent = Object.values(settled.projection.regionInfluenceChanges)
    .filter((change) => change.sourceAggregateId === created.value.partyRunId)
    .sort((left, right) => left.agentId.localeCompare(right.agentId));
  assert.deepEqual(influenceByAgent.map((change) => [change.agentId, change.influenceDelta]), [
    [leader.value.agentId, 4],
    [scout.value.agentId, 3],
    [support.value.agentId, 3],
  ].sort((left, right) => String(left[0]).localeCompare(String(right[0]))));
});

test("party runs apply a server-owned vanguard influence bonus without minting extra coin", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("party_vanguard_bonus"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_vanguard_leader",
  };
  const vanguardContext = {
    ...userContext,
    actorExplorerId: "explorer_party_vanguard_front",
  };
  const supportContext = {
    ...userContext,
    actorExplorerId: "explorer_party_vanguard_support",
  };
  const leader = core.issueIdentity({ explorerId: "explorer_party_vanguard_leader", identityName: "灰港防线队长" }, leaderContext);
  const vanguard = core.issueIdentity({ explorerId: "explorer_party_vanguard_front", identityName: "灰港前锋" }, vanguardContext);
  const support = core.issueIdentity({ explorerId: "explorer_party_vanguard_support", identityName: "灰港防线支援" }, supportContext);

  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港防线小队",
    objective: "前锋压住防线，支援位稳定后续行动。",
  }, leaderContext);
  partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: vanguard.value.agentId,
    participantRole: "vanguard",
  }, vanguardContext);
  partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: support.value.agentId,
    participantRole: "support",
  }, supportContext);

  const settled = partyCore.settlePartyRun({
    partyRunId: created.value.partyRunId,
  }, serverContext);

  assert.equal(settled.value.totalScore, 11);
  assert.deepEqual(settled.value.memberResults?.map((member) => [
    member.agentId,
    member.participantRole,
    member.score,
    member.reward.amount,
  ]), [
    [leader.value.agentId, "leader", 4, 4],
    [vanguard.value.agentId, "vanguard", 4, 4],
    [support.value.agentId, "support", 3, 3],
  ]);
  const influenceByAgent = Object.values(settled.projection.regionInfluenceChanges)
    .filter((change) => change.sourceAggregateId === created.value.partyRunId);
  const influenceDeltaByAgent = new Map(influenceByAgent.map((change) => [change.agentId, change.influenceDelta]));
  assert.equal(influenceDeltaByAgent.get(leader.value.agentId), 4);
  assert.equal(influenceDeltaByAgent.get(vanguard.value.agentId), 5);
  assert.equal(influenceDeltaByAgent.get(support.value.agentId), 3);
  assert.equal(settled.projection.resourceBalances[vanguard.value.agentId]?.coin, 4);
});

test("party runs apply a server-owned scribe news bonus without changing member rewards", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("party_scribe_bonus"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_scribe_leader",
  };
  const supportContext = {
    ...userContext,
    actorExplorerId: "explorer_party_scribe_support",
  };
  const scribeContext = {
    ...userContext,
    actorExplorerId: "explorer_party_scribe_writer",
  };
  const leader = core.issueIdentity({ explorerId: "explorer_party_scribe_leader", identityName: "灰港记录队长" }, leaderContext);
  const support = core.issueIdentity({ explorerId: "explorer_party_scribe_support", identityName: "灰港记录支援" }, supportContext);
  const scribe = core.issueIdentity({ explorerId: "explorer_party_scribe_writer", identityName: "灰港随队书记" }, scribeContext);

  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港记录小队",
    objective: "书记记录支援行动的公开证据。",
  }, leaderContext);
  partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: support.value.agentId,
    participantRole: "support",
  }, supportContext);
  partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scribe.value.agentId,
    participantRole: "scribe",
  }, scribeContext);

  const settled = partyCore.settlePartyRun({
    partyRunId: created.value.partyRunId,
  }, serverContext);

  assert.equal(settled.value.totalScore, 9);
  assert.deepEqual(settled.value.memberResults?.map((member) => [
    member.agentId,
    member.participantRole,
    member.score,
    member.reward.amount,
  ]), [
    [leader.value.agentId, "leader", 4, 4],
    [support.value.agentId, "support", 3, 3],
    [scribe.value.agentId, "scribe", 2, 2],
  ]);
  const newsEvent = settled.events.find((event) => event.eventType === "region_news_generated");
  assert.equal((newsEvent?.payload as { legendDelta?: number } | undefined)?.legendDelta, 4);
  assert.equal(settled.projection.resourceBalances[scribe.value.agentId]?.coin, 2);
});

test("party runs mark server-owned scout intelligence on settlement traces", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("party_scout_trace"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_scout_trace_leader",
  };
  const scoutContext = {
    ...userContext,
    actorExplorerId: "explorer_party_scout_trace_scout",
  };
  const supportContext = {
    ...userContext,
    actorExplorerId: "explorer_party_scout_trace_support",
  };
  const leader = core.issueIdentity({ explorerId: "explorer_party_scout_trace_leader", identityName: "灰港侦察队长" }, leaderContext);
  const scout = core.issueIdentity({ explorerId: "explorer_party_scout_trace_scout", identityName: "灰港随队斥候" }, scoutContext);
  const support = core.issueIdentity({ explorerId: "explorer_party_scout_trace_support", identityName: "灰港侦察支援" }, supportContext);

  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港侦察小队",
    objective: "斥候标记区域行动的后续线索。",
  }, leaderContext);
  partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: scout.value.agentId,
    participantRole: "scout",
  }, scoutContext);
  partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: support.value.agentId,
    participantRole: "support",
  }, supportContext);

  const settled = partyCore.settlePartyRun({
    partyRunId: created.value.partyRunId,
  }, serverContext);

  const trace = settled.projection.conflictTraces[settled.value.traceId || ""];
  assert.deepEqual((trace as { scoutAgentIds?: readonly string[] }).scoutAgentIds, [scout.value.agentId]);
  assert.equal(settled.value.totalScore, 10);
  assert.equal(settled.projection.resourceBalances[scout.value.agentId]?.coin, 3);
});

test("party runs cap members before settlement rewards are calculated", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("party_cap"),
  });
  const partyCore = core as PartyRunTestCore;
  const leaderContext = {
    ...userContext,
    actorExplorerId: "explorer_party_cap_leader",
  };
  const leader = core.issueIdentity({
    explorerId: "explorer_party_cap_leader",
    identityName: "灰港满编队长",
  }, leaderContext);
  const created = partyCore.createPartyRun({
    leaderAgentId: leader.value.agentId,
    regionId: "region_gray_harbor",
    title: "灰港满编夜巡",
    objective: "验证小队满编后不能继续塞入小号。",
  }, leaderContext);
  const members = (["vanguard", "scout", "support", "scribe"] as const).map((role, index) => {
    const explorerId = `explorer_party_cap_${index}`;
    const context = {
      ...userContext,
      actorExplorerId: explorerId,
    };
    const identity = core.issueIdentity({
      explorerId,
      identityName: `满编成员 ${index}`,
    }, context);
    return { context, identity, role };
  });

  for (const member of members.slice(0, 3)) {
    partyCore.joinPartyRun({
      partyRunId: created.value.partyRunId,
      agentId: member.identity.value.agentId,
      participantRole: member.role,
    }, member.context);
  }

  assert.equal(partyCore.project().partyRuns[created.value.partyRunId].members.length, 4);
  assert.throws(() => partyCore.joinPartyRun({
    partyRunId: created.value.partyRunId,
    agentId: members[3].identity.value.agentId,
    participantRole: members[3].role,
  }, members[3].context), /party_run_full/);
  assert.equal(partyCore.project().partyRuns[created.value.partyRunId].members.length, 4);

  const settled = partyCore.settlePartyRun({
    partyRunId: created.value.partyRunId,
  }, serverContext);
  assert.equal(settled.value.memberResults?.length, 4);
  assert.equal(settled.events.filter((event) => event.eventType === "resource_granted").length, 4);
});

test("resource nodes spawn server-side and settle contested stamina claims", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("node"),
  });
  const resourceCore = core as any;
  assert.equal(typeof resourceCore.createResourceNode, "function");
  assert.equal(typeof resourceCore.contestResourceNode, "function");
  assert.equal(typeof resourceCore.settleResourceNode, "function");

  const scout = core.issueIdentity({ explorerId: "explorer_scout", identityName: "灰港巡资源者" }, {
    ...userContext,
    actorExplorerId: "explorer_scout",
  });
  const rival = core.issueIdentity({ explorerId: "explorer_rival_node", identityName: "灰港争夺者" }, {
    ...userContext,
    actorExplorerId: "explorer_rival_node",
  });
  core.grantResource({
    agentId: scout.value.agentId,
    resourceId: "stamina",
    amount: 3,
    reason: "resource_node_seed",
  }, serverContext);
  core.grantResource({
    agentId: rival.value.agentId,
    resourceId: "stamina",
    amount: 1,
    reason: "resource_node_seed",
  }, serverContext);

  assert.throws(() => resourceCore.createResourceNode({
    regionId: "region_gray_harbor",
    title: "灰港灵质露点",
    resourceId: "aether",
    rewardAmount: 2,
  }, userContext), /resource_node_requires_server_trust/);

  const node = resourceCore.createResourceNode({
    regionId: "region_gray_harbor",
    title: "灰港灵质露点",
    description: "潮线退去后短暂浮现的灵质矿脉。",
    resourceId: "aether",
    rewardAmount: 2,
  }, serverContext);
  assert.equal(node.value.status, "open");
  assert.equal(node.value.reward.amount, 2);
  assert.equal(core.project().resourceNodeIdsByRegion.region_gray_harbor[0], node.value.nodeId);
  assert.throws(() => resourceCore.createResourceNode({
    regionId: "region_gray_harbor",
    title: "灰港盐脉露点",
    resourceId: "coin",
    rewardAmount: 1,
  }, serverContext), /resource_node_region_open/);

  const scoutContest = resourceCore.contestResourceNode({
    nodeId: node.value.nodeId,
    agentId: scout.value.agentId,
    staminaSpent: 2,
    clientDeclaredReward: { resourceId: "legend", amount: 999 },
  }, {
    ...userContext,
    actorExplorerId: "explorer_scout",
  });
  assert.deepEqual(scoutContest.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "resource_node_contested",
  ]);

  resourceCore.contestResourceNode({
    nodeId: node.value.nodeId,
    agentId: rival.value.agentId,
    staminaSpent: 1,
  }, {
    ...userContext,
    actorExplorerId: "explorer_rival_node",
  });

  const settled = resourceCore.settleResourceNode({
    nodeId: node.value.nodeId,
  }, serverContext);
  assert.equal(settled.value.status, "settled");
  assert.equal(settled.value.winnerAgentId, scout.value.agentId);
  assert.equal(settled.value.winningScore, 4);
  assert.equal(core.project().resourceBalances[scout.value.agentId].aether, 2);
  assert.equal(core.project().resourceBalances[scout.value.agentId].legend || 0, 0);
  const nodeInfluence = Object.values(core.project().regionInfluenceChanges)
    .find((change) => change.sourceAggregateId === node.value.nodeId);
  assert.equal(nodeInfluence?.regionId, "region_gray_harbor");
  assert.equal(nodeInfluence?.agentId, scout.value.agentId);
  assert.equal(nodeInfluence?.sourceEventType, "resource_node_settled");
  assert.equal(nodeInfluence?.influenceDelta, 4);
  const nodeTrace = Object.values(core.project().conflictTraces)
    .find((trace) => trace.sourceAggregateId === node.value.nodeId);
  assert.equal(nodeTrace?.regionId, "region_gray_harbor");
  assert.equal(nodeTrace?.sourceEventType, "resource_node_settled");
  assert.ok(nodeTrace?.sourceEventIds.includes(nodeInfluence?.sourceEventId || ""));
  assert.ok(nodeTrace?.relatedInfluenceIds.includes(nodeInfluence?.influenceId || ""));
  assert.deepEqual(nodeTrace?.participantAgentIds, [scout.value.agentId, rival.value.agentId]);
  const resourceNodeActivities = ((core.project() as any).regionActivityIdsByRegion.region_gray_harbor || [])
    .map((activityId: string) => (core.project() as any).regionActivities[activityId]);
  assert.ok(resourceNodeActivities.some((activity: { sourceEventType: string }) => activity.sourceEventType === "resource_node_spawned"));
  assert.ok(resourceNodeActivities.some((activity: { sourceEventType: string }) => activity.sourceEventType === "resource_node_contested"));
  assert.ok(resourceNodeActivities.some((activity: { sourceEventType: string }) => activity.sourceEventType === "resource_node_settled"));
  assert.equal(
    resourceNodeActivities.find((activity: { sourceEventType: string }) => activity.sourceEventType === "resource_node_settled")?.sourceEventId,
    settled.events.find((event: { eventType: string }) => event.eventType === "resource_node_settled")?.eventId,
  );
  const repeatedSettlement = resourceCore.settleResourceNode({
    nodeId: node.value.nodeId,
  }, serverContext);
  assert.equal(repeatedSettlement.value.status, "settled");
  assert.equal(repeatedSettlement.events.length, 0);
  assert.equal(core.project().resourceBalances[scout.value.agentId].aether, 2);
  assert.throws(() => resourceCore.createResourceNode({
    regionId: "region_gray_harbor",
    title: "灰港灵质露点",
    description: "潮线退去后短暂浮现的灵质矿脉。",
    resourceId: "aether",
    rewardAmount: 2,
  }, serverContext), /resource_node_spawn_cooldown_active/);
  assert.throws(() => resourceCore.createResourceNode({
    regionId: "region_gray_harbor",
    title: "灰港盐脉露点",
    resourceId: "coin",
    rewardAmount: 1,
  }, serverContext), /resource_node_spawn_cooldown_active/);
  time.set("2026-06-25T01:00:01.000Z");
  const nextNode = resourceCore.createResourceNode({
    regionId: "region_gray_harbor",
    title: "灰港盐脉露点",
    resourceId: "coin",
    rewardAmount: 1,
  }, serverContext);
  assert.notEqual(nextNode.value.nodeId, node.value.nodeId);
  assert.equal(nextNode.value.status, "open");
  assert.throws(() => resourceCore.contestResourceNode({
    nodeId: node.value.nodeId,
    agentId: scout.value.agentId,
    staminaSpent: 1,
  }, userContext), /resource_node_not_open/);
});

test("regional contest contributions reject actors that do not own the spending identity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("contest_owner"),
  });
  const ownerContext = {
    ...userContext,
    actorExplorerId: "explorer_contest_owner",
  };
  const bystanderContext = {
    ...userContext,
    actorExplorerId: "explorer_contest_bystander",
  };
  const owner = core.issueIdentity({ explorerId: "explorer_contest_owner", identityName: "灰港贡献者" }, ownerContext);
  core.issueIdentity({ explorerId: "explorer_contest_bystander", identityName: "旁观者" }, bystanderContext);
  core.grantResource({ agentId: owner.value.agentId, resourceId: "coin", amount: 6, reason: "contest_owner_seed" }, serverContext);
  core.grantResource({ agentId: owner.value.agentId, resourceId: "stamina", amount: 3, reason: "contest_owner_seed" }, serverContext);
  core.grantResource({ agentId: owner.value.agentId, resourceId: "focus", amount: 3, reason: "contest_owner_seed" }, serverContext);

  const objective = core.createContestedObjective({
    regionId: "region_gray_harbor",
    title: "灰港贡献归属测试",
    resourceId: "coin",
    targetScore: 4,
    reward: { resourceId: "legend", amount: 1, reason: "objective_owner_test" },
  }, serverContext);
  assert.throws(() => core.contributeContestedObjective({
    objectiveId: objective.value.objectiveId,
    agentId: owner.value.agentId,
    amount: 2,
  }, bystanderContext), /objective_contributor_owner_mismatch/);
  assert.equal(core.project().resourceBalances[owner.value.agentId].coin, 6);

  const node = (core as any).createResourceNode({
    regionId: "region_gray_harbor",
    title: "灰港资源归属测试",
    resourceId: "aether",
    rewardAmount: 1,
  }, serverContext);
  assert.throws(() => (core as any).contestResourceNode({
    nodeId: node.value.nodeId,
    agentId: owner.value.agentId,
    staminaSpent: 2,
  }, bystanderContext), /resource_node_contest_owner_mismatch/);
  assert.equal(core.project().resourceBalances[owner.value.agentId].stamina, 3);

  const anomaly = (core as any).createAnomalyEvent({
    regionId: "region_gray_harbor",
    title: "灰港异常归属测试",
    severity: "minor",
    targetScore: 4,
    reward: { resourceId: "aether", amount: 1, reason: "anomaly_owner_test" },
    lifetimeRisk: 1,
  }, serverContext);
  assert.throws(() => (core as any).contestAnomalyEvent({
    anomalyId: anomaly.value.anomalyId,
    agentId: owner.value.agentId,
    focusSpent: 2,
  }, bystanderContext), /anomaly_contest_owner_mismatch/);
  assert.equal(core.project().resourceBalances[owner.value.agentId].focus, 3);

  const season = (core as any).createSeasonCampaign({
    seasonKey: "contest_owner_season",
    title: "灰港归属季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 4,
    reward: { resourceId: "legend", amount: 1, reason: "season_owner_test" },
  }, serverContext);
  assert.throws(() => (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: owner.value.agentId,
    factionId: "gray_watch",
    amount: 2,
  }, bystanderContext), /season_contributor_owner_mismatch/);
  assert.equal(core.project().resourceBalances[owner.value.agentId].coin, 6);
});

test("regional anomaly chains are server-spawned and focus-settled", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("anomaly"),
  });
  const anomalyCore = core as any;
  assert.equal(typeof anomalyCore.createAnomalyEvent, "function");
  assert.equal(typeof anomalyCore.contestAnomalyEvent, "function");
  assert.equal(typeof anomalyCore.resolveAnomalyEvent, "function");

  const seer = core.issueIdentity({ explorerId: "explorer_seer", identityName: "灰港观测者" }, {
    ...userContext,
    actorExplorerId: "explorer_seer",
  });
  const rival = core.issueIdentity({ explorerId: "explorer_rival_anomaly", identityName: "裂隙压制者" }, {
    ...userContext,
    actorExplorerId: "explorer_rival_anomaly",
  });
  core.grantResource({
    agentId: seer.value.agentId,
    resourceId: "focus",
    amount: 3,
    reason: "anomaly_seed",
  }, serverContext);
  core.grantResource({
    agentId: rival.value.agentId,
    resourceId: "focus",
    amount: 1,
    reason: "anomaly_seed",
  }, serverContext);

  assert.throws(() => anomalyCore.createAnomalyEvent({
    regionId: "region_gray_harbor",
    title: "灰港低阶裂隙",
    targetScore: 6,
    reward: { resourceId: "aether", amount: 2, reason: "forged" },
  }, userContext), /anomaly_event_requires_server_trust/);

  const anomaly = anomalyCore.createAnomalyEvent({
    regionId: "region_gray_harbor",
    title: "灰港低阶裂隙",
    description: "港口盐雾里张开的一道低阶异常裂隙。",
    severity: "minor",
    targetScore: 6,
    reward: { resourceId: "aether", amount: 2, reason: "anomaly_contained" },
    lifetimeRisk: 1,
  }, serverContext);
  assert.equal(anomaly.value.status, "open");
  assert.equal(anomaly.value.targetScore, 6);
  assert.equal(core.project().anomalyEventIdsByRegion.region_gray_harbor[0], anomaly.value.anomalyId);

  const seerContest = anomalyCore.contestAnomalyEvent({
    anomalyId: anomaly.value.anomalyId,
    agentId: seer.value.agentId,
    focusSpent: 2,
    clientDeclaredReward: { resourceId: "legend", amount: 999 },
  }, {
    ...userContext,
    actorExplorerId: "explorer_seer",
  });
  assert.deepEqual(seerContest.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "anomaly_event_contested",
  ]);

  anomalyCore.contestAnomalyEvent({
    anomalyId: anomaly.value.anomalyId,
    agentId: rival.value.agentId,
    focusSpent: 1,
  }, {
    ...userContext,
    actorExplorerId: "explorer_rival_anomaly",
  });

  const resolved = anomalyCore.resolveAnomalyEvent({
    anomalyId: anomaly.value.anomalyId,
  }, serverContext);
  assert.equal(resolved.value.status, "resolved");
  assert.equal(resolved.value.outcome, "contained");
  assert.equal(resolved.value.winnerAgentId, seer.value.agentId);
  assert.equal(resolved.value.winningScore, 6);
  assert.equal(core.project().resourceBalances[seer.value.agentId].aether, 2);
  assert.equal(core.project().resourceBalances[seer.value.agentId].legend || 0, 0);
  assert.equal(core.project().identities[seer.value.agentId].lifetime.remaining, seer.value.lifetime.remaining - 1);
  const anomalyInfluence = Object.values(core.project().regionInfluenceChanges)
    .find((change) => change.sourceAggregateId === anomaly.value.anomalyId);
  assert.equal(anomalyInfluence?.sourceEventType, "anomaly_event_resolved");
  assert.equal(anomalyInfluence?.influenceDelta, 6);
  const anomalyTrace = Object.values(core.project().conflictTraces)
    .find((trace) => trace.sourceAggregateId === anomaly.value.anomalyId);
  assert.equal(anomalyTrace?.sourceEventType, "anomaly_event_resolved");
  assert.deepEqual(anomalyTrace?.participantAgentIds, [seer.value.agentId, rival.value.agentId]);
  const anomalyActivities = ((core.project() as any).regionActivityIdsByRegion.region_gray_harbor || [])
    .map((activityId: string) => (core.project() as any).regionActivities[activityId]);
  assert.ok(anomalyActivities.some((activity: { sourceEventType: string }) => activity.sourceEventType === "anomaly_event_spawned"));
  assert.ok(anomalyActivities.some((activity: { sourceEventType: string }) => activity.sourceEventType === "anomaly_event_contested"));
  assert.ok(anomalyActivities.some((activity: { sourceEventType: string }) => activity.sourceEventType === "anomaly_event_resolved"));
  assert.throws(() => anomalyCore.contestAnomalyEvent({
    anomalyId: anomaly.value.anomalyId,
    agentId: seer.value.agentId,
    focusSpent: 1,
  }, userContext), /anomaly_event_not_open/);
});

test("anomaly lifetime risk proposes personality drift before owner confirmation", () => {
  const core = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("personality_drift"),
  });
  const anomalyCore = core as any;
  const identity = core.issueIdentity({ explorerId: "explorer_personality_drift", identityName: "裂隙后生还者" }, {
    ...userContext,
    actorExplorerId: "explorer_personality_drift",
  });
  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "focus",
    amount: 3,
    reason: "personality_drift_seed",
  }, serverContext);
  const anomaly = anomalyCore.createAnomalyEvent({
    regionId: "region_gray_harbor",
    title: "灰港伤痕裂隙",
    description: "足以改变行事风格的低阶异常。",
    severity: "minor",
    targetScore: 6,
    reward: { resourceId: "aether", amount: 1, reason: "anomaly_contained" },
    lifetimeRisk: 2,
  }, serverContext);
  anomalyCore.contestAnomalyEvent({
    anomalyId: anomaly.value.anomalyId,
    agentId: identity.value.agentId,
    focusSpent: 2,
  }, {
    ...userContext,
    actorExplorerId: "explorer_personality_drift",
  });

  const resolved = anomalyCore.resolveAnomalyEvent({
    anomalyId: anomaly.value.anomalyId,
  }, serverContext);
  const proposalEvent = resolved.events.find((event: { eventType: string }) => event.eventType === "personality_drift_proposed");
  assert.ok(proposalEvent);
  assert.equal(proposalEvent.payload.agentId, identity.value.agentId);
  assert.match(proposalEvent.payload.trigger, /anomaly_lifetime_risk/);
  assert.ok(proposalEvent.payload.sourceEventId);
  const driftId = proposalEvent.payload.driftId;
  assert.equal(core.project().personalityDrifts[driftId].status, "proposed");
  const initialTraits = [...core.project().identities[identity.value.agentId].personality.traits];
  assert.equal(initialTraits.length, 2);
  assert.ok(!initialTraits.includes(proposalEvent.payload.suggestedTrait));

  assert.throws(() => anomalyCore.confirmPersonalityDrift({
    driftId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_intruder",
  }), /personality_drift_owner_mismatch/);

  const confirmed = anomalyCore.confirmPersonalityDrift({
    driftId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_personality_drift",
  });
  assert.deepEqual(confirmed.events.map((event: { eventType: string }) => event.eventType), ["personality_drift_confirmed"]);
  assert.equal(confirmed.value.status, "confirmed");
  assert.deepEqual(core.project().identities[identity.value.agentId].personality.traits, [
    ...initialTraits,
    proposalEvent.payload.suggestedTrait,
  ]);
  assert.equal(core.project().identities[identity.value.agentId].personality.latestSourceEventId, proposalEvent.payload.sourceEventId);
});

test("raid resolution spends attacker stamina and settles defense from server state", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("raid"),
  });
  assert.equal(typeof core.resolveRaid, "function");
  const attacker = core.issueIdentity({ explorerId: "explorer_raider", identityName: "灰港袭击者" }, {
    ...userContext,
    actorExplorerId: "explorer_raider",
  });
  const defender = core.issueIdentity({ explorerId: "explorer_guard", identityName: "盐门守卫" }, {
    ...userContext,
    actorExplorerId: "explorer_guard",
  });
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "stamina",
    amount: 6,
    reason: "raid_seed",
  }, serverContext);
  core.grantResource({
    agentId: defender.value.agentId,
    resourceId: "focus",
    amount: 2,
    reason: "raid_seed",
  }, serverContext);

  const resolved = core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 6,
    clientDeclaredOutcome: "attacker_always_wins",
  } as {
    regionId: string;
    attackerAgentId: string;
    defenderAgentId: string;
    staminaSpent: number;
    clientDeclaredOutcome: string;
  }, {
    ...userContext,
    actorExplorerId: "explorer_raider",
  });

  assert.equal(resolved.value.outcome, "attacker_won");
  assert.equal(resolved.value.attackerPower, 12);
  assert.equal(resolved.value.defenderPower, 6);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].stamina, 0);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].legend, 1);
  assert.equal(core.project().raidResults[resolved.value.raidId].outcome, "attacker_won");
  const raidInfluence = Object.values(core.project().regionInfluenceChanges)
    .find((change) => change.sourceAggregateId === resolved.value.raidId);
  assert.equal(raidInfluence?.regionId, "region_gray_harbor");
  assert.equal(raidInfluence?.agentId, attacker.value.agentId);
  assert.equal(raidInfluence?.sourceEventType, "raid_resolved");
  assert.equal(raidInfluence?.influenceDelta, 8);
  const raidTrace = Object.values(core.project().conflictTraces)
    .find((trace) => trace.sourceAggregateId === resolved.value.raidId);
  assert.equal(raidTrace?.regionId, "region_gray_harbor");
  assert.equal(raidTrace?.sourceEventType, "raid_resolved");
  assert.ok(raidTrace?.sourceEventIds.includes(raidInfluence?.sourceEventId || ""));
  assert.ok(raidTrace?.relatedInfluenceIds.includes(raidInfluence?.influenceId || ""));
  assert.deepEqual(raidTrace?.participantAgentIds, [attacker.value.agentId, defender.value.agentId]);
  assert.ok(resolved.events.some((event) => event.eventType === "retaliation_opportunity_created"));
  const projectionWithRetaliations = core.project() as ReturnType<typeof core.project> & {
    retaliationOpportunities?: Record<string, {
      retaliationId: string;
      regionId: string;
      sourceRaidId: string;
      sourceTraceId: string;
      opportunityAgentId: string;
      opportunityExplorerId: string;
      targetAgentId: string;
      targetExplorerId: string;
      status: string;
      sourceEventIds: readonly string[];
    }>;
    retaliationIdsByRegion?: Record<string, readonly string[]>;
    retaliationIdsByAgent?: Record<string, readonly string[]>;
  };
  const retaliation = Object.values(projectionWithRetaliations.retaliationOpportunities || {})
    .find((opportunity) => opportunity.sourceRaidId === resolved.value.raidId);
  assert.ok(retaliation);
  assert.equal(retaliation.regionId, "region_gray_harbor");
  assert.equal(retaliation.sourceTraceId, raidTrace?.traceId);
  assert.equal(retaliation.opportunityAgentId, defender.value.agentId);
  assert.equal(retaliation.opportunityExplorerId, defender.value.explorerId);
  assert.equal(retaliation.targetAgentId, attacker.value.agentId);
  assert.equal(retaliation.targetExplorerId, attacker.value.explorerId);
  assert.equal(retaliation.status, "open");
  assert.ok(retaliation.sourceEventIds.includes(resolved.events.find((event) => event.eventType === "raid_resolved")?.eventId || ""));
  assert.ok(retaliation.sourceEventIds.includes(resolved.events.find((event) => event.eventType === "trace_created")?.eventId || ""));
  assert.ok(projectionWithRetaliations.retaliationIdsByRegion?.region_gray_harbor?.includes(retaliation.retaliationId));
  assert.ok(projectionWithRetaliations.retaliationIdsByAgent?.[defender.value.agentId]?.includes(retaliation.retaliationId));
});

test("raid resolution rejects same-explorer identities as matchmaking self-dealing", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("raid_same_explorer"),
  });
  const explorerContext = {
    ...userContext,
    actorExplorerId: "explorer_raid_same_explorer",
  };
  const attacker = core.issueIdentity({
    explorerId: "explorer_raid_same_explorer",
    identityName: "同源突袭者",
  }, explorerContext);
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "legend",
    amount: 3,
    reason: "raid_same_explorer_slot_seed",
  }, serverContext);
  const defender = core.issueIdentity({
    explorerId: "explorer_raid_same_explorer",
    identityName: "同源防守者",
  }, explorerContext);
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "stamina",
    amount: 2,
    reason: "raid_same_explorer_seed",
  }, serverContext);

  assert.throws(() => core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 2,
  }, explorerContext), /raid_same_explorer_not_allowed/);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].stamina, 2);
  assert.equal(Object.values(core.project().raidResults).length, 0);
});

test("raid resolution rejects same-faction regional targets as matchmaking self-dealing", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("raid_same_faction"),
  });
  const attackerContext = {
    ...userContext,
    actorExplorerId: "explorer_raid_same_faction_attacker",
  };
  const defenderContext = {
    ...userContext,
    actorExplorerId: "explorer_raid_same_faction_defender",
  };
  const attacker = core.issueIdentity({
    explorerId: "explorer_raid_same_faction_attacker",
    identityName: "同阵营突袭者",
  }, attackerContext);
  const defender = core.issueIdentity({
    explorerId: "explorer_raid_same_faction_defender",
    identityName: "同阵营防守者",
  }, defenderContext);
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "coin",
    amount: 1,
    reason: "raid_same_faction_seed",
  }, serverContext);
  core.grantResource({
    agentId: defender.value.agentId,
    resourceId: "coin",
    amount: 1,
    reason: "raid_same_faction_seed",
  }, serverContext);
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "stamina",
    amount: 2,
    reason: "raid_same_faction_stamina",
  }, serverContext);

  const season = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_same_faction_raid",
    title: "灰港同阵营互刷防线",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 10,
    reward: { resourceId: "legend", amount: 1, reason: "raid_same_faction" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: attacker.value.agentId,
    factionId: "gray_watch",
    amount: 1,
  }, attackerContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: defender.value.agentId,
    factionId: "gray_watch",
    amount: 1,
  }, defenderContext);

  assert.throws(() => core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 2,
  }, attackerContext), /raid_same_faction_not_allowed/);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].stamina, 2);
  assert.equal(Object.values(core.project().raidResults).length, 0);
});

test("cross-faction season standings tune raid battle power", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("raid_cross_faction_power"),
  });
  const attackerContext = {
    ...userContext,
    actorExplorerId: "explorer_raid_cross_faction_attacker",
  };
  const defenderContext = {
    ...userContext,
    actorExplorerId: "explorer_raid_cross_faction_defender",
  };
  const attacker = core.issueIdentity({
    explorerId: "explorer_raid_cross_faction_attacker",
    identityName: "跨阵营突袭者",
  }, attackerContext);
  const defender = core.issueIdentity({
    explorerId: "explorer_raid_cross_faction_defender",
    identityName: "跨阵营守卫",
  }, defenderContext);
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "stamina",
    amount: 2,
    reason: "raid_cross_faction_power_seed",
  }, serverContext);
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "coin",
    amount: 1,
    reason: "raid_cross_faction_power_seed",
  }, serverContext);
  core.grantResource({
    agentId: defender.value.agentId,
    resourceId: "coin",
    amount: 4,
    reason: "raid_cross_faction_power_seed",
  }, serverContext);
  core.grantResource({
    agentId: defender.value.agentId,
    resourceId: "focus",
    amount: 1,
    reason: "raid_cross_faction_power_seed",
  }, serverContext);

  const season = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_cross_faction_power",
    title: "灰港跨阵营战力季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 10,
    reward: { resourceId: "legend", amount: 1, reason: "raid_cross_faction_power" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: attacker.value.agentId,
    factionId: "gray_watch",
    amount: 1,
  }, attackerContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: defender.value.agentId,
    factionId: "cinder_archive",
    amount: 4,
  }, defenderContext);

  const resolved = core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 2,
  }, attackerContext);

  assert.equal(resolved.value.attackerPower, 4);
  assert.equal(resolved.value.defenderPower, 5);
  assert.equal(resolved.value.outcome, "defender_won");
  assert.equal(resolved.value.reward.reason, "raid_defense_success");
  assert.equal(core.project().resourceBalances[defender.value.agentId].legend, 1);
});

test("raid resolution rejects immediate repeat raids for the same attacker defender region pair", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("raid_cooldown"),
  });
  const attackerContext = {
    ...userContext,
    actorExplorerId: "explorer_raid_cooldown_attacker",
  };
  const attacker = core.issueIdentity({
    explorerId: "explorer_raid_cooldown_attacker",
    identityName: "灰港反复袭击者",
  }, attackerContext);
  const defender = core.issueIdentity({
    explorerId: "explorer_raid_cooldown_defender",
    identityName: "盐门冷却守卫",
  }, {
    ...userContext,
    actorExplorerId: "explorer_raid_cooldown_defender",
  });
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "stamina",
    amount: 6,
    reason: "raid_cooldown_seed",
  }, serverContext);

  core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 2,
  }, attackerContext);

  assert.throws(() => core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 2,
  }, attackerContext), /raid_pair_cooldown_active/);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].stamina, 4);
  assert.equal(Object.values(core.project().raidResults).length, 1);
});

test("raid repeat rewards decay after pair cooldown without erasing conflict history", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("raid_decay"),
  });
  const attackerContext = {
    ...userContext,
    actorExplorerId: "explorer_raid_decay_attacker",
  };
  const attacker = core.issueIdentity({
    explorerId: "explorer_raid_decay_attacker",
    identityName: "灰港收益衰减袭击者",
  }, attackerContext);
  const defender = core.issueIdentity({
    explorerId: "explorer_raid_decay_defender",
    identityName: "盐门收益衰减守卫",
  }, {
    ...userContext,
    actorExplorerId: "explorer_raid_decay_defender",
  });
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "stamina",
    amount: 6,
    reason: "raid_decay_seed",
  }, serverContext);

  const first = core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 2,
  }, attackerContext);
  assert.equal(first.value.reward.amount, 1);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].legend, 1);

  time.set("2026-06-25T01:01:00.000Z");
  const second = core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 2,
  }, attackerContext);

  assert.equal(second.value.outcome, "attacker_won");
  assert.notEqual(second.value.raidId, first.value.raidId);
  assert.equal(second.value.reward.amount, 0);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].legend, 1);
  assert.equal(second.events.some((event) => event.eventType === "resource_granted"), false);
  assert.equal(
    Object.values(core.project().regionInfluenceChanges)
      .some((change) => change.sourceAggregateId === second.value.raidId),
    false,
  );
  assert.ok(second.events.some((event) => event.eventType === "raid_resolved"));
  assert.ok(second.events.some((event) => event.eventType === "trace_created"));
  assert.ok(second.events.some((event) => event.eventType === "retaliation_opportunity_created"));
  assert.equal(Object.values(core.project().raidResults).length, 2);
});

test("raid rewards decay when regional raid heat is already hot", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("raid_region_heat"),
  });
  const attackerContext = {
    ...userContext,
    actorExplorerId: "explorer_raid_region_heat_attacker",
  };
  const attacker = core.issueIdentity({
    explorerId: "explorer_raid_region_heat_attacker",
    identityName: "灰港热区袭击者",
  }, attackerContext);
  const defenders = [1, 2, 3, 4].map((index) => core.issueIdentity({
    explorerId: `explorer_raid_region_heat_defender_${index}`,
    identityName: `灰港热区守卫 ${index}`,
  }, {
    ...userContext,
    actorExplorerId: `explorer_raid_region_heat_defender_${index}`,
  }));
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "stamina",
    amount: 8,
    reason: "raid_region_heat_seed",
  }, serverContext);
  const resolveAgainst = (defender: typeof defenders[number]) => core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 2,
  }, attackerContext);

  const first = resolveAgainst(defenders[0]);
  const second = resolveAgainst(defenders[1]);
  const third = resolveAgainst(defenders[2]);
  const fourth = resolveAgainst(defenders[3]);

  assert.deepEqual([first.value.reward.amount, second.value.reward.amount, third.value.reward.amount], [1, 1, 1]);
  assert.equal(fourth.value.reward.amount, 0);
  assert.equal(fourth.value.reward.reason, "raid_region_heat_reward_decayed");
  assert.equal(core.project().resourceBalances[attacker.value.agentId].legend, 3);
  assert.equal(fourth.events.some((event) => event.eventType === "resource_granted"), false);
  assert.equal(
    Object.values(core.project().regionInfluenceChanges)
      .some((change) => change.sourceAggregateId === fourth.value.raidId),
    false,
  );
  assert.ok(fourth.events.some((event) => event.eventType === "raid_resolved"));
  assert.ok(fourth.events.some((event) => event.eventType === "trace_created"));
  assert.ok(fourth.events.some((event) => event.eventType === "retaliation_opportunity_created"));
  assert.equal(Object.values(core.project().raidResults).length, 4);
});

test("retaliation resolution spends owner stamina and closes the server-created opportunity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("retaliation"),
  });
  assert.equal(typeof (core as { resolveRetaliation?: unknown }).resolveRetaliation, "function");
  const attacker = core.issueIdentity({ explorerId: "explorer_raider", identityName: "灰港袭击者" }, {
    ...userContext,
    actorExplorerId: "explorer_raider",
  });
  const defender = core.issueIdentity({ explorerId: "explorer_guard", identityName: "盐门守卫" }, {
    ...userContext,
    actorExplorerId: "explorer_guard",
  });
  core.grantResource({
    agentId: attacker.value.agentId,
    resourceId: "stamina",
    amount: 6,
    reason: "raid_seed",
  }, serverContext);
  core.grantResource({
    agentId: defender.value.agentId,
    resourceId: "focus",
    amount: 2,
    reason: "raid_seed",
  }, serverContext);
  core.grantResource({
    agentId: defender.value.agentId,
    resourceId: "stamina",
    amount: 2,
    reason: "retaliation_seed",
  }, serverContext);

  const raid = core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 6,
  }, {
    ...userContext,
    actorExplorerId: "explorer_raider",
  });
  const opportunity = Object.values(core.project().retaliationOpportunities)
    .find((item) => item.sourceRaidId === raid.value.raidId);
  assert.ok(opportunity);

  const resolved = (core as any).resolveRetaliation({
    retaliationId: opportunity.retaliationId,
    opportunityAgentId: defender.value.agentId,
    staminaSpent: 2,
    clientDeclaredOutcome: "retaliator_always_wins",
  }, {
    ...userContext,
    actorExplorerId: "explorer_guard",
  });

  assert.equal(resolved.value.status, "resolved");
  assert.equal(resolved.value.outcome, "retaliator_won");
  assert.equal(resolved.value.winnerAgentId, defender.value.agentId);
  assert.equal(resolved.value.targetAgentId, attacker.value.agentId);
  assert.equal(resolved.value.staminaSpent, 2);
  assert.equal(resolved.value.retaliatorPower, 4);
  assert.equal(resolved.value.targetPower, 1);
  assert.equal(core.project().resourceBalances[defender.value.agentId].stamina, 0);
  assert.equal(core.project().resourceBalances[defender.value.agentId].legend, 1);
  assert.ok(resolved.events.some((event: { eventType: string }) => event.eventType === "retaliation_resolved"));
  const retaliationInfluence = Object.values(core.project().regionInfluenceChanges)
    .find((change) => change.sourceAggregateId === opportunity.retaliationId);
  assert.equal(retaliationInfluence?.sourceEventType, "retaliation_resolved");
  assert.equal(retaliationInfluence?.agentId, defender.value.agentId);
  const retaliationTrace = Object.values(core.project().conflictTraces)
    .find((trace) => trace.sourceAggregateId === opportunity.retaliationId);
  assert.equal(retaliationTrace?.sourceEventType, "retaliation_resolved");
  assert.deepEqual(retaliationTrace?.participantAgentIds, [defender.value.agentId, attacker.value.agentId]);
  assert.throws(() => (core as any).resolveRetaliation({
    retaliationId: opportunity.retaliationId,
    opportunityAgentId: defender.value.agentId,
    staminaSpent: 1,
  }, userContext), /retaliation_not_open/);
});

test("pvp and diplomacy writes reject actors that do not own the spending identity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("pvp_owner"),
  });
  const attackerContext = {
    ...userContext,
    actorExplorerId: "explorer_pvp_attacker",
  };
  const defenderContext = {
    ...userContext,
    actorExplorerId: "explorer_pvp_defender",
  };
  const attacker = core.issueIdentity({ explorerId: "explorer_pvp_attacker", identityName: "灰港袭击者" }, attackerContext);
  const defender = core.issueIdentity({ explorerId: "explorer_pvp_defender", identityName: "盐门守卫" }, defenderContext);
  core.grantResource({ agentId: attacker.value.agentId, resourceId: "stamina", amount: 6, reason: "pvp_owner_seed" }, serverContext);
  core.grantResource({ agentId: attacker.value.agentId, resourceId: "focus", amount: 4, reason: "pvp_owner_seed" }, serverContext);
  core.grantResource({ agentId: defender.value.agentId, resourceId: "stamina", amount: 2, reason: "pvp_owner_seed" }, serverContext);
  core.grantResource({ agentId: defender.value.agentId, resourceId: "focus", amount: 3, reason: "pvp_owner_seed" }, serverContext);

  assert.throws(() => core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 2,
  }, defenderContext), /raid_attacker_owner_mismatch/);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].stamina, 6);

  const raid = core.resolveRaid({
    regionId: "region_gray_harbor",
    attackerAgentId: attacker.value.agentId,
    defenderAgentId: defender.value.agentId,
    staminaSpent: 6,
  }, attackerContext);
  const opportunity = Object.values(core.project().retaliationOpportunities)
    .find((item) => item.sourceRaidId === raid.value.raidId);
  assert.ok(opportunity);

  assert.throws(() => (core as any).resolveRetaliation({
    retaliationId: opportunity.retaliationId,
    opportunityAgentId: defender.value.agentId,
    staminaSpent: 1,
  }, attackerContext), /retaliation_actor_owner_mismatch/);
  assert.equal(core.project().resourceBalances[defender.value.agentId].stamina, 2);

  assert.throws(() => (core as any).updateRelationship({
    sourceAgentId: attacker.value.agentId,
    targetAgentId: defender.value.agentId,
    kind: "alliance",
    focusSpent: 1,
  }, defenderContext), /relationship_source_owner_mismatch/);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].focus, 4);

  assert.throws(() => (core as any).proposeDiplomacy({
    regionId: "region_gray_harbor",
    sourceAgentId: attacker.value.agentId,
    targetAgentId: defender.value.agentId,
    kind: "alliance",
    focusSpent: 1,
    terms: "owner_gate_terms",
  }, defenderContext), /diplomacy_source_owner_mismatch/);
  assert.equal(core.project().resourceBalances[attacker.value.agentId].focus, 4);

  const proposal = (core as any).proposeDiplomacy({
    regionId: "region_gray_harbor",
    sourceAgentId: attacker.value.agentId,
    targetAgentId: defender.value.agentId,
    kind: "alliance",
    focusSpent: 1,
    terms: "owner_gate_terms",
  }, attackerContext);
  assert.throws(() => (core as any).respondDiplomacy({
    diplomacyId: proposal.value.diplomacyId,
    responderAgentId: defender.value.agentId,
    response: "accepted",
    focusSpent: 1,
  }, attackerContext), /diplomacy_responder_owner_mismatch/);
  assert.equal(core.project().resourceBalances[defender.value.agentId].focus, 3);
});

test("relationship graph spends focus and computes alliance hostility reputation server-side", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("rel"),
  });
  assert.equal(typeof (core as { updateRelationship?: unknown }).updateRelationship, "function");
  const source = core.issueIdentity({ explorerId: "explorer_envoy", identityName: "灰港使节" }, {
    ...userContext,
    actorExplorerId: "explorer_envoy",
  });
  const target = core.issueIdentity({ explorerId: "explorer_rival", identityName: "盐门对手" }, {
    ...userContext,
    actorExplorerId: "explorer_rival",
  });
  core.grantResource({
    agentId: source.value.agentId,
    resourceId: "focus",
    amount: 5,
    reason: "relationship_seed",
  }, serverContext);

  const allied = (core as any).updateRelationship({
    sourceAgentId: source.value.agentId,
    targetAgentId: target.value.agentId,
    kind: "alliance",
    focusSpent: 2,
    reason: "shared_patrol",
    clientDeclaredScoreAfter: 999,
  }, {
    ...userContext,
    actorExplorerId: "explorer_envoy",
  });

  assert.deepEqual(allied.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "relationship_updated",
  ]);
  assert.equal(allied.value.scoreDelta, 4);
  assert.equal(allied.value.score, 4);
  assert.equal(core.project().resourceBalances[source.value.agentId].focus, 3);

  const hostile = (core as any).updateRelationship({
    sourceAgentId: source.value.agentId,
    targetAgentId: target.value.agentId,
    kind: "hostility",
    focusSpent: 1,
    reason: "border_incident",
  }, {
    ...userContext,
    actorExplorerId: "explorer_envoy",
  });

  assert.equal(hostile.value.scoreDelta, -2);
  assert.equal(hostile.value.score, -2);
  assert.equal(core.project().relationshipEdges[allied.value.relationshipId].score, 4);
  assert.equal(core.project().relationshipEdges[hostile.value.relationshipId].score, -2);
  assert.deepEqual(core.project().relationshipIdsByAgent[source.value.agentId], [
    allied.value.relationshipId,
    hostile.value.relationshipId,
  ]);
  assert.deepEqual(core.project().relationshipIdsByAgent[target.value.agentId], [
    allied.value.relationshipId,
    hostile.value.relationshipId,
  ]);
  assert.throws(() => (core as any).updateRelationship({
    sourceAgentId: source.value.agentId,
    targetAgentId: source.value.agentId,
    kind: "reputation",
    focusSpent: 1,
  }, userContext), /relationship_self_target_not_allowed/);
});

test("severe relationship hostility proposes target personality drift before owner confirmation", () => {
  const core = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("rel_drift"),
  });
  const relationshipCore = core as any;
  const source = core.issueIdentity({ explorerId: "explorer_betrayer", identityName: "背誓密使" }, {
    ...userContext,
    actorExplorerId: "explorer_betrayer",
  });
  const target = core.issueIdentity({ explorerId: "explorer_betrayed", identityName: "被背誓者" }, {
    ...userContext,
    actorExplorerId: "explorer_betrayed",
  });
  core.grantResource({
    agentId: source.value.agentId,
    resourceId: "focus",
    amount: 3,
    reason: "relationship_drift_seed",
  }, serverContext);

  const hostile = relationshipCore.updateRelationship({
    sourceAgentId: source.value.agentId,
    targetAgentId: target.value.agentId,
    kind: "hostility",
    focusSpent: 2,
    reason: "betrayal_broken_oath",
  }, {
    ...userContext,
    actorExplorerId: "explorer_betrayer",
  });

  const relationshipEvent = hostile.events.find((event: { eventType: string }) => event.eventType === "relationship_updated");
  const proposalEvent = hostile.events.find((event: { eventType: string }) => event.eventType === "personality_drift_proposed");
  assert.ok(relationshipEvent);
  assert.ok(proposalEvent);
  assert.equal(proposalEvent.payload.agentId, target.value.agentId);
  assert.match(proposalEvent.payload.trigger, /relationship_hostility/);
  assert.equal(proposalEvent.payload.sourceEventId, relationshipEvent.eventId);
  const driftId = proposalEvent.payload.driftId;
  assert.equal(core.project().personalityDrifts[driftId].status, "proposed");
  const initialTraits = [...core.project().identities[target.value.agentId].personality.traits];
  assert.equal(initialTraits.length, 2);
  assert.ok(!initialTraits.includes(proposalEvent.payload.suggestedTrait));

  assert.throws(() => relationshipCore.confirmPersonalityDrift({
    driftId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_betrayer",
  }), /personality_drift_owner_mismatch/);

  const confirmed = relationshipCore.confirmPersonalityDrift({
    driftId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_betrayed",
  });
  assert.deepEqual(confirmed.events.map((event: { eventType: string }) => event.eventType), ["personality_drift_confirmed"]);
  assert.deepEqual(core.project().identities[target.value.agentId].personality.traits, [
    ...initialTraits,
    proposalEvent.payload.suggestedTrait,
  ]);
  assert.equal(core.project().identities[target.value.agentId].personality.latestSourceEventId, relationshipEvent.eventId);
});

test("confirmed personality drift starts a cooldown before later betrayal scars can propose another drift", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("drift_cooldown"),
  });
  const relationshipCore = core as any;
  const source = core.issueIdentity({ explorerId: "explorer_drift_cooldown_source", identityName: "冷却背誓者" }, {
    ...userContext,
    actorExplorerId: "explorer_drift_cooldown_source",
  });
  const target = core.issueIdentity({ explorerId: "explorer_drift_cooldown_target", identityName: "冷却见证者" }, {
    ...userContext,
    actorExplorerId: "explorer_drift_cooldown_target",
  });
  core.grantResource({
    agentId: source.value.agentId,
    resourceId: "focus",
    amount: 6,
    reason: "personality_drift_cooldown_seed",
  }, serverContext);

  const firstHostile = relationshipCore.updateRelationship({
    sourceAgentId: source.value.agentId,
    targetAgentId: target.value.agentId,
    kind: "hostility",
    focusSpent: 2,
    reason: "first_betrayal_scar",
  }, {
    ...userContext,
    actorExplorerId: "explorer_drift_cooldown_source",
  });
  const firstProposal = firstHostile.events.find((event: { eventType: string }) => event.eventType === "personality_drift_proposed");
  assert.ok(firstProposal);
  relationshipCore.confirmPersonalityDrift({
    driftId: firstProposal.payload.driftId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_drift_cooldown_target",
  });

  const immediateHostile = relationshipCore.updateRelationship({
    sourceAgentId: source.value.agentId,
    targetAgentId: target.value.agentId,
    kind: "hostility",
    focusSpent: 1,
    reason: "second_betrayal_inside_cooldown",
  }, {
    ...userContext,
    actorExplorerId: "explorer_drift_cooldown_source",
  });
  assert.ok(immediateHostile.events.some((event: { eventType: string }) => event.eventType === "relationship_updated"));
  assert.equal(
    immediateHostile.events.some((event: { eventType: string }) => event.eventType === "personality_drift_proposed"),
    false,
  );
  assert.equal(core.project().personalityDriftIdsByAgent[target.value.agentId].length, 1);

  time.set("2026-07-03T00:00:00.000Z");
  const afterCooldownHostile = relationshipCore.updateRelationship({
    sourceAgentId: source.value.agentId,
    targetAgentId: target.value.agentId,
    kind: "hostility",
    focusSpent: 1,
    reason: "third_betrayal_after_cooldown",
  }, {
    ...userContext,
    actorExplorerId: "explorer_drift_cooldown_source",
  });
  const afterCooldownRelationship = afterCooldownHostile.events.find((event: { eventType: string }) => event.eventType === "relationship_updated");
  const afterCooldownProposal = afterCooldownHostile.events.find((event: { eventType: string }) => event.eventType === "personality_drift_proposed");
  assert.ok(afterCooldownRelationship);
  assert.ok(afterCooldownProposal);
  assert.equal(afterCooldownProposal.payload.sourceEventId, afterCooldownRelationship.eventId);
});

test("diplomacy proposals require target response before writing relationship chains", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("dip"),
  });
  assert.equal(typeof (core as { proposeDiplomacy?: unknown }).proposeDiplomacy, "function");
  assert.equal(typeof (core as { respondDiplomacy?: unknown }).respondDiplomacy, "function");
  const source = core.issueIdentity({ explorerId: "explorer_envoy", identityName: "灰港使节" }, {
    ...userContext,
    actorExplorerId: "explorer_envoy",
  });
  const target = core.issueIdentity({ explorerId: "explorer_rival", identityName: "盐门对手" }, {
    ...userContext,
    actorExplorerId: "explorer_rival",
  });
  core.grantResource({
    agentId: source.value.agentId,
    resourceId: "focus",
    amount: 3,
    reason: "diplomacy_seed_source",
  }, serverContext);
  core.grantResource({
    agentId: target.value.agentId,
    resourceId: "focus",
    amount: 2,
    reason: "diplomacy_seed_target",
  }, serverContext);

  const proposal = (core as any).proposeDiplomacy({
    regionId: "region_gray_harbor",
    sourceAgentId: source.value.agentId,
    targetAgentId: target.value.agentId,
    kind: "alliance",
    focusSpent: 1,
    terms: "share_gray_harbor_patrols",
    clientDeclaredStatus: "accepted",
  }, {
    ...userContext,
    actorExplorerId: "explorer_envoy",
  });

  assert.deepEqual(proposal.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "diplomacy_proposed",
  ]);
  assert.equal(proposal.value.status, "pending");
  assert.equal(proposal.value.regionId, "region_gray_harbor");
  assert.equal(core.project().resourceBalances[source.value.agentId].focus, 2);
  assert.equal(Object.keys(core.project().relationshipEdges).length, 0);
  assert.equal(core.project().regionActivities[proposal.events[1].eventId].kind, "diplomacy");

  assert.throws(() => (core as any).respondDiplomacy({
    diplomacyId: proposal.value.diplomacyId,
    responderAgentId: source.value.agentId,
    response: "accepted",
    focusSpent: 1,
  }, {
    ...userContext,
    actorExplorerId: "explorer_envoy",
  }), /diplomacy_responder_not_target/);

  const accepted = (core as any).respondDiplomacy({
    diplomacyId: proposal.value.diplomacyId,
    responderAgentId: target.value.agentId,
    response: "accepted",
    focusSpent: 1,
    note: "accepted_by_target",
    clientDeclaredScoreAfter: 999,
  }, {
    ...userContext,
    actorExplorerId: "explorer_rival",
  });

  assert.deepEqual(accepted.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "diplomacy_responded",
    "relationship_updated",
    "trace_created",
  ]);
  assert.equal(accepted.value.status, "accepted");
  assert.equal(accepted.value.response, "accepted");
  const relationship = Object.values(core.project().relationshipEdges)[0];
  assert.equal(accepted.value.relationshipId, relationship.relationshipId);
  assert.equal(relationship.kind, "alliance");
  assert.equal(relationship.score, 2);
  assert.equal(relationship.reason, `diplomacy_accept:${proposal.value.diplomacyId}`);
  assert.equal(core.project().resourceBalances[target.value.agentId].focus, 1);
  const trace = Object.values(core.project().conflictTraces).find((item) => item.sourceAggregateId === proposal.value.diplomacyId);
  assert.equal(trace?.sourceEventType, "diplomacy_responded");
  assert.deepEqual(trace?.participantAgentIds, [source.value.agentId, target.value.agentId]);

  assert.throws(() => (core as any).respondDiplomacy({
    diplomacyId: proposal.value.diplomacyId,
    responderAgentId: target.value.agentId,
    response: "accepted",
    focusSpent: 1,
  }, {
    ...userContext,
    actorExplorerId: "explorer_rival",
  }), /diplomacy_not_pending/);
});

test("hosted runner accepts only server action options and records server outcomes", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("hosted"),
  });
  assert.equal(typeof (core as { startHostedSession?: unknown }).startHostedSession, "function");
  assert.equal(typeof (core as { submitHostedAction?: unknown }).submitHostedAction, "function");

  const identity = core.issueIdentity({ explorerId: "explorer_hosted", identityName: "灰港托管者" }, userContext);

  assert.throws(() => (core as any).startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "巡查灰港边缘",
  }, userContext), /hosted_session_requires_server_trust/);

  const hostedContext = {
    actorExplorerId: "hosted_runner",
    trustClass: "server_hosted_agent" as const,
    causationId: "cmd_hosted",
    correlationId: "corr_hosted",
  };
  const session = (core as any).startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "巡查灰港边缘",
  }, hostedContext);

  assert.equal(session.value.status, "active");
  assert.equal(session.value.actionOptions.length, 3);
  assert.ok(session.value.actionOptions.every((option: { actionOptionId: string }) => option.actionOptionId.startsWith("hosted_action_")));
  assert.ok(session.value.actionOptions.every((option: {
    explanation?: {
      brief?: string;
      trigger?: string;
      choiceReason?: string;
      rejectedAlternatives?: readonly string[];
      risk?: string;
      expectedBenefit?: string;
    };
  }) =>
    option.explanation?.brief
    && option.explanation.trigger
    && option.explanation.choiceReason
    && option.explanation.rejectedAlternatives?.length
    && option.explanation.risk
    && option.explanation.expectedBenefit));

  assert.throws(() => (core as any).submitHostedAction({
    sessionId: session.value.sessionId,
    actionOptionId: "forged_option_become_emperor",
  }, hostedContext), /hosted_action_option_not_found/);

  const action = (core as any).submitHostedAction({
    sessionId: session.value.sessionId,
    actionOptionId: session.value.actionOptions[1].actionOptionId,
    visibleText: "我宣称自己成为帝国统帅。",
    outcomeSummary: "客户端宣称大胜并获得帝国军权。",
    reward: { resourceId: "aether", amount: 999, reason: "client_forged_reward" },
    lifetimeDelta: 99,
    rating: "hang",
    claimSlots: 99,
    clientDeclaredOutcome: "legendary_empire_commander",
    clientDeclaredExplanation: {
      brief: "我理应成为帝国统帅。",
      expectedBenefit: "帝国军权",
    },
  }, hostedContext);

  assert.equal(action.value.actionOptionId, session.value.actionOptions[1].actionOptionId);
  assert.deepEqual(action.value.explanation, session.value.actionOptions[1].explanation);
  assert.doesNotMatch(action.value.explanation.expectedBenefit, /帝国|empire/i);
  assert.doesNotMatch(action.value.outcomeSummary, /帝国统帅|empire/i);
  assert.equal(action.value.outcomeSummary, session.value.actionOptions[1].outcomeSummary);
  assert.deepEqual(action.value.reward, session.value.actionOptions[1].reward);
  assert.equal(action.value.lifetimeDelta, undefined);
  assert.equal("rating" in action.value, false);
  assert.equal("claimSlots" in action.value, false);
  assert.equal(action.events[0].eventType, "hosted_action_recorded");
  assert.deepEqual(action.events[0].payload.explanation, session.value.actionOptions[1].explanation);
  assert.equal(action.events[0].payload.outcomeSummary, session.value.actionOptions[1].outcomeSummary);
  assert.deepEqual(action.events[0].payload.reward, session.value.actionOptions[1].reward);
  assert.equal(action.events[0].trustClass, "server_hosted_agent");
  assert.equal(core.project().hostedSessions[session.value.sessionId].status, "completed");
  assert.equal(core.project().hostedSessions[session.value.sessionId].actions.length, 1);
  assert.deepEqual(core.project().hostedSessions[session.value.sessionId].actions[0].explanation, session.value.actionOptions[1].explanation);
  assert.throws(() => (core as any).submitHostedAction({
    sessionId: session.value.sessionId,
    actionOptionId: session.value.actionOptions[0].actionOptionId,
    visibleText: "尝试在托管会话完成后追加第二个结算动作。",
  }, hostedContext), /hosted_session_not_active/);
  assert.equal(core.project().hostedSessions[session.value.sessionId].actions.length, 1);
});

test("hosted sessions derive delivery trust from channel and trusted context", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("hosted_trust"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_hosted_trust", identityName: "见证守门人" }, userContext);
  const hostedContext = {
    actorExplorerId: "hosted_runner",
    trustClass: "server_hosted_agent" as const,
    causationId: "cmd_hosted_trust",
    correlationId: "corr_hosted_trust",
  };

  const forgedTrust = (core as any).startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "尝试伪装远程见证",
    deliveryTrust: "remote_attested_runner",
  }, hostedContext);

  assert.equal(forgedTrust.value.channelClass, "server_hosted");
  assert.equal(forgedTrust.value.deliveryTrust, "server_hosted_agent");
  assert.equal(forgedTrust.events[0].payload.deliveryTrust, "server_hosted_agent");

  const browserBridge = (core as any).startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "浏览器复制粘贴桥接",
    channelClass: "browser_copy_paste",
  }, hostedContext);

  assert.equal(browserBridge.value.channelClass, "browser_copy_paste");
  assert.equal(browserBridge.value.deliveryTrust, "untrusted_client");
  assert.equal(browserBridge.events[0].payload.deliveryTrust, "untrusted_client");
});

test("turn and hosted owner-authorized writes reject cross-owner actors", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("turn_owner"),
  });
  const ownerContext = {
    actorExplorerId: "explorer_turn_owner",
    trustClass: "user_verified_web" as const,
    causationId: "cmd_turn_owner",
    correlationId: "corr_turn_owner",
  };
  const bystanderContext = {
    actorExplorerId: "explorer_turn_bystander",
    trustClass: "user_verified_web" as const,
    causationId: "cmd_turn_bystander",
    correlationId: "corr_turn_owner",
  };
  const owner = core.issueIdentity({ explorerId: "explorer_turn_owner", identityName: "回合归属者" }, ownerContext);
  core.issueIdentity({ explorerId: "explorer_turn_bystander", identityName: "旁观者" }, bystanderContext);

  assert.throws(() => (core as any).createTurnCard({
    agentId: owner.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "旁观者试图创建别人的回合",
  }, bystanderContext), /turn_card_owner_mismatch/);
  assert.equal(Object.keys(core.project().turnCards).length, 0);

  const card = (core as any).createTurnCard({
    agentId: owner.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "归属者创建自己的回合",
  }, ownerContext);
  assert.throws(() => (core as any).resolveTurnCard({
    turnCardId: card.value.turnCardId,
    sequence: card.value.sequence,
    nonce: card.value.nonce,
    actionOptionId: card.value.actionOptions[0].actionOptionId,
    visibleText: "旁观者试图提交别人的回合",
  }, bystanderContext), /turn_card_owner_mismatch/);
  assert.equal(core.project().turnCards[card.value.turnCardId].status, "open");

  assert.throws(() => (core as any).startHostedSession({
    agentId: owner.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "旁观者试图创建别人的托管会话",
  }, bystanderContext), /hosted_session_owner_mismatch/);

  const session = (core as any).startHostedSession({
    agentId: owner.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "归属者创建自己的托管会话",
  }, ownerContext);
  assert.throws(() => (core as any).submitHostedAction({
    sessionId: session.value.sessionId,
    actionOptionId: session.value.actionOptions[0].actionOptionId,
    visibleText: "旁观者试图提交别人的托管行动",
  }, bystanderContext), /hosted_session_owner_mismatch/);
  assert.equal(core.project().hostedSessions[session.value.sessionId].status, "active");
});

test("turn cards expose visible choices and settle only server-issued options", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("turn"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_turn", identityName: "盐门巡路人" }, userContext);

  assert.equal(typeof (core as { createTurnCard?: unknown }).createTurnCard, "function");
  assert.equal(typeof (core as { resolveTurnCard?: unknown }).resolveTurnCard, "function");
  assert.throws(() => (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_salt_gate",
    prompt: "巡查盐门边缘",
  }, userContext), /turn_card_requires_server_trust/);

  const card = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_salt_gate",
    prompt: "巡查盐门边缘",
  }, serverContext);

  assert.equal(card.value.status, "open");
  assert.equal(card.value.agentId, identity.value.agentId);
  assert.equal(card.value.visibleContext.regionId, "region_salt_gate");
  assert.equal(card.value.actionOptions.length, 3);
  assert.ok(card.value.actionOptions.every((option: { outcomeSummary?: string; reward?: unknown; lifetimeDelta?: number }) =>
    !("outcomeSummary" in option) && !("reward" in option) && !("lifetimeDelta" in option)));
  assert.ok(card.value.actionOptions.every((option: {
    explanation?: {
      brief?: string;
      trigger?: string;
      choiceReason?: string;
      rejectedAlternatives?: readonly string[];
      risk?: string;
      expectedBenefit?: string;
    };
  }) =>
    option.explanation?.brief
    && option.explanation.trigger
    && option.explanation.choiceReason
    && option.explanation.rejectedAlternatives?.length
    && option.explanation.risk
    && option.explanation.expectedBenefit));
  assert.equal(core.project().turnCards[card.value.turnCardId].status, "open");

  assert.throws(() => (core as any).resolveTurnCard({
    turnCardId: card.value.turnCardId,
    sequence: card.value.sequence,
    nonce: card.value.nonce,
    actionOptionId: "forged_option_become_emperor",
    visibleText: "我成为帝国统帅。",
  }, serverContext), /turn_action_option_not_found/);

  const resolved = (core as any).resolveTurnCard({
    turnCardId: card.value.turnCardId,
    sequence: card.value.sequence,
    nonce: card.value.nonce,
    actionOptionId: card.value.actionOptions[1].actionOptionId,
    visibleText: "我成为帝国统帅。",
    outcomeSummary: "客户端宣称大胜并获得帝国军权。",
    reward: { resourceId: "aether", amount: 999, reason: "client_forged_reward" },
    lifetimeDelta: 99,
    rating: "hang",
    claimSlots: 99,
    clientDeclaredOutcome: "legendary_empire_commander",
    clientDeclaredExplanation: {
      brief: "我理应成为帝国统帅。",
      expectedBenefit: "帝国军权",
    },
  }, serverContext);

  assert.equal(resolved.value.turnCardId, card.value.turnCardId);
  assert.equal(resolved.value.actionOptionId, card.value.actionOptions[1].actionOptionId);
  assert.deepEqual(resolved.value.explanation, card.value.actionOptions[1].explanation);
  assert.doesNotMatch(resolved.value.explanation.expectedBenefit, /帝国|empire/i);
  assert.doesNotMatch(resolved.value.outcomeSummary, /帝国统帅|empire/i);
  assert.equal(resolved.value.outcomeSummary, "服务器结算为一次有效协助，获得少量钱币。");
  assert.deepEqual(resolved.value.reward, { resourceId: "coin", amount: 1, reason: "turn_assist" });
  assert.equal(resolved.value.lifetimeDelta, undefined);
  assert.equal("rating" in resolved.value, false);
  assert.equal("claimSlots" in resolved.value, false);
  assert.deepEqual(resolved.events.map((event: { eventType: string }) => event.eventType), ["turn_resolved", "resource_granted"]);
  assert.deepEqual(resolved.events[0].payload.explanation, card.value.actionOptions[1].explanation);
  assert.equal(resolved.events[0].payload.outcomeSummary, "服务器结算为一次有效协助，获得少量钱币。");
  assert.deepEqual(resolved.events[0].payload.reward, { resourceId: "coin", amount: 1, reason: "turn_assist" });
  assert.equal(core.project().turnCards[card.value.turnCardId].status, "resolved");
  assert.equal(core.project().turnCards[card.value.turnCardId].resolution?.actionOptionId, card.value.actionOptions[1].actionOptionId);
  assert.deepEqual(core.project().turnCards[card.value.turnCardId].resolution?.explanation, card.value.actionOptions[1].explanation);
});

test("turn cards expire before stale actions can settle", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("turn_expiry"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_turn_expiry", identityName: "过期回合巡路人" }, userContext);
  const card = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "短时效行动",
  }, serverContext);

  assert.equal(card.value.expiresAt, "2026-06-25T00:15:00.000Z");
  time.set("2026-06-25T00:16:00.000Z");
  assert.throws(() => (core as any).resolveTurnCard({
    turnCardId: card.value.turnCardId,
    sequence: card.value.sequence,
    nonce: card.value.nonce,
    actionOptionId: card.value.actionOptions[0].actionOptionId,
    visibleText: "我试图结算过期行动。",
  }, serverContext), /turn_card_expired/);
  assert.equal(core.project().turnCards[card.value.turnCardId].status, "open");
});

test("turn cards bind resolution to server sequence and nonce", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("turn_sequence"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_turn_sequence", identityName: "序列巡路人" }, userContext);
  const card = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "需要序列回显的行动",
  }, serverContext);
  const option = card.value.actionOptions[0];

  assert.equal(card.value.sequence, 1);
  assert.equal(core.project().turnCards[card.value.turnCardId].sequence, 1);
  assert.equal(typeof card.value.nonce, "string");
  assert.match(card.value.nonce, /^turn_sequence_challenge_/);
  assert.equal(core.project().turnCards[card.value.turnCardId].nonce, card.value.nonce);

  assert.throws(() => (core as any).resolveTurnCard({
    turnCardId: card.value.turnCardId,
    actionOptionId: option.actionOptionId,
    visibleText: "缺少序列回显。",
  }, serverContext), /turn_card_sequence_required/);

  assert.throws(() => (core as any).resolveTurnCard({
    turnCardId: card.value.turnCardId,
    actionOptionId: option.actionOptionId,
    sequence: card.value.sequence + 1,
    nonce: card.value.nonce,
    visibleText: "错误序列。",
  }, serverContext), /turn_card_sequence_mismatch/);

  assert.throws(() => (core as any).resolveTurnCard({
    turnCardId: card.value.turnCardId,
    actionOptionId: option.actionOptionId,
    sequence: card.value.sequence,
    visibleText: "缺少 nonce。",
  }, serverContext), /turn_card_nonce_required/);

  assert.throws(() => (core as any).resolveTurnCard({
    turnCardId: card.value.turnCardId,
    actionOptionId: option.actionOptionId,
    sequence: card.value.sequence,
    nonce: "forged_nonce",
    visibleText: "错误 nonce。",
  }, serverContext), /turn_card_nonce_mismatch/);

  const resolved = (core as any).resolveTurnCard({
    turnCardId: card.value.turnCardId,
    actionOptionId: option.actionOptionId,
    sequence: card.value.sequence,
    nonce: card.value.nonce,
    visibleText: "正确回显序列与 nonce。",
  }, serverContext);
  assert.equal(resolved.value.sequence, card.value.sequence);
  assert.equal(resolved.value.nonce, card.value.nonce);
  assert.equal(resolved.value.channelClass, "system_worker");
  assert.equal(resolved.value.envelopeId, card.value.signedEnvelope.envelopeId);
  assert.equal(resolved.value.signedEnvelope.protocolVersion, "obsidian-epoch.turn-resolution-envelope.v1");
  assert.equal(resolved.value.signedEnvelope.signatureAlgorithm, "Ed25519");
  assert.equal(resolved.value.signedEnvelope.trustClass, "system_worker");
  assert.equal(resolved.value.signedEnvelope.runTicketId, null);
  assert.notEqual(resolved.value.signedEnvelope.envelopeId, card.value.signedEnvelope.envelopeId);
  assert.equal(resolved.value.signedEnvelope.contentHash, sha256Stable(turnResolutionSignedEnvelopeContent(resolved.value)));
  assert.equal(verifySignature(
    null,
    Buffer.from(resolved.value.signedEnvelope.contentHash, "utf8"),
    publicKeyFromBase64(resolved.value.signedEnvelope.serverPublicKey),
    Buffer.from(resolved.value.signedEnvelope.signature, "base64"),
  ), true);

  const resolvedEvents = resolved.events as EpochEvent[];
  const resolvedEvent = resolvedEvents.find((event) => event.eventType === "turn_resolved");
  assert.ok(resolvedEvent);
  assert.equal(resolvedEvent.payload.channelClass, "system_worker");
  assert.equal(resolvedEvent.payload.envelopeId, card.value.signedEnvelope.envelopeId);
  assert.equal(resolvedEvent.payload.turnCardId, card.value.turnCardId);
  assert.equal(resolvedEvent.payload.sequence, card.value.sequence);
  assert.equal(resolvedEvent.payload.actionOptionId, option.actionOptionId);
  assert.equal(resolvedEvent.payload.signedEnvelope.contentHash, resolved.value.signedEnvelope.contentHash);

  const projectedResolution = core.project().turnCards[card.value.turnCardId].resolution;
  assert.ok(projectedResolution);
  assert.equal(projectedResolution.channelClass, "system_worker");
  assert.equal(projectedResolution.envelopeId, card.value.signedEnvelope.envelopeId);
  assert.equal(projectedResolution.signedEnvelope.contentHash, resolved.value.signedEnvelope.contentHash);

  const nextCard = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "下一张序列卡",
  }, serverContext);
  assert.equal(nextCard.value.sequence, 2);
  assert.notEqual(nextCard.value.nonce, card.value.nonce);
});

test("turn cards include a verifiable server-signed envelope", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("turn_envelope"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_turn_envelope", identityName: "签名信封巡路人" }, userContext);
  const card = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "需要服务器签名信封的行动",
  }, serverContext);
  const envelope = card.value.signedEnvelope;

  assert.equal(envelope.protocolVersion, "obsidian-epoch.turn-card-envelope.v1");
  assert.equal(envelope.signatureAlgorithm, "Ed25519");
  assert.equal(envelope.trustClass, "system_worker");
  assert.equal(envelope.runTicketId, null);
  assert.equal(typeof envelope.envelopeId, "string");
  assert.equal(typeof envelope.serverPublicKey, "string");
  assert.equal(typeof envelope.signature, "string");
  assert.equal(envelope.contentHash, sha256Stable(turnCardSignedEnvelopeContent(card.value)));
  assert.equal(verifySignature(
    null,
    Buffer.from(envelope.contentHash, "utf8"),
    publicKeyFromBase64(envelope.serverPublicKey),
    Buffer.from(envelope.signature, "base64"),
  ), true);
  assert.equal(core.project().turnCards[card.value.turnCardId].signedEnvelope?.contentHash, envelope.contentHash);
});

test("turn cards allow only one unexpired open card per identity", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("turn_single_open"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_turn_single_open", identityName: "单卡巡路人" }, userContext);
  const firstCard = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "第一张行动卡",
  }, serverContext);

  assert.throws(() => (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "未结算前试图再开一张",
  }, serverContext), /turn_card_already_open/);

  const observe = firstCard.value.actionOptions.find((option: { optionKey: string }) => option.optionKey === "observe");
  assert.ok(observe);
  (core as any).resolveTurnCard({
    turnCardId: firstCard.value.turnCardId,
    sequence: firstCard.value.sequence,
    nonce: firstCard.value.nonce,
    actionOptionId: observe.actionOptionId,
    visibleText: "先结算第一张卡。",
  }, serverContext);
  const secondCard = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "结算后允许新卡",
  }, serverContext);
  assert.notEqual(secondCard.value.turnCardId, firstCard.value.turnCardId);

  time.set("2026-06-25T00:16:00.000Z");
  const expiredIdentity = core.issueIdentity({
    explorerId: "explorer_turn_single_expired",
    identityName: "过期单卡巡路人",
  }, {
    actorExplorerId: "explorer_turn_single_expired",
    trustClass: "user_verified_web" as const,
    causationId: "cmd_turn_single_expired_identity",
    correlationId: "corr_turn_single_expired",
  });
  const expiredCard = (core as any).createTurnCard({
    agentId: expiredIdentity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "即将过期的行动卡",
  }, serverContext);
  time.set("2026-06-25T00:32:00.000Z");
  const refreshedCard = (core as any).createTurnCard({
    agentId: expiredIdentity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "过期后刷新行动卡",
  }, serverContext);
  assert.notEqual(refreshedCard.value.turnCardId, expiredCard.value.turnCardId);
});

test("first high-risk turn protects the starter identity and isolates strong rewards", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("starter"),
    defaultLifetime: 1,
  });
  const identity = core.issueIdentity({ explorerId: "explorer_starter", identityName: "首局巡路人" }, userContext);

  const firstCard = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "第一次接触低阶异常",
  }, serverContext);
  const firstHighRisk = firstCard.value.actionOptions.find((option: { risk: string }) => option.risk === "high");
  assert.ok(firstHighRisk);

  const protectedResult = (core as any).resolveTurnCard({
    turnCardId: firstCard.value.turnCardId,
    sequence: firstCard.value.sequence,
    nonce: firstCard.value.nonce,
    actionOptionId: firstHighRisk.actionOptionId,
    visibleText: "首局保护下接触异常。",
  }, serverContext);

  assert.deepEqual(protectedResult.events.map((event: { eventType: string }) => event.eventType), ["turn_resolved"]);
  assert.equal(protectedResult.value.nonEvidence, true);
  assert.equal(protectedResult.events[0].payload.nonEvidence, true);
  assert.equal(protectedResult.value.reward, undefined);
  assert.equal(protectedResult.value.lifetimeDelta, undefined);
  assert.equal(core.project().identities[identity.value.agentId].status, "active");
  assert.equal(core.project().identities[identity.value.agentId].lifetime.remaining, 1);
  assert.equal(core.project().resourceBalances[identity.value.agentId]?.aether || 0, 0);

  const reuserContext = { ...userContext, actorExplorerId: "explorer_starter_reuser" };
  const reuser = core.issueIdentity({
    explorerId: "explorer_starter_reuser",
    identityName: "首局证据复用者",
  }, reuserContext);
  assert.throws(() => (core as any).recordLoreContribution({
    agentId: reuser.value.agentId,
    category: "confirmation",
    targetId: "starter-protected-anomaly",
    summary: "尝试用他人首局保护线索补证",
    sourceEventIds: [protectedResult.events[0].eventId],
  }, reuserContext), /lore_contribution_non_evidence_source/);

  const secondCard = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "第二次接触低阶异常",
  }, serverContext);
  const secondHighRisk = secondCard.value.actionOptions.find((option: { risk: string }) => option.risk === "high");
  assert.ok(secondHighRisk);

  const terminalResult = (core as any).resolveTurnCard({
    turnCardId: secondCard.value.turnCardId,
    sequence: secondCard.value.sequence,
    nonce: secondCard.value.nonce,
    actionOptionId: secondHighRisk.actionOptionId,
    visibleText: "第二局风险正常结算。",
  }, serverContext);

  assert.deepEqual(terminalResult.events.map((event: { eventType: string }) => event.eventType), [
    "turn_resolved",
    "resource_granted",
    "lifetime_adjusted",
    "identity_archived",
    "identity_issued",
    "reincarnation_issued",
  ]);
  assert.equal(terminalResult.value.reward?.resourceId, "aether");
  assert.equal(core.project().identities[identity.value.agentId].status, "archived");
});

test("lore refutations consume a daily quota before repeated challenges can keep scoring", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("lore_refutation_quota"),
  });
  const ownerContext = {
    ...userContext,
    actorExplorerId: "explorer_refutation_quota",
  };
  const identity = core.issueIdentity({
    explorerId: "explorer_refutation_quota",
    identityName: "灰港反证员",
  }, ownerContext);
  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "focus",
    amount: 4,
    reason: "seed_refutation_quota_focus",
  }, serverContext);
  const sourceEventId = identity.events[0].eventId;

  for (let index = 0; index < 3; index += 1) {
    const contribution = (core as any).recordLoreContribution({
      agentId: identity.value.agentId,
      category: "refutation",
      targetId: `claim:gray-harbor-overclaim-${index}`,
      summary: `以服务器身份事件反证第 ${index + 1} 条过度宣称。`,
      sourceEventIds: [sourceEventId],
    }, ownerContext);
    assert.equal(contribution.value.category, "refutation");
    assert.equal(contribution.value.cost?.reason, "lore_refutation_cost");
  }

  assert.throws(() => (core as any).recordLoreContribution({
    agentId: identity.value.agentId,
    category: "refutation",
    targetId: "claim:gray-harbor-overclaim-4",
    summary: "同一日第四次反证应消耗完每日额度。",
    sourceEventIds: [sourceEventId],
  }, ownerContext), /lore_refutation_daily_quota_exceeded/);

  time.set("2026-06-26T00:00:00.000Z");
  const nextDay = (core as any).recordLoreContribution({
    agentId: identity.value.agentId,
    category: "refutation",
    targetId: "claim:gray-harbor-overclaim-next-day",
    summary: "跨天后可以重新使用反证额度。",
    sourceEventIds: [sourceEventId],
  }, ownerContext);
  assert.equal(nextDay.value.category, "refutation");
});

test("first high-risk hosted action uses the same starter protection policy", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("starter_hosted"),
    defaultLifetime: 1,
  });
  const identity = core.issueIdentity({ explorerId: "explorer_starter_hosted", identityName: "首局托管者" }, userContext);
  const hostedContext = {
    actorExplorerId: "hosted_runner",
    trustClass: "server_hosted_agent" as const,
    causationId: "cmd_starter_hosted",
    correlationId: "corr_starter_hosted",
  };
  const session = (core as any).startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "首局托管高风险测试",
  }, hostedContext);
  const highRisk = session.value.actionOptions.find((option: { risk: string }) => option.risk === "high");
  assert.ok(highRisk);

  const protectedAction = (core as any).submitHostedAction({
    sessionId: session.value.sessionId,
    actionOptionId: highRisk.actionOptionId,
    visibleText: "首局托管保护下接触异常。",
  }, hostedContext);

  assert.deepEqual(protectedAction.events.map((event: { eventType: string }) => event.eventType), ["hosted_action_recorded"]);
  assert.equal(protectedAction.value.nonEvidence, true);
  assert.equal(protectedAction.events[0].payload.nonEvidence, true);
  assert.equal(protectedAction.value.reward, undefined);
  assert.equal(protectedAction.value.lifetimeDelta, undefined);
  assert.equal(core.project().identities[identity.value.agentId].status, "active");
  assert.equal(core.project().identities[identity.value.agentId].lifetime.remaining, 1);
  assert.equal(core.project().resourceBalances[identity.value.agentId]?.aether || 0, 0);
});

test("high-risk options are throttled after the per-identity risk package is spent", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("risk_package"),
    defaultLifetime: 10,
  });
  const identity = core.issueIdentity({ explorerId: "explorer_risk_package", identityName: "高危节流测试员" }, userContext);

  for (const index of [1, 2]) {
    const card = (core as any).createTurnCard({
      agentId: identity.value.agentId,
      regionId: "region_gray_harbor",
      prompt: `高危请求 ${index}`,
    }, serverContext);
    const highRisk = card.value.actionOptions.find((option: { risk: string }) => option.risk === "high");
    assert.ok(highRisk);
    const resolved = (core as any).resolveTurnCard({
      turnCardId: card.value.turnCardId,
      sequence: card.value.sequence,
      nonce: card.value.nonce,
      actionOptionId: highRisk.actionOptionId,
      visibleText: `接受服务器签发的第 ${index} 次高危选项。`,
    }, serverContext);
    assert.equal(resolved.value.risk, "high");
  }

  const cappedCard = (core as any).createTurnCard({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    prompt: "第三次高危请求应被服务器折叠为低/中风险替代",
  }, serverContext);
  assert.equal(cappedCard.value.actionOptions.some((option: { risk: string }) => option.risk === "high"), false);
  assert.deepEqual(cappedCard.value.actionOptions.map((option: { optionKey: string }) => option.optionKey), ["observe", "assist"]);

  const hosted = (core as any).startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "高危托管请求也应被同一风险包节流",
  }, {
    actorExplorerId: "hosted_runner",
    trustClass: "server_hosted_agent" as const,
    causationId: "cmd_risk_package_hosted",
    correlationId: "corr_risk_package_hosted",
  });
  assert.equal(hosted.value.actionOptions.some((option: { risk: string }) => option.risk === "high"), false);
});

test("repeatable basic action rewards stop after the per-identity allowance is spent", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("basic_reward"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_basic_reward", identityName: "基础收益测试员" }, userContext);

  for (const index of [1, 2, 3]) {
    const card = (core as any).createTurnCard({
      agentId: identity.value.agentId,
      regionId: "region_gray_harbor",
      prompt: `第 ${index} 次观察区域势态`,
    }, serverContext);
    const observe = card.value.actionOptions.find((option: { optionKey: string }) => option.optionKey === "observe");
    assert.ok(observe);
    const resolved = (core as any).resolveTurnCard({
      turnCardId: card.value.turnCardId,
      sequence: card.value.sequence,
      nonce: card.value.nonce,
      actionOptionId: observe.actionOptionId,
      visibleText: `执行第 ${index} 次稳健观察。`,
    }, serverContext);
    if (index < 3) {
      assert.equal(resolved.value.reward?.resourceId, "focus");
    } else {
      assert.equal(resolved.value.reward, undefined);
      assert.deepEqual(resolved.events.map((event: { eventType: string }) => event.eventType), ["turn_resolved"]);
    }
  }

  assert.equal(core.project().resourceBalances[identity.value.agentId]?.focus || 0, 2);

  const hosted = (core as any).startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "基础收益池耗尽后继续观察",
  }, {
    actorExplorerId: "hosted_runner",
    trustClass: "server_hosted_agent" as const,
    causationId: "cmd_basic_reward_hosted",
    correlationId: "corr_basic_reward_hosted",
  });
  const hostedObserve = hosted.value.actionOptions.find((option: { optionKey: string }) => option.optionKey === "observe");
  assert.ok(hostedObserve);
  assert.equal(hostedObserve.reward, undefined);
  const recorded = (core as any).submitHostedAction({
    sessionId: hosted.value.sessionId,
    actionOptionId: hostedObserve.actionOptionId,
    visibleText: "托管继续观察，但服务器不再铸造基础 focus。",
  }, {
    actorExplorerId: "hosted_runner",
    trustClass: "server_hosted_agent" as const,
    causationId: "cmd_basic_reward_hosted_submit",
    correlationId: "corr_basic_reward_hosted",
  });
  assert.equal(recorded.value.reward, undefined);
  assert.equal(core.project().resourceBalances[identity.value.agentId]?.focus || 0, 2);
});

test("hosted runner records attestation evidence when a trusted runner submits an action", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("attested"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_attested", identityName: "远程见证者" }, userContext);
  const runnerContext = {
    actorExplorerId: "runner_remote_1",
    trustClass: "remote_attested_runner" as const,
    causationId: "cmd_attested",
    correlationId: "corr_attested",
  };
  const session = (core as any).startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "远程见证巡查",
  }, runnerContext);

  const signatureBase = JSON.stringify({
    runnerId: "runner_remote_1",
    challengeId: "challenge_remote_1",
    sessionId: session.value.sessionId,
    actionOptionId: session.value.actionOptions[0].actionOptionId,
    transcriptHash: "sha256:transcript_hash",
  });
  const action = (core as any).submitHostedAction({
    sessionId: session.value.sessionId,
    actionOptionId: session.value.actionOptions[0].actionOptionId,
    visibleText: "远程 runner 选择服务器签发的观察选项。",
    attestation: {
      attestationId: "attestation_remote_1",
      runnerId: "runner_remote_1",
      challengeId: "challenge_remote_1",
      transcriptHash: "sha256:transcript_hash",
      signature: "abc123",
      signatureBase,
      signatureBaseHash: "sha256:signature_base_hash",
    },
  }, runnerContext);

  assert.deepEqual(action.events.map((event: { eventType: string }) => event.eventType).slice(0, 2), [
    "attestation_recorded",
    "hosted_action_recorded",
  ]);
  assert.equal(action.value.attestationId, "attestation_remote_1");
  assert.equal(action.value.channelClass, "server_hosted");
  assert.equal(action.value.deliveryTrust, "remote_attested_runner");
  assert.equal(action.value.signedEnvelope.protocolVersion, "obsidian-epoch.hosted-action-envelope.v1");
  assert.equal(action.value.signedEnvelope.signatureAlgorithm, "Ed25519");
  assert.equal(action.value.signedEnvelope.trustClass, "remote_attested_runner");
  assert.equal(action.value.signedEnvelope.runTicketId, null);
  assert.equal(action.value.signedEnvelope.contentHash, sha256Stable(hostedActionSignedEnvelopeContent(action.value)));
  assert.equal(verifySignature(
    null,
    Buffer.from(action.value.signedEnvelope.contentHash, "utf8"),
    publicKeyFromBase64(action.value.signedEnvelope.serverPublicKey),
    Buffer.from(action.value.signedEnvelope.signature, "base64"),
  ), true);
  assert.equal(action.events[0].trustClass, "remote_attested_runner");
  assert.equal(action.events[1].payload.channelClass, "server_hosted");
  assert.equal(action.events[1].payload.deliveryTrust, "remote_attested_runner");
  assert.equal(action.events[1].payload.signedEnvelope.contentHash, action.value.signedEnvelope.contentHash);
  assert.equal(core.project().attestationRecords.attestation_remote_1.runnerId, "runner_remote_1");
  assert.equal(core.project().attestationRecords.attestation_remote_1.signatureBase, signatureBase);
  assert.equal(core.project().hostedSessions[session.value.sessionId].actions[0].attestationId, "attestation_remote_1");
  assert.equal(core.project().hostedSessions[session.value.sessionId].actions[0].deliveryTrust, "remote_attested_runner");
  assert.equal(core.project().hostedSessions[session.value.sessionId].actions[0].signedEnvelope.contentHash, action.value.signedEnvelope.contentHash);
});

test("agents can post server-recorded world and region messages", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("msg"),
  });
  assert.equal(typeof (core as { postMessage?: unknown }).postMessage, "function");
  const messageContext = {
    ...userContext,
    actorExplorerId: "explorer_message",
  };
  const identity = core.issueIdentity({ explorerId: "explorer_message", identityName: "灰港发言人" }, messageContext);

  const regionMessage = (core as any).postMessage({
    agentId: identity.value.agentId,
    scope: "region",
    regionId: "region_gray_harbor",
    body: "灰港边缘风向改变。",
  }, messageContext);
  assert.equal(regionMessage.events[0].eventType, "message_posted");
  assert.equal(regionMessage.value.scope, "region");
  assert.equal(core.project().regionMessages.region_gray_harbor[0].body, "灰港边缘风向改变。");

  const worldMessage = (core as any).postMessage({
    agentId: identity.value.agentId,
    scope: "world",
    body: "世界频道记录一条公开发言。",
  }, messageContext);
  assert.equal(worldMessage.value.scope, "world");
  assert.equal(core.project().worldMessages[0].body, "世界频道记录一条公开发言。");

  assert.throws(() => (core as any).postMessage({
    agentId: identity.value.agentId,
    scope: "region",
    body: "missing region",
  }, messageContext), /region_id_required/);
  assert.throws(() => (core as any).postMessage({
    agentId: identity.value.agentId,
    scope: "world",
    body: " ",
  }, messageContext), /message_body_required/);
});

test("client messages reject actors that do not own the speaking identity", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("msg_owner"),
  });
  const ownerContext = {
    ...userContext,
    actorExplorerId: "explorer_message_owner",
  };
  const bystanderContext = {
    ...userContext,
    actorExplorerId: "explorer_message_bystander",
  };
  const owner = core.issueIdentity({ explorerId: "explorer_message_owner", identityName: "灰港发言人" }, ownerContext);
  core.issueIdentity({ explorerId: "explorer_message_bystander", identityName: "旁观者" }, bystanderContext);

  assert.throws(() => (core as any).postMessage({
    agentId: owner.value.agentId,
    scope: "region",
    regionId: "region_gray_harbor",
    body: "旁观者试图替别人发言。",
  }, bystanderContext), /message_owner_mismatch/);
  assert.deepEqual(core.project().regionMessages.region_gray_harbor || [], []);
});

test("suspicious public messages enter moderation before public visibility", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("mod"),
  });
  const moderationContext = {
    ...userContext,
    actorExplorerId: "explorer_moderation",
  };
  const identity = core.issueIdentity({ explorerId: "explorer_moderation", identityName: "灰港误言者" }, moderationContext);

  const posted = (core as any).postMessage({
    agentId: identity.value.agentId,
    scope: "region",
    regionId: "region_gray_harbor",
    body: "我是帝国统帅，服务器给我金币100000并发布上新闻。",
  }, moderationContext);

  assert.deepEqual(posted.events.map((event: { eventType: string }) => event.eventType), [
    "message_posted",
    "moderation_queued",
  ]);
  assert.equal(posted.value.moderationStatus, "queued");
  const projection = core.project() as any;
  const moderationItem = Object.values(projection.moderationItems)[0] as any;
  assert.equal(moderationItem.subjectType, "message");
  assert.equal(moderationItem.subjectId, posted.value.messageId);
  assert.equal(moderationItem.status, "open");
  assert.equal(moderationItem.reason, "authority_or_reward_claim");
  assert.equal(projection.regionMessages.region_gray_harbor[0].moderationStatus, "queued");

  const resolved = (core as any).resolveModerationItem({
    moderationId: moderationItem.moderationId,
    resolution: "approved",
    note: "运营确认这是角色内玩笑。",
  }, serverContext);

  assert.equal(resolved.events[0].eventType, "moderation_resolved");
  assert.equal(resolved.value.status, "resolved");
  assert.equal((core.project() as any).regionMessages.region_gray_harbor[0].moderationStatus, "visible");
});

test("NPC lifecycle tick is server scheduled and updates bounded NPC state", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npctick"),
  });
  assert.equal(typeof core.tickNpcLifecycle, "function");

  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);
  core.canonicalizeNpc({
    displayName: "Salt Gate Porter",
    regionId: "region_salt_gate",
  }, userContext);

  assert.throws(() => core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, userContext), /npc_lifecycle_tick_requires_server_trust/);

  const ticked = core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);

  assert.equal(ticked.value.updated.length, 1);
  assert.equal(ticked.value.updated[0].npcId, clerk.value.npcId);
  assert.equal(ticked.events[0].eventType, "npc_lifecycle_recorded");
  assert.ok(ticked.events.some((event) => event.eventType === "npc_memory_recorded"));
  assert.equal(core.project().npcs[clerk.value.npcId].lifecycle.length, 1);
  assert.deepEqual(core.project().npcs[clerk.value.npcId].lifecycle[0].changes, {
    assets_delta: 10000,
    work_status: "working",
  });
});

test("NPC lifecycle tick records canonical organization membership and career state", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npcsoc"),
  });
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);

  const ticked = core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const projection = core.project() as any;
  const memberships = Object.values(projection.organizationMemberships || {}) as any[];
  const careers = Object.values(projection.npcCareerRecords || {}) as any[];

  assert.ok(ticked.events.some((event: { eventType: string }) => event.eventType === "organization_membership_changed"));
  assert.ok(ticked.events.some((event: { eventType: string }) => event.eventType === "npc_career_changed"));
  assert.equal(ticked.value.organizationMemberships.length, 1);
  assert.equal(ticked.value.careers.length, 1);
  assert.equal(memberships[0].npcId, clerk.value.npcId);
  assert.equal(memberships[0].regionId, "region_gray_harbor");
  assert.equal(projection.organizationMembershipIdsByNpc[clerk.value.npcId][0], memberships[0].membershipId);
  assert.equal(projection.organizationMembershipIdsByRegion.region_gray_harbor[0], memberships[0].membershipId);
  assert.ok(projection.organizations[memberships[0].organizationId].memberNpcIds.includes(clerk.value.npcId));
  assert.equal(careers[0].npcId, clerk.value.npcId);
  assert.equal(careers[0].regionId, "region_gray_harbor");
  assert.equal(projection.npcCareerIdsByNpc[clerk.value.npcId][0], careers[0].careerId);
});

test("operator can create an empty organization before NPC lifecycle membership exists", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("operator_org"),
  });

  assert.throws(() => core.createOrganization({
    regionId: "region_gray_harbor",
    displayName: "灰港守夜会",
  }, userContext), /organization_create_operator_required/);

  const created = core.createOrganization({
    regionId: "region_gray_harbor",
    displayName: "灰港守夜会",
  }, serverContext);
  const organization = created.value;
  const projection = core.project();

  assert.equal(created.events[0].eventType, "organization_created");
  assert.equal(organization.displayName, "灰港守夜会");
  assert.equal(organization.regionId, "region_gray_harbor");
  assert.deepEqual(organization.memberNpcIds, []);
  assert.deepEqual(organization.memberAgentIds, []);
  assert.equal(projection.organizations[organization.organizationId].organizationId, organization.organizationId);
  assert.ok((projection.organizationMembershipIdsByRegion.region_gray_harbor || []).length === 0);

  const duplicate = core.createOrganization({
    regionId: "region_gray_harbor",
    displayName: "灰港守夜会",
  }, serverContext);
  assert.equal(duplicate.events.length, 0);
  assert.equal(duplicate.value.organizationId, organization.organizationId);
});

test("agent organization membership is owner-authorized and projected as organization side state", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("agentorg"),
  });
  core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);
  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const organization = Object.values(core.project().organizations)[0];
  assert.ok(organization);
  const identity = core.issueIdentity({
    explorerId: "explorer_org_agent",
    identityName: "灰港见习会友",
  }, {
    ...userContext,
    actorExplorerId: "explorer_org_agent",
  });

  assert.throws(() => core.updateOrganizationMembership({
    agentId: identity.value.agentId,
    organizationId: organization.organizationId,
    role: "scout",
    status: "active",
  }, {
    ...userContext,
    actorExplorerId: "explorer_intruder",
  }), /organization_membership_owner_mismatch/);

  const joined = core.updateOrganizationMembership({
    agentId: identity.value.agentId,
    organizationId: organization.organizationId,
    role: "scout",
    status: "active",
  }, {
    ...userContext,
    actorExplorerId: "explorer_org_agent",
  });
  const membership = joined.value;
  const projection = core.project();

  assert.equal(joined.events[0].eventType, "organization_membership_changed");
  assert.equal(membership.memberType, "agent");
  assert.equal(membership.agentId, identity.value.agentId);
  assert.equal(membership.explorerId, "explorer_org_agent");
  assert.equal(membership.organizationName, organization.displayName);
  assert.equal(projection.organizationMembershipIdsByAgent[identity.value.agentId][0], membership.membershipId);
  assert.ok(projection.organizationMembershipIdsByRegion.region_gray_harbor.includes(membership.membershipId));
  assert.ok(projection.organizations[organization.organizationId].memberAgentIds.includes(identity.value.agentId));

  const left = core.updateOrganizationMembership({
    agentId: identity.value.agentId,
    organizationId: organization.organizationId,
    role: "scout",
    status: "left",
  }, {
    ...userContext,
    actorExplorerId: "explorer_org_agent",
  });
  assert.equal(left.value.status, "left");
  assert.ok(!core.project().organizations[organization.organizationId].memberAgentIds.includes(identity.value.agentId));
});

test("organization membership role changes cannot self-promote into treasury approver", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("org_role_escalation"),
  });
  core.canonicalizeNpc({
    displayName: "Gray Harbor Role Clerk",
    regionId: "region_gray_harbor",
  }, serverContext);
  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const organization = Object.values(core.project().organizations)[0];
  assert.ok(organization);
  const memberContext = {
    ...userContext,
    actorExplorerId: "explorer_org_role_member",
  };
  const member = core.issueIdentity({ explorerId: "explorer_org_role_member", identityName: "灰港普通成员" }, memberContext);
  const joined = core.updateOrganizationMembership({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    role: "scout",
    status: "active",
  }, memberContext);
  assert.equal(joined.value.role, "scout");

  assert.throws(() => core.updateOrganizationMembership({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    role: "vanguard",
    status: "active",
  }, memberContext), /organization_membership_role_escalation_requires_authority/);
  assert.equal(core.project().organizationMemberships[joined.value.membershipId].role, "scout");

  const promoted = core.updateOrganizationMembership({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    role: "vanguard",
    status: "active",
  }, serverContext);
  assert.equal(promoted.value.role, "vanguard");
});

test("organization politics are server-owned and projected by region organization and NPC", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("orgpol"),
  });
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);
  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);

  assert.throws(() => core.tickOrganizationPolitics({
    regionId: "region_gray_harbor",
    limit: 1,
  }, userContext), /organization_politics_tick_requires_server_trust/);

  const ticked = core.tickOrganizationPolitics({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const projection = core.project();
  const politics = ticked.value.politics[0];

  assert.equal(ticked.events[0].eventType, "organization_politics_recorded");
  assert.equal(politics.regionId, "region_gray_harbor");
  assert.equal(politics.npcId, clerk.value.npcId);
  assert.equal(politics.standingDelta, 2);
  assert.equal(politics.standingAfter, 2);
  assert.equal(projection.organizationPolitics[politics.politicsId].politicsId, politics.politicsId);
  assert.equal(projection.organizationPoliticsIdsByRegion.region_gray_harbor[0], politics.politicsId);
  assert.equal(projection.organizationPoliticsIdsByOrganization[politics.organizationId][0], politics.politicsId);
  assert.equal(projection.organizationPoliticsIdsByNpc[clerk.value.npcId][0], politics.politicsId);
  assert.equal(projection.organizationPoliticalStandingByOrganization[politics.organizationId], 2);
  assert.equal(
    projection.regionActivities[politics.politicsId].sourceEventType,
    "organization_politics_recorded",
  );
});

test("NPC lifecycle tick creates canonical relationship records", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npcrel"),
  });
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);

  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const marriageTick = core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const projection = core.project();
  const relationships = Object.values(projection.npcRelationships);
  const spouse = relationships.find((relationship) => relationship.kind === "spouse");

  assert.ok(marriageTick.events.some((event: { eventType: string }) => event.eventType === "npc_canonicalized"));
  assert.ok(marriageTick.events.some((event: { eventType: string }) => event.eventType === "npc_relationship_recorded"));
  assert.ok(spouse);
  assert.equal(spouse.sourceNpcId, clerk.value.npcId);
  assert.ok(projection.npcRelationshipIdsByNpc[clerk.value.npcId].includes(spouse.relationshipId));
  assert.equal(projection.npcs[spouse.targetNpcId].regionId, "region_gray_harbor");
});

test("NPC lifecycle tick creates richer social relationship records", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npcrichrel"),
  });
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);

  const workTick = core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 1 }, serverContext);
  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 1 }, serverContext);
  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 1 }, serverContext);
  const socialTick = core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 1 }, serverContext);
  const projection = core.project();
  const relationships: EpochNpcRelationship[] = Object.values(projection.npcRelationships);
  const clerkRelationships = relationships.filter((relationship) =>
    relationship.sourceNpcId === clerk.value.npcId || relationship.targetNpcId === clerk.value.npcId);
  const clerkKinds = new Set(clerkRelationships.map((relationship) => relationship.kind));

  assert.ok(workTick.events.some((event: { eventType: string }) => event.eventType === "npc_relationship_recorded"));
  assert.ok(socialTick.events.some((event: { eventType: string }) => event.eventType === "npc_relationship_recorded"));
  for (const kind of ["friend", "enemy", "superior", "subordinate", "mentor", "apprentice", "creditor", "debtor"] as const) {
    assert.ok(clerkKinds.has(kind), `missing ${kind}`);
  }
  const subordinate = clerkRelationships.find((relationship) => relationship.kind === "subordinate");
  const superior = clerkRelationships.find((relationship) => relationship.kind === "superior");
  const apprentice = clerkRelationships.find((relationship) => relationship.kind === "apprentice");
  const mentor = clerkRelationships.find((relationship) => relationship.kind === "mentor");
  const debtor = clerkRelationships.find((relationship) => relationship.kind === "debtor");
  const creditor = clerkRelationships.find((relationship) => relationship.kind === "creditor");
  assert.ok(subordinate);
  assert.ok(superior);
  assert.ok(apprentice);
  assert.ok(mentor);
  assert.ok(debtor);
  assert.ok(creditor);
  assert.equal(subordinate.sourceNpcId, clerk.value.npcId);
  assert.equal(superior.targetNpcId, clerk.value.npcId);
  assert.equal(apprentice.sourceNpcId, clerk.value.npcId);
  assert.equal(mentor.targetNpcId, clerk.value.npcId);
  assert.equal(debtor.sourceNpcId, clerk.value.npcId);
  assert.equal(creditor.targetNpcId, clerk.value.npcId);
  assert.ok(projection.npcRelationshipIdsByNpc[clerk.value.npcId].includes(subordinate.relationshipId));
  assert.ok(projection.npcRelationshipIdsByRegion.region_gray_harbor.includes(superior.relationshipId));
});

test("NPC lifecycle tick records server-sourced NPC memories", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npcmem"),
  });
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);

  const ticked = core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const memoryEvent = ticked.events.find((event) => event.eventType === "npc_memory_recorded");
  const projection = core.project() as any;
  const memories = Object.values(projection.npcMemories || {}) as any[];

  assert.ok(memoryEvent);
  assert.equal(memories.length, 1);
  assert.equal(memories[0].npcId, clerk.value.npcId);
  assert.equal(memories[0].regionId, "region_gray_harbor");
  assert.deepEqual(memories[0].sourceEventIds, [ticked.events.find((event) => event.eventType === "npc_lifecycle_recorded")?.eventId]);
  assert.equal(projection.npcMemoryIdsByNpc[clerk.value.npcId][0], memories[0].memoryId);
  assert.equal(projection.npcMemoryIdsByRegion.region_gray_harbor[0], memories[0].memoryId);
});

test("NPC lifecycle tick maintains canonical household records", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npchome"),
  });
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);

  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const marriageTick = core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const projection = core.project() as any;
  const households = Object.values(projection.households || {}) as any[];

  assert.ok(marriageTick.events.some((event: { eventType: string }) => event.eventType === "npc_household_recorded"));
  assert.equal(households.length, 1);
  assert.equal(households[0].regionId, "region_gray_harbor");
  assert.ok(households[0].memberNpcIds.includes(clerk.value.npcId));
  assert.equal(projection.householdIdsByNpc[clerk.value.npcId][0], households[0].householdId);
  assert.equal(projection.householdIdsByRegion.region_gray_harbor[0], households[0].householdId);
});

test("NPC social hooks drive server-issued hosted action options", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npchook"),
  });
  const identity = core.issueIdentity({ explorerId: "explorer_hook", identityName: "灰港社交员" }, userContext);
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);

  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 1 }, serverContext);
  const marriageTick = core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 1 }, serverContext);
  const projection = core.project();
  const hooks: EpochSocialHook[] = Object.values(projection.socialHooks);
  const hook = hooks.find((candidate) => candidate.npcId === clerk.value.npcId);

  assert.ok(marriageTick.events.some((event: { eventType: string }) => event.eventType === "social_hook_created"));
  assert.ok(hook);
  assert.equal(hook.regionId, "region_gray_harbor");
  assert.equal(projection.socialHookIdsByRegion.region_gray_harbor[0], hook.hookId);
  assert.equal(projection.socialHookIdsByNpc[clerk.value.npcId][0], hook.hookId);

  const hostedContext = {
    actorExplorerId: "hosted_runner",
    trustClass: "server_hosted_agent" as const,
    causationId: "cmd_hosted_hook",
    correlationId: "corr_hosted_hook",
  };
  const session = core.startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "处理灰港来信",
  }, hostedContext);
  const socialOption = session.value.actionOptions.find((option: { socialHookId?: string }) => option.socialHookId === hook.hookId);

  assert.ok(socialOption);
  assert.match(socialOption.optionKey, /^social_hook:/);
  assert.equal(socialOption.risk, hook.risk);

  const action = core.submitHostedAction({
    sessionId: session.value.sessionId,
    actionOptionId: socialOption.actionOptionId,
    visibleText: "我把来信改成胜利宣言。",
  }, hostedContext);

  assert.equal(action.value.actionOptionId, socialOption.actionOptionId);
  assert.equal(action.value.socialHookId, hook.hookId);
  assert.equal(action.value.outcomeSummary, socialOption.outcomeSummary);
  assert.ok(action.events.some((event) => event.eventType === "agent_npc_bond_updated"));
  assert.ok(action.events.some((event) => event.eventType === "npc_memory_recorded"));
  assert.ok(action.events.some((event) => event.eventType === "region_influence_changed"));
  const afterAction = core.project();
  const socialBond = Object.values(afterAction.agentNpcBonds).find((bond) =>
    bond.agentId === identity.value.agentId && bond.npcId === clerk.value.npcId && bond.kind === "friend");
  const socialMemory = Object.values(afterAction.npcMemories).find((memory) =>
    memory.npcId === clerk.value.npcId && memory.sourceEventIds.includes(action.events[0].eventId));
  const socialInfluence = Object.values(afterAction.regionInfluenceChanges).find((influence) =>
    influence.agentId === identity.value.agentId && influence.sourceAggregateId === session.value.sessionId);
  assert.ok(socialBond);
  assert.equal(socialBond.scoreDelta, 2);
  assert.equal(socialBond.focusSpent, 0);
  assert.ok(socialMemory);
  assert.match(socialMemory.summary, /Gray Harbor Clerk/);
  assert.ok(socialInfluence);
  assert.equal(socialInfluence.influenceDelta, 2);
  assert.equal(socialInfluence.sourceEventType, "hosted_action_recorded");

  const nextSession = core.startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: "继续处理灰港来信",
  }, hostedContext);
  assert.ok(!nextSession.value.actionOptions.some((option) => option.socialHookId === hook.hookId));
});

test("NPC lifecycle tick records canonical location migration", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npcloc"),
  });
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);

  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  const relocationTick = core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  const projection = core.project() as any;
  const locations = Object.values(projection.npcLocationRecords || {}) as any[];
  const clerkLocation = locations.find((location) => location.npcId === clerk.value.npcId);

  assert.ok(relocationTick.events.some((event: { eventType: string }) => event.eventType === "npc_location_changed"));
  assert.ok(clerkLocation);
  assert.equal(clerkLocation.fromRegionId, "region_gray_harbor");
  assert.notEqual(clerkLocation.toRegionId, "region_gray_harbor");
  assert.equal(projection.npcs[clerk.value.npcId].regionId, clerkLocation.toRegionId);
  assert.equal(projection.npcLocationIdsByNpc[clerk.value.npcId][0], clerkLocation.locationId);
  assert.ok(projection.npcLocationIdsByRegion.region_gray_harbor.includes(clerkLocation.locationId));
  assert.ok(projection.npcLocationIdsByRegion[clerkLocation.toRegionId].includes(clerkLocation.locationId));
});

test("NPC lifecycle tick records canonical health state", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npchealth"),
  });
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);

  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  const healthTick = core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  const projection = core.project() as any;
  const healthStates = Object.values(projection.npcHealthStates || {}) as any[];
  const clerkHealth = healthStates.find((health) => health.npcId === clerk.value.npcId);

  assert.ok(healthTick.events.some((event: { eventType: string }) => event.eventType === "npc_health_recorded"));
  assert.ok(clerkHealth);
  assert.equal(clerkHealth.regionId, "region_gray_harbor");
  assert.equal(clerkHealth.status, "sick");
  assert.equal(clerkHealth.severity, "minor");
  assert.equal(clerkHealth.sourceEventIds.length, 1);
  assert.equal(healthTick.value.healthStates[0].healthId, clerkHealth.healthId);
  assert.equal(projection.npcHealthIdsByNpc[clerk.value.npcId][0], clerkHealth.healthId);
  assert.equal(projection.npcHealthIdsByRegion.region_gray_harbor[0], clerkHealth.healthId);
});

test("NPC lifecycle tick records canonical asset state", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("npcasset"),
  });
  const clerk = core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);

  const firstTick = core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  const fourthTick = core.tickNpcLifecycle({ regionId: "region_gray_harbor", limit: 10 }, serverContext);
  const projection = core.project() as any;
  const assetStates = Object.values(projection.npcAssetStates || {}) as any[];
  const clerkAssets = assetStates.filter((asset) => asset.npcId === clerk.value.npcId);
  const firstAsset = clerkAssets.find((asset) => asset.delta === 10_000);
  const latestAsset = clerkAssets.find((asset) => asset.delta === -1_000);

  assert.ok(firstTick.events.some((event: { eventType: string }) => event.eventType === "npc_asset_changed"));
  assert.ok(fourthTick.events.some((event: { eventType: string }) => event.eventType === "npc_asset_changed"));
  assert.equal(clerkAssets.length, 2);
  assert.ok(firstAsset);
  assert.ok(latestAsset);
  assert.equal(firstAsset.assetKey, "wealth");
  assert.equal(firstAsset.delta, 10_000);
  assert.equal(firstAsset.balanceAfter, 10_000);
  assert.equal(latestAsset.delta, -1_000);
  assert.equal(latestAsset.balanceAfter, 9_000);
  assert.equal(projection.npcAssetBalancesByNpc[clerk.value.npcId].wealth, 9_000);
  assert.equal(
    fourthTick.value.assetStates.find((asset: any) => asset.npcId === clerk.value.npcId && asset.delta === -1_000)?.assetId,
    latestAsset.assetId,
  );
  assert.ok(projection.npcAssetIdsByNpc[clerk.value.npcId].includes(latestAsset.assetId));
  assert.ok(projection.npcAssetIdsByRegion.region_gray_harbor.includes(latestAsset.assetId));
});

test("seasonal faction campaigns spend real resources and settle a winning faction", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("season"),
  });
  const scoutContext = {
    ...userContext,
    actorExplorerId: "explorer_season_a",
  };
  const archivistContext = {
    ...userContext,
    actorExplorerId: "explorer_season_b",
  };
  const scout = core.issueIdentity({ explorerId: "explorer_season_a", identityName: "灰港斥候" }, scoutContext);
  const archivist = core.issueIdentity({ explorerId: "explorer_season_b", identityName: "腐林档案员" }, archivistContext);

  core.grantResource({ agentId: scout.value.agentId, resourceId: "coin", amount: 3, reason: "season_test" }, serverContext);
  core.grantResource({ agentId: archivist.value.agentId, resourceId: "coin", amount: 2, reason: "season_test" }, serverContext);

  assert.throws(() => (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_storm",
    title: "灰港潮汐季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 5,
    reward: { resourceId: "legend", amount: 2, reason: "season_winner" },
  }, userContext), /season_campaign_requires_server_trust/);

  const season = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_storm",
    title: "灰港潮汐季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 5,
    reward: { resourceId: "legend", amount: 2, reason: "season_winner" },
    objectives: [{
      objectiveKey: "raise_tide_beacon",
      title: "点亮信标",
      description: "任一阵营推进赛季总分达到 3 点后，服务器完成潮汐信标目标。",
      targetScore: 3,
    }],
  }, serverContext);

  assert.deepEqual(season.events.map((event: { eventType: string }) => event.eventType), [
    "season_campaign_created",
    "season_started",
    "season_objective_created",
  ]);
  assert.equal(season.value.status, "active");
  assert.equal(season.value.phaseEvents[0].eventType, "season_started");
  assert.equal(season.value.phaseEvents[0].phase, "active");
  assert.equal(season.value.phaseEvents[0].sourceEventId, season.events[0].eventId);
  assert.equal(season.value.objectives[0].status, "open");
  assert.equal(season.value.objectives[0].progressScore, 0);
  assert.equal(season.value.objectives[0].targetScore, 3);

  const firstContribution = (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: scout.value.agentId,
    factionId: "gray_watch",
    amount: 3,
  }, scoutContext);
  const secondContribution = (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: archivist.value.agentId,
    factionId: "cinder_archive",
    amount: 2,
  }, archivistContext);

  assert.deepEqual(firstContribution.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "season_contribution_recorded",
    "season_objective_completed",
  ]);
  assert.equal(firstContribution.value.objectives[0].status, "completed");
  assert.equal(firstContribution.value.objectives[0].progressScore, 3);
  assert.equal(firstContribution.value.objectives[0].completedByAgentId, scout.value.agentId);
  assert.equal(firstContribution.value.objectives[0].completedByFactionId, "gray_watch");
  assert.equal(firstContribution.value.objectives[0].sourceEventId, firstContribution.events[1].eventId);
  assert.ok(secondContribution.events.some((event: { eventType: string }) => event.eventType === "season_contribution_recorded"));
  assert.equal(core.project().resourceBalances[scout.value.agentId].coin, 0);

  const projectionBeforeSettle = core.project() as any;
  assert.equal(projectionBeforeSettle.seasonCampaignIdsByRegion.region_gray_harbor[0], season.value.seasonId);
  assert.equal(projectionBeforeSettle.seasonCampaignIdsByFaction.gray_watch[0], season.value.seasonId);
  assert.equal(projectionBeforeSettle.seasonCampaigns[season.value.seasonId].factionStandings[0].score, 3);
  assert.equal(projectionBeforeSettle.seasonObjectiveIdsBySeason[season.value.seasonId][0], season.value.objectives[0].objectiveId);
  assert.equal(projectionBeforeSettle.seasonObjectives[season.value.objectives[0].objectiveId].status, "completed");

  const settled = (core as any).settleSeasonCampaign({ seasonId: season.value.seasonId }, serverContext);
  assert.deepEqual(settled.events.map((event: { eventType: string }) => event.eventType), [
    "season_campaign_resolved",
    "resource_granted",
    "region_control_changed",
    "region_monument_built",
    "season_resolved",
  ]);
  assert.equal(settled.value.status, "resolved");
  assert.equal(settled.value.phaseEvents[1].eventType, "season_resolved");
  assert.equal(settled.value.phaseEvents[1].phase, "resolved");
  assert.equal(settled.value.phaseEvents[1].sourceEventId, settled.events[0].eventId);
  assert.ok(settled.value.phaseEvents[1].relatedEventIds.includes(settled.events[1].eventId));
  assert.equal(settled.value.winningFactionId, "gray_watch");
  assert.equal(settled.value.winnerAgentId, scout.value.agentId);
  assert.equal(core.project().resourceBalances[scout.value.agentId].legend, 2);
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controllingFactionId, "gray_watch");
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controlScore, 3);
  assert.equal((core.project() as any).regionControls.region_gray_harbor.contestedByFactionId, "cinder_archive");
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controlMargin, 1);
  assert.equal((core.project() as any).regionControls.region_gray_harbor.sourceSeasonId, season.value.seasonId);
  const monumentId = (core.project() as any).regionMonumentIdsByRegion.region_gray_harbor[0];
  const monument = (core.project() as any).regionMonuments[monumentId];
  assert.equal(monument.regionId, "region_gray_harbor");
  assert.equal(monument.sourceSeasonId, season.value.seasonId);
  assert.equal(monument.controllingFactionId, "gray_watch");
  assert.equal(monument.winnerAgentId, scout.value.agentId);
  assert.match(monument.title, /灰港潮汐季/);
  const seasonActivities = ((core.project() as any).regionActivityIdsByRegion.region_gray_harbor || [])
    .map((activityId: string) => (core.project() as any).regionActivities[activityId]);
  for (const sourceEventType of [
    "season_campaign_created",
    "season_started",
    "season_objective_created",
    "season_contribution_recorded",
    "season_objective_completed",
    "season_campaign_resolved",
    "season_resolved",
  ]) {
    assert.ok(seasonActivities.some((activity: { sourceEventType: string }) => activity.sourceEventType === sourceEventType));
  }
  assert.equal(
    seasonActivities.find((activity: { sourceEventType: string }) => activity.sourceEventType === "season_resolved")?.sourceEventId,
    settled.events.find((event: { eventType: string }) => event.eventType === "season_resolved")?.eventId,
  );
});

test("season contributions gain score-only bonus from matching region control", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("season_region_control_bonus"),
  });
  const grayContext = {
    ...userContext,
    actorExplorerId: "explorer_season_control_gray",
  };
  const cinderContext = {
    ...userContext,
    actorExplorerId: "explorer_season_control_cinder",
  };
  const gray = core.issueIdentity({ explorerId: "explorer_season_control_gray", identityName: "灰港控制方" }, grayContext);
  const cinder = core.issueIdentity({ explorerId: "explorer_season_control_cinder", identityName: "余烬挑战方" }, cinderContext);
  core.grantResource({ agentId: gray.value.agentId, resourceId: "coin", amount: 3, reason: "season_control_seed" }, serverContext);
  core.grantResource({ agentId: cinder.value.agentId, resourceId: "coin", amount: 1, reason: "season_control_seed" }, serverContext);

  const openingSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_control_opening",
    title: "灰港控制前季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 3,
    reward: { resourceId: "legend", amount: 1, reason: "season_control_opening" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: openingSeason.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 2,
  }, grayContext);
  (core as any).contributeSeasonCampaign({
    seasonId: openingSeason.value.seasonId,
    agentId: cinder.value.agentId,
    factionId: "cinder_archive",
    amount: 1,
  }, cinderContext);
  (core as any).settleSeasonCampaign({ seasonId: openingSeason.value.seasonId }, serverContext);
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controllingFactionId, "gray_watch");

  const followupSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_control_followup",
    title: "灰港控制反馈季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 2,
    reward: { resourceId: "legend", amount: 1, reason: "season_control_followup" },
  }, serverContext);
  const contribution = (core as any).contributeSeasonCampaign({
    seasonId: followupSeason.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 1,
  }, grayContext);
  const contributionEvent = contribution.events.find((event: { eventType: string }) => event.eventType === "season_contribution_recorded");
  assert.ok(contributionEvent);
  assert.equal(contributionEvent.payload.baseScoreDelta, 1);
  assert.equal(contributionEvent.payload.regionControlBonusScore, 1);
  assert.deepEqual(contributionEvent.payload.sourceRegionControlRegionIds, ["region_gray_harbor"]);
  assert.equal(contributionEvent.payload.scoreDelta, 2);
  assert.equal(contribution.value.totalScore, 2);
  assert.equal(contribution.value.factionStandings[0].factionId, "gray_watch");
  assert.equal(contribution.value.factionStandings[0].score, 2);
  assert.equal(contribution.value.contributions[0].regionControlBonusScore, 1);
  assert.deepEqual(contribution.value.contributions[0].sourceRegionControlRegionIds, ["region_gray_harbor"]);
  assert.equal(core.project().resourceBalances[gray.value.agentId].coin, 0);
});

test("season settlement records previous region controller on turnover", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("season_control_turnover"),
  });
  const grayContext = {
    ...userContext,
    actorExplorerId: "explorer_season_turnover_gray",
  };
  const cinderContext = {
    ...userContext,
    actorExplorerId: "explorer_season_turnover_cinder",
  };
  const gray = core.issueIdentity({ explorerId: "explorer_season_turnover_gray", identityName: "旧控制方" }, grayContext);
  const cinder = core.issueIdentity({ explorerId: "explorer_season_turnover_cinder", identityName: "新控制方" }, cinderContext);
  core.grantResource({ agentId: gray.value.agentId, resourceId: "coin", amount: 2, reason: "season_turnover_seed" }, serverContext);
  core.grantResource({ agentId: cinder.value.agentId, resourceId: "coin", amount: 4, reason: "season_turnover_seed" }, serverContext);

  const firstSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_turnover_opening",
    title: "灰港控制建立季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 3,
    reward: { resourceId: "legend", amount: 1, reason: "season_turnover_opening" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: firstSeason.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 2,
  }, grayContext);
  (core as any).contributeSeasonCampaign({
    seasonId: firstSeason.value.seasonId,
    agentId: cinder.value.agentId,
    factionId: "cinder_archive",
    amount: 1,
  }, cinderContext);
  const firstSettlement = (core as any).settleSeasonCampaign({ seasonId: firstSeason.value.seasonId }, serverContext);
  const firstControlEvent = firstSettlement.events.find((event: { eventType: string }) => event.eventType === "region_control_changed");
  assert.ok(firstControlEvent);
  assert.equal(firstControlEvent.payload.previousControllingFactionId, undefined);
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controllingFactionId, "gray_watch");

  const turnoverSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_turnover_challenge",
    title: "灰港控制翻转季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 3,
    reward: { resourceId: "legend", amount: 1, reason: "season_turnover_challenge" },
  }, serverContext);
  const turnoverContribution = (core as any).contributeSeasonCampaign({
    seasonId: turnoverSeason.value.seasonId,
    agentId: cinder.value.agentId,
    factionId: "cinder_archive",
    amount: 3,
  }, cinderContext);
  assert.equal(turnoverContribution.value.factionStandings[0].factionId, "cinder_archive");

  const turnoverSettlement = (core as any).settleSeasonCampaign({ seasonId: turnoverSeason.value.seasonId }, serverContext);
  const turnoverControlEvent = turnoverSettlement.events.find((event: { eventType: string }) => event.eventType === "region_control_changed");
  assert.ok(turnoverControlEvent);
  assert.equal(turnoverControlEvent.payload.controllingFactionId, "cinder_archive");
  assert.equal(turnoverControlEvent.payload.previousControllingFactionId, "gray_watch");
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controllingFactionId, "cinder_archive");
  assert.equal((core.project() as any).regionControls.region_gray_harbor.previousControllingFactionId, "gray_watch");
  assert.equal((core.project() as any).regionControls.region_gray_harbor.sourceSeasonId, turnoverSeason.value.seasonId);
});

test("region control maintenance decay lowers stale control without changing owner", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("region_control_decay"),
  });
  const grayContext = {
    ...userContext,
    actorExplorerId: "explorer_region_decay_gray",
  };
  const cinderContext = {
    ...userContext,
    actorExplorerId: "explorer_region_decay_cinder",
  };
  const gray = core.issueIdentity({ explorerId: "explorer_region_decay_gray", identityName: "衰减控制方" }, grayContext);
  const cinder = core.issueIdentity({ explorerId: "explorer_region_decay_cinder", identityName: "衰减挑战方" }, cinderContext);
  core.grantResource({ agentId: gray.value.agentId, resourceId: "coin", amount: 3, reason: "region_control_decay_seed" }, serverContext);
  core.grantResource({ agentId: cinder.value.agentId, resourceId: "coin", amount: 1, reason: "region_control_decay_seed" }, serverContext);

  const season = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_decay_seed",
    title: "灰港控制衰减基准季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 4,
    reward: { resourceId: "legend", amount: 1, reason: "region_control_decay" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 3,
  }, grayContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: cinder.value.agentId,
    factionId: "cinder_archive",
    amount: 1,
  }, cinderContext);
  (core as any).settleSeasonCampaign({ seasonId: season.value.seasonId }, serverContext);
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controlScore, 3);
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controlMargin, 2);
  assert.equal(typeof (core as any).decayRegionControls, "function");

  const freshDecay = (core as any).decayRegionControls({
    limit: 5,
    amount: 1,
    minAgeSeconds: 24 * 60 * 60,
  }, serverContext);
  assert.deepEqual(freshDecay.value, []);
  assert.deepEqual(freshDecay.events, []);

  time.set("2026-06-27T00:00:00.000Z");
  assert.throws(() => (core as any).decayRegionControls({
    limit: 5,
    amount: 1,
    minAgeSeconds: 24 * 60 * 60,
  }, userContext), /region_control_decay_requires_server_trust/);

  const decayed = (core as any).decayRegionControls({
    limit: 5,
    amount: 1,
    minAgeSeconds: 24 * 60 * 60,
  }, serverContext);
  assert.deepEqual(decayed.events.map((event: { eventType: string }) => event.eventType), ["region_control_decayed"]);
  assert.equal(decayed.value[0].regionId, "region_gray_harbor");
  assert.equal(decayed.value[0].controllingFactionId, "gray_watch");
  assert.equal(decayed.value[0].previousScore, 3);
  assert.equal(decayed.value[0].scoreAfter, 2);
  assert.equal(decayed.value[0].decayAmount, 1);
  assert.equal(decayed.value[0].previousControlMargin, 2);
  assert.equal(decayed.value[0].controlMarginAfter, 1);
  assert.equal(decayed.value[0].sourceSeasonId, season.value.seasonId);
  assert.equal(decayed.value[0].reason, "maintenance_decay");
  const decayedControl = (core.project() as any).regionControls.region_gray_harbor;
  assert.equal(decayedControl.controllingFactionId, "gray_watch");
  assert.equal(decayedControl.controlScore, 2);
  assert.equal(decayedControl.controlMargin, 1);
  assert.equal(decayedControl.updatedAt, "2026-06-27T00:00:00.000Z");
});

test("region control maintenance decay releases control at zero score", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("region_control_release"),
  });
  const grayContext = {
    ...userContext,
    actorExplorerId: "explorer_region_release_gray",
  };
  const gray = core.issueIdentity({ explorerId: "explorer_region_release_gray", identityName: "归零控制方" }, grayContext);
  core.grantResource({ agentId: gray.value.agentId, resourceId: "coin", amount: 3, reason: "region_control_release_seed" }, serverContext);

  const season = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_release_seed",
    title: "灰港控制释放基准季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 3,
    reward: { resourceId: "legend", amount: 1, reason: "region_control_release" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 3,
  }, grayContext);
  (core as any).settleSeasonCampaign({ seasonId: season.value.seasonId }, serverContext);
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controlScore, 3);

  time.set("2026-06-27T00:00:00.000Z");
  const released = (core as any).decayRegionControls({
    limit: 5,
    amount: 3,
    minAgeSeconds: 24 * 60 * 60,
  }, serverContext);

  assert.deepEqual(released.events.map((event: { eventType: string }) => event.eventType), [
    "region_control_decayed",
    "region_control_released",
  ]);
  assert.equal(released.value[0].scoreAfter, 0);
  const releaseEvent = released.events.find((event: { eventType: string }) => event.eventType === "region_control_released");
  assert.ok(releaseEvent);
  assert.equal(releaseEvent.payload.regionId, "region_gray_harbor");
  assert.equal(releaseEvent.payload.previousControllingFactionId, "gray_watch");
  assert.equal(releaseEvent.payload.previousScore, 3);
  assert.equal(releaseEvent.payload.sourceSeasonId, season.value.seasonId);
  assert.equal(releaseEvent.payload.reason, "maintenance_decay_zero");
  assert.equal((core.project() as any).regionControls.region_gray_harbor, undefined);
});

test("released region control can be claimed from canonical season standings", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("region_control_claim"),
  });
  const grayContext = {
    ...userContext,
    actorExplorerId: "explorer_region_claim_gray",
  };
  const cinderContext = {
    ...userContext,
    actorExplorerId: "explorer_region_claim_cinder",
  };
  const gray = core.issueIdentity({ explorerId: "explorer_region_claim_gray", identityName: "释放前控制方" }, grayContext);
  const cinder = core.issueIdentity({ explorerId: "explorer_region_claim_cinder", identityName: "释放后声明方" }, cinderContext);
  core.grantResource({ agentId: gray.value.agentId, resourceId: "coin", amount: 3, reason: "region_control_claim_seed" }, serverContext);
  core.grantResource({ agentId: cinder.value.agentId, resourceId: "coin", amount: 2, reason: "region_control_claim_seed" }, serverContext);

  const openingSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_claim_opening",
    title: "灰港释放前控制季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 3,
    reward: { resourceId: "legend", amount: 1, reason: "region_control_claim_opening" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: openingSeason.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 3,
  }, grayContext);
  (core as any).settleSeasonCampaign({ seasonId: openingSeason.value.seasonId }, serverContext);
  time.set("2026-06-27T00:00:00.000Z");
  const released = (core as any).decayRegionControls({
    limit: 5,
    amount: 3,
    minAgeSeconds: 24 * 60 * 60,
  }, serverContext);
  const releaseEvent = released.events.find((event: { eventType: string }) => event.eventType === "region_control_released");
  assert.ok(releaseEvent);
  assert.equal((core.project() as any).regionControls.region_gray_harbor, undefined);

  const claimSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_claim_followup",
    title: "灰港释放后声明季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 4,
    reward: { resourceId: "legend", amount: 1, reason: "region_control_claim_followup" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: claimSeason.value.seasonId,
    agentId: cinder.value.agentId,
    factionId: "cinder_archive",
    amount: 2,
  }, cinderContext);

  const claimed = (core as any).claimReleasedRegionControl({
    regionId: "region_gray_harbor",
    seasonId: claimSeason.value.seasonId,
    factionId: "cinder_archive",
    agentId: cinder.value.agentId,
  }, serverContext);
  assert.deepEqual(claimed.events.map((event: { eventType: string }) => event.eventType), ["region_control_changed"]);
  assert.equal(claimed.value.controllingFactionId, "cinder_archive");
  assert.equal(claimed.value.previousControllingFactionId, "gray_watch");
  assert.equal(claimed.value.controlScore, 2);
  assert.equal(claimed.value.sourceSeasonId, claimSeason.value.seasonId);
  assert.equal(claimed.value.sourceReleaseId, releaseEvent.payload.releaseId);
  assert.equal(claimed.events[0].payload.sourceReleaseId, releaseEvent.payload.releaseId);
  assert.equal(claimed.events[0].payload.claimingAgentId, cinder.value.agentId);
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controllingFactionId, "cinder_archive");
});

test("released region control can be won by an owner-authorized revolt battle", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("region_control_revolt"),
  });
  const grayContext = {
    ...userContext,
    actorExplorerId: "explorer_region_revolt_gray",
  };
  const cinderContext = {
    ...userContext,
    actorExplorerId: "explorer_region_revolt_cinder",
  };
  const gray = core.issueIdentity({ explorerId: "explorer_region_revolt_gray", identityName: "起义前控制方" }, grayContext);
  const cinder = core.issueIdentity({ explorerId: "explorer_region_revolt_cinder", identityName: "起义发起方" }, cinderContext);
  core.grantResource({ agentId: gray.value.agentId, resourceId: "coin", amount: 3, reason: "region_control_revolt_seed" }, serverContext);
  core.grantResource({ agentId: cinder.value.agentId, resourceId: "coin", amount: 2, reason: "region_control_revolt_seed" }, serverContext);
  core.grantResource({ agentId: cinder.value.agentId, resourceId: "stamina", amount: 3, reason: "region_control_revolt_seed" }, serverContext);

  const openingSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_revolt_opening",
    title: "灰港起义前控制季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 3,
    reward: { resourceId: "legend", amount: 1, reason: "region_control_revolt_opening" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: openingSeason.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 3,
  }, grayContext);
  (core as any).settleSeasonCampaign({ seasonId: openingSeason.value.seasonId }, serverContext);
  time.set("2026-06-27T00:00:00.000Z");
  const released = (core as any).decayRegionControls({
    limit: 5,
    amount: 3,
    minAgeSeconds: 24 * 60 * 60,
  }, serverContext);
  const releaseEvent = released.events.find((event: { eventType: string }) => event.eventType === "region_control_released");
  assert.ok(releaseEvent);

  const revoltSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_revolt_followup",
    title: "灰港起义赛季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 4,
    reward: { resourceId: "legend", amount: 1, reason: "region_control_revolt_followup" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: revoltSeason.value.seasonId,
    agentId: cinder.value.agentId,
    factionId: "cinder_archive",
    amount: 2,
  }, cinderContext);

  const revolt = (core as any).resolveRegionRevolt({
    regionId: "region_gray_harbor",
    seasonId: revoltSeason.value.seasonId,
    factionId: "cinder_archive",
    agentId: cinder.value.agentId,
    staminaSpent: 3,
  }, cinderContext);
  assert.deepEqual(revolt.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "region_revolt_resolved",
    "region_influence_changed",
    "trace_created",
    "region_control_changed",
  ]);
  assert.equal(revolt.value.outcome, "revolt_succeeded");
  assert.equal(revolt.value.rebelFactionId, "cinder_archive");
  assert.equal(revolt.value.previousControllingFactionId, "gray_watch");
  assert.equal(revolt.value.sourceReleaseId, releaseEvent.payload.releaseId);
  assert.equal(revolt.value.rebelPower, 8);
  assert.equal(revolt.value.defenderPower, 5);
  assert.equal(revolt.events[1].payload.sourceReleaseId, releaseEvent.payload.releaseId);
  assert.equal(revolt.events[4].payload.reason, "released_region_revolt");
  assert.equal((core.project() as any).regionControls.region_gray_harbor.controllingFactionId, "cinder_archive");
  assert.equal((core.project() as any).regionControls.region_gray_harbor.claimingAgentId, cinder.value.agentId);
});

test("runtime maintenance decays stale region control through operator run", () => {
  const coreTime = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: coreTime.clock,
    idFactory: createSequentialEpochIdFactory("runtime_region_control_decay_seed"),
  });
  const grayContext = {
    ...userContext,
    actorExplorerId: "explorer_runtime_region_decay_gray",
  };
  const cinderContext = {
    ...userContext,
    actorExplorerId: "explorer_runtime_region_decay_cinder",
  };
  const gray = core.issueIdentity({ explorerId: "explorer_runtime_region_decay_gray", identityName: "维护衰减控制方" }, grayContext);
  const cinder = core.issueIdentity({ explorerId: "explorer_runtime_region_decay_cinder", identityName: "维护衰减挑战方" }, cinderContext);
  core.grantResource({ agentId: gray.value.agentId, resourceId: "coin", amount: 3, reason: "runtime_region_control_decay_seed" }, serverContext);
  core.grantResource({ agentId: cinder.value.agentId, resourceId: "coin", amount: 1, reason: "runtime_region_control_decay_seed" }, serverContext);
  const season = (core as any).createSeasonCampaign({
    seasonKey: "runtime_gray_harbor_decay_seed",
    title: "维护控制衰减基准季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 4,
    reward: { resourceId: "legend", amount: 1, reason: "runtime_region_control_decay" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 3,
  }, grayContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: cinder.value.agentId,
    factionId: "cinder_archive",
    amount: 1,
  }, cinderContext);
  (core as any).settleSeasonCampaign({ seasonId: season.value.seasonId }, serverContext);

  const runtimeTime = mutableClock("2026-06-27T00:00:00.000Z");
  const runtime = createEpochRuntime({
    clock: runtimeTime.clock,
    idFactory: createSequentialEpochIdFactory("runtime_region_control_decay"),
    operatorKey: "operator-region-control-decay-key",
    initialEvents: core.events(),
  });
  const run = runtime.runMaintenance({
    operatorKey: "operator-region-control-decay-key",
    regionControlDecayLimit: 5,
    regionControlDecayAmount: 1,
    regionControlDecayMinAgeSeconds: 24 * 60 * 60,
    resourceNodeLimit: 0,
    resourceNodeSettlementLimit: 0,
    anomalyLimit: 0,
    seasonLimit: 0,
    seasonSettlementLimit: 0,
    serverHostedJobLimit: 0,
    abuseDecayLimit: 0,
    idempotencyKey: "runtime-region-control-decay-run-1",
  });

  assert.equal(run.value.regionControls.decayed, 1);
  assert.equal(run.value.regionControls.events, 1);
  assert.ok(run.events.some((event) => event.eventType === "region_control_decayed"));
  assert.equal((run.projection as any).regionControls.region_gray_harbor.controlScore, 2);
  assert.equal((run.projection as any).regionControls.region_gray_harbor.controlMargin, 1);
});

test("season control contribution bonus scales across matching controlled regions", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("season_region_control_scale"),
  });
  const grayContext = {
    ...userContext,
    actorExplorerId: "explorer_season_control_scale_gray",
  };
  const cinderContext = {
    ...userContext,
    actorExplorerId: "explorer_season_control_scale_cinder",
  };
  const gray = core.issueIdentity({ explorerId: "explorer_season_control_scale_gray", identityName: "双区控制方" }, grayContext);
  const cinder = core.issueIdentity({ explorerId: "explorer_season_control_scale_cinder", identityName: "双区挑战方" }, cinderContext);
  core.grantResource({ agentId: gray.value.agentId, resourceId: "coin", amount: 5, reason: "season_control_scale_seed" }, serverContext);
  core.grantResource({ agentId: cinder.value.agentId, resourceId: "coin", amount: 2, reason: "season_control_scale_seed" }, serverContext);

  for (const regionId of ["region_gray_harbor", "region_salt_gate"]) {
    const openingSeason = (core as any).createSeasonCampaign({
      seasonKey: `gray_control_scale_${regionId}`,
      title: `双区控制前季 ${regionId}`,
      regionIds: [regionId],
      factionIds: ["gray_watch", "cinder_archive"],
      resourceId: "coin",
      targetScore: 3,
      reward: { resourceId: "legend", amount: 1, reason: "season_control_scale_opening" },
    }, serverContext);
    (core as any).contributeSeasonCampaign({
      seasonId: openingSeason.value.seasonId,
      agentId: gray.value.agentId,
      factionId: "gray_watch",
      amount: 2,
    }, grayContext);
    (core as any).contributeSeasonCampaign({
      seasonId: openingSeason.value.seasonId,
      agentId: cinder.value.agentId,
      factionId: "cinder_archive",
      amount: 1,
    }, cinderContext);
    (core as any).settleSeasonCampaign({ seasonId: openingSeason.value.seasonId }, serverContext);
    assert.equal((core.project() as any).regionControls[regionId].controllingFactionId, "gray_watch");
  }

  const followupSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_control_scale_followup",
    title: "双区控制反馈季",
    regionIds: ["region_gray_harbor", "region_salt_gate"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 3,
    reward: { resourceId: "legend", amount: 1, reason: "season_control_scale_followup" },
  }, serverContext);
  const contribution = (core as any).contributeSeasonCampaign({
    seasonId: followupSeason.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 1,
  }, grayContext);
  const contributionEvent = contribution.events.find((event: { eventType: string }) => event.eventType === "season_contribution_recorded");
  assert.ok(contributionEvent);
  assert.equal(contributionEvent.payload.baseScoreDelta, 1);
  assert.equal(contributionEvent.payload.regionControlBonusScore, 2);
  assert.deepEqual(contributionEvent.payload.sourceRegionControlRegionIds, ["region_gray_harbor", "region_salt_gate"]);
  assert.equal(contributionEvent.payload.scoreDelta, 3);
  assert.equal(contribution.value.totalScore, 3);
  assert.equal(contribution.value.factionStandings[0].factionId, "gray_watch");
  assert.equal(contribution.value.factionStandings[0].score, 3);
  assert.equal(contribution.value.contributions[0].regionControlBonusScore, 2);
  assert.deepEqual(contribution.value.contributions[0].sourceRegionControlRegionIds, ["region_gray_harbor", "region_salt_gate"]);
  assert.equal(core.project().resourceBalances[gray.value.agentId].coin, 0);
});

test("season control contribution bonus is capped for high-region seasons", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("season_region_control_cap"),
  });
  const grayContext = {
    ...userContext,
    actorExplorerId: "explorer_season_control_cap_gray",
  };
  const cinderContext = {
    ...userContext,
    actorExplorerId: "explorer_season_control_cap_cinder",
  };
  const gray = core.issueIdentity({ explorerId: "explorer_season_control_cap_gray", identityName: "多区控制方" }, grayContext);
  const cinder = core.issueIdentity({ explorerId: "explorer_season_control_cap_cinder", identityName: "多区挑战方" }, cinderContext);
  core.grantResource({ agentId: gray.value.agentId, resourceId: "coin", amount: 9, reason: "season_control_cap_seed" }, serverContext);
  core.grantResource({ agentId: cinder.value.agentId, resourceId: "coin", amount: 4, reason: "season_control_cap_seed" }, serverContext);
  const controlledRegionIds = [
    "region_gray_harbor",
    "region_salt_gate",
    "region_cinder_archive",
    "region_white_tower",
  ];

  for (const regionId of controlledRegionIds) {
    const openingSeason = (core as any).createSeasonCampaign({
      seasonKey: `gray_control_cap_${regionId}`,
      title: `多区控制前季 ${regionId}`,
      regionIds: [regionId],
      factionIds: ["gray_watch", "cinder_archive"],
      resourceId: "coin",
      targetScore: 3,
      reward: { resourceId: "legend", amount: 1, reason: "season_control_cap_opening" },
    }, serverContext);
    (core as any).contributeSeasonCampaign({
      seasonId: openingSeason.value.seasonId,
      agentId: gray.value.agentId,
      factionId: "gray_watch",
      amount: 2,
    }, grayContext);
    (core as any).contributeSeasonCampaign({
      seasonId: openingSeason.value.seasonId,
      agentId: cinder.value.agentId,
      factionId: "cinder_archive",
      amount: 1,
    }, cinderContext);
    (core as any).settleSeasonCampaign({ seasonId: openingSeason.value.seasonId }, serverContext);
    assert.equal((core.project() as any).regionControls[regionId].controllingFactionId, "gray_watch");
  }

  const followupSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_control_cap_followup",
    title: "多区控制反馈季",
    regionIds: controlledRegionIds,
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 4,
    reward: { resourceId: "legend", amount: 1, reason: "season_control_cap_followup" },
  }, serverContext);
  const contribution = (core as any).contributeSeasonCampaign({
    seasonId: followupSeason.value.seasonId,
    agentId: gray.value.agentId,
    factionId: "gray_watch",
    amount: 1,
  }, grayContext);
  const contributionEvent = contribution.events.find((event: { eventType: string }) => event.eventType === "season_contribution_recorded");
  assert.ok(contributionEvent);
  assert.equal(contributionEvent.payload.baseScoreDelta, 1);
  assert.equal(contributionEvent.payload.regionControlBonusScore, 3);
  assert.deepEqual(contributionEvent.payload.sourceRegionControlRegionIds, [
    "region_cinder_archive",
    "region_gray_harbor",
    "region_salt_gate",
    "region_white_tower",
  ]);
  assert.equal(contributionEvent.payload.scoreDelta, 4);
  assert.equal(contribution.value.totalScore, 4);
  assert.equal(contribution.value.contributions[0].regionControlBonusScore, 3);
  assert.equal(core.project().resourceBalances[gray.value.agentId].coin, 0);
});

test("season settlement grants organization dividends and prestige once", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("season_org_reward"),
  });
  const winnerContext = {
    ...userContext,
    actorExplorerId: "explorer_season_org_winner",
  };
  const allyContext = {
    ...userContext,
    actorExplorerId: "explorer_season_org_ally",
  };
  const rivalContext = {
    ...userContext,
    actorExplorerId: "explorer_season_org_rival",
  };
  core.canonicalizeNpc({
    displayName: "Gray Harbor Clerk",
    regionId: "region_gray_harbor",
  }, userContext);
  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const organization = Object.values(core.project().organizations)[0];
  assert.ok(organization);
  const winner = core.issueIdentity({ explorerId: "explorer_season_org_winner", identityName: "灰港组织代表" }, winnerContext);
  const ally = core.issueIdentity({ explorerId: "explorer_season_org_ally", identityName: "灰港组织同伴" }, allyContext);
  const rival = core.issueIdentity({ explorerId: "explorer_season_org_rival", identityName: "腐林外部竞争者" }, rivalContext);
  core.updateOrganizationMembership({
    agentId: winner.value.agentId,
    organizationId: organization.organizationId,
    role: "vanguard",
    status: "active",
  }, serverContext);
  core.updateOrganizationMembership({
    agentId: ally.value.agentId,
    organizationId: organization.organizationId,
    role: "support",
    status: "active",
  }, allyContext);
  core.grantResource({ agentId: winner.value.agentId, resourceId: "coin", amount: 4, reason: "season_org_reward_seed" }, serverContext);
  core.grantResource({ agentId: rival.value.agentId, resourceId: "coin", amount: 2, reason: "season_org_reward_seed" }, serverContext);

  const season = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_org_season",
    title: "灰港组织季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 6,
    reward: { resourceId: "legend", amount: 4, reason: "season_org_winner" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: winner.value.agentId,
    factionId: "gray_watch",
    amount: 4,
  }, winnerContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: rival.value.agentId,
    factionId: "cinder_archive",
    amount: 2,
  }, rivalContext);

  const settled = (core as any).settleSeasonCampaign({ seasonId: season.value.seasonId }, serverContext);
  const eventTypes = settled.events.map((event: { eventType: string }) => event.eventType);
  assert.ok(eventTypes.includes("organization_treasury_changed"));
  assert.ok(eventTypes.includes("organization_prestige_changed"));
  assert.equal(eventTypes.filter((eventType: string) => eventType === "resource_granted").length, 3);
  const treasuryEvent = settled.events.find((event: { eventType: string }) => event.eventType === "organization_treasury_changed");
  assert.ok(treasuryEvent);
  assert.equal((treasuryEvent as any).payload.organizationId, organization.organizationId);
  assert.equal((treasuryEvent as any).payload.sourceSeasonId, season.value.seasonId);
  assert.equal((treasuryEvent as any).payload.resourceId, "legend");
  assert.equal((treasuryEvent as any).payload.amountDelta, 4);
  assert.equal((treasuryEvent as any).payload.balanceAfter, 4);
  const prestigeEvent = settled.events.find((event: { eventType: string }) => event.eventType === "organization_prestige_changed");
  assert.ok(prestigeEvent);
  assert.equal((prestigeEvent as any).payload.organizationId, organization.organizationId);
  assert.equal((prestigeEvent as any).payload.sourceSeasonId, season.value.seasonId);
  assert.equal((prestigeEvent as any).payload.standingDelta, 4);
  assert.equal((prestigeEvent as any).payload.standingAfter, 4);
  assert.equal(core.project().resourceBalances[winner.value.agentId].legend, 6);
  assert.equal(core.project().resourceBalances[ally.value.agentId].legend, 2);
  assert.equal(core.project().resourceBalances[rival.value.agentId]?.legend || 0, 0);
  assert.equal((core.project() as any).organizationTreasuryBalances[organization.organizationId].legend, 4);
  assert.equal((core.project() as any).organizationPoliticalStandingByOrganization[organization.organizationId], 4);
  const resolvedPhase = settled.value.phaseEvents.find((phase: { eventType: string }) => phase.eventType === "season_resolved");
  assert.ok(resolvedPhase.relatedEventIds.includes((treasuryEvent as any).eventId));
  assert.ok(resolvedPhase.relatedEventIds.includes((prestigeEvent as any).eventId));
  assert.throws(() => (core as any).settleSeasonCampaign({ seasonId: season.value.seasonId }, serverContext), /season_campaign_resolved/);
  assert.equal(core.project().resourceBalances[winner.value.agentId].legend, 6);
  assert.equal(core.project().resourceBalances[ally.value.agentId].legend, 2);
  assert.equal((core.project() as any).organizationTreasuryBalances[organization.organizationId].legend, 4);
});

test("organization upgrade purchase spends treasury through server catalog", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("organization_upgrade"),
  });
  const memberContext = {
    ...userContext,
    actorExplorerId: "explorer_org_upgrade_member",
  };
  const outsiderContext = {
    ...userContext,
    actorExplorerId: "explorer_org_upgrade_outsider",
  };
  core.canonicalizeNpc({
    displayName: "Gray Harbor Treasurer",
    regionId: "region_gray_harbor",
  }, userContext);
  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const organization = Object.values(core.project().organizations)[0];
  assert.ok(organization);
  const member = core.issueIdentity({ explorerId: "explorer_org_upgrade_member", identityName: "灰港升级代表" }, memberContext);
  const outsider = core.issueIdentity({ explorerId: "explorer_org_upgrade_outsider", identityName: "灰港局外人" }, outsiderContext);
  core.updateOrganizationMembership({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    role: "vanguard",
    status: "active",
  }, serverContext);
  core.grantResource({ agentId: member.value.agentId, resourceId: "coin", amount: 4, reason: "organization_upgrade_seed" }, serverContext);

  const season = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_upgrade_season",
    title: "灰港升级季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 4,
    reward: { resourceId: "legend", amount: 4, reason: "organization_upgrade_treasury_seed" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: season.value.seasonId,
    agentId: member.value.agentId,
    factionId: "gray_watch",
    amount: 4,
  }, memberContext);
  (core as any).settleSeasonCampaign({ seasonId: season.value.seasonId }, serverContext);
  assert.equal((core.project() as any).organizationTreasuryBalances[organization.organizationId].legend, 4);

  const purchased = (core as any).purchaseOrganizationUpgrade({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    upgradeKey: "training_hall",
  }, memberContext);
  const eventTypes = purchased.events.map((event: { eventType: string }) => event.eventType);
  assert.deepEqual(eventTypes, ["organization_treasury_changed", "organization_upgrade_purchased"]);
  const treasuryEvent = purchased.events.find((event: { eventType: string }) => event.eventType === "organization_treasury_changed");
  assert.ok(treasuryEvent);
  assert.equal((treasuryEvent as any).payload.organizationId, organization.organizationId);
  assert.equal((treasuryEvent as any).payload.resourceId, "legend");
  assert.equal((treasuryEvent as any).payload.amountDelta, -2);
  assert.equal((treasuryEvent as any).payload.balanceAfter, 2);
  assert.equal((treasuryEvent as any).payload.reason, "organization_upgrade:training_hall");
  const upgradeEvent = purchased.events.find((event: { eventType: string }) => event.eventType === "organization_upgrade_purchased");
  assert.ok(upgradeEvent);
  assert.equal((upgradeEvent as any).payload.organizationId, organization.organizationId);
  assert.equal((upgradeEvent as any).payload.upgradeKey, "training_hall");
  assert.equal((upgradeEvent as any).payload.title, "训练厅");
  assert.equal((upgradeEvent as any).payload.costResourceId, "legend");
  assert.equal((upgradeEvent as any).payload.costAmount, 2);
  assert.deepEqual((upgradeEvent as any).payload.sourceEventIds, [(treasuryEvent as any).eventId]);
  assert.equal(purchased.value.upgradeId, (upgradeEvent as any).payload.upgradeId);
  assert.equal((core.project() as any).organizationTreasuryBalances[organization.organizationId].legend, 2);
  assert.equal(
    (core.project() as any).organizationUpgrades[purchased.value.upgradeId].purchasedByAgentId,
    member.value.agentId,
  );
  assert.deepEqual((core.project() as any).organizationUpgradeIdsByOrganization[organization.organizationId], [purchased.value.upgradeId]);
  assert.throws(() => (core as any).purchaseOrganizationUpgrade({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    upgradeKey: "training_hall",
  }, memberContext), /organization_upgrade_already_purchased/);
  assert.throws(() => (core as any).purchaseOrganizationUpgrade({
    agentId: outsider.value.agentId,
    organizationId: organization.organizationId,
    upgradeKey: "training_hall",
  }, outsiderContext), /organization_upgrade_membership_required/);
  assert.throws(() => (core as any).purchaseOrganizationUpgrade({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    upgradeKey: "unknown_upgrade",
  }, memberContext), /organization_upgrade_not_found/);
  assert.equal((core.project() as any).organizationTreasuryBalances[organization.organizationId].legend, 2);
});

test("organization treasury contribution spends member resources and records server ledger", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("organization_treasury_contribution"),
  });
  const memberContext = {
    ...userContext,
    actorExplorerId: "explorer_org_treasury_member",
  };
  const outsiderContext = {
    ...userContext,
    actorExplorerId: "explorer_org_treasury_outsider",
  };
  core.canonicalizeNpc({
    displayName: "Gray Harbor Steward",
    regionId: "region_gray_harbor",
  }, userContext);
  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const organization = Object.values(core.project().organizations)[0];
  assert.ok(organization);
  const member = core.issueIdentity({ explorerId: "explorer_org_treasury_member", identityName: "灰港捐献代表" }, memberContext);
  const outsider = core.issueIdentity({ explorerId: "explorer_org_treasury_outsider", identityName: "灰港旁观者" }, outsiderContext);
  core.updateOrganizationMembership({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    role: "support",
    status: "active",
  }, memberContext);
  core.grantResource({ agentId: member.value.agentId, resourceId: "coin", amount: 5, reason: "organization_contribution_seed" }, serverContext);

  const contributed = core.contributeOrganizationTreasury({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    resourceId: "coin",
    amount: 3,
  }, memberContext);
  assert.deepEqual(contributed.events.map((event) => event.eventType), [
    "resource_spent",
    "organization_treasury_changed",
  ]);
  const spentEvent = contributed.events.find((event): event is ResourceSpentEvent => event.eventType === "resource_spent");
  assert.ok(spentEvent);
  assert.equal(spentEvent.payload.resourceId, "coin");
  assert.equal(spentEvent.payload.amount, 3);
  assert.equal(spentEvent.payload.balanceAfter, 2);
  assert.equal(spentEvent.payload.reason, `organization_treasury_contribution:${organization.organizationId}`);
  const treasuryEvent = contributed.events.find((event): event is OrganizationTreasuryChangedEvent =>
    event.eventType === "organization_treasury_changed");
  assert.ok(treasuryEvent);
  assert.equal(treasuryEvent.payload.organizationId, organization.organizationId);
  assert.equal(treasuryEvent.payload.resourceId, "coin");
  assert.equal(treasuryEvent.payload.amountDelta, 3);
  assert.equal(treasuryEvent.payload.balanceAfter, 3);
  assert.equal(treasuryEvent.payload.reason, `organization_contribution:${member.value.agentId}`);
  assert.deepEqual(treasuryEvent.payload.sourceEventIds, [spentEvent.eventId]);
  assert.equal(contributed.value.treasuryEventId, treasuryEvent.payload.treasuryEventId);
  assert.equal(core.project().resourceBalances[member.value.agentId].coin, 2);
  assert.equal(core.project().organizationTreasuryBalances[organization.organizationId].coin, 3);
  assert.throws(() => core.contributeOrganizationTreasury({
    agentId: outsider.value.agentId,
    organizationId: organization.organizationId,
    resourceId: "coin",
    amount: 1,
  }, outsiderContext), /organization_contribution_membership_required/);
  assert.throws(() => core.contributeOrganizationTreasury({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    resourceId: "coin",
    amount: 99,
  }, memberContext), /resource_insufficient/);
});

test("organization budget proposals require cross-member approval before spending treasury", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("organization_budget"),
  });
  const proposerContext = {
    ...userContext,
    actorExplorerId: "explorer_org_budget_proposer",
  };
  const approverContext = {
    ...userContext,
    actorExplorerId: "explorer_org_budget_approver",
  };
  const outsiderContext = {
    ...userContext,
    actorExplorerId: "explorer_org_budget_outsider",
  };
  core.canonicalizeNpc({
    displayName: "Gray Harbor Budget Clerk",
    regionId: "region_gray_harbor",
  }, serverContext);
  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const organization = Object.values(core.project().organizations)[0];
  assert.ok(organization);
  const proposer = core.issueIdentity({ explorerId: "explorer_org_budget_proposer", identityName: "灰港预算提案者" }, proposerContext);
  const approver = core.issueIdentity({ explorerId: "explorer_org_budget_approver", identityName: "灰港预算审批者" }, approverContext);
  const outsider = core.issueIdentity({ explorerId: "explorer_org_budget_outsider", identityName: "灰港预算局外人" }, outsiderContext);
  core.updateOrganizationMembership({
    agentId: proposer.value.agentId,
    organizationId: organization.organizationId,
    role: "support",
    status: "active",
  }, proposerContext);
  core.updateOrganizationMembership({
    agentId: approver.value.agentId,
    organizationId: organization.organizationId,
    role: "vanguard",
    status: "active",
  }, serverContext);
  core.grantResource({ agentId: proposer.value.agentId, resourceId: "coin", amount: 5, reason: "organization_budget_seed" }, serverContext);
  core.contributeOrganizationTreasury({
    agentId: proposer.value.agentId,
    organizationId: organization.organizationId,
    resourceId: "coin",
    amount: 5,
  }, proposerContext);

  const proposed = core.proposeOrganizationBudget({
    agentId: proposer.value.agentId,
    organizationId: organization.organizationId,
    title: "修补灰港灯塔",
    description: "给区域公共工程申请组织金库预算。",
    resourceId: "coin",
    amount: 3,
  }, proposerContext);
  assert.deepEqual(proposed.events.map((event) => event.eventType), ["organization_budget_proposed"]);
  const proposedEvent = proposed.events.find((event): event is OrganizationBudgetProposedEvent =>
    event.eventType === "organization_budget_proposed");
  assert.ok(proposedEvent);
  assert.equal(proposedEvent.payload.organizationId, organization.organizationId);
  assert.equal(proposedEvent.payload.resourceId, "coin");
  assert.equal(proposedEvent.payload.amount, 3);
  assert.equal(proposed.value.status, "proposed");
  assert.equal(core.project().organizationTreasuryBalances[organization.organizationId].coin, 5);
  assert.throws(() => core.resolveOrganizationBudget({
    agentId: proposer.value.agentId,
    budgetId: proposed.value.budgetId,
    resolution: "approved",
  }, proposerContext), /organization_budget_self_resolution_not_allowed/);
  assert.throws(() => core.resolveOrganizationBudget({
    agentId: outsider.value.agentId,
    budgetId: proposed.value.budgetId,
    resolution: "approved",
  }, outsiderContext), /organization_budget_resolver_membership_required/);

  const approved = core.resolveOrganizationBudget({
    agentId: approver.value.agentId,
    budgetId: proposed.value.budgetId,
    resolution: "approved",
    note: "批准公共工程预算。",
  }, approverContext);
  assert.deepEqual(approved.events.map((event) => event.eventType), [
    "organization_treasury_changed",
    "organization_budget_resolved",
  ]);
  const treasuryEvent = approved.events.find((event): event is OrganizationTreasuryChangedEvent =>
    event.eventType === "organization_treasury_changed");
  const resolvedEvent = approved.events.find((event): event is OrganizationBudgetResolvedEvent =>
    event.eventType === "organization_budget_resolved");
  assert.ok(treasuryEvent);
  assert.ok(resolvedEvent);
  assert.equal(treasuryEvent.payload.amountDelta, -3);
  assert.equal(treasuryEvent.payload.balanceAfter, 2);
  assert.equal(treasuryEvent.payload.reason, `organization_budget:${proposed.value.budgetId}`);
  assert.equal(resolvedEvent.payload.resolution, "approved");
  assert.deepEqual(resolvedEvent.payload.sourceEventIds, [treasuryEvent.eventId]);
  assert.equal(approved.value.status, "approved");
  assert.equal(core.project().organizationTreasuryBalances[organization.organizationId].coin, 2);
  assert.throws(() => core.resolveOrganizationBudget({
    agentId: approver.value.agentId,
    budgetId: proposed.value.budgetId,
    resolution: "approved",
  }, approverContext), /organization_budget_not_proposed/);

  const rejectedProposal = core.proposeOrganizationBudget({
    agentId: proposer.value.agentId,
    organizationId: organization.organizationId,
    title: "临时宴请",
    resourceId: "coin",
    amount: 1,
  }, proposerContext);
  const rejected = core.resolveOrganizationBudget({
    agentId: approver.value.agentId,
    budgetId: rejectedProposal.value.budgetId,
    resolution: "rejected",
    note: "暂缓非必要开支。",
  }, approverContext);
  assert.deepEqual(rejected.events.map((event) => event.eventType), ["organization_budget_resolved"]);
  assert.equal(rejected.value.status, "rejected");
  assert.equal(core.project().organizationTreasuryBalances[organization.organizationId].coin, 2);

  const staleBalanceProposal = core.proposeOrganizationBudget({
    agentId: proposer.value.agentId,
    organizationId: organization.organizationId,
    title: "延后修缮",
    resourceId: "coin",
    amount: 1,
  }, proposerContext);
  const drainingProposal = core.proposeOrganizationBudget({
    agentId: proposer.value.agentId,
    organizationId: organization.organizationId,
    title: "紧急补给",
    resourceId: "coin",
    amount: 2,
  }, proposerContext);
  core.resolveOrganizationBudget({
    agentId: approver.value.agentId,
    budgetId: drainingProposal.value.budgetId,
    resolution: "approved",
  }, approverContext);
  assert.equal(core.project().organizationTreasuryBalances[organization.organizationId].coin, 0);
  assert.throws(() => core.resolveOrganizationBudget({
    agentId: approver.value.agentId,
    budgetId: staleBalanceProposal.value.budgetId,
    resolution: "approved",
  }, approverContext), /organization_treasury_insufficient/);
  assert.equal(core.project().organizationBudgets[staleBalanceProposal.value.budgetId].status, "proposed");
});

test("organization budget approvals require governance roles and multisig for high value spends", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("organization_budget_multisig"),
  });
  const proposerContext = {
    ...userContext,
    actorExplorerId: "explorer_org_budget_multi_proposer",
  };
  const supportContext = {
    ...userContext,
    actorExplorerId: "explorer_org_budget_multi_support",
  };
  const firstApproverContext = {
    ...userContext,
    actorExplorerId: "explorer_org_budget_multi_first",
  };
  const secondApproverContext = {
    ...userContext,
    actorExplorerId: "explorer_org_budget_multi_second",
  };
  core.canonicalizeNpc({
    displayName: "Gray Harbor Multi Clerk",
    regionId: "region_gray_harbor",
  }, serverContext);
  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const organization = Object.values(core.project().organizations)[0];
  assert.ok(organization);
  const proposer = core.issueIdentity({ explorerId: "explorer_org_budget_multi_proposer", identityName: "大额预算提案者" }, proposerContext);
  const support = core.issueIdentity({ explorerId: "explorer_org_budget_multi_support", identityName: "普通支援成员" }, supportContext);
  const firstApprover = core.issueIdentity({ explorerId: "explorer_org_budget_multi_first", identityName: "灰港先锋审批者" }, firstApproverContext);
  const secondApprover = core.issueIdentity({ explorerId: "explorer_org_budget_multi_second", identityName: "灰港书记审批者" }, secondApproverContext);
  for (const [identity, context, role] of [
    [proposer, proposerContext, "support"],
    [support, supportContext, "support"],
    [firstApprover, firstApproverContext, "vanguard"],
    [secondApprover, secondApproverContext, "scribe"],
  ] as const) {
    const membershipContext = (["vanguard", "scribe", "clerk"] as readonly string[]).includes(role) ? serverContext : context;
    core.updateOrganizationMembership({
      agentId: identity.value.agentId,
      organizationId: organization.organizationId,
      role,
      status: "active",
    }, membershipContext);
  }
  core.grantResource({ agentId: proposer.value.agentId, resourceId: "coin", amount: 6, reason: "organization_budget_multisig_seed" }, serverContext);
  core.contributeOrganizationTreasury({
    agentId: proposer.value.agentId,
    organizationId: organization.organizationId,
    resourceId: "coin",
    amount: 6,
  }, proposerContext);

  const proposed = core.proposeOrganizationBudget({
    agentId: proposer.value.agentId,
    organizationId: organization.organizationId,
    title: "重建灰港防波堤",
    description: "大额公共工程必须经过多人治理审批。",
    resourceId: "coin",
    amount: 5,
  }, proposerContext);
  assert.equal(proposed.value.approvalThreshold, 2);
  assert.equal(proposed.value.approvalCount, 0);

  assert.throws(() => core.resolveOrganizationBudget({
    agentId: support.value.agentId,
    budgetId: proposed.value.budgetId,
    resolution: "approved",
  }, supportContext), /organization_budget_resolver_role_required/);

  const firstVote = core.resolveOrganizationBudget({
    agentId: firstApprover.value.agentId,
    budgetId: proposed.value.budgetId,
    resolution: "approved",
    note: "第一票同意。",
  }, firstApproverContext);
  assert.deepEqual(firstVote.events.map((event) => event.eventType), ["organization_budget_vote_recorded"]);
  const voteEvent = firstVote.events.find((event): event is OrganizationBudgetVoteRecordedEvent =>
    event.eventType === "organization_budget_vote_recorded");
  assert.ok(voteEvent);
  assert.equal(voteEvent.payload.approvalCount, 1);
  assert.equal(voteEvent.payload.approvalThreshold, 2);
  assert.equal(firstVote.value.status, "proposed");
  assert.equal(firstVote.value.approvalCount, 1);
  assert.equal(core.project().organizationTreasuryBalances[organization.organizationId].coin, 6);
  assert.throws(() => core.resolveOrganizationBudget({
    agentId: firstApprover.value.agentId,
    budgetId: proposed.value.budgetId,
    resolution: "approved",
  }, firstApproverContext), /organization_budget_vote_already_recorded/);

  const approved = core.resolveOrganizationBudget({
    agentId: secondApprover.value.agentId,
    budgetId: proposed.value.budgetId,
    resolution: "approved",
    note: "第二票同意。",
  }, secondApproverContext);
  assert.deepEqual(approved.events.map((event) => event.eventType), [
    "organization_budget_vote_recorded",
    "organization_treasury_changed",
    "organization_budget_resolved",
  ]);
  assert.equal(approved.value.status, "approved");
  assert.equal(approved.value.approvalCount, 2);
  assert.equal(approved.value.votes.length, 2);
  assert.equal(core.project().organizationTreasuryBalances[organization.organizationId].coin, 1);
});

test("training hall adds server-side season contribution score without minting resources", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("organization_upgrade_effect"),
  });
  const memberContext = {
    ...userContext,
    actorExplorerId: "explorer_training_hall_member",
  };
  const rivalContext = {
    ...userContext,
    actorExplorerId: "explorer_training_hall_rival",
  };
  core.canonicalizeNpc({
    displayName: "Gray Harbor Instructor",
    regionId: "region_gray_harbor",
  }, userContext);
  core.tickNpcLifecycle({
    regionId: "region_gray_harbor",
    limit: 1,
  }, serverContext);
  const organization = Object.values(core.project().organizations)[0];
  assert.ok(organization);
  const member = core.issueIdentity({ explorerId: "explorer_training_hall_member", identityName: "灰港训练成员" }, memberContext);
  const rival = core.issueIdentity({ explorerId: "explorer_training_hall_rival", identityName: "腐林训练对手" }, rivalContext);
  core.updateOrganizationMembership({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    role: "vanguard",
    status: "active",
  }, serverContext);
  core.grantResource({ agentId: member.value.agentId, resourceId: "coin", amount: 6, reason: "training_hall_seed" }, serverContext);
  core.grantResource({ agentId: rival.value.agentId, resourceId: "coin", amount: 2, reason: "training_hall_seed" }, serverContext);

  const treasurySeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_training_hall_treasury",
    title: "灰港训练厅筹备季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 4,
    reward: { resourceId: "legend", amount: 4, reason: "training_hall_treasury_seed" },
  }, serverContext);
  (core as any).contributeSeasonCampaign({
    seasonId: treasurySeason.value.seasonId,
    agentId: member.value.agentId,
    factionId: "gray_watch",
    amount: 4,
  }, memberContext);
  (core as any).settleSeasonCampaign({ seasonId: treasurySeason.value.seasonId }, serverContext);
  const purchased = (core as any).purchaseOrganizationUpgrade({
    agentId: member.value.agentId,
    organizationId: organization.organizationId,
    upgradeKey: "training_hall",
  }, memberContext);

  const bonusSeason = (core as any).createSeasonCampaign({
    seasonKey: "gray_harbor_training_hall_bonus",
    title: "灰港训练厅检验季",
    regionIds: ["region_gray_harbor"],
    factionIds: ["gray_watch", "cinder_archive"],
    resourceId: "coin",
    targetScore: 5,
    reward: { resourceId: "legend", amount: 1, reason: "training_hall_bonus" },
    objectives: [{
      objectiveKey: "prove_training_hall",
      title: "训练厅成效",
      description: "训练厅成员投入 2 coin 时由服务器额外计算组织与区域控制贡献。",
      targetScore: 3,
    }],
  }, serverContext);

  const memberContribution = (core as any).contributeSeasonCampaign({
    seasonId: bonusSeason.value.seasonId,
    agentId: member.value.agentId,
    factionId: "gray_watch",
    amount: 2,
  }, memberContext);
  const memberContributionEvent = memberContribution.events.find((event: { eventType: string }) =>
    event.eventType === "season_contribution_recorded");
  assert.ok(memberContributionEvent);
  assert.equal((memberContributionEvent as any).payload.amount, 2);
  assert.equal((memberContributionEvent as any).payload.baseScoreDelta, 2);
  assert.equal((memberContributionEvent as any).payload.organizationBonusScore, 1);
  assert.equal((memberContributionEvent as any).payload.regionControlBonusScore, 1);
  assert.equal((memberContributionEvent as any).payload.scoreDelta, 4);
  assert.deepEqual((memberContributionEvent as any).payload.sourceOrganizationUpgradeIds, [purchased.value.upgradeId]);
  assert.deepEqual((memberContributionEvent as any).payload.sourceRegionControlRegionIds, ["region_gray_harbor"]);
  assert.equal(memberContribution.value.objectives[0].status, "completed");
  assert.equal(memberContribution.value.objectives[0].progressScore, 3);
  assert.equal(core.project().resourceBalances[member.value.agentId].coin, 0);
  assert.equal((core.project() as any).seasonCampaigns[bonusSeason.value.seasonId].factionStandings[0].score, 4);

  const rivalContribution = (core as any).contributeSeasonCampaign({
    seasonId: bonusSeason.value.seasonId,
    agentId: rival.value.agentId,
    factionId: "cinder_archive",
    amount: 2,
  }, rivalContext);
  const rivalContributionEvent = rivalContribution.events.find((event: { eventType: string }) =>
    event.eventType === "season_contribution_recorded");
  assert.ok(rivalContributionEvent);
  assert.equal((rivalContributionEvent as any).payload.baseScoreDelta, 2);
  assert.equal((rivalContributionEvent as any).payload.organizationBonusScore, 0);
  assert.equal((rivalContributionEvent as any).payload.regionControlBonusScore, 0);
  assert.equal((rivalContributionEvent as any).payload.scoreDelta, 2);
  assert.deepEqual((rivalContributionEvent as any).payload.sourceOrganizationUpgradeIds, []);
  assert.deepEqual((rivalContributionEvent as any).payload.sourceRegionControlRegionIds, []);
  assert.equal(core.project().resourceBalances[rival.value.agentId].coin, 0);

  const projectedSeason = (core.project() as any).seasonCampaigns[bonusSeason.value.seasonId];
  assert.equal(projectedSeason.contributions.length, 2);
  assert.deepEqual(projectedSeason.contributions.map((contribution: { eventId: string }) => contribution.eventId), [
    (memberContributionEvent as any).eventId,
    (rivalContributionEvent as any).eventId,
  ]);
  assert.deepEqual(projectedSeason.contributions.map((contribution: { scoreDelta: number }) => contribution.scoreDelta), [4, 2]);
  assert.equal(projectedSeason.contributions[0].agentId, member.value.agentId);
  assert.equal(projectedSeason.contributions[0].explorerId, "explorer_training_hall_member");
  assert.equal(projectedSeason.contributions[0].trustClass, "untrusted_client");
  assert.equal(projectedSeason.contributions[0].recordedAt, (memberContributionEvent as any).payload.recordedAt);
  assert.deepEqual(projectedSeason.contributions[0].sourceOrganizationUpgradeIds, [purchased.value.upgradeId]);
  assert.equal(projectedSeason.contributions[0].regionControlBonusScore, 1);
  assert.deepEqual(projectedSeason.contributions[0].sourceRegionControlRegionIds, ["region_gray_harbor"]);
});

test("inventory items are server-created and owner-bound through canonical events", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("item"),
  });
  const inventoryCore = core as any;
  assert.equal(typeof inventoryCore.createInventoryItem, "function");
  assert.equal(typeof inventoryCore.bindInventoryItem, "function");

  const inventoryOwnerContext = {
    ...userContext,
    actorExplorerId: "explorer_item_owner",
  };
  const identity = core.issueIdentity({
    explorerId: "explorer_item_owner",
    identityName: "拾荒符印师",
  }, inventoryOwnerContext);
  const sourceReward = core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "item_source_reward",
  }, serverContext);
  const sourceEventId = sourceReward.events[0].eventId;

  assert.throws(() => inventoryCore.createInventoryItem({
    agentId: identity.value.agentId,
    itemKey: "salt-thread-charm",
    displayName: "盐线护符",
    rarity: "rare",
    sourceEventIds: [sourceEventId],
  }, userContext), /item_create_requires_server_trust/);

  assert.throws(() => inventoryCore.createInventoryItem({
    agentId: identity.value.agentId,
    itemKey: "missing-source-charm",
    displayName: "无源护符",
    sourceEventIds: ["event_missing"],
  }, serverContext), /source_event_not_found/);

  const created = inventoryCore.createInventoryItem({
    agentId: identity.value.agentId,
    itemKey: "salt-thread-charm",
    displayName: "盐线护符",
    rarity: "rare",
    sourceEventIds: [sourceEventId],
  }, serverContext);

  assert.deepEqual(created.events.map((event: { eventType: string }) => event.eventType), ["item_created"]);
  assert.equal(created.value.agentId, identity.value.agentId);
  assert.equal(created.value.explorerId, "explorer_item_owner");
  assert.equal(created.value.itemKey, "salt-thread-charm");
  assert.equal(created.value.displayName, "盐线护符");
  assert.equal(created.value.rarity, "rare");
  assert.equal(created.value.bound, false);
  assert.deepEqual(created.value.sourceEventIds, [sourceEventId]);
  assert.equal((core.project() as any).inventoryItemIdsByAgent[identity.value.agentId][0], created.value.itemId);
  assert.equal((core.project() as any).inventoryItemIdsByExplorer.explorer_item_owner[0], created.value.itemId);

  const duplicate = inventoryCore.createInventoryItem({
    agentId: identity.value.agentId,
    itemKey: "salt-thread-charm",
    displayName: "盐线护符",
    rarity: "rare",
    sourceEventIds: [sourceEventId],
  }, serverContext);
  assert.equal(duplicate.events.length, 0);
  assert.equal(duplicate.value.itemId, created.value.itemId);

  assert.throws(() => inventoryCore.bindInventoryItem({
    itemId: created.value.itemId,
    agentId: "agent_not_owner",
  }, userContext), /inventory_item_owner_mismatch/);

  assert.throws(() => inventoryCore.bindInventoryItem({
    itemId: created.value.itemId,
    agentId: identity.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_bind_intruder",
  }), /inventory_bind_owner_mismatch/);

  const bound = inventoryCore.bindInventoryItem({
    itemId: created.value.itemId,
    agentId: identity.value.agentId,
    reason: "equip_to_identity",
  }, inventoryOwnerContext);

  assert.deepEqual(bound.events.map((event: { eventType: string }) => event.eventType), ["item_bound"]);
  assert.equal(bound.value.bound, true);
  assert.equal(bound.value.boundReason, "equip_to_identity");
  assert.equal(bound.value.boundAt, "2026-06-25T00:00:00.000Z");
  assert.equal((core.project() as any).inventoryItems[created.value.itemId].bound, true);

  const rebound = inventoryCore.bindInventoryItem({
    itemId: created.value.itemId,
    agentId: identity.value.agentId,
  }, inventoryOwnerContext);
  assert.equal(rebound.events.length, 0);
  assert.equal(rebound.value.bound, true);
});

test("unbound inventory items transfer through server-settled market orders", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("item_market"),
  });
  const marketCore = core as any;

  const seller = core.issueIdentity({
    explorerId: "explorer_item_seller",
    identityName: "灰市摊主",
  }, {
    ...userContext,
    actorExplorerId: "explorer_item_seller",
  });
  const buyer = core.issueIdentity({
    explorerId: "explorer_item_buyer",
    identityName: "灰市买家",
  }, {
    ...userContext,
    actorExplorerId: "explorer_item_buyer",
  });
  const sourceReward = core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "item_market_source",
  }, serverContext);
  core.grantResource({
    agentId: buyer.value.agentId,
    resourceId: "coin",
    amount: 10,
    reason: "item_market_buyer_seed",
  }, serverContext);
  const created = marketCore.createInventoryItem({
    agentId: seller.value.agentId,
    itemKey: "gray-market-token",
    displayName: "灰市旧符",
    rarity: "common",
    sourceEventIds: [sourceReward.events[0].eventId],
  }, serverContext);

  const order = marketCore.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    sellItemId: created.value.itemId,
    priceResourceId: "coin",
    priceAmount: 6,
  }, {
    ...userContext,
    actorExplorerId: "explorer_item_seller",
  });
  assert.deepEqual(order.events.map((event: { eventType: string }) => event.eventType), ["market_order_created"]);
  assert.equal(order.value.sellKind, "item");
  assert.equal(order.value.sellItemId, created.value.itemId);
  assert.equal(order.value.sellItemDisplayName, "灰市旧符");
  assert.equal((core.project() as any).inventoryItems[created.value.itemId].marketLockedByOrderId, order.value.orderId);

  assert.throws(() => marketCore.bindInventoryItem({
    itemId: created.value.itemId,
    agentId: seller.value.agentId,
    reason: "equip_after_listing",
  }, {
    ...userContext,
    actorExplorerId: "explorer_item_seller",
  }), /inventory_item_market_locked/);

  const filled = marketCore.fillMarketOrder({
    orderId: order.value.orderId,
    buyerAgentId: buyer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_item_buyer",
  });
  assert.deepEqual(filled.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "resource_granted",
    "item_transferred",
    "market_order_filled",
  ]);
  const transferred = (core.project() as any).inventoryItems[created.value.itemId];
  assert.equal(transferred.agentId, buyer.value.agentId);
  assert.equal(transferred.explorerId, "explorer_item_buyer");
  assert.equal(transferred.marketLockedByOrderId, undefined);
  assert.deepEqual((core.project() as any).inventoryItemIdsByAgent[seller.value.agentId] || [], []);
  assert.deepEqual((core.project() as any).inventoryItemIdsByAgent[buyer.value.agentId], [created.value.itemId]);
  assert.equal(core.project().resourceBalances[buyer.value.agentId].coin, 4);
  assert.equal(core.project().resourceBalances[seller.value.agentId].coin, 6);
  assert.equal(filled.value.status, "filled");
  assert.equal(filled.value.buyerAgentId, buyer.value.agentId);
});

test("market-listed inventory items cannot be offered in a direct trade", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("item_market_direct_lock"),
  });
  const tradeCore = core as any;
  const sellerContext = {
    ...userContext,
    actorExplorerId: "explorer_item_double_sell_seller",
  };
  const seller = core.issueIdentity({
    explorerId: "explorer_item_double_sell_seller",
    identityName: "双卖测试摊主",
  }, sellerContext);
  const counterparty = core.issueIdentity({
    explorerId: "explorer_item_double_sell_buyer",
    identityName: "双卖测试买家",
  }, {
    ...userContext,
    actorExplorerId: "explorer_item_double_sell_buyer",
  });
  core.grantResource({
    agentId: counterparty.value.agentId,
    resourceId: "coin",
    amount: 10,
    reason: "item_market_direct_counterparty_seed",
  }, serverContext);
  const sourceReward = core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "item_market_direct_source",
  }, serverContext);
  const item = tradeCore.createInventoryItem({
    agentId: seller.value.agentId,
    itemKey: "double-sell-token",
    displayName: "双卖测试旧符",
    rarity: "common",
    sourceEventIds: [sourceReward.events[0].eventId],
  }, serverContext);

  const marketOrder = core.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    sellItemId: item.value.itemId,
    priceResourceId: "coin",
    priceAmount: 6,
  }, sellerContext);
  assert.equal(core.project().inventoryItems[item.value.itemId].marketLockedByOrderId, marketOrder.value.orderId);

  assert.throws(() => tradeCore.createDirectTrade({
    proposerAgentId: seller.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    offerItemId: item.value.itemId,
    requestResourceId: "coin",
    requestAmount: 5,
  }, sellerContext), /inventory_item_market_locked/);
  assert.equal(core.project().inventoryItems[item.value.itemId].marketLockedByOrderId, marketOrder.value.orderId);
  assert.equal(Object.values(core.project().directTrades).length, 0);
});

test("bound inventory items cannot be listed on the market", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("bound_item_market"),
  });
  const marketCore = core as any;
  const seller = core.issueIdentity({
    explorerId: "explorer_bound_seller",
    identityName: "绑定物持有人",
  }, {
    ...userContext,
    actorExplorerId: "explorer_bound_seller",
  });
  const sourceReward = core.grantResource({
    agentId: seller.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "bound_item_market_source",
  }, serverContext);
  const created = marketCore.createInventoryItem({
    agentId: seller.value.agentId,
    itemKey: "bound-market-token",
    displayName: "已认主旧符",
    rarity: "rare",
    sourceEventIds: [sourceReward.events[0].eventId],
  }, serverContext);
  marketCore.bindInventoryItem({
    itemId: created.value.itemId,
    agentId: seller.value.agentId,
    reason: "soulbound",
  }, {
    ...userContext,
    actorExplorerId: "explorer_bound_seller",
  });

  assert.throws(() => marketCore.createMarketOrder({
    sellerAgentId: seller.value.agentId,
    sellItemId: created.value.itemId,
    priceResourceId: "coin",
    priceAmount: 6,
  }, {
    ...userContext,
    actorExplorerId: "explorer_bound_seller",
  }), /inventory_item_bound_not_tradable/);
});

test("direct trades escrow proposer resources and settle requested payment", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("direct_trade"),
  });
  const tradeCore = core as any;
  assert.equal(typeof tradeCore.createDirectTrade, "function");

  const proposer = core.issueIdentity({
    explorerId: "explorer_direct_seller",
    identityName: "灰港直售者",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_seller",
  });
  const counterparty = core.issueIdentity({
    explorerId: "explorer_direct_buyer",
    identityName: "盐门直购者",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_buyer",
  });
  core.grantResource({
    agentId: proposer.value.agentId,
    resourceId: "aether",
    amount: 4,
    reason: "direct_trade_seed",
  }, serverContext);
  core.grantResource({
    agentId: counterparty.value.agentId,
    resourceId: "coin",
    amount: 20,
    reason: "direct_trade_seed",
  }, serverContext);

  const created = tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    regionId: "region_gray_harbor",
    offerResourceId: "aether",
    offerAmount: 2,
    requestResourceId: "coin",
    requestAmount: 7,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_seller",
  });

  assert.deepEqual(created.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "direct_trade_created",
  ]);
  assert.equal(created.value.status, "open");
  assert.equal(created.value.regionId, "region_gray_harbor");
  assert.equal(created.value.offeredAsset.resourceId, "aether");
  assert.equal(created.value.requestedAsset.resourceId, "coin");
  assert.equal(core.project().resourceBalances[proposer.value.agentId].aether, 2);

  const accepted = tradeCore.acceptDirectTrade({
    tradeId: created.value.tradeId,
    counterpartyAgentId: counterparty.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_buyer",
  });

  assert.deepEqual(accepted.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "resource_granted",
    "resource_granted",
    "direct_trade_accepted",
  ]);
  assert.equal(accepted.value.status, "accepted");
  assert.equal(accepted.value.counterpartyAgentId, counterparty.value.agentId);
  assert.equal(core.project().resourceBalances[counterparty.value.agentId].coin, 13);
  assert.equal(core.project().resourceBalances[counterparty.value.agentId].aether, 2);
  assert.equal(core.project().resourceBalances[proposer.value.agentId].coin, 7);
  assert.throws(() => tradeCore.acceptDirectTrade({
    tradeId: created.value.tradeId,
    counterpartyAgentId: counterparty.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_buyer",
  }), /direct_trade_not_open/);
});

test("repeat direct trades auto-escalate into market risk restrictions", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("direct_trade_auto_risk"),
  });
  const tradeCore = core as any;
  const proposer = core.issueIdentity({
    explorerId: "explorer_direct_auto_risk_seller",
    identityName: "重复直交易发起者",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_auto_risk_seller",
  });
  const counterparty = core.issueIdentity({
    explorerId: "explorer_direct_auto_risk_buyer",
    identityName: "重复直交易接受者",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_auto_risk_buyer",
  });
  core.grantResource({
    agentId: proposer.value.agentId,
    resourceId: "aether",
    amount: 6,
    reason: "direct_trade_auto_risk_seed",
  }, serverContext);
  core.grantResource({
    agentId: counterparty.value.agentId,
    resourceId: "coin",
    amount: 20,
    reason: "direct_trade_auto_risk_seed",
  }, serverContext);

  const first = tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    regionId: "region_gray_harbor",
    offerResourceId: "aether",
    offerAmount: 1,
    requestResourceId: "coin",
    requestAmount: 3,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_auto_risk_seller",
  });
  const firstAccepted = tradeCore.acceptDirectTrade({
    tradeId: first.value.tradeId,
    counterpartyAgentId: counterparty.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_auto_risk_buyer",
  });
  assert.deepEqual(firstAccepted.value.tradeRiskFlags, []);
  assert.equal(core.project().marketRiskRestrictions[counterparty.value.agentId], undefined);

  time.set("2026-06-25T00:30:00.000Z");
  const second = tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    regionId: "region_gray_harbor",
    offerResourceId: "aether",
    offerAmount: 1,
    requestResourceId: "coin",
    requestAmount: 3,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_auto_risk_seller",
  });
  const secondAccepted = tradeCore.acceptDirectTrade({
    tradeId: second.value.tradeId,
    counterpartyAgentId: counterparty.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_auto_risk_buyer",
  });
  assert.deepEqual(secondAccepted.value.tradeRiskFlags, ["repeat_counterparty_trade"]);
  assert.deepEqual(secondAccepted.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "resource_granted",
    "resource_granted",
    "direct_trade_accepted",
    "risk_review_recorded",
  ]);
  const acceptedEvent = secondAccepted.events.find((event: { eventType: string }) => event.eventType === "direct_trade_accepted");
  const reviewEvent = secondAccepted.events.find((event: { eventType: string }) => event.eventType === "risk_review_recorded");
  assert.equal(reviewEvent?.payload.sourceEventId, acceptedEvent?.eventId);
  assert.equal(reviewEvent?.payload.resolution, "escalated");
  assert.deepEqual(reviewEvent?.payload.reviewFlags, ["repeat_counterparty_trade"]);
  assert.equal(core.project().riskReviewIdsBySourceEvent[acceptedEvent?.eventId || ""]?.length, 1);
  assert.equal(core.project().marketRiskRestrictions[counterparty.value.agentId].sourceEventId, acceptedEvent?.eventId);
  assert.throws(() => tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    regionId: "region_gray_harbor",
    offerResourceId: "aether",
    offerAmount: 1,
    requestResourceId: "coin",
    requestAmount: 1,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_auto_risk_seller",
  }), /market_agent_restricted/);
});

test("direct trades reject same-explorer counterparties and refund resource escrow on cancel", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("direct_trade_cancel"),
  });
  const tradeCore = core as any;
  const ownerContext = {
    ...userContext,
    actorExplorerId: "explorer_direct_same_owner",
  };
  const proposer = core.issueIdentity({
    explorerId: "explorer_direct_same_owner",
    identityName: "同主体直售者",
  }, ownerContext);
  core.grantResource({
    agentId: proposer.value.agentId,
    resourceId: "legend",
    amount: 3,
    reason: "direct_trade_same_explorer_slot_unlock",
  }, serverContext);
  const sameExplorerCounterparty = core.issueIdentity({
    explorerId: "explorer_direct_same_owner",
    identityName: "同主体直购者",
  }, ownerContext);
  const externalCounterparty = core.issueIdentity({
    explorerId: "explorer_direct_external",
    identityName: "外部直购者",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_external",
  });
  core.grantResource({
    agentId: proposer.value.agentId,
    resourceId: "aether",
    amount: 3,
    reason: "direct_trade_cancel_seed",
  }, serverContext);
  core.grantResource({
    agentId: externalCounterparty.value.agentId,
    resourceId: "coin",
    amount: 10,
    reason: "direct_trade_cancel_seed",
  }, serverContext);

  assert.throws(() => tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: sameExplorerCounterparty.value.agentId,
    offerResourceId: "aether",
    offerAmount: 1,
    requestResourceId: "coin",
    requestAmount: 3,
  }, ownerContext), /direct_trade_same_explorer_not_allowed/);
  assert.equal(core.project().resourceBalances[proposer.value.agentId].aether, 3);

  const created = tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: externalCounterparty.value.agentId,
    offerResourceId: "aether",
    offerAmount: 2,
    requestResourceId: "coin",
    requestAmount: 5,
  }, ownerContext);
  assert.equal(core.project().resourceBalances[proposer.value.agentId].aether, 1);

  const cancelled = tradeCore.cancelDirectTrade({
    tradeId: created.value.tradeId,
    proposerAgentId: proposer.value.agentId,
  }, ownerContext);
  assert.deepEqual(cancelled.events.map((event: { eventType: string }) => event.eventType), [
    "resource_granted",
    "direct_trade_cancelled",
  ]);
  assert.equal(cancelled.value.status, "cancelled");
  assert.equal(core.project().resourceBalances[proposer.value.agentId].aether, 3);
  assert.throws(() => tradeCore.acceptDirectTrade({
    tradeId: created.value.tradeId,
    counterpartyAgentId: externalCounterparty.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_external",
  }), /direct_trade_not_open/);
});

test("direct trades lock unbound offered items and transfer them on accept", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("direct_trade_item"),
  });
  const tradeCore = core as any;
  const proposer = core.issueIdentity({
    explorerId: "explorer_direct_item_seller",
    identityName: "直交易持物人",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_seller",
  });
  const counterparty = core.issueIdentity({
    explorerId: "explorer_direct_item_buyer",
    identityName: "直交易收物人",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_buyer",
  });
  const sourceReward = core.grantResource({
    agentId: proposer.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "direct_trade_item_source",
  }, serverContext);
  core.grantResource({
    agentId: counterparty.value.agentId,
    resourceId: "coin",
    amount: 12,
    reason: "direct_trade_item_seed",
  }, serverContext);
  const createdItem = tradeCore.createInventoryItem({
    agentId: proposer.value.agentId,
    itemKey: "direct-trade-token",
    displayName: "直交易旧符",
    rarity: "common",
    sourceEventIds: [sourceReward.events[0].eventId],
  }, serverContext);

  const created = tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    offerItemId: createdItem.value.itemId,
    requestResourceId: "coin",
    requestAmount: 8,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_seller",
  });

  assert.deepEqual(created.events.map((event: { eventType: string }) => event.eventType), ["direct_trade_created"]);
  assert.equal(created.value.offeredAsset.kind, "item");
  assert.equal(created.value.offeredAsset.itemDisplayName, "直交易旧符");
  assert.equal(core.project().inventoryItems[createdItem.value.itemId].marketLockedByOrderId, created.value.tradeId);
  assert.throws(() => tradeCore.bindInventoryItem({
    itemId: createdItem.value.itemId,
    agentId: proposer.value.agentId,
    reason: "equip_after_direct_trade",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_seller",
  }), /inventory_item_market_locked/);
  assert.throws(() => tradeCore.createMarketOrder({
    sellerAgentId: proposer.value.agentId,
    sellItemId: createdItem.value.itemId,
    priceResourceId: "coin",
    priceAmount: 9,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_seller",
  }), /inventory_item_market_locked/);

  const accepted = tradeCore.acceptDirectTrade({
    tradeId: created.value.tradeId,
    counterpartyAgentId: counterparty.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_buyer",
  });
  assert.deepEqual(accepted.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "resource_granted",
    "item_transferred",
    "direct_trade_accepted",
  ]);
  const transferred = core.project().inventoryItems[createdItem.value.itemId];
  assert.equal(transferred.agentId, counterparty.value.agentId);
  assert.equal(transferred.explorerId, "explorer_direct_item_buyer");
  assert.equal(transferred.marketLockedByOrderId, undefined);
  assert.equal(core.project().resourceBalances[counterparty.value.agentId].coin, 4);
  assert.equal(core.project().resourceBalances[proposer.value.agentId].coin, 8);

  const boundItem = tradeCore.createInventoryItem({
    agentId: proposer.value.agentId,
    itemKey: "direct-trade-bound-token",
    displayName: "直交易绑定物",
    rarity: "rare",
    sourceEventIds: [sourceReward.events[0].eventId],
  }, serverContext);
  tradeCore.bindInventoryItem({
    itemId: boundItem.value.itemId,
    agentId: proposer.value.agentId,
    reason: "soulbound",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_seller",
  });
  assert.throws(() => tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    offerItemId: boundItem.value.itemId,
    requestResourceId: "coin",
    requestAmount: 1,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_seller",
  }), /inventory_item_bound_not_tradable/);
});

test("direct trade expiry tick refunds stale resource escrow and skips active settlements", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("direct_trade_expiry"),
  });
  const tradeCore = core as any;
  assert.equal(typeof tradeCore.tickDirectTradeExpiry, "function");
  const proposer = core.issueIdentity({
    explorerId: "explorer_direct_expiry_proposer",
    identityName: "过期直交易发起者",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_expiry_proposer",
  });
  const counterparty = core.issueIdentity({
    explorerId: "explorer_direct_expiry_counterparty",
    identityName: "过期直交易接受者",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_expiry_counterparty",
  });
  core.grantResource({
    agentId: proposer.value.agentId,
    resourceId: "aether",
    amount: 5,
    reason: "direct_trade_expiry_seed",
  }, serverContext);
  core.grantResource({
    agentId: counterparty.value.agentId,
    resourceId: "coin",
    amount: 20,
    reason: "direct_trade_expiry_seed",
  }, serverContext);

  const stale = tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    offerResourceId: "aether",
    offerAmount: 2,
    requestResourceId: "coin",
    requestAmount: 6,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_expiry_proposer",
  });
  time.set("2026-06-25T00:00:30.000Z");
  const fresh = tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    offerResourceId: "aether",
    offerAmount: 1,
    requestResourceId: "coin",
    requestAmount: 3,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_expiry_proposer",
  });
  assert.equal(core.project().resourceBalances[proposer.value.agentId].aether, 2);
  assert.throws(() => tradeCore.tickDirectTradeExpiry({
    maxAgeSeconds: 10,
  }, userContext), /direct_trade_expiry_tick_requires_server_trust/);

  time.set("2026-06-25T00:01:00.000Z");
  const expired = tradeCore.tickDirectTradeExpiry({
    maxAgeSeconds: 45,
    limit: 10,
  }, serverContext);
  assert.deepEqual(expired.events.map((event: { eventType: string }) => event.eventType), [
    "resource_granted",
    "direct_trade_expired",
  ]);
  assert.equal(expired.value.updated.length, 1);
  assert.equal(expired.value.updated[0].tradeId, stale.value.tradeId);
  assert.equal(expired.value.updated[0].status, "expired");
  assert.equal(core.project().directTrades[fresh.value.tradeId].status, "open");
  assert.equal(core.project().resourceBalances[proposer.value.agentId].aether, 4);
  assert.throws(() => tradeCore.acceptDirectTrade({
    tradeId: stale.value.tradeId,
    counterpartyAgentId: counterparty.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_expiry_counterparty",
  }), /direct_trade_not_open/);
  assert.throws(() => tradeCore.cancelDirectTrade({
    tradeId: stale.value.tradeId,
    proposerAgentId: proposer.value.agentId,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_expiry_proposer",
  }), /direct_trade_not_open/);
});

test("direct trade expiry tick unlocks stale offered items without transferring ownership", () => {
  const time = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock: time.clock,
    idFactory: createSequentialEpochIdFactory("direct_trade_item_expiry"),
  });
  const tradeCore = core as any;
  const proposer = core.issueIdentity({
    explorerId: "explorer_direct_item_expiry_proposer",
    identityName: "物品过期发起者",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_expiry_proposer",
  });
  const counterparty = core.issueIdentity({
    explorerId: "explorer_direct_item_expiry_counterparty",
    identityName: "物品过期接受者",
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_expiry_counterparty",
  });
  const source = core.grantResource({
    agentId: proposer.value.agentId,
    resourceId: "aether",
    amount: 1,
    reason: "direct_trade_item_expiry_source",
  }, serverContext);
  const item = tradeCore.createInventoryItem({
    agentId: proposer.value.agentId,
    itemKey: "direct-expiring-token",
    displayName: "会过期的直交易旧符",
    rarity: "common",
    sourceEventIds: [source.events[0].eventId],
  }, serverContext);
  const trade = tradeCore.createDirectTrade({
    proposerAgentId: proposer.value.agentId,
    counterpartyAgentId: counterparty.value.agentId,
    offerItemId: item.value.itemId,
    requestResourceId: "coin",
    requestAmount: 1,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_expiry_proposer",
  });
  assert.equal(core.project().inventoryItems[item.value.itemId].marketLockedByOrderId, trade.value.tradeId);

  time.set("2026-06-25T00:02:00.000Z");
  const expired = tradeCore.tickDirectTradeExpiry({
    maxAgeSeconds: 60,
    limit: 5,
  }, serverContext);
  assert.deepEqual(expired.events.map((event: { eventType: string }) => event.eventType), ["direct_trade_expired"]);
  assert.equal(expired.value.updated[0].status, "expired");
  const unlocked = core.project().inventoryItems[item.value.itemId];
  assert.equal(unlocked.agentId, proposer.value.agentId);
  assert.equal(unlocked.explorerId, "explorer_direct_item_expiry_proposer");
  assert.equal(unlocked.marketLockedByOrderId, undefined);
  assert.deepEqual(core.project().inventoryItemIdsByAgent[counterparty.value.agentId] || [], []);

  const listed = tradeCore.createMarketOrder({
    sellerAgentId: proposer.value.agentId,
    sellItemId: item.value.itemId,
    priceResourceId: "coin",
    priceAmount: 5,
  }, {
    ...userContext,
    actorExplorerId: "explorer_direct_item_expiry_proposer",
  });
  assert.equal(listed.value.sellItemId, item.value.itemId);
});

test("crafted inventory items spend real resources and create canonical items", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("craft"),
  });
  const craftingCore = core as any;
  assert.equal(typeof craftingCore.craftInventoryItem, "function");

  const identity = core.issueIdentity({
    explorerId: "explorer_crafter",
    identityName: "灰港修补匠",
  }, {
    ...userContext,
    actorExplorerId: "explorer_crafter",
  });
  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "coin",
    amount: 8,
    reason: "craft_seed",
  }, serverContext);
  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "aether",
    amount: 2,
    reason: "craft_seed",
  }, serverContext);

  assert.throws(() => craftingCore.craftInventoryItem({
    agentId: identity.value.agentId,
    recipeId: "field-kit",
  }, {
    ...userContext,
    actorExplorerId: "explorer_intruder",
  }), /inventory_craft_owner_mismatch/);

  assert.throws(() => craftingCore.craftInventoryItem({
    agentId: identity.value.agentId,
    recipeId: "unknown-recipe",
  }, {
    ...userContext,
    actorExplorerId: "explorer_crafter",
  }), /craft_recipe_not_found/);

  const crafted = craftingCore.craftInventoryItem({
    agentId: identity.value.agentId,
    recipeId: "field-kit",
  }, {
    ...userContext,
    actorExplorerId: "explorer_crafter",
  });

  assert.deepEqual(crafted.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "resource_spent",
    "item_created",
  ]);
  const spentEventIds = crafted.events
    .filter((event: { eventType: string }) => event.eventType === "resource_spent")
    .map((event: { eventId: string }) => event.eventId);
  assert.deepEqual(crafted.value.sourceEventIds, spentEventIds);
  assert.equal(crafted.value.agentId, identity.value.agentId);
  assert.equal(crafted.value.explorerId, "explorer_crafter");
  assert.equal(crafted.value.itemKey, "crafted:field-kit");
  assert.equal(crafted.value.displayName, "灰行者工具包");
  assert.equal(crafted.value.rarity, "common");
  assert.equal(crafted.value.bound, false);
  assert.equal(core.project().resourceBalances[identity.value.agentId].coin, 3);
  assert.equal(core.project().resourceBalances[identity.value.agentId].aether, 1);
  assert.equal((core.project() as any).inventoryItems[crafted.value.itemId].itemKey, "crafted:field-kit");

  assert.throws(() => craftingCore.craftInventoryItem({
    agentId: identity.value.agentId,
    recipeId: "focus-charm",
  }, {
    ...userContext,
    actorExplorerId: "explorer_crafter",
  }), /resource_insufficient/);
});

test("shop purchases spend server-priced resources and create canonical items", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("shop"),
  });
  const shopCore = core as any;
  assert.equal(typeof shopCore.purchaseShopOffer, "function");

  const identity = core.issueIdentity({
    explorerId: "explorer_shopper",
    identityName: "灰港买货人",
  }, {
    ...userContext,
    actorExplorerId: "explorer_shopper",
  });
  const broke = core.issueIdentity({
    explorerId: "explorer_broke_shopper",
    identityName: "空袋买货人",
  }, {
    ...userContext,
    actorExplorerId: "explorer_broke_shopper",
  });
  core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "coin",
    amount: 5,
    reason: "shop_seed",
  }, serverContext);

  assert.throws(() => shopCore.purchaseShopOffer({
    agentId: identity.value.agentId,
    offerId: "missing-offer",
  }, {
    ...userContext,
    actorExplorerId: "explorer_shopper",
  }), /shop_offer_not_found/);

  assert.throws(() => shopCore.purchaseShopOffer({
    agentId: identity.value.agentId,
    offerId: "gray-ration-pack",
  }, {
    ...userContext,
    actorExplorerId: "explorer_intruder",
  }), /shop_purchase_owner_mismatch/);

  assert.throws(() => shopCore.purchaseShopOffer({
    agentId: broke.value.agentId,
    offerId: "gray-ration-pack",
  }, {
    ...userContext,
    actorExplorerId: "explorer_broke_shopper",
  }), /resource_insufficient/);

  const purchased = shopCore.purchaseShopOffer({
    agentId: identity.value.agentId,
    offerId: "gray-ration-pack",
    clientDeclaredItemKey: "shop:imperial-command-seal",
    clientDeclaredPriceAmount: 0,
  }, {
    ...userContext,
    actorExplorerId: "explorer_shopper",
  });

  assert.deepEqual(purchased.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "item_created",
  ]);
  assert.equal(purchased.value.agentId, identity.value.agentId);
  assert.equal(purchased.value.explorerId, "explorer_shopper");
  assert.equal(purchased.value.itemKey, "shop:gray-ration-pack");
  assert.equal(purchased.value.displayName, "灰市补给包");
  assert.equal(purchased.value.rarity, "common");
  assert.equal(purchased.value.bound, false);
  assert.equal(core.project().resourceBalances[identity.value.agentId].coin, 2);
  assert.deepEqual(purchased.value.sourceEventIds, [purchased.events[0].eventId]);
  assert.equal((core.project() as any).inventoryItems[purchased.value.itemId].itemKey, "shop:gray-ration-pack");

  const regionalIdentity = core.issueIdentity({
    explorerId: "explorer_regional_shopper",
    identityName: "边境买货人",
  }, {
    ...userContext,
    actorExplorerId: "explorer_regional_shopper",
  });
  core.grantResource({
    agentId: regionalIdentity.value.agentId,
    resourceId: "coin",
    amount: 5,
    reason: "regional_shop_seed",
  }, serverContext);

  const regionalPurchase = shopCore.purchaseShopOffer({
    agentId: regionalIdentity.value.agentId,
    offerId: "gray-ration-pack",
    regionId: "region_ash_outpost",
    clientDeclaredPriceAmount: 0,
  }, {
    ...userContext,
    actorExplorerId: "explorer_regional_shopper",
  });
  assert.equal(core.project().resourceBalances[regionalIdentity.value.agentId].coin, 1);
  assert.equal(regionalPurchase.events[0].payload.amount, 4);
  assert.equal(regionalPurchase.events[0].payload.reason, "shop_purchase:region_ash_outpost:gray-ration-pack");

  const cityPipeOffers = epochShopOffersForRegion("region_city_pipes");
  const valveKitOffer = cityPipeOffers.find((offer) => offer.offerId === "pipewarden-valve-kit");
  assert.equal(valveKitOffer?.regionId, "region_city_pipes");
  assert.equal(valveKitOffer?.itemKey, "shop:pipewarden-valve-kit");
  assert.equal(valveKitOffer?.displayName, "管网阀钥工具");
  assert.deepEqual(valveKitOffer?.costs, [
    { resourceId: "coin", amount: 2 },
    { resourceId: "stamina", amount: 1 },
  ]);
  assert.equal(cityPipeOffers.some((offer) => offer.offerId === "mine-echo-relic"), false);

  const pipeIdentity = core.issueIdentity({
    explorerId: "explorer_pipe_shopper",
    identityName: "管网买货人",
  }, {
    ...userContext,
    actorExplorerId: "explorer_pipe_shopper",
  });
  core.grantResource({
    agentId: pipeIdentity.value.agentId,
    resourceId: "coin",
    amount: 2,
    reason: "pipe_shop_seed",
  }, serverContext);
  core.grantResource({
    agentId: pipeIdentity.value.agentId,
    resourceId: "stamina",
    amount: 1,
    reason: "pipe_shop_seed",
  }, serverContext);
  const pipePurchase = shopCore.purchaseShopOffer({
    agentId: pipeIdentity.value.agentId,
    offerId: "pipewarden-valve-kit",
    regionId: "region_city_pipes",
    clientDeclaredItemKey: "shop:forged-royal-pass",
    clientDeclaredPriceAmount: 0,
  }, {
    ...userContext,
    actorExplorerId: "explorer_pipe_shopper",
  });
  assert.deepEqual(pipePurchase.events.map((event: { eventType: string }) => event.eventType), [
    "resource_spent",
    "resource_spent",
    "item_created",
  ]);
  assert.equal(pipePurchase.value.itemKey, "shop:pipewarden-valve-kit");
  assert.equal(pipePurchase.value.displayName, "管网阀钥工具");
  assert.equal(pipePurchase.value.bound, false);
  assert.equal(pipePurchase.events[0].payload.reason, "shop_purchase:region_city_pipes:pipewarden-valve-kit");
  assert.equal(core.project().resourceBalances[pipeIdentity.value.agentId].coin, 0);
  assert.equal(core.project().resourceBalances[pipeIdentity.value.agentId].stamina, 0);

  const mineOffers = epochShopOffersForRegion("region_abandoned_mine");
  const mineRelicOffer = mineOffers.find((offer) => offer.offerId === "mine-echo-relic");
  assert.equal(mineRelicOffer?.regionId, "region_abandoned_mine");
  assert.equal(mineRelicOffer?.itemKey, "shop:mine-echo-relic");
  assert.equal(mineRelicOffer?.displayName, "矿脉回声遗物");
  assert.equal(mineRelicOffer?.bindOnAcquire, true);
  assert.equal(mineOffers.some((offer) => offer.offerId === "pipewarden-valve-kit"), false);

  const relicIdentity = core.issueIdentity({
    explorerId: "explorer_relic_shopper",
    identityName: "遗物买货人",
  }, {
    ...userContext,
    actorExplorerId: "explorer_relic_shopper",
  });
  core.grantResource({
    agentId: relicIdentity.value.agentId,
    resourceId: "coin",
    amount: 8,
    reason: "relic_shop_seed",
  }, serverContext);
  core.grantResource({
    agentId: relicIdentity.value.agentId,
    resourceId: "legend",
    amount: 1,
    reason: "relic_shop_seed",
  }, serverContext);

  const relicPurchase = shopCore.purchaseShopOffer({
    agentId: relicIdentity.value.agentId,
    offerId: "ashen-oath-relic",
    clientDeclaredBound: false,
  }, {
    ...userContext,
    actorExplorerId: "explorer_relic_shopper",
  });
  assert.equal(relicPurchase.value.itemKey, "shop:ashen-oath-relic");
  assert.equal(relicPurchase.value.displayName, "灰誓遗物");
  assert.equal(relicPurchase.value.rarity, "rare");
  assert.equal(relicPurchase.value.bound, true);
  assert.equal(core.project().inventoryItems[relicPurchase.value.itemId].bound, true);
  assert.equal(core.project().resourceBalances[relicIdentity.value.agentId].coin, 0);
  assert.equal(core.project().resourceBalances[relicIdentity.value.agentId].legend, 0);

  assert.throws(() => shopCore.createMarketOrder({
    sellerAgentId: relicIdentity.value.agentId,
    sellItemId: relicPurchase.value.itemId,
    priceResourceId: "coin",
    priceAmount: 99,
  }, {
    ...userContext,
    actorExplorerId: "explorer_relic_shopper",
  }), /inventory_item_bound_not_tradable/);
});

test("bound crafted inventory effects improve server-settled resource contests", () => {
  const { clock } = mutableClock("2026-06-25T00:00:00.000Z");
  const core = createEpochGameCore({
    clock,
    idFactory: createSequentialEpochIdFactory("gear"),
  });
  const gearCore = core as any;
  const identity = core.issueIdentity({
    explorerId: "explorer_gear",
    identityName: "灰港工具匠",
  }, {
    ...userContext,
    actorExplorerId: "explorer_gear",
  });
  core.grantResource({ agentId: identity.value.agentId, resourceId: "coin", amount: 5, reason: "gear_seed" }, serverContext);
  core.grantResource({ agentId: identity.value.agentId, resourceId: "aether", amount: 1, reason: "gear_seed" }, serverContext);
  core.grantResource({ agentId: identity.value.agentId, resourceId: "stamina", amount: 2, reason: "gear_seed" }, serverContext);
  const crafted = gearCore.craftInventoryItem({
    agentId: identity.value.agentId,
    recipeId: "field-kit",
  }, {
    ...userContext,
    actorExplorerId: "explorer_gear",
  });
  const node = gearCore.createResourceNode({
    regionId: "region_gear_test",
    title: "齿轮雾井",
    resourceId: "aether",
    rewardAmount: 2,
  }, serverContext);

  const unboundContest = gearCore.contestResourceNode({
    nodeId: node.value.nodeId,
    agentId: identity.value.agentId,
    staminaSpent: 1,
    clientDeclaredEquipmentScoreBonus: 999,
  }, {
    ...userContext,
    actorExplorerId: "explorer_gear",
  });
  const unboundPayload = unboundContest.events.find((event: { eventType: string }) =>
    event.eventType === "resource_node_contested")?.payload;
  assert.equal(unboundPayload.baseScoreDelta, 2);
  assert.equal(unboundPayload.equipmentScoreBonus, 0);
  assert.deepEqual(unboundPayload.equipmentItemIds, []);
  assert.equal(unboundPayload.scoreDelta, 2);

  gearCore.bindInventoryItem({
    itemId: crafted.value.itemId,
    agentId: identity.value.agentId,
    reason: "equip_to_identity",
  }, {
    ...userContext,
    actorExplorerId: "explorer_gear",
  });
  const boundContest = gearCore.contestResourceNode({
    nodeId: node.value.nodeId,
    agentId: identity.value.agentId,
    staminaSpent: 1,
    clientDeclaredEquipmentScoreBonus: 999,
  }, {
    ...userContext,
    actorExplorerId: "explorer_gear",
  });
  const boundPayload = boundContest.events.find((event: { eventType: string }) =>
    event.eventType === "resource_node_contested")?.payload;
  assert.equal(boundPayload.baseScoreDelta, 2);
  assert.equal(boundPayload.equipmentScoreBonus, 1);
  assert.deepEqual(boundPayload.equipmentItemIds, [crafted.value.itemId]);
  assert.equal(boundPayload.scoreDelta, 3);
  assert.equal(boundPayload.agentScoreAfter, 5);
  assert.equal(boundContest.value.totalScore, 5);
  assert.equal(boundContest.value.leaderboard[0].score, 5);
});
