import { epochItemMediaForKey, type EpochItemMedia } from "../itemAssets.ts";
import {
  epochShopOffersForRegion,
  type EpochShopOffer,
} from "./inventoryRules.ts";

export interface EpochShopOfferInfo extends EpochShopOffer {
  readonly media?: EpochItemMedia;
}

export function shopOffersView(regionId?: string): readonly EpochShopOfferInfo[] {
  return epochShopOffersForRegion(regionId).map((offer): EpochShopOfferInfo => {
    const media = epochItemMediaForKey(offer.itemKey);
    return media ? { ...offer, media } : offer;
  });
}
