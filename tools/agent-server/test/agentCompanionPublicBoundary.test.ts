import assert from "node:assert/strict";
import test from "node:test";
import { createAgentCompanionRuntime } from "../lib/epoch/agentCompanionRuntime.ts";

function runtimeWithRegionInfo(regionInfo: Record<string, unknown>) {
  let sequence = 0;
  return createAgentCompanionRuntime({
    epoch: {
      progress: () => ({
        identity: { agentId: "agent_public_boundary", explorerId: "explorer_public_boundary", status: "active" },
      }),
      verifyExplorerAuth: () => ({ explorerId: "explorer_public_boundary", verified: true }),
      regionInfo: () => regionInfo,
      agentBriefing: () => ({}),
      events: () => ({ events: [] }),
    },
    journeyOptions: {
      idFactory: (kind) => `${kind}_public_boundary_${++sequence}`,
      nowReal: () => "2026-07-12T00:00:00.000Z",
      nowWorld: () => "2026-01-01T08:00:00.000Z",
    },
  });
}

function startJourney(regionInfo: Record<string, unknown>) {
  const runtime = runtimeWithRegionInfo(regionInfo);
  const prepared = runtime.prepare({
    agentId: "agent_public_boundary",
    destinationRegionId: "region_gray_harbor",
    recoveryCode: "owner-credential",
    idempotencyKey: "prepare-public-boundary",
  });
  return runtime.start({
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: "owner-credential",
    idempotencyKey: "start-public-boundary",
  });
}

test("Journey scene titles use organization displayName and public region labels", () => {
  const started = startJourney({
    organizations: [{
      organizationId: "epoch_organization_region_gray_harbor_civic_ledger",
      displayName: "灰港民务账房",
    }],
  });

  assert.ok(started.scenePlan.episodes.length > 0);
  assert.ok(started.scenePlan.episodes.some((episode) => episode.title.includes("灰港民务账房")));
  for (const episode of started.scenePlan.episodes) {
    assert.doesNotMatch(episode.title, /epoch_organization|region_gray_harbor/);
    const region = episode.worldObjectRefs.find((ref) => ref.type === "region");
    assert.equal(region?.label, "灰港");
  }
});

test("Gray Harbor journey uses concrete public world labels instead of internal region ids", () => {
  const started = startJourney({});

  assert.deepEqual(started.scenePlan.episodes.map((episode) => episode.phase), ["arrival", "main", "return"]);
  assert.equal(started.scenePlan.episodes[0]?.title, "到达：灰港");
  assert.match(started.scenePlan.episodes[1]?.title ?? "", /^生计：(?:灰港民务账房|灰港民务所)$/u);
  assert.equal(started.scenePlan.episodes[2]?.title, "返程：灰港");
  assert.doesNotMatch(JSON.stringify(started.scenePlan.episodes.map((episode) => episode.title)), /region_gray_harbor/);
});

test("foreign Player briefing exposes only an explicit public projection while the owner keeps the full briefing", () => {
  let progressReads = 0;
  let ownerBriefingReads = 0;
  const sensitiveBriefing = {
    generatedAt: "2026-01-01T08:00:00.000Z",
    agentId: "agent_public_boundary",
    explorerId: "explorer_public_boundary",
    regionId: "region_gray_harbor",
    agentSelfStatement: "OWNER_ONLY_STATEMENT private-event region_gray_harbor",
    progress: {
      identity: { identityName: "private-identity" },
      lineage: ["private-lineage"],
      resources: { coin: 999 },
      inventoryItems: [{ itemId: "private-item" }],
      downtime: { mode: "private-downtime" },
      custody: { reason: "private-custody" },
      latestEvents: [{ eventId: "private-event" }],
    },
    pendingActions: [{ actionId: "private-action" }],
    regionalContext: { regionId: "region_gray_harbor", label: "灰港" },
    world: { publicPages: { world: "/epoch/world" }, news: [], regionHighlights: [], activeSeasons: [] },
    publicPages: {
      world: "/epoch/world",
      console: "/epoch/console",
      agent: "/epoch/agent/agent_public_boundary",
      explorer: "/epoch/explorer/explorer_public_boundary",
      region: "/epoch/region/region_gray_harbor",
    },
  };
  const runtime = createAgentCompanionRuntime({
    epoch: {
      progress: () => {
        progressReads += 1;
        return {
          identity: { agentId: "agent_public_boundary", explorerId: "explorer_public_boundary", status: "active" },
        };
      },
      verifyExplorerAuth: (input = {}) => {
        if (input.recoveryCode !== "owner-proof") throw new Error("explorer_authorization_required");
        return { explorerId: "explorer_public_boundary", verified: true };
      },
      regionInfo: () => ({}),
      agentBriefing: () => {
        ownerBriefingReads += 1;
        return sensitiveBriefing;
      },
      publicIdentity: () => ({
        identityExists: true,
        generatedAt: sensitiveBriefing.generatedAt,
        canonicalAgentId: "agent_public_boundary",
        identityLabel: "公示巡游者",
        identityStatus: "active",
        regionLabel: "灰港",
        regionalContext: {
          messages: [{
            body: "公开留言",
            postedAt: "2026-01-01T07:00:00.000Z",
            agentId: "private-agent-id",
          }],
          news: [{
            headline: "公开新闻",
            body: "公开内容",
            createdAt: "2026-01-01T06:00:00.000Z",
            sourceEventId: "private-source-event",
          }],
          commissions: [],
          regionId: "region_gray_harbor",
        },
        publicPages: {
          world: "/epoch/world",
          console: "/epoch/console",
          agent: "/epoch/agent/agent_public_boundary",
        },
      }),
      events: () => ({ events: [] }),
    },
    journeyOptions: {
      idFactory: (kind) => `${kind}_foreign_briefing`,
      nowReal: () => "2026-07-12T00:00:00.000Z",
      nowWorld: () => "2026-01-01T08:00:00.000Z",
    },
  });

  const publicBriefing = runtime.briefing({ agentId: "agent_public_boundary" });
  assert.deepEqual(publicBriefing, {
    identityExists: true,
    generatedAt: sensitiveBriefing.generatedAt,
    agentId: "agent_public_boundary",
    canonicalAgentId: "agent_public_boundary",
    publicIdentity: { label: "公示巡游者", status: "active" },
    regionLabel: "灰港",
    agentSelfStatement: "我是公示巡游者，在灰港留下可公开验证的经历。",
    regionalContext: {
      messages: [{ body: "公开留言", postedAt: "2026-01-01T07:00:00.000Z" }],
      news: [{ headline: "公开新闻", body: "公开内容", createdAt: "2026-01-01T06:00:00.000Z" }],
      commissions: [],
    },
    publicPages: {
      world: sensitiveBriefing.publicPages.world,
      console: sensitiveBriefing.publicPages.console,
      agent: sensitiveBriefing.publicPages.agent,
    },
    returnedJourneys: [],
    recentEpisodes: [],
    pendingDecisions: [],
    interactionInbox: [],
    interactionInboxSummaries: [],
    interactionInboxTotal: 0,
    agentWishes: [],
  });
  assert.equal(progressReads, 0);
  assert.equal(ownerBriefingReads, 0);
  assert.doesNotMatch(JSON.stringify(publicBriefing), /OWNER_ONLY|explorer_public_boundary|private-|region_gray_harbor|progress|lineage|resources|inventory|downtime|custody|latestEvents/);

  const ownerBriefing = runtime.briefing({ agentId: "agent_public_boundary", recoveryCode: "owner-proof" });
  const ownerBriefingRecord = ownerBriefing as Record<string, unknown>;
  assert.deepEqual(ownerBriefingRecord.progress, sensitiveBriefing.progress);
  assert.equal(ownerBriefingRecord.explorerId, "explorer_public_boundary");
  assert.equal(progressReads, 1);
  assert.equal(ownerBriefingReads, 1);
});

test("foreign briefing fails closed for an unknown canonical identity without echoing the requested id", () => {
  const runtime = createAgentCompanionRuntime({
    epoch: {
      progress: () => {
        throw new Error("private_progress_must_not_be_read");
      },
      verifyExplorerAuth: () => {
        throw new Error("auth_must_not_be_read");
      },
      regionInfo: () => ({}),
      agentBriefing: () => ({ agentId: "agent_request_echo" }),
      publicIdentity: () => ({
        identityExists: false,
        generatedAt: "2026-01-01T08:00:00.000Z",
        regionLabel: "黑曜纪元",
        publicPages: { world: "/epoch/world", console: "/epoch/console" },
      }),
      events: () => ({ events: [] }),
    },
    journeyOptions: {
      idFactory: (kind) => `${kind}_unknown_public_boundary`,
      nowReal: () => "2026-07-12T00:00:00.000Z",
      nowWorld: () => "2026-01-01T08:00:00.000Z",
    },
  });

  const briefing = runtime.briefing({ agentId: "agent_request_echo" });
  assert.equal(briefing.identityExists, false);
  assert.equal("agentId" in briefing, false);
  assert.doesNotMatch(JSON.stringify(briefing), /agent_request_echo/);
});
