import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  shopOffersView,
} from "../lib/epoch/shopReadModel.ts";

const modulePath = new URL("../lib/epoch/shopReadModel.ts", import.meta.url);

test("shop read model attaches item media to public offers", () => {
  assert.ok(existsSync(modulePath), "shopReadModel.ts should own public shop offer media projection");
  const offers = shopOffersView("region_gray_harbor");
  const rationPack = offers.find((offer) => offer.offerId === "gray-ration-pack");

  assert.ok(rationPack);
  assert.equal(rationPack.media?.itemKey, "shop:gray-ration-pack");
  assert.equal(rationPack.media?.imageUrl, "/api/epoch/assets/item/gray-ration-pack.png");
});

test("shop read model preserves regional pricing from inventory rules", () => {
  const offers = shopOffersView("region_ash_outpost");
  const rationPack = offers.find((offer) => offer.offerId === "gray-ration-pack");

  assert.ok(rationPack);
  assert.equal(rationPack.priceRegionId, "region_ash_outpost");
  assert.deepEqual(rationPack.costs, [{ resourceId: "coin", amount: 4 }]);
  assert.equal(rationPack.baseCosts?.[0]?.amount, 3);
});
