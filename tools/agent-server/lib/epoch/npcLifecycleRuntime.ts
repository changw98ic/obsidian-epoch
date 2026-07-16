import {
  assertNonEmptyString,
  normalizeTrustClass,
  type EpochCommandContext,
  type EpochTrustClass,
} from "./protocol.ts";
import type {
  EpochCommandResult,
  EpochNpcRecord,
  RecordNpcLifecycleInput,
  TickNpcLifecycleInput,
  TickNpcLifecycleResult,
} from "./gameCore.ts";
import { canonicalRegionIdFromInput } from "./runtimeInputRules.ts";
import {
  commandResult,
  type EpochRuntimeResult,
} from "./runtimePublicProjectionRules.ts";

type RuntimeInput = Record<string, unknown>;

export interface NpcLifecycleRuntimeOptions {
  readonly contextFromInput: (input: RuntimeInput, fallbackActorExplorerId: string) => EpochCommandContext;
  readonly idempotentlyWithSubject: <TValue>(
    scope: string,
    input: RuntimeInput,
    subject: string,
    run: () => EpochRuntimeResult<TValue>,
    options?: { readonly allowRestrictedScore?: boolean },
  ) => EpochRuntimeResult<TValue>;
  readonly recordNpcLifecycle: (
    input: RecordNpcLifecycleInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochNpcRecord>;
  readonly tickNpcLifecycle: (
    input: TickNpcLifecycleInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<TickNpcLifecycleResult>;
}

export interface NpcLifecycleRuntime {
  readonly recordNpcLifecycle: (input?: RuntimeInput) => EpochRuntimeResult<EpochNpcRecord>;
  readonly tickNpcLifecycle: (input?: RuntimeInput) => EpochRuntimeResult<TickNpcLifecycleResult>;
}

function isRecord(value: unknown): value is RuntimeInput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): RuntimeInput {
  return isRecord(value) ? value : {};
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

export function createNpcLifecycleRuntime(options: NpcLifecycleRuntimeOptions): NpcLifecycleRuntime {
  function recordNpcLifecycle(input: RuntimeInput = {}) {
    const trustClass = normalizeTrustClass(input.trustClass) as EpochTrustClass;
    if (trustClass === "untrusted_client") throw new Error("npc_lifecycle_requires_server_trust");
    return options.idempotentlyWithSubject(
      "record_npc_lifecycle",
      input,
      optionalString(input.npcId) || "npc_lifecycle",
      () => commandResult(options.recordNpcLifecycle({
        npcId: assertNonEmptyString(input.npcId, "npc_id"),
        changes: recordValue(input.changes) as Readonly<Record<string, string | number | boolean>>,
        sourceEventIds: Array.isArray(input.sourceEventIds) ? input.sourceEventIds : [],
      }, options.contextFromInput(input, "system"))),
      { allowRestrictedScore: true },
    );
  }

  function tickNpcLifecycle(input: RuntimeInput = {}) {
    return options.idempotentlyWithSubject("tick_npc_lifecycle", input, "system", () => commandResult(options.tickNpcLifecycle({
      regionId: canonicalRegionIdFromInput(input.regionId),
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
    recordNpcLifecycle,
    tickNpcLifecycle,
  };
}
