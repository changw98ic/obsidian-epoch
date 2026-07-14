import type { JourneyAvailableWorldObject } from "./journeySceneRules.ts";

export const GRAY_HARBOR_LIVELIHOOD_WORLD_OBJECTS: readonly JourneyAvailableWorldObject[] = [
  {
    id: "location_gray_harbor_civic_ledger",
    type: "workplace",
    label: "灰港民务账房",
    regionId: "region_gray_harbor",
    sourceFactIds: ["world:catalog:gray_harbor:civic_ledger"],
    tags: ["livelihood", "workplace", "bookkeeping"],
  },
  {
    id: "organization_gray_harbor_civic_office",
    type: "organization",
    label: "灰港民务所",
    regionId: "region_gray_harbor",
    sourceFactIds: ["world:catalog:gray_harbor:civic_office"],
    tags: ["livelihood", "employer", "public_service"],
  },
  {
    id: "npc_night_clerk_kelan",
    type: "npc",
    label: "夜班书记珂岚",
    regionId: "region_gray_harbor",
    sourceFactIds: ["world:catalog:gray_harbor:kelan_on_shift"],
    participantIds: ["npc_night_clerk_kelan"],
    tags: ["clerk", "reliable", "bookkeeping"],
  },
  {
    id: "document_gray_harbor_salt_ledger",
    type: "document",
    label: "灰港盐票账册",
    regionId: "region_gray_harbor",
    sourceFactIds: ["world:catalog:gray_harbor:salt_ledger"],
    tags: ["salt_ledger", "bookkeeping"],
  },
  {
    id: "document_gray_harbor_medicine_manifest",
    type: "document",
    label: "药品运送清单",
    regionId: "region_gray_harbor",
    sourceFactIds: ["world:catalog:gray_harbor:medicine_manifest"],
    tags: ["medicine_manifest", "cargo_manifest"],
  },
];

export function journeyWorldCatalogForRegion(regionId: string): readonly JourneyAvailableWorldObject[] {
  return regionId === "region_gray_harbor" ? GRAY_HARBOR_LIVELIHOOD_WORLD_OBJECTS : [];
}
