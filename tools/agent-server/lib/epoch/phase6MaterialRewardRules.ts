import type { EpochResourceId } from "./protocol.ts";

export interface Phase6JourneyMaterialReward {
  readonly taskFamilyId: "cultivation_material" | "crafting_material";
  readonly resourceId: Extract<
    EpochResourceId,
    "material_cultivation_essence" | "material_forging_alloy"
  >;
  readonly materialId: string;
  readonly materialClass: "cultivation_advancement_material" | "forging_material";
  readonly amount: number;
  readonly usageRefs: readonly {
    readonly system: "cultivation_breakthrough" | "forging";
    readonly targetRef: string;
  }[];
}

const JOURNEY_MATERIAL_REWARDS: Readonly<Record<
  Phase6JourneyMaterialReward["taskFamilyId"],
  Phase6JourneyMaterialReward
>> = {
  cultivation_material: {
    taskFamilyId: "cultivation_material",
    resourceId: "material_cultivation_essence",
    materialId: "cultivation-essence",
    materialClass: "cultivation_advancement_material",
    amount: 1,
    usageRefs: [{
      system: "cultivation_breakthrough",
      targetRef: "cultivation-stage:2",
    }],
  },
  crafting_material: {
    taskFamilyId: "crafting_material",
    resourceId: "material_forging_alloy",
    materialId: "forging-alloy",
    materialClass: "forging_material",
    amount: 1,
    usageRefs: [{
      system: "forging",
      targetRef: "recipe:phase6-field-blade",
    }],
  },
};

export function phase6JourneyMaterialRewardForTaskFamily(
  taskFamilyId: unknown,
): Phase6JourneyMaterialReward | undefined {
  if (taskFamilyId !== "cultivation_material" && taskFamilyId !== "crafting_material") {
    return undefined;
  }
  return JOURNEY_MATERIAL_REWARDS[taskFamilyId];
}

export function phase6JourneyMaterialRewardForResource(
  resourceId: unknown,
): Phase6JourneyMaterialReward | undefined {
  return Object.values(JOURNEY_MATERIAL_REWARDS)
    .find((reward) => reward.resourceId === resourceId);
}
