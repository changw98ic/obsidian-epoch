import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_INTERACTION_MAX_SOURCE_EVENT_IDS,
  AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT,
  AGENT_INTERACTION_MAX_INBOX,
  buildAgentInteractionInbox,
  createDurableAgentInteractionProjection,
} from "../lib/epoch/agentInteractionEnvelopeRules.ts";
import { createAgentCompanionRuntime } from "../lib/epoch/agentCompanionRuntime.ts";
import { buildPersistedJourneyNarrative, buildServerJourneyEpisodeFacts } from "../lib/epoch/journeyNarrativeRules.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";
import { createJourneyRuntime } from "../lib/epoch/journeyRuntime.ts";

function epochEvent(index: number, overrides: Record<string, unknown> = {}) {
  return {
    eventId: `epoch_social_${index}`,
    eventType: "diplomacy_proposed",
    aggregateType: "diplomacy",
    aggregateId: `diplomacy_social_${index}`,
    actorExplorerId: "explorer_a",
    agentId: "agent_a",
    trustClass: "untrusted_client",
    causationId: `cause_${index}`,
    correlationId: `correlation_${index}`,
    createdAt: `2026-01-01T${String(index % 24).padStart(2, "0")}:00:00.000Z`,
    payload: {
      sourceAgentId: "agent_a",
      sourceExplorerId: "explorer_a",
      targetAgentId: "agent_b",
      targetExplorerId: "explorer_b",
      status: "pending",
      ...overrides,
    },
  } as unknown as EpochEvent;
}

test("inbox prioritizes expiring decisions and explains why they matter", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const inbox = buildAgentInteractionInbox({
    agentId: "agent_b",
    explorerId: "explorer_b",
    nowWorld: "2026-01-01T10:00:00.000Z",
    journeyProjection: journey.projection(),
    epochEvents: [
      epochEvent(1),
      epochEvent(2, { expiresAt: "2026-01-01T11:00:00.000Z" }),
    ],
    ownerForAgent: (agentId) => agentId === "agent_a" ? "explorer_a" : "explorer_b",
  });
  assert.equal(inbox.total, 2);
  assert.equal(inbox.items.length, 1);
  assert.equal(inbox.featured?.envelope.sourceEventIds[0], "epoch_social_2");
  assert.match(inbox.featured?.whyRelevant || "", /到期/);
});

test("one hundred low-value interactions aggregate and one proposer cannot grow the inbox without bound", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const inbox = buildAgentInteractionInbox({
    agentId: "agent_b",
    explorerId: "explorer_b",
    nowWorld: "2026-01-02T00:00:00.000Z",
    journeyProjection: journey.projection(),
    epochEvents: Array.from({ length: 100 }, (_, index) => epochEvent(index)),
    ownerForAgent: (agentId) => agentId === "agent_a" ? "explorer_a" : "explorer_b",
  });
  assert.equal(inbox.total, 20);
  assert.equal(inbox.items.length, 1);
  assert.equal(inbox.summaries.length, 1);
  assert.equal(inbox.summaries[0].count, 99);
  assert.equal(inbox.suppressedByRateLimit, 80);
  assert.match(inbox.summaries[0].message, /聚合/);
});

test("expired informational interactions disappear and payload secrets never enter envelopes", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const event = epochEvent(1, {
    expiresAt: "2026-01-01T11:00:00.000Z",
    recoveryCode: "must-not-leak",
    privateMessage: "private-body",
  });
  const live = buildAgentInteractionInbox({
    agentId: "agent_b",
    explorerId: "explorer_b",
    nowWorld: "2026-01-01T10:00:00.000Z",
    journeyProjection: journey.projection(),
    epochEvents: [event],
    ownerForAgent: (agentId) => agentId === "agent_a" ? "explorer_a" : "explorer_b",
  });
  assert.equal(live.total, 1);
  assert.doesNotMatch(JSON.stringify(live), /must-not-leak|private-body|recoveryCode|privateMessage/);
  const expired = buildAgentInteractionInbox({
    agentId: "agent_b",
    explorerId: "explorer_b",
    nowWorld: "2026-01-01T12:00:00.000Z",
    journeyProjection: journey.projection(),
    epochEvents: [event],
    ownerForAgent: (agentId) => agentId === "agent_a" ? "explorer_a" : "explorer_b",
  });
  assert.equal(expired.total, 0);
});

test("informational Epoch interactions receive the default TTL when source payload omits expiry", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const news = {
    ...epochEvent(3),
    eventType: "region_news_generated",
    aggregateType: "region_news",
    aggregateId: "news_default_ttl",
    createdAt: "2026-01-01T00:00:00.000Z",
    payload: { sourceAgentId: "agent_a", mentionedAgentIds: ["agent_b"] },
  } as unknown as EpochEvent;
  const common = {
    agentId: "agent_b",
    explorerId: "explorer_b",
    journeyProjection: journey.projection(),
    epochEvents: [news],
    ownerForAgent: (agentId: string) => agentId === "agent_a" ? "explorer_a" : "explorer_b",
  };
  assert.equal(buildAgentInteractionInbox({
    ...common,
    nowWorld: "2026-01-30T23:59:59.999Z",
  }).total, 1);
  assert.equal(buildAgentInteractionInbox({
    ...common,
    nowWorld: "2026-01-31T00:00:00.001Z",
  }).total, 0);
});

test("durable interaction projection is recipient-indexed, replay-safe, and bounded", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const events = [
    ...Array.from({ length: 250 }, (_, index) => epochEvent(index, {
      sourceAgentId: `agent_source_${index}`,
      targetAgentId: "agent_b",
    })),
    ...Array.from({ length: 250 }, (_, index) => epochEvent(index + 250, {
      sourceAgentId: `agent_other_${index}`,
      targetAgentId: "agent_c",
    })),
  ];
  const projection = createDurableAgentInteractionProjection();
  projection.update({ epochEvents: events, epochEventOffset: 0, journeyProjection: journey.projection() });
  projection.update({ epochEvents: events, epochEventOffset: 0, journeyProjection: journey.projection() });
  assert.equal(projection.countForRecipient("agent_b"), AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT);
  assert.equal(projection.countForRecipient("agent_c"), AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT);
  assert.equal(projection.countForRecipient("agent_missing"), 0);

  const inbox = projection.inbox({
    agentId: "agent_b",
    explorerId: "explorer_b",
    nowWorld: "2026-01-02T00:00:00.000Z",
    ownerForAgent: (agentId) => agentId === "agent_b" ? "explorer_b" : `owner:${agentId}`,
  });
  assert.equal(inbox.total, AGENT_INTERACTION_MAX_INBOX);
  assert.equal(inbox.suppressedByRateLimit, AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT - AGENT_INTERACTION_MAX_INBOX);

  const rehydrated = createDurableAgentInteractionProjection();
  rehydrated.update({ epochEvents: events, epochEventOffset: 0, journeyProjection: journey.projection() });
  assert.deepEqual(rehydrated.envelopesForRecipient("agent_b"), projection.envelopesForRecipient("agent_b"));
});

test("retention evicts expired open proposals before its recipient bound and survives replay", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const expired = Array.from({ length: AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT }, (_, index) =>
    epochEvent(index, {
      sourceAgentId: `agent_expired_${index}`,
      targetAgentId: "agent_b",
      expiresAt: "2026-01-02T00:00:00.000Z",
    }));
  const fresh = {
    ...epochEvent(999),
    eventId: "epoch_fresh_world_reference",
    eventType: "region_news_generated",
    aggregateType: "region_news",
    aggregateId: "news_fresh_world_reference",
    createdAt: "2026-01-02T00:00:00.000Z",
    payload: { sourceAgentId: "agent_fresh", mentionedAgentIds: ["agent_b"] },
  } as unknown as EpochEvent;
  const events = [fresh, ...expired];

  const projection = createDurableAgentInteractionProjection();
  projection.update({ epochEvents: events, epochEventOffset: 0, journeyProjection: journey.projection() });
  assert.equal(projection.countForRecipient("agent_b"), 1);
  assert.equal(projection.envelopesForRecipient("agent_b")[0]?.sourceEventIds[0], fresh.eventId);

  const rehydrated = createDurableAgentInteractionProjection();
  rehydrated.update({ epochEvents: [...events].reverse(), epochEventOffset: 0, journeyProjection: journey.projection() });
  assert.deepEqual(rehydrated.envelopesForRecipient("agent_b"), projection.envelopesForRecipient("agent_b"));
});

test("retention treats expiry as an inclusive boundary without discarding a still-open proposal", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const atBoundary = epochEvent(700, {
    sourceAgentId: "agent_at_boundary",
    targetAgentId: "agent_b",
    expiresAt: "2026-01-02T00:00:00.000Z",
  });
  const afterBoundary = epochEvent(701, {
    sourceAgentId: "agent_after_boundary",
    targetAgentId: "agent_b",
    expiresAt: "2026-01-02T00:00:00.001Z",
  });
  const watermark = {
    ...epochEvent(702),
    eventType: "region_news_generated",
    aggregateType: "region_news",
    aggregateId: "news_retention_watermark",
    createdAt: "2026-01-02T00:00:00.000Z",
    payload: { sourceAgentId: "agent_news", mentionedAgentIds: ["agent_c"] },
  } as unknown as EpochEvent;
  const projection = createDurableAgentInteractionProjection();
  projection.update({
    epochEvents: [atBoundary, afterBoundary, watermark],
    epochEventOffset: 0,
    journeyProjection: journey.projection(),
  });

  assert.deepEqual(
    projection.envelopesForRecipient("agent_b").map((envelope) => envelope.proposerAgentId),
    ["agent_after_boundary"],
  );
});

test("a terminal response can close a proposal after retention has removed its expired open state", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const proposal = epochEvent(710, { expiresAt: "2026-01-02T00:00:00.000Z" });
  const watermark = {
    ...epochEvent(711),
    eventType: "region_news_generated",
    aggregateType: "region_news",
    aggregateId: "news_after_proposal_expiry",
    createdAt: "2026-01-02T00:00:00.000Z",
    payload: { sourceAgentId: "agent_news", mentionedAgentIds: ["agent_b"] },
  } as unknown as EpochEvent;
  const response = {
    ...epochEvent(712),
    eventId: "epoch_response_after_retention",
    eventType: "diplomacy_responded",
    aggregateId: proposal.aggregateId,
    agentId: "agent_b",
    createdAt: "2026-01-02T00:00:00.001Z",
    payload: { ...proposal.payload, response: "accepted", status: "accepted" },
  } as unknown as EpochEvent;
  const projection = createDurableAgentInteractionProjection();
  projection.update({ epochEvents: [proposal, watermark], epochEventOffset: 0, journeyProjection: journey.projection() });
  assert.equal(projection.envelopesForRecipient("agent_b").some((item) => item.interactionId.includes(proposal.aggregateId)), false);

  projection.update({ epochEvents: [response], epochEventOffset: 2, journeyProjection: journey.projection() });
  const closed = projection.envelopesForRecipient("agent_b")
    .find((item) => item.interactionId.includes(proposal.aggregateId));
  assert.equal(closed?.status, "accepted");
  projection.update({ epochEvents: [proposal], epochEventOffset: 0, journeyProjection: journey.projection() });
  assert.equal(projection.envelopesForRecipient("agent_b")
    .find((item) => item.interactionId.includes(proposal.aggregateId))?.status, "accepted");
});

test("an expired terminal tombstone remains monotonic after its visible envelope is evicted", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const proposal = epochEvent(720, { expiresAt: "2026-01-02T00:00:00.000Z" });
  const response = {
    ...epochEvent(721),
    eventId: "epoch_expired_terminal_response",
    eventType: "diplomacy_responded",
    aggregateId: proposal.aggregateId,
    agentId: "agent_b",
    payload: { ...proposal.payload, response: "accepted", status: "accepted" },
  } as unknown as EpochEvent;
  const laterInformationalEvents = Array.from(
    { length: AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT },
    (_, index) => ({
      ...epochEvent(2_100 + index),
      eventId: `epoch_later_news_${index}`,
      eventType: "region_news_generated",
      aggregateType: "region_news",
      aggregateId: `news_later_${index}`,
      createdAt: "2026-01-03T00:00:00.000Z",
      payload: { sourceAgentId: `agent_news_${index}`, mentionedAgentIds: ["agent_b"] },
    } as unknown as EpochEvent),
  );
  const projection = createDurableAgentInteractionProjection();
  projection.update({
    epochEvents: [proposal, response, ...laterInformationalEvents],
    epochEventOffset: 0,
    journeyProjection: journey.projection(),
  });
  assert.equal(projection.envelopesForRecipient("agent_b")
    .some((item) => item.interactionId.includes(proposal.aggregateId)), false);

  projection.update({
    epochEvents: [proposal],
    epochEventOffset: 0,
    journeyProjection: journey.projection(),
  });
  const replayed = projection.envelopesForRecipient("agent_b")
    .find((item) => item.interactionId.includes(proposal.aggregateId));
  assert.notEqual(replayed?.status, "open");
});

test("an evicted terminal interaction cannot be reopened by replaying its original proposal", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const proposals = Array.from({ length: AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT + 1 }, (_, index) =>
    epochEvent(800 + index));
  const responses = proposals.map((proposal, index) => ({
    ...epochEvent(1_100 + index),
    eventId: `epoch_terminal_response_${index}`,
    eventType: "diplomacy_responded",
    aggregateId: proposal.aggregateId,
    agentId: "agent_b",
    payload: { ...proposal.payload, response: "accepted", status: "accepted" },
  })) as unknown as EpochEvent[];
  const projection = createDurableAgentInteractionProjection();
  projection.update({
    epochEvents: proposals.flatMap((proposal, index) => [proposal, responses[index]!]),
    epochEventOffset: 0,
    journeyProjection: journey.projection(),
  });
  assert.equal(projection.countForRecipient("agent_b"), AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT);

  const retainedIds = new Set(projection.envelopesForRecipient("agent_b")
    .map((envelope) => envelope.interactionId));
  const evictedProposal = proposals.find((proposal) =>
    !retainedIds.has(`interaction:${proposal.aggregateId}:agent_b`));
  assert.ok(evictedProposal);

  projection.update({
    epochEvents: [evictedProposal],
    epochEventOffset: proposals.indexOf(evictedProposal) * 2,
    journeyProjection: journey.projection(),
  });
  const replayed = projection.envelopesForRecipient("agent_b")
    .find((envelope) => envelope.interactionId === `interaction:${evictedProposal.aggregateId}:agent_b`);
  assert.notEqual(replayed?.status, "open");
  assert.equal(projection.countForRecipient("agent_b"), AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT);
});

test("terminal overflow does not suppress a new proposal created at the same canonical time", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const createdAt = "2026-01-01T00:00:00.000Z";
  const proposals = Array.from({ length: AGENT_INTERACTION_MAX_PROJECTED_PER_RECIPIENT + 1 }, (_, index) => ({
    ...epochEvent(1_600 - index),
    createdAt,
  })) as EpochEvent[];
  const responses = proposals.map((proposal, index) => ({
    ...epochEvent(1_700 + index),
    eventId: `epoch_same_time_terminal_response_${index}`,
    eventType: "diplomacy_responded",
    aggregateId: proposal.aggregateId,
    agentId: "agent_b",
    createdAt,
    payload: { ...proposal.payload, response: "accepted", status: "accepted" },
  })) as unknown as EpochEvent[];
  const projection = createDurableAgentInteractionProjection();
  projection.update({
    epochEvents: proposals.flatMap((proposal, index) => [proposal, responses[index]!] ),
    epochEventOffset: 0,
    journeyProjection: journey.projection(),
  });
  const oldestTerminalId = `interaction:${proposals[0]!.aggregateId}:agent_b`;
  assert.equal(projection.envelopesForRecipient("agent_b")
    .some((envelope) => envelope.interactionId === oldestTerminalId), false);

  const fresh = {
    ...epochEvent(2_000),
    eventId: "epoch_same_time_fresh_proposal",
    aggregateId: "diplomacy_same_time_fresh",
    createdAt,
  } as EpochEvent;
  projection.update({
    epochEvents: [fresh],
    epochEventOffset: proposals.length + responses.length,
    journeyProjection: journey.projection(),
  });

  const freshEnvelope = projection.envelopesForRecipient("agent_b")
    .find((envelope) => envelope.interactionId === `interaction:${fresh.aggregateId}:agent_b`);
  assert.equal(freshEnvelope?.status, "open");

  projection.update({
    epochEvents: [proposals[0]!],
    epochEventOffset: 0,
    journeyProjection: journey.projection(),
  });
  assert.equal(projection.envelopesForRecipient("agent_b")
    .some((envelope) => envelope.interactionId === oldestTerminalId), false);
});

test("companion replays persisted interaction sources once and then reads only new offsets", () => {
  const events = [epochEvent(1)];
  const offsets: number[] = [];
  const companion = createAgentCompanionRuntime({
    epoch: {
      progress: (input = {}) => ({
        identity: {
          agentId: input.agentId,
          explorerId: input.agentId === "agent_a" ? "explorer_a" : "explorer_b",
          identityName: input.agentId,
          generation: 1,
          status: "active",
          lifetime: { startedAt: "2026-01-01T00:00:00.000Z" },
          personality: { traits: [], driftIds: [] },
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      }),
      verifyExplorerAuth: () => ({ explorerId: "explorer_b", verified: true }),
      regionInfo: () => ({}),
      agentBriefing: () => ({}),
      events: () => ({ events: [] }),
      interactionEvents: (offset = 0) => {
        offsets.push(offset);
        return events.slice(offset);
      },
    },
    journeyOptions: {
      idFactory: (kind) => `${kind}_interaction_offset`,
      nowReal: () => "2026-01-02T00:00:00.000Z",
      nowWorld: () => "2026-01-02T00:00:00.000Z",
    },
  });
  const first = companion.briefing({ agentId: "agent_b", recoveryCode: "owner" });
  const second = companion.briefing({ agentId: "agent_b", recoveryCode: "owner" });
  assert.equal(first.interactionInboxTotal, 1);
  assert.equal(second.interactionInboxTotal, 1);
  assert.deepEqual(offsets, [0, 1, 1]);
});

test("canonical news and diplomacy events project world references and commissions", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const news = {
    ...epochEvent(3),
    eventType: "region_news_generated",
    aggregateType: "region_news",
    aggregateId: "news_3",
    payload: { sourceAgentId: "agent_a", mentionedAgentIds: ["agent_b"] },
  } as unknown as EpochEvent;
  const inbox = buildAgentInteractionInbox({
    agentId: "agent_b",
    explorerId: "explorer_b",
    nowWorld: "2026-01-02T00:00:00.000Z",
    journeyProjection: journey.projection(),
    epochEvents: [epochEvent(2), news],
    ownerForAgent: (agentId) => agentId === "agent_a" ? "explorer_a" : "explorer_b",
  });
  assert.deepEqual(new Set([inbox.featured?.envelope.kind, ...inbox.summaries.map((summary) => summary.kind)]),
    new Set(["commission", "world_reference"]));
});

test("a diplomacy response is projected back to the original proposer", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const response = {
    ...epochEvent(4),
    eventType: "diplomacy_responded",
    agentId: "agent_b",
    payload: {
      sourceAgentId: "agent_a",
      sourceExplorerId: "explorer_a",
      targetAgentId: "agent_b",
      targetExplorerId: "explorer_b",
      response: "accepted",
    },
  } as unknown as EpochEvent;
  const inbox = buildAgentInteractionInbox({
    agentId: "agent_a",
    explorerId: "explorer_a",
    nowWorld: "2026-01-02T00:00:00.000Z",
    journeyProjection: journey.projection(),
    epochEvents: [response],
    ownerForAgent: (agentId) => agentId === "agent_a" ? "explorer_a" : "explorer_b",
  });
  assert.equal(inbox.total, 1);
  assert.equal(inbox.featured?.envelope.kind, "commission");
  assert.equal(inbox.featured?.envelope.proposerAgentId, "agent_b");
  assert.equal(inbox.featured?.envelope.status, "accepted");
});

test("a diplomacy response closes the recipient proposal lifecycle and sends a bounded replay-safe notification", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const proposal = epochEvent(40);
  const response = {
    ...epochEvent(41),
    eventId: "epoch_social_response",
    eventType: "diplomacy_responded",
    aggregateId: proposal.aggregateId,
    agentId: "agent_b",
    createdAt: "2026-01-02T00:00:00.000Z",
    payload: {
      ...proposal.payload,
      response: "accepted",
      status: "accepted",
    },
  } as unknown as EpochEvent;
  const projection = createDurableAgentInteractionProjection();
  projection.update({ epochEvents: [proposal], epochEventOffset: 0, journeyProjection: journey.projection() });
  const open = projection.envelopesForRecipient("agent_b")[0];
  assert.equal(open.status, "open");
  assert.equal(open.consentMode, "recipient_accept");
  assert.ok(open.expiresAtWorldTime);

  projection.update({ epochEvents: [response, response], epochEventOffset: 1, journeyProjection: journey.projection() });
  const closed = projection.envelopesForRecipient("agent_b")[0];
  assert.equal(closed.interactionId, open.interactionId);
  assert.equal(closed.status, "accepted");
  assert.deepEqual(closed.sourceEventIds, [proposal.eventId, response.eventId]);
  const notification = projection.envelopesForRecipient("agent_a")[0];
  assert.equal(notification.status, "accepted");
  assert.equal(notification.consentMode, "informational");
  assert.deepEqual(notification.sourceEventIds, [response.eventId]);
  assert.ok(notification.expiresAtWorldTime);

  projection.update({ epochEvents: [proposal], epochEventOffset: 0, journeyProjection: journey.projection() });
  assert.equal(projection.envelopesForRecipient("agent_b")[0].status, "accepted");
  projection.update({
    epochEvents: [{
      ...response,
      eventId: "epoch_social_conflicting_response",
      payload: { ...response.payload, response: "rejected", status: "rejected" },
    } as unknown as EpochEvent],
    epochEventOffset: 2,
    journeyProjection: journey.projection(),
  });
  assert.equal(projection.envelopesForRecipient("agent_b")[0].status, "accepted");
});

test("one interaction keeps source event references bounded without losing its lifecycle state", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const proposal = epochEvent(50);
  const responses = Array.from({ length: AGENT_INTERACTION_MAX_SOURCE_EVENT_IDS + 25 }, (_, index) => ({
    ...epochEvent(51 + index),
    eventId: `epoch_social_response_${index}`,
    eventType: "diplomacy_responded",
    aggregateId: proposal.aggregateId,
    agentId: "agent_b",
    payload: {
      ...proposal.payload,
      response: index % 2 ? "accepted" : "rejected",
      status: index % 2 ? "accepted" : "rejected",
    },
  })) as unknown as EpochEvent[];
  const projection = createDurableAgentInteractionProjection();
  projection.update({
    epochEvents: [proposal, ...responses],
    epochEventOffset: 0,
    journeyProjection: journey.projection(),
  });

  const closed = projection.envelopesForRecipient("agent_b")[0];
  assert.equal(closed.status, "declined");
  assert.equal(closed.sourceEventIds[0], proposal.eventId);
  assert.equal(closed.sourceEventIds.at(-1), responses.at(-1)?.eventId);
  assert.equal(closed.sourceEventIds.length, AGENT_INTERACTION_MAX_SOURCE_EVENT_IDS);
  assert.ok(projection.envelopesForRecipient("agent_a")[0].sourceEventIds.length <= AGENT_INTERACTION_MAX_SOURCE_EVENT_IDS);
});

test("same-owner interactions are excluded from social incentives", () => {
  const journey = createJourneyRuntime({ idFactory: (kind) => `${kind}_empty` });
  const inbox = buildAgentInteractionInbox({
    agentId: "agent_b",
    explorerId: "explorer_same",
    nowWorld: "2026-01-02T00:00:00.000Z",
    journeyProjection: journey.projection(),
    epochEvents: [epochEvent(1)],
    ownerForAgent: () => "explorer_same",
  });
  assert.equal(inbox.total, 0);
});

test("a Journey episode involving another Agent appears in that Agent's inbox", () => {
  let sequence = 0;
  const canonicalEpochEvents: EpochEvent[] = [];
  const journey = createJourneyRuntime({
    idFactory: (kind) => `${kind}_social_${++sequence}`,
    nowReal: () => "2026-07-12T00:00:00.000Z",
    nowWorld: () => "2026-01-01T08:00:00.000Z",
    canonicalEpochEvents: () => canonicalEpochEvents,
  });
  const prepared = journey.prepare({
    agentId: "agent_a",
    explorerId: "explorer_a",
    originRegionId: "region_gray_harbor",
    destinationRegionId: "region_gray_harbor",
    mandate: { objective: "拜访邻居", priorities: ["social"] },
  });
  const started = journey.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
  const plan = journey.composeThreePhaseEpisodes(started.journey.journeyId, started.journey.version, {
    identityHistory: { recentEpisodeFingerprints: [] },
    region: { id: "region_gray_harbor", type: "region", label: "灰港", sourceFactIds: ["world:region_gray_harbor"] },
    season: "current",
    resources: {},
    unresolvedClues: [],
    availableWorldObjects: [{
      id: "agent_b",
      type: "agent",
      label: "邻居 B",
      regionId: "region_gray_harbor",
      sourceFactIds: ["epoch:identity_b"],
      participantIds: ["agent_b"],
      tags: ["social", "agent"],
    }],
  });
  const grounded = (episode: typeof plan.episodes[number]) => {
    const canonicalEventId = `epoch_${episode.phase}_${episode.episodeId}`;
    const serverFacts = buildServerJourneyEpisodeFacts({
      journeyId: started.journey.journeyId,
      episodeId: episode.episodeId,
      phase: episode.phase || "main",
      title: episode.title,
      agent: { id: "agent_a" },
      worldObjectRefs: episode.worldObjectRefs,
      action: { optionLabel: episode.title, outcomeSummary: `${episode.title}完成` },
      canonicalEventIds: [canonicalEventId],
    });
    const sessionId = `session_${canonicalEventId}`;
    canonicalEpochEvents.push({
      eventId: `started_${canonicalEventId}`,
      eventType: "hosted_session_started",
      aggregateType: "hosted_session",
      aggregateId: sessionId,
      actorExplorerId: "explorer_a",
      agentId: "agent_a",
      trustClass: "user_verified_web",
      causationId: episode.episodeId,
      correlationId: started.journey.correlationId,
      createdAt: "2026-07-12T00:00:00.000Z",
      payload: { sessionId, sceneContract: { journeyId: started.journey.journeyId, episodeId: episode.episodeId } },
    } as unknown as EpochEvent, {
      eventId: canonicalEventId,
      eventType: "hosted_action_recorded",
      aggregateType: "hosted_session",
      aggregateId: sessionId,
      actorExplorerId: "explorer_a",
      agentId: "agent_a",
      trustClass: "user_verified_web",
      causationId: episode.episodeId,
      correlationId: started.journey.correlationId,
      createdAt: "2026-07-12T00:00:00.000Z",
      payload: { sessionId },
    } as unknown as EpochEvent);
    return {
      ...episode,
      sourceFactIds: [...new Set([...episode.sourceFactIds, canonicalEventId])],
      settlement: { canonicalEventIds: [canonicalEventId], outcomeSummary: `${episode.title}完成` },
      serverFacts,
      narrative: buildPersistedJourneyNarrative({ serverFacts }).value,
    };
  };
  const arrived = journey.commitEpisodes(started.journey.journeyId, started.journey.version, [grounded(plan.episodes[0])]);
  const waiting = journey.awaitAgent(arrived.journey.journeyId, arrived.journey.version);
  const main = journey.commitEpisodes(waiting.journey.journeyId, waiting.journey.version, [grounded(plan.episodes[1])]);
  const returning = journey.beginReturn(main.journey.journeyId, main.journey.version);
  journey.commitEpisodes(returning.journey.journeyId, returning.journey.version, [grounded(plan.episodes[2])]);
  journey.tick({ nowReal: "2026-07-12T01:00:00.000Z", nowWorld: "2026-01-01T09:00:00.000Z" });
  const inbox = buildAgentInteractionInbox({
    agentId: "agent_b",
    explorerId: "explorer_b",
    nowWorld: "2026-01-01T09:00:00.000Z",
    journeyProjection: journey.projection(),
    epochEvents: [],
    ownerForAgent: (agentId) => agentId === "agent_a" ? "explorer_a" : "explorer_b",
  });
  assert.equal(inbox.total, 1);
  assert.equal(inbox.featured?.envelope.kind, "encounter");
  assert.match(inbox.featured?.whyRelevant || "", /真实旅程/);
  assert.equal(buildAgentInteractionInbox({
    agentId: "agent_b",
    explorerId: "explorer_b",
    nowWorld: "2026-02-01T09:00:00.001Z",
    journeyProjection: journey.projection(),
    epochEvents: [],
    ownerForAgent: (agentId) => agentId === "agent_a" ? "explorer_a" : "explorer_b",
  }).total, 0);
});
