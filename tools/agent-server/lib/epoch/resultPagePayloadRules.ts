import type { EpochProjection } from "./gameCore.ts";
import { progressView } from "./progressReadModel.ts";
import {
  resultPageFocusHostedSession,
  resultPageFocusTurnCard,
  resultPageRegionId,
  resultPageRegionalContext,
} from "./resultPageContextRules.ts";
import { resultPageNextActions } from "./resultPageNavigationRules.ts";
import { resultPageReceipt } from "./resultPageReceiptRules.ts";
import {
  focusedResultPageProgress,
  resultPagePublicPages,
  resultPagePublicSafeSummary,
} from "./resultPageRuntimeRules.ts";
import { buildEpochResultPageRunSummary } from "./resultRunSummary.ts";
import type { EpochResultPagePayload } from "./runtime.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

export interface BuildEpochResultPagePayloadInput {
  readonly projection: EpochProjection;
  readonly input?: AnyRecord;
  readonly generatedAt: string;
  readonly maxDowntimeSeconds?: number;
}

export function buildEpochResultPagePayload(options: BuildEpochResultPagePayloadInput): EpochResultPagePayload {
  const input = options.input || {};
  const focusTurnCard = resultPageFocusTurnCard(options.projection, input);
  const focusHostedSession = resultPageFocusHostedSession(options.projection, input);
  if (focusTurnCard && focusHostedSession) throw new Error("result_page_focus_conflict");

  const agentId = typeof input.agentId === "string" && input.agentId.trim()
    ? input.agentId.trim()
    : focusTurnCard?.agentId || focusHostedSession?.agentId;
  const explorerId = typeof input.explorerId === "string" && input.explorerId.trim()
    ? input.explorerId.trim()
    : focusTurnCard?.explorerId || focusHostedSession?.explorerId;
  const progress = focusedResultPageProgress(progressView(options.projection, {
    agentId,
    explorerId,
    limit: Number(input.limit || 30),
    now: options.generatedAt,
    maxDowntimeSeconds: options.maxDowntimeSeconds,
  }), input);
  const regionId = resultPageRegionId({
    input,
    progress,
    focusTurnCard,
    focusHostedSession,
  });
  const regionalContext = resultPageRegionalContext(options.projection, regionId);
  const payload: Omit<EpochResultPagePayload, "receipt"> = {
    pageType: "agent_result",
    generatedAt: options.generatedAt,
    publicSafeSummary: resultPagePublicSafeSummary({
      progress,
      regionId,
      focusTurnCard,
      focusHostedSession,
    }),
    progress,
    runSummary: buildEpochResultPageRunSummary(input, {
      generatedAt: options.generatedAt,
      progress,
      focusTurnCard,
      focusHostedSession,
    }),
    publicPages: resultPagePublicPages(progress),
    nextActions: resultPageNextActions({ progress, regionId, regionalContext }),
    ...(regionalContext ? { regionalContext } : {}),
    ...(focusTurnCard ? { focusTurnCard } : {}),
    ...(focusHostedSession ? { focusHostedSession } : {}),
  };
  return {
    ...payload,
    receipt: resultPageReceipt(options.projection, payload),
  };
}
