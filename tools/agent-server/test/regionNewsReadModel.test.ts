import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import type { EpochRegionNews } from "../lib/epoch/gameCore.ts";
import {
  regionNewsView,
  withRegionNewsMedia,
} from "../lib/epoch/regionNewsReadModel.ts";

const modulePath = new URL("../lib/epoch/regionNewsReadModel.ts", import.meta.url);

function news(overrides: Partial<EpochRegionNews> = {}): EpochRegionNews {
  return {
    newsId: "news_1",
    regionId: "region_gray_harbor",
    headline: "灰港风声",
    body: "港口议会确认了新的巡逻路线。",
    legendDelta: 1,
    sourceEventIds: ["event_1"],
    moderationStatus: "visible",
    createdAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

test("region news read model adds server-packaged media", () => {
  assert.ok(existsSync(modulePath), "regionNewsReadModel.ts should own public region news media projection");
  const view = withRegionNewsMedia(news());

  assert.equal(view.media.surfaceKey, "world_news");
  assert.equal(view.newsId, "news_1");
});

test("region news read model filters hidden news and sorts newest first", () => {
  const items = regionNewsView([
    news({ newsId: "old", createdAt: "2026-07-05T00:00:00.000Z" }),
    news({ newsId: "hidden", moderationStatus: "queued", createdAt: "2026-07-07T00:00:00.000Z" }),
    news({ newsId: "new", createdAt: "2026-07-06T00:00:00.000Z" }),
  ]);

  assert.deepEqual(items.map((item) => item.newsId), ["new", "old"]);
  assert.ok(items.every((item) => item.media.surfaceKey === "world_news"));
});
