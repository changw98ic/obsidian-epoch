import type { JourneyStoryEpisodeInput } from "./journeyStoryReport.ts";
import { publicRegionLabel, publicText } from "./publicVocabulary.ts";
import {
  isJourneyTaskCompletionAction,
  journeyTaskRouteForRegion,
} from "./journeyTaskCatalog.ts";
import {
  adjudicateJourneyTask,
  deriveLegacyTerminalTierFromAdjudication,
  inferJourneyCompletionResult,
  journeyTaskGraphState,
  type JourneyCompletionResult,
  type JourneyGeneratedTaskPlan,
  type JourneyHiddenTaskSeal,
  type JourneyTaskAdjudication,
} from "./journeyGeneratedTaskRules.ts";

export type JourneyMissionStatus = "briefing" | "active" | "completed" | "failed";
export type JourneyMissionTaskStatus = "pending" | "active" | "completed" | "failed" | "skipped";

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
  readonly completionTier?: JourneyTaskAdjudication["tier"];
  readonly reward?: JourneyTaskAdjudication["reward"];
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
  readonly taskPlan?: JourneyGeneratedTaskPlan;
  readonly hiddenTaskSeal?: JourneyHiddenTaskSeal;
}

const REGISTERED_WORK_ACTIONS = new Set([
  "verify_salt_ledger",
  "carry_manifest",
  "report_discrepancy",
]);

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
  if (input.taskPlan) return buildGeneratedJourneyMission(input, input.taskPlan);
  const regionName = clean(publicRegionLabel(input.regionId)) || "目的区域";
  const taskRoute = journeyTaskRouteForRegion(input.regionId);
  const taskLocation = taskRoute?.worldObjects.find((object) => object.id === taskRoute.locationId)?.label;
  const playerObjective = clean(input.playerObjective) || "完成一次探索";
  const arrival = episodeForPhase(input.episodes, "arrival");
  const main = episodeForPhase(input.episodes, "main");
  const returning = episodeForPhase(input.episodes, "return");
  const mainOptionKey = optionKey(main);
  const reachedLedger = Boolean(arrival) && optionKey(arrival) !== "turn_back_before_entry";
  const registeredWorkCompleted = Boolean(main && (
    (mainOptionKey && (taskRoute
      ? isJourneyTaskCompletionAction(mainOptionKey)
      : REGISTERED_WORK_ACTIONS.has(mainOptionKey)))
    || (!mainOptionKey && !/离开|拒绝|折返/u.test(optionLabel(main) || ""))
  ));
  const safelyReturned = Boolean(returning) && ["settled", "completed"].includes(input.journeyStatus);
  const terminal = isJourneyTerminal(input.journeyStatus);
  const hardFailure = ["cancelled", "identity_ended"].includes(input.journeyStatus);

  const reachStatus: JourneyMissionTaskStatus = reachedLedger
    ? "completed"
    : terminal
      ? "failed"
      : arrival
        ? "failed"
        : ["draft", "prepared"].includes(input.journeyStatus)
          ? "pending"
          : "active";
  const workStatus: JourneyMissionTaskStatus = registeredWorkCompleted
    ? "completed"
    : main
      ? "failed"
      : reachStatus === "failed"
        ? "skipped"
        : reachedLedger
          ? "active"
          : "pending";
  const returnStatus: JourneyMissionTaskStatus = safelyReturned
    ? "completed"
    : terminal
      ? returning
        ? "failed"
        : "skipped"
      : returning
        ? "active"
        : "pending";

  const tasks: readonly JourneyMissionTask[] = [
    {
      taskId: taskRoute ? "reach_destination" : "reach_civic_ledger",
      sequence: 1,
      title: "抵达并登记",
      objective: taskRoute
        ? `沿已确认路线抵达${regionName}，前往${taskLocation ?? "任务地点"}。`
        : `沿登记路线抵达${regionName}民务账房，确认返程窗口。`,
      completionCriteria: `${regionName}入口与抵达信息进入可追溯记录。`,
      status: reachStatus,
      ...taskEvidence(arrival),
    },
    {
      taskId: taskRoute ? "complete_primary_task" : "complete_registered_work",
      sequence: 2,
      title: taskRoute?.title ?? "完成登记事务",
      objective: taskRoute?.mission.primaryObjective
        ?? `在${regionName}民务所完成一项已经登记、能够核验结果的具体事务。`,
      completionCriteria: taskRoute?.mission.completionCriteria
        ?? "盐票账册复核、登记清单递送或清单差额报告至少完成一项，并留下服务器结算记录。",
      status: workStatus,
      ...taskEvidence(main),
    },
    {
      taskId: "return_with_record",
      sequence: 3,
      title: "带回任务记录",
      objective: `在返程期限内离开${regionName}，把${taskRoute?.mission.successResult ?? "主任务的直接结果"}带回归档。`,
      completionCriteria: "返程行动已经记录，本次旅程最终完成结算并归档。",
      status: returnStatus,
      ...taskEvidence(returning),
    },
  ];

  const completed = tasks.every((task) => task.status === "completed");
  const failed = hardFailure || (terminal && !completed);
  const status: JourneyMissionStatus = completed
    ? "completed"
    : failed
      ? "failed"
      : ["draft", "prepared"].includes(input.journeyStatus)
        ? "briefing"
        : "active";
  const currentTaskId = tasks.find((task) => task.status === "active")?.taskId
    ?? tasks.find((task) => task.status === "pending")?.taskId;
  const completedTaskCount = tasks.filter((task) => task.status === "completed").length;
  const outcome: JourneyMissionOutcome | undefined = terminal ? {
    result: completed ? "success" : "failure",
    summary: completed
      ? `任务完成：三项阶段任务全部结算，已取得${taskRoute?.mission.successResult ?? `${regionName}民务所的可追溯事务记录`}并安全返回。`
      : hardFailure
        ? `任务失败：本次旅程以${input.journeyStatus === "identity_ended" ? "身份终结" : "取消"}结束，主目标未能闭环。`
        : `任务失败：在返程前没有完成全部成功条件；${workStatus === "failed" ? `所选行动未完成${taskRoute?.title ?? "登记事务"}。` : "缺少必要的阶段结算。"}`,
    completedTaskCount,
    totalTaskCount: tasks.length,
    ...(mainOptionKey ? { decisiveActionOptionKey: mainOptionKey } : {}),
    ...(optionLabel(main) ? { decisiveActionLabel: optionLabel(main) } : {}),
  } : undefined;

  const primaryObjective = taskRoute?.mission.primaryObjective
    ?? `在返程期限前抵达${regionName}民务所，完成一项由民务所登记且可核验的事务，并把记录安全带回。`;
  return {
    kind: "journey_mission",
    version: 1,
    missionId: `mission:${input.journeyId}`,
    journeyId: input.journeyId,
    title: taskRoute?.title ?? `${regionName}立足试炼`,
    playerObjective,
    briefing: taskRoute
      ? `${taskRoute.mission.briefing} 玩家本局目标：“${playerObjective}”。`
      : `长期愿望是“${playerObjective}”。本局把它收束为一项能够明确判定成功或失败的限时任务。`,
    primaryObjective,
    stakes: `只有取得${taskRoute?.mission.successResult ?? `被${regionName}民务所承认的办事记录`}并完成返程，本局主任务才算完成。`,
    successCriteria: taskRoute ? [
      `抵达${regionName}并前往${taskLocation ?? "任务地点"}。`,
      taskRoute.mission.completionCriteria,
      `在返程期限内安全返回，把${taskRoute.mission.successResult}交付归档。`,
    ] : [
        `完成${regionName}入口登记并进入民务账房。`,
        "完成一项服务器签发的登记事务，并取得可追溯的结算结果。",
        "在返程期限内安全返回，把任务记录交付归档。",
      ],
    failureConditions: [
      `未进入${regionName}便折返。`,
      taskRoute ? `没有完成“${taskRoute.mission.completionCriteria}”。` : "只询问信息、处理无关事务或拒绝全部登记事务后离开。",
      "本次旅程被取消、身份终结，或返程时仍缺少任一成功条件。",
    ],
    failureConsequences: [
      "本局结算为失败；已发生的见闻仍保留，但不得宣称主任务完成，也不会伪造工作、报酬或长期关系。",
    ],
    status,
    ...(currentTaskId && !terminal ? { currentTaskId } : {}),
    tasks,
    ...(outcome ? { outcome } : {}),
  };
}

function buildGeneratedJourneyMission(
  input: BuildJourneyMissionInput,
  taskPlan: JourneyGeneratedTaskPlan,
): JourneyMission {
  const completionResult = taskPlan.completionResult ?? inferJourneyCompletionResult(taskPlan.successResult);
  const terminal = isJourneyTerminal(input.journeyStatus);
  const arrival = episodeForPhase(input.episodes, "arrival");
  const returning = episodeForPhase(input.episodes, "return");
  const reached = Boolean(arrival) && optionKey(arrival) !== "turn_back_before_entry";
  const safelyReturned = Boolean(returning) && ["settled", "completed"].includes(input.journeyStatus);
  const adjudication = adjudicateJourneyTask({
    plan: taskPlan,
    episodes: input.episodes,
    hiddenTaskSeal: input.hiddenTaskSeal,
    revealHidden: terminal,
  });
  // PR4: adjudication no longer carries a tier (the authority tier lives on
  // SettlementDecision.tier). The mission read model's outcome block needs a
  // tier label for legacy non-PR4 terminal journeys where no settlement
  // decision exists; derive it from the physical adjudication via the legacy
  // helper. PR4 consumers read SettlementDecision.tier directly and never
  // touch this path.
  const legacyTerminalTier = deriveLegacyTerminalTierFromAdjudication(adjudication, terminal);
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
        ? failed || objective.kind !== "side" ? "failed" : "skipped"
        : !relevant
          ? "skipped"
        : terminal
          ? objective.kind === "side" ? "skipped" : "failed"
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
      ? `主线完成并安全返程；服务端依据签名行动判定为“${legacyTerminalTier}”。`
      : `主线未全部完成或未安全返程；服务端判定为“${legacyTerminalTier}”。`,
    completedTaskCount: tasks.filter((task) => task.status === "completed").length,
    totalTaskCount: tasks.length,
    completionTier: legacyTerminalTier,
    ...(adjudication.reward ? { reward: adjudication.reward } : {}),
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
