import assert from "node:assert/strict";
import test from "node:test";
import type { EpochEvent } from "../types";
import {
  AGENT_WORLD_TOOLS,
  DOWNTIME_OPTIONS,
  EPOCH_TOOLS,
  PLAYER_DOWNTIME_OPTIONS,
  PLAYER_RESOURCE_CAPTIONS,
  PLAYER_RESOURCE_LABELS,
  playerActionLabel,
  playerAgentLabel,
  playerChannelClassLabel,
  playerCommonStatusLabel,
  playerDowntimeLabel,
  playerEventLabel,
  playerEventTypeLabel,
  playerFactionLabel,
  playerHostedStatusLabel,
  playerIdentityStatusLabel,
  playerExplorerLabel,
  playerLoreAdjudicationStatusLabel,
  playerLoreContributionCategoryLabel,
  playerPublicSummaryText,
  playerRegionLabel,
  playerRelationshipKindLabel,
  playerRecordLabel,
  playerResourceCaption,
  playerResourceLabel,
  playerSecretTierLabel,
  playerSourceTypeLabel,
  playerToolLabel,
  playerTrustClassLabel,
} from "./agentPlayerLabels";

test("player label helpers translate known world ids and preserve readable fallbacks", () => {
  assert.equal(playerRegionLabel("region_gray_harbor"), "灰港");
  assert.equal(playerRegionLabel("region_shadow_port"), "shadow port");
  assert.equal(playerRegionLabel(null), "世界");

  assert.equal(playerFactionLabel("gray_watch"), "灰港守望会");
  assert.equal(playerFactionLabel("faction_new_circle"), "new circle");
  assert.equal(playerFactionLabel(undefined), "待定");
});

test("player label helpers translate action event source and status enums", () => {
  const event: EpochEvent = {
    eventId: "epoch_event_test",
    eventType: "resource_granted",
    aggregateType: "agent",
    aggregateId: "agent_1",
    actorExplorerId: "explorer_1",
    agentId: "agent_1",
    trustClass: "server_settled",
    causationId: "cause_1",
    correlationId: "corr_1",
    createdAt: "2026-07-07T00:00:00.000Z",
    payload: {},
  };

  assert.equal(playerEventLabel(event), "收获入账");
  assert.equal(playerEventTypeLabel("resource_granted"), "收获入账");
  assert.equal(playerEventTypeLabel("custom_event"), "事件记录");
  assert.equal(playerSourceTypeLabel("social_hook"), "人物事件");
  assert.equal(playerSourceTypeLabel("unknown_source"), "来源记录");
  assert.equal(playerActionLabel("complete-exploration"), "完整探索");
  assert.equal(playerActionLabel("world_message"), "世界发言");
  assert.equal(playerActionLabel("unknown_internal_action"), "操作");
  assert.equal(playerRelationshipKindLabel("alliance"), "结盟");
  assert.equal(playerRelationshipKindLabel("unknown_kind"), "关系");
  assert.equal(playerIdentityStatusLabel("active"), "可行动");
  assert.equal(playerHostedStatusLabel("queued"), "排队中");
  assert.equal(playerLoreAdjudicationStatusLabel("confirmed"), "确认");
  assert.equal(playerLoreAdjudicationStatusLabel("unknown_status"), "待确认");
  assert.equal(playerLoreContributionCategoryLabel("refutation"), "反驳");
  assert.equal(playerLoreContributionCategoryLabel("unknown_category"), "设定贡献");
  assert.equal(playerSecretTierLabel("T2_local_secret"), "隐藏线索");
  assert.equal(playerTrustClassLabel("user_verified_web"), "玩家确认");
  assert.equal(playerChannelClassLabel("browser_copy_paste"), "网页复制提交");
  assert.equal(playerCommonStatusLabel("completed"), "已完成");
  assert.equal(playerAgentLabel("epoch_agent_install_smoke_runner"), "身份 runner");
  assert.equal(playerExplorerLabel("explorer_gray_harbor_001"), "玩家 bor001");
  assert.equal(playerRecordLabel("epoch_event_000004", "校验记录"), "校验记录 000004");
  assert.equal(playerAgentLabel(""), "身份未记录");
});

test("player label helpers keep tool and downtime labels in one shared catalog", () => {
  assert.ok(AGENT_WORLD_TOOLS.length > 0);
  assert.ok(EPOCH_TOOLS.length > 0);
  assert.equal(playerToolLabel("agent_world.context_package"), "上下文");
  assert.equal(playerToolLabel("obsidian_epoch.progress"), "进度");
  assert.equal(playerToolLabel("progress"), "进度");
  assert.equal(playerToolLabel("unknown_tool"), "unknown tool");

  assert.equal(playerDowntimeLabel("steward"), "看店");
  assert.equal(DOWNTIME_OPTIONS.find((option) => option.value === "meditation")?.label, "冥想");
  assert.equal(PLAYER_DOWNTIME_OPTIONS.find((option) => option.value === "meditation")?.label, "冥想 +专注点");
  assert.equal(PLAYER_RESOURCE_LABELS.focus, "专注点");
  assert.match(PLAYER_RESOURCE_CAPTIONS.focus, /行动注意力/);
  assert.equal(playerResourceLabel("focus"), "专注点");
  assert.match(playerResourceCaption("focus"), /推进探索/);
});

test("playerPublicSummaryText removes raw ids hashes and smoke-runner wording", () => {
  const text = playerPublicSummaryText(
    "Gray Harbor events 3 region_gray_harbor Install Smoke Runner sha256:abcdef012345 服务器可校验",
  );

  assert.match(text, /灰港/);
  assert.match(text, /可校验记录 3 条/);
  assert.match(text, /安装验收身份/);
  assert.match(text, /校验码已记录/);
  assert.doesNotMatch(text, /region_gray_harbor|Gray Harbor|Install Smoke Runner|sha256:abcdef012345/);
});
