import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { regionMediaAsset } from "../lib/epoch/regionMediaReadModel.ts";

const modulePath = new URL("../lib/epoch/regionMediaReadModel.ts", import.meta.url);

test("region media read model exposes public location media", () => {
  assert.ok(existsSync(modulePath), "regionMediaReadModel.ts should own public region media projection");
  const media = regionMediaAsset("region_gray_harbor");

  assert.ok(media);
  assert.equal(media.regionId, "region_gray_harbor");
  assert.equal(media.assetPath, "obsidian-epoch/assets/location/region-gray-harbor.png");
  assert.equal(media.imageUrl, "/api/epoch/assets/location/region-gray-harbor.png");
});

test("region media read model returns undefined for unknown regions", () => {
  assert.equal(regionMediaAsset("region_missing"), undefined);
});
