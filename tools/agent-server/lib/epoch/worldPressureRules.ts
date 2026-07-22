import { createHash } from "node:crypto";

export const EPOCH_WORLD_PRESSURE_RULE_VERSION = "world-pressure.v1";
export const EPOCH_WORLD_PRESSURE_OPPORTUNITY_THRESHOLD = 25;
export const EPOCH_WORLD_PRESSURE_AUTOMATIC_INSTITUTION_RESPONSE_THRESHOLD = 45;
export const EPOCH_WORLD_PRESSURE_CRITICAL_ESCALATION_THRESHOLD = 75;
export const EPOCH_WORLD_PRESSURE_MAX_UNADDRESSED_CRITICAL_WORLD_MINUTES = 4_320;

export const EPOCH_WORLD_PRESSURE_TYPES = [
  "survival",
  "economic",
  "social",
  "political",
  "legal",
  "ecological",
  "military",
  "informational",
  "supernatural",
] as const;

export type EpochWorldPressureType = typeof EPOCH_WORLD_PRESSURE_TYPES[number];

export const EPOCH_WORLD_PRESSURE_STATES = [
  "latent",
  "detected",
  "contested",
  "mobilized",
  "resolving",
  "resolved",
  "transformed",
  "dormant",
  "catastrophic",
] as const;

export type EpochWorldPressureState = typeof EPOCH_WORLD_PRESSURE_STATES[number];
export type EpochWorldPressureSeverityBandId =
  | "background"
  | "local"
  | "serious"
  | "critical"
  | "catastrophic";

export interface EpochWorldPressureSeverityBand {
  readonly id: EpochWorldPressureSeverityBandId;
  readonly min: number;
  readonly max: number;
}

export const EPOCH_WORLD_PRESSURE_SEVERITY_BANDS: readonly EpochWorldPressureSeverityBand[] = [
  { id: "background", min: 0, max: 19 },
  { id: "local", min: 20, max: 39 },
  { id: "serious", min: 40, max: 59 },
  { id: "critical", min: 60, max: 79 },
  { id: "catastrophic", min: 80, max: 100 },
] as const;

export const EPOCH_WORLD_PRESSURE_REVIEW_INTERVAL_WORLD_MINUTES:
  Readonly<Record<EpochWorldPressureSeverityBandId, number>> = {
    background: 10_080,
    local: 1_440,
    serious: 360,
    critical: 60,
    catastrophic: 5,
  };

export const EPOCH_WORLD_PRESSURE_STATE_TRANSITIONS:
  Readonly<Record<EpochWorldPressureState, readonly EpochWorldPressureState[]>> = {
    latent: ["detected", "dormant", "catastrophic"],
    detected: ["contested", "mobilized", "resolving", "dormant", "catastrophic"],
    contested: ["detected", "mobilized", "resolving", "dormant", "catastrophic"],
    mobilized: ["contested", "resolving", "dormant", "catastrophic"],
    resolving: ["mobilized", "resolved", "transformed", "dormant", "catastrophic"],
    resolved: [],
    transformed: [],
    dormant: ["latent", "detected", "catastrophic"],
    catastrophic: ["resolved", "transformed", "dormant"],
  };

export type EpochWorldPressureTerminalState = "resolved" | "transformed";

export interface EpochWorldPressure {
  readonly pressureId: string;
  readonly type: EpochWorldPressureType;
  readonly scopeRef: string;
  readonly sourceFactEventIds: readonly string[];
  readonly affectedActorRefs: readonly string[];
  readonly affectedResourceRefs: readonly string[];
  readonly severity: number;
  readonly urgency: number;
  readonly growthRate: number;
  readonly uncertainty: number;
  readonly visibility: number;
  readonly state: EpochWorldPressureState;
  readonly counterPressureIds: readonly string[];
  readonly openedAtWorldMinute: number;
  readonly updatedAtWorldMinute: number;
  readonly reviewAtWorldMinute: number;
  readonly expiresAtWorldMinute?: number;
  readonly transformedFromPressureIds?: readonly string[];
  readonly transformedToPressureIds?: readonly string[];
  readonly resolvedAtWorldMinute?: number;
}

export const EPOCH_WORLD_PRESSURE_FACT_SIGNAL_KINDS = [
  "food_shortage",
  "water_shortage",
  "medicine_shortage",
  "housing_gap",
  "price_spike",
  "unemployment",
  "debt_default",
  "unpaid_wages",
  "trust_collapse",
  "discrimination",
  "family_conflict",
  "legitimacy_loss",
  "corruption",
  "policy_backlash",
  "rights_violation",
  "case_backlog",
  "sentence_unenforced",
  "pollution",
  "carrying_capacity_loss",
  "disaster_risk",
  "security_breakdown",
  "border_threat",
  "occupation",
  "military_buildup",
  "rumor_spread",
  "secrecy_breach",
  "knowledge_gap",
  "propaganda_conflict",
  "anomaly",
  "rule_fracture",
  "supernatural_contamination",
] as const;

export type EpochWorldPressureFactSignalKind =
  typeof EPOCH_WORLD_PRESSURE_FACT_SIGNAL_KINDS[number];

export interface EpochWorldPressureFactSignal {
  readonly signalId: string;
  readonly kind: EpochWorldPressureFactSignalKind;
  readonly scopeRef: string;
  readonly observedAtWorldMinute: number;
  readonly sourceFactEventIds: readonly string[];
  readonly affectedActorRefs?: readonly string[];
  readonly affectedResourceRefs?: readonly string[];
  readonly severity?: number;
  readonly urgency?: number;
  readonly growthRate?: number;
  readonly uncertainty?: number;
  readonly visibility?: number;
  readonly pressureType?: EpochWorldPressureType;
  readonly expiresAtWorldMinute?: number;
  readonly counterPressureIds?: readonly string[];
}

export interface DeriveEpochWorldPressuresInput {
  readonly signals: readonly EpochWorldPressureFactSignal[];
  readonly existingPressures?: readonly EpochWorldPressure[];
  readonly openedAtWorldMinute?: number;
}

export interface AdvanceEpochWorldPressuresInput {
  readonly pressures: readonly EpochWorldPressure[];
  readonly toWorldMinute: number;
  readonly sourceFactEventIds?: readonly string[];
}

export interface TransitionEpochWorldPressureInput {
  readonly pressure: EpochWorldPressure;
  readonly toState: EpochWorldPressureState;
  readonly worldMinute: number;
  readonly sourceFactEventIds?: readonly string[];
  readonly counterPressureIds?: readonly string[];
  readonly transformedToPressureIds?: readonly string[];
  readonly expiresAtWorldMinute?: number;
}

export interface EpochWorldPressureProjectEventInput {
  readonly eventId?: string;
  readonly eventType:
    | "world_pressure_opened"
    | "world_pressure_updated"
    | "world_pressure_transformed"
    | "world_pressure_closed";
  readonly worldId: string;
  readonly pressure: EpochWorldPressure;
  readonly recordedAt: string;
  readonly causalParentEventIds?: readonly string[];
  readonly actorRefs?: readonly string[];
}

export interface EpochWorldPressureProjectedEvent {
  readonly eventId: string;
  readonly eventType:
    | "world_pressure_opened"
    | "world_pressure_updated"
    | "world_pressure_transformed"
    | "world_pressure_closed";
  readonly schemaVersion: "1.0.0";
  readonly worldId: string;
  readonly occurredAtWorldMinute: number;
  readonly recordedAt: string;
  readonly actorRefs: readonly string[];
  readonly subjectRefs: readonly string[];
  readonly regionRefs: readonly string[];
  readonly causalParentEventIds: readonly string[];
  readonly rootPressureIds: readonly string[];
  readonly payload: EpochWorldPressureEventPayload;
}

export interface EpochWorldPressureEventPayload {
  readonly ruleVersion: typeof EPOCH_WORLD_PRESSURE_RULE_VERSION;
  readonly pressureId: string;
  readonly type: EpochWorldPressureType;
  readonly scopeRef: string;
  readonly state: EpochWorldPressureState;
  readonly sourceFactEventIds: readonly string[];
  readonly affectedActorRefs: readonly string[];
  readonly affectedResourceRefs: readonly string[];
  readonly severity: number;
  readonly urgency: number;
  readonly growthRate: number;
  readonly uncertainty: number;
  readonly visibility: number;
  readonly counterPressureIds: readonly string[];
  readonly openedAtWorldMinute: number;
  readonly updatedAtWorldMinute: number;
  readonly reviewAtWorldMinute: number;
  readonly expiresAtWorldMinute?: number;
  readonly transformedFromPressureIds?: readonly string[];
  readonly transformedToPressureIds?: readonly string[];
  readonly resolvedAtWorldMinute?: number;
}

export interface EpochWorldPressureOpportunitySeed {
  readonly opportunityId: string;
  readonly rootPressureIds: readonly string[];
  readonly beneficiaryRefs: readonly string[];
  readonly oppositionRefs: readonly string[];
  readonly interventionType: string;
  readonly availableEvidenceRefs: readonly string[];
  readonly hiddenInformationRefs: readonly string[];
  readonly worldIntensity: number;
  readonly expiresAtWorldMinute: number;
}

const PRESSURE_TYPE_BY_SIGNAL_KIND:
  Readonly<Record<EpochWorldPressureFactSignalKind, EpochWorldPressureType>> = {
    food_shortage: "survival",
    water_shortage: "survival",
    medicine_shortage: "survival",
    housing_gap: "survival",
    price_spike: "economic",
    unemployment: "economic",
    debt_default: "economic",
    unpaid_wages: "economic",
    trust_collapse: "social",
    discrimination: "social",
    family_conflict: "social",
    legitimacy_loss: "political",
    corruption: "political",
    policy_backlash: "political",
    rights_violation: "legal",
    case_backlog: "legal",
    sentence_unenforced: "legal",
    pollution: "ecological",
    carrying_capacity_loss: "ecological",
    disaster_risk: "ecological",
    security_breakdown: "military",
    border_threat: "military",
    occupation: "military",
    military_buildup: "military",
    rumor_spread: "informational",
    secrecy_breach: "informational",
    knowledge_gap: "informational",
    propaganda_conflict: "informational",
    anomaly: "supernatural",
    rule_fracture: "supernatural",
    supernatural_contamination: "supernatural",
  };

const BASE_METRICS_BY_SIGNAL_KIND:
  Readonly<Record<EpochWorldPressureFactSignalKind, Pick<EpochWorldPressure, "severity" | "urgency" | "growthRate" | "uncertainty" | "visibility">>> = {
    food_shortage: { severity: 48, urgency: 62, growthRate: 7, uncertainty: 22, visibility: 76 },
    water_shortage: { severity: 58, urgency: 72, growthRate: 8, uncertainty: 18, visibility: 82 },
    medicine_shortage: { severity: 44, urgency: 64, growthRate: 6, uncertainty: 26, visibility: 64 },
    housing_gap: { severity: 34, urgency: 38, growthRate: 3, uncertainty: 28, visibility: 58 },
    price_spike: { severity: 36, urgency: 42, growthRate: 5, uncertainty: 34, visibility: 70 },
    unemployment: { severity: 32, urgency: 34, growthRate: 3, uncertainty: 30, visibility: 54 },
    debt_default: { severity: 38, urgency: 46, growthRate: 5, uncertainty: 32, visibility: 48 },
    unpaid_wages: { severity: 35, urgency: 50, growthRate: 4, uncertainty: 24, visibility: 62 },
    trust_collapse: { severity: 42, urgency: 36, growthRate: 5, uncertainty: 46, visibility: 48 },
    discrimination: { severity: 40, urgency: 38, growthRate: 4, uncertainty: 38, visibility: 44 },
    family_conflict: { severity: 25, urgency: 30, growthRate: 2, uncertainty: 42, visibility: 32 },
    legitimacy_loss: { severity: 45, urgency: 44, growthRate: 5, uncertainty: 40, visibility: 58 },
    corruption: { severity: 42, urgency: 34, growthRate: 4, uncertainty: 54, visibility: 28 },
    policy_backlash: { severity: 38, urgency: 48, growthRate: 5, uncertainty: 36, visibility: 68 },
    rights_violation: { severity: 44, urgency: 52, growthRate: 4, uncertainty: 36, visibility: 45 },
    case_backlog: { severity: 30, urgency: 28, growthRate: 2, uncertainty: 24, visibility: 46 },
    sentence_unenforced: { severity: 36, urgency: 34, growthRate: 3, uncertainty: 30, visibility: 40 },
    pollution: { severity: 46, urgency: 44, growthRate: 4, uncertainty: 36, visibility: 52 },
    carrying_capacity_loss: { severity: 50, urgency: 40, growthRate: 5, uncertainty: 42, visibility: 38 },
    disaster_risk: { severity: 55, urgency: 70, growthRate: 7, uncertainty: 48, visibility: 46 },
    security_breakdown: { severity: 56, urgency: 66, growthRate: 7, uncertainty: 34, visibility: 76 },
    border_threat: { severity: 52, urgency: 58, growthRate: 6, uncertainty: 42, visibility: 50 },
    occupation: { severity: 76, urgency: 78, growthRate: 8, uncertainty: 28, visibility: 82 },
    military_buildup: { severity: 44, urgency: 46, growthRate: 6, uncertainty: 48, visibility: 36 },
    rumor_spread: { severity: 28, urgency: 42, growthRate: 7, uncertainty: 60, visibility: 72 },
    secrecy_breach: { severity: 40, urgency: 58, growthRate: 5, uncertainty: 52, visibility: 38 },
    knowledge_gap: { severity: 24, urgency: 30, growthRate: 2, uncertainty: 70, visibility: 24 },
    propaganda_conflict: { severity: 34, urgency: 40, growthRate: 5, uncertainty: 58, visibility: 66 },
    anomaly: { severity: 52, urgency: 58, growthRate: 7, uncertainty: 70, visibility: 34 },
    rule_fracture: { severity: 72, urgency: 82, growthRate: 10, uncertainty: 82, visibility: 30 },
    supernatural_contamination: { severity: 62, urgency: 68, growthRate: 8, uncertainty: 66, visibility: 44 },
  };

const TYPE_GROWTH_BEHAVIOR:
  Readonly<Record<EpochWorldPressureType, { readonly driftPerDay: number; readonly decayPerDay: number; readonly transformAt: number }>> = {
    survival: { driftPerDay: 5, decayPerDay: 1, transformAt: 82 },
    economic: { driftPerDay: 3, decayPerDay: 1, transformAt: 78 },
    social: { driftPerDay: 2, decayPerDay: 2, transformAt: 80 },
    political: { driftPerDay: 3, decayPerDay: 1, transformAt: 76 },
    legal: { driftPerDay: 2, decayPerDay: 1, transformAt: 78 },
    ecological: { driftPerDay: 4, decayPerDay: 1, transformAt: 84 },
    military: { driftPerDay: 5, decayPerDay: 1, transformAt: 74 },
    informational: { driftPerDay: 4, decayPerDay: 4, transformAt: 72 },
    supernatural: { driftPerDay: 6, decayPerDay: 1, transformAt: 70 },
  };

function clampScore(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stableJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function uniqueSorted(values: readonly string[] | undefined): readonly string[] {
  return [...new Set((values ?? []).filter((value) => value.length > 0))].sort();
}

function firstDefinedWorldMinute(signals: readonly EpochWorldPressureFactSignal[], fallback: number): number {
  if (signals.length === 0) return Math.max(0, Math.floor(fallback));
  return Math.max(0, Math.floor(Math.min(...signals.map((signal) => signal.observedAtWorldMinute))));
}

function pressureKey(type: EpochWorldPressureType, scopeRef: string): string {
  return stableJson({ scopeRef, type });
}

function parsePressureKey(key: string): { readonly type: EpochWorldPressureType; readonly scopeRef: string } {
  const parsed = JSON.parse(key) as { readonly type: EpochWorldPressureType; readonly scopeRef: string };
  return parsed;
}

export function epochWorldPressureSeverityBand(severity: number): EpochWorldPressureSeverityBandId {
  const normalized = clampScore(severity, 0);
  return EPOCH_WORLD_PRESSURE_SEVERITY_BANDS.find((band) =>
    normalized >= band.min && normalized <= band.max
  )?.id ?? "catastrophic";
}

export function epochWorldPressureReviewIntervalWorldMinutes(severity: number): number {
  return EPOCH_WORLD_PRESSURE_REVIEW_INTERVAL_WORLD_MINUTES[
    epochWorldPressureSeverityBand(severity)
  ];
}

export function isEpochWorldPressureTerminal(state: EpochWorldPressureState): state is EpochWorldPressureTerminalState {
  return state === "resolved" || state === "transformed";
}

export function isLegalEpochWorldPressureTransition(
  fromState: EpochWorldPressureState,
  toState: EpochWorldPressureState,
): boolean {
  if (fromState === toState) return true;
  return EPOCH_WORLD_PRESSURE_STATE_TRANSITIONS[fromState].includes(toState);
}

export function epochWorldPressureTypeForFactSignal(
  signal: EpochWorldPressureFactSignal,
): EpochWorldPressureType {
  return signal.pressureType ?? PRESSURE_TYPE_BY_SIGNAL_KIND[signal.kind];
}

export function deterministicEpochWorldPressureId(input: {
  readonly type: EpochWorldPressureType;
  readonly scopeRef: string;
  readonly sourceFactEventIds: readonly string[];
}): string {
  const digest = stableHash({
    ruleVersion: EPOCH_WORLD_PRESSURE_RULE_VERSION,
    sourceFactEventIds: uniqueSorted(input.sourceFactEventIds),
    scopeRef: input.scopeRef,
    type: input.type,
  }).slice(0, 24);
  return `world_pressure_${digest}`;
}

export function sortEpochWorldPressures(
  pressures: readonly EpochWorldPressure[],
): readonly EpochWorldPressure[] {
  return [...pressures].sort((left, right) =>
    right.severity - left.severity
    || right.urgency - left.urgency
    || left.reviewAtWorldMinute - right.reviewAtWorldMinute
    || left.pressureId.localeCompare(right.pressureId)
  );
}

export function deriveEpochWorldPressuresFromFactSignals(
  input: DeriveEpochWorldPressuresInput,
): readonly EpochWorldPressure[] {
  const byKey = new Map<string, EpochWorldPressureFactSignal[]>();
  for (const signal of input.signals) {
    const type = epochWorldPressureTypeForFactSignal(signal);
    const key = pressureKey(type, signal.scopeRef);
    byKey.set(key, [...(byKey.get(key) ?? []), signal]);
  }

  const existingByKey = new Map(
    (input.existingPressures ?? [])
      .filter((pressure) => !isEpochWorldPressureTerminal(pressure.state))
      .map((pressure) => [
        pressureKey(pressure.type, pressure.scopeRef),
        pressure,
      ]),
  );

  const pressures: EpochWorldPressure[] = [];
  for (const [key, signals] of byKey) {
    const { type, scopeRef } = parsePressureKey(key);
    const sourceFactEventIds = uniqueSorted(signals.flatMap((signal) => signal.sourceFactEventIds));
    const affectedActorRefs = uniqueSorted(signals.flatMap((signal) => signal.affectedActorRefs ?? []));
    const affectedResourceRefs = uniqueSorted(signals.flatMap((signal) => signal.affectedResourceRefs ?? []));
    const counterPressureIds = uniqueSorted(signals.flatMap((signal) => signal.counterPressureIds ?? []));
    const metrics = signals.map((signal) => ({
      ...BASE_METRICS_BY_SIGNAL_KIND[signal.kind],
      severity: signal.severity ?? BASE_METRICS_BY_SIGNAL_KIND[signal.kind].severity,
      urgency: signal.urgency ?? BASE_METRICS_BY_SIGNAL_KIND[signal.kind].urgency,
      growthRate: signal.growthRate ?? BASE_METRICS_BY_SIGNAL_KIND[signal.kind].growthRate,
      uncertainty: signal.uncertainty ?? BASE_METRICS_BY_SIGNAL_KIND[signal.kind].uncertainty,
      visibility: signal.visibility ?? BASE_METRICS_BY_SIGNAL_KIND[signal.kind].visibility,
    }));
    const metric = (name: keyof typeof metrics[number]) =>
      clampScore(Math.max(...metrics.map((entry) => entry[name])), 0);
    const existing = existingByKey.get(key);
    const openedAtWorldMinute = existing?.openedAtWorldMinute
      ?? firstDefinedWorldMinute(signals, input.openedAtWorldMinute ?? 0);
    const updatedAtWorldMinute = firstDefinedWorldMinute(signals, openedAtWorldMinute);
    const severity = metric("severity");
    const urgency = metric("urgency");
    const state = existing && !isEpochWorldPressureTerminal(existing.state)
      ? existing.state
      : severity >= EPOCH_WORLD_PRESSURE_CRITICAL_ESCALATION_THRESHOLD
        ? "detected"
        : "latent";
    const expiresAtWorldMinute = Math.min(
      ...signals
        .map((signal) => signal.expiresAtWorldMinute)
        .filter((value): value is number => value !== undefined),
    );
    pressures.push({
      pressureId: existing?.pressureId ?? deterministicEpochWorldPressureId({
        type,
        scopeRef,
        sourceFactEventIds,
      }),
      type,
      scopeRef,
      sourceFactEventIds: uniqueSorted([...(existing?.sourceFactEventIds ?? []), ...sourceFactEventIds]),
      affectedActorRefs: uniqueSorted([...(existing?.affectedActorRefs ?? []), ...affectedActorRefs]),
      affectedResourceRefs: uniqueSorted([...(existing?.affectedResourceRefs ?? []), ...affectedResourceRefs]),
      severity,
      urgency,
      growthRate: metric("growthRate"),
      uncertainty: metric("uncertainty"),
      visibility: metric("visibility"),
      state,
      counterPressureIds: uniqueSorted([...(existing?.counterPressureIds ?? []), ...counterPressureIds]),
      openedAtWorldMinute,
      updatedAtWorldMinute,
      reviewAtWorldMinute: updatedAtWorldMinute + epochWorldPressureReviewIntervalWorldMinutes(severity),
      ...(Number.isFinite(expiresAtWorldMinute) ? { expiresAtWorldMinute } : {}),
      ...(existing?.transformedFromPressureIds ? {
        transformedFromPressureIds: existing.transformedFromPressureIds,
      } : {}),
      ...(existing?.transformedToPressureIds ? {
        transformedToPressureIds: existing.transformedToPressureIds,
      } : {}),
      ...(existing?.resolvedAtWorldMinute !== undefined ? {
        resolvedAtWorldMinute: existing.resolvedAtWorldMinute,
      } : {}),
    });
  }

  return sortEpochWorldPressures(pressures);
}

export function transitionEpochWorldPressure(
  input: TransitionEpochWorldPressureInput,
): EpochWorldPressure {
  if (!isLegalEpochWorldPressureTransition(input.pressure.state, input.toState)) {
    throw new Error(`illegal_world_pressure_transition:${input.pressure.state}->${input.toState}`);
  }
  const updatedAtWorldMinute = Math.max(
    input.pressure.updatedAtWorldMinute,
    Math.floor(input.worldMinute),
  );
  const terminal = isEpochWorldPressureTerminal(input.toState);
  const sourceFactEventIds = uniqueSorted([
    ...input.pressure.sourceFactEventIds,
    ...(input.sourceFactEventIds ?? []),
  ]);
  return {
    ...input.pressure,
    state: input.toState,
    sourceFactEventIds,
    counterPressureIds: uniqueSorted([
      ...input.pressure.counterPressureIds,
      ...(input.counterPressureIds ?? []),
    ]),
    transformedToPressureIds: input.transformedToPressureIds
      ? uniqueSorted(input.transformedToPressureIds)
      : input.pressure.transformedToPressureIds,
    updatedAtWorldMinute,
    reviewAtWorldMinute: terminal
      ? Number.MAX_SAFE_INTEGER
      : updatedAtWorldMinute + epochWorldPressureReviewIntervalWorldMinutes(input.pressure.severity),
    expiresAtWorldMinute: input.expiresAtWorldMinute ?? input.pressure.expiresAtWorldMinute,
    resolvedAtWorldMinute: input.toState === "resolved" ? updatedAtWorldMinute : input.pressure.resolvedAtWorldMinute,
  };
}

export function advanceEpochWorldPressures(
  input: AdvanceEpochWorldPressuresInput,
): readonly EpochWorldPressure[] {
  const toWorldMinute = Math.max(0, Math.floor(input.toWorldMinute));
  return sortEpochWorldPressures(input.pressures.map((pressure) => {
    if (isEpochWorldPressureTerminal(pressure.state)) return pressure;
    if (pressure.expiresAtWorldMinute !== undefined && pressure.expiresAtWorldMinute <= toWorldMinute) {
      return transitionEpochWorldPressure({
        pressure,
        toState: pressure.severity >= EPOCH_WORLD_PRESSURE_CRITICAL_ESCALATION_THRESHOLD
          ? "catastrophic"
          : "dormant",
        worldMinute: toWorldMinute,
        sourceFactEventIds: input.sourceFactEventIds,
      });
    }

    const elapsedWorldMinutes = Math.max(0, toWorldMinute - pressure.updatedAtWorldMinute);
    if (elapsedWorldMinutes === 0) return pressure;
    const behavior = TYPE_GROWTH_BEHAVIOR[pressure.type];
    const days = elapsedWorldMinutes / 1_440;
    const unattended = pressure.state === "mobilized" || pressure.state === "resolving";
    const direction = unattended ? -behavior.decayPerDay : behavior.driftPerDay;
    const severity = clampScore(pressure.severity + days * direction * (pressure.growthRate / 5), pressure.severity);
    const urgency = clampScore(pressure.urgency + days * direction, pressure.urgency);
    const uncertainty = clampScore(pressure.uncertainty + (unattended ? -days * 2 : days), pressure.uncertainty);
    const visibility = clampScore(pressure.visibility + days * (pressure.severity >= 60 ? 3 : 1), pressure.visibility);
    const nextState: EpochWorldPressureState =
      severity >= 90 || (
        severity >= EPOCH_WORLD_PRESSURE_CRITICAL_ESCALATION_THRESHOLD
        && toWorldMinute - pressure.openedAtWorldMinute >= EPOCH_WORLD_PRESSURE_MAX_UNADDRESSED_CRITICAL_WORLD_MINUTES
      )
        ? "catastrophic"
        : severity >= behavior.transformAt && pressure.state === "resolving"
          ? "transformed"
          : pressure.state;
    const updated: EpochWorldPressure = {
      ...pressure,
      severity,
      urgency,
      uncertainty,
      visibility,
      updatedAtWorldMinute: toWorldMinute,
      reviewAtWorldMinute: isEpochWorldPressureTerminal(nextState)
        ? Number.MAX_SAFE_INTEGER
        : toWorldMinute + epochWorldPressureReviewIntervalWorldMinutes(severity),
      state: nextState,
      sourceFactEventIds: uniqueSorted([
        ...pressure.sourceFactEventIds,
        ...(input.sourceFactEventIds ?? []),
      ]),
    };
    return updated;
  }));
}

export function pressureMeetsEpochWorldOpportunityThreshold(
  pressure: EpochWorldPressure,
): boolean {
  return !isEpochWorldPressureTerminal(pressure.state)
    && pressure.state !== "dormant"
    && Math.max(pressure.severity, pressure.urgency) >= EPOCH_WORLD_PRESSURE_OPPORTUNITY_THRESHOLD;
}

export function deriveEpochWorldOpportunitySeeds(
  pressures: readonly EpochWorldPressure[],
): readonly EpochWorldPressureOpportunitySeed[] {
  return sortEpochWorldPressures(pressures)
    .filter(pressureMeetsEpochWorldOpportunityThreshold)
    .map((pressure) => {
      const interventionType = `relieve_${pressure.type}_pressure`;
      const opportunityId = `world_opportunity_${stableHash({
        interventionType,
        pressureId: pressure.pressureId,
        ruleVersion: EPOCH_WORLD_PRESSURE_RULE_VERSION,
      }).slice(0, 24)}`;
      return {
        opportunityId,
        rootPressureIds: [pressure.pressureId],
        beneficiaryRefs: pressure.affectedActorRefs,
        oppositionRefs: pressure.counterPressureIds,
        interventionType,
        availableEvidenceRefs: pressure.sourceFactEventIds,
        hiddenInformationRefs: pressure.uncertainty >= 50 ? [`hidden:${pressure.pressureId}`] : [],
        worldIntensity: clampScore(
          pressure.severity * 0.35
          + pressure.urgency * 0.2
          + pressure.growthRate * 0.15
          + pressure.uncertainty * 0.15
          + (100 - pressure.visibility) * 0.15,
          pressure.severity,
        ),
        expiresAtWorldMinute: pressure.reviewAtWorldMinute,
      };
    });
}

export function projectEpochWorldPressureEvent(
  input: EpochWorldPressureProjectEventInput,
): EpochWorldPressureProjectedEvent {
  const regionRefs = input.pressure.scopeRef.startsWith("region:")
    ? [input.pressure.scopeRef.slice("region:".length)]
    : [];
  const eventId = input.eventId ?? `event_${stableHash({
    eventType: input.eventType,
    pressureId: input.pressure.pressureId,
    recordedAt: input.recordedAt,
    worldId: input.worldId,
  }).slice(0, 24)}`;
  return {
    eventId,
    eventType: input.eventType,
    schemaVersion: "1.0.0",
    worldId: input.worldId,
    occurredAtWorldMinute: input.pressure.updatedAtWorldMinute,
    recordedAt: input.recordedAt,
    actorRefs: uniqueSorted(input.actorRefs),
    subjectRefs: uniqueSorted([
      input.pressure.scopeRef,
      ...input.pressure.affectedActorRefs,
      ...input.pressure.affectedResourceRefs,
    ]),
    regionRefs,
    causalParentEventIds: uniqueSorted(input.causalParentEventIds),
    rootPressureIds: [input.pressure.pressureId],
    payload: {
      ruleVersion: EPOCH_WORLD_PRESSURE_RULE_VERSION,
      pressureId: input.pressure.pressureId,
      type: input.pressure.type,
      scopeRef: input.pressure.scopeRef,
      state: input.pressure.state,
      sourceFactEventIds: input.pressure.sourceFactEventIds,
      affectedActorRefs: input.pressure.affectedActorRefs,
      affectedResourceRefs: input.pressure.affectedResourceRefs,
      severity: input.pressure.severity,
      urgency: input.pressure.urgency,
      growthRate: input.pressure.growthRate,
      uncertainty: input.pressure.uncertainty,
      visibility: input.pressure.visibility,
      counterPressureIds: input.pressure.counterPressureIds,
      openedAtWorldMinute: input.pressure.openedAtWorldMinute,
      updatedAtWorldMinute: input.pressure.updatedAtWorldMinute,
      reviewAtWorldMinute: input.pressure.reviewAtWorldMinute,
      ...(input.pressure.expiresAtWorldMinute !== undefined ? {
        expiresAtWorldMinute: input.pressure.expiresAtWorldMinute,
      } : {}),
      ...(input.pressure.transformedFromPressureIds ? {
        transformedFromPressureIds: input.pressure.transformedFromPressureIds,
      } : {}),
      ...(input.pressure.transformedToPressureIds ? {
        transformedToPressureIds: input.pressure.transformedToPressureIds,
      } : {}),
      ...(input.pressure.resolvedAtWorldMinute !== undefined ? {
        resolvedAtWorldMinute: input.pressure.resolvedAtWorldMinute,
      } : {}),
    },
  };
}
