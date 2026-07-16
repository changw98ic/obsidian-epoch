import {
  assertNonEmptyString,
  type EpochCommandContext,
  type EpochDowntimeMode,
} from "./protocol.ts";
import type {
  ClaimDowntimeInput,
  EpochAgentIdentity,
  EpochCommandResult,
  SetDowntimeInput,
  TickDowntimeInput,
  TickDowntimeResult,
} from "./gameCore.ts";
import type { EpochDowntimeState } from "./downtimeRules.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";
import {
  commandResult,
  type EpochRuntimeResult,
} from "./runtimePublicProjectionRules.ts";

type RuntimeInput = Record<string, unknown>;

export interface DowntimeRuntimeOptions {
  readonly requireIdentity: (agentId: string) => EpochAgentIdentity;
  readonly ownerVerifiedContext: (input: RuntimeInput, explorerId: string) => EpochCommandContext;
  readonly idempotentlyAfterExplorerAuth: <TValue>(
    scope: string,
    input: RuntimeInput,
    explorerId: string,
    run: () => EpochRuntimeResult<TValue>,
  ) => EpochRuntimeResult<TValue>;
  readonly idempotently: <TValue>(
    scope: string,
    input: RuntimeInput,
    run: () => EpochRuntimeResult<TValue>,
    options?: { readonly allowRestrictedScore?: boolean },
  ) => EpochRuntimeResult<TValue>;
  readonly setDowntime: (
    input: SetDowntimeInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochDowntimeState>;
  readonly claimDowntime: (
    input: ClaimDowntimeInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochDowntimeState>;
  readonly tickDowntime: (
    input: TickDowntimeInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<TickDowntimeResult>;
}

export interface DowntimeRuntime {
  readonly setDowntime: (input?: RuntimeInput) => EpochRuntimeResult<EpochDowntimeState>;
  readonly claimDowntime: (input?: RuntimeInput) => EpochRuntimeResult<EpochDowntimeState>;
  readonly tickDowntime: (input?: RuntimeInput) => EpochRuntimeResult<TickDowntimeResult>;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function inputString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function createDowntimeRuntime(options: DowntimeRuntimeOptions): DowntimeRuntime {
  function setDowntime(input: RuntimeInput = {}) {
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = options.requireIdentity(agentId);
    return options.idempotentlyAfterExplorerAuth("set_downtime", input, identity.explorerId, () => commandResult(options.setDowntime({
      agentId,
      mode: input.mode as EpochDowntimeMode,
      regionId: canonicalRegionIdFromInput(input.regionId),
    }, options.ownerVerifiedContext(input, identity.explorerId))));
  }

  function claimDowntime(input: RuntimeInput = {}) {
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = options.requireIdentity(agentId);
    return options.idempotentlyAfterExplorerAuth("claim_downtime", input, identity.explorerId, () => commandResult(options.claimDowntime({
      agentId,
    }, options.ownerVerifiedContext(input, identity.explorerId))));
  }

  function tickDowntime(input: RuntimeInput = {}) {
    return options.idempotently("tick_downtime", input, () => commandResult(options.tickDowntime({
      agentId: inputString(input.agentId),
      limit: optionalNumber(input.limit),
    }, {
      actorExplorerId: "system",
      trustClass: "system_worker",
      idempotencyKey: optionalString(input.idempotencyKey),
      causationId: inputString(input.causationId),
      correlationId: inputString(input.correlationId),
    })), { allowRestrictedScore: true });
  }

  return {
    setDowntime,
    claimDowntime,
    tickDowntime,
  };
}
