import {
  type EpochHostedSession,
  type EpochProjection,
} from "./gameCore.ts";
import { publicHostedSessionsView } from "./hostedSessionReadModel.ts";
import { publicReadLimit } from "./publicWorldReadModel.ts";
import { hostedSessionStatusFromInput } from "./runtimeInputRules.ts";

type ReadInput = Record<string, unknown>;

export interface EpochHostedSessionInfo {
  readonly agentId?: string;
  readonly sessions: readonly EpochHostedSession[];
}

function inputString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function hostedSessionsInfoView(
  projection: EpochProjection,
  input: ReadInput = {},
): EpochHostedSessionInfo {
  const agentId = inputString(input.agentId);
  return {
    agentId,
    sessions: publicHostedSessionsView(projection, {
      agentId,
      status: hostedSessionStatusFromInput(input.status),
      limit: publicReadLimit(input, 20),
    }),
  };
}
