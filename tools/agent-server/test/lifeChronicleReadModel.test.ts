import assert from "node:assert/strict";
import test from "node:test";
import { buildJourneyAlbum } from "../lib/epoch/journeyAlbumReadModel.ts";
import { buildAnnualLifeChronicle, monthlyLifeReports } from "../lib/epoch/lifeChronicleReadModel.ts";
import { createJourneyRuntime } from "../lib/epoch/journeyRuntime.ts";
import { buildPersistedJourneyNarrative, buildServerJourneyEpisodeFacts } from "../lib/epoch/journeyNarrativeRules.ts";
import { buildLineageChronicle } from "../lib/epoch/lineageChronicleReadModel.ts";
import type { EpochAgentIdentity } from "../lib/epoch/gameCore.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";

function yearFixture() {
  let now = "2026-01-05T08:00:00.000Z";
  let sequence = 0;
  const canonicalEpochEvents: EpochEvent[] = [];
  const runtime = createJourneyRuntime({
    idFactory: (kind) => `${kind}_chronicle_${++sequence}`,
    nowReal: () => now,
    nowWorld: () => now,
    defaultRealDurationMs: 1_000,
    defaultWorldDurationMs: 1_000,
    canonicalEpochEvents: () => canonicalEpochEvents,
  });
  const travel = (at: string, title: string, participantId?: string) => {
    now = at;
    const prepared = runtime.prepare({
      agentId: "agent_chronicle",
      explorerId: "explorer_chronicle",
      originRegionId: "region_gray_harbor",
      destinationRegionId: "region_gray_harbor",
      mandate: { objective: title, priorities: ["explore"] },
    });
    const started = runtime.start({ journeyId: prepared.journey.journeyId, expectedVersion: prepared.journey.version });
    const plan = runtime.composeThreePhaseEpisodes(started.journey.journeyId, started.journey.version, {
      identityHistory: { recentEpisodeFingerprints: [] },
      region: { id: "region_gray_harbor", type: "region", label: "灰港", sourceFactIds: ["world:region_gray_harbor"] },
      season: "current",
      resources: {},
      unresolvedClues: [],
      availableWorldObjects: [{
        id: participantId || `place_${sequence}`,
        type: participantId ? "agent" : "location",
        label: participantId ? `同行者 ${participantId}` : title,
        regionId: "region_gray_harbor",
        sourceFactIds: [`fact_${sequence}`],
        participantIds: participantId ? [participantId] : [],
        tags: ["explore"],
      }],
    });
    assert.deepEqual(plan.episodes.map((episode) => episode.phase), ["arrival", "main", "return"]);
    const groundedEpisodes = plan.episodes.map((baseEpisode, index) => {
      const canonicalEventIds = [`canonical_hosted_action_${sequence}_${index + 1}`];
      const outcomeSummary = `${title}的${baseEpisode.phase || "main"}阶段由服务器结算并归档。`;
      const serverFacts = buildServerJourneyEpisodeFacts({
        journeyId: started.journey.journeyId,
        episodeId: baseEpisode.episodeId,
        phase: baseEpisode.phase || "main",
        title: baseEpisode.title,
        agent: { id: "agent_chronicle", displayName: "灯蛾" },
        worldObjectRefs: baseEpisode.worldObjectRefs,
        action: { optionLabel: `完成「${title}」的${baseEpisode.phase || "main"}阶段`, outcomeSummary },
        canonicalEventIds,
      });
      const narrative = buildPersistedJourneyNarrative({ serverFacts }).value;
      const sessionId = `session_${canonicalEventIds[0]}`;
      canonicalEpochEvents.push({
        eventId: `started_${canonicalEventIds[0]}`,
        eventType: "hosted_session_started",
        aggregateType: "hosted_session",
        aggregateId: sessionId,
        actorExplorerId: "explorer_chronicle",
        agentId: "agent_chronicle",
        trustClass: "user_verified_web",
        causationId: baseEpisode.episodeId,
        correlationId: started.journey.correlationId,
        createdAt: now,
        payload: { sessionId, sceneContract: { journeyId: started.journey.journeyId, episodeId: baseEpisode.episodeId } },
      } as unknown as EpochEvent, {
        eventId: canonicalEventIds[0],
        eventType: "hosted_action_recorded",
        aggregateType: "hosted_session",
        aggregateId: sessionId,
        actorExplorerId: "explorer_chronicle",
        agentId: "agent_chronicle",
        trustClass: "user_verified_web",
        causationId: baseEpisode.episodeId,
        correlationId: started.journey.correlationId,
        createdAt: now,
        payload: { sessionId },
      } as unknown as EpochEvent);
      return {
        ...baseEpisode,
        sourceFactIds: [...baseEpisode.sourceFactIds, ...canonicalEventIds],
        settlement: { canonicalEventIds, outcomeSummary },
        serverFacts,
        narrative,
      };
    });
    const arrived = runtime.commitEpisodes(started.journey.journeyId, started.journey.version, [groundedEpisodes[0]]);
    const awaitingAgent = runtime.awaitAgent(arrived.journey.journeyId, arrived.journey.version);
    const mainCommitted = runtime.commitEpisodes(awaitingAgent.journey.journeyId, awaitingAgent.journey.version, [groundedEpisodes[1]]);
    const returning = runtime.beginReturn(mainCommitted.journey.journeyId, mainCommitted.journey.version);
    runtime.commitEpisodes(returning.journey.journeyId, returning.journey.version, [groundedEpisodes[2]]);
    const current = runtime.status(started.journey.journeyId);
    runtime.linkVerification({
      journeyId: current.journey.journeyId,
      expectedVersion: current.journey.version,
      pageId: `page_${current.journey.journeyId}`,
      urlPath: `/epoch/result/${encodeURIComponent(`page_${current.journey.journeyId}`)}?shareToken=public&shareVersion=1`,
      createdAt: at,
    });
    now = new Date(Date.parse(at) + 2_000).toISOString();
    runtime.tick();
  };
  travel("2026-01-05T08:00:00.000Z", "第一次去灰港找活", "agent_neighbor");
  travel("2026-06-12T10:00:00.000Z", "雨季档案馆差事");
  travel("2026-12-20T18:00:00.000Z", "年末盐雾巡查", "agent_neighbor");
  return runtime.projection();
}

test("journey album indexes three verified phases for every journey by world time", () => {
  const album = buildJourneyAlbum(yearFixture(), "agent_chronicle");
  assert.equal(album.journeys.length, 3);
  assert.equal(album.postcards.length, 9);
  assert.ok(album.postcards.every((postcard) => postcard.verificationUrl?.includes("#episode-")));
  assert.ok(album.postcards.every((postcard) => postcard.sourceEventIds.length >= 2));
});

test("album excludes legacy episodes that have no canonical server fact boundary", () => {
  const projection = yearFixture();
  const firstEpisodeId = Object.keys(projection.episodes)[0];
  assert.ok(firstEpisodeId);
  const firstEpisode = projection.episodes[firstEpisodeId];
  assert.ok(firstEpisode);
  const { serverFacts: _serverFacts, narrative: _narrative, ...ungroundedEpisode } = firstEpisode;
  const album = buildJourneyAlbum({
    ...projection,
    episodes: { ...projection.episodes, [firstEpisodeId]: ungroundedEpisode },
  }, "agent_chronicle");
  assert.equal(album.postcards.length, 8);
  assert.equal(album.postcards.some((postcard) => postcard.episodeId === firstEpisodeId), false);
});

test("monthly reports preserve quiet months instead of inventing experiences", () => {
  const reports = monthlyLifeReports({ agentId: "agent_chronicle", year: 2026, projection: yearFixture() });
  assert.equal(reports.length, 12);
  assert.equal(reports[0].postcardIds.length, 3);
  assert.equal(reports[5].postcardIds.length, 3);
  assert.equal(reports[11].postcardIds.length, 3);
  assert.match(reports[1].paragraphs[0].text, /不会用模型补写空白/);
  assert.deepEqual(reports[1].paragraphs[0].sourceEventIds, []);
});

test("annual chronicle becomes a complete twelve-chapter story only after the server year closes", () => {
  const projection = yearFixture();
  const pending = buildAnnualLifeChronicle({
    agentId: "agent_chronicle",
    identityName: "灯蛾",
    identityStartedAtWorldTime: "2026-01-01T00:00:00.000Z",
    year: 2026,
    nowWorld: "2026-12-31T23:59:59.000Z",
    projection,
  });
  assert.equal(pending.status, "not_ready");
  assert.equal(pending.reason, "year_not_complete");

  const chronicle = buildAnnualLifeChronicle({
    agentId: "agent_chronicle",
    identityName: "灯蛾",
    identityStartedAtWorldTime: "2026-01-01T00:00:00.000Z",
    year: 2026,
    nowWorld: "2027-01-01T00:00:00.000Z",
    projection,
  });
  assert.equal(chronicle.status, "ready");
  assert.equal(chronicle.chapters?.length, 12);
  assert.match(chronicle.narrative || "", /2026年 · 灯蛾的一整年/);
  assert.match(chronicle.narrative || "", /一月[\s\S]*六月[\s\S]*十二月/);
  assert.match(chronicle.narrative || "", /第一次去灰港找活/);
  assert.match(chronicle.narrative || "", /没有可由服务器事件汇总的经历/);
  assert.ok((chronicle.narrative?.length || 0) > 900);
  assert.ok((chronicle.sourceEventIds?.length || 0) >= 3);
});

test("an identity that began midyear cannot claim a complete year", () => {
  const chronicle = buildAnnualLifeChronicle({
    agentId: "agent_chronicle",
    identityName: "灯蛾",
    identityStartedAtWorldTime: "2026-03-01T00:00:00.000Z",
    year: 2026,
    nowWorld: "2027-02-01T00:00:00.000Z",
    projection: yearFixture(),
  });
  assert.equal(chronicle.status, "not_ready");
  assert.equal(chronicle.reason, "identity_started_after_year_open");
});

test("lineage chronicle joins archived generations to grounded Journey provenance", () => {
  const identities = [
    {
      agentId: "agent_chronicle",
      explorerId: "explorer_chronicle",
      identityName: "灯蛾",
      generation: 1,
      status: "archived",
      nextAgentId: "agent_chronicle_2",
      lifetime: {
        max: 100,
        remaining: 0,
        startedAt: "2026-01-01T00:00:00.000Z",
        archivedAt: "2027-01-02T00:00:00.000Z",
        finalTitle: "灰港记事者",
      },
      personality: { traits: [], driftIds: [] },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      agentId: "agent_chronicle_2",
      explorerId: "explorer_chronicle",
      identityName: "潮灯",
      generation: 2,
      status: "active",
      previousAgentId: "agent_chronicle",
      lifetime: { max: 100, remaining: 100, startedAt: "2027-01-02T00:01:00.000Z" },
      personality: { traits: [], driftIds: [] },
      createdAt: "2027-01-02T00:01:00.000Z",
    },
  ] as const satisfies readonly EpochAgentIdentity[];
  const chronicle = buildLineageChronicle({
    explorerId: "explorer_chronicle",
    identities,
    projection: yearFixture(),
    lifecycleEventsByAgent: {
      agent_chronicle: [
        { eventId: "event_identity_1", eventType: "identity_issued", createdAt: "2026-01-01T00:00:00.000Z" },
        { eventId: "event_archive_1", eventType: "identity_archived", createdAt: "2027-01-02T00:00:00.000Z" },
        { eventId: "event_reincarnation_1", eventType: "reincarnation_issued", createdAt: "2027-01-02T00:01:00.000Z" },
      ],
      agent_chronicle_2: [
        { eventId: "event_identity_2", eventType: "identity_issued", createdAt: "2027-01-02T00:01:00.000Z" },
      ],
    },
  });
  assert.equal(chronicle.generations.length, 2);
  assert.equal(chronicle.generations[0].postcardIds.length, 9);
  assert.equal(chronicle.generations[1].postcardIds.length, 0);
  assert.match(chronicle.generations[0].narrative, /第 1 世「灯蛾」.*3 次可验证旅程、9 张事实明信片.*灰港记事者/);
  assert.deepEqual(chronicle.transitions, [{
    fromAgentId: "agent_chronicle",
    toAgentId: "agent_chronicle_2",
    sourceEventIds: ["event_archive_1", "event_reincarnation_1"],
  }]);
  assert.ok(chronicle.sourceEventIds.some((eventId) => eventId.startsWith("canonical_hosted_action_")));
  assert.ok(chronicle.sourceEventIds.includes("event_reincarnation_1"));
});
