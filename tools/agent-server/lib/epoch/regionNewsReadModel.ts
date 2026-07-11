import {
  epochWorldSurfaceMediaForKey,
  type EpochWorldSurfaceMedia,
} from "../worldSurfaceAssets.ts";
import type { EpochRegionNews } from "./gameCore.ts";

export interface EpochRegionNewsView extends EpochRegionNews {
  readonly media: EpochWorldSurfaceMedia;
}

function worldSurfaceMedia(surfaceKey: "world_news"): EpochWorldSurfaceMedia {
  const media = epochWorldSurfaceMediaForKey(surfaceKey);
  if (!media) throw new Error(`epoch_world_surface_media_missing:${surfaceKey}`);
  return media;
}

export function withRegionNewsMedia(news: EpochRegionNews): EpochRegionNewsView {
  return {
    ...news,
    media: worldSurfaceMedia("world_news"),
  };
}

export function regionNewsView(news: readonly EpochRegionNews[]): readonly EpochRegionNewsView[] {
  return [...news]
    .filter((item) => item.moderationStatus === "visible")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.newsId.localeCompare(left.newsId))
    .map(withRegionNewsMedia);
}
