import {
  type EpochCommandContext,
  normalizeTrustClass,
} from "./protocol.ts";

type AnyRecord = Record<string, unknown>;

function contextMetadataFromInput(input: AnyRecord) {
  return {
    causationId: typeof input.causationId === "string" ? input.causationId : undefined,
    correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
    idempotencyKey: typeof input.idempotencyKey === "string" ? input.idempotencyKey : undefined,
  };
}

export function contextFromInput(input: AnyRecord, fallbackExplorerId: string): EpochCommandContext {
  return {
    actorExplorerId: String(input.actorExplorerId || input.explorerId || fallbackExplorerId),
    trustClass: normalizeTrustClass(input.trustClass),
    ...contextMetadataFromInput(input),
  };
}

export function untrustedClientContext(input: AnyRecord, fallbackExplorerId: string): EpochCommandContext {
  return {
    actorExplorerId: fallbackExplorerId,
    trustClass: "untrusted_client",
    ...contextMetadataFromInput(input),
  };
}

export function maintenanceContext(input: AnyRecord, idempotencyKey: string): EpochCommandContext {
  return {
    actorExplorerId: "system",
    trustClass: "system_worker",
    idempotencyKey,
    causationId: typeof input.causationId === "string" ? input.causationId : undefined,
    correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
  };
}

export function ownerVerifiedContextFromInput(input: AnyRecord, explorerId: string): EpochCommandContext {
  return {
    actorExplorerId: explorerId,
    trustClass: "user_verified_web",
    ...contextMetadataFromInput(input),
  };
}
