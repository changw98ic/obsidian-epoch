import assert from "node:assert/strict";
import test from "node:test";

import {
  anomalyBossTemplateKeyForSeed,
  anomalyEventInputFromOperatorInput,
  anomalyEventInputFromTemplate,
  anomalyEventTemplateCatalog,
  anomalyTemplateKeyFromInput,
} from "../lib/epoch/anomalyEventTemplateRules.ts";

test("anomaly template catalog exposes server-authored boss metadata", () => {
  const catalog = anomalyEventTemplateCatalog();
  const obsidian = catalog.find((template) => template.key === "obsidian_wyrm_boss");

  assert.ok(obsidian);
  assert.equal(obsidian.title, "黑曜裂隙兽");
  assert.equal(obsidian.severity, "major");
  assert.equal(obsidian.targetScore, 18);
  assert.equal(obsidian.reward.resourceId, "legend");
  assert.equal(obsidian.media?.assetPath, "obsidian-epoch/assets/boss/obsidian-wyrm-boss.png");
  assert.equal(obsidian.media?.imageUrl, "/api/epoch/assets/boss/obsidian-wyrm-boss.png");
});

test("anomaly template input chooses deterministic boss templates and narrative variants", () => {
  const seed = "region_gray_harbor:maintenance:2026-07-08";
  const templateKey = anomalyBossTemplateKeyForSeed(seed);

  assert.equal(anomalyBossTemplateKeyForSeed(seed), templateKey);
  assert.notEqual(templateKey, "gray_harbor_minor_rift");
  assert.equal(anomalyTemplateKeyFromInput({ anomalyTemplateRotationSeed: seed }), templateKey);

  const fromTemplate = anomalyEventInputFromTemplate("region_gray_harbor", {
    anomalyTemplateRotationSeed: seed,
    anomalyNarrativeVariantSeed: "fixed-variant",
  });
  const repeated = anomalyEventInputFromTemplate("region_gray_harbor", {
    anomalyTemplateRotationSeed: seed,
    anomalyNarrativeVariantSeed: "fixed-variant",
  });

  assert.equal(fromTemplate.regionId, "region_gray_harbor");
  assert.equal(fromTemplate.title, repeated.title);
  assert.equal(fromTemplate.description, repeated.description);
  assert.ok(fromTemplate.description?.includes("服务器") || fromTemplate.description?.includes("区域"));
  const imageUrl = fromTemplate.media?.imageUrl;
  if (typeof imageUrl !== "string") throw new Error("boss_image_url_missing");
  assert.ok(imageUrl.startsWith("/api/epoch/assets/boss/"));
});

test("operator anomaly input preserves manual overrides and defaults", () => {
  const custom = anomalyEventInputFromOperatorInput({
    title: "人工异常",
    description: "由管理员手动发布的异常。",
    severity: "major",
    targetScore: 9,
    resourceId: "legend",
    rewardAmount: 4,
    rewardReason: "manual_anomaly",
    lifetimeRisk: 2,
  }, "region_black_archive");

  assert.equal(custom.regionId, "region_black_archive");
  assert.equal(custom.title, "人工异常");
  assert.equal(custom.description, "由管理员手动发布的异常。");
  assert.equal(custom.severity, "major");
  assert.equal(custom.targetScore, 9);
  assert.deepEqual(custom.reward, {
    resourceId: "legend",
    amount: 4,
    reason: "manual_anomaly",
  });
  assert.equal(custom.lifetimeRisk, 2);

  const fallback = anomalyEventInputFromOperatorInput({}, "region_gray_harbor");
  assert.equal(fallback.title, "灰港低阶裂隙");
  assert.equal(fallback.reward.resourceId, "aether");
  assert.equal(fallback.targetScore, 6);
});

test("operator anomaly input delegates template requests to server templates", () => {
  const templated = anomalyEventInputFromOperatorInput({
    templateKey: "unknown-template",
  }, "region_gray_harbor");

  assert.equal(templated.regionId, "region_gray_harbor");
  assert.equal(templated.title, "灰港低阶裂隙");
  assert.equal(templated.reward.reason, "anomaly_contained");
});
