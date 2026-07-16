import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAgentRegionSnapshot,
  createAgentRegionSnapshot,
} from "./agentRegionController";
import type {
  EpochAnomalyEvent,
  EpochContestedObjective,
  EpochDiplomacyRecord,
  EpochMessageRecord,
  EpochRegionInfo,
  EpochResourceNode,
  EpochSeasonCampaign,
} from "../types";

function regionInfo(input: {
  readonly messages?: readonly EpochMessageRecord[];
  readonly objectives?: readonly EpochContestedObjective[];
  readonly resourceNodes?: readonly EpochResourceNode[];
  readonly anomalies?: readonly EpochAnomalyEvent[];
  readonly seasons?: readonly EpochSeasonCampaign[];
  readonly diplomacy?: readonly EpochDiplomacyRecord[];
} = {}): EpochRegionInfo {
  return {
    regionId: "region_gray_harbor",
    messages: input.messages || [],
    objectives: input.objectives || [],
    resourceNodes: input.resourceNodes || [],
    anomalies: input.anomalies || [],
    seasons: input.seasons || [],
    diplomacy: input.diplomacy || [],
  } as unknown as EpochRegionInfo;
}

function message(messageId: string): EpochMessageRecord {
  return { messageId } as unknown as EpochMessageRecord;
}

test("createAgentRegionSnapshot mirrors the canonical region slices", () => {
  const objectives = [{ objectiveId: "objective_1" }] as unknown as readonly EpochContestedObjective[];
  const resourceNodes = [{ nodeId: "node_1" }] as unknown as readonly EpochResourceNode[];
  const anomalies = [{ anomalyId: "anomaly_1" }] as unknown as readonly EpochAnomalyEvent[];
  const seasons = [{ seasonId: "season_1" }] as unknown as readonly EpochSeasonCampaign[];
  const diplomacy = [{ diplomacyId: "diplomacy_1" }] as unknown as readonly EpochDiplomacyRecord[];
  const messages = [message("message_region")];
  const snapshot = createAgentRegionSnapshot(regionInfo({
    messages,
    objectives,
    resourceNodes,
    anomalies,
    seasons,
    diplomacy,
  }));

  assert.equal(snapshot.region.messages, messages);
  assert.equal(snapshot.regionMessages, messages);
  assert.equal(snapshot.objectives, objectives);
  assert.equal(snapshot.resourceNodes, resourceNodes);
  assert.equal(snapshot.anomalies, anomalies);
  assert.equal(snapshot.seasons, seasons);
  assert.equal(snapshot.diplomacy, diplomacy);
});

test("createAgentRegionSnapshot keeps fetched messages aligned with the region object", () => {
  const regionMessages = [message("message_region")];
  const fetchedMessages = [message("message_fetched")];
  const snapshot = createAgentRegionSnapshot(regionInfo({ messages: regionMessages }), {
    messages: fetchedMessages,
  });

  assert.notEqual(snapshot.region.messages, regionMessages);
  assert.equal(snapshot.region.messages, fetchedMessages);
  assert.equal(snapshot.regionMessages, fetchedMessages);
});

test("createAgentRegionSnapshot keeps explicit slice overrides aligned with the region object", () => {
  const regionResourceNodes = [{ nodeId: "node_region" }] as unknown as readonly EpochResourceNode[];
  const fetchedResourceNodes = [{ nodeId: "node_fetched" }] as unknown as readonly EpochResourceNode[];
  const regionAnomalies = [{ anomalyId: "anomaly_region" }] as unknown as readonly EpochAnomalyEvent[];
  const fetchedAnomalies = [{ anomalyId: "anomaly_fetched" }] as unknown as readonly EpochAnomalyEvent[];
  const regionSeasons = [{ seasonId: "season_region" }] as unknown as readonly EpochSeasonCampaign[];
  const fetchedSeasons = [{ seasonId: "season_fetched" }] as unknown as readonly EpochSeasonCampaign[];
  const regionDiplomacy = [{ diplomacyId: "diplomacy_region" }] as unknown as readonly EpochDiplomacyRecord[];
  const fetchedDiplomacy = [{ diplomacyId: "diplomacy_fetched" }] as unknown as readonly EpochDiplomacyRecord[];
  const snapshot = createAgentRegionSnapshot(regionInfo({
    resourceNodes: regionResourceNodes,
    anomalies: regionAnomalies,
    seasons: regionSeasons,
    diplomacy: regionDiplomacy,
  }), {
    resourceNodes: fetchedResourceNodes,
    anomalies: fetchedAnomalies,
    seasons: fetchedSeasons,
    diplomacy: fetchedDiplomacy,
  });

  assert.equal(snapshot.region.resourceNodes, fetchedResourceNodes);
  assert.equal(snapshot.resourceNodes, fetchedResourceNodes);
  assert.equal(snapshot.region.anomalies, fetchedAnomalies);
  assert.equal(snapshot.anomalies, fetchedAnomalies);
  assert.equal(snapshot.region.seasons, fetchedSeasons);
  assert.equal(snapshot.seasons, fetchedSeasons);
  assert.equal(snapshot.region.diplomacy, fetchedDiplomacy);
  assert.equal(snapshot.diplomacy, fetchedDiplomacy);
});

test("applyAgentRegionSnapshot commits every full-region slice together", () => {
  const committed: string[] = [];
  const snapshot = createAgentRegionSnapshot(regionInfo({
    messages: [message("message_1")],
    objectives: [{ objectiveId: "objective_1" }] as unknown as readonly EpochContestedObjective[],
    resourceNodes: [{ nodeId: "node_1" }] as unknown as readonly EpochResourceNode[],
    anomalies: [{ anomalyId: "anomaly_1" }] as unknown as readonly EpochAnomalyEvent[],
    seasons: [{ seasonId: "season_1" }] as unknown as readonly EpochSeasonCampaign[],
  }));

  applyAgentRegionSnapshot(snapshot, {
    setRegion: () => committed.push("region"),
    setRegionMessages: () => committed.push("messages"),
    setObjectives: () => committed.push("objectives"),
    setResourceNodes: () => committed.push("resourceNodes"),
    setAnomalies: () => committed.push("anomalies"),
    setSeasons: () => committed.push("seasons"),
  });

  assert.deepEqual(committed, ["region", "messages", "objectives", "resourceNodes", "anomalies", "seasons"]);
});
