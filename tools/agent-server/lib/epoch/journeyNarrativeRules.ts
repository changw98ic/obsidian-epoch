import type { JourneyActionResolution } from "./journeyActionResolutionRules.ts";

export const JOURNEY_NARRATIVE_STANCES = ["cautious", "hopeful", "concerned", "curious"] as const;
export const JOURNEY_POSTCARD_TONES = ["plain", "warm", "wry"] as const;

export type JourneyNarrativeStance = (typeof JOURNEY_NARRATIVE_STANCES)[number];
export type JourneyPostcardTone = (typeof JOURNEY_POSTCARD_TONES)[number];

export interface JourneyNarrativeEntity {
  readonly entityId: string;
  readonly kind: "person" | "place" | "reward" | "casualty" | "relationship" | "secret" | "organization" | "item" | "event" | "agent";
  readonly displayName: string;
}

export interface JourneyNarrativeFact {
  readonly factId: string;
  readonly text: string;
  readonly entityIds: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface JourneyNarrativeStateChange {
  readonly stateChangeId: string;
  readonly summary: string;
  readonly entityIds: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface JourneyNarrativeRumorFact extends JourneyNarrativeFact {
  readonly status: "unconfirmed";
}

export interface JourneyNarrativeVerificationAnchor {
  readonly url: string;
  readonly journeyId: string;
  readonly episodeId: string;
  readonly fragment: string;
}

export interface JourneyEpisodeStoryBeat {
  readonly phase: "arrival" | "main" | "side" | "return";
  readonly sceneTitle: string;
  readonly scenePremise?: string;
  readonly selectedAction: {
    readonly optionKey?: string;
    readonly label: string;
    readonly intent?: string;
    readonly risk?: "low" | "medium" | "high";
    readonly targetEntityIds?: readonly string[];
    /** Server-signed generated-task binding for task objectives. */
    readonly taskObjectiveId?: string;
    /** Server settlement classification; the client/model cannot supply this field. */
    readonly completionKind?: "complete" | "failed";
    /** Exact server resolution copied from the canonical hosted-action event. */
    readonly resolution?: JourneyActionResolution;
  };
  readonly outcomeSummary: string;
}

export interface ServerJourneyEpisodeFacts {
  readonly journeyId: string;
  readonly episodeId: string;
  readonly allowedEntities: readonly JourneyNarrativeEntity[];
  readonly confirmedFacts: readonly JourneyNarrativeFact[];
  readonly rumors: readonly JourneyNarrativeRumorFact[];
  readonly stateChanges: readonly JourneyNarrativeStateChange[];
  readonly sourceEventIds: readonly string[];
  readonly verification: JourneyNarrativeVerificationAnchor;
  readonly storyBeat?: JourneyEpisodeStoryBeat;
}

export interface SamplingNarrativeInterpretationDraft {
  readonly stance: JourneyNarrativeStance;
  readonly factIds: readonly string[];
  readonly entityIds: readonly string[];
}

export interface SamplingJourneyNarrativeDraft {
  readonly confirmedFactIds: readonly string[];
  readonly agentInterpretation: readonly SamplingNarrativeInterpretationDraft[];
  readonly rumorIds: readonly string[];
  readonly stateChangeIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly postcard?: {
    readonly tone: JourneyPostcardTone;
    readonly factIds: readonly string[];
    readonly entityIds: readonly string[];
  };
}

export interface GroundedJourneyInterpretation {
  readonly stance: JourneyNarrativeStance;
  readonly text: string;
  readonly factIds: readonly string[];
  readonly entityIds: readonly string[];
}

export interface GroundedJourneyRumor {
  readonly rumorId: string;
  readonly status: "unconfirmed";
  readonly text: string;
  readonly entityIds: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface GroundedJourneyPostcard {
  readonly text: string;
  readonly factIds: readonly string[];
  readonly entityIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly verification: JourneyNarrativeVerificationAnchor;
}

export interface GroundedJourneyNarrative {
  readonly kind: "grounded_narrative";
  readonly confirmedFacts: readonly JourneyNarrativeFact[];
  readonly agentInterpretation: readonly GroundedJourneyInterpretation[];
  readonly rumors: readonly GroundedJourneyRumor[];
  readonly stateChanges: readonly JourneyNarrativeStateChange[];
  readonly sourceEventIds: readonly string[];
  readonly verification: JourneyNarrativeVerificationAnchor;
  readonly postcard?: GroundedJourneyPostcard;
}

export interface JourneyNarrativeFactTemplate {
  readonly kind: "structured_fact_template";
  readonly confirmedFacts: readonly JourneyNarrativeFact[];
  readonly agentInterpretation: readonly [];
  readonly rumors: readonly GroundedJourneyRumor[];
  readonly stateChanges: readonly JourneyNarrativeStateChange[];
  readonly sourceEventIds: readonly string[];
  readonly verification: JourneyNarrativeVerificationAnchor;
}

export interface JourneyNarrativeGroundingIssue {
  readonly code: string;
  readonly path: string;
}

export type JourneyNarrativeValidationResult =
  | { readonly ok: true; readonly value: GroundedJourneyNarrative }
  | { readonly ok: false; readonly issues: readonly JourneyNarrativeGroundingIssue[]; readonly value: JourneyNarrativeFactTemplate };

export type PersistedJourneyNarrative = GroundedJourneyNarrative | JourneyNarrativeFactTemplate;

export interface CanonicalJourneyEpisodeFactInput {
  readonly journeyId: string;
  readonly episodeId: string;
  readonly phase: "arrival" | "main" | "side" | "return";
  readonly title: string;
  readonly premise?: string;
  readonly agent: { readonly id: string; readonly displayName?: string };
  readonly worldObjectRefs: readonly { readonly id: string; readonly type: string; readonly label: string }[];
  readonly action: {
    readonly optionKey?: string;
    readonly optionLabel: string;
    readonly intent?: string;
    readonly risk?: "low" | "medium" | "high";
    readonly targetEntityIds?: readonly string[];
    readonly taskObjectiveId?: string;
    readonly completionKind?: "complete" | "failed";
    readonly resolution?: JourneyActionResolution;
    readonly outcomeSummary: string;
    readonly reward?: { readonly resourceId?: string; readonly amount?: number };
  };
  readonly canonicalEventIds: readonly string[];
  readonly sharedWorldImpact?: {
    readonly regionId: string;
    readonly regionLabel: string;
    readonly influenceDelta: number;
    readonly sourceEventIds: readonly string[];
  };
  readonly factionAlignment?: {
    readonly factionId: string;
    readonly factionLabel: string;
    readonly standingDelta: number;
    readonly standingAfter: number;
    readonly routeId: string;
    readonly sourceEventIds: readonly string[];
  };
}

type UnknownRecord = Record<string, unknown>;

const ROOT_KEYS = new Set(["confirmedFactIds", "agentInterpretation", "rumorIds", "stateChangeIds", "sourceEventIds", "postcard"]);
const INTERPRETATION_KEYS = new Set(["stance", "factIds", "entityIds"]);
const POSTCARD_KEYS = new Set(["tone", "factIds", "entityIds"]);
const STANCES: ReadonlySet<string> = new Set(JOURNEY_NARRATIVE_STANCES);
const POSTCARD_TONES: ReadonlySet<string> = new Set(JOURNEY_POSTCARD_TONES);

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: UnknownRecord, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.length > 0)) return undefined;
  if (new Set(value).size !== value.length) return undefined;
  return value;
}

function sameSet(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const expectedSet = new Set(expected);
  return actual.every((value) => expectedSet.has(value));
}

function union(values: readonly (readonly string[])[]): readonly string[] {
  return [...new Set(values.flat())];
}

function entityKind(type: string): JourneyNarrativeEntity["kind"] {
  const normalized = type.trim().toLowerCase();
  if (normalized === "agent") return "agent";
  if (normalized === "npc" || normalized === "person") return "person";
  if (["region", "place", "location", "workplace"].includes(normalized)) return "place";
  if (["organization", "faction"].includes(normalized)) return "organization";
  if (["event", "clue"].includes(normalized)) return "event";
  return "item";
}

function cleanUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/**
 * Converts the authoritative settlement boundary into the only facts a
 * narrative is allowed to reference. Public/client prose is intentionally not
 * accepted as an input here.
 */
export function buildServerJourneyEpisodeFacts(input: CanonicalJourneyEpisodeFactInput): ServerJourneyEpisodeFacts {
  const canonicalEventIds = cleanUnique(input.canonicalEventIds);
  if (!canonicalEventIds.length) throw new Error("journey_narrative_canonical_events_required");
  const agent: JourneyNarrativeEntity = {
    entityId: input.agent.id,
    kind: "agent",
    displayName: input.agent.displayName?.trim() || "该身份",
  };
  const entities = new Map<string, JourneyNarrativeEntity>([[agent.entityId, agent]]);
  for (const ref of input.worldObjectRefs) {
    if (!ref.id.trim() || !ref.label.trim()) continue;
    entities.set(ref.id, { entityId: ref.id, kind: entityKind(ref.type), displayName: ref.label });
  }
  const rewardId = input.action.reward?.resourceId?.trim();
  if (rewardId && Number(input.action.reward?.amount || 0) !== 0) {
    entities.set(`reward:${rewardId}`, { entityId: `reward:${rewardId}`, kind: "reward", displayName: rewardId });
  }
  const entityIds = [...entities.keys()];
  const phaseLabel = { arrival: "抵达", main: "行动", side: "支线", return: "返程" }[input.phase];
  const confirmedFact: JourneyNarrativeFact = {
    factId: `${input.episodeId}:settlement`,
    text: `${agent.displayName}在「${input.title}」的${phaseLabel}片段选择了「${input.action.optionLabel}」；服务器结算：${input.action.outcomeSummary}`,
    entityIds,
    sourceEventIds: canonicalEventIds,
  };
  const stateChanges: JourneyNarrativeStateChange[] = [{
    stateChangeId: `${input.episodeId}:outcome`,
    summary: input.action.outcomeSummary,
    entityIds,
    sourceEventIds: canonicalEventIds,
  }];
  if (rewardId && Number(input.action.reward?.amount || 0) !== 0) {
    stateChanges.push({
      stateChangeId: `${input.episodeId}:reward:${rewardId}`,
      summary: `${rewardId} ${Number(input.action.reward?.amount) > 0 ? "+" : ""}${input.action.reward?.amount}`,
      entityIds: [agent.entityId, `reward:${rewardId}`],
      sourceEventIds: canonicalEventIds,
    });
  }
  if (input.sharedWorldImpact && input.sharedWorldImpact.influenceDelta > 0) {
    const impactSourceEventIds = cleanUnique(input.sharedWorldImpact.sourceEventIds)
      .filter((eventId) => canonicalEventIds.includes(eventId));
    const impactEntityIds = [agent.entityId, input.sharedWorldImpact.regionId]
      .filter((entityId) => entities.has(entityId));
    if (impactSourceEventIds.length > 0 && impactEntityIds.length > 0) {
      stateChanges.push({
        stateChangeId: `${input.episodeId}:shared_world_impact`,
        summary: `服务器已将本次成功行动记为${input.sharedWorldImpact.regionLabel}地区影响 +${Math.floor(input.sharedWorldImpact.influenceDelta)}；该共享记录会影响其他玩家看到的地区状态。`,
        entityIds: impactEntityIds,
        sourceEventIds: impactSourceEventIds,
      });
    }
  }
  if (input.factionAlignment && input.factionAlignment.standingDelta > 0) {
    const alignmentSourceEventIds = cleanUnique(input.factionAlignment.sourceEventIds)
      .filter((eventId) => canonicalEventIds.includes(eventId));
    const alignmentEntityIds = [agent.entityId, input.factionAlignment.factionId]
      .filter((entityId) => entities.has(entityId));
    if (alignmentSourceEventIds.length > 0 && alignmentEntityIds.length === 2) {
      stateChanges.push({
        stateChangeId: `${input.episodeId}:faction_alignment:${input.factionAlignment.routeId}`,
        summary: `身份选择了${input.factionAlignment.factionLabel}对应的路线；服务器阵营声望 +${Math.floor(input.factionAlignment.standingDelta)}，当前为 ${Math.floor(input.factionAlignment.standingAfter)}。该选择会参与后续任务与世界冲突判定。`,
        entityIds: alignmentEntityIds,
        sourceEventIds: alignmentSourceEventIds,
      });
    }
  }
  const fragment = `episode-${encodeURIComponent(input.episodeId)}`;
  return {
    journeyId: input.journeyId,
    episodeId: input.episodeId,
    allowedEntities: [...entities.values()],
    confirmedFacts: [confirmedFact],
    rumors: [],
    stateChanges,
    sourceEventIds: canonicalEventIds,
    verification: {
      url: `/epoch/journey/${encodeURIComponent(input.journeyId)}#${fragment}`,
      journeyId: input.journeyId,
      episodeId: input.episodeId,
      fragment,
    },
    storyBeat: {
      phase: input.phase,
      sceneTitle: input.title.trim(),
      ...(input.premise?.trim() ? { scenePremise: input.premise.trim() } : {}),
      selectedAction: {
        ...(input.action.optionKey?.trim() ? { optionKey: input.action.optionKey.trim() } : {}),
        label: input.action.optionLabel.trim(),
        ...(input.action.intent?.trim() ? { intent: input.action.intent.trim() } : {}),
        ...(input.action.risk ? { risk: input.action.risk } : {}),
        ...(input.action.targetEntityIds?.length
          ? { targetEntityIds: cleanUnique(input.action.targetEntityIds) }
          : {}),
        ...(input.action.taskObjectiveId?.trim()
          ? { taskObjectiveId: input.action.taskObjectiveId.trim() }
          : {}),
        ...(input.action.completionKind ? { completionKind: input.action.completionKind } : {}),
        ...(input.action.resolution ? { resolution: input.action.resolution } : {}),
      },
      outcomeSummary: input.action.outcomeSummary.trim(),
    },
  };
}

export function buildPersistedJourneyNarrative(input: {
  readonly serverFacts: ServerJourneyEpisodeFacts;
  readonly samplingDraft?: unknown;
}): JourneyNarrativeValidationResult {
  const entityIds = cleanUnique(input.serverFacts.confirmedFacts.flatMap((fact) => fact.entityIds));
  const factIds = input.serverFacts.confirmedFacts.map((fact) => fact.factId);
  const deterministicDraft: SamplingJourneyNarrativeDraft = {
    confirmedFactIds: factIds,
    agentInterpretation: factIds.length ? [{ stance: "curious", factIds, entityIds }] : [],
    rumorIds: input.serverFacts.rumors.map((rumor) => rumor.factId),
    stateChangeIds: input.serverFacts.stateChanges.map((change) => change.stateChangeId),
    sourceEventIds: input.serverFacts.sourceEventIds,
    ...(factIds.length ? { postcard: { tone: "warm", factIds, entityIds } } : {}),
  };
  return validateJourneyNarrativeDraft({
    serverFacts: input.serverFacts,
    samplingDraft: input.samplingDraft === undefined ? deterministicDraft : input.samplingDraft,
  });
}

export function journeyNarrativeText(narrative: PersistedJourneyNarrative): string {
  if (narrative.kind === "grounded_narrative" && narrative.postcard?.text) return narrative.postcard.text;
  return narrative.confirmedFacts.map((fact) => fact.text).join("；") || "服务器没有记录可公开的事实。";
}

/** Replays the reference-only draft and accepts only the exact server renderer output. */
export function revalidatePersistedJourneyNarrative(input: {
  readonly serverFacts: unknown;
  readonly narrative: unknown;
}): { readonly serverFacts: ServerJourneyEpisodeFacts; readonly narrative: PersistedJourneyNarrative } | undefined {
  if (!isRecord(input.serverFacts) || !isRecord(input.narrative)) return undefined;
  if (JSON.stringify(input).length > 100_000) return undefined;
  const serverFacts = input.serverFacts as unknown as ServerJourneyEpisodeFacts;
  const narrative = input.narrative;
  try {
    let result: JourneyNarrativeValidationResult;
    if (narrative.kind === "structured_fact_template") {
      result = validateJourneyNarrativeDraft({ serverFacts, samplingDraft: null });
    } else if (narrative.kind === "grounded_narrative"
      && Array.isArray(narrative.confirmedFacts)
      && Array.isArray(narrative.agentInterpretation)
      && Array.isArray(narrative.rumors)
      && Array.isArray(narrative.stateChanges)
      && Array.isArray(narrative.sourceEventIds)) {
      const postcard = isRecord(narrative.postcard) ? narrative.postcard : undefined;
      const postcardTextValue = postcard && typeof postcard.text === "string" ? postcard.text : "";
      const tone: JourneyPostcardTone = postcardTextValue.startsWith("旅途中记下：")
        ? "plain"
        : postcardTextValue.startsWith("这趟路至少证明了：") ? "wry" : "warm";
      result = validateJourneyNarrativeDraft({
        serverFacts,
        samplingDraft: {
          confirmedFactIds: narrative.confirmedFacts.flatMap((fact) =>
            isRecord(fact) && typeof fact.factId === "string" ? [fact.factId] : []),
          agentInterpretation: narrative.agentInterpretation.map((entry) => isRecord(entry) ? {
            stance: entry.stance,
            factIds: entry.factIds,
            entityIds: entry.entityIds,
          } : entry),
          rumorIds: narrative.rumors.flatMap((rumor) =>
            isRecord(rumor) && typeof rumor.rumorId === "string" ? [rumor.rumorId] : []),
          stateChangeIds: narrative.stateChanges.flatMap((change) =>
            isRecord(change) && typeof change.stateChangeId === "string" ? [change.stateChangeId] : []),
          sourceEventIds: narrative.sourceEventIds,
          ...(postcard ? { postcard: {
            tone,
            factIds: postcard.factIds,
            entityIds: postcard.entityIds,
          } } : {}),
        },
      });
    } else {
      return undefined;
    }
    if (JSON.stringify(result.value) !== JSON.stringify(narrative)) return undefined;
    return { serverFacts, narrative: result.value };
  } catch {
    return undefined;
  }
}

function issue(code: string, path: string): JourneyNarrativeGroundingIssue {
  return { code, path };
}

function assertServerFacts(input: ServerJourneyEpisodeFacts): void {
  const nonEmpty = (value: string): boolean => value.trim().length > 0;
  if (!nonEmpty(input.journeyId) || !nonEmpty(input.episodeId)) throw new Error("journey_narrative_server_facts_invalid");
  if (input.verification.journeyId !== input.journeyId || input.verification.episodeId !== input.episodeId) {
    throw new Error("journey_narrative_verification_mismatch");
  }
  const entityIds = input.allowedEntities.map((entity) => entity.entityId);
  const factIds = input.confirmedFacts.map((fact) => fact.factId);
  const rumorIds = input.rumors.map((rumor) => rumor.factId);
  const stateChangeIds = input.stateChanges.map((change) => change.stateChangeId);
  for (const ids of [entityIds, factIds, rumorIds, stateChangeIds, input.sourceEventIds]) {
    if (ids.some((id) => !nonEmpty(id)) || new Set(ids).size !== ids.length) {
      throw new Error("journey_narrative_server_facts_invalid");
    }
  }
  const allowedEntityIds = new Set(entityIds);
  const allowedSourceEventIds = new Set(input.sourceEventIds);
  for (const item of [...input.confirmedFacts, ...input.rumors, ...input.stateChanges]) {
    if (!nonEmpty("text" in item ? item.text : item.summary)) throw new Error("journey_narrative_server_facts_invalid");
    if (item.entityIds.some((id) => !allowedEntityIds.has(id))) throw new Error("journey_narrative_server_entity_unknown");
    if (!item.sourceEventIds.length || item.sourceEventIds.some((id) => !allowedSourceEventIds.has(id))) {
      throw new Error("journey_narrative_server_source_event_unknown");
    }
  }
  if (input.storyBeat) {
    const beat = input.storyBeat;
    const agentName = input.allowedEntities.find((entity) => entity.kind === "agent")?.displayName;
    const phaseLabel = { arrival: "抵达", main: "行动", side: "支线", return: "返程" }[beat.phase];
    const expectedFact = agentName
      ? `${agentName}在「${beat.sceneTitle}」的${phaseLabel}片段选择了「${beat.selectedAction.label}」；服务器结算：${beat.outcomeSummary}`
      : "";
    const outcomeChange = input.stateChanges.find((change) => change.stateChangeId.endsWith(":outcome"));
    if (!["arrival", "main", "side", "return"].includes(beat.phase)
      || !nonEmpty(beat.sceneTitle)
      || !nonEmpty(beat.selectedAction.label)
      || !nonEmpty(beat.outcomeSummary)
      || !expectedFact
      || input.confirmedFacts[0]?.text !== expectedFact
      || outcomeChange?.summary !== beat.outcomeSummary
      || (beat.scenePremise !== undefined && !nonEmpty(beat.scenePremise))
      || (beat.selectedAction.optionKey !== undefined && !nonEmpty(beat.selectedAction.optionKey))
      || (beat.selectedAction.intent !== undefined && !nonEmpty(beat.selectedAction.intent))
      || (beat.selectedAction.risk !== undefined && !["low", "medium", "high"].includes(beat.selectedAction.risk))
      || ((beat.selectedAction.taskObjectiveId === undefined)
        !== (beat.selectedAction.completionKind === undefined))
      || (beat.selectedAction.taskObjectiveId !== undefined
        && (!nonEmpty(beat.selectedAction.taskObjectiveId)
          || !["main", "side"].includes(beat.phase)))
      || (beat.selectedAction.completionKind !== undefined
        && !["complete", "failed"].includes(beat.selectedAction.completionKind))
      || (beat.selectedAction.resolution !== undefined
        && (beat.selectedAction.resolution.authority !== "server"
          || beat.selectedAction.resolution.completionKind !== beat.selectedAction.completionKind
          || !Number.isFinite(beat.selectedAction.resolution.score)
          || !Number.isFinite(beat.selectedAction.resolution.difficulty)
          || !Number.isFinite(beat.selectedAction.resolution.margin)
          || beat.selectedAction.resolution.score - beat.selectedAction.resolution.difficulty
            !== beat.selectedAction.resolution.margin))
      || (beat.selectedAction.targetEntityIds !== undefined
        && (beat.selectedAction.targetEntityIds.some((id) => !allowedEntityIds.has(id))
          || new Set(beat.selectedAction.targetEntityIds).size !== beat.selectedAction.targetEntityIds.length))) {
      throw new Error("journey_narrative_story_beat_invalid");
    }
  }
}

function explicitRumor(rumor: JourneyNarrativeRumorFact): GroundedJourneyRumor {
  return {
    rumorId: rumor.factId,
    status: "unconfirmed",
    text: `【未确认传闻】${rumor.text}`,
    entityIds: rumor.entityIds,
    sourceEventIds: rumor.sourceEventIds,
  };
}

function factTemplate(input: ServerJourneyEpisodeFacts): JourneyNarrativeFactTemplate {
  return {
    kind: "structured_fact_template",
    confirmedFacts: input.confirmedFacts,
    agentInterpretation: [],
    rumors: input.rumors.map(explicitRumor),
    stateChanges: input.stateChanges,
    sourceEventIds: input.sourceEventIds,
    verification: input.verification,
  };
}

function stanceText(stance: JourneyNarrativeStance, factText: string): string {
  const prefix: Readonly<Record<JourneyNarrativeStance, string>> = {
    cautious: "谨慎地看，",
    hopeful: "乐观地看，",
    concerned: "我有些担心：",
    curious: "我很好奇：",
  };
  return `${prefix[stance]}${factText}`;
}

function postcardText(tone: JourneyPostcardTone, factText: string): string {
  const prefix: Readonly<Record<JourneyPostcardTone, string>> = {
    plain: "旅途中记下：",
    warm: "从旅途中寄来：",
    wry: "这趟路至少证明了：",
  };
  return `${prefix[tone]}${factText}`;
}

export function validateJourneyNarrativeDraft(input: {
  readonly serverFacts: ServerJourneyEpisodeFacts;
  readonly samplingDraft: unknown;
}): JourneyNarrativeValidationResult {
  assertServerFacts(input.serverFacts);
  const fallback = factTemplate(input.serverFacts);
  const issues: JourneyNarrativeGroundingIssue[] = [];
  const draft = input.samplingDraft;
  if (!isRecord(draft) || !hasOnlyKeys(draft, ROOT_KEYS)) {
    return { ok: false, issues: [issue("narrative_draft_schema_invalid", "$")], value: fallback };
  }

  const confirmedFactIds = stringArray(draft.confirmedFactIds);
  const rumorIds = stringArray(draft.rumorIds);
  const stateChangeIds = stringArray(draft.stateChangeIds);
  const sourceEventIds = stringArray(draft.sourceEventIds);
  const interpretationDrafts = Array.isArray(draft.agentInterpretation) ? draft.agentInterpretation : undefined;
  if (!confirmedFactIds) issues.push(issue("narrative_confirmed_facts_invalid", "$.confirmedFactIds"));
  if (!rumorIds) issues.push(issue("narrative_rumors_invalid", "$.rumorIds"));
  if (!stateChangeIds) issues.push(issue("narrative_state_changes_invalid", "$.stateChangeIds"));
  if (!sourceEventIds) issues.push(issue("narrative_source_events_invalid", "$.sourceEventIds"));
  if (!interpretationDrafts) issues.push(issue("narrative_interpretation_invalid", "$.agentInterpretation"));

  const factsById = new Map(input.serverFacts.confirmedFacts.map((fact) => [fact.factId, fact]));
  const rumorsById = new Map(input.serverFacts.rumors.map((rumor) => [rumor.factId, rumor]));
  const changesById = new Map(input.serverFacts.stateChanges.map((change) => [change.stateChangeId, change]));
  const allowedEntityIds = new Set(input.serverFacts.allowedEntities.map((entity) => entity.entityId));

  if (confirmedFactIds && !sameSet(confirmedFactIds, [...factsById.keys()])) {
    issues.push(issue("narrative_confirmed_facts_not_exact", "$.confirmedFactIds"));
  }
  if (rumorIds?.some((id) => !rumorsById.has(id))) issues.push(issue("narrative_rumor_unknown", "$.rumorIds"));
  if (stateChangeIds && !sameSet(stateChangeIds, [...changesById.keys()])) {
    issues.push(issue("narrative_state_changes_not_exact", "$.stateChangeIds"));
  }
  if (sourceEventIds && !sameSet(sourceEventIds, input.serverFacts.sourceEventIds)) {
    issues.push(issue("narrative_source_events_not_exact", "$.sourceEventIds"));
  }

  const interpretations: GroundedJourneyInterpretation[] = [];
  for (const [index, candidate] of (interpretationDrafts || []).entries()) {
    const path = `$.agentInterpretation[${index}]`;
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, INTERPRETATION_KEYS)) {
      issues.push(issue("narrative_interpretation_schema_invalid", path));
      continue;
    }
    const stance = typeof candidate.stance === "string" && STANCES.has(candidate.stance)
      ? candidate.stance as JourneyNarrativeStance
      : undefined;
    const factIds = stringArray(candidate.factIds);
    const entityIds = stringArray(candidate.entityIds);
    const facts = factIds?.map((id) => factsById.get(id));
    if (!stance || !factIds?.length || !entityIds || facts?.some((fact) => !fact)) {
      issues.push(issue("narrative_interpretation_reference_invalid", path));
      continue;
    }
    const supportedEntityIds = new Set(union((facts as readonly JourneyNarrativeFact[]).map((fact) => fact.entityIds)));
    if (entityIds.some((id) => !allowedEntityIds.has(id) || !supportedEntityIds.has(id))) {
      issues.push(issue("narrative_entity_not_grounded", `${path}.entityIds`));
      continue;
    }
    interpretations.push({
      stance,
      text: stanceText(stance, (facts as readonly JourneyNarrativeFact[]).map((fact) => fact.text).join("；")),
      factIds,
      entityIds,
    });
  }

  let postcard: GroundedJourneyPostcard | undefined;
  if (draft.postcard !== undefined) {
    const candidate = draft.postcard;
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, POSTCARD_KEYS)) {
      issues.push(issue("narrative_postcard_schema_invalid", "$.postcard"));
    } else {
      const tone = typeof candidate.tone === "string" && POSTCARD_TONES.has(candidate.tone)
        ? candidate.tone as JourneyPostcardTone
        : undefined;
      const factIds = stringArray(candidate.factIds);
      const entityIds = stringArray(candidate.entityIds);
      const facts = factIds?.map((id) => factsById.get(id));
      if (!tone || !factIds?.length || !entityIds || facts?.some((fact) => !fact)) {
        issues.push(issue("narrative_postcard_reference_invalid", "$.postcard"));
      } else {
        const groundedFacts = facts as readonly JourneyNarrativeFact[];
        const supportedEntityIds = new Set(union(groundedFacts.map((fact) => fact.entityIds)));
        if (entityIds.some((id) => !allowedEntityIds.has(id) || !supportedEntityIds.has(id))) {
          issues.push(issue("narrative_entity_not_grounded", "$.postcard.entityIds"));
        } else {
          postcard = {
            text: postcardText(tone, groundedFacts.map((fact) => fact.text).join("；")),
            factIds,
            entityIds,
            sourceEventIds: union(groundedFacts.map((fact) => fact.sourceEventIds)),
            verification: input.serverFacts.verification,
          };
        }
      }
    }
  }

  if (issues.length || !confirmedFactIds || !rumorIds || !stateChangeIds || !sourceEventIds || !interpretationDrafts) {
    return { ok: false, issues, value: fallback };
  }
  return {
    ok: true,
    value: {
      kind: "grounded_narrative",
      confirmedFacts: confirmedFactIds.map((id) => factsById.get(id) as JourneyNarrativeFact),
      agentInterpretation: interpretations,
      rumors: rumorIds.map((id) => explicitRumor(rumorsById.get(id) as JourneyNarrativeRumorFact)),
      stateChanges: stateChangeIds.map((id) => changesById.get(id) as JourneyNarrativeStateChange),
      sourceEventIds,
      verification: input.serverFacts.verification,
      ...(postcard ? { postcard } : {}),
    },
  };
}
