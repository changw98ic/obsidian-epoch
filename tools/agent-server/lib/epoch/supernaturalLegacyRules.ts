import type { CausalEffectV1, CausalEntityRef } from "./causalContracts.ts";
import { CAUSAL_RESOURCE_SINK_REFS } from "./causalResourceCatalog.ts";

export const SUPERNATURAL_LEGACY_RULESET_VERSION = "2026-07-20.supernatural-legacy.v1" as const;

export type SupernaturalLegacyErrorCode =
  | "INVALID_INTEGER"
  | "INVALID_TIME_RANGE"
  | "ACTOR_NOT_ACTIVE"
  | "CAPABILITY_UNKNOWN"
  | "CAPABILITY_SOURCE_MISSING"
  | "CAPABILITY_PERMISSION_DENIED"
  | "CAPABILITY_PREREQUISITE_MISSING"
  | "CAPABILITY_KNOWLEDGE_MISSING"
  | "CAPABILITY_TARGET_INVALID"
  | "CAPABILITY_COOLDOWN_ACTIVE"
  | "CAPABILITY_COST_UNPAID"
  | "CAPABILITY_WORLD_REWRITE_DENIED"
  | "CAPABILITY_COUNTER_WINDOW_REQUIRED"
  | "MORTALITY_INVALID_TRANSITION"
  | "DEATH_NOT_CONFIRMED"
  | "LEGACY_AUTHORIZATION_DENIED"
  | "LEGACY_FULL_NUMERIC_COPY_DENIED"
  | "PROJECT_INVALID_STATE"
  | "PROJECT_INPUT_MISSING"
  | "PROJECT_MAINTENANCE_UNPAID"
  | "PROJECT_PERSONNEL_UNAVAILABLE";

export interface SupernaturalLegacyError {
  readonly code: SupernaturalLegacyErrorCode;
  readonly message: string;
  readonly path: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface SupernaturalEffectProposal {
  readonly proposalId: string;
  readonly causalEffect: CausalEffectV1;
  readonly eventTypeHint: string;
  readonly namespaceHint: "world" | "lineage" | "identity" | "run";
}

export interface SupernaturalRuleResult<TValue> {
  readonly ok: boolean;
  readonly value?: TValue;
  readonly errors: readonly SupernaturalLegacyError[];
  readonly warnings: readonly string[];
}

export type SupernaturalCapabilitySource =
  | "bloodline"
  | "cultivation"
  | "arcane"
  | "divine_contract"
  | "old_one_resonance"
  | "rational_engineering"
  | "cyber_industrial"
  | "artifact"
  | "lineage_echo";

export type SupernaturalPermission =
  | "self"
  | "lineage"
  | "organization"
  | "contract"
  | "legal_warrant"
  | "owner_consent"
  | "system_authorized";

export type SupernaturalCostClass =
  | "vitality"
  | "focus"
  | "stability"
  | "aether"
  | "material"
  | "coin"
  | "time"
  | "memory"
  | "favor"
  | "authority";

export type SupernaturalCapabilityOperation =
  | "observe"
  | "shield"
  | "heal"
  | "harm"
  | "move"
  | "summon"
  | "transform"
  | "bind"
  | "forecast"
  | "alter_memory"
  | "resurrect"
  | "time_shift"
  | "create_item"
  | "destroy_item"
  | "world_predicate";

export interface SupernaturalResourceCost {
  readonly resourceKey: string;
  readonly resourceClass: SupernaturalCostClass;
  readonly unit: string;
  readonly quantityMinor: string;
  readonly accountRef?: string;
  readonly paidByRef?: string;
  readonly authorizationRef?: string;
}

export interface SupernaturalRiskProfile {
  readonly pollutionMinor: number;
  readonly exposureMinor: number;
  readonly backlashMinor: number;
  readonly legalHeatMinor: number;
  readonly instabilityMinor: number;
}

export interface SupernaturalCounterWindow {
  readonly opensAtWorldMinute: number;
  readonly closesAtWorldMinute: number;
  readonly counterVerbs: readonly string[];
  readonly evidenceSignatureRefs: readonly string[];
  readonly targetRefs: readonly string[];
}

export interface SupernaturalCapabilityDef {
  readonly capabilityId: string;
  readonly source: SupernaturalCapabilitySource;
  readonly operations: readonly SupernaturalCapabilityOperation[];
  readonly domains: readonly string[];
  readonly validTargetTypes: readonly string[];
  readonly requiredPermissions: readonly SupernaturalPermission[];
  readonly requiredPrerequisiteRefs: readonly string[];
  readonly requiredKnowledgeRefs: readonly string[];
  readonly resourceCosts: readonly SupernaturalResourceCost[];
  readonly timeCostWorldMinutes: number;
  readonly cooldownWorldMinutes: number;
  readonly minCounterWindowWorldMinutes: number;
  readonly risk: SupernaturalRiskProfile;
  readonly legalClassRefs: readonly string[];
  readonly evidenceSignatureRefs: readonly string[];
  readonly mayCreateWorldFact: boolean;
  readonly mayRewritePastFact: false;
  readonly maxTargets: number;
}

export interface SupernaturalActorSnapshot {
  readonly actorRef: string;
  readonly state: "active" | "injured" | "dying" | "dead" | "archived" | "reincarnating";
  readonly worldMinute: number;
  readonly permissions: readonly SupernaturalPermission[];
  readonly prerequisiteRefs: readonly string[];
  readonly knowledgeRefs: readonly string[];
  readonly cooldownReadyAtByCapabilityId: Readonly<Record<string, number | undefined>>;
  readonly resourceBalancesMinor: Readonly<Record<string, string | undefined>>;
  readonly pollutionMinor: number;
  readonly exposureMinor: number;
  readonly instabilityMinor: number;
}

export interface SupernaturalCastIntent {
  readonly commandId: string;
  readonly worldId: string;
  readonly casterRef: string;
  readonly capabilityId: string;
  readonly operation: SupernaturalCapabilityOperation;
  readonly targetRefs: readonly CausalEntityRef[];
  readonly intensityMinor: number;
  readonly occurredAtWorldMinute: number;
  readonly authorizationRefs: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly rootPressureIds: readonly string[];
  readonly declaredCosts?: readonly SupernaturalResourceCost[];
  readonly counterWindow?: SupernaturalCounterWindow;
  readonly desiredWorldFactChange?: "none" | "new_fact" | "rewrite_past_fact";
  readonly knowledgeEffectText?: string;
}

export interface SupernaturalCastEvaluation {
  readonly nextCooldownReadyAtWorldMinute: number;
  readonly counterWindow: SupernaturalCounterWindow;
  readonly risk: SupernaturalRiskProfile;
  readonly effects: readonly SupernaturalEffectProposal[];
}

export type MortalityState = "healthy" | "injured" | "critical" | "dying" | "dead" | "legacy_settled" | "reincarnated";

export interface InjurySnapshot {
  readonly injuryId: string;
  readonly severityMinor: number;
  readonly untreatedWorldMinutes: number;
  readonly lethal: boolean;
  readonly sourceEventIds: readonly string[];
}

export interface LegacyAssetSnapshot {
  readonly assetId: string;
  readonly assetType:
    | "institution"
    | "estate"
    | "workshop"
    | "reputation_memory"
    | "debt"
    | "enemy"
    | "relic"
    | "carry_in_slot"
    | "insurance_policy";
  readonly ownerRef: string;
  readonly titleRef?: string;
  readonly transferable: boolean;
  readonly authorizedHeirRefs: readonly string[];
  readonly valueMinor: string;
  readonly numericScaleMinor?: number;
  readonly sourceEventIds: readonly string[];
}

export interface LegacyInsuranceSnapshot {
  readonly policyId: string;
  readonly insurerAccountRef: string;
  readonly beneficiaryRefs: readonly string[];
  readonly coversAssetIds: readonly string[];
  readonly reserveResourceKey: string;
  readonly reserveUnit: string;
  readonly payoutLimitMinor: string;
  readonly authorizationRefs: readonly string[];
}

export interface MortalityLegacySnapshot {
  readonly worldId: string;
  readonly lineageRef: string;
  readonly identityRef: string;
  readonly nextIdentityRef?: string;
  readonly state: MortalityState;
  readonly worldMinute: number;
  readonly injuries: readonly InjurySnapshot[];
  readonly medicalEvidenceRefs: readonly string[];
  readonly witnessRefs: readonly string[];
  readonly assets: readonly LegacyAssetSnapshot[];
  readonly insurancePolicies: readonly LegacyInsuranceSnapshot[];
  readonly authorizedInheritanceRefs: readonly string[];
  readonly currentAttributesMinor: Readonly<Record<string, number | undefined>>;
  readonly currentSkillMinor: Readonly<Record<string, number | undefined>>;
}

export interface MortalityLegacyIntent {
  readonly commandId: string;
  readonly causeEventIds: readonly string[];
  readonly occurredAtWorldMinute: number;
  readonly advanceWorldMinutes: number;
  readonly requestedTransition: "injure" | "mark_dying" | "confirm_death" | "settle_legacy" | "issue_reincarnation";
  readonly heirRef?: string;
  readonly authorizationRefs: readonly string[];
}

export interface MortalityLegacySettlement {
  readonly nextState: MortalityState;
  readonly elapsedWorldMinutes: number;
  readonly inheritedAssetIds: readonly string[];
  readonly blockedAssetIds: readonly string[];
  readonly inheritedEchoes: readonly LegacyEcho[];
  readonly effects: readonly SupernaturalEffectProposal[];
}

export interface LegacyEcho {
  readonly echoId: string;
  readonly echoType: "talent_echo" | "method_familiarity" | "branch_anchor" | "insurance_claim" | "minor_relic" | "contract_remnant";
  readonly sourceRef: string;
  readonly strengthMinor: number;
  readonly authorizationRefs: readonly string[];
}

export type LegacyProjectState = "planned" | "active" | "paused" | "blocked" | "failed" | "completed";

export interface LegacyProjectStage {
  readonly stageId: string;
  readonly order: number;
  readonly requiredProgressMinor: number;
  readonly requiredInputRefs: readonly string[];
  readonly maintenanceCostMinorPerDay: string;
  readonly riskMinorPerDay: number;
}

export interface LegacyProjectPersonnel {
  readonly actorRef: string;
  readonly role: string;
  readonly availableWorldMinutesPerDay: number;
  readonly skillMinor: number;
  readonly upkeepMinorPerDay: string;
}

export interface LegacyProjectSnapshot {
  readonly projectId: string;
  readonly projectType: "organization" | "school" | "facility" | "route" | "world_pressure" | "knowledge" | "successor_training";
  readonly ownerLineageRef: string;
  readonly state: LegacyProjectState;
  readonly currentStageId: string;
  readonly progressMinor: number;
  readonly stages: readonly LegacyProjectStage[];
  readonly committedInputRefs: readonly string[];
  readonly personnel: readonly LegacyProjectPersonnel[];
  readonly treasuryAccountRef: string;
  readonly treasuryResourceKey: string;
  readonly treasuryUnit: string;
  readonly treasuryBalanceMinor: string;
  readonly maintenanceDebtMinor: string;
  readonly riskMinor: number;
  readonly lastAdvancedWorldMinute: number;
  readonly authorizationRefs: readonly string[];
}

export interface LegacyProjectAdvanceInput {
  readonly commandId: string;
  readonly worldId: string;
  readonly project: LegacyProjectSnapshot;
  readonly toWorldMinute: number;
  readonly pauseRequested?: boolean;
  readonly resumeRequested?: boolean;
  readonly sourceEventIds: readonly string[];
}

export interface LegacyProjectAdvance {
  readonly project: LegacyProjectSnapshot;
  readonly advancedDays: number;
  readonly effects: readonly SupernaturalEffectProposal[];
}

const ZERO_RISK: SupernaturalRiskProfile = {
  pollutionMinor: 0,
  exposureMinor: 0,
  backlashMinor: 0,
  legalHeatMinor: 0,
  instabilityMinor: 0,
};

const MAX_INHERITED_NUMERIC_MINOR = 3500;
const FULL_COPY_DENIAL_MINOR = 8000;
const WORLD_DAY_MINUTES = 24 * 60;

export function evaluateSupernaturalCast(input: {
  readonly actor: SupernaturalActorSnapshot;
  readonly intent: SupernaturalCastIntent;
  readonly capabilities: readonly SupernaturalCapabilityDef[];
}): SupernaturalRuleResult<SupernaturalCastEvaluation> {
  const errors: SupernaturalLegacyError[] = [];
  const warnings: string[] = [];
  const capability = input.capabilities.find((candidate) => candidate.capabilityId === input.intent.capabilityId);

  errors.push(...validateCastNumbers(input.intent));
  if (!capability) {
    errors.push(error("CAPABILITY_UNKNOWN", "capability is not registered", "intent.capabilityId"));
    return failed(errors, warnings);
  }

  if (input.actor.state !== "active" && input.actor.state !== "injured") {
    errors.push(error("ACTOR_NOT_ACTIVE", "only active or injured identities can cast abilities", "actor.state"));
  }
  if (!capability.source) {
    errors.push(error("CAPABILITY_SOURCE_MISSING", "capability must declare a supernatural source", "capability.source"));
  }
  if (!capability.operations.includes(input.intent.operation)) {
    errors.push(error("CAPABILITY_TARGET_INVALID", "operation is not supported by capability", "intent.operation"));
  }
  if (input.intent.targetRefs.length > capability.maxTargets) {
    errors.push(error("CAPABILITY_TARGET_INVALID", "too many targets for capability", "intent.targetRefs"));
  }
  input.intent.targetRefs.forEach((target, index) => {
    if (!capability.validTargetTypes.includes(target.entityType)) {
      errors.push(error("CAPABILITY_TARGET_INVALID", "target type is not valid for capability", `intent.targetRefs.${index}.entityType`));
    }
  });

  const missingPermissions = capability.requiredPermissions.filter((permission) => !input.actor.permissions.includes(permission));
  if (missingPermissions.length) {
    errors.push(error("CAPABILITY_PERMISSION_DENIED", "caster lacks required permission", "actor.permissions", false, { missingPermissions }));
  }
  const missingPrerequisites = capability.requiredPrerequisiteRefs.filter((ref) => !input.actor.prerequisiteRefs.includes(ref));
  if (missingPrerequisites.length) {
    errors.push(error("CAPABILITY_PREREQUISITE_MISSING", "caster lacks required prerequisite", "actor.prerequisiteRefs", false, { missingPrerequisites }));
  }
  const missingKnowledge = capability.requiredKnowledgeRefs.filter((ref) => !input.actor.knowledgeRefs.includes(ref));
  if (missingKnowledge.length) {
    errors.push(error("CAPABILITY_KNOWLEDGE_MISSING", "caster lacks required knowledge", "actor.knowledgeRefs", false, { missingKnowledge }));
  }

  const cooldownReadyAt = input.actor.cooldownReadyAtByCapabilityId[capability.capabilityId] || 0;
  if (cooldownReadyAt > input.intent.occurredAtWorldMinute) {
    errors.push(error("CAPABILITY_COOLDOWN_ACTIVE", "capability cooldown has not expired", "actor.cooldownReadyAtByCapabilityId", true, {
      cooldownReadyAt,
    }));
  }

  const desiredChange = input.intent.desiredWorldFactChange || "none";
  if (desiredChange === "rewrite_past_fact" || capability.mayRewritePastFact !== false) {
    errors.push(error("CAPABILITY_WORLD_REWRITE_DENIED", "supernatural abilities cannot delete or rewrite past facts", "intent.desiredWorldFactChange"));
  }
  if (desiredChange === "new_fact" && !capability.mayCreateWorldFact) {
    errors.push(error("CAPABILITY_WORLD_REWRITE_DENIED", "capability may only propose observations, beliefs, or bounded state changes", "capability.mayCreateWorldFact"));
  }

  const counterWindow = normalizeCounterWindow(input.intent, capability);
  if (!counterWindow) {
    errors.push(error("CAPABILITY_COUNTER_WINDOW_REQUIRED", "non-observation supernatural actions require a counter window", "intent.counterWindow"));
  }

  errors.push(...validateCosts(input.actor, input.intent, capability));
  if (errors.length) return failed(errors, warnings);

  const scaledRisk = scaleRisk(capability.risk, input.intent.intensityMinor);
  const nextCooldownReadyAtWorldMinute = input.intent.occurredAtWorldMinute + capability.cooldownWorldMinutes;
  const effects = castEffects({
    actor: input.actor,
    capability,
    intent: input.intent,
    counterWindow: counterWindow!,
    risk: scaledRisk,
    nextCooldownReadyAtWorldMinute,
  });

  if (capability.risk.pollutionMinor === 0 && capability.risk.exposureMinor === 0 && capability.resourceCosts.length === 0 && capability.timeCostWorldMinutes === 0) {
    warnings.push("capability_has_no_material_cost_or_risk");
  }

  return {
    ok: true,
    value: {
      nextCooldownReadyAtWorldMinute,
      counterWindow: counterWindow!,
      risk: scaledRisk,
      effects,
    },
    errors: [],
    warnings,
  };
}

export function settleMortalityAndLegacy(input: {
  readonly snapshot: MortalityLegacySnapshot;
  readonly intent: MortalityLegacyIntent;
}): SupernaturalRuleResult<MortalityLegacySettlement> {
  const errors: SupernaturalLegacyError[] = [];
  const warnings: string[] = [];
  const { snapshot, intent } = input;

  if (!isNonNegativeSafeInteger(intent.occurredAtWorldMinute) || !isNonNegativeSafeInteger(intent.advanceWorldMinutes)) {
    errors.push(error("INVALID_INTEGER", "mortality timing must use non-negative safe integers", "intent"));
  }
  const nextWorldMinute = intent.occurredAtWorldMinute + intent.advanceWorldMinutes;
  if (nextWorldMinute < snapshot.worldMinute) {
    errors.push(error("INVALID_TIME_RANGE", "world time cannot move backwards", "intent.occurredAtWorldMinute"));
  }

  const nextState = mortalityTransition(snapshot, intent);
  if (!nextState) {
    errors.push(error("MORTALITY_INVALID_TRANSITION", "requested mortality transition is not valid from current state", "intent.requestedTransition", false, {
      currentState: snapshot.state,
    }));
  }
  if ((intent.requestedTransition === "settle_legacy" || intent.requestedTransition === "issue_reincarnation") && snapshot.state !== "dead" && snapshot.state !== "legacy_settled") {
    errors.push(error("DEATH_NOT_CONFIRMED", "legacy settlement and reincarnation require confirmed death", "snapshot.state"));
  }
  if ((intent.requestedTransition === "settle_legacy" || intent.requestedTransition === "issue_reincarnation") && !inheritanceAuthorized(snapshot, intent)) {
    errors.push(error("LEGACY_AUTHORIZATION_DENIED", "lineage inheritance requires explicit authorization", "intent.authorizationRefs"));
  }
  if (errors.length) return failed(errors, warnings);

  const inheritedAssets = inheritedLegacyAssets(snapshot, intent);
  const inheritedEchoes = inheritedLegacyEchoes(snapshot, inheritedAssets);
  const fullCopies = inheritedEchoes.filter((echo) => echo.strengthMinor >= FULL_COPY_DENIAL_MINOR);
  if (fullCopies.length) {
    return failed([
      error("LEGACY_FULL_NUMERIC_COPY_DENIED", "lineage echoes cannot replicate complete previous-life numeric state", "snapshot.currentAttributesMinor", false, {
        echoIds: fullCopies.map((echo) => echo.echoId),
      }),
    ], warnings);
  }

  const inheritedAssetIds = inheritedAssets.map((asset) => asset.assetId);
  const blockedAssetIds = snapshot.assets
    .map((asset) => asset.assetId)
    .filter((assetId) => !inheritedAssetIds.includes(assetId))
    .sort(compareStable);
  const effects = mortalityEffects(snapshot, intent, nextState!, inheritedAssets, inheritedEchoes);

  return {
    ok: true,
    value: {
      nextState: nextState!,
      elapsedWorldMinutes: nextWorldMinute - snapshot.worldMinute,
      inheritedAssetIds,
      blockedAssetIds,
      inheritedEchoes,
      effects,
    },
    errors: [],
    warnings,
  };
}

export function advanceLegacyProject(input: LegacyProjectAdvanceInput): SupernaturalRuleResult<LegacyProjectAdvance> {
  const errors: SupernaturalLegacyError[] = [];
  const warnings: string[] = [];
  const project = input.project;

  if (!isNonNegativeSafeInteger(input.toWorldMinute) || input.toWorldMinute < project.lastAdvancedWorldMinute) {
    errors.push(error("INVALID_TIME_RANGE", "project world time cannot move backwards", "toWorldMinute"));
  }
  if (project.state === "failed" || project.state === "completed") {
    errors.push(error("PROJECT_INVALID_STATE", "terminal projects cannot advance", "project.state"));
  }

  const stage = currentStage(project);
  if (!stage) errors.push(error("PROJECT_INVALID_STATE", "current project stage is missing", "project.currentStageId"));
  if (stage) {
    const missingInputs = stage.requiredInputRefs.filter((ref) => !project.committedInputRefs.includes(ref));
    if (missingInputs.length && project.state === "active") {
      errors.push(error("PROJECT_INPUT_MISSING", "active project lacks required inputs for current stage", "project.committedInputRefs", true, {
        missingInputs,
      }));
    }
  }
  if (project.state === "active" && project.personnel.length === 0) {
    errors.push(error("PROJECT_PERSONNEL_UNAVAILABLE", "active project requires at least one personnel assignment", "project.personnel"));
  }
  if (errors.length) return failed(errors, warnings);

  const elapsedMinutes = input.toWorldMinute - project.lastAdvancedWorldMinute;
  const advancedDays = floorDiv(elapsedMinutes, WORLD_DAY_MINUTES);
  let nextProject: LegacyProjectSnapshot = {
    ...project,
    state: input.pauseRequested ? "paused" : project.state,
    lastAdvancedWorldMinute: input.toWorldMinute,
  };

  const effects: SupernaturalEffectProposal[] = [];
  if (input.resumeRequested && project.state === "paused") {
    nextProject = { ...nextProject, state: "active" };
  }
  if (nextProject.state !== "active" || advancedDays === 0 || !stage) {
    effects.push(projectStateEffect(input, project, nextProject.state, "project_time_recorded"));
    return { ok: true, value: { project: nextProject, advancedDays, effects }, errors: [], warnings };
  }

  const maintenanceDue = BigInt(stage.maintenanceCostMinorPerDay) * BigInt(advancedDays);
  const personnelDue = project.personnel.reduce((sum, person) => sum + BigInt(person.upkeepMinorPerDay) * BigInt(advancedDays), 0n);
  const totalDue = maintenanceDue + personnelDue;
  const treasury = parseMinor(project.treasuryBalanceMinor);
  if (treasury === undefined || treasury < totalDue) {
    const debt = (parseMinor(project.maintenanceDebtMinor) || 0n) + totalDue - (treasury || 0n);
    nextProject = {
      ...nextProject,
      state: "blocked",
      treasuryBalanceMinor: treasury && treasury > 0n ? "0" : project.treasuryBalanceMinor,
      maintenanceDebtMinor: debt.toString(),
    };
    effects.push(projectMaintenanceEffect(input, project, totalDue, treasury || 0n));
    effects.push(projectStateEffect(input, project, "blocked", "maintenance_unpaid"));
    return {
      ok: true,
      value: { project: nextProject, advancedDays, effects },
      errors: [error("PROJECT_MAINTENANCE_UNPAID", "project paused because maintenance could not be paid", "project.treasuryBalanceMinor", true)],
      warnings,
    };
  }

  const laborMinor = project.personnel
    .slice()
    .sort((a, b) => compareStable(a.actorRef, b.actorRef) || compareStable(a.role, b.role))
    .reduce((sum, person) => sum + floorDiv(person.availableWorldMinutesPerDay * person.skillMinor * advancedDays, 100), 0);
  const nextRiskMinor = clampMinor(project.riskMinor + stage.riskMinorPerDay * advancedDays);
  const nextProgressMinor = project.progressMinor + laborMinor;
  const stageCompleted = nextProgressMinor >= stage.requiredProgressMinor;
  const nextStage = stageCompleted ? followingStage(project, stage) : stage;
  const nextState: LegacyProjectState = stageCompleted && !nextStage ? "completed" : "active";

  nextProject = {
    ...nextProject,
    state: nextRiskMinor >= 10000 ? "failed" : nextState,
    currentStageId: nextStage?.stageId || stage.stageId,
    progressMinor: stageCompleted && nextStage ? nextProgressMinor - stage.requiredProgressMinor : nextProgressMinor,
    treasuryBalanceMinor: (treasury - totalDue).toString(),
    riskMinor: nextRiskMinor,
  };
  effects.push(projectMaintenanceEffect(input, project, totalDue, totalDue));
  effects.push(projectProgressEffect(input, project, nextProject, laborMinor, nextRiskMinor));
  if (nextProject.state !== project.state || stageCompleted) {
    effects.push(projectStateEffect(input, project, nextProject.state, stageCompleted ? "stage_completed" : "risk_threshold_reached"));
  }

  return { ok: true, value: { project: nextProject, advancedDays, effects }, errors: [], warnings };
}

function validateCastNumbers(intent: SupernaturalCastIntent): readonly SupernaturalLegacyError[] {
  const errors: SupernaturalLegacyError[] = [];
  if (!isNonNegativeSafeInteger(intent.intensityMinor) || intent.intensityMinor > 10000) {
    errors.push(error("INVALID_INTEGER", "intensityMinor must be an integer from 0 to 10000", "intent.intensityMinor"));
  }
  if (!isNonNegativeSafeInteger(intent.occurredAtWorldMinute)) {
    errors.push(error("INVALID_INTEGER", "occurredAtWorldMinute must be a non-negative safe integer", "intent.occurredAtWorldMinute"));
  }
  return errors;
}

function validateCosts(
  actor: SupernaturalActorSnapshot,
  intent: SupernaturalCastIntent,
  capability: SupernaturalCapabilityDef,
): readonly SupernaturalLegacyError[] {
  const declared = new Map((intent.declaredCosts || capability.resourceCosts).map((cost) => [costKey(cost), cost]));
  const errors: SupernaturalLegacyError[] = [];
  for (const cost of capability.resourceCosts) {
    const paid = declared.get(costKey(cost));
    const accountRef = paid?.accountRef || cost.accountRef || actor.actorRef;
    const balance = parseMinor(actor.resourceBalancesMinor[resourceBalanceKey(cost.resourceKey, cost.unit)] || "0");
    const required = parseMinor(cost.quantityMinor);
    if (required === undefined || balance === undefined) {
      errors.push(error("INVALID_INTEGER", "resource quantities must be decimal integer strings", "capability.resourceCosts"));
      continue;
    }
    if (!paid || balance < required) {
      errors.push(error("CAPABILITY_COST_UNPAID", "capability cost is not available from the declared account", "intent.declaredCosts", true, {
        accountRef,
        resourceKey: cost.resourceKey,
        unit: cost.unit,
      }));
    }
  }
  return errors;
}

function normalizeCounterWindow(
  intent: SupernaturalCastIntent,
  capability: SupernaturalCapabilityDef,
): SupernaturalCounterWindow | undefined {
  if (intent.operation === "observe" || intent.operation === "forecast") {
    return intent.counterWindow || {
      opensAtWorldMinute: intent.occurredAtWorldMinute,
      closesAtWorldMinute: intent.occurredAtWorldMinute,
      counterVerbs: [],
      evidenceSignatureRefs: capability.evidenceSignatureRefs,
      targetRefs: intent.targetRefs.map(refKey).sort(compareStable),
    };
  }
  const window = intent.counterWindow;
  if (!window) return undefined;
  if (window.opensAtWorldMinute < intent.occurredAtWorldMinute) return undefined;
  if (window.closesAtWorldMinute - window.opensAtWorldMinute < capability.minCounterWindowWorldMinutes) return undefined;
  return {
    opensAtWorldMinute: window.opensAtWorldMinute,
    closesAtWorldMinute: window.closesAtWorldMinute,
    counterVerbs: uniqueSorted(window.counterVerbs),
    evidenceSignatureRefs: uniqueSorted(window.evidenceSignatureRefs),
    targetRefs: uniqueSorted(window.targetRefs),
  };
}

function castEffects(input: {
  readonly actor: SupernaturalActorSnapshot;
  readonly capability: SupernaturalCapabilityDef;
  readonly intent: SupernaturalCastIntent;
  readonly counterWindow: SupernaturalCounterWindow;
  readonly risk: SupernaturalRiskProfile;
  readonly nextCooldownReadyAtWorldMinute: number;
}): readonly SupernaturalEffectProposal[] {
  const proposals: SupernaturalEffectProposal[] = [];
  for (const cost of input.capability.resourceCosts.slice().sort((a, b) => compareStable(costKey(a), costKey(b)))) {
    const accountRef = cost.accountRef || input.actor.actorRef;
    proposals.push(effectProposal(input.intent, "identity", "supernatural.cost_paid", resourceLedgerEffect({
      seed: `${input.intent.commandId}:cost:${costKey(cost)}`,
      targetRef: entity("resource_account", accountRef),
      operation: "supernatural_cost_paid",
      resourceKey: cost.resourceKey,
      resourceClass: cost.resourceClass,
      unit: cost.unit,
      entries: [{ accountRef, quantityMinor: negateMinor(cost.quantityMinor) }],
      destructionSinkRef: `${CAUSAL_RESOURCE_SINK_REFS.supernaturalCostPrefix}${input.capability.capabilityId}`,
      sourceEventIds: input.intent.sourceEventIds,
      authorizationRefs: uniqueSorted([...input.intent.authorizationRefs, cost.authorizationRef].filter(isString)),
    })));
  }

  proposals.push(effectProposal(input.intent, "identity", "supernatural.cooldown_set", stateEffect({
    seed: `${input.intent.commandId}:cooldown`,
    targetRef: entity("capability_cooldown", `${input.actor.actorRef}:${input.capability.capabilityId}`),
    operation: "cooldown_set",
    fromState: String(input.actor.cooldownReadyAtByCapabilityId[input.capability.capabilityId] || 0),
    toState: String(input.nextCooldownReadyAtWorldMinute),
    stateMachineId: "supernatural.capability_cooldown",
    reasonCode: input.capability.capabilityId,
    sourceEventIds: input.intent.sourceEventIds,
    authorizationRefs: input.intent.authorizationRefs,
  })));

  if (riskTotal(input.risk) > 0) {
    proposals.push(effectProposal(input.intent, "identity", "supernatural.risk_applied", pressureEffect({
      seed: `${input.intent.commandId}:risk`,
      targetRef: entity("actor_supernatural_risk", input.actor.actorRef),
      operation: "risk_applied",
      after: {
        capabilityId: input.capability.capabilityId,
        source: input.capability.source,
        pollutionMinorAfter: input.actor.pollutionMinor + input.risk.pollutionMinor,
        exposureMinorAfter: input.actor.exposureMinor + input.risk.exposureMinor,
        instabilityMinorAfter: input.actor.instabilityMinor + input.risk.instabilityMinor,
        backlashMinor: input.risk.backlashMinor,
        legalHeatMinor: input.risk.legalHeatMinor,
      },
      sourceEventIds: input.intent.sourceEventIds,
      authorizationRefs: input.intent.authorizationRefs,
    })));
  }

  proposals.push(effectProposal(input.intent, "world", "supernatural.counter_window_opened", worldPredicateEffect({
    seed: `${input.intent.commandId}:counter`,
    targetRef: entity("counter_window", stableId("counter", `${input.intent.commandId}:${input.capability.capabilityId}`)),
    subjectRef: entity("capability_cast", input.intent.commandId),
    predicateId: `counter_window:${input.intent.commandId}`,
    operator: "exists",
    expectedValue: input.counterWindow,
    evaluationStatus: "true",
    evaluatedAtWorldMinute: input.intent.occurredAtWorldMinute,
    sourceEventIds: input.intent.sourceEventIds,
    authorizationRefs: input.intent.authorizationRefs,
  })));

  if (input.intent.operation === "observe" || input.intent.operation === "forecast" || input.intent.operation === "alter_memory") {
    proposals.push(effectProposal(input.intent, "identity", "supernatural.knowledge_delta", knowledgeEffect({
      seed: `${input.intent.commandId}:knowledge`,
      targetRef: entity("knowledge_subject", input.actor.actorRef),
      operation: input.intent.operation,
      after: {
        capabilityId: input.capability.capabilityId,
        domains: input.capability.domains,
        text: input.intent.knowledgeEffectText || `${input.intent.operation}:${input.capability.capabilityId}`,
        confidenceMinor: input.intent.operation === "forecast" ? 5000 : 7000,
        factMutation: false,
        sourceEventIds: input.intent.sourceEventIds,
      },
      sourceEventIds: input.intent.sourceEventIds,
      authorizationRefs: input.intent.authorizationRefs,
    })));
  } else {
    for (const target of input.intent.targetRefs.slice().sort((a, b) => compareStable(refKey(a), refKey(b)))) {
      proposals.push(effectProposal(input.intent, "world", "supernatural.bounded_state_delta", stateEffect({
        seed: `${input.intent.commandId}:state:${refKey(target)}`,
        targetRef: target,
        operation: `supernatural_${input.intent.operation}`,
        fromState: "existing",
        toState: "pending_counter_window",
        stateMachineId: "supernatural.bounded_action",
        reasonCode: input.capability.capabilityId,
        sourceEventIds: input.intent.sourceEventIds,
        authorizationRefs: input.intent.authorizationRefs,
      })));
    }
  }
  return proposals.sort((a, b) => compareStable(a.proposalId, b.proposalId));
}

function mortalityTransition(snapshot: MortalityLegacySnapshot, intent: MortalityLegacyIntent): MortalityState | undefined {
  if (intent.requestedTransition === "injure") {
    if (snapshot.state === "healthy" || snapshot.state === "injured") return "injured";
    return undefined;
  }
  if (intent.requestedTransition === "mark_dying") {
    if (snapshot.state === "injured" || snapshot.state === "critical" || snapshot.state === "dying") return "dying";
    return undefined;
  }
  if (intent.requestedTransition === "confirm_death") {
    if ((snapshot.state === "dying" || snapshot.state === "critical") && deathConfirmed(snapshot)) return "dead";
    return undefined;
  }
  if (intent.requestedTransition === "settle_legacy") {
    if (snapshot.state === "dead") return "legacy_settled";
    return undefined;
  }
  if (intent.requestedTransition === "issue_reincarnation") {
    if (snapshot.state === "legacy_settled") return "reincarnated";
    return undefined;
  }
  return undefined;
}

function deathConfirmed(snapshot: MortalityLegacySnapshot): boolean {
  const lethalEvidence = snapshot.injuries.some((injury) => injury.lethal && injury.severityMinor >= 10000);
  return lethalEvidence && snapshot.medicalEvidenceRefs.length > 0 && snapshot.witnessRefs.length > 0;
}

function inheritanceAuthorized(snapshot: MortalityLegacySnapshot, intent: MortalityLegacyIntent): boolean {
  if (!intent.heirRef) return false;
  const refs = new Set([...snapshot.authorizedInheritanceRefs, ...intent.authorizationRefs]);
  return refs.has(`inheritance:${snapshot.lineageRef}:${intent.heirRef}`) || refs.has("system_authorized");
}

function inheritedLegacyAssets(snapshot: MortalityLegacySnapshot, intent: MortalityLegacyIntent): readonly LegacyAssetSnapshot[] {
  if (!intent.heirRef) return [];
  return snapshot.assets
    .filter((asset) => asset.transferable)
    .filter((asset) => asset.authorizedHeirRefs.includes(intent.heirRef!))
    .filter((asset) => {
      if (asset.assetType === "carry_in_slot" || asset.assetType === "insurance_policy") {
        return intent.authorizationRefs.includes(`authorized:${asset.assetId}`);
      }
      return true;
    })
    .slice()
    .sort((a, b) => compareStable(a.assetType, b.assetType) || compareStable(a.assetId, b.assetId));
}

function inheritedLegacyEchoes(snapshot: MortalityLegacySnapshot, assets: readonly LegacyAssetSnapshot[]): readonly LegacyEcho[] {
  const echoes: LegacyEcho[] = [];
  for (const asset of assets) {
    const strengthMinor = inheritedStrengthMinor(asset);
    const echoType = echoTypeForAsset(asset.assetType);
    if (!echoType) continue;
    echoes.push({
      echoId: stableId("legacy_echo", `${snapshot.lineageRef}:${asset.assetId}:${echoType}`),
      echoType,
      sourceRef: asset.assetId,
      strengthMinor,
      authorizationRefs: asset.authorizedHeirRefs.map((heir) => `inheritance:${snapshot.lineageRef}:${heir}`).sort(compareStable),
    });
  }
  for (const [attributeId, value] of sortedEntries(snapshot.currentAttributesMinor)) {
    if (!isNonNegativeSafeInteger(value || 0)) continue;
    const strengthMinor = Math.min(MAX_INHERITED_NUMERIC_MINOR, floorDiv(value || 0, 4));
    if (strengthMinor <= 0) continue;
    echoes.push({
      echoId: stableId("legacy_echo", `${snapshot.lineageRef}:attribute:${attributeId}`),
      echoType: "method_familiarity",
      sourceRef: `attribute:${attributeId}`,
      strengthMinor,
      authorizationRefs: snapshot.authorizedInheritanceRefs,
    });
  }
  for (const [skillId, value] of sortedEntries(snapshot.currentSkillMinor)) {
    if (!isNonNegativeSafeInteger(value || 0)) continue;
    const strengthMinor = Math.min(MAX_INHERITED_NUMERIC_MINOR, floorDiv(value || 0, 5));
    if (strengthMinor <= 0) continue;
    echoes.push({
      echoId: stableId("legacy_echo", `${snapshot.lineageRef}:skill:${skillId}`),
      echoType: "method_familiarity",
      sourceRef: `skill:${skillId}`,
      strengthMinor,
      authorizationRefs: snapshot.authorizedInheritanceRefs,
    });
  }
  return echoes.sort((a, b) => compareStable(a.echoId, b.echoId));
}

function mortalityEffects(
  snapshot: MortalityLegacySnapshot,
  intent: MortalityLegacyIntent,
  nextState: MortalityState,
  assets: readonly LegacyAssetSnapshot[],
  echoes: readonly LegacyEcho[],
): readonly SupernaturalEffectProposal[] {
  const baseIntent = {
    commandId: intent.commandId,
    sourceEventIds: intent.causeEventIds,
    authorizationRefs: intent.authorizationRefs,
  };
  const proposals: SupernaturalEffectProposal[] = [
    effectProposal(baseIntent, "identity", "identity.mortality_state_transition", stateEffect({
      seed: `${intent.commandId}:mortality`,
      targetRef: entity("identity", snapshot.identityRef),
      operation: "mortality_transition",
      fromState: snapshot.state,
      toState: nextState,
      stateMachineId: "identity.mortality",
      reasonCode: intent.requestedTransition,
      sourceEventIds: intent.causeEventIds,
      authorizationRefs: intent.authorizationRefs,
    })),
    effectProposal(baseIntent, "world", "world.time_advanced", worldPredicateEffect({
      seed: `${intent.commandId}:time`,
      targetRef: entity("world_clock", snapshot.worldId),
      subjectRef: entity("world", snapshot.worldId),
      predicateId: `world_minute:${snapshot.worldId}`,
      operator: "gte",
      expectedValue: intent.occurredAtWorldMinute + intent.advanceWorldMinutes,
      evaluationStatus: "true",
      evaluatedAtWorldMinute: intent.occurredAtWorldMinute + intent.advanceWorldMinutes,
      sourceEventIds: intent.causeEventIds,
      authorizationRefs: intent.authorizationRefs,
    })),
  ];
  for (const asset of assets) {
    proposals.push(effectProposal(baseIntent, "lineage", "lineage.asset_inherited", ownershipEffect({
      seed: `${intent.commandId}:asset:${asset.assetId}`,
      targetRef: entity("legacy_asset", asset.assetId),
      itemRef: asset.titleRef || asset.assetId,
      holderRef: intent.heirRef || snapshot.lineageRef,
      validFromWorldMinute: intent.occurredAtWorldMinute,
      basisEventIds: asset.sourceEventIds,
      authorizationRefs: intent.authorizationRefs,
    })));
  }
  for (const echo of echoes) {
    proposals.push(effectProposal(baseIntent, "lineage", "lineage.echo_created", knowledgeEffect({
      seed: `${intent.commandId}:echo:${echo.echoId}`,
      targetRef: entity("legacy_echo", echo.echoId),
      operation: "echo_created",
      after: { ...echo },
      sourceEventIds: intent.causeEventIds,
      authorizationRefs: uniqueSorted([...intent.authorizationRefs, ...echo.authorizationRefs]),
    })));
  }
  return proposals.sort((a, b) => compareStable(a.proposalId, b.proposalId));
}

function projectMaintenanceEffect(input: LegacyProjectAdvanceInput, before: LegacyProjectSnapshot, due: bigint, paid: bigint): SupernaturalEffectProposal {
  return effectProposal(input, "lineage", "lineage.project_maintenance_paid", resourceLedgerEffect({
    seed: `${input.commandId}:project:maintenance:${before.projectId}`,
    targetRef: entity("legacy_project", before.projectId),
    operation: "project_maintenance_paid",
    resourceKey: before.treasuryResourceKey,
    resourceClass: "coin",
    unit: before.treasuryUnit,
    entries: paid > 0n ? [{ accountRef: before.treasuryAccountRef, quantityMinor: `-${paid.toString()}` }] : [],
    destructionSinkRef: CAUSAL_RESOURCE_SINK_REFS.legacyProjectMaintenance,
    sourceEventIds: input.sourceEventIds,
    authorizationRefs: before.authorizationRefs,
    extraAfter: { dueMinor: due.toString(), paidMinor: paid.toString() },
  }));
}

function projectProgressEffect(
  input: LegacyProjectAdvanceInput,
  before: LegacyProjectSnapshot,
  after: LegacyProjectSnapshot,
  progressDeltaMinor: number,
  riskMinor: number,
): SupernaturalEffectProposal {
  return effectProposal(input, "lineage", "lineage.project_progressed", pressureEffect({
    seed: `${input.commandId}:project:progress:${before.projectId}`,
    targetRef: entity("legacy_project", before.projectId),
    operation: "project_progressed",
    after: {
      projectId: before.projectId,
      stageIdBefore: before.currentStageId,
      stageIdAfter: after.currentStageId,
      progressMinorBefore: before.progressMinor,
      progressMinorAfter: after.progressMinor,
      progressDeltaMinor,
      riskMinorAfter: riskMinor,
    },
    sourceEventIds: input.sourceEventIds,
    authorizationRefs: before.authorizationRefs,
  }));
}

function projectStateEffect(
  input: Pick<LegacyProjectAdvanceInput, "commandId" | "sourceEventIds">,
  before: LegacyProjectSnapshot,
  state: LegacyProjectState,
  reasonCode: string,
): SupernaturalEffectProposal {
  return effectProposal(input, "lineage", "lineage.project_state_transition", stateEffect({
    seed: `${input.commandId}:project:state:${before.projectId}:${state}`,
    targetRef: entity("legacy_project", before.projectId),
    operation: "project_state_transition",
    fromState: before.state,
    toState: state,
    stateMachineId: "lineage.project",
    reasonCode,
    sourceEventIds: input.sourceEventIds,
    authorizationRefs: before.authorizationRefs,
  }));
}

function currentStage(project: LegacyProjectSnapshot): LegacyProjectStage | undefined {
  return project.stages.find((stage) => stage.stageId === project.currentStageId);
}

function followingStage(project: LegacyProjectSnapshot, current: LegacyProjectStage): LegacyProjectStage | undefined {
  return project.stages
    .filter((stage) => stage.order > current.order)
    .slice()
    .sort((a, b) => a.order - b.order || compareStable(a.stageId, b.stageId))[0];
}

function resourceLedgerEffect(input: {
  readonly seed: string;
  readonly targetRef: CausalEntityRef;
  readonly operation: string;
  readonly resourceKey: string;
  readonly resourceClass: string;
  readonly unit: string;
  readonly entries: readonly { readonly accountRef: string; readonly quantityMinor: string }[];
  readonly creationSourceRef?: string;
  readonly destructionSinkRef?: string;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
  readonly extraAfter?: Readonly<Record<string, unknown>>;
}): CausalEffectV1 {
  return {
    effectId: stableId("effect", input.seed),
    effectType: "resource_ledger",
    targetRef: input.targetRef,
    operation: input.operation,
    after: {
      resourceKey: input.resourceKey,
      resourceClass: input.resourceClass,
      unit: input.unit,
      entries: input.entries,
      ...(input.creationSourceRef ? { creationSourceRef: input.creationSourceRef } : {}),
      ...(input.destructionSinkRef ? { destructionSinkRef: input.destructionSinkRef } : {}),
      ...(input.extraAfter || {}),
    },
    sourceEventIds: uniqueSorted(input.sourceEventIds),
    authorizationRefs: uniqueSorted(input.authorizationRefs),
  } as CausalEffectV1;
}

function stateEffect(input: {
  readonly seed: string;
  readonly targetRef: CausalEntityRef;
  readonly operation: string;
  readonly stateMachineId: string;
  readonly fromState: string;
  readonly toState: string;
  readonly reasonCode: string;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
}): CausalEffectV1 {
  return {
    effectId: stableId("effect", input.seed),
    effectType: "state_transition",
    targetRef: input.targetRef,
    operation: input.operation,
    after: {
      stateMachineId: input.stateMachineId,
      fromState: input.fromState,
      toState: input.toState,
      transitionId: stableId("transition", input.seed),
      reasonCode: input.reasonCode,
    },
    sourceEventIds: uniqueSorted(input.sourceEventIds),
    authorizationRefs: uniqueSorted(input.authorizationRefs),
  };
}

function knowledgeEffect(input: {
  readonly seed: string;
  readonly targetRef: CausalEntityRef;
  readonly operation: string;
  readonly after: Readonly<Record<string, unknown>>;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
}): CausalEffectV1 {
  return {
    effectId: stableId("effect", input.seed),
    effectType: "knowledge_delta",
    targetRef: input.targetRef,
    operation: input.operation,
    after: input.after,
    sourceEventIds: uniqueSorted(input.sourceEventIds),
    authorizationRefs: uniqueSorted(input.authorizationRefs),
  };
}

function pressureEffect(input: {
  readonly seed: string;
  readonly targetRef: CausalEntityRef;
  readonly operation: string;
  readonly after: Readonly<Record<string, unknown>>;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
}): CausalEffectV1 {
  return {
    effectId: stableId("effect", input.seed),
    effectType: "pressure_delta",
    targetRef: input.targetRef,
    operation: input.operation,
    after: input.after,
    sourceEventIds: uniqueSorted(input.sourceEventIds),
    authorizationRefs: uniqueSorted(input.authorizationRefs),
  };
}

function worldPredicateEffect(input: {
  readonly seed: string;
  readonly targetRef: CausalEntityRef;
  readonly subjectRef: CausalEntityRef;
  readonly predicateId: string;
  readonly operator: "eq" | "neq" | "gte" | "lte" | "contains" | "exists" | "state_is";
  readonly expectedValue: unknown;
  readonly evaluationStatus: "true" | "false" | "unknown";
  readonly evaluatedAtWorldMinute: number;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
}): CausalEffectV1 {
  return {
    effectId: stableId("effect", input.seed),
    effectType: "world_predicate",
    targetRef: input.targetRef,
    operation: "predicate_recorded",
    after: {
      predicateId: input.predicateId,
      subjectRef: input.subjectRef,
      operator: input.operator,
      expectedValue: input.expectedValue,
      evaluationStatus: input.evaluationStatus,
      evaluatedAtWorldMinute: input.evaluatedAtWorldMinute,
    },
    sourceEventIds: uniqueSorted(input.sourceEventIds),
    authorizationRefs: uniqueSorted(input.authorizationRefs),
  };
}

function ownershipEffect(input: {
  readonly seed: string;
  readonly targetRef: CausalEntityRef;
  readonly itemRef: string;
  readonly holderRef: string;
  readonly validFromWorldMinute: number;
  readonly basisEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
}): CausalEffectV1 {
  return {
    effectId: stableId("effect", input.seed),
    effectType: "ownership_interest",
    targetRef: input.targetRef,
    operation: "lineage_inheritance_granted",
    after: {
      itemRef: input.itemRef,
      interestType: "title",
      holderRef: input.holderRef,
      validFromWorldMinute: input.validFromWorldMinute,
      basisEventIds: uniqueSorted(input.basisEventIds),
      priority: 0,
      transferable: false,
      status: "granted",
    },
    sourceEventIds: uniqueSorted(input.basisEventIds),
    authorizationRefs: uniqueSorted(input.authorizationRefs),
  };
}

function effectProposal(
  input: { readonly commandId: string; readonly sourceEventIds: readonly string[] },
  namespaceHint: SupernaturalEffectProposal["namespaceHint"],
  eventTypeHint: string,
  causalEffect: CausalEffectV1,
): SupernaturalEffectProposal {
  return {
    proposalId: stableId("proposal", `${input.commandId}:${eventTypeHint}:${causalEffect.effectId}`),
    causalEffect,
    eventTypeHint,
    namespaceHint,
  };
}

function scaleRisk(risk: SupernaturalRiskProfile, intensityMinor: number): SupernaturalRiskProfile {
  return {
    pollutionMinor: floorDiv(risk.pollutionMinor * intensityMinor, 10000),
    exposureMinor: floorDiv(risk.exposureMinor * intensityMinor, 10000),
    backlashMinor: floorDiv(risk.backlashMinor * intensityMinor, 10000),
    legalHeatMinor: floorDiv(risk.legalHeatMinor * intensityMinor, 10000),
    instabilityMinor: floorDiv(risk.instabilityMinor * intensityMinor, 10000),
  };
}

function riskTotal(risk: SupernaturalRiskProfile): number {
  return risk.pollutionMinor + risk.exposureMinor + risk.backlashMinor + risk.legalHeatMinor + risk.instabilityMinor;
}

function inheritedStrengthMinor(asset: LegacyAssetSnapshot): number {
  if (asset.numericScaleMinor !== undefined) return Math.min(MAX_INHERITED_NUMERIC_MINOR, floorDiv(asset.numericScaleMinor, 3));
  const value = parseMinor(asset.valueMinor);
  if (value === undefined || value <= 0n) return 0;
  const bounded = value > 10000n ? 10000 : Number(value);
  return Math.min(MAX_INHERITED_NUMERIC_MINOR, floorDiv(bounded, 4));
}

function echoTypeForAsset(assetType: LegacyAssetSnapshot["assetType"]): LegacyEcho["echoType"] | undefined {
  if (assetType === "reputation_memory") return "talent_echo";
  if (assetType === "institution" || assetType === "workshop") return "branch_anchor";
  if (assetType === "insurance_policy") return "insurance_claim";
  if (assetType === "relic") return "minor_relic";
  if (assetType === "debt" || assetType === "enemy" || assetType === "estate") return "contract_remnant";
  return undefined;
}

function resourceBalanceKey(resourceKey: string, unit: string): string {
  return `${resourceKey}:${unit}`;
}

function costKey(cost: SupernaturalResourceCost): string {
  return `${cost.resourceKey}:${cost.unit}:${cost.quantityMinor}:${cost.accountRef || ""}`;
}

function negateMinor(value: string): string {
  const parsed = parseMinor(value);
  if (parsed === undefined) return value;
  return (-parsed).toString();
}

function parseMinor(value: string): bigint | undefined {
  if (!/^-?(0|[1-9]\d*)$/.test(value)) return undefined;
  return BigInt(value);
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function clampMinor(value: number): number {
  if (value < 0) return 0;
  if (value > 10000) return 10000;
  return value;
}

function floorDiv(numerator: number, denominator: number): number {
  return Math.floor(numerator / denominator);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(isString))].sort(compareStable);
}

function sortedEntries<T>(record: Readonly<Record<string, T | undefined>>): readonly (readonly [string, T | undefined])[] {
  return Object.entries(record).sort(([a], [b]) => compareStable(a, b));
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function compareStable(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function entity(entityType: string, entityId: string): CausalEntityRef {
  return { entityType, entityId };
}

function refKey(ref: CausalEntityRef): string {
  return `${ref.entityType}:${ref.entityId}`;
}

function stableId(prefix: string, seed: string): string {
  return `${prefix}_${stableSlug(seed)}_${stableHash(seed)}`;
}

function stableSlug(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
  return slug || "id";
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function error(
  code: SupernaturalLegacyErrorCode,
  message: string,
  path: string,
  retryable = false,
  details?: Readonly<Record<string, unknown>>,
): SupernaturalLegacyError {
  return { code, message, path, retryable, ...(details ? { details } : {}) };
}

function failed<TValue>(
  errors: readonly SupernaturalLegacyError[],
  warnings: readonly string[],
): SupernaturalRuleResult<TValue> {
  return { ok: false, errors, warnings };
}

export const SUPERNATURAL_LEGACY_RULE_HELPERS = {
  stableId,
  resourceBalanceKey,
} as const;
