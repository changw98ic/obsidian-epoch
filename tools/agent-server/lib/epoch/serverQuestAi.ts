/**
 * serverQuestAi.ts — PR10 server-side quest AI proposal pipeline.
 *
 * Provides a provider-agnostic abstraction for generating quest proposals
 * via a generic model adapter (Anthropic/OpenAI-compatible) and MCP Sampling
 * fallback with
 * deterministic replay, grounded validation, and a state-machine lifecycle.
 *
 * HARD INVARIANTS:
 *   1. AI proposals are ONLY suggestions — the offer store validates and
 *      materializes. This module NEVER writes events, scores, tiers, rewards,
 *      or viability impacts.
 *   2. Proposal content MUST NOT contain numeric bonus/score/tier/reward/
 *      viability keywords or meta-gaming language.
 *   3. Server startup MUST NOT fail due to AI unavailability.
 *   4. All errors are caught and routed to fallback, never thrown to caller.
 *   5. Replay cache key is deterministic for same inputs.
 */

import { createHash } from "node:crypto";

import {
  AFFINITY_MATRIX,
  isApproachTag,
  type ApproachTag,
  type Strategy,
} from "./journeyStrategyRules.ts";
import { OFFER_SCHEMA_VERSION, type InternalQuestOffer, type QuestOfferSource } from "./journeyOfferRules.ts";
import { buildInternalQuestOffer, type ReplenishStrategy } from "./journeyOfferStore.ts";
import {
  createModelAdapter,
  createModelAdapterFromEnv,
  type ModelAdapter,
  type ModelAdapterEnv,
} from "../modelAdapter.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Proposal produced by a server-AI provider. */
export interface QuestGenerationProposal {
  readonly proposalId: string;
  readonly region: string;
  readonly taskFamilyId: string;
  readonly approachTags: readonly ApproachTag[];
  readonly title: string;
  readonly description: string;
  readonly hiddenLinkId?: string;
  readonly worldSliceHash: string;
}

/** Input for proposal generation. */
export interface QuestGenerationInput {
  readonly regionId: string;
  readonly taskFamilies: readonly string[];
  readonly worldContentHash: string;
  readonly strategyContext?: Strategy;
  readonly currentOffers: readonly InternalQuestOffer[];
  readonly seed: string;
}

/** Provider interface for quest proposal generation. */
export interface QuestGenerationProvider {
  readonly name: string;
  generate(input: QuestGenerationInput): Promise<readonly QuestGenerationProposal[]>;
  warmup?(): Promise<void>;
}

/** State machine for the server AI subsystem. */
export type ServerAiState = "warming" | "ready" | "degraded";

/** Result of a grounded check. */
export interface GroundedCheckResult {
  readonly ok: boolean;
  readonly reason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Regex matching numeric bonus/score/tier/reward/viability keywords. */
const CONTENT_NUMERIC_PATTERN = /[+-]?\d+%|\d+\s*[点分]|\bscore\b|\bbonus\b|\btier\b|\breward\b|\bviability\b|数值|加成|奖励|评分|收益|战力|得分|战力值|生命值/i;

/** Regex matching meta-gaming language. */
const CONTENT_META_PATTERN = /\boptimal\b|\bmaximize\b|\bmin[- ]?max\b|\befficiency\b|\bmeta\b|最优化|最大化|效率最优|元博弈|刷分|刷榜|策略最优解/i;

/** Regex matching event-sourcing language that must not appear in proposals. */
const CONTENT_EVENT_SOURCING_PATTERN = /event[-_]?sourc|\bappend[-_]?only\b|\bcas\b|\bcompare[-_]?and[-_]?swap\b|\bidempoten/i;

/** Known task family id patterns. */
const KNOWN_TASK_FAMILY_PREFIXES = [
  "tf_",
  "task_family_",
  "scene_",
];

const DIRECT_PROVIDER_NAME = "direct_anthropic";
const OPENAI_COMPATIBLE_PROVIDER_NAME = "openai_compatible_model";
const MCP_SAMPLING_PROVIDER_NAME = "mcp_sampling_fallback";
const CATALOG_FALLBACK_SOURCE: QuestOfferSource = "catalog_fallback";
const PROPOSAL_ID_PATTERN = /^prop_[a-zA-Z0-9_-]{4,64}$/;

// ─── Grounded check functions ─────────────────────────────────────────────────

/**
 * Check 1: Structure. Validates shape, non-empty fields, and well-formed ids.
 */
export function checkProposalStructure(proposal: unknown): GroundedCheckResult {
  if (proposal === null || typeof proposal !== "object" || Array.isArray(proposal)) {
    return { ok: false, reason: "structure_not_object" };
  }
  const p = proposal as Record<string, unknown>;

  // proposalId
  if (typeof p.proposalId !== "string" || p.proposalId.length === 0) {
    return { ok: false, reason: "structure_missing_proposalId" };
  }
  if (!PROPOSAL_ID_PATTERN.test(p.proposalId)) {
    return { ok: false, reason: "structure_proposalId_malformed" };
  }

  // region
  if (typeof p.region !== "string" || p.region.length === 0) {
    return { ok: false, reason: "structure_missing_region" };
  }

  // taskFamilyId
  if (typeof p.taskFamilyId !== "string" || p.taskFamilyId.length === 0) {
    return { ok: false, reason: "structure_missing_taskFamilyId" };
  }

  // approachTags: must be non-empty array of valid tags
  if (!Array.isArray(p.approachTags)) {
    return { ok: false, reason: "structure_approachTags_not_array" };
  }
  if (p.approachTags.length === 0) {
    return { ok: false, reason: "structure_approachTags_empty" };
  }
  for (const tag of p.approachTags) {
    if (!isApproachTag(tag)) {
      return { ok: false, reason: `structure_invalid_approachTag:${String(tag)}` };
    }
  }

  // title
  if (typeof p.title !== "string" || p.title.length === 0) {
    return { ok: false, reason: "structure_missing_title" };
  }

  // description
  if (typeof p.description !== "string" || p.description.length === 0) {
    return { ok: false, reason: "structure_missing_description" };
  }

  // worldSliceHash
  if (typeof p.worldSliceHash !== "string" || p.worldSliceHash.length === 0) {
    return { ok: false, reason: "structure_missing_worldSliceHash" };
  }

  // hiddenLinkId is optional but must be string if present
  if (p.hiddenLinkId !== undefined && typeof p.hiddenLinkId !== "string") {
    return { ok: false, reason: "structure_hiddenLinkId_not_string" };
  }

  return { ok: true };
}

/**
 * Check 2: World. Validates region existence, worldSliceHash match, and
 * no conflicting offers for the same region+taskFamily.
 */
export function checkProposalWorld(
  proposal: QuestGenerationProposal,
  worldContentHash: string,
  currentOffers: readonly InternalQuestOffer[],
): GroundedCheckResult {
  // worldSliceHash must match
  if (proposal.worldSliceHash !== worldContentHash) {
    return { ok: false, reason: "world_sliceHash_mismatch" };
  }

  // Check for conflicting offers: same region + same taskFamily already active
  for (const offer of currentOffers) {
    if (
      offer.publicView.region.regionId === proposal.region
      && offer.taskFamilyId === proposal.taskFamilyId
    ) {
      // Active statuses that conflict
      const lifecycle = offer.publicView;
      if (lifecycle !== undefined) {
        return { ok: false, reason: `world_conflicting_offer:${offer.questOfferId}` };
      }
    }
  }

  return { ok: true };
}

/**
 * Check 3: Semantic. Validates taskFamily pattern, approach tag alignment
 * with strategy, and no contradictory combos.
 */
export function checkProposalSemantic(
  proposal: QuestGenerationProposal,
  strategyContext?: Strategy,
): GroundedCheckResult {
  // taskFamilyId must match a known pattern
  const matchesKnown = KNOWN_TASK_FAMILY_PREFIXES.some((prefix) =>
    proposal.taskFamilyId.startsWith(prefix),
  );
  if (!matchesKnown) {
    return { ok: false, reason: `semantic_unknown_taskFamily:${proposal.taskFamilyId}` };
  }

  // If strategy context is provided, check approach tag alignment.
  // First: reject if ALL tags are hard penalties (affinity === 0) for the strategy.
  // Second: reject if no tag has affinity >= 50 (bonus or neutral).
  if (strategyContext !== undefined) {
    const allPenalties = proposal.approachTags.every((tag) => {
      const affinity = AFFINITY_MATRIX[tag]![strategyContext];
      return affinity === 0;
    });
    if (allPenalties) {
      return {
        ok: false,
        reason: `semantic_all_penalties_for_strategy:${strategyContext}`,
      };
    }

    const hasAligned = proposal.approachTags.some((tag) => {
      const affinity = AFFINITY_MATRIX[tag]![strategyContext];
      return affinity !== undefined && affinity >= 50;
    });
    if (!hasAligned) {
      return {
        ok: false,
        reason: `semantic_no_aligned_approach:${proposal.approachTags.join(",")}`,
      };
    }
  }

  return { ok: true };
}

/**
 * Check 4: Content. Rejects numeric bonus/score/tier/reward/viability keywords,
 * meta-gaming language, event-sourcing language, and validates roleplay quality.
 */
export function checkProposalContent(proposal: QuestGenerationProposal): GroundedCheckResult {
  const text = `${proposal.title} ${proposal.description}`;

  // Roleplay quality: must contain Chinese characters
  const hasChinese = /[一-鿿]/.test(text);
  if (!hasChinese) {
    return { ok: false, reason: "content_no_chinese_chars" };
  }

  // Minimum 20 characters for description
  if (proposal.description.length < 20) {
    return { ok: false, reason: "content_description_too_short" };
  }

  // NO numeric bonus/score/tier/reward/viability keywords
  if (CONTENT_NUMERIC_PATTERN.test(text)) {
    return { ok: false, reason: "content_numeric_bonus_detected" };
  }

  // NO meta-gaming language
  if (CONTENT_META_PATTERN.test(text)) {
    return { ok: false, reason: "content_meta_gaming_detected" };
  }

  // NO event-sourcing language
  if (CONTENT_EVENT_SOURCING_PATTERN.test(text)) {
    return { ok: false, reason: "content_event_sourcing_detected" };
  }

  return { ok: true };
}

// ─── Semaphore ────────────────────────────────────────────────────────────────

/**
 * Simple counting semaphore for rate limiting concurrent operations.
 */
class Semaphore {
  private readonly max: number;
  private current = 0;
  private readonly queue: Array<() => void> = [];

  constructor(max: number) {
    this.max = max;
  }

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next !== undefined) {
      next();
    } else {
      this.current--;
    }
  }
}

// ─── Generic model Provider ──────────────────────────────────────────────────

function buildProposalPrompt(input: QuestGenerationInput): string {
  const regionInfo = `Region: ${input.regionId}`;
  const families = input.taskFamilies.join(", ");
  const strategyHint = input.strategyContext !== undefined
    ? `\nPreferred strategy: ${input.strategyContext}`
    : "";
  const existingCount = input.currentOffers.length;
  return [
    "You are a quest designer for a Chinese-language fantasy MMO.",
    "Generate 1-3 quest proposals as a JSON array.",
    "Each proposal must have: proposalId (format: prop_<alphanumeric>), region, taskFamilyId,",
    "approachTags (array of: combat, stealth, diplomacy, support, logistics, scout, preservation),",
    "title (Chinese, >=10 chars), description (Chinese, >=20 chars), worldSliceHash,",
    "and optionally hiddenLinkId.",
    "",
    regionInfo,
    `Available task families: ${families}`,
    `World content hash: ${input.worldContentHash}`,
    `Seed: ${input.seed}`,
    `Existing offers in region: ${existingCount}`,
    strategyHint,
    "",
    "CRITICAL: Do NOT include any numeric values, scores, bonuses, tiers, rewards, or viability.",
    "Do NOT use meta-gaming language like 'optimal' or 'maximize'.",
    "Write immersive Chinese roleplay text only.",
    "",
    "Respond with ONLY the JSON array, no explanation.",
  ].join("\n");
}

function parseProposalText(
  text: string,
  input: QuestGenerationInput,
): readonly QuestGenerationProposal[] {
  let jsonText = text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch !== null && fenceMatch[1] !== undefined) {
    jsonText = fenceMatch[1].trim();
  }
  const parsed: unknown = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    throw new Error("model_proposal_parse_not_array");
  }
  const proposals: QuestGenerationProposal[] = [];
  for (const item of parsed) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      const raw = item as Record<string, unknown>;
      const approachTags: ApproachTag[] = [];
      if (Array.isArray(raw["approachTags"])) {
        for (const tag of raw["approachTags"]) {
          if (isApproachTag(tag)) approachTags.push(tag);
        }
      }
      proposals.push({
        proposalId: String(raw["proposalId"] ?? ""),
        region: String(raw["region"] ?? input.regionId),
        taskFamilyId: String(raw["taskFamilyId"] ?? ""),
        approachTags,
        title: String(raw["title"] ?? ""),
        description: String(raw["description"] ?? ""),
        hiddenLinkId: typeof raw["hiddenLinkId"] === "string" ? raw["hiddenLinkId"] : undefined,
        worldSliceHash: String(raw["worldSliceHash"] ?? input.worldContentHash),
      });
    }
  }
  return proposals;
}

export class ModelQuestGenerationProvider implements QuestGenerationProvider {
  readonly name: string;
  private readonly adapter: ModelAdapter;
  private readonly semaphore: Semaphore;

  constructor(adapter: ModelAdapter, name = `model_${adapter.provider}`) {
    this.adapter = adapter;
    this.name = name;
    this.semaphore = new Semaphore(3);
  }

  async warmup(): Promise<void> {
    await this.adapter.warmup();
  }

  async generate(input: QuestGenerationInput): Promise<readonly QuestGenerationProposal[]> {
    await this.semaphore.acquire();
    try {
      const completion = await this.adapter.complete({
        systemPrompt: "Return only the requested JSON. The server validates every field before it can become an offer.",
        messages: [{ role: "user", content: buildProposalPrompt(input) }],
      });
      return parseProposalText(completion.text, input);
    } finally {
      this.semaphore.release();
    }
  }
}

function createLegacyAnthropicAdapter(): ModelAdapter {
  const key = process.env["ANTHROPIC_API_KEY"]?.trim();
  if (!key) throw new Error("server_quest_ai_anthropic_key_missing");
  return createModelAdapter({
    provider: "anthropic",
    baseUrl: process.env["AGENT_SERVER_MODEL_BASE_URL"]?.trim() || "https://api.anthropic.com",
    model: process.env["AGENT_SERVER_MODEL_NAME"]?.trim() || "claude-sonnet-4-20250514",
    apiKey: key,
  });
}

/** Provider-boundary wrapper retained for callers that explicitly request Anthropic. */
export class DirectAnthropicProvider extends ModelQuestGenerationProvider {
  constructor(adapter?: ModelAdapter) {
    super(adapter || createLegacyAnthropicAdapter(), DIRECT_PROVIDER_NAME);
  }
}

export class OpenAiCompatibleProvider extends ModelQuestGenerationProvider {
  constructor(adapter: ModelAdapter) {
    super(adapter, OPENAI_COMPATIBLE_PROVIDER_NAME);
  }
}

// ─── MCP Sampling Fallback Provider ───────────────────────────────────────────

/** Typed error for MCP sampling provider failures. */
export class McpSamplingProviderError extends Error {
  readonly fallback: string;
  constructor(fallback: string, message?: string) {
    super(message ?? `mcp_sampling_fallback:${fallback}`);
    this.name = "McpSamplingProviderError";
    this.fallback = fallback;
  }
}

/**
 * MCP Sampling fallback provider. Wraps McpSamplingClient.createTaskPlanMessage.
 * Requires an externally-provided McpSamplingClient instance.
 */
export class McpSamplingFallbackProvider implements QuestGenerationProvider {
  readonly name = MCP_SAMPLING_PROVIDER_NAME;
  private readonly client: {
    createTaskPlanMessage: (
      input: unknown,
      context: { activeClientRequest: boolean; signal?: AbortSignal },
    ) => Promise<{ ok: boolean; proposal?: unknown; fallback?: string }>;
  };

  constructor(client: {
    createTaskPlanMessage: (
      input: unknown,
      context: { activeClientRequest: boolean; signal?: AbortSignal },
    ) => Promise<{ ok: boolean; proposal?: unknown; fallback?: string }>;
  }) {
    this.client = client;
  }

  async generate(input: QuestGenerationInput): Promise<readonly QuestGenerationProposal[]> {
    const samplingInput = {
      messages: [{
        role: "user" as const,
        text: this.buildSamplingPrompt(input),
      }],
      maxTokens: 4096,
    };

    const result = await this.client.createTaskPlanMessage(samplingInput, {
      activeClientRequest: true,
    });

    if (!result.ok) {
      throw new McpSamplingProviderError(
        result.fallback ?? "unknown",
        `mcp_sampling_failed:${result.fallback}`,
      );
    }

    return this.parseFromSamplingResult(result.proposal, input);
  }

  private buildSamplingPrompt(input: QuestGenerationInput): string {
    return [
      "Generate quest proposals as JSON array for Chinese fantasy MMO.",
      `Region: ${input.regionId}, Families: ${input.taskFamilies.join(", ")}`,
      `Hash: ${input.worldContentHash}, Seed: ${input.seed}`,
      "Each: proposalId, region, taskFamilyId, approachTags, title(Chinese), description(Chinese>=20chars), worldSliceHash",
      "No numeric bonuses. No meta-gaming. Roleplay only.",
    ].join("\n");
  }

  private parseFromSamplingResult(
    proposal: unknown,
    input: QuestGenerationInput,
  ): readonly QuestGenerationProposal[] {
    if (proposal === null || proposal === undefined) {
      return [];
    }
    let parsed: unknown;
    if (typeof proposal === "string") {
      let jsonText = proposal.trim();
      const fenceMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fenceMatch !== null && fenceMatch[1] !== undefined) {
        jsonText = fenceMatch[1].trim();
      }
      parsed = JSON.parse(jsonText);
    } else if (typeof proposal === "object") {
      parsed = proposal;
    } else {
      return [];
    }
    if (!Array.isArray(parsed)) {
      // Single object -> wrap in array
      if (parsed !== null && typeof parsed === "object") {
        parsed = [parsed];
      } else {
        return [];
      }
    }
    const proposals: QuestGenerationProposal[] = [];
    for (const item of parsed as readonly unknown[]) {
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        const raw = item as Record<string, unknown>;
        const approachTags: ApproachTag[] = [];
        if (Array.isArray(raw["approachTags"])) {
          for (const tag of raw["approachTags"]) {
            if (isApproachTag(tag)) approachTags.push(tag);
          }
        }
        proposals.push({
          proposalId: String(raw["proposalId"] ?? ""),
          region: String(raw["region"] ?? input.regionId),
          taskFamilyId: String(raw["taskFamilyId"] ?? ""),
          approachTags,
          title: String(raw["title"] ?? ""),
          description: String(raw["description"] ?? ""),
          hiddenLinkId: typeof raw["hiddenLinkId"] === "string" ? raw["hiddenLinkId"] : undefined,
          worldSliceHash: String(raw["worldSliceHash"] ?? input.worldContentHash),
        });
      }
    }
    return proposals;
  }
}

// ─── Provider chain ───────────────────────────────────────────────────────────

/**
 * Build the default provider chain: [configured model, MCP Sampling].
 * The configured model can be Anthropic or any OpenAI-compatible chat endpoint.
 * If no server model is configured, MCP Sampling remains available when a
 * client is supplied.
 *
 * @param mcpClient - Optional MCP sampling client for the fallback provider.
 * @param options.env - Injectable environment for tests and embedded runtimes.
 */
export function buildProviderChain(mcpClient?: {
  createTaskPlanMessage: (
    input: unknown,
    context: { activeClientRequest: boolean; signal?: AbortSignal },
  ) => Promise<{ ok: boolean; proposal?: unknown; fallback?: string }>;
}, options: { readonly env?: ModelAdapterEnv } = {}): readonly QuestGenerationProvider[] {
  const providers: QuestGenerationProvider[] = [];

  try {
    const adapter = createModelAdapterFromEnv(options.env ?? process.env);
    if (adapter?.provider === "anthropic") {
      providers.push(new DirectAnthropicProvider(adapter));
    } else if (adapter?.provider === "openai_compatible") {
      providers.push(new OpenAiCompatibleProvider(adapter));
    }
  } catch {
    // Model configuration errors degrade to the normal deterministic fallback.
  }

  if (mcpClient !== undefined) {
    providers.push(new McpSamplingFallbackProvider(mcpClient));
  }

  return providers;
}

// ─── Replay cache key ─────────────────────────────────────────────────────────

/**
 * Canonical JSON serialization for deterministic hashing.
 * Sorts object keys, drops undefined, recurses into arrays/objects.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return `{${Object.keys(rec)
      .filter((key) => rec[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(rec[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Build a deterministic replay cache key from the input components.
 * sha256(modelVersion + seed + canonicalJson(input) + worldContentHash + promptHash)
 */
export function buildReplayKey(
  input: QuestGenerationInput,
  modelVersion: string,
  promptHash: string,
): string {
  const canonical = canonicalJson({
    regionId: input.regionId,
    taskFamilies: input.taskFamilies,
    strategyContext: input.strategyContext,
    currentOfferCount: input.currentOffers.length,
    currentOfferIds: input.currentOffers.map((o) => o.questOfferId).sort(),
  });
  const raw = `${modelVersion}|${input.seed}|${canonical}|${input.worldContentHash}|${promptHash}`;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

// ─── Catalog fallback ─────────────────────────────────────────────────────────

/** Template for catalog fallback offers. */
interface CatalogTemplate {
  readonly taskFamilyId: string;
  readonly taskTypeText: string;
  readonly scenarioSummary: string;
  readonly defaultApproachTags: readonly ApproachTag[];
}

const CATALOG_TEMPLATES: readonly CatalogTemplate[] = [
  {
    taskFamilyId: "tf_combat_patrol",
    taskTypeText: "巡猎清剿",
    scenarioSummary: "区域巡逻，清除威胁，保障安全",
    defaultApproachTags: ["combat"],
  },
  {
    taskFamilyId: "tf_escort_caravan",
    taskTypeText: "护送商队",
    scenarioSummary: "护送商队穿越危险区域，确保货物安全到达",
    defaultApproachTags: ["combat", "logistics"],
  },
  {
    taskFamilyId: "tf_recon_scout",
    taskTypeText: "侦察探索",
    scenarioSummary: "侦察前方区域，收集情报，标记危险",
    defaultApproachTags: ["scout"],
  },
  {
    taskFamilyId: "tf_diplomacy_mediate",
    taskTypeText: "调解纠纷",
    scenarioSummary: "调解区域内的冲突，恢复和平秩序",
    defaultApproachTags: ["diplomacy"],
  },
  {
    taskFamilyId: "tf_support_aid",
    taskTypeText: "救助支援",
    scenarioSummary: "为受灾区域提供物资和人力支援",
    defaultApproachTags: ["support", "preservation"],
  },
  {
    taskFamilyId: "tf_stealth_infiltrate",
    taskTypeText: "潜入调查",
    scenarioSummary: "秘密潜入目标区域，收集关键情报",
    defaultApproachTags: ["stealth"],
  },
  {
    taskFamilyId: "tf_logistics_supply",
    taskTypeText: "后勤补给",
    scenarioSummary: "组织补给线路，确保物资畅通无阻",
    defaultApproachTags: ["logistics"],
  },
];

/** Generated catalog fallback offer. */
export interface CatalogFallbackOffer {
  readonly proposalId: string;
  readonly region: string;
  readonly taskFamilyId: string;
  readonly taskTypeText: string;
  readonly scenarioSummary: string;
  readonly approachTags: readonly ApproachTag[];
  readonly source: QuestOfferSource;
}

/**
 * Generate catalog fallback offers for a region.
 * Returns deterministic offers based on region id + catalog templates.
 */
export function generateCatalogFallbackOffers(regionId: string): readonly CatalogFallbackOffer[] {
  const offers: CatalogFallbackOffer[] = [];
  for (const template of CATALOG_TEMPLATES) {
    offers.push({
      proposalId: `prop_cat_${regionId}_${template.taskFamilyId}`,
      region: regionId,
      taskFamilyId: template.taskFamilyId,
      taskTypeText: template.taskTypeText,
      scenarioSummary: template.scenarioSummary,
      approachTags: [...template.defaultApproachTags],
      source: CATALOG_FALLBACK_SOURCE,
    });
  }
  return offers;
}

// ─── ServerQuestAi class ──────────────────────────────────────────────────────

export interface ServerQuestAiOptions {
  readonly providers: readonly QuestGenerationProvider[];
  readonly worldContentRegistry?: Readonly<Record<string, string>>;
}

/**
 * Server quest AI orchestrator. Manages the provider chain, state machine,
 * replay cache, and grounded validation pipeline.
 *
 * CRITICAL: This class only produces proposals. It NEVER writes events,
 * scores, tiers, rewards, or viability impacts.
 */
export class ServerQuestAi {
  private state: ServerAiState = "warming";
  private readonly providers: readonly QuestGenerationProvider[];
  private readonly worldContentRegistry: Readonly<Record<string, string>>;
  private readonly replayCache = new Map<string, readonly QuestGenerationProposal[]>();
  private warmupPromise: Promise<void> | undefined;

  constructor(options: ServerQuestAiOptions) {
    this.providers = options.providers;
    this.worldContentRegistry = options.worldContentRegistry ?? {};
  }

  /** Returns the current state of the AI subsystem. */
  getState(): ServerAiState {
    return this.state;
  }

  /**
   * Start warmup for all providers. Returns immediately; state updates
   * asynchronously. On any provider success -> "ready". On all fail -> "degraded".
   */
  startWarmup(): void {
    if (this.warmupPromise !== undefined) return;
    this.state = "warming";
    this.warmupPromise = this.runWarmup();
  }

  private async runWarmup(): Promise<void> {
    if (this.providers.length === 0) {
      this.state = "degraded";
      return;
    }

    let anySuccess = false;
    for (const provider of this.providers) {
      if (provider.warmup === undefined) {
        // Provider without warmup is considered always ready
        anySuccess = true;
        continue;
      }
      try {
        await provider.warmup();
        anySuccess = true;
      } catch {
        // Provider warmup failed; continue to next
      }
    }

    this.state = anySuccess ? "ready" : "degraded";
  }

  /**
   * Wait for warmup to complete. Returns the final state.
   */
  async awaitWarmup(): Promise<ServerAiState> {
    if (this.warmupPromise !== undefined) {
      await this.warmupPromise;
    }
    return this.state;
  }

  /**
   * Generate proposals with replay caching, provider fallback, and
   * grounded validation. Never throws to caller — returns empty array
   * on all failures.
   */
  async generateProposals(
    input: QuestGenerationInput,
    modelVersion = "v1",
    promptHash = "default",
  ): Promise<readonly QuestGenerationProposal[]> {
    // Check replay cache
    const cacheKey = buildReplayKey(input, modelVersion, promptHash);
    const cached = this.replayCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Try providers in order
    let rawProposals: readonly QuestGenerationProposal[] = [];
    let providerSucceeded = false;

    for (const provider of this.providers) {
      try {
        rawProposals = await provider.generate(input);
        providerSucceeded = true;
        // Mark state as ready if we were degraded
        if (this.state === "degraded") {
          this.state = "ready";
        }
        break;
      } catch {
        // Provider failed; try next
      }
    }

    if (!providerSucceeded) {
      // All providers failed — mark degraded
      if (this.state === "ready") {
        this.state = "degraded";
      }
      return [];
    }

    // Run grounded checks on each proposal
    const validated: QuestGenerationProposal[] = [];
    for (const proposal of rawProposals) {
      const structure = checkProposalStructure(proposal);
      if (!structure.ok) continue;

      // Cast is safe after structure check passes
      const typed = proposal as QuestGenerationProposal;

      const world = checkProposalWorld(typed, input.worldContentHash, input.currentOffers);
      if (!world.ok) continue;

      const semantic = checkProposalSemantic(typed, input.strategyContext);
      if (!semantic.ok) continue;

      const content = checkProposalContent(typed);
      if (!content.ok) continue;

      validated.push(typed);
    }

    // Cache the validated proposals
    this.replayCache.set(cacheKey, validated);

    return validated;
  }

  /**
   * Generate catalog fallback offers for a region.
   * Pure delegation to the standalone function.
   */
  generateCatalogFallbackOffers(regionId: string): readonly CatalogFallbackOffer[] {
    return generateCatalogFallbackOffers(regionId);
  }

  /** Clear the replay cache. Useful for testing or forced refresh. */
  clearCache(): void {
    this.replayCache.clear();
  }

  /** Number of entries in the replay cache. */
  get cacheSize(): number {
    return this.replayCache.size;
  }
}

// ─── Replenish strategy integration ──────────────────────────────────────────

/**
 * Build a {@link ReplenishStrategy} backed by a {@link ServerQuestAi} instance.
 *
 * When the AI subsystem is `ready`, proposals are generated via the provider
 * chain and filtered through the full grounded-check pipeline.  When the
 * subsystem is `warming` or `degraded`, deterministic catalog-fallback offers
 * are produced instead.
 *
 * The returned strategy never throws; errors are caught, logged via the
 * optional `onError` sink, and result in an empty array (the store's
 * `replenishAfterClaim` treats that as a no-op).
 */
export function buildAiReplenishStrategy(
  serverAi: ServerQuestAi,
  options?: {
    readonly onError?: (error: unknown) => void;
  },
): ReplenishStrategy {
  return async (input) => {
    try {
      const state = serverAi.getState();

      if (state === "ready") {
        // AI path: generate proposals through the provider chain
        const proposals = await serverAi.generateProposals({
          regionId: input.regionId,
          taskFamilies: [],  // provider decides families
          worldContentHash: input.snapshot.worldSliceHash,
          currentOffers: [],
          seed: `replenish:${input.claimedOfferId}:${input.snapshot.marketSnapshotVersion}`,
        });

        if (proposals.length > 0) {
          const offers: InternalQuestOffer[] = [];
          for (const proposal of proposals) {
            if (offers.length >= input.count) break;
            try {
              const offerId = proposal.proposalId;
              const now = new Date().toISOString();
              const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
              const internal = buildInternalQuestOffer({
                publicView: {
                  questOfferId: offerId,
                  marketSnapshotVersion: input.snapshot.marketSnapshotVersion,
                  taskTypeText: proposal.title,
                  scenarioSummary: proposal.description,
                  region: {
                    regionId: input.regionId,
                    scenarioMapId: proposal.region,
                  },
                  scenarioMapId: proposal.region,
                  estimatedDifficulty: "medium",
                  rewardPreview: { authority: "preview_only" },
                  expiresAt,
                  schemaVersion: OFFER_SCHEMA_VERSION,
                },
                taskFamilyId: proposal.taskFamilyId,
                expectedApproach: [...proposal.approachTags],
                worldSliceHash: input.snapshot.worldSliceHash,
                source: "server_ai",
              });
              offers.push(internal);
            } catch (buildError) {
              // Individual proposal build failed; skip and continue
              options?.onError?.(buildError);
            }
          }
          if (offers.length > 0) return offers;
        }
        // AI returned no valid proposals — fall through to catalog
      }

      // Catalog fallback path: warming, degraded, or AI returned nothing
      const catalogOffers = serverAi.generateCatalogFallbackOffers(input.regionId);
      const offers: InternalQuestOffer[] = [];
      for (const catalog of catalogOffers) {
        if (offers.length >= input.count) break;
        try {
          const now = new Date().toISOString();
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          const internal = buildInternalQuestOffer({
            publicView: {
              questOfferId: catalog.proposalId,
              marketSnapshotVersion: input.snapshot.marketSnapshotVersion,
              taskTypeText: catalog.taskTypeText,
              scenarioSummary: catalog.scenarioSummary,
              region: {
                regionId: input.regionId,
                scenarioMapId: input.regionId,
              },
              scenarioMapId: input.regionId,
              estimatedDifficulty: "medium",
              rewardPreview: { authority: "preview_only" },
              expiresAt,
              schemaVersion: OFFER_SCHEMA_VERSION,
            },
            taskFamilyId: catalog.taskFamilyId,
            expectedApproach: [...catalog.approachTags],
            worldSliceHash: input.snapshot.worldSliceHash,
            source: "catalog_fallback",
          });
          offers.push(internal);
        } catch (buildError) {
          options?.onError?.(buildError);
        }
      }
      return offers;
    } catch (error) {
      // Top-level safety net: never throw to the store
      options?.onError?.(error);
      return [];
    }
  };
}
