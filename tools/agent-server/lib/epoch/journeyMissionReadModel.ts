import type { JourneyStoryEpisodeInput } from "./journeyStoryReport.ts";
import { publicRegionLabel, publicText } from "./publicVocabulary.ts";
import {
  adjudicateJourneyTask,
  journeyTaskGraphState,
  type JourneyCompletionTier,
  type JourneyCompletionResult,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSeal,
  type JourneyTaskAdjudication,
} from "./journeyGeneratedTaskRules.ts";
import type { HiddenPrerequisiteLink } from "./journeyRoleplayRules.ts";

export type JourneyMissionStatus = "briefing" | "active" | "completed" | "failed";
/**
 * `not_applicable` means the journey never entered that optional or
 * downstream task; it is a read-model state, never a server task result.
 */
export type JourneyMissionTaskStatus = "pending" | "active" | "completed" | "failed" | "not_applicable";

export interface JourneyMissionTask {
  readonly taskId: string;
  readonly kind?: "arrival" | "main" | "side" | "choice" | "return";
  readonly sequence: number;
  readonly title: string;
  readonly objective: string;
  readonly completionCriteria: string;
  readonly status: JourneyMissionTaskStatus;
  readonly evidenceEpisodeIds: readonly string[];
  readonly sourceEventIds: readonly string[];
}

export interface JourneyMissionOutcome {
  readonly result: "success" | "failure";
  readonly summary: string;
  readonly completedTaskCount: number;
  readonly totalTaskCount: number;
  readonly decisiveActionOptionKey?: string;
  readonly decisiveActionLabel?: string;
  readonly completionTier?: JourneyCompletionTier;
}

export interface JourneyMission {
  readonly kind: "journey_mission";
  readonly version: 1;
  readonly missionId: string;
  readonly journeyId: string;
  readonly title: string;
  readonly playerObjective: string;
  readonly briefing: string;
  readonly primaryObjective: string;
  readonly stakes: string;
  readonly successCriteria: readonly string[];
  readonly failureConditions: readonly string[];
  readonly failureConsequences: readonly string[];
  readonly status: JourneyMissionStatus;
  readonly currentTaskId?: JourneyMissionTask["taskId"];
  readonly tasks: readonly JourneyMissionTask[];
  readonly outcome?: JourneyMissionOutcome;
  readonly adjudication?: JourneyTaskAdjudication;
}

export interface BuildJourneyMissionInput {
  readonly journeyId: string;
  readonly journeyStatus: string;
  readonly playerObjective: string;
  readonly regionId: string;
  readonly episodes: readonly JourneyStoryEpisodeInput[];
  readonly taskPlan: JourneyGeneratedTaskPlan;
  readonly hiddenTaskSeal: JourneyHiddenTaskSeal;
  readonly hiddenPrerequisiteLinks: readonly HiddenPrerequisiteLink[];
  /** Canonical tier persisted by the settlement authority for terminal journeys. */
  readonly completionTier?: JourneyCompletionTier;
}

function clean(value: string): string {
  return publicText(value).trim();
}

function episodeForPhase(
  episodes: readonly JourneyStoryEpisodeInput[],
  phase: "arrival" | "main" | "return",
) {
  return episodes.find((episode) => (episode.serverFacts?.storyBeat?.phase ?? episode.phase) === phase);
}

function optionKey(episode: JourneyStoryEpisodeInput | undefined): string | undefined {
  return episode?.serverFacts?.storyBeat?.selectedAction.optionKey?.trim() || undefined;
}

function optionLabel(episode: JourneyStoryEpisodeInput | undefined): string | undefined {
  return episode?.serverFacts?.storyBeat?.selectedAction.label?.trim() || undefined;
}

function taskEvidence(episode: JourneyStoryEpisodeInput | undefined) {
  return {
    evidenceEpisodeIds: episode ? [episode.episodeId] : [],
    sourceEventIds: episode?.serverFacts?.sourceEventIds || [],
  };
}

function isJourneyTerminal(status: string) {
  return ["settled", "cancelled", "identity_ended", "completed"].includes(status);
}

function completionReturnObjective(result: JourneyCompletionResult): string {
  if (result.returnMode === "carry") return `携带${carryObjectText(result.summary)}安全返程。`;
  if (result.returnMode === "report") return `确认${result.summary}已经提交归档，并携带回执安全返程。`;
  return `确认${result.summary}已经在现场生效后安全返程。`;
}

function carryObjectText(value: string) {
  return clean(value)
    .replace(/^(?:带回|携带|获得|取得)\s*/u, "")
    .replace(/(?:并)?安全返程[。.]?$/u, "")
    || "任务物品";
}

export function buildJourneyMission(input: BuildJourneyMissionInput): JourneyMission {
  return buildGeneratedJourneyMission(input, input.taskPlan);
}

function buildGeneratedJourneyMission(
  input: BuildJourneyMissionInput,
  taskPlan: JourneyGeneratedTaskPlan,
): JourneyMission {
  const completionResult = taskPlan.completionResult;
  const terminal = isJourneyTerminal(input.journeyStatus);
  const arrival = episodeForPhase(input.episodes, "arrival");
  const returning = episodeForPhase(input.episodes, "return");
  const reached = Boolean(arrival) && optionKey(arrival) !== "turn_back_before_entry";
  const safelyReturned = Boolean(returning) && ["settled", "completed"].includes(input.journeyStatus);
  const adjudication = adjudicateJourneyTask({
    plan: taskPlan,
    episodes: input.episodes,
    hiddenTaskSeal: input.hiddenTaskSeal,
    hiddenPrerequisiteLinks: input.hiddenPrerequisiteLinks,
    revealHidden: terminal,
  });
  if (terminal && input.completionTier === undefined) {
    throw new Error("journey_settlement_tier_required");
  }
  const graphState = journeyTaskGraphState(taskPlan, input.episodes);
  const requiredMainIds = new Set(graphState.requiredMainObjectiveIds);
  const relevantSideIds = new Set(graphState.relevantSideObjectiveIds);
  const availableIds = new Set(graphState.availableObjectiveIds);
  const objectiveTasks = taskPlan.objectives.map((objective, index): JourneyMissionTask => {
    const episode = input.episodes.find((candidate) =>
      candidate.generatedTaskObjective?.objectiveId === objective.objectiveId);
    const selected = optionKey(episode);
    const selectedAction = episode?.serverFacts?.storyBeat?.selectedAction;
    const completed = selectedAction?.taskObjectiveId === objective.objectiveId
      && selectedAction.completionKind === "complete"
      && objective.actions.some((action) => action.optionKey === selected);
    const failed = selectedAction?.taskObjectiveId === objective.objectiveId
      && selectedAction.completionKind === "failed";
    const relevant = objective.kind === "side"
      ? relevantSideIds.has(objective.objectiveId)
      : requiredMainIds.has(objective.objectiveId);
    const status: JourneyMissionTaskStatus = completed
      ? "completed"
      : episode
        ? "failed"
        : !relevant
          ? "not_applicable"
        : terminal
          ? objective.kind === "side" ? "not_applicable" : "failed"
          : reached && availableIds.has(objective.objectiveId)
            ? "active"
            : "pending";
    return {
      taskId: objective.objectiveId,
      kind: objective.kind,
      sequence: index + 2,
      title: objective.title,
      objective: objective.objective,
      completionCriteria: objective.completionCriteria,
      status,
      ...taskEvidence(episode),
    };
  });
  const tasks: readonly JourneyMissionTask[] = [
    {
      taskId: "reach_destination",
      kind: "arrival",
      sequence: 1,
      title: "抵达任务区域",
      objective: `沿已确认路线抵达${clean(publicRegionLabel(input.regionId)) || "任务区域"}。`,
      completionCriteria: "抵达行动进入服务器签名记录。",
      status: reached ? "completed" : terminal ? "failed" : arrival ? "failed" : "active",
      ...taskEvidence(arrival),
    },
    ...objectiveTasks,
    {
      taskId: "return_with_record",
      kind: "return",
      sequence: objectiveTasks.length + 2,
      title: "完成返程",
      objective: completionReturnObjective(completionResult),
      completionCriteria: "返程行动与服务端最终结算均已完成。",
      status: safelyReturned ? "completed" : terminal ? "failed" : returning ? "active" : "pending",
      ...taskEvidence(returning),
    },
  ];
  const mainSucceeded = adjudication.mainCompleted === adjudication.mainTotal;
  const success = terminal && safelyReturned && mainSucceeded;
  const status: JourneyMissionStatus = success
    ? "completed"
    : terminal
      ? "failed"
      : ["draft", "prepared"].includes(input.journeyStatus)
        ? "briefing"
        : "active";
  const currentTaskId = tasks.find((task) => task.status === "active")?.taskId
    ?? tasks.find((task) => task.status === "pending")?.taskId;
  const outcome: JourneyMissionOutcome | undefined = terminal ? {
    result: success ? "success" : "failure",
    summary: success
      ? `主线完成并安全返程；服务端依据签名行动判定为“${input.completionTier}”。`
      : `主线未全部完成或未安全返程；服务端判定为“${input.completionTier}”。`,
    completedTaskCount: tasks.filter((task) => task.status === "completed").length,
    totalTaskCount: tasks.length,
    ...(input.completionTier ? { completionTier: input.completionTier } : {}),
  } : undefined;
  return {
    kind: "journey_mission",
    version: 1,
    missionId: `mission:${input.journeyId}`,
    journeyId: input.journeyId,
    title: taskPlan.title,
    playerObjective: clean(input.playerObjective) || taskPlan.taskType,
    briefing: taskPlan.premise,
    primaryObjective: taskPlan.primaryObjective,
    stakes: `主线决定是否及格；支线决定良好或优秀；只有同时达成服务端隐藏条件才能获得惊世评价。`,
    successCriteria: [
      ...taskPlan.objectives.filter((objective) => requiredMainIds.has(objective.objectiveId))
        .map((objective) => objective.completionCriteria),
      completionReturnObjective(completionResult),
      "由服务端读取签名行动事件完成结算。",
    ],
    failureConditions: ["任一主线目标没有由对应签名行动完成。", "旅程取消、身份终结或缺少返程结算。"],
    failureConsequences: ["未完成部分不发放奖励；客户端叙述不能替代服务器结算。"],
    status,
    ...(currentTaskId && !terminal ? { currentTaskId } : {}),
    tasks,
    adjudication,
    ...(outcome ? { outcome } : {}),
  };
}
