import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import {
  assertNonEmptyString,
  type EpochCommandContext,
} from "./protocol.ts";
import type {
  EpochAgentIdentity,
  EpochHostedActionRecord,
  EpochHostedSession,
  EpochProjection,
  StartHostedSessionInput,
  SubmitHostedActionInput,
} from "./gameCore.ts";
import type { EpochEvent } from "./events.ts";
import { buildEpochResultPagePayload } from "./resultPagePayloadRules.ts";
import type {
  EpochExplorationRun,
  EpochResultPagePayload,
  EpochSharedResultPage,
} from "./runtime.ts";
import type { EpochRuntimeResult } from "./runtimePublicProjectionRules.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

export interface ExplorationRuntime {
  readonly runExploration: (input?: AnyRecord) => EpochRuntimeResult<EpochExplorationRun>;
}

export interface ExplorationRuntimeOptions {
  readonly assertPublicTextSafe: (input: AnyRecord, value: unknown) => void;
  readonly idempotently: <TValue>(
    scope: string,
    input: AnyRecord,
    explorerId: string,
    run: () => EpochRuntimeResult<TValue>,
  ) => EpochRuntimeResult<TValue>;
  readonly requireIdentity: (agentId: string) => EpochAgentIdentity;
  readonly project: () => EpochProjection;
  readonly publicProjection: () => EpochProjection;
  readonly now: () => string;
  readonly maxDowntimeSeconds?: number;
  readonly ownerVerifiedContext: (input: AnyRecord, explorerId: string) => EpochCommandContext;
  readonly startHostedSession: (
    input: StartHostedSessionInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochHostedSession>;
  readonly submitHostedAction: (
    input: SubmitHostedActionInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochHostedActionRecord>;
  readonly createResultPageFromPayload: (
    input: AnyRecord,
    payload: EpochResultPagePayload,
  ) => { readonly page: EpochSharedResultPage };
}

export function explorationStepCount(input: AnyRecord) {
  const value = Number(input.stepCount ?? 8);
  if (!Number.isFinite(value)) return 8;
  return Math.max(8, Math.min(Math.floor(value), 12));
}

export function explorationMandate(input: AnyRecord) {
  const mandate = typeof input.mandate === "string" && input.mandate.trim()
    ? input.mandate.trim()
    : "一次完整探索";
  return mandate.slice(0, 160);
}

function chooseExplorationOption(session: EpochHostedSession, index: number) {
  const safeOptions = session.actionOptions.filter((option) => option.risk !== "high");
  const preferredOptionKey = index % 2 === 0 ? "observe" : "assist";
  return safeOptions.find((candidate) => candidate.optionKey === preferredOptionKey)
    ?? safeOptions[0]
    ?? session.actionOptions[0];
}

export function createExplorationRuntime(options: ExplorationRuntimeOptions): ExplorationRuntime {
  function runExploration(input: AnyRecord = {}): EpochRuntimeResult<EpochExplorationRun> {
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = options.requireIdentity(agentId);
    const regionId = resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id"));
    const stepCount = explorationStepCount(input);
    const mandate = explorationMandate(input);
    options.assertPublicTextSafe(input, mandate);
    return options.idempotently("run_exploration", input, identity.explorerId, () => {
      const events: EpochEvent[] = [];
      const sessions: EpochHostedSession[] = [];
      const actions: EpochHostedActionRecord[] = [];
      const baseIdempotencyKey = String(input.idempotencyKey).trim();
      for (let index = 0; index < stepCount; index += 1) {
        const contextInput = {
          ...input,
          idempotencyKey: `${baseIdempotencyKey}:step:${index + 1}`,
        };
        const sessionResult = options.startHostedSession({
          agentId,
          regionId,
          mandate: `${mandate} · 第 ${index + 1} 段`,
        }, options.ownerVerifiedContext(contextInput, identity.explorerId));
        events.push(...sessionResult.events);
        const option = chooseExplorationOption(sessionResult.value, index);
        if (!option) throw new Error("hosted_action_option_not_found");
        const actionResult = options.submitHostedAction({
          sessionId: sessionResult.value.sessionId,
          actionOptionId: option.actionOptionId,
          visibleText: `第 ${index + 1} 段探索：${option.label}。`,
        }, options.ownerVerifiedContext(contextInput, identity.explorerId));
        events.push(...actionResult.events);
        const completedSession = actionResult.projection.hostedSessions[sessionResult.value.sessionId];
        if (!completedSession) throw new Error("hosted_session_not_found");
        sessions.push(completedSession);
        actions.push(actionResult.value);
      }
      const pageInput = {
        ...input,
        agentId,
        explorerId: identity.explorerId,
        regionId,
        limit: Math.max(30, stepCount * 6),
        focusEventIds: events.map((event) => event.eventId),
        idempotencyKey: `${baseIdempotencyKey}:result`,
      };
      const resultPayload = buildEpochResultPagePayload({
        projection: options.project(),
        input: pageInput,
        generatedAt: options.now(),
        maxDowntimeSeconds: options.maxDowntimeSeconds,
      });
      const resultPage = options.createResultPageFromPayload(pageInput, resultPayload).page;
      return {
        events,
        value: {
          agentId,
          explorerId: identity.explorerId,
          regionId,
          mandate,
          stepCount,
          sessions,
          actions,
          resultPage,
        },
        projection: options.publicProjection(),
      };
    });
  }

  return {
    runExploration,
  };
}
