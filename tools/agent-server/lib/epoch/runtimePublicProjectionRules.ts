import { publicPartyRun } from "./bountyPartyReadModel.ts";
import type {
  DirectTradeAcceptedPayload,
  DirectTradeCreatedPayload,
  EpochEvent,
  ExplorerRecoveryRotatedPayload,
  IdentityIssuedPayload,
  PartyInviteUpdatedPayload,
  PartyRunCreatedPayload,
} from "./events.ts";
import type {
  EpochCommandResult,
  EpochDirectTrade,
  EpochPartyRun,
  EpochProjection,
} from "./gameCore.ts";

export interface EpochRuntimeResult<TValue> {
  readonly value: TValue;
  readonly events: readonly EpochEvent[];
  readonly projection: EpochProjection;
  readonly duplicate?: boolean;
}

const EPOCH_EVENTS_FOR_PERSISTENCE = Symbol("epochEventsForPersistence");
export const EPOCH_TRANSPORT_RESULT_MAX_BYTES = 1_000_000;

type ResultWithPersistenceEvents = {
  readonly [EPOCH_EVENTS_FOR_PERSISTENCE]?: readonly EpochEvent[];
  readonly events?: readonly EpochEvent[];
};

type EpochTransportCommandResult = {
  readonly value: unknown;
  readonly events: readonly unknown[];
  readonly projection: object;
  readonly [key: string]: unknown;
};

function isEpochTransportCommandResult(value: unknown): value is EpochTransportCommandResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return "value" in record
    && Array.isArray(record.events)
    && Boolean(record.projection)
    && typeof record.projection === "object"
    && !Array.isArray(record.projection);
}

export function boundedEpochTransportValue(value: unknown): unknown {
  if (!isEpochTransportCommandResult(value)) return value;
  const originalBytes = Buffer.byteLength(JSON.stringify(value));
  if (originalBytes <= EPOCH_TRANSPORT_RESULT_MAX_BYTES) return value;
  const { projection: _projection, ...result } = value;
  return {
    ...result,
    projectionOmitted: {
      reason: "response_size_limit",
      originalBytes,
      maxBytes: EPOCH_TRANSPORT_RESULT_MAX_BYTES,
      readTools: [
        "obsidian_epoch.progress",
        "obsidian_epoch.region_info",
        "obsidian_epoch.world_overview",
      ],
    },
  };
}

export function epochEventsForPersistence(result: unknown): readonly EpochEvent[] {
  if (!result || typeof result !== "object") return [];
  const record = result as ResultWithPersistenceEvents;
  return record[EPOCH_EVENTS_FOR_PERSISTENCE] || (Array.isArray(record.events) ? record.events : []);
}

export function attachEpochEventsForPersistence<TResult extends object>(
  result: TResult,
  events: readonly EpochEvent[],
): TResult {
  Object.defineProperty(result, EPOCH_EVENTS_FOR_PERSISTENCE, {
    value: events,
    enumerable: false,
  });
  return result;
}

export function publicEpochEvent(event: EpochEvent): EpochEvent {
  if (event.eventType === "identity_issued" || event.eventType === "explorer_recovery_rotated") {
    const payload = event.payload as IdentityIssuedPayload | ExplorerRecoveryRotatedPayload;
    const { explorerSecretHash: _explorerSecretHash, ...publicPayload } = payload;
    return {
      ...event,
      payload: publicPayload,
    } as EpochEvent;
  }
  if (event.eventType === "direct_trade_created" || event.eventType === "direct_trade_accepted") {
    const payload = event.payload as DirectTradeCreatedPayload | DirectTradeAcceptedPayload;
    const { proposerExplorerId: _proposerExplorerId, counterpartyExplorerId: _counterpartyExplorerId, ...publicPayload } = payload;
    return {
      ...event,
      payload: publicPayload,
    } as EpochEvent;
  }
  if (event.eventType !== "party_run_created" && event.eventType !== "party_invite_updated") return event;
  const payload = event.payload as PartyRunCreatedPayload | PartyInviteUpdatedPayload;
  const { inviteTokenHash, ...publicPayload } = payload;
  return {
    ...event,
    payload: publicPayload,
  } as EpochEvent;
}

export function publicProjection(projection: EpochProjection): EpochProjection {
  return {
    ...projection,
    events: projection.events.map(publicEpochEvent),
    partyRuns: Object.fromEntries(
      Object.entries(projection.partyRuns).map(([partyRunId, partyRun]) => [partyRunId, publicPartyRun(partyRun)]),
    ),
    directTrades: Object.fromEntries(
      Object.entries(projection.directTrades).map(([tradeId, trade]) => [tradeId, publicDirectTrade(trade)]),
    ),
  };
}

function publicDirectTrade(trade: EpochDirectTrade): EpochDirectTrade {
  return {
    ...trade,
    proposerExplorerId: "private",
    counterpartyExplorerId: "private",
  };
}

function isEpochDirectTradeValue(value: unknown): value is EpochDirectTrade {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && typeof (value as { readonly tradeId?: unknown }).tradeId === "string"
    && typeof (value as { readonly proposerAgentId?: unknown }).proposerAgentId === "string"
    && typeof (value as { readonly counterpartyAgentId?: unknown }).counterpartyAgentId === "string"
    && typeof (value as { readonly offeredAsset?: unknown }).offeredAsset === "object";
}

export function isEpochPartyRunValue(value: unknown): value is EpochPartyRun {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && typeof (value as { readonly partyRunId?: unknown }).partyRunId === "string"
    && typeof (value as { readonly regionId?: unknown }).regionId === "string"
    && typeof (value as { readonly leaderAgentId?: unknown }).leaderAgentId === "string"
    && Array.isArray((value as { readonly members?: unknown }).members);
}

export function publicCommandValue<TValue>(value: TValue): TValue {
  if (isEpochPartyRunValue(value)) return publicPartyRun(value) as TValue;
  if (isEpochDirectTradeValue(value)) return publicDirectTrade(value) as TValue;
  return value;
}

export function commandResult<TValue>(result: EpochCommandResult<TValue>): EpochRuntimeResult<TValue> {
  return attachEpochEventsForPersistence({
    value: publicCommandValue(result.value),
    events: result.events.map(publicEpochEvent),
    projection: publicProjection(result.projection),
  }, result.events);
}

export function withInternalEvents<TValue extends object>(result: TValue, events: readonly EpochEvent[]): TValue {
  Object.defineProperty(result, "events", {
    value: events,
    enumerable: false,
  });
  return result;
}
