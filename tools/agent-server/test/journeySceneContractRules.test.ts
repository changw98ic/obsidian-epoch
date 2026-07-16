import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { createEpochGameCore } from "../lib/epoch/gameCore.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { obsidianEpochReleasePublicKey } from "../lib/packageArchive.ts";
import {
  runtimeActionKeyId,
  runtimeActionPublicKey,
  trustedRuntimeActionPublicKeys,
} from "../lib/runtimeActionSigning.ts";

import {
  GRAY_HARBOR_LIVELIHOOD_ACTION_RECIPES,
  buildJourneySceneContract,
  isJourneySceneActionLabelSpecific,
  journeySceneActionSignedContent,
  journeySceneHostedActionOptions,
  verifyJourneySceneActionSignature,
  type JourneySceneContractBuildInput,
  type JourneySceneContractWorldObject,
} from "../lib/epoch/journeySceneContractRules.ts";
import { signedEnvelopeContentHash } from "../lib/epoch/turnActionEnvelopeRules.ts";

const WORLD_OBJECTS: readonly JourneySceneContractWorldObject[] = [
  {
    id: "region_gray_harbor",
    type: "region",
    label: "灰港",
    sourceFactIds: ["event_gray_harbor_confirmed"],
  },
  {
    id: "location_gray_harbor_civic_ledger",
    type: "workplace",
    label: "灰港民务账房",
    regionId: "region_gray_harbor",
    sourceFactIds: ["event_civic_ledger_open"],
    tags: ["livelihood", "workplace"],
  },
  {
    id: "organization_gray_harbor_civic_office",
    type: "organization",
    label: "灰港民务所",
    regionId: "region_gray_harbor",
    sourceFactIds: ["event_civic_office_confirmed"],
    tags: ["livelihood", "employer"],
  },
  {
    id: "npc_night_clerk_kelan",
    type: "npc",
    label: "夜班书记珂岚",
    regionId: "region_gray_harbor",
    sourceFactIds: ["event_kelan_on_shift"],
    tags: ["clerk", "reliable"],
  },
  {
    id: "document_gray_harbor_salt_ledger",
    type: "document",
    label: "灰港盐票账册",
    regionId: "region_gray_harbor",
    sourceFactIds: ["event_salt_ledger_available"],
    tags: ["salt_ledger", "bookkeeping"],
  },
  {
    id: "document_gray_harbor_medicine_manifest",
    type: "document",
    label: "药品运送清单",
    regionId: "region_gray_harbor",
    sourceFactIds: ["event_medicine_manifest_filed"],
    tags: ["medicine_manifest", "cargo_manifest"],
  },
];

function input(overrides: Partial<JourneySceneContractBuildInput> = {}): JourneySceneContractBuildInput {
  return {
    seed: "gray-harbor-day-17",
    agentId: "agent_sable_scribe",
    journeyId: "journey_gray_harbor_17",
    episodeId: "episode_gray_harbor_livelihood_1",
    sceneType: "livelihood",
    title: "灰港的一日短工",
    mandate: {
      objective: "在灰港找一份稳妥的短工",
      priorities: ["livelihood", "reliable people"],
      avoid: ["anomaly", "conflict"],
      preferredActivities: ["work", "bookkeeping"],
      socialPreference: "balanced",
      returnCondition: "time",
    },
    worldObjects: WORLD_OBJECTS,
    sourceFactIds: WORLD_OBJECTS.flatMap((object) => object.sourceFactIds),
    expectedVersion: 3,
    expiresAt: "2026-07-13T08:00:00.000Z",
    ruleVersion: "journey-scene-contract.v2",
    ...overrides,
  };
}

test("gray harbor livelihood catalog exposes six concrete server-owned recipes", () => {
  assert.deepEqual(GRAY_HARBOR_LIVELIHOOD_ACTION_RECIPES.map((recipe) => recipe.optionKey), [
    "ask_for_shift",
    "verify_salt_ledger",
    "carry_manifest",
    "ask_about_recent_travelers",
    "report_discrepancy",
    "leave_without_commitment",
  ]);
});

test("builds a deterministic signed scene contract from seed, mandate, world state, and rule version", () => {
  const first = buildJourneySceneContract(input());
  const second = buildJourneySceneContract(input());

  assert.deepEqual(first, second);
  assert.equal(first.sceneType, "livelihood");
  assert.equal(first.location.id, "location_gray_harbor_civic_ledger");
  assert.equal(first.actionOptions.length, 6);
  assert.equal(
    first.actionOptions.find((action) => action.actionOptionId === first.safeFallbackActionOptionId)?.optionKey,
    "leave_without_commitment",
  );
  assert.equal(new Set(first.actionOptions.map((action) => action.actionOptionId)).size, 6);
  assert.ok(first.actionOptions.every((action) => verifyJourneySceneActionSignature({
    agentId: input().agentId,
    contract: first,
    action,
  })));

  const changedMandate = buildJourneySceneContract(input({
    mandate: { ...input().mandate, objective: "只询问班次便返回" },
  }));
  assert.notEqual(changedMandate.sceneId, first.sceneId);
  assert.notDeepEqual(changedMandate.actionOptions.map((action) => action.actionOptionId),
    first.actionOptions.map((action) => action.actionOptionId));
});

test("runtime action signatures use a purpose-bound key independent from package releases", () => {
  const packageKey = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const actionKey = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const previousPackageKey = process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM;
  const previousActionKey = process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
  process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM = packageKey;
  process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = actionKey;
  try {
    const contract = buildJourneySceneContract(input());
    for (const action of contract.actionOptions) {
      assert.equal(action.signingPurpose, "journey_scene_action");
      assert.equal(action.signatureVersion, 1);
      assert.match(action.signingKeyId, /^[a-f0-9]{64}$/);
      assert.notEqual(action.serverPublicKey, obsidianEpochReleasePublicKey());
      assert.equal(verifyJourneySceneActionSignature({ agentId: input().agentId, contract, action }), true);
    }
  } finally {
    if (previousPackageKey === undefined) delete process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM;
    else process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM = previousPackageKey;
    if (previousActionKey === undefined) delete process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
    else process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = previousActionKey;
  }
});

test("runtime action key rotation accepts the documented PEM public-key ring before switching private keys", () => {
  const oldKeyPair = generateKeyPairSync("ed25519");
  const oldKey = oldKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const oldPublicKeyPem = oldKeyPair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const newKey = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const previousActionKey = process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
  const previousVerificationKeys = process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS;
  try {
    process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = oldKey;
    const contract = buildJourneySceneContract(input());
    process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS = JSON.stringify({
      keys: [{ publicKey: oldPublicKeyPem, keyId: contract.actionOptions[0]?.signingKeyId }],
    });
    process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = newKey;
    assert.equal(verifyJourneySceneActionSignature({ agentId: input().agentId, contract, action: contract.actionOptions[0] }), true);
  } finally {
    if (previousActionKey === undefined) delete process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
    else process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = previousActionKey;
    if (previousVerificationKeys === undefined) delete process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS;
    else process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS = previousVerificationKeys;
  }
});

test("runtime action verification normalizes and deduplicates PEM and DER/base64 identities", () => {
  const oldKeyPair = generateKeyPairSync("ed25519");
  const oldPrivateKey = oldKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const oldPublicKeyPem = oldKeyPair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const newPrivateKey = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const previousActionKey = process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
  const previousVerificationKeys = process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS;
  try {
    process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = oldPrivateKey;
    const oldPublicKeyDerBase64 = runtimeActionPublicKey();
    process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = newPrivateKey;
    process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS = JSON.stringify({
      keys: [
        { publicKey: oldPublicKeyPem, keyId: runtimeActionKeyId(oldPublicKeyPem) },
        { publicKey: oldPublicKeyDerBase64, keyId: runtimeActionKeyId(oldPublicKeyDerBase64) },
      ],
    });

    const trusted = trustedRuntimeActionPublicKeys();
    assert.equal(trusted.size, 2);
    assert.equal(trusted.has(oldPublicKeyDerBase64), true);
    assert.equal(runtimeActionKeyId(oldPublicKeyPem), runtimeActionKeyId(oldPublicKeyDerBase64));
  } finally {
    if (previousActionKey === undefined) delete process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
    else process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = previousActionKey;
    if (previousVerificationKeys === undefined) delete process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS;
    else process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS = previousVerificationKeys;
  }
});

test("runtime action verification rings fail closed for invalid, non-Ed25519, or mismatched identities", () => {
  const actionKeyPair = generateKeyPairSync("ed25519");
  const actionPrivateKey = actionKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const actionPublicKeyPem = actionKeyPair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const ecPublicKeyPem = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey
    .export({ type: "spki", format: "pem" }).toString();
  const previousActionKey = process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
  const previousVerificationKeys = process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS;
  try {
    process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = actionPrivateKey;
    for (const ring of [
      { keys: [{ publicKey: "not-a-public-key" }] },
      { keys: [{ publicKey: ecPublicKeyPem }] },
      { keys: [{ publicKey: actionPrivateKey }] },
      { keys: [{ publicKey: actionPublicKeyPem, keyId: "0".repeat(64) }] },
    ]) {
      process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS = JSON.stringify(ring);
      assert.throws(() => trustedRuntimeActionPublicKeys(), /runtime_action_verification_keys_invalid/);
    }
  } finally {
    if (previousActionKey === undefined) delete process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM;
    else process.env.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM = previousActionKey;
    if (previousVerificationKeys === undefined) delete process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS;
    else process.env.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS = previousVerificationKeys;
  }
});

test("maps only signed scene recipes into hosted actions and uses the explicit safe fallback", () => {
  const contract = buildJourneySceneContract(input());
  const hosted = journeySceneHostedActionOptions(contract);

  assert.deepEqual(hosted.map((action) => action.actionOptionId),
    contract.actionOptions.map((action) => action.actionOptionId));
  assert.deepEqual(hosted.map((action) => action.optionKey),
    GRAY_HARBOR_LIVELIHOOD_ACTION_RECIPES.map((recipe) => recipe.optionKey));
  assert.equal(hosted.some((action) => ["observe", "assist", "anomaly"].includes(action.optionKey)), false);
  assert.equal(hosted.find((action) => action.actionOptionId === contract.safeFallbackActionOptionId)?.optionKey,
    "leave_without_commitment");
  assert.ok(hosted.every((action) => action.reward === undefined && action.lifetimeDelta === undefined));
});

test("arrival and return phases issue distinct signed Gray Harbor travel actions", () => {
  const region = WORLD_OBJECTS.filter((object) => object.type === "region");
  const phaseInput = {
    sceneType: "travel" as const,
    worldObjects: region,
    sourceFactIds: region.flatMap((object) => object.sourceFactIds),
  };
  const arrival = buildJourneySceneContract(input({
    ...phaseInput,
    phase: "arrival",
    episodeId: "episode_arrival",
    title: "到达：灰港",
  }));
  const returning = buildJourneySceneContract(input({
    ...phaseInput,
    phase: "return",
    episodeId: "episode_return",
    title: "返程：灰港",
  }));

  assert.deepEqual(arrival.actionOptions.map((action) => action.optionKey), [
    "enter_gray_harbor", "review_arrival_route", "turn_back_before_entry",
  ]);
  assert.deepEqual(returning.actionOptions.map((action) => action.optionKey), [
    "return_by_known_route", "record_verified_facts", "wait_for_safe_departure",
  ]);
  assert.equal(arrival.actionOptions.find((action) =>
    action.actionOptionId === arrival.safeFallbackActionOptionId)?.optionKey, "turn_back_before_entry");
  assert.equal(returning.actionOptions.find((action) =>
    action.actionOptionId === returning.safeFallbackActionOptionId)?.optionKey, "wait_for_safe_departure");
  assert.ok([...arrival.actionOptions, ...returning.actionOptions].every((action) =>
    verifyJourneySceneActionSignature({ agentId: input().agentId, contract: action.optionKey.startsWith("return_")
      || action.optionKey === "record_verified_facts" || action.optionKey === "wait_for_safe_departure"
      ? returning : arrival, action })));
  assert.notEqual(arrival.sceneId, returning.sceneId);
});

test("every action is grounded in supplied entities and confirmed source facts", () => {
  const contract = buildJourneySceneContract(input());
  const knownEntityIds = new Set(WORLD_OBJECTS.map((object) => object.id));
  const knownFactIds = new Set(input().sourceFactIds);

  assert.deepEqual(new Set(contract.confirmedFactIds), knownFactIds);
  assert.ok(knownEntityIds.has(contract.location.id));
  assert.ok(contract.participants.every((participant) => knownEntityIds.has(participant.id)));
  for (const action of contract.actionOptions) {
    assert.ok(action.targetEntityIds.length > 0);
    assert.ok(action.targetEntityIds.every((id) => knownEntityIds.has(id)));
    assert.ok(action.preconditionRefs.length > 0);
    assert.ok(action.preconditionRefs.every((id) => knownFactIds.has(id)));
    assert.ok(action.allowedEffectKinds.length > 0);
  }
});

test("all gray harbor labels name a concrete behavior or world object and reject generic journey templates", () => {
  const contract = buildJourneySceneContract(input());
  const labels = WORLD_OBJECTS.map((object) => object.label);
  for (const action of contract.actionOptions) {
    assert.equal(isJourneySceneActionLabelSpecific(action.label, labels), true, action.label);
    assert.doesNotMatch(action.label, /^(?:观察区域态势|协助区域事务|接触低阶异常)$/u);
    assert.ok(labels.some((label) => action.label.includes(label)), action.label);
  }
});

test("signature binds risk, targets, preconditions, effects, and visible action wording", () => {
  const contract = buildJourneySceneContract(input());
  const original = contract.actionOptions[0];
  const verifies = (action: typeof original) => verifyJourneySceneActionSignature({
    agentId: input().agentId,
    contract,
    action,
  });

  assert.equal(verifies(original), true);
  assert.equal(verifies({ ...original, label: `${original.label}并领取十枚钱币` }), false);
  assert.equal(verifies({ ...original, risk: "high" }), false);
  assert.equal(verifies({
    ...original,
    riskTerms: {
      ...original.riskTerms,
      successReward: { resourceId: "coin", amount: 99 },
    },
  }), false);
  assert.equal(verifies({ ...original, targetEntityIds: ["npc_invented"] }), false);
  assert.equal(verifies({ ...original, preconditionRefs: ["event_invented"] }), false);
  assert.equal(verifies({ ...original, allowedEffectKinds: ["resource_delta"] }), false);
});

test("persisted v1 scene actions remain verifiable while v2 makes risk terms mandatory", () => {
  const legacySignedContent = journeySceneActionSignedContent({
    agentId: "agent_legacy_fixture",
    sceneId: "scene_legacy_fixture",
    expectedVersion: 3,
    expiresAt: "2026-07-13T08:00:00.000Z",
    ruleVersion: "journey-scene-contract.v1",
    signatureVersion: 1,
    signingPurpose: "journey_scene_action",
    signingKeyId: "legacy-key-id",
    action: {
      actionOptionId: "action_legacy_fixture",
      optionKey: "legacy_option",
      label: "legacy label",
      intent: "legacy intent",
      risk: "medium",
      preconditionRefs: ["event_legacy"],
      allowedEffectKinds: ["journey_progress", "world_reference"],
      targetEntityIds: ["npc_legacy"],
    },
  });
  assert.deepEqual(legacySignedContent, {
    actionOptionId: "action_legacy_fixture",
    agentId: "agent_legacy_fixture",
    allowedEffectKinds: ["journey_progress", "world_reference"],
    expectedVersion: 3,
    expiresAt: "2026-07-13T08:00:00.000Z",
    intent: "legacy intent",
    label: "legacy label",
    optionKey: "legacy_option",
    preconditionRefs: ["event_legacy"],
    risk: "medium",
    ruleVersion: "journey-scene-contract.v1",
    sceneId: "scene_legacy_fixture",
    signatureVersion: 1,
    signingKeyId: "legacy-key-id",
    signingPurpose: "journey_scene_action",
    targetEntityIds: ["npc_legacy"],
  });
  assert.equal(
    signedEnvelopeContentHash(legacySignedContent),
    "sha256:b777f8b18f0ce4bc1e59c1a7b656693383d1a07c87b209c7f90e5c49abe72d21",
  );

  const legacy = buildJourneySceneContract(input({ ruleVersion: "journey-scene-contract.v1" }));
  assert.ok(legacy.actionOptions.every((action) => action.riskTerms === undefined));
  assert.ok(legacy.actionOptions.every((action) => verifyJourneySceneActionSignature({
    agentId: input().agentId,
    contract: legacy,
    action,
  })));

  const current = buildJourneySceneContract(input());
  const action = current.actionOptions.find((candidate) => candidate.risk !== "low")
    ?? current.actionOptions[0];
  assert.ok(action.riskTerms);
  assert.equal(verifyJourneySceneActionSignature({
    agentId: input().agentId,
    contract: current,
    action: { ...action, riskTerms: undefined },
  }), false);
});

test("generated faction route selection is server-bound into the signed action", () => {
  const generatedTaskObjective = {
    objectiveId: "choice_faction_route",
    kind: "choice" as const,
    sequence: 1,
    title: "选择合作阵营",
    objective: "在现场选择一条阵营合作路线。",
    completionCriteria: "签名行动明确绑定唯一阵营路线。",
    sceneType: "livelihood" as const,
    locationId: "location_gray_harbor_civic_ledger",
    worldObjectIds: [
      "location_gray_harbor_civic_ledger",
      "organization_gray_harbor_civic_office",
    ],
    actions: [{
      optionKey: "choose_civic_office_route",
      label: "接受灰港民务所的合作路线",
      intent: "确认合作边界后进入该路线。",
      risk: "low" as const,
      allowedEffectKinds: ["journey_progress" as const],
      targetObjectIds: ["organization_gray_harbor_civic_office"],
      outcomeSummary: "身份确认与灰港民务所合作。",
      selectsRouteId: "route_civic_office",
    }],
  };
  const contract = buildJourneySceneContract(input({
    generatedTaskObjective,
    taskRoutes: [{
      routeId: "route_civic_office",
      kind: "choice",
      title: "灰港民务所路线",
      factionObjectId: "organization_gray_harbor_civic_office",
      objectiveIds: [],
      unlockedByObjectiveIds: [],
    }],
  }));
  const selected = contract.actionOptions.find((action) =>
    action.optionKey === "choose_civic_office_route");
  assert.ok(selected);
  assert.deepEqual(selected.routeSelection, {
    routeId: "route_civic_office",
    factionObjectId: "organization_gray_harbor_civic_office",
  });
  assert.equal(verifyJourneySceneActionSignature({ agentId: input().agentId, contract, action: selected }), true);
  assert.equal(verifyJourneySceneActionSignature({
    agentId: input().agentId,
    contract,
    action: {
      ...selected,
      routeSelection: { routeId: "route_invented", factionObjectId: "organization_gray_harbor_civic_office" },
    },
  }), false);
});

test("fails closed when required world roles or canonical source facts are absent", () => {
  const withoutNpc = WORLD_OBJECTS.filter((object) => object.type !== "npc");
  assert.throws(() => buildJourneySceneContract(input({
    worldObjects: withoutNpc,
    sourceFactIds: withoutNpc.flatMap((object) => object.sourceFactIds),
  })), /gray_harbor_livelihood_scene_incomplete/);

  assert.throws(() => buildJourneySceneContract(input({
    worldObjects: WORLD_OBJECTS.map((object) => object.id === "npc_night_clerk_kelan"
      ? { ...object, sourceFactIds: [] }
      : object),
  })), /journey_scene_world_object_source_fact_required/);

  assert.throws(() => buildJourneySceneContract(input({
    sourceFactIds: ["event_not_in_world_state"],
  })), /journey_scene_source_fact_not_grounded/);
});

test("region, organization, and npc are sufficient; document and workplace refs only enrich recipes", () => {
  const productionMinimum = WORLD_OBJECTS.filter((object) =>
    ["region", "organization", "npc"].includes(object.type));
  const contract = buildJourneySceneContract(input({
    worldObjects: productionMinimum,
    sourceFactIds: productionMinimum.flatMap((object) => object.sourceFactIds),
  }));

  assert.equal(contract.location.id, "region_gray_harbor");
  assert.equal(contract.actionOptions.length, 6);
  assert.ok(contract.actionOptions.every((action) => action.targetEntityIds.every((id) =>
    productionMinimum.some((object) => object.id === id))));
});

test("different rule versions and world facts produce different signed contracts", () => {
  const baseline = buildJourneySceneContract(input());
  const nextRules = buildJourneySceneContract(input({ ruleVersion: "journey-scene-contract.v3-test" }));
  assert.notEqual(nextRules.sceneId, baseline.sceneId);
  assert.notEqual(nextRules.actionOptions[0].signature, baseline.actionOptions[0].signature);

  const changedWorld = WORLD_OBJECTS.map((object) => object.id === "document_gray_harbor_salt_ledger"
    ? { ...object, sourceFactIds: ["event_salt_ledger_revised"] }
    : object);
  const changedWorldContract = buildJourneySceneContract(input({
    worldObjects: changedWorld,
    sourceFactIds: changedWorld.flatMap((object) => object.sourceFactIds),
  }));
  assert.notEqual(changedWorldContract.sceneId, baseline.sceneId);
});

test("hosted_session_started persists and rehydrates the exact signed scene contract", () => {
  const core = createEpochGameCore({
    clock: () => new Date("2026-07-12T00:00:00.000Z"),
    idFactory: createSequentialEpochIdFactory("journey_scene_persistence"),
  });
  const context = {
    actorExplorerId: "explorer_scene_persistence",
    trustClass: "user_verified_web" as const,
    causationId: "cmd_scene_persistence",
    correlationId: "corr_scene_persistence",
  };
  const identity = core.issueIdentity({
    explorerId: context.actorExplorerId,
    identityName: "灰港合同校验者",
  }, context);
  const buildInput = input();
  const started = core.startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: buildInput.title,
    journeyScene: {
      seed: buildInput.seed,
      journeyId: buildInput.journeyId,
      episodeId: buildInput.episodeId,
      sceneType: buildInput.sceneType,
      phase: "main",
      title: buildInput.title,
      mandate: buildInput.mandate,
      worldObjects: buildInput.worldObjects,
      sourceFactIds: buildInput.sourceFactIds,
      expectedVersion: buildInput.expectedVersion,
    },
  }, context);
  const event = started.events[0];
  assert.equal(event.eventType, "hosted_session_started");
  assert.deepEqual(event.payload.sceneContract, started.value.sceneContract);
  assert.throws(() => core.submitHostedAction({
    sessionId: started.value.sessionId,
    actionOptionId: started.value.actionOptions[0].actionOptionId,
  }, context), /journey_scene_commit_required/);

  const rehydrated = createEpochGameCore({ initialEvents: [...identity.events, ...started.events] });
  assert.deepEqual(
    rehydrated.project().hostedSessions[started.value.sessionId].sceneContract,
    started.value.sceneContract,
  );
});

test("a selected high-risk generated action is resolved by the server and replays as failed", () => {
  const core = createEpochGameCore({
    clock: () => new Date("2026-07-12T00:00:00.000Z"),
    idFactory: createSequentialEpochIdFactory("journey_resolution_persistence"),
  });
  const context = {
    actorExplorerId: "explorer_resolution_persistence",
    trustClass: "user_verified_web" as const,
    causationId: "cmd_resolution_persistence",
    correlationId: "corr_resolution_persistence",
  };
  const identity = core.issueIdentity({
    explorerId: context.actorExplorerId,
    identityName: "未准备的装置助手",
  }, context);
  const stamina = core.grantResource({
    agentId: identity.value.agentId,
    resourceId: "stamina",
    amount: 1,
    reason: "journey_high_risk_test_seed",
  }, { ...context, actorExplorerId: "system", trustClass: "system_worker" });
  const generatedTaskObjective = {
    objectiveId: "main_high_risk_calibration",
    kind: "main" as const,
    sequence: 1,
    title: "校准高风险盐票装置",
    objective: "在账房内完成高风险装置校准。",
    completionCriteria: "装置稳定并留下现场复核记录。",
    sceneType: "livelihood" as const,
    locationId: "location_gray_harbor_civic_ledger",
    worldObjectIds: [
      "location_gray_harbor_civic_ledger",
      "npc_night_clerk_kelan",
      "document_gray_harbor_salt_ledger",
    ],
    actions: [{
      optionKey: "calibrate_high_risk_ledger_device",
      label: "在珂岚监督下校准高风险盐票装置",
      intent: "先核对安全边界，再尝试完成装置校准。",
      risk: "high" as const,
      allowedEffectKinds: ["journey_progress" as const],
      targetObjectIds: ["npc_night_clerk_kelan", "document_gray_harbor_salt_ledger"],
      outcomeSummary: "身份完成装置校准，珂岚确认盐票装置已经稳定。",
    }],
  };
  const buildInput = input({ generatedTaskObjective });
  const started = core.startHostedSession({
    agentId: identity.value.agentId,
    regionId: "region_gray_harbor",
    mandate: generatedTaskObjective.objective,
    journeyScene: {
      seed: buildInput.seed,
      journeyId: buildInput.journeyId,
      episodeId: buildInput.episodeId,
      sceneType: buildInput.sceneType,
      phase: "main",
      title: buildInput.title,
      mandate: buildInput.mandate,
      worldObjects: buildInput.worldObjects,
      sourceFactIds: buildInput.sourceFactIds,
      expectedVersion: buildInput.expectedVersion,
      generatedTaskObjective,
    },
  }, context);
  const selected = started.value.sceneContract?.actionOptions.find((action) =>
    action.optionKey === generatedTaskObjective.actions[0].optionKey);
  assert.ok(selected);
  assert.equal(selected.completionKind, undefined);

  const committed = core.submitHostedAction({
    sessionId: started.value.sessionId,
    actionOptionId: selected.actionOptionId,
    journeyValidation: {
      journeyId: buildInput.journeyId,
      episodeId: buildInput.episodeId,
      expectedVersion: buildInput.expectedVersion,
    },
  }, context);

  assert.equal(committed.value.journeyResolution?.authority, "server");
  assert.equal(committed.value.journeyResolution?.completionKind, "failed");
  assert.deepEqual(committed.value.journeyResolution?.resourceCost, {
    resourceId: "stamina",
    amount: 1,
    paid: true,
  });
  assert.notEqual(committed.value.outcomeSummary, generatedTaskObjective.actions[0].outcomeSummary);
  assert.match(committed.value.outcomeSummary, /未完成/u);
  assert.equal(committed.events[0].eventType, "hosted_action_recorded");
  assert.deepEqual(committed.events[0].payload.journeyResolution, committed.value.journeyResolution);
  assert.equal(committed.events[1]?.eventType, "resource_spent");
  assert.equal(core.project().resourceBalances[identity.value.agentId]?.stamina, 0);

  const replayed = createEpochGameCore({
    initialEvents: [...identity.events, ...stamina.events, ...started.events, ...committed.events],
  }).project().hostedSessions[started.value.sessionId].actions[0];
  assert.deepEqual(replayed.journeyResolution, committed.value.journeyResolution);
  assert.equal(replayed.outcomeSummary, committed.value.outcomeSummary);
});

test("a completed cost-bearing journey action spends its cost and grants the signed risk premium", () => {
  const core = createEpochGameCore({
    clock: () => new Date("2026-07-12T00:00:00.000Z"),
    idFactory: createSequentialEpochIdFactory("journey_risk_reward"),
  });
  const context = {
    actorExplorerId: "explorer_journey_risk_reward",
    trustClass: "user_verified_web" as const,
    causationId: "cmd_journey_risk_reward",
    correlationId: "corr_journey_risk_reward",
  };
  const systemContext = {
    ...context,
    actorExplorerId: "system",
    trustClass: "system_worker" as const,
  };
  const identity = core.issueIdentity({
    explorerId: context.actorExplorerId,
    identityName: "账房风险校验员",
  }, context);
  for (const resource of [
    { resourceId: "focus" as const, amount: 4 },
    { resourceId: "stamina" as const, amount: 4 },
    { resourceId: "aether" as const, amount: 4 },
  ]) {
    core.grantResource({
      agentId: identity.value.agentId,
      ...resource,
      reason: `journey_risk_reward_seed:${resource.resourceId}`,
    }, systemContext);
  }

  const objective = (objectiveId: string, risk: "low" | "medium") => ({
    objectiveId,
    kind: "main" as const,
    sequence: objectiveId === "main_prepare" ? 1 : 2,
    title: objectiveId === "main_prepare" ? "整理校准记录" : "复核校准结果",
    objective: objectiveId === "main_prepare" ? "先整理账房校准记录。" : "复核账房校准结果。",
    completionCriteria: "行动结果进入服务器记录。",
    sceneType: "livelihood" as const,
    locationId: "location_gray_harbor_civic_ledger",
    worldObjectIds: [
      "location_gray_harbor_civic_ledger",
      "npc_night_clerk_kelan",
      "document_gray_harbor_salt_ledger",
    ],
    actions: [{
      optionKey: `${objectiveId}_action`,
      label: objectiveId === "main_prepare" ? "与珂岚整理校准记录" : "与珂岚复核校准结果",
      intent: "依据账册完成现场核验。",
      risk,
      allowedEffectKinds: ["journey_progress" as const],
      targetObjectIds: ["npc_night_clerk_kelan", "document_gray_harbor_salt_ledger"],
      outcomeSummary: objectiveId === "main_prepare"
        ? "身份与珂岚整理了校准记录。"
        : "身份与珂岚完成了校准结果复核。",
    }],
  });
  const commitObjective = (generatedTaskObjective: ReturnType<typeof objective>, expectedVersion: number) => {
    const buildInput = input({
      episodeId: `episode_${generatedTaskObjective.objectiveId}`,
      expectedVersion,
      generatedTaskObjective,
    });
    const session = core.startHostedSession({
      agentId: identity.value.agentId,
      regionId: "region_gray_harbor",
      mandate: generatedTaskObjective.objective,
      journeyScene: {
        seed: buildInput.seed,
        journeyId: buildInput.journeyId,
        episodeId: buildInput.episodeId,
        sceneType: buildInput.sceneType,
        phase: "main",
        title: generatedTaskObjective.title,
        mandate: buildInput.mandate,
        worldObjects: buildInput.worldObjects,
        sourceFactIds: buildInput.sourceFactIds,
        expectedVersion: buildInput.expectedVersion,
        generatedTaskObjective,
      },
    }, context);
    const selected = session.value.sceneContract?.actionOptions.find((action) =>
      action.optionKey === generatedTaskObjective.actions[0].optionKey);
    assert.ok(selected);
    return core.submitHostedAction({
      sessionId: session.value.sessionId,
      actionOptionId: selected.actionOptionId,
      journeyValidation: {
        journeyId: buildInput.journeyId,
        episodeId: buildInput.episodeId,
        expectedVersion: buildInput.expectedVersion,
      },
    }, context);
  };

  const prepared = commitObjective(objective("main_prepare", "low"), 1);
  assert.equal(prepared.value.journeyResolution?.completionKind, "complete");
  const resolved = commitObjective(objective("main_resolve", "medium"), 2);
  assert.equal(resolved.value.journeyResolution?.completionKind, "complete");
  assert.deepEqual(resolved.value.journeyResolution?.riskPremium, { resourceId: "coin", amount: 1 });
  assert.deepEqual(resolved.value.reward, {
    resourceId: "coin",
    amount: 1,
    reason: `journey_risk_reward:${input().journeyId}:main_resolve:medium`,
  });
  assert.ok(resolved.events.some((event) => event.eventType === "resource_spent"
    && event.payload.resourceId === "focus"));
  assert.ok(resolved.events.some((event) => event.eventType === "resource_granted"
    && event.payload.resourceId === "coin"));
  assert.equal(core.project().resourceBalances[identity.value.agentId]?.focus, 3);
  assert.equal(core.project().resourceBalances[identity.value.agentId]?.coin, 1);
});
