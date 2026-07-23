import type {
  CausalResourcePolicy,
  CausalResourcePolicyCheckInput,
} from "./causalResourceRules.ts";

export type CausalResourceDomain =
  | "economy"
  | "progression"
  | "supernatural"
  | "resource_production"
  | "life_profile"
  | "governance"
  | "ecology";
export type CausalResourceFlow = "source" | "sink";

export interface CausalResourceCatalogEntry {
  readonly ref: string;
  readonly flow: CausalResourceFlow;
  readonly domain: CausalResourceDomain;
  readonly resourceKeys?: readonly string[];
  readonly resourceKeyPrefixes?: readonly string[];
  readonly eventTypes?: readonly string[];
  readonly commandTypes?: readonly string[];
  readonly operations?: readonly string[];
  readonly requiresSourceEventIds?: boolean;
  readonly prefixMatch?: boolean;
}

export const CAUSAL_RESOURCE_SOURCE_REFS = {
  verifiedActionEvidence: "source:verified_action_evidence",
  missionReward: "source:mission_reward",
  runReward: "reward:run",
  recipeVerifiedTransform: "source:recipe_verified_transform",
  resourceNodeRegistration: "source:resource_node_registration",
  resourceNodeReplenish: "source:resource_node_replenish",
  lifeProfileInitialBalance: "source:life_profile_initial_balance",
  ecologyRegeneration: "ecology:regeneration",
} as const;

export const CAUSAL_RESOURCE_SINK_REFS = {
  crafting: "crafting",
  breakthroughRitual: "sink:breakthrough_ritual",
  skillAdvancement: "sink:skill_advancement",
  skillTreeAllocation: "sink:skill_tree_allocation",
  skillRespec: "sink:skill_respec",
  crossTraditionRespec: "sink:cross_tradition_respec",
  recipeVerifiedTransform: "sink:recipe_verified_transform",
  repairMaterial: "sink:repair_material",
  legacyProjectMaintenance: "sink:legacy_project_maintenance",
  projectMaintenance: "project_maintenance",
  projectMaintenanceSink: "sink:project_maintenance",
  supernaturalCostPrefix: "sink:supernatural_cost:",
  governanceCostPrefix: "governance_cost:",
  ecologyExtractionOrLoss: "ecology:extraction_or_loss",
} as const;

const PROGRESSION_COMMANDS = [
  "progression_reward",
  "progression_breakthrough",
  "progression_talent",
  "progression_skill",
  "progression_carry",
  "progression_attribute_evidence",
  "progression_respec",
  "progression.attribute_evidence_recorded",
  "progression.functional_stage_advanced",
  "progression.skill_node_unlocked",
  "progression.skill_node_respecced",
  "progression.run_reward_converted",
] as const;

const ECONOMY_COMMANDS = [
  "economy_buy",
  "economy_sell",
  "economy_craft",
  "economy_repair",
  "economy.purchase",
  "economy.sell",
  "economy.craft",
  "economy.repair",
] as const;

const SUPERNATURAL_COMMANDS = [
  "supernatural_cast",
  "project_tick",
  "supernatural.cast_committed",
  "supernatural.legacy_project_advanced",
] as const;

const RESOURCE_PRODUCTION_COMMANDS = [
  "resource_node_register",
  "resource_node_replenish",
] as const;

const LIFE_PROFILE_COMMANDS = [
  "life_profile_create",
  "life_profile_advance",
] as const;

const GOVERNANCE_COMMANDS = [
  "governance_action",
  "governance.action_committed",
] as const;

const ECOLOGY_COMMANDS = [
  "world_tick",
  "ecology_tick_resolved",
] as const;

export const DEFAULT_CAUSAL_RESOURCE_CATALOG: readonly CausalResourceCatalogEntry[] = [
  {
    ref: CAUSAL_RESOURCE_SOURCE_REFS.verifiedActionEvidence,
    flow: "source",
    domain: "progression",
    resourceKeyPrefixes: ["attribute_evidence."],
    eventTypes: ["resource_granted", "progression_change_committed"],
    operations: ["grant_evidence"],
    requiresSourceEventIds: true,
  },
  {
    ref: CAUSAL_RESOURCE_SOURCE_REFS.missionReward,
    flow: "source",
    domain: "progression",
    resourceKeys: ["functional_xp", "insight_points"],
    resourceKeyPrefixes: ["material."],
    eventTypes: ["resource_granted", "progression_change_committed", "mission_outcome_settled"],
    operations: [
      "grant_functional_xp_from_run_evidence",
      "grant_insight_from_run_evidence",
      "grant_retained_material",
    ],
    requiresSourceEventIds: true,
  },
  {
    ref: CAUSAL_RESOURCE_SOURCE_REFS.runReward,
    flow: "source",
    domain: "progression",
    resourceKeys: ["functional_xp", "insight_points"],
    resourceKeyPrefixes: ["material."],
    eventTypes: ["resource_granted", "progression_change_committed"],
    operations: [
      "grant_functional_xp_from_run_evidence",
      "grant_insight_from_run_evidence",
      "grant_retained_material",
    ],
    requiresSourceEventIds: true,
  },
  {
    ref: CAUSAL_RESOURCE_SOURCE_REFS.recipeVerifiedTransform,
    flow: "source",
    domain: "economy",
    commandTypes: ECONOMY_COMMANDS,
    operations: ["craft"],
  },
  {
    ref: CAUSAL_RESOURCE_SOURCE_REFS.resourceNodeRegistration,
    flow: "source",
    domain: "resource_production",
    commandTypes: RESOURCE_PRODUCTION_COMMANDS,
    operations: ["resource_node_register"],
  },
  {
    ref: CAUSAL_RESOURCE_SOURCE_REFS.resourceNodeReplenish,
    flow: "source",
    domain: "resource_production",
    commandTypes: RESOURCE_PRODUCTION_COMMANDS,
    operations: ["resource_node_replenish"],
  },
  {
    ref: CAUSAL_RESOURCE_SOURCE_REFS.lifeProfileInitialBalance,
    flow: "source",
    domain: "life_profile",
    resourceKeys: ["money", "food", "water", "tuition_credit", "skill_material"],
    commandTypes: LIFE_PROFILE_COMMANDS,
    operations: ["life_profile_initial_balance"],
  },
  {
    ref: CAUSAL_RESOURCE_SOURCE_REFS.ecologyRegeneration,
    flow: "source",
    domain: "ecology",
    resourceKeys: ["ecology_stock", "water", "grain"],
    eventTypes: ["ecology_tick_resolved"],
    commandTypes: ECOLOGY_COMMANDS,
    operations: ["ecology_stock_tick"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.recipeVerifiedTransform,
    flow: "sink",
    domain: "economy",
    commandTypes: ECONOMY_COMMANDS,
    operations: ["craft"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.crafting,
    flow: "sink",
    domain: "economy",
    commandTypes: ECONOMY_COMMANDS,
    operations: ["craft"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.repairMaterial,
    flow: "sink",
    domain: "economy",
    commandTypes: ECONOMY_COMMANDS,
    operations: ["repair"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.breakthroughRitual,
    flow: "sink",
    domain: "progression",
    resourceKeyPrefixes: ["material."],
    commandTypes: PROGRESSION_COMMANDS,
    operations: ["consume_breakthrough_material"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.skillAdvancement,
    flow: "sink",
    domain: "progression",
    resourceKeyPrefixes: ["material."],
    commandTypes: PROGRESSION_COMMANDS,
    operations: ["consume_skill_material"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.skillTreeAllocation,
    flow: "sink",
    domain: "progression",
    resourceKeys: ["skill_points"],
    commandTypes: PROGRESSION_COMMANDS,
    operations: ["allocate_skill_points"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.skillRespec,
    flow: "sink",
    domain: "progression",
    resourceKeys: ["insight_points"],
    commandTypes: PROGRESSION_COMMANDS,
    operations: ["consume_respec_insight"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.crossTraditionRespec,
    flow: "sink",
    domain: "progression",
    resourceKeys: ["lineage_marks"],
    commandTypes: PROGRESSION_COMMANDS,
    operations: ["consume_respec_lineage_mark"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.supernaturalCostPrefix,
    flow: "sink",
    domain: "supernatural",
    commandTypes: SUPERNATURAL_COMMANDS,
    operations: ["supernatural_cost_paid"],
    prefixMatch: true,
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.governanceCostPrefix,
    flow: "sink",
    domain: "governance",
    resourceKeys: ["governance_budget"],
    eventTypes: ["governance_action_resolved"],
    commandTypes: GOVERNANCE_COMMANDS,
    operations: ["spend_governance_budget"],
    prefixMatch: true,
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.ecologyExtractionOrLoss,
    flow: "sink",
    domain: "ecology",
    resourceKeys: ["ecology_stock", "water", "grain"],
    eventTypes: ["ecology_tick_resolved"],
    commandTypes: ECOLOGY_COMMANDS,
    operations: ["ecology_stock_tick"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.legacyProjectMaintenance,
    flow: "sink",
    domain: "supernatural",
    commandTypes: SUPERNATURAL_COMMANDS,
    operations: ["project_maintenance_paid", "legacy_project_maintenance", "legacy_project_maintenance_paid"],
    prefixMatch: true,
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.projectMaintenance,
    flow: "sink",
    domain: "supernatural",
    commandTypes: SUPERNATURAL_COMMANDS,
    operations: ["project_maintenance", "project_maintenance_paid", "legacy_project_maintenance"],
  },
  {
    ref: CAUSAL_RESOURCE_SINK_REFS.projectMaintenanceSink,
    flow: "sink",
    domain: "supernatural",
    commandTypes: SUPERNATURAL_COMMANDS,
    operations: ["project_maintenance", "project_maintenance_paid", "legacy_project_maintenance"],
    prefixMatch: true,
  },
];

export function createCausalResourcePolicyFromCatalog(
  catalog: readonly CausalResourceCatalogEntry[] = DEFAULT_CAUSAL_RESOURCE_CATALOG,
): CausalResourcePolicy {
  return {
    creationSourceAllowed: (input) => catalog.some((entry) => entry.flow === "source" && catalogEntryMatches(entry, input)),
    destructionSinkAllowed: (input) => catalog.some((entry) => entry.flow === "sink" && catalogEntryMatches(entry, input)),
  };
}

function catalogEntryMatches(entry: CausalResourceCatalogEntry, input: CausalResourcePolicyCheckInput): boolean {
  if (entry.prefixMatch ? !input.ref.startsWith(entry.ref) : input.ref !== entry.ref) return false;
  if (entry.resourceKeys || entry.resourceKeyPrefixes) {
    const exactMatch = entry.resourceKeys?.includes(input.resourceKey) || false;
    const prefixMatch = entry.resourceKeyPrefixes?.some((prefix) => input.resourceKey.startsWith(prefix)) || false;
    if (!exactMatch && !prefixMatch) return false;
  }
  if (entry.eventTypes && !entry.eventTypes.includes(input.event.eventType)) return false;
  if (entry.commandTypes && !entry.commandTypes.includes(input.event.command.commandType)) return false;
  if (entry.operations && !entry.operations.includes(input.effect.operation)) return false;
  if (entry.requiresSourceEventIds && input.effect.sourceEventIds.length === 0) return false;
  return true;
}
