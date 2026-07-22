import type { CausalEffectV1, CausalEntityRef } from "./causalContracts.ts";
import type { EpochWorldPressureFactSignal } from "./worldPressureRules.ts";

export const EPOCH_GOVERNANCE_ECOLOGY_RULE_VERSION = "governance-ecology.v1" as const;

export type GovernanceEcologyErrorCode =
  | "GOVERNANCE_ENTITY_MISSING"
  | "GOVERNANCE_PERMISSION_DENIED"
  | "GOVERNANCE_COST_UNFUNDED"
  | "GOVERNANCE_SOURCE_REQUIRED"
  | "GOVERNANCE_OPPOSITION_REQUIRED"
  | "GOVERNANCE_ILLEGAL_TRANSITION"
  | "GOVERNANCE_CLAIM_INVALID"
  | "ECOLOGY_ENTITY_MISSING"
  | "ECOLOGY_CAPACITY_INVALID"
  | "ECOLOGY_CONSERVATION_FAILED"
  | "ECOLOGY_IRREVERSIBLE_THRESHOLD";

export type GovernanceActorRef =
  | `faction:${string}`
  | `institution:${string}`
  | `office:${string}`
  | `actor:${string}`
  | `organization:${string}`
  | `system:${string}`;

export type GovernanceActionKind =
  | "appoint_office"
  | "enact_law"
  | "amend_law"
  | "repeal_law"
  | "adopt_policy"
  | "levy_tax"
  | "impose_sanction"
  | "resolve_succession"
  | "split_faction"
  | "merge_factions";

export type GovernanceStatus =
  | "draft"
  | "proposed"
  | "deliberating"
  | "contested"
  | "active"
  | "suspended"
  | "repealed"
  | "failed"
  | "merged"
  | "split"
  | "dissolved";

export interface GovernanceScoreVector {
  readonly legitimacy: number;
  readonly administrativeCapacity: number;
  readonly cohesion: number;
  readonly corruption: number;
  readonly fiscal: number;
  readonly influence: number;
}

export interface Faction {
  readonly factionId: string;
  readonly name?: string;
  readonly status: GovernanceStatus;
  readonly metrics: GovernanceScoreVector;
  readonly relationByFactionId?: Readonly<Record<string, number>>;
  readonly claimIds?: readonly string[];
  readonly institutionIds?: readonly string[];
}

export interface Institution {
  readonly institutionId: string;
  readonly factionId?: string;
  readonly jurisdictionIds: readonly string[];
  readonly authorityRefs: readonly string[];
  readonly status: GovernanceStatus;
  readonly metrics: GovernanceScoreVector;
}

export interface Jurisdiction {
  readonly jurisdictionId: string;
  readonly regionIds: readonly string[];
  readonly institutionIds: readonly string[];
  readonly lawIds: readonly string[];
  readonly taxRateBasisPoints: number;
  readonly status: GovernanceStatus;
}

export interface Law {
  readonly lawId: string;
  readonly jurisdictionId: string;
  readonly sponsorRef: GovernanceActorRef;
  readonly status: GovernanceStatus;
  readonly authorityRefs: readonly string[];
  readonly enactedAtWorldMinute?: number;
  readonly repealedAtWorldMinute?: number;
}

export interface Policy {
  readonly policyId: string;
  readonly jurisdictionId?: string;
  readonly institutionId?: string;
  readonly status: GovernanceStatus;
  readonly budgetMinor: string;
  readonly publicServiceCapacity: number;
  readonly affectedActorRefs: readonly string[];
  readonly oppositionRefs: readonly string[];
}

export interface Office {
  readonly officeId: string;
  readonly institutionId: string;
  readonly jurisdictionId?: string;
  readonly holderRef?: GovernanceActorRef;
  readonly status: GovernanceStatus;
  readonly authorityRefs: readonly string[];
  readonly successionClaimIds: readonly string[];
}

export type GovernanceClaimType =
  | "office"
  | "jurisdiction"
  | "property"
  | "succession"
  | "lawful_authority"
  | "public_right";

export type GovernanceClaimStatus =
  | "asserted"
  | "recognized"
  | "contested"
  | "rejected"
  | "superseded"
  | "satisfied";

export interface Claim {
  readonly claimId: string;
  readonly claimantRef: GovernanceActorRef;
  readonly targetRef: string;
  readonly claimType: GovernanceClaimType;
  readonly status: GovernanceClaimStatus;
  readonly evidenceRefs: readonly string[];
  readonly priority: number;
}

export type ObligationStatus = "open" | "satisfied" | "breached" | "transferred" | "void";

export interface Obligation {
  readonly obligationId: string;
  readonly debtorRef: GovernanceActorRef;
  readonly beneficiaryRef: GovernanceActorRef;
  readonly sourceRef: string;
  readonly status: ObligationStatus;
  readonly dueAtWorldMinute?: number;
  readonly costMinor?: string;
  readonly transferable: boolean;
}

export interface GovernanceState {
  readonly factions: readonly Faction[];
  readonly institutions: readonly Institution[];
  readonly jurisdictions: readonly Jurisdiction[];
  readonly laws: readonly Law[];
  readonly policies: readonly Policy[];
  readonly offices: readonly Office[];
  readonly claims: readonly Claim[];
  readonly obligations: readonly Obligation[];
}

export interface GovernanceActionCost {
  readonly treasuryMinor?: string;
  readonly legitimacy?: number;
  readonly administrativeCapacity?: number;
  readonly cohesion?: number;
  readonly influence?: number;
}

export interface GovernanceActionProposal {
  readonly actionId?: string;
  readonly kind: GovernanceActionKind;
  readonly actorRef: GovernanceActorRef;
  readonly targetRef: string;
  readonly sourceRef: string;
  readonly worldMinute: number;
  readonly sourceEventIds: readonly string[];
  readonly authorizationRefs: readonly string[];
  readonly requiredAuthorityRefs: readonly string[];
  readonly oppositionRefs: readonly GovernanceActorRef[];
  readonly cost: GovernanceActionCost;
  readonly rootPressureIds?: readonly string[];
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface GovernanceActionResult {
  readonly status: "accepted" | "rejected";
  readonly actionId: string;
  readonly errors: readonly GovernanceEcologyError[];
  readonly state: GovernanceState;
  readonly effects: readonly CausalEffectV1[];
  readonly pressureSignals: readonly EpochWorldPressureFactSignal[];
}

export interface GovernanceEcologyError {
  readonly code: GovernanceEcologyErrorCode;
  readonly message: string;
  readonly ref?: string;
}

export interface RegionResourceStock {
  readonly regionId: string;
  readonly resourceKey: string;
  readonly stock: number;
  readonly capacity: number;
  readonly regenerationPerTick: number;
  readonly extractionPerTick: number;
  readonly pollution: number;
  readonly degradation: number;
  readonly restorationPerTick: number;
  readonly irreversibleThreshold: number;
  readonly irreversible: boolean;
}

export interface SpeciesPopulation {
  readonly regionId: string;
  readonly speciesId: string;
  readonly population: number;
  readonly carryingCapacity: number;
  readonly growthPerTick: number;
  readonly mortalityPerTick: number;
  readonly migrationOutPerTick: number;
  readonly migrationPreference?: Readonly<Record<string, number>>;
  readonly irreversibleMinimum: number;
  readonly extinct: boolean;
}

export interface EcologyCrossRegionFlow {
  readonly fromRegionId: string;
  readonly toRegionId: string;
  readonly resourceKey?: string;
  readonly speciesId?: string;
  readonly quantity: number;
}

export interface EcologyGovernanceInput {
  readonly extractionLimitByRegionResource?: Readonly<Record<string, number>>;
  readonly restorationBonusByRegion?: Readonly<Record<string, number>>;
  readonly pollutionPenaltyByRegion?: Readonly<Record<string, number>>;
}

export interface EcologyTickInput {
  readonly worldMinute: number;
  readonly sourceEventIds: readonly string[];
  readonly stocks: readonly RegionResourceStock[];
  readonly populations: readonly SpeciesPopulation[];
  readonly flows?: readonly EcologyCrossRegionFlow[];
  readonly governance?: EcologyGovernanceInput;
}

export interface EcologyTickResult {
  readonly status: "accepted" | "rejected";
  readonly errors: readonly GovernanceEcologyError[];
  readonly stocks: readonly RegionResourceStock[];
  readonly populations: readonly SpeciesPopulation[];
  readonly effects: readonly CausalEffectV1[];
  readonly pressureSignals: readonly EpochWorldPressureFactSignal[];
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function clampScore(value: number): number {
  return clampInt(value, 0, 100);
}

function parseMinor(value: string | undefined): number {
  if (value === undefined) return 0;
  if (!/^-?(0|[1-9]\d*)$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function uniqueSorted(values: readonly string[] | undefined): readonly string[] {
  return [...new Set((values ?? []).filter(Boolean))].sort();
}

function stableJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value: unknown): string {
  let hash = 0x811c9dc5;
  const text = stableJson(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function deterministicId(prefix: string, input: unknown): string {
  return `${prefix}_${stableHash({ input, ruleVersion: EPOCH_GOVERNANCE_ECOLOGY_RULE_VERSION })}`;
}

function entityRef(ref: string): CausalEntityRef {
  const separator = ref.indexOf(":");
  return separator > 0
    ? { entityType: ref.slice(0, separator), entityId: ref.slice(separator + 1) }
    : { entityType: "world_object", entityId: ref };
}

function governanceEffect(
  action: GovernanceActionProposal,
  effectType: "legal_delta" | "relationship_delta" | "pressure_delta" | "state_transition",
  targetRef: string,
  operation: string,
  after: Readonly<Record<string, unknown>>,
): CausalEffectV1 {
  return {
    effectId: deterministicId("effect", {
      actionId: action.actionId,
      effectType,
      operation,
      targetRef,
      after,
    }),
    effectType,
    targetRef: entityRef(targetRef),
    operation,
    after,
    sourceEventIds: uniqueSorted(action.sourceEventIds),
    authorizationRefs: uniqueSorted(action.authorizationRefs),
  } as CausalEffectV1;
}

function resourceEffect(
  action: GovernanceActionProposal,
  targetRef: string,
  resourceKey: string,
  entries: readonly { readonly accountRef: string; readonly quantityMinor: string }[],
  operation: string,
  refs: { readonly creationSourceRef?: string; readonly destructionSinkRef?: string } = {},
): CausalEffectV1 {
  return {
    effectId: deterministicId("effect", { actionId: action.actionId, entries, operation, resourceKey, targetRef, refs }),
    effectType: "resource_ledger",
    targetRef: entityRef(targetRef),
    operation,
    after: {
      resourceKey,
      resourceClass: "governance",
      unit: "minor",
      entries,
      ...refs,
    },
    sourceEventIds: uniqueSorted(action.sourceEventIds),
    authorizationRefs: uniqueSorted(action.authorizationRefs),
  } as CausalEffectV1;
}

function pressureSignal(
  kind: EpochWorldPressureFactSignal["kind"],
  scopeRef: string,
  observedAtWorldMinute: number,
  sourceFactEventIds: readonly string[],
  severity: number,
  affectedActorRefs: readonly string[] = [],
  affectedResourceRefs: readonly string[] = [],
): EpochWorldPressureFactSignal {
  return {
    signalId: deterministicId("signal", {
      kind,
      scopeRef,
      observedAtWorldMinute,
      sourceFactEventIds: uniqueSorted(sourceFactEventIds),
      affectedActorRefs: uniqueSorted(affectedActorRefs),
      affectedResourceRefs: uniqueSorted(affectedResourceRefs),
    }),
    kind,
    scopeRef,
    observedAtWorldMinute,
    sourceFactEventIds: uniqueSorted(sourceFactEventIds),
    affectedActorRefs: uniqueSorted(affectedActorRefs),
    affectedResourceRefs: uniqueSorted(affectedResourceRefs),
    severity: clampScore(severity),
    urgency: clampScore(severity + 10),
    growthRate: clampScore(Math.floor(severity / 10) + 2),
    uncertainty: 25,
    visibility: 60,
  };
}

function relationDeltaForAction(kind: GovernanceActionKind): number {
  if (kind === "merge_factions") return 18;
  if (kind === "impose_sanction") return -20;
  if (kind === "split_faction") return -15;
  if (kind === "levy_tax") return -6;
  return -4;
}

function applyMetricsCost(metrics: GovernanceScoreVector, cost: GovernanceActionCost): GovernanceScoreVector {
  return {
    legitimacy: clampScore(metrics.legitimacy - (cost.legitimacy ?? 0)),
    administrativeCapacity: clampScore(metrics.administrativeCapacity - (cost.administrativeCapacity ?? 0)),
    cohesion: clampScore(metrics.cohesion - (cost.cohesion ?? 0)),
    corruption: clampScore(metrics.corruption + Math.floor((cost.treasuryMinor ? parseMinor(cost.treasuryMinor) : 0) / 10_000)),
    fiscal: clampScore(metrics.fiscal - Math.floor(parseMinor(cost.treasuryMinor) / 1_000)),
    influence: clampScore(metrics.influence - (cost.influence ?? 0)),
  };
}

function actorFactionId(actorRef: GovernanceActorRef): string | undefined {
  return actorRef.startsWith("faction:") ? actorRef.slice("faction:".length) : undefined;
}

function hasAuthority(action: GovernanceActionProposal): boolean {
  if (action.requiredAuthorityRefs.length === 0) return action.authorizationRefs.length > 0;
  const granted = new Set(action.authorizationRefs);
  return action.requiredAuthorityRefs.every((ref) => granted.has(ref));
}

function withFactionMetrics(
  factions: readonly Faction[],
  factionId: string | undefined,
  update: (metrics: GovernanceScoreVector) => GovernanceScoreVector,
): readonly Faction[] {
  if (!factionId) return factions;
  return factions.map((faction) =>
    faction.factionId === factionId ? { ...faction, metrics: update(faction.metrics) } : faction
  );
}

function validateGovernanceAction(state: GovernanceState, action: GovernanceActionProposal): readonly GovernanceEcologyError[] {
  const errors: GovernanceEcologyError[] = [];
  if (!action.sourceRef) {
    errors.push({ code: "GOVERNANCE_SOURCE_REQUIRED", message: "governance action requires a source ref" });
  }
  if (action.oppositionRefs.length === 0) {
    errors.push({ code: "GOVERNANCE_OPPOSITION_REQUIRED", message: "governance action requires explicit opposition refs" });
  }
  if (!hasAuthority(action)) {
    errors.push({ code: "GOVERNANCE_PERMISSION_DENIED", message: "authorization refs do not satisfy required authority refs", ref: action.actorRef });
  }
  const actorFaction = state.factions.find((faction) => faction.factionId === actorFactionId(action.actorRef));
  if (actorFaction && actorFaction.metrics.fiscal < Math.floor(parseMinor(action.cost.treasuryMinor) / 1_000)) {
    errors.push({ code: "GOVERNANCE_COST_UNFUNDED", message: "actor faction lacks fiscal capacity for action cost", ref: action.actorRef });
  }
  if (action.kind === "resolve_succession") {
    const claim = state.claims.find((candidate) => candidate.claimId === action.targetRef.replace(/^claim:/, ""));
    if (!claim || claim.status !== "asserted") {
      errors.push({ code: "GOVERNANCE_CLAIM_INVALID", message: "succession target claim must exist and be asserted", ref: action.targetRef });
    }
  }
  return errors;
}

export function applyGovernanceAction(input: {
  readonly state: GovernanceState;
  readonly action: GovernanceActionProposal;
}): GovernanceActionResult {
  const action = {
    ...input.action,
    actionId: input.action.actionId ?? deterministicId("governance_action", input.action),
  };
  const errors = validateGovernanceAction(input.state, action);
  if (errors.length > 0) {
    return {
      status: "rejected",
      actionId: action.actionId,
      errors,
      state: input.state,
      effects: [],
      pressureSignals: [
        pressureSignal("policy_backlash", action.targetRef, action.worldMinute, action.sourceEventIds, 35, [action.actorRef]),
      ],
    };
  }

  let next: GovernanceState = {
    factions: withFactionMetrics(input.state.factions, actorFactionId(action.actorRef), (metrics) =>
      applyMetricsCost(metrics, action.cost)
    ),
    institutions: input.state.institutions,
    jurisdictions: input.state.jurisdictions,
    laws: input.state.laws,
    policies: input.state.policies,
    offices: input.state.offices,
    claims: input.state.claims,
    obligations: input.state.obligations,
  };
  const effects: CausalEffectV1[] = [];
  const pressureSignals: EpochWorldPressureFactSignal[] = [];

  if (action.kind === "appoint_office") {
    next = {
      ...next,
      offices: next.offices.map((office) =>
        `office:${office.officeId}` === action.targetRef
          ? { ...office, holderRef: String(action.payload?.holderRef ?? action.actorRef) as GovernanceActorRef, status: "active" }
          : office
      ),
    };
    effects.push(governanceEffect(action, "legal_delta", action.targetRef, "appoint_office", {
      holderRef: action.payload?.holderRef ?? action.actorRef,
      status: "active",
      sourceRef: action.sourceRef,
    }));
  } else if (action.kind === "enact_law" || action.kind === "amend_law" || action.kind === "repeal_law") {
    const toState = action.kind === "repeal_law" ? "repealed" : "active";
    next = {
      ...next,
      laws: next.laws.map((law) =>
        `law:${law.lawId}` === action.targetRef
          ? {
            ...law,
            status: toState,
            enactedAtWorldMinute: toState === "active" ? action.worldMinute : law.enactedAtWorldMinute,
            repealedAtWorldMinute: toState === "repealed" ? action.worldMinute : law.repealedAtWorldMinute,
          }
          : law
      ),
    };
    effects.push(governanceEffect(action, "legal_delta", action.targetRef, action.kind, {
      status: toState,
      sourceRef: action.sourceRef,
      worldMinute: action.worldMinute,
    }));
  } else if (action.kind === "adopt_policy") {
    next = {
      ...next,
      policies: next.policies.map((policy) =>
        `policy:${policy.policyId}` === action.targetRef
          ? {
            ...policy,
            status: "active",
            publicServiceCapacity: clampScore(policy.publicServiceCapacity + clampInt(Number(action.payload?.capacityDelta ?? 0), -100, 100)),
          }
          : policy
      ),
    };
    effects.push(governanceEffect(action, "legal_delta", action.targetRef, "adopt_policy", {
      status: "active",
      capacityDelta: clampInt(Number(action.payload?.capacityDelta ?? 0), -100, 100),
      sourceRef: action.sourceRef,
    }));
  } else if (action.kind === "levy_tax") {
    const amountMinor = Math.max(0, parseMinor(String(action.payload?.amountMinor ?? "0")));
    const treasuryRef = String(action.payload?.treasuryRef ?? action.actorRef);
    effects.push(resourceEffect(action, action.targetRef, "tax_revenue", [
      { accountRef: action.targetRef, quantityMinor: String(-amountMinor) },
      { accountRef: treasuryRef, quantityMinor: String(amountMinor) },
    ], "levy_tax"));
    pressureSignals.push(pressureSignal("policy_backlash", action.targetRef, action.worldMinute, action.sourceEventIds, Math.floor(amountMinor / 1_000), [action.targetRef]));
  } else if (action.kind === "impose_sanction") {
    effects.push(governanceEffect(action, "legal_delta", action.targetRef, "impose_sanction", {
      sanctionClass: String(action.payload?.sanctionClass ?? "restricted"),
      sourceRef: action.sourceRef,
      status: "active",
    }));
  } else if (action.kind === "resolve_succession") {
    next = {
      ...next,
      claims: next.claims.map((claim) =>
        `claim:${claim.claimId}` === action.targetRef
          ? { ...claim, status: "recognized" }
          : claim.targetRef === String(action.payload?.successionTargetRef ?? "")
            ? { ...claim, status: "superseded" }
            : claim
      ),
    };
    effects.push(governanceEffect(action, "legal_delta", action.targetRef, "resolve_succession", {
      status: "recognized",
      successionTargetRef: action.payload?.successionTargetRef,
      sourceRef: action.sourceRef,
    }));
  } else if (action.kind === "split_faction") {
    next = {
      ...next,
      factions: next.factions.map((faction) =>
        `faction:${faction.factionId}` === action.targetRef ? { ...faction, status: "split", metrics: { ...faction.metrics, cohesion: clampScore(faction.metrics.cohesion - 25) } } : faction
      ),
    };
    pressureSignals.push(pressureSignal("legitimacy_loss", action.targetRef, action.worldMinute, action.sourceEventIds, 45, [action.targetRef]));
    effects.push(governanceEffect(action, "state_transition", action.targetRef, "split_faction", {
      stateMachineId: "faction.lifecycle",
      fromState: "active",
      toState: "split",
      transitionId: action.actionId,
      reasonCode: "governance_split",
    }));
  } else if (action.kind === "merge_factions") {
    next = {
      ...next,
      factions: next.factions.map((faction) =>
        action.oppositionRefs.includes(`faction:${faction.factionId}`)
          ? { ...faction, status: "merged", metrics: { ...faction.metrics, influence: clampScore(faction.metrics.influence + 8) } }
          : faction
      ),
    };
    effects.push(governanceEffect(action, "state_transition", action.targetRef, "merge_factions", {
      stateMachineId: "faction.lifecycle",
      fromState: "active",
      toState: "merged",
      transitionId: action.actionId,
      reasonCode: "governance_merge",
    }));
  }

  for (const oppositionRef of action.oppositionRefs) {
    effects.push(governanceEffect(action, "relationship_delta", `${action.actorRef}->${oppositionRef}`, "governance_relation_shift", {
      leftRef: action.actorRef,
      rightRef: oppositionRef,
      delta: relationDeltaForAction(action.kind),
      sourceRef: action.sourceRef,
    }));
  }

  if ((action.cost.treasuryMinor ?? "0") !== "0") {
    effects.push(resourceEffect(action, action.actorRef, "governance_budget", [
      { accountRef: action.actorRef, quantityMinor: String(-Math.max(0, parseMinor(action.cost.treasuryMinor))) },
    ], "spend_governance_budget", { destructionSinkRef: `governance_cost:${action.actionId}` }));
  }

  const oppositionSeverity = clampScore(action.oppositionRefs.length * 12 + (action.cost.legitimacy ?? 0));
  if (oppositionSeverity >= 25) {
    pressureSignals.push(pressureSignal("policy_backlash", action.targetRef, action.worldMinute, action.sourceEventIds, oppositionSeverity, action.oppositionRefs));
  }

  return {
    status: "accepted",
    actionId: action.actionId,
    errors: [],
    state: sortGovernanceState(next),
    effects: effects.sort((left, right) => left.effectId.localeCompare(right.effectId)),
    pressureSignals: pressureSignals.sort((left, right) => left.signalId.localeCompare(right.signalId)),
  };
}

export function sortGovernanceState(state: GovernanceState): GovernanceState {
  return {
    factions: [...state.factions].sort((left, right) => left.factionId.localeCompare(right.factionId)),
    institutions: [...state.institutions].sort((left, right) => left.institutionId.localeCompare(right.institutionId)),
    jurisdictions: [...state.jurisdictions].sort((left, right) => left.jurisdictionId.localeCompare(right.jurisdictionId)),
    laws: [...state.laws].sort((left, right) => left.lawId.localeCompare(right.lawId)),
    policies: [...state.policies].sort((left, right) => left.policyId.localeCompare(right.policyId)),
    offices: [...state.offices].sort((left, right) => left.officeId.localeCompare(right.officeId)),
    claims: [...state.claims].sort((left, right) => left.claimId.localeCompare(right.claimId)),
    obligations: [...state.obligations].sort((left, right) => left.obligationId.localeCompare(right.obligationId)),
  };
}

function stockKey(stock: Pick<RegionResourceStock, "regionId" | "resourceKey">): string {
  return `${stock.regionId}:${stock.resourceKey}`;
}

function populationKey(population: Pick<SpeciesPopulation, "regionId" | "speciesId">): string {
  return `${population.regionId}:${population.speciesId}`;
}

function ecologyEffect(
  kind: "resource_stock" | "species_population",
  targetRef: string,
  operation: string,
  after: Readonly<Record<string, unknown>>,
  sourceEventIds: readonly string[],
): CausalEffectV1 {
  return {
    effectId: deterministicId("effect", { kind, targetRef, operation, after }),
    effectType: kind === "resource_stock" ? "resource_ledger" : "world_predicate",
    targetRef: entityRef(targetRef),
    operation,
    after: kind === "resource_stock"
      ? {
        resourceKey: String(after.resourceKey ?? "ecology_stock"),
        resourceClass: "ecology",
        unit: "minor",
        entries: [
          { accountRef: targetRef, quantityMinor: String(after.delta ?? 0) },
        ],
        ...(
          Number(after.delta ?? 0) > 0
            ? { creationSourceRef: "ecology:regeneration" }
            : Number(after.delta ?? 0) < 0
              ? { destructionSinkRef: "ecology:extraction_or_loss" }
              : {}
        ),
      }
      : {
        predicateId: deterministicId("predicate", { targetRef, operation }),
        subjectRef: entityRef(targetRef),
        operator: "gte",
        expectedValue: after.population ?? 0,
        evaluationStatus: Number(after.population ?? 0) > 0 ? "true" : "false",
        evaluatedAtWorldMinute: after.worldMinute ?? 0,
      },
    sourceEventIds: uniqueSorted(sourceEventIds),
    authorizationRefs: ["auth:system:ecology_tick"],
  } as CausalEffectV1;
}

export function advanceEcologyTick(input: EcologyTickInput): EcologyTickResult {
  const errors: GovernanceEcologyError[] = [];
  const stockMap = new Map<string, RegionResourceStock>();
  const populationMap = new Map<string, SpeciesPopulation>();
  const pressureSignals: EpochWorldPressureFactSignal[] = [];
  const effects: CausalEffectV1[] = [];

  for (const stock of input.stocks) {
    if (stock.capacity < 0 || stock.stock < 0 || stock.irreversibleThreshold < 0) {
      errors.push({ code: "ECOLOGY_CAPACITY_INVALID", message: "resource stock has invalid capacity or stock", ref: stockKey(stock) });
      continue;
    }
    const key = stockKey(stock);
    const extractionLimit = input.governance?.extractionLimitByRegionResource?.[key] ?? stock.extractionPerTick;
    const restorationBonus = input.governance?.restorationBonusByRegion?.[stock.regionId] ?? 0;
    const pollutionPenalty = input.governance?.pollutionPenaltyByRegion?.[stock.regionId] ?? 0;
    const extraction = clampInt(Math.min(stock.stock, extractionLimit), 0, Number.MAX_SAFE_INTEGER);
    const pollution = clampScore(stock.pollution + pollutionPenalty + Math.floor(extraction / 20));
    const degradation = clampScore(stock.degradation + Math.floor(pollution / 25) - stock.restorationPerTick - restorationBonus);
    const irreversible = stock.irreversible || degradation >= stock.irreversibleThreshold;
    const effectiveCapacity = irreversible
      ? Math.min(stock.capacity, Math.max(0, stock.stock))
      : Math.max(0, stock.capacity - Math.floor(stock.capacity * degradation / 200));
    const regeneration = irreversible ? 0 : clampInt(stock.regenerationPerTick + restorationBonus - Math.floor(pollution / 20), 0, effectiveCapacity);
    const nextStock = clampInt(stock.stock - extraction + regeneration, 0, effectiveCapacity);
    const updated: RegionResourceStock = {
      ...stock,
      stock: nextStock,
      capacity: effectiveCapacity,
      pollution,
      degradation,
      irreversible,
    };
    stockMap.set(key, updated);
    effects.push(ecologyEffect("resource_stock", `region_resource:${key}`, "ecology_stock_tick", {
      resourceKey: stock.resourceKey,
      delta: nextStock - stock.stock,
      stock: nextStock,
      capacity: effectiveCapacity,
      worldMinute: input.worldMinute,
    }, input.sourceEventIds));
    if (pollution >= 40) {
      pressureSignals.push(pressureSignal("pollution", `region:${stock.regionId}`, input.worldMinute, input.sourceEventIds, pollution, [], [`resource:${stock.resourceKey}`]));
    }
    if (effectiveCapacity < stock.capacity || irreversible) {
      pressureSignals.push(pressureSignal("carrying_capacity_loss", `region:${stock.regionId}`, input.worldMinute, input.sourceEventIds, clampScore(100 - Math.floor(effectiveCapacity * 100 / Math.max(1, stock.capacity))), [], [`resource:${stock.resourceKey}`]));
    }
  }

  for (const flow of [...(input.flows ?? [])].sort((left, right) =>
    left.fromRegionId.localeCompare(right.fromRegionId)
    || left.toRegionId.localeCompare(right.toRegionId)
    || String(left.resourceKey ?? left.speciesId).localeCompare(String(right.resourceKey ?? right.speciesId))
  )) {
    const quantity = clampInt(flow.quantity, 0, Number.MAX_SAFE_INTEGER);
    if (flow.resourceKey) {
      const fromKey = `${flow.fromRegionId}:${flow.resourceKey}`;
      const toKey = `${flow.toRegionId}:${flow.resourceKey}`;
      const from = stockMap.get(fromKey);
      const to = stockMap.get(toKey);
      if (!from || !to) {
        errors.push({ code: "ECOLOGY_ENTITY_MISSING", message: "resource flow endpoint missing", ref: `${fromKey}->${toKey}` });
        continue;
      }
      const moved = Math.min(quantity, from.stock, Math.max(0, to.capacity - to.stock));
      stockMap.set(fromKey, { ...from, stock: from.stock - moved });
      stockMap.set(toKey, { ...to, stock: to.stock + moved });
    }
  }

  for (const population of input.populations) {
    if (population.carryingCapacity < 0 || population.population < 0) {
      errors.push({ code: "ECOLOGY_CAPACITY_INVALID", message: "species population has invalid capacity or population", ref: populationKey(population) });
      continue;
    }
    const pressure = relatedStockPressure(stockMap, population.regionId);
    const capacity = clampInt(population.carryingCapacity - Math.floor(population.carryingCapacity * pressure / 200), 0, Number.MAX_SAFE_INTEGER);
    const growth = population.extinct ? 0 : clampInt(population.growthPerTick - Math.floor(pressure / 20), 0, Number.MAX_SAFE_INTEGER);
    const mortality = clampInt(population.mortalityPerTick + Math.floor(pressure / 25), 0, Number.MAX_SAFE_INTEGER);
    const migrationOut = clampInt(Math.min(population.population, population.migrationOutPerTick + Math.floor(Math.max(0, population.population - capacity) / 5)), 0, Number.MAX_SAFE_INTEGER);
    let nextPopulation = clampInt(population.population + growth - mortality - migrationOut, 0, capacity);
    const extinct = population.extinct || nextPopulation <= population.irreversibleMinimum;
    if (extinct) nextPopulation = 0;
    populationMap.set(populationKey(population), {
      ...population,
      population: nextPopulation,
      carryingCapacity: capacity,
      extinct,
    });
    effects.push(ecologyEffect("species_population", `species_population:${populationKey(population)}`, "species_population_tick", {
      population: nextPopulation,
      carryingCapacity: capacity,
      worldMinute: input.worldMinute,
    }, input.sourceEventIds));
    if (capacity < population.carryingCapacity || extinct) {
      pressureSignals.push(pressureSignal("carrying_capacity_loss", `region:${population.regionId}`, input.worldMinute, input.sourceEventIds, extinct ? 90 : clampScore(100 - Math.floor(capacity * 100 / Math.max(1, population.carryingCapacity))), [`species:${population.speciesId}`]));
    }
  }

  for (const flow of [...(input.flows ?? [])].sort((left, right) =>
    left.fromRegionId.localeCompare(right.fromRegionId)
    || left.toRegionId.localeCompare(right.toRegionId)
    || String(left.resourceKey ?? left.speciesId).localeCompare(String(right.resourceKey ?? right.speciesId))
  )) {
    if (!flow.speciesId) continue;
    const quantity = clampInt(flow.quantity, 0, Number.MAX_SAFE_INTEGER);
    const fromKey = `${flow.fromRegionId}:${flow.speciesId}`;
    const toKey = `${flow.toRegionId}:${flow.speciesId}`;
    const from = populationMap.get(fromKey);
    const to = populationMap.get(toKey);
    if (!from || !to || from.extinct || to.extinct) {
      errors.push({ code: "ECOLOGY_ENTITY_MISSING", message: "species flow endpoint missing or extinct", ref: `${fromKey}->${toKey}` });
      continue;
    }
    const preference = from.migrationPreference?.[flow.toRegionId] ?? 50;
    const moved = Math.min(quantity, from.population, Math.max(0, to.carryingCapacity - to.population), Math.floor(quantity * clampScore(preference) / 100));
    populationMap.set(fromKey, { ...from, population: from.population - moved });
    populationMap.set(toKey, { ...to, population: to.population + moved });
  }

  const stocks = [...stockMap.values()].sort((left, right) => stockKey(left).localeCompare(stockKey(right)));
  const populations = [...populationMap.values()].sort((left, right) => populationKey(left).localeCompare(populationKey(right)));
  const conservationErrors = conservationCheck(input, stocks, populations);

  return {
    status: errors.length || conservationErrors.length ? "rejected" : "accepted",
    errors: [...errors, ...conservationErrors],
    stocks,
    populations,
    effects: effects.sort((left, right) => left.effectId.localeCompare(right.effectId)),
    pressureSignals: pressureSignals.sort((left, right) => left.signalId.localeCompare(right.signalId)),
  };
}

function relatedStockPressure(stocks: ReadonlyMap<string, RegionResourceStock>, regionId: string): number {
  const regionStocks = [...stocks.values()].filter((stock) => stock.regionId === regionId);
  if (regionStocks.length === 0) return 0;
  const total = regionStocks.reduce((sum, stock) => {
    const scarcity = 100 - Math.floor(stock.stock * 100 / Math.max(1, stock.capacity));
    return sum + clampScore(Math.max(scarcity, stock.pollution, stock.degradation));
  }, 0);
  return clampScore(Math.floor(total / regionStocks.length));
}

function conservationCheck(
  input: EcologyTickInput,
  stocks: readonly RegionResourceStock[],
  populations: readonly SpeciesPopulation[],
): readonly GovernanceEcologyError[] {
  const errors: GovernanceEcologyError[] = [];
  const stockByKey = new Map(stocks.map((stock) => [stockKey(stock), stock]));
  for (const previous of input.stocks) {
    const next = stockByKey.get(stockKey(previous));
    if (!next) continue;
    if (next.stock < 0 || next.stock > next.capacity) {
      errors.push({ code: "ECOLOGY_CONSERVATION_FAILED", message: "resource stock escaped clamp bounds", ref: stockKey(previous) });
    }
    if (!previous.irreversible && next.irreversible && next.degradation < previous.irreversibleThreshold) {
      errors.push({ code: "ECOLOGY_IRREVERSIBLE_THRESHOLD", message: "irreversible flag changed before threshold", ref: stockKey(previous) });
    }
  }
  const populationByKey = new Map(populations.map((population) => [populationKey(population), population]));
  for (const previous of input.populations) {
    const next = populationByKey.get(populationKey(previous));
    if (!next) continue;
    if (next.population < 0 || next.population > next.carryingCapacity) {
      errors.push({ code: "ECOLOGY_CONSERVATION_FAILED", message: "species population escaped clamp bounds", ref: populationKey(previous) });
    }
  }
  return errors;
}

export function deriveGovernancePressures(state: GovernanceState, worldMinute: number, sourceEventIds: readonly string[]): readonly EpochWorldPressureFactSignal[] {
  const signals: EpochWorldPressureFactSignal[] = [];
  for (const faction of [...state.factions].sort((left, right) => left.factionId.localeCompare(right.factionId))) {
    const scopeRef = `faction:${faction.factionId}`;
    if (faction.metrics.legitimacy < 35) {
      signals.push(pressureSignal("legitimacy_loss", scopeRef, worldMinute, sourceEventIds, 100 - faction.metrics.legitimacy, [scopeRef]));
    }
    if (faction.metrics.corruption > 55) {
      signals.push(pressureSignal("corruption", scopeRef, worldMinute, sourceEventIds, faction.metrics.corruption, [scopeRef]));
    }
    if (faction.metrics.cohesion < 30) {
      signals.push(pressureSignal("trust_collapse", scopeRef, worldMinute, sourceEventIds, 100 - faction.metrics.cohesion, [scopeRef]));
    }
  }
  for (const obligation of [...state.obligations].sort((left, right) => left.obligationId.localeCompare(right.obligationId))) {
    if (obligation.status === "open" && obligation.dueAtWorldMinute !== undefined && obligation.dueAtWorldMinute <= worldMinute) {
      signals.push(pressureSignal("rights_violation", obligation.sourceRef, worldMinute, sourceEventIds, 42, [obligation.beneficiaryRef, obligation.debtorRef]));
    }
  }
  return signals.sort((left, right) => left.signalId.localeCompare(right.signalId));
}
