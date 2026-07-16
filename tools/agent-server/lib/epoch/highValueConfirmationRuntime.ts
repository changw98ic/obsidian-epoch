import {
  assertNonEmptyString,
  type EpochCommandContext,
  type EpochIdFactory,
} from "./protocol.ts";
import { createEpochEvent, type EpochEvent } from "./events.ts";
import type { EpochProjection } from "./gameCore.ts";
import {
  highValueConfirmationSubjectHash,
  highValueConfirmationSummary,
  type EpochHighValueConfirmationAction,
} from "./highValueConfirmationRules.ts";
import { sha256Hex } from "./runtimeAuth.ts";

type AnyRecord = Readonly<Record<string, unknown>>;

export type EpochHighValueConfirmationStatus = "pending" | "confirmed" | "consumed" | "expired";

export interface EpochHighValueConfirmation {
  readonly confirmationId: string;
  readonly action: EpochHighValueConfirmationAction;
  readonly agentId: string;
  readonly explorerId: string;
  readonly subjectHash: string;
  readonly summary: string;
  readonly status: EpochHighValueConfirmationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly confirmedAt?: string;
  readonly consumedAt?: string;
}

export interface EpochHighValueConfirmationRequestResult {
  readonly confirmation: EpochHighValueConfirmation;
  readonly duplicate?: boolean;
}

export interface EpochHighValueConfirmationConfirmResult {
  readonly confirmation: EpochHighValueConfirmation;
  readonly confirmationToken: string;
  readonly duplicate?: boolean;
}

export interface EpochHighValueConfirmationListResult {
  readonly explorerId: string;
  readonly total: number;
  readonly confirmations: readonly EpochHighValueConfirmation[];
}

interface StoredHighValueConfirmation extends EpochHighValueConfirmation {
  readonly tokenHash?: string;
  readonly confirmationToken?: string;
  readonly consumedByIdempotencyKey?: string;
  readonly consumedByAction?: EpochHighValueConfirmationAction;
  readonly expiresAtMs: number;
}

export interface HighValueConfirmationRuntime {
  readonly request: (input?: AnyRecord) => EpochHighValueConfirmationRequestResult;
  readonly confirm: (input?: AnyRecord) => EpochHighValueConfirmationConfirmResult;
  readonly list: (input?: AnyRecord) => EpochHighValueConfirmationListResult;
  readonly hydrateEvent: (event: EpochEvent) => void;
  readonly consume: (
    input: AnyRecord,
    action: EpochHighValueConfirmationAction,
    subjectHash: string,
  ) => readonly EpochEvent[];
}

export interface HighValueConfirmationRuntimeOptions {
  readonly clock: () => Date;
  readonly confirmationTtlMs: number;
  readonly idFactory: EpochIdFactory;
  readonly project: () => EpochProjection;
  readonly assertAbuseAllowed: (
    input: AnyRecord,
    options?: { readonly allowRestrictedScore?: boolean },
  ) => void;
  readonly assertExplorerAuth: (input: AnyRecord, explorerId: string) => void;
  readonly untrustedClientContext: (input: AnyRecord, fallbackExplorerId: string) => EpochCommandContext;
  readonly ownerVerifiedContextFromInput: (input: AnyRecord, explorerId: string) => EpochCommandContext;
}

function withInternalEvents<TValue extends object>(result: TValue, events: readonly EpochEvent[]): TValue {
  Object.defineProperty(result, "events", {
    value: events,
    enumerable: false,
  });
  return result;
}

function recordValue(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function publicConfirmation(confirmation: StoredHighValueConfirmation): EpochHighValueConfirmation {
  const {
    tokenHash: _tokenHash,
    confirmationToken: _confirmationToken,
    consumedByIdempotencyKey: _consumedByIdempotencyKey,
    consumedByAction: _consumedByAction,
    expiresAtMs: _expiresAtMs,
    ...publicView
  } = confirmation;
  return publicView;
}

function assertedConfirmationAction(value: unknown): EpochHighValueConfirmationAction {
  const action = assertNonEmptyString(value, "high_value_confirmation_action") as EpochHighValueConfirmationAction;
  if (action !== "world_message" && action !== "turn_card" && action !== "resolve_turn") {
    throw new Error("high_value_confirmation_action_invalid");
  }
  return action;
}

export function createHighValueConfirmationRuntime(options: HighValueConfirmationRuntimeOptions): HighValueConfirmationRuntime {
  const requestIdempotency = new Map<string, string>();
  const confirmIdempotency = new Map<string, string>();
  const confirmations = new Map<string, StoredHighValueConfirmation>();
  const idsByTokenHash = new Map<string, string>();

  function requestedConfirmationEvent(confirmation: StoredHighValueConfirmation, input: AnyRecord): EpochEvent {
    return createEpochEvent({
      eventType: "high_value_confirmation_requested",
      aggregateType: "audit_record",
      aggregateId: confirmation.confirmationId,
      context: options.untrustedClientContext(input, confirmation.explorerId),
      createdAt: confirmation.createdAt,
      idFactory: options.idFactory,
      agentId: confirmation.agentId,
      payload: {
        confirmationId: confirmation.confirmationId,
        action: confirmation.action,
        agentId: confirmation.agentId,
        explorerId: confirmation.explorerId,
        subjectHash: confirmation.subjectHash,
        summary: confirmation.summary,
        createdAt: confirmation.createdAt,
        expiresAt: confirmation.expiresAt,
      },
    });
  }

  function confirmedConfirmationEvent(
    confirmation: StoredHighValueConfirmation,
    tokenHash: string,
    input: AnyRecord,
  ): EpochEvent {
    const confirmedAt = assertNonEmptyString(confirmation.confirmedAt, "high_value_confirmation_confirmed_at");
    return createEpochEvent({
      eventType: "high_value_confirmation_confirmed",
      aggregateType: "audit_record",
      aggregateId: confirmation.confirmationId,
      context: options.ownerVerifiedContextFromInput(input, confirmation.explorerId),
      createdAt: confirmedAt,
      idFactory: options.idFactory,
      agentId: confirmation.agentId,
      payload: {
        confirmationId: confirmation.confirmationId,
        confirmedAt,
        tokenHash,
      },
    });
  }

  function consumedConfirmationEvent(confirmation: StoredHighValueConfirmation, input: AnyRecord): EpochEvent {
    const consumedAt = assertNonEmptyString(confirmation.consumedAt, "high_value_confirmation_consumed_at");
    const consumedByIdempotencyKey = assertNonEmptyString(
      confirmation.consumedByIdempotencyKey,
      "high_value_confirmation_consumed_idempotency_key",
    );
    const consumedByAction = confirmation.consumedByAction;
    if (!consumedByAction) throw new Error("high_value_confirmation_consumed_action_required");
    return createEpochEvent({
      eventType: "high_value_confirmation_consumed",
      aggregateType: "audit_record",
      aggregateId: confirmation.confirmationId,
      context: options.ownerVerifiedContextFromInput(input, confirmation.explorerId),
      createdAt: consumedAt,
      idFactory: options.idFactory,
      agentId: confirmation.agentId,
      payload: {
        confirmationId: confirmation.confirmationId,
        consumedAt,
        consumedByIdempotencyKey,
        consumedByAction,
      },
    });
  }

  function assertFresh(confirmation: StoredHighValueConfirmation) {
    if (confirmation.status === "expired" || options.clock().getTime() > confirmation.expiresAtMs) {
      confirmations.set(confirmation.confirmationId, {
        ...confirmation,
        status: "expired",
      });
      throw new Error("high_value_confirmation_expired");
    }
  }

  function refreshForRead(confirmation: StoredHighValueConfirmation) {
    if (
      (confirmation.status === "pending" || confirmation.status === "confirmed")
      && options.clock().getTime() > confirmation.expiresAtMs
    ) {
      const expired: StoredHighValueConfirmation = {
        ...confirmation,
        status: "expired",
      };
      confirmations.set(confirmation.confirmationId, expired);
      return expired;
    }
    return confirmation;
  }

  function hydrateEvent(event: EpochEvent) {
    if (event.eventType === "high_value_confirmation_requested") {
      const payload = recordValue(event.payload);
      if (
        typeof payload.confirmationId === "string"
        && (payload.action === "world_message" || payload.action === "turn_card" || payload.action === "resolve_turn")
        && typeof payload.agentId === "string"
        && typeof payload.explorerId === "string"
        && typeof payload.subjectHash === "string"
        && typeof payload.summary === "string"
        && typeof payload.createdAt === "string"
        && typeof payload.expiresAt === "string"
      ) {
        const expiresAtMs = Date.parse(payload.expiresAt);
        confirmations.set(payload.confirmationId, {
          confirmationId: payload.confirmationId,
          action: payload.action,
          agentId: payload.agentId,
          explorerId: payload.explorerId,
          subjectHash: payload.subjectHash,
          summary: payload.summary,
          status: "pending",
          createdAt: payload.createdAt,
          expiresAt: payload.expiresAt,
          expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
        });
        if (typeof event.idempotencyKey === "string" && event.idempotencyKey.trim()) {
          requestIdempotency.set(`high_value_confirmation_request:${event.idempotencyKey.trim()}`, payload.confirmationId);
        }
      }
      return;
    }

    if (event.eventType === "high_value_confirmation_confirmed") {
      const payload = recordValue(event.payload);
      if (
        typeof payload.confirmationId === "string"
        && typeof payload.confirmedAt === "string"
        && typeof payload.tokenHash === "string"
      ) {
        const confirmation = confirmations.get(payload.confirmationId);
        if (confirmation) {
          confirmations.set(payload.confirmationId, {
            ...confirmation,
            status: "confirmed",
            confirmedAt: payload.confirmedAt,
            tokenHash: payload.tokenHash,
          });
          idsByTokenHash.set(payload.tokenHash, payload.confirmationId);
          if (typeof event.idempotencyKey === "string" && event.idempotencyKey.trim()) {
            confirmIdempotency.set(
              `high_value_confirmation_confirm:${payload.confirmationId}:${event.idempotencyKey.trim()}`,
              payload.confirmationId,
            );
          }
        }
      }
      return;
    }

    if (event.eventType === "high_value_confirmation_consumed") {
      const payload = recordValue(event.payload);
      if (
        typeof payload.confirmationId === "string"
        && typeof payload.consumedAt === "string"
        && typeof payload.consumedByIdempotencyKey === "string"
        && (
          payload.consumedByAction === "world_message"
          || payload.consumedByAction === "turn_card"
          || payload.consumedByAction === "resolve_turn"
        )
      ) {
        const confirmation = confirmations.get(payload.confirmationId);
        if (confirmation) {
          confirmations.set(payload.confirmationId, {
            ...confirmation,
            status: "consumed",
            consumedAt: payload.consumedAt,
            consumedByIdempotencyKey: payload.consumedByIdempotencyKey,
            consumedByAction: payload.consumedByAction,
          });
        }
      }
    }
  }

  function request(input: AnyRecord = {}): EpochHighValueConfirmationRequestResult {
    if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length === 0) {
      throw new Error("idempotency_key_required");
    }
    const key = `high_value_confirmation_request:${input.idempotencyKey.trim()}`;
    const action = assertedConfirmationAction(input.action);
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = options.project().identities[agentId];
    if (!identity) throw new Error("agent_identity_not_found");
    if (identity.status !== "active") throw new Error("agent_identity_archived");
    options.assertExplorerAuth(input, identity.explorerId);
    const existingConfirmationId = requestIdempotency.get(key);
    if (existingConfirmationId) {
      const confirmation = confirmations.get(existingConfirmationId);
      if (!confirmation) throw new Error("high_value_confirmation_not_found");
      return { confirmation: publicConfirmation(confirmation), duplicate: true };
    }
    options.assertAbuseAllowed(input);
    const subjectHash = highValueConfirmationSubjectHash({
      action,
      request: input,
      turnCard: action === "resolve_turn"
        ? options.project().turnCards[String(input.turnCardId || "")]
        : undefined,
    });
    const issuedAtMs = options.clock().getTime();
    const createdAt = new Date(issuedAtMs).toISOString();
    const expiresAtMs = issuedAtMs + options.confirmationTtlMs;
    const expiresAt = new Date(expiresAtMs).toISOString();
    const summary = highValueConfirmationSummary(action, input);
    const confirmationId = options.idFactory("confirmation", `${action}:${agentId}:${subjectHash}:${input.idempotencyKey}`);
    const confirmation: StoredHighValueConfirmation = {
      confirmationId,
      action,
      agentId,
      explorerId: identity.explorerId,
      subjectHash,
      summary,
      status: "pending",
      createdAt,
      expiresAt,
      expiresAtMs,
    };
    confirmations.set(confirmationId, confirmation);
    requestIdempotency.set(key, confirmationId);
    return withInternalEvents(
      { confirmation: publicConfirmation(confirmation) },
      [requestedConfirmationEvent(confirmation, input)],
    );
  }

  function confirm(input: AnyRecord = {}): EpochHighValueConfirmationConfirmResult {
    if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length === 0) {
      throw new Error("idempotency_key_required");
    }
    const confirmationId = assertNonEmptyString(input.confirmationId, "high_value_confirmation_id");
    const key = `high_value_confirmation_confirm:${confirmationId}:${input.idempotencyKey.trim()}`;
    const existingConfirmationId = confirmIdempotency.get(key);
    const confirmation = confirmations.get(confirmationId);
    if (!confirmation) throw new Error("high_value_confirmation_not_found");
    options.assertExplorerAuth(input, confirmation.explorerId);
    if (existingConfirmationId) {
      const existingConfirmation = confirmations.get(existingConfirmationId);
      if (!existingConfirmation?.confirmationToken) throw new Error("high_value_confirmation_not_confirmed");
      return {
        confirmation: publicConfirmation(existingConfirmation),
        confirmationToken: existingConfirmation.confirmationToken,
        duplicate: true,
      };
    }
    options.assertAbuseAllowed(input, { allowRestrictedScore: true });
    assertFresh(confirmation);
    if (confirmation.status !== "pending") throw new Error("high_value_confirmation_not_pending");
    if (input.explorerId && input.explorerId !== confirmation.explorerId) {
      throw new Error("high_value_confirmation_owner_mismatch");
    }
    const confirmationToken = options.idFactory("confirm_token", `${confirmationId}:${input.idempotencyKey}`);
    const tokenHash = `sha256:${sha256Hex(confirmationToken)}`;
    const confirmed: StoredHighValueConfirmation = {
      ...confirmation,
      status: "confirmed",
      confirmedAt: options.clock().toISOString(),
      tokenHash,
      confirmationToken,
    };
    confirmations.set(confirmationId, confirmed);
    idsByTokenHash.set(tokenHash, confirmationId);
    confirmIdempotency.set(key, confirmationId);
    return withInternalEvents(
      {
        confirmation: publicConfirmation(confirmed),
        confirmationToken,
      },
      [confirmedConfirmationEvent(confirmed, tokenHash, input)],
    );
  }

  function list(input: AnyRecord = {}): EpochHighValueConfirmationListResult {
    const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
    options.assertExplorerAuth(input, explorerId);
    const status = typeof input.status === "string" && input.status.trim()
      ? input.status.trim()
      : undefined;
    const action = typeof input.action === "string" && input.action.trim()
      ? input.action.trim()
      : undefined;
    const agentId = typeof input.agentId === "string" && input.agentId.trim()
      ? input.agentId.trim()
      : undefined;
    const rawLimit = typeof input.limit === "number" && Number.isFinite(input.limit)
      ? input.limit
      : Number(input.limit || 25);
    const limit = Math.max(1, Math.min(100, Math.floor(Number.isFinite(rawLimit) ? rawLimit : 25)));
    const filtered = Array.from(confirmations.values())
      .map(refreshForRead)
      .filter((confirmation) => confirmation.explorerId === explorerId)
      .filter((confirmation) => !status || confirmation.status === status)
      .filter((confirmation) => !action || confirmation.action === action)
      .filter((confirmation) => !agentId || confirmation.agentId === agentId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      explorerId,
      total: filtered.length,
      confirmations: filtered.slice(0, limit).map(publicConfirmation),
    };
  }

  function consume(
    input: AnyRecord,
    action: EpochHighValueConfirmationAction,
    subjectHash: string,
  ): readonly EpochEvent[] {
    if (typeof input.confirmationToken !== "string" || input.confirmationToken.trim().length === 0) {
      throw new Error("high_value_confirmation_required");
    }
    const token = input.confirmationToken.trim();
    const tokenHash = `sha256:${sha256Hex(token)}`;
    const confirmationId = idsByTokenHash.get(tokenHash);
    if (!confirmationId) throw new Error("high_value_confirmation_not_found");
    const confirmation = confirmations.get(confirmationId);
    if (!confirmation) throw new Error("high_value_confirmation_not_found");
    assertFresh(confirmation);
    if (
      confirmation.action !== action
      || confirmation.agentId !== input.agentId
      || confirmation.subjectHash !== subjectHash
    ) {
      throw new Error("high_value_confirmation_mismatch");
    }
    if (confirmation.status === "consumed") {
      const idempotencyKey = assertNonEmptyString(input.idempotencyKey, "idempotency_key").trim();
      if (confirmation.consumedByIdempotencyKey === idempotencyKey && confirmation.consumedByAction === action) {
        return [];
      }
      throw new Error("high_value_confirmation_already_used");
    }
    if (confirmation.status !== "confirmed") throw new Error("high_value_confirmation_not_confirmed");
    const consumed: StoredHighValueConfirmation = {
      ...confirmation,
      status: "consumed",
      consumedAt: options.clock().toISOString(),
      consumedByIdempotencyKey: assertNonEmptyString(input.idempotencyKey, "idempotency_key").trim(),
      consumedByAction: action,
    };
    confirmations.set(confirmation.confirmationId, consumed);
    return [consumedConfirmationEvent(consumed, input)];
  }

  return {
    request,
    confirm,
    list,
    hydrateEvent,
    consume,
  };
}
