import assert from "node:assert/strict";
import test from "node:test";

import type { EpochEvent } from "../lib/epoch/events.ts";
import {
  anomalyPersonalityDriftTrait,
  explorerRecoveryRotatedPayload,
  identityArchivedPayload,
  identityIssuedPayload,
  lifetimeAdjustedPayload,
  openPersonalityDriftForAgent,
  personalityDriftCooldownActive,
  personalityDriftConfirmedPayload,
  personalityDriftProposedPayload,
  personalityDriftSourceEvent,
  planExplorerRecoveryRotationEvents,
  planIdentityArchiveEvents,
  planIdentityIssueEvents,
  planIdentityReincarnationEvents,
  planLifetimeAdjustmentEvents,
  planPersonalityDriftConfirmationEvents,
  planPersonalityDriftProposalEvents,
  projectExplorerRecoveryRotation,
  projectIdentityArchive,
  projectIdentityIssue,
  projectIdentityReincarnation,
  projectPersonalityDriftConfirmation,
  relationshipPersonalityDriftTrait,
  reincarnationIssuedPayload,
} from "../lib/epoch/identityLifecycleRules.ts";
import { eventFactory } from "../lib/epoch/eventFactory.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";

function eventFixture(overrides: Partial<EpochEvent> = {}): EpochEvent {
  return {
    eventId: "epoch_event_1",
    eventType: "anomaly_event_resolved",
    aggregateType: "anomaly",
    aggregateId: "anomaly_1",
    actorExplorerId: "system",
    agentId: "agent_1",
    trustClass: "system_worker",
    causationId: "cause_1",
    correlationId: "corr_1",
    createdAt: "2026-07-07T00:00:00.000Z",
    payload: {},
    ...overrides,
  } as EpochEvent;
}

test("identity lifecycle rules plan issued and recovery payloads", () => {
  assert.deepEqual(identityIssuedPayload({
    agentId: "agent_1",
    explorerId: "explorer_1",
    explorerSecretHash: "hash_1",
    identityName: "Archivist",
    generation: 2,
    previousAgentId: "agent_0",
    maxLifetime: 9,
    startedAt: "2026-07-07T01:02:03.000Z",
  }), {
    agentId: "agent_1",
    explorerId: "explorer_1",
    explorerSecretHash: "hash_1",
    identityName: "Archivist",
    generation: 2,
    status: "active",
    previousAgentId: "agent_0",
    lifetime: {
      max: 9,
      remaining: 9,
      startedAt: "2026-07-07T01:02:03.000Z",
    },
  });

  assert.deepEqual(explorerRecoveryRotatedPayload({
    explorerId: "explorer_1",
    explorerSecretHash: "hash_2",
    rotatedAt: "2026-07-07T02:00:00.000Z",
  }), {
    explorerId: "explorer_1",
    explorerSecretHash: "hash_2",
    rotatedAt: "2026-07-07T02:00:00.000Z",
  });
});

test("identity lifecycle rules plan identity issue event sequences", () => {
  const issuedAt = "2026-07-07T01:02:03.000Z";
  const events = planIdentityIssueEvents({
    agentId: "agent_1",
    explorerId: "explorer_1",
    explorerSecretHash: "hash_1",
    identityName: "Archivist",
    generation: 2,
    previousAgentId: "agent_0",
    maxLifetime: 9,
    startedAt: issuedAt,
    makeEvent: eventFactory(() => new Date(issuedAt), createSequentialEpochIdFactory("identity_issue"), {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "identity_issue",
      correlationId: "corr_identity_issue",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["identity_issued"]);
  const issued = events[0];
  assert.ok(issued);
  assert.equal(issued.eventType, "identity_issued");
  if (issued.eventType !== "identity_issued") throw new Error("expected_identity_issued_event");
  assert.equal(issued.aggregateId, "agent_1");
  assert.equal(issued.agentId, "agent_1");
  assert.deepEqual(issued.payload, {
    agentId: "agent_1",
    explorerId: "explorer_1",
    explorerSecretHash: "hash_1",
    identityName: "Archivist",
    generation: 2,
    status: "active",
    previousAgentId: "agent_0",
    lifetime: {
      max: 9,
      remaining: 9,
      startedAt: issuedAt,
    },
  });

  const projectedIdentity = {
    agentId: "agent_1",
    status: "active",
    marker: "issued",
  } as const;
  assert.equal(projectIdentityIssue({
    events,
    projection: {
      identities: {
        agent_1: projectedIdentity,
      },
    },
  }), projectedIdentity);
  assert.throws(() => projectIdentityIssue({
    events: [],
    projection: {
      identities: {
        agent_1: projectedIdentity,
      },
    },
  }), /identity_issued_event_missing/);
  assert.throws(() => projectIdentityIssue({
    events,
    projection: {
      identities: {},
    },
  }), /identity_issue_projection_failed/);
});

test("identity lifecycle rules plan archive reincarnation and lifetime payloads", () => {
  assert.deepEqual(lifetimeAdjustedPayload({
    delta: -3,
    reason: "scar",
    previousRemaining: 4,
    remaining: 1,
  }), {
    delta: -3,
    reason: "scar",
    previousRemaining: 4,
    remaining: 1,
  });

  assert.deepEqual(identityArchivedPayload({
    archiveReason: "retired",
    archivedAt: "2026-07-07T03:00:00.000Z",
    finalTitle: "Last Archivist",
  }), {
    archiveReason: "retired",
    archivedAt: "2026-07-07T03:00:00.000Z",
    finalTitle: "Last Archivist",
  });

  assert.deepEqual(reincarnationIssuedPayload({
    explorerId: "explorer_1",
    previousAgentId: "agent_1",
    nextAgentId: "agent_2",
    generation: 3,
    inheritance: {
      legendEcho: 12,
      knownRegions: ["腐林"],
      scar: "听觉污染传闻",
    },
  }), {
    explorerId: "explorer_1",
    previousAgentId: "agent_1",
    nextAgentId: "agent_2",
    generation: 3,
    inheritance: {
      legendEcho: 12,
      knownRegions: ["腐林"],
      scar: "听觉污染传闻",
    },
  });
});

test("identity lifecycle rules plan lifetime adjustment event sequences", () => {
  const adjustedAt = "2026-07-07T03:30:00.000Z";
  const adjustmentEvents = planLifetimeAdjustmentEvents({
    agentId: "agent_1",
    delta: -2,
    reason: "scar",
    previousRemaining: 5,
    remaining: 3,
    makeEvent: eventFactory(() => new Date(adjustedAt), createSequentialEpochIdFactory("lifetime_adjust"), {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "lifetime_adjust",
      correlationId: "corr_lifetime_adjust",
    }),
  });

  assert.deepEqual(adjustmentEvents.map((event) => event.eventType), ["lifetime_adjusted"]);
  const adjusted = adjustmentEvents[0];
  assert.ok(adjusted);
  assert.equal(adjusted.eventType, "lifetime_adjusted");
  if (adjusted.eventType !== "lifetime_adjusted") throw new Error("expected_lifetime_adjusted_event");
  assert.equal(adjusted.agentId, "agent_1");
  assert.deepEqual(adjusted.payload, {
    delta: -2,
    reason: "scar",
    previousRemaining: 5,
    remaining: 3,
  });

  const archivedAt = "2026-07-07T03:31:00.000Z";
  const archiveEvents = planLifetimeAdjustmentEvents({
    agentId: "agent_1",
    delta: -5,
    reason: "fatal_scar",
    previousRemaining: 5,
    remaining: 0,
    archive: {
      archivedAt,
      finalTitle: "Last Archivist",
    },
    makeEvent: eventFactory(() => new Date(archivedAt), createSequentialEpochIdFactory("lifetime_archive"), {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "lifetime_archive",
      correlationId: "corr_lifetime_archive",
    }),
  });

  assert.deepEqual(archiveEvents.map((event) => event.eventType), [
    "lifetime_adjusted",
    "identity_archived",
  ]);
  const archived = archiveEvents[1];
  assert.ok(archived);
  assert.equal(archived.eventType, "identity_archived");
  if (archived.eventType !== "identity_archived") throw new Error("expected_identity_archived_event");
  assert.equal(archived.agentId, "agent_1");
  assert.deepEqual(archived.payload, {
    archiveReason: "fatal_scar",
    archivedAt,
    finalTitle: "Last Archivist",
  });
});

test("identity lifecycle rules plan reincarnation event sequences", () => {
  const startedAt = "2026-07-07T06:00:00.000Z";
  const events = planIdentityReincarnationEvents({
    explorerId: "explorer_1",
    previousAgentId: "agent_1",
    nextAgentId: "agent_2",
    identityName: "Second Archivist",
    generation: 3,
    inheritance: {
      legendEcho: 12,
      knownRegions: ["腐林"],
      scar: "听觉污染传闻",
    },
    maxLifetime: 10,
    startedAt,
    makeEvent: eventFactory(() => new Date(startedAt), createSequentialEpochIdFactory("reincarnation"), {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "reincarnation",
      correlationId: "corr_reincarnation",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), [
    "identity_issued",
    "reincarnation_issued",
  ]);
  const issued = events[0];
  assert.ok(issued);
  assert.equal(issued.eventType, "identity_issued");
  if (issued.eventType !== "identity_issued") throw new Error("expected_identity_issued_event");
  assert.equal(issued.aggregateId, "agent_2");
  assert.equal(issued.agentId, "agent_2");
  assert.deepEqual(issued.payload, {
    agentId: "agent_2",
    explorerId: "explorer_1",
    identityName: "Second Archivist",
    generation: 3,
    status: "active",
    previousAgentId: "agent_1",
    inheritance: {
      legendEcho: 12,
      knownRegions: ["腐林"],
      scar: "听觉污染传闻",
    },
    lifetime: {
      max: 10,
      remaining: 10,
      startedAt,
    },
  });

  const reincarnation = events[1];
  assert.ok(reincarnation);
  assert.equal(reincarnation.eventType, "reincarnation_issued");
  if (reincarnation.eventType !== "reincarnation_issued") {
    throw new Error("expected_reincarnation_issued_event");
  }
  assert.equal(reincarnation.aggregateId, "agent_1");
  assert.equal(reincarnation.agentId, "agent_1");
  assert.deepEqual(reincarnation.payload, {
    explorerId: "explorer_1",
    previousAgentId: "agent_1",
    nextAgentId: "agent_2",
    generation: 3,
    inheritance: {
      legendEcho: 12,
      knownRegions: ["腐林"],
      scar: "听觉污染传闻",
    },
  });

  const projectedIdentity = {
    agentId: "agent_2",
    status: "active",
    marker: "reincarnated",
  } as const;
  assert.equal(projectIdentityReincarnation({
    events,
    projection: {
      identities: {
        agent_2: projectedIdentity,
      },
    },
  }), projectedIdentity);
  assert.throws(() => projectIdentityReincarnation({
    events: [],
    projection: {
      identities: {
        agent_2: projectedIdentity,
      },
    },
  }), /identity_issued_event_missing/);
  assert.throws(() => projectIdentityReincarnation({
    events,
    projection: {
      identities: {},
    },
  }), /identity_reincarnation_projection_failed/);
});

test("identity lifecycle rules plan recovery rotation event sequences", () => {
  const rotatedAt = "2026-07-07T02:00:00.000Z";
  const events = planExplorerRecoveryRotationEvents({
    explorerId: "explorer_1",
    explorerSecretHash: "hash_2",
    rotatedAt,
    makeEvent: eventFactory(() => new Date(rotatedAt), createSequentialEpochIdFactory("recovery_rotation"), {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "recovery_rotation",
      correlationId: "corr_recovery_rotation",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["explorer_recovery_rotated"]);
  const rotated = events[0];
  assert.ok(rotated);
  assert.equal(rotated.eventType, "explorer_recovery_rotated");
  if (rotated.eventType !== "explorer_recovery_rotated") {
    throw new Error("expected_explorer_recovery_rotated_event");
  }
  assert.equal(rotated.aggregateType, "explorer");
  assert.equal(rotated.aggregateId, "explorer_1");
  assert.deepEqual(rotated.payload, {
    explorerId: "explorer_1",
    explorerSecretHash: "hash_2",
    rotatedAt,
  });
  assert.deepEqual(projectExplorerRecoveryRotation({ events }), {
    explorerId: "explorer_1",
    rotated: true,
    newRecoveryRegistered: true,
    rotatedAt,
  });
  assert.throws(() => projectExplorerRecoveryRotation({ events: [] }), /explorer_recovery_rotated_event_missing/);
});

test("identity lifecycle rules plan archive event sequences", () => {
  const archivedAt = "2026-07-07T03:00:00.000Z";
  const events = planIdentityArchiveEvents({
    agentId: "agent_1",
    archiveReason: "retired",
    archivedAt,
    finalTitle: "Last Archivist",
    makeEvent: eventFactory(() => new Date(archivedAt), createSequentialEpochIdFactory("identity_archive"), {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "identity_archive",
      correlationId: "corr_identity_archive",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["identity_archived"]);
  const archived = events[0];
  assert.ok(archived);
  assert.equal(archived.eventType, "identity_archived");
  if (archived.eventType !== "identity_archived") throw new Error("expected_identity_archived_event");
  assert.equal(archived.aggregateId, "agent_1");
  assert.equal(archived.agentId, "agent_1");
  assert.deepEqual(archived.payload, {
    archiveReason: "retired",
    archivedAt,
    finalTitle: "Last Archivist",
  });

  const projectedIdentity = {
    agentId: "agent_1",
    status: "archived",
    marker: "archived",
  } as const;
  assert.equal(projectIdentityArchive({
    events,
    projection: {
      identities: {
        agent_1: projectedIdentity,
      },
    },
  }), projectedIdentity);
  assert.throws(() => projectIdentityArchive({
    events: [],
    projection: {
      identities: {
        agent_1: projectedIdentity,
      },
    },
  }), /identity_archived_event_missing/);
  assert.throws(() => projectIdentityArchive({
    events,
    projection: {
      identities: {},
    },
  }), /identity_archive_projection_failed/);
});

test("identity lifecycle rules plan personality drift payloads", () => {
  assert.deepEqual(personalityDriftProposedPayload({
    driftId: "drift_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    sourceEventId: "event_1",
    trigger: "relationship_hostility",
    suggestedTrait: "keeps receipts",
    summary: "A severe hostility event changed trust boundaries.",
    proposedAt: "2026-07-07T04:00:00.000Z",
  }), {
    driftId: "drift_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    sourceEventId: "event_1",
    trigger: "relationship_hostility",
    suggestedTrait: "keeps receipts",
    summary: "A severe hostility event changed trust boundaries.",
    proposedAt: "2026-07-07T04:00:00.000Z",
  });

  assert.deepEqual(personalityDriftConfirmedPayload({
    driftId: "drift_1",
    agentId: "agent_1",
    confirmedByExplorerId: "explorer_1",
    confirmedAt: "2026-07-07T05:00:00.000Z",
  }), {
    driftId: "drift_1",
    agentId: "agent_1",
    confirmedByExplorerId: "explorer_1",
    confirmedAt: "2026-07-07T05:00:00.000Z",
  });
});

test("identity lifecycle rules plan personality drift proposal event sequences", () => {
  const proposedAt = "2026-07-07T04:00:00.000Z";
  const events = planPersonalityDriftProposalEvents({
    driftId: "drift_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    sourceEventId: "event_1",
    trigger: "relationship_hostility",
    suggestedTrait: "keeps receipts",
    summary: "A severe hostility event changed trust boundaries.",
    proposedAt,
    makeEvent: eventFactory(() => new Date(proposedAt), createSequentialEpochIdFactory("drift_proposal"), {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "drift_proposal",
      correlationId: "corr_drift_proposal",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["personality_drift_proposed"]);
  const proposed = events[0];
  assert.ok(proposed);
  assert.equal(proposed.eventType, "personality_drift_proposed");
  if (proposed.eventType !== "personality_drift_proposed") {
    throw new Error("expected_personality_drift_proposed_event");
  }
  assert.equal(proposed.aggregateType, "personality_drift");
  assert.equal(proposed.aggregateId, "drift_1");
  assert.equal(proposed.agentId, "agent_1");
  assert.deepEqual(proposed.payload, {
    driftId: "drift_1",
    agentId: "agent_1",
    explorerId: "explorer_1",
    sourceEventId: "event_1",
    trigger: "relationship_hostility",
    suggestedTrait: "keeps receipts",
    summary: "A severe hostility event changed trust boundaries.",
    proposedAt,
  });
});

test("identity lifecycle rules plan personality drift confirmation event sequences", () => {
  const confirmedAt = "2026-07-07T05:00:00.000Z";
  const events = planPersonalityDriftConfirmationEvents({
    driftId: "drift_1",
    agentId: "agent_1",
    confirmedByExplorerId: "explorer_1",
    confirmedAt,
    makeEvent: eventFactory(() => new Date(confirmedAt), createSequentialEpochIdFactory("drift_confirmation"), {
      actorExplorerId: "explorer_1",
      trustClass: "user_verified_web" as const,
      causationId: "drift_confirmation",
      correlationId: "corr_drift_confirmation",
    }),
  });

  assert.deepEqual(events.map((event) => event.eventType), ["personality_drift_confirmed"]);
  const confirmed = events[0];
  assert.ok(confirmed);
  assert.equal(confirmed.eventType, "personality_drift_confirmed");
  if (confirmed.eventType !== "personality_drift_confirmed") {
    throw new Error("expected_personality_drift_confirmed_event");
  }
  assert.equal(confirmed.aggregateType, "personality_drift");
  assert.equal(confirmed.aggregateId, "drift_1");
  assert.equal(confirmed.agentId, "agent_1");
  assert.deepEqual(confirmed.payload, {
    driftId: "drift_1",
    agentId: "agent_1",
    confirmedByExplorerId: "explorer_1",
    confirmedAt,
  });

  const projectedDrift = {
    driftId: "drift_1",
    status: "confirmed",
    marker: "confirmed",
  } as const;
  assert.equal(projectPersonalityDriftConfirmation({
    events,
    projection: {
      personalityDrifts: {
        drift_1: projectedDrift,
      },
    },
  }), projectedDrift);
  assert.throws(() => projectPersonalityDriftConfirmation({
    events: [],
    projection: {
      personalityDrifts: {
        drift_1: projectedDrift,
      },
    },
  }), /personality_drift_confirmed_event_missing/);
  assert.throws(() => projectPersonalityDriftConfirmation({
    events,
    projection: {
      personalityDrifts: {},
    },
  }), /personality_drift_confirmation_projection_failed/);
});

test("identity lifecycle rules resolve personality drift source events", () => {
  const anomaly = eventFixture({
    eventId: "epoch_event_anomaly",
    eventType: "anomaly_event_resolved",
  });
  const relationship = eventFixture({
    eventId: "epoch_event_relationship",
    eventType: "relationship_updated",
  });
  const unrelated = eventFixture({
    eventId: "epoch_event_resource",
    eventType: "resource_granted",
  });

  assert.equal(personalityDriftSourceEvent({
    events: [unrelated, anomaly, relationship],
    sourceEventId: "epoch_event_anomaly",
  }), anomaly);
  assert.equal(personalityDriftSourceEvent({
    events: [unrelated, anomaly, relationship],
    sourceEventId: "epoch_event_relationship",
  }), relationship);
  assert.equal(personalityDriftSourceEvent({
    events: [unrelated, anomaly, relationship],
    sourceEventId: "epoch_event_resource",
  }), undefined);
  assert.equal(personalityDriftSourceEvent({
    events: [unrelated, anomaly, relationship],
    sourceEventId: "epoch_event_missing",
  }), undefined);
});

test("identity lifecycle rules fold open personality drift and cooldown state", () => {
  const projection = {
    personalityDriftIdsByAgent: {
      agent_1: ["drift_confirmed", "drift_proposed", "drift_invalid_date"],
      agent_2: ["drift_old"],
    },
    personalityDrifts: {
      drift_confirmed: {
        driftId: "drift_confirmed",
        status: "confirmed",
        confirmedAt: "2026-07-07T00:00:00.000Z",
      },
      drift_proposed: {
        driftId: "drift_proposed",
        status: "proposed",
      },
      drift_invalid_date: {
        driftId: "drift_invalid_date",
        status: "confirmed",
        confirmedAt: "not-a-date",
      },
      drift_old: {
        driftId: "drift_old",
        status: "confirmed",
        confirmedAt: "2026-06-01T00:00:00.000Z",
      },
    },
  };

  assert.equal(openPersonalityDriftForAgent({
    projection,
    agentId: "agent_1",
  })?.driftId, "drift_proposed");
  assert.equal(openPersonalityDriftForAgent({
    projection,
    agentId: "agent_2",
  }), undefined);
  assert.equal(personalityDriftCooldownActive({
    projection,
    agentId: "agent_1",
    nowMs: Date.parse("2026-07-07T00:10:00.000Z"),
  }), true);
  assert.equal(personalityDriftCooldownActive({
    projection,
    agentId: "agent_2",
    nowMs: Date.parse("2026-07-07T00:10:00.000Z"),
  }), false);
});

test("identity lifecycle rules choose personality drift traits", () => {
  assert.equal(anomalyPersonalityDriftTrait(2), "异常伤痕后更谨慎");
  assert.equal(anomalyPersonalityDriftTrait(3), "裂隙重压后仍会先确认退路");
  assert.equal(relationshipPersonalityDriftTrait(-3), undefined);
  assert.equal(relationshipPersonalityDriftTrait(-4), "被背誓刺伤后更谨慎地信任他人");
  assert.equal(relationshipPersonalityDriftTrait(-6), "被深重敌意伤过后会先保留证据");
});
