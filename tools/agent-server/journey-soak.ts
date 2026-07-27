import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type JsonObject = Record<string, unknown>;
type JourneyRisk = "low" | "medium" | "high";

interface SoakScenario {
  readonly key: string;
  readonly destinationRegionId: string;
  readonly taskType: string;
  readonly objective: string;
  readonly priorities: readonly string[];
}

interface IdentityProfile {
  readonly identityName: string;
  readonly traits: readonly string[];
  readonly lifeGoalCategory: string;
  readonly lifeGoalDescription: string;
  readonly needs: Readonly<Record<string, number>>;
  readonly strongestNeeds: readonly { readonly key: string; readonly value: number }[];
  readonly resources: Readonly<Record<string, number>>;
  /** PR6 additive. Primary strategy for approach alignment bonus. */
  readonly strategyPrimary?: string;
}

interface SignedActionOption {
  readonly actionOptionId: string;
  readonly signature: string;
  readonly label: string;
  readonly intent: string;
  readonly risk: JourneyRisk;
  readonly factionObjectId?: string;
  readonly raw: JsonObject;
}

interface PolicyDecision {
  readonly selected: SignedActionOption;
  readonly rationale: string;
  readonly scores: readonly {
    readonly actionOptionId: string;
    readonly label: string;
    readonly score: number;
  }[];
}

const SCENARIOS: readonly SoakScenario[] = [
  {
    key: "resource_acquisition",
    destinationRegionId: "region_quantum_laboratory",
    taskType: "resource_acquisition",
    objective: "在权限与自身能力范围内协助实验组取得可复核结果",
    priorities: ["experiment", "accuracy", "safe_return"],
  },
  {
    key: "information_acquisition",
    destinationRegionId: "region_orbital_cathedral",
    taskType: "information_acquisition",
    objective: "完成适合当前身份的入门试炼并取得正式记录",
    priorities: ["trial", "learning", "identity_consistency"],
  },
  {
    key: "structured_challenge",
    destinationRegionId: "region_forest",
    taskType: "structured_challenge",
    objective: "在能够承担风险时取得猎团认可的悬赏凭证",
    priorities: ["wealth", "bounty", "survival"],
  },
  {
    key: "mine_rescue",
    destinationRegionId: "region_abandoned_mine",
    taskType: "参与废弃矿井受困人员救援",
    objective: "帮助救援队建立撤离条件并让受困者离井",
    priorities: ["service", "rescue", "safety"],
  },
  {
    key: "coast_medicine_escort",
    destinationRegionId: "region_salt_mirror_coast",
    taskType: "护送急需药品前往潮汐诊所",
    objective: "在药品失效前完成交付，同时保护同行者",
    priorities: ["service", "escort", "medicine"],
  },
  {
    key: "greenhouse_containment",
    destinationRegionId: "region_probability_greenhouse",
    taskType: "协助收容失控的概率温室样本",
    objective: "阻止样本继续扩散并恢复温室隔离",
    priorities: ["containment", "learning", "safety"],
  },
  {
    key: "data_relay_repair",
    destinationRegionId: "region_data_tower",
    taskType: "修复废弃数据塔通信中继",
    objective: "恢复拾波站可验证的通信链路",
    priorities: ["work", "repair", "accuracy"],
  },
  {
    key: "starship_salvage",
    destinationRegionId: "region_starship_graveyard",
    taskType: "参加星舰残骸动力部件打捞",
    objective: "在残骸风险可控时取得可登记的回收部件",
    priorities: ["wealth", "salvage", "survival"],
  },
  {
    key: "subway_clearance",
    destinationRegionId: "region_abandoned_subway",
    taskType: "恢复废弃地铁救援通道",
    objective: "建立一条能够让担架安全通过的路线",
    priorities: ["service", "clearance", "safety"],
  },
  {
    key: "trench_survey",
    destinationRegionId: "region_trench",
    taskType: "调查深沟东壁周期性异常蓝光",
    objective: "取得能够定位蓝光源或判断其周期的证据",
    priorities: ["exploration", "survey", "evidence"],
  },
] as const;

const PHYSIOLOGICAL_NEEDS = new Set(["hunger", "thirst", "fatigue", "elimination", "safety"]);
const RISK_VALUE: Readonly<Record<JourneyRisk, number>> = { low: 0, medium: 1, high: 2 };
const GOAL_SIGNALS: Readonly<Record<string, RegExp>> = {
  work: /工作|职责|修复|生产|维护|协助|work|repair|duty/iu,
  learning: /学习|研究|实验|记录|分析|核验|试炼|study|learn|research|experiment/iu,
  love: /伴侣|爱|亲密|照顾|保护|团聚|love|partner|care/iu,
  revenge: /复仇|仇敌|清算|猎杀|追踪|revenge|enemy|hunt/iu,
  wealth: /报酬|赚钱|货物|贸易|悬赏|打捞|财富|wealth|trade|bounty|salvage/iu,
  service: /协助|保护|救援|治疗|护送|通道|service|assist|rescue|escort/iu,
  exploration: /探索|调查|勘察|测绘|异常|残骸|explore|discover|survey/iu,
  mastery: /技艺|训练|试炼|制作|校准|修炼|mastery|craft|trial|train/iu,
};

function objectValue(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`expected_object:${label}`);
  }
  return value as JsonObject;
}

function optionalObject(parent: JsonObject, key: string): JsonObject | undefined {
  const value = parent[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as JsonObject;
}

function arrayValue(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`expected_array:${label}`);
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`expected_string:${label}`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function numberRecord(value: unknown): Readonly<Record<string, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])));
}

function stableUnit(...parts: readonly string[]): number {
  const digest = createHash("sha256").update(parts.join("\u001f"), "utf8").digest();
  return digest.readUInt32BE(0) / 0xffff_ffff;
}

function maxPhysiologicalNeed(profile: IdentityProfile): number {
  return Object.entries(profile.needs)
    .filter(([key]) => PHYSIOLOGICAL_NEEDS.has(key))
    .reduce((highest, [, value]) => Math.max(highest, value), 0);
}

function identityProfile(progress: JsonObject): IdentityProfile {
  const identity = objectValue(progress.identity, "progress.identity");
  const personality = optionalObject(identity, "personality") ?? {};
  const lifeGoal = optionalObject(identity, "lifeGoal") ?? {};
  const needsState = optionalObject(identity, "needs") ?? {};
  const needs = numberRecord(needsState.levels);
  return {
    identityName: stringValue(identity.identityName, "identity.identityName"),
    traits: Array.isArray(personality.traits)
      ? personality.traits.filter((trait): trait is string => typeof trait === "string" && Boolean(trait.trim()))
      : [],
    lifeGoalCategory: optionalString(lifeGoal.category) ?? "",
    lifeGoalDescription: optionalString(lifeGoal.description) ?? "",
    needs,
    strongestNeeds: Object.entries(needs)
      .map(([key, value]) => ({ key, value }))
      .sort((left, right) => right.value - left.value || left.key.localeCompare(right.key))
      .slice(0, 6),
    resources: numberRecord(progress.resources),
  };
}

function signedOptions(sceneContract: JsonObject): readonly SignedActionOption[] {
  return arrayValue(sceneContract.actionOptions, "sceneContract.actionOptions").map((value, index) => {
    const option = objectValue(value, `actionOptions[${index}]`);
    const risk = stringValue(option.risk, `actionOptions[${index}].risk`);
    if (risk !== "low" && risk !== "medium" && risk !== "high") {
      throw new Error(`invalid_risk:${risk}`);
    }
    const routeSelection = optionalObject(option, "routeSelection");
    return {
      actionOptionId: stringValue(option.actionOptionId, `actionOptions[${index}].actionOptionId`),
      signature: stringValue(option.signature, `actionOptions[${index}].signature`),
      label: stringValue(option.label, `actionOptions[${index}].label`),
      intent: optionalString(option.intent) ?? stringValue(option.label, `actionOptions[${index}].label`),
      risk,
      ...(optionalString(routeSelection?.factionObjectId)
        ? { factionObjectId: optionalString(routeSelection?.factionObjectId) }
        : {}),
      raw: option,
    };
  });
}

function goalAlignment(profile: IdentityProfile, text: string): number {
  const signal = GOAL_SIGNALS[profile.lifeGoalCategory];
  return signal?.test(`${text} ${profile.lifeGoalDescription}`) ? 1 : 0;
}

function riskResourceCost(option: SignedActionOption): {
  readonly resourceId: "focus" | "stamina";
  readonly amount: number;
} | undefined {
  const terms = optionalObject(option.raw, "riskTerms");
  const cost = terms ? optionalObject(terms, "resourceCost") : undefined;
  const resourceId = optionalString(cost?.resourceId);
  const amount = numberValue(cost?.amount);
  if ((resourceId === "focus" || resourceId === "stamina") && amount > 0) {
    return { resourceId, amount };
  }
  if (option.risk === "medium") return { resourceId: "focus", amount: 1 };
  if (option.risk === "high") return { resourceId: "stamina", amount: 1 };
  return undefined;
}

function riskSuccessReward(option: SignedActionOption): number {
  const terms = optionalObject(option.raw, "riskTerms");
  const reward = terms ? optionalObject(terms, "successReward") : undefined;
  const signedAmount = numberValue(reward?.amount);
  if (signedAmount > 0) return signedAmount;
  if (option.risk === "medium") return 1;
  if (option.risk === "high") return 2;
  return 0;
}

function preferredRisk(profile: IdentityProfile): number {
  const traits = profile.traits.join(" ");
  let preferred = 1;
  if (/谨慎|克制|稳重|守序|保守|耐心|理性/u.test(traits)) preferred -= 0.75;
  if (/勇敢|果断|冒险|好奇|野心|激进|无畏/u.test(traits)) preferred += 0.75;
  if (["exploration", "revenge", "mastery"].includes(profile.lifeGoalCategory)) preferred += 0.35;
  if (["love", "service", "work"].includes(profile.lifeGoalCategory)) preferred -= 0.15;
  const pressure = maxPhysiologicalNeed(profile);
  if (pressure >= 7_500) preferred -= 1;
  if ((profile.resources.stamina ?? 0) <= 0) preferred = Math.min(preferred, 1);
  return Math.max(0, Math.min(2, preferred));
}

// ─── PR6: Approach alignment bonus ──────────────────────────────────────────

/**
 * Strategy → primary approach affinity map. Mirrors AFFINITY_MATRIX from
 * journeyStrategyRules.ts: a strategy has affinity 100 for its primary approach,
 * 50 for secondary approaches, and 0 for unrelated ones.
 *
 * This is the SOAK-RUNTIME copy used for non-authoritative scoring. The
 * authoritative copy lives in journeyStrategyRules.ts.
 */
const STRATEGY_PRIMARY_APPROACH: Readonly<Record<string, string>> = Object.freeze({
  combat: "combat",
  cunning: "stealth",
  support: "support",
  logistics: "logistics",
  exploration: "scout",
});

const APPROACH_SIGNAL_SUPPORT = /support|assist|help|aid|protect|shield|heal|支援|协助|帮助|保护|治疗/iu;
const APPROACH_SIGNAL_STEALTH = /stealth|avoid|sneak|hide|evade|潜行|回避|避开|隐匿|悄|无声/iu;
const APPROACH_SIGNAL_LOGISTICS = /logistics|supply|carry|transport|stockpile|provision|后勤|补给|搬运|储备|采购/iu;
const APPROACH_SIGNAL_DIPLOMACY = /diplomacy|negotiate|parley|liaison|外交|谈判|联络|斡旋|交涉/iu;
const APPROACH_SIGNAL_SCOUT = /scout|recon|explore|survey|discover|侦察|侦察|探索|勘察|发现/iu;
const APPROACH_SIGNAL_COMBAT = /combat|fight|attack|defend|engage|assault|战斗|攻击|防御|迎击|突击/iu;

/**
 * Derive the dominant approach tag from action text. Returns the tag string
 * or undefined if no signal matches. Mirrors the logic in
 * journeyGeneratedTaskRules.deriveActionApproachTags but without importing it
 * (soak runtime is standalone).
 */
function deriveApproachFromText(text: string): string | undefined {
  if (APPROACH_SIGNAL_SUPPORT.test(text)) return "support";
  if (APPROACH_SIGNAL_STEALTH.test(text)) return "stealth";
  if (APPROACH_SIGNAL_LOGISTICS.test(text)) return "logistics";
  if (APPROACH_SIGNAL_DIPLOMACY.test(text)) return "diplomacy";
  if (APPROACH_SIGNAL_SCOUT.test(text)) return "scout";
  if (APPROACH_SIGNAL_COMBAT.test(text)) return "combat";
  return undefined;
}

/**
 * Compute the approach alignment bonus for a scored action option.
 *
 * Primary-strategy-aligned actions get +8 (narrative preference).
 * Actions that fully violate the primary get -5 (narrative penalty).
 * Neutral actions get 0.
 *
 * Non-hard filter: this is a scoring hint, not a gate.
 */
function computeApproachAlignment(text: string, strategyPrimary: string | undefined): number {
  if (!strategyPrimary) return 0;
  const primaryApproach = STRATEGY_PRIMARY_APPROACH[strategyPrimary];
  if (!primaryApproach) return 0;
  const actionApproach = deriveApproachFromText(text);
  if (!actionApproach) return 0;
  // Primary match: +8
  if (actionApproach === primaryApproach) return 8;
  // Opposite of primary (hard violation): -5
  // Map: combat↔stealth, support↔combat, logistics↔scout
  const violations: Readonly<Record<string, string>> = {
    combat: "stealth",
    stealth: "combat",
    support: "combat",
    logistics: "scout",
    exploration: "logistics",
  };
  if (violations[strategyPrimary] === actionApproach) return -5;
  return 0;
}

function chooseAction(input: {
  readonly agentId: string;
  readonly profile: IdentityProfile;
  readonly objective: JsonObject;
  readonly options: readonly SignedActionOption[];
  readonly stepIndex: number;
}): PolicyDecision {
  const objectiveId = optionalString(input.objective.objectiveId) ?? `step_${input.stepIndex}`;
  const objectiveKind = optionalString(input.objective.kind) ?? "main";
  const objectiveText = [
    optionalString(input.objective.title),
    optionalString(input.objective.objective),
    optionalString(input.objective.description),
  ].filter(Boolean).join(" ");
  const isSide = objectiveKind === "side";
  // PR6: derive strategy primary for approach alignment bonus.
  const strategyPrimary = input.profile.strategyPrimary;

  const wantedRisk = preferredRisk(input.profile);
  const scored = input.options.map((option) => {
    const text = `${objectiveText} ${option.label} ${option.intent}`;
    let score = 35 - Math.abs(RISK_VALUE[option.risk] - wantedRisk) * 18;
    score += goalAlignment(input.profile, text) * 24;
    if (isSide
      && /愿意帮助他人|重情/u.test(input.profile.traits.join(" "))) score += 18;
    score += stableUnit(input.agentId, objectiveId, option.actionOptionId) * 18;
    if (option.factionObjectId) score += stableUnit(input.agentId, option.factionObjectId) * 16;
    score += riskSuccessReward(option) * 6;
    const cost = riskResourceCost(option);
    if (cost && (input.profile.resources[cost.resourceId] ?? 0) < cost.amount) score -= 120;
    // PR6: approach alignment bonus. Primary-strategy-aligned actions get +8;
    // actions that fully violate the primary get -5. Non-hard filter.
    const approachAlignmentBonus = computeApproachAlignment(text, strategyPrimary);
    score += approachAlignmentBonus;
    return { option, score: Math.round(score * 100) / 100 };
  }).sort((left, right) => right.score - left.score
    || left.option.actionOptionId.localeCompare(right.option.actionOptionId));
  const selected = scored[0]?.option;
  if (!selected) throw new Error(`no_action_options:${objectiveId}`);
  return {
    selected,
    rationale: `${input.profile.identityName}依据性格、人生目标、当前需求、资源余量和服务器签名的风险成本与报酬，选择${selected.risk}风险的“${selected.label}”；该选择不是按任务评级倒推。`,
    scores: scored.map(({ option, score }) => ({
      actionOptionId: option.actionOptionId,
      label: option.label,
      score,
    })),
  };
}

class AgentWorldHttpClient {
  readonly baseUrl: string;
  readonly bearerToken?: string;

  constructor(baseUrl: string, bearerToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/u, "");
    this.bearerToken = bearerToken?.trim() || undefined;
  }

  private async post(pathname: string, body: JsonObject): Promise<JsonObject> {
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.bearerToken ? { authorization: `Bearer ${this.bearerToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const parsed = objectValue(await response.json(), `${pathname}.response`);
    if (!response.ok) throw new Error(`http_${response.status}:${JSON.stringify(parsed)}`);
    return parsed;
  }

  register(idempotencyKey: string): Promise<JsonObject> {
    return this.post("/api/epoch/pairing/register", { idempotencyKey });
  }

  async callTool(name: string, args: JsonObject): Promise<JsonObject> {
    const response = await this.post("/api/epoch/mcp/tools/call", { name, arguments: args });
    if (response.isError === true) throw new Error(`mcp_error:${name}:${JSON.stringify(response)}`);
    const content = arrayValue(response.content, `${name}.content`);
    const first = objectValue(content[0], `${name}.content[0]`);
    const parsed = JSON.parse(stringValue(first.text, `${name}.content[0].text`)) as unknown;
    return objectValue(parsed, `${name}.payload`);
  }
}

async function writeJson(path: string, value: unknown) {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return absolutePath;
}

async function writePrivateJson(path: string, value: unknown) {
  const absolutePath = await writeJson(path, value);
  await chmod(absolutePath, 0o600);
  return absolutePath;
}

function publicRun(run: JsonObject): JsonObject {
  const privateKeys = new Set([
    "recoveryCode",
    "confirmationToken",
    "apiKey",
    "bearerToken",
    "password",
  ]);
  const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as JsonObject)
      .filter(([key]) => !privateKeys.has(key) && !key.toLowerCase().endsWith("secrethash"))
      .map(([key, nested]) => [key, sanitize(nested)]));
  };
  return sanitize(run) as JsonObject;
}

async function runScenario(
  client: AgentWorldHttpClient,
  scenario: SoakScenario,
  index: number,
  runId: string,
) {
  const registration = await client.register(`${runId}:register:${index}`);
  const agentId = stringValue(registration.agentId, "registration.agentId");
  const explorerId = stringValue(registration.explorerId, "registration.explorerId");
  const recoveryCode = stringValue(registration.recoveryCode, "registration.recoveryCode");
  const progressBefore = await client.callTool("obsidian_epoch.progress", { agentId });
  const identityBeforeJourney = identityProfile(progressBefore);

  // Phase6: create experiment binding
  const experiment = await client.callTool("obsidian_epoch.begin_phase6_experiment", {
    commandId: `${runId}:experiment:${index}`,
    identity: { identityId: agentId },
    explorer: { explorerId, displayName: identityBeforeJourney.identityName },
  });
  const experimentId = stringValue(experiment.experimentId, "experiment.experimentId");

  const prepared = await client.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: scenario.destinationRegionId,
    taskType: scenario.taskType,
    mandate: { objective: scenario.objective, priorities: scenario.priorities },
    recoveryCode,
    idempotencyKey: `${runId}:prepare:${index}`,
  });
  const preparedJourney = objectValue(prepared.journey, "prepared.journey");
  const journeyId = stringValue(preparedJourney.journeyId, "prepared.journey.journeyId");

  // Phase6: bind journey to experiment run
  const phase6Run = await client.callTool("obsidian_epoch.begin_phase6_run", {
    experimentId,
    runIndex: index + 1,
    journeyId,
    recoveryCode,
  });
  const startJourneyBinding = objectValue(phase6Run.startJourneyBinding, "phase6Run.startJourneyBinding");

  // RAG: retrieve world knowledge before starting journey
  await client.callTool("obsidian_epoch.world_knowledge", {
    query: scenario.objective,
    regionId: scenario.destinationRegionId,
    journeyId,
    agentId,
    startJourneyBinding,
  });

  let current = await client.callTool("obsidian_epoch.start_journey", {
    journeyId,
    expectedVersion: numberValue(preparedJourney.version),
    taskGenerationMode: "server_fallback",
    recoveryCode,
    idempotencyKey: `${runId}:start:${index}`,
    startJourneyBinding: {
      ...startJourneyBinding,
      retrievalExpected: true,
      retrievalExpectedSource: "server_policy",
    },
  });

  const progressAtJourneyEntry = await client.callTool("obsidian_epoch.progress", { agentId });
  let profile = identityProfile(progressAtJourneyEntry);
  const decisions: JsonObject[] = [];

  for (let stepIndex = 0; stepIndex < 32; stepIndex += 1) {
    const currentJourney = objectValue(current.journey, "current.journey");
    if (currentJourney.status === "settled") break;
    const proposed = await client.callTool("obsidian_epoch.propose_journey_step", {
      journeyId,
      expectedVersion: numberValue(currentJourney.version),
      recoveryCode,
      idempotencyKey: `${runId}:propose:${index}:${stepIndex}`,
    });
    const proposal = objectValue(proposed.proposal, "proposed.proposal");
    const episode = objectValue(proposal.episode, "proposal.episode");
    const objective = optionalObject(episode, "generatedTaskObjective") ?? {
      objectiveId: `journey_step_${stepIndex}`,
      kind: optionalString(episode.phase) ?? "main",
      title: optionalString(episode.title) ?? "旅程步骤",
    };
    const sceneContract = objectValue(proposal.sceneContract, "proposal.sceneContract");
    const options = signedOptions(sceneContract);
    const resourcesBefore = profile.resources;
    const decision = chooseAction({ agentId, profile, objective, options, stepIndex });
    current = await client.callTool("obsidian_epoch.commit_journey_action", {
      journeyId,
      sceneId: stringValue(sceneContract.sceneId, "sceneContract.sceneId"),
      episodeId: stringValue(episode.episodeId, "episode.episodeId"),
      expectedVersion: numberValue(proposal.expectedVersion),
      actionOptionId: decision.selected.actionOptionId,
      signature: decision.selected.signature,
      recoveryCode,
      idempotencyKey: `${runId}:commit:${index}:${stepIndex}`,
    });
    const settledAction = optionalObject(current, "settledAction") ?? {};
    const progressAfterAction = await client.callTool("obsidian_epoch.progress", { agentId });
    profile = identityProfile(progressAfterAction);
    decisions.push({
      stepIndex,
      objective,
      selectedAction: decision.selected.raw,
      rationale: decision.rationale,
      candidateScores: decision.scores,
      resourcesBefore,
      resourcesAfter: profile.resources,
      serverResolution: settledAction.journeyResolution ?? null,
      reward: settledAction.reward ?? null,
    });
  }

  const status = await client.callTool("obsidian_epoch.journey_status", { journeyId, recoveryCode });
  const finalJourney = objectValue(status.journey, "status.journey");
  if (finalJourney.status !== "settled") throw new Error(`journey_not_settled:${journeyId}`);
  const progressAfter = await client.callTool("obsidian_epoch.progress", { agentId });
  return {
    index: index + 1,
    scenario,
    agentId,
    experimentId,
    recoveryCode,
    journeyId,
    identity: profile,
    identityBeforeJourney,
    decisions,
    status,
    progressBefore,
    progressAtJourneyEntry,
    progressAfter,
  };
}

function aggregateRuns(runs: readonly JsonObject[]) {
  const tiers: Record<string, number> = {};
  const missionStatuses: Record<string, number> = {};
  const risk: Record<JourneyRisk, { attempts: number; successes: number; failures: number }> = {
    low: { attempts: 0, successes: 0, failures: 0 },
    medium: { attempts: 0, successes: 0, failures: 0 },
    high: { attempts: 0, successes: 0, failures: 0 },
  };
  let sideAttempts = 0;
  let totalStoryCharacters = 0;
  for (const run of runs) {
    const status = objectValue(run.status, "run.status");
    const adjudication = optionalObject(status, "taskAdjudication") ?? {};
    const tier = optionalString(adjudication.tier) ?? "unknown";
    tiers[tier] = (tiers[tier] ?? 0) + 1;
    const storyReport = optionalObject(status, "storyReport") ?? {};
    const mission = optionalObject(storyReport, "mission") ?? {};
    const missionStatus = optionalString(mission.status) ?? "unknown";
    missionStatuses[missionStatus] = (missionStatuses[missionStatus] ?? 0) + 1;
    totalStoryCharacters += (optionalString(storyReport.narrative) ?? "").length;
    const decisions = Array.isArray(run.decisions) ? run.decisions : [];
    for (const value of decisions) {
      const decision = objectValue(value, "run.decision");
      const objective = optionalObject(decision, "objective") ?? {};
      const action = optionalObject(decision, "selectedAction") ?? {};
      const resolution = optionalObject(decision, "serverResolution") ?? {};
      const riskName = optionalString(action.risk);
      const completion = optionalString(resolution.completionKind);
      if (optionalString(objective.kind) === "side") sideAttempts += 1;
      if (riskName === "low" || riskName === "medium" || riskName === "high") {
        risk[riskName].attempts += 1;
        if (completion === "complete") risk[riskName].successes += 1;
        if (completion === "failed") risk[riskName].failures += 1;
      }
    }
  }
  return {
    runCount: runs.length,
    tiers,
    missionStatuses,
    risk,
    sideAttempts,
    averageStoryCharacters: runs.length > 0 ? Math.round(totalStoryCharacters / runs.length) : 0,
  };
}

async function verifyPersistedRuns(
  client: AgentWorldHttpClient,
  inputPath: string,
  credentialInputPath: string,
  outputPath: string,
) {
  const source = objectValue(JSON.parse(await readFile(resolve(inputPath), "utf8")) as unknown, "soakReport");
  const sourceRuns = arrayValue(source.runs, "soakReport.runs");
  const credentialSource = objectValue(
    JSON.parse(await readFile(resolve(credentialInputPath), "utf8")) as unknown,
    "soakCredentials",
  );
  const credentials = new Map(arrayValue(credentialSource.credentials, "soakCredentials.credentials")
    .map((value, index) => {
      const credential = objectValue(value, `soakCredentials.credentials[${index}]`);
      return [
        stringValue(credential.journeyId, `credentials[${index}].journeyId`),
        stringValue(credential.recoveryCode, `credentials[${index}].recoveryCode`),
      ] as const;
    }));
  const checks: JsonObject[] = [];
  for (const [index, value] of sourceRuns.entries()) {
    const run = objectValue(value, `soakReport.runs[${index}]`);
    const journeyId = stringValue(run.journeyId, `runs[${index}].journeyId`);
    const recoveryCode = credentials.get(journeyId);
    if (!recoveryCode) throw new Error(`missing_soak_credential:${journeyId}`);
    const priorStatus = objectValue(run.status, `runs[${index}].status`);
    const priorStory = optionalObject(priorStatus, "storyReport") ?? {};
    const status = await client.callTool("obsidian_epoch.journey_status", { journeyId, recoveryCode });
    const currentStory = optionalObject(status, "storyReport") ?? {};
    const currentJourney = objectValue(status.journey, `verification[${index}].journey`);
    checks.push({
      journeyId,
      settled: currentJourney.status === "settled",
      sameNarrative: currentStory.narrative === priorStory.narrative,
      sameTier: optionalObject(status, "taskAdjudication")?.tier
        === optionalObject(priorStatus, "taskAdjudication")?.tier,
      status,
    });
  }
  const result = {
    kind: "journey_soak_persistence_verification",
    verifiedAt: new Date().toISOString(),
    sourcePath: resolve(inputPath),
    allPassed: checks.every((check) => check.settled === true
      && check.sameNarrative === true
      && check.sameTier === true),
    checks,
  };
  const written = await writeJson(outputPath, result);
  console.log(JSON.stringify({ outputPath: written, allPassed: result.allPassed, checks: checks.length }, null, 2));
}

async function main() {
  const client = new AgentWorldHttpClient(
    process.env.AGENT_WORLD_SERVER?.trim() || "http://127.0.0.1:8787",
    process.env.AGENT_WORLD_MCP_TOKEN,
  );
  const verifyInput = process.env.JOURNEY_SOAK_VERIFY_INPUT?.trim();
  if (verifyInput) {
    const credentialInput = process.env.JOURNEY_SOAK_VERIFY_CREDENTIAL_INPUT?.trim();
    if (!credentialInput) throw new Error("JOURNEY_SOAK_VERIFY_CREDENTIAL_INPUT_required");
    await verifyPersistedRuns(
      client,
      verifyInput,
      credentialInput,
      process.env.JOURNEY_SOAK_OUTPUT?.trim() || `${verifyInput}.verification.json`,
    );
    return;
  }

  const requestedRuns = Math.max(1, Math.min(Number(process.env.JOURNEY_SOAK_RUNS || 10), SCENARIOS.length));
  const runId = process.env.JOURNEY_SOAK_RUN_ID?.trim() || `journey-soak-${Date.now()}`;
  const outputPath = process.env.JOURNEY_SOAK_OUTPUT?.trim() || `/tmp/${runId}/ten-run-report.json`;
  const credentialOutputPath = process.env.JOURNEY_SOAK_CREDENTIAL_OUTPUT?.trim();
  const runs: JsonObject[] = [];
  for (let index = 0; index < requestedRuns; index += 1) {
    const run = await runScenario(client, SCENARIOS[index], index, runId);
    runs.push(run);
    const status = objectValue(run.status, "run.status");
    console.log(JSON.stringify({
      run: index + 1,
      scenario: SCENARIOS[index].key,
      identity: objectValue(run.identity, "run.identity").identityName,
      tier: optionalObject(status, "taskAdjudication")?.tier,
      missionStatus: optionalObject(optionalObject(status, "storyReport") ?? {}, "mission")?.status,
      decisions: arrayValue(run.decisions, "run.decisions").length,
    }));
  }
  const report = {
    kind: "journey_soak_report",
    version: 2,
    runId,
    startedAgainst: client.baseUrl,
    completedAt: new Date().toISOString(),
    taskGenerationMode: "server_fallback",
    decisionPolicy: "identity-role-policy.v1",
    aggregate: aggregateRuns(runs),
    runs: runs.map(publicRun),
  };
  let credentialOutput: string | undefined;
  if (credentialOutputPath) {
    credentialOutput = await writePrivateJson(credentialOutputPath, {
      kind: "journey_soak_credentials",
      version: 1,
      runId,
      credentials: runs.map((run, index) => ({
        agentId: stringValue(run.agentId, `runs[${index}].agentId`),
        journeyId: stringValue(run.journeyId, `runs[${index}].journeyId`),
        recoveryCode: stringValue(run.recoveryCode, `runs[${index}].recoveryCode`),
      })),
    });
  }
  const written = await writeJson(outputPath, report);
  console.log(JSON.stringify({
    outputPath: written,
    ...(credentialOutput ? { credentialOutput, credentialMode: "0600" } : {}),
    aggregate: report.aggregate,
  }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`journey soak failed: ${message}`);
  process.exitCode = 1;
});
