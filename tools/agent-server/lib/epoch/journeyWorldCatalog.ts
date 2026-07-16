import { createHash } from "node:crypto";
import type { JourneyAvailableWorldObject } from "./journeySceneRules.ts";
import { journeyTaskRouteForRegion } from "./journeyTaskCatalog.ts";

const NPC_FAMILY_NAMES = [
  "林", "陆", "沈", "秦", "叶", "顾", "苏", "温", "裴", "程", "闻", "岑", "白", "黎", "唐", "许",
] as const;
const NPC_GIVEN_NAMES = [
  "澈", "遥", "砚", "宁", "朔", "弦", "衡", "栖", "岚", "棠", "昭", "临", "青", "辛", "越", "禾",
] as const;

function taskCastRoles(taskType: string): readonly string[] {
  if (/实验|研究|样本|校准/u.test(taskType)) return ["现场研究员", "实验安全员", "数据记录员"];
  if (/试炼|入门|考核/u.test(taskType)) return ["试炼教官", "同批候补", "医务观察员"];
  if (/猎杀|变异兽|狩猎|城外/u.test(taskType)) return ["城防猎队长", "荒野向导", "赏金核验员"];
  if (/护送|补给|运输/u.test(taskType)) return ["补给调度员", "车队领航员", "交接核验员"];
  if (/调查|侦查|遗迹|探索/u.test(taskType)) return ["现场调查员", "路径测绘员", "遗物鉴别员"];
  return ["现场负责人", "执行协助员", "结果核验员"];
}

/** Journey-scoped server cast. The IDs and names are stable inside one run and change between runs. */
export function journeyScopedNpcObjects(input: {
  readonly journeyId: string;
  readonly regionId: string;
  readonly taskType: string;
}): readonly JourneyAvailableWorldObject[] {
  const digest = createHash("sha256")
    .update(`${input.journeyId}:${input.regionId}:${input.taskType}`)
    .digest();
  const roles = taskCastRoles(input.taskType);
  return roles.map((role, index) => {
    const family = NPC_FAMILY_NAMES[(digest[index]! + index) % NPC_FAMILY_NAMES.length]!;
    const given = NPC_GIVEN_NAMES[(digest[index + 8]! + index * 3) % NPC_GIVEN_NAMES.length]!;
    const idSuffix = createHash("sha256")
      .update(`${input.journeyId}:${index}`)
      .digest("hex")
      .slice(0, 16);
    const id = `npc_journey_${idSuffix}`;
    return {
      id,
      type: "npc",
      label: `${role}${family}${given}`,
      regionId: input.regionId,
      sourceFactIds: [`journey:cast:${input.journeyId}:${index + 1}`],
      participantIds: [id],
      tags: ["npc", "journey_scoped_cast", `cast_slot_${index + 1}`],
    };
  });
}

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
  if (regionId === "region_gray_harbor") return GRAY_HARBOR_LIVELIHOOD_WORLD_OBJECTS;
  return journeyTaskRouteForRegion(regionId)?.worldObjects ?? [];
}
