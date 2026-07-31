import type {
  EpochCommandContext,
  EpochResourceId,
  EpochClock,
  EpochIdFactory,
} from "./protocol.ts";
import type { EpochEvent } from "./events.ts";
import { assertNonEmptyString } from "./protocol.ts";
import { eventFactory } from "./eventFactory.ts";
import {
  planResourceGrantEvents,
  planResourceSpendEvents,
  projectResourceGrantBalance,
  projectResourceSpendBalance,
} from "./resourceRules.ts";
import {
  planAttributeGainEvents,
  projectAttributeGainBalance,
  type AttributeGainInput,
  type AttributeScoreBalance,
} from "./attributeRules.ts";
import {
  requireActiveIdentity,
} from "./identityProjectionRules.ts";

export interface ResourceInput {
  readonly agentId: string;
  readonly resourceId: EpochResourceId;
  readonly amount: number;
  readonly reason: string;
}

export interface AttributeInput extends AttributeGainInput {
  readonly agentId: string;
}

export interface GameCoreResourceContext<TProjection> {
  readonly projection: () => TProjection;
  readonly commit: <T>(events: readonly EpochEvent[], value: T) => { readonly events: readonly EpochEvent[]; readonly value: T; readonly projection: TProjection };
  readonly applyEvents: (projection: TProjection, events: readonly EpochEvent[]) => TProjection;
  readonly clock: EpochClock;
  readonly idFactory: EpochIdFactory;
}

export function createResourceCommands<
  TProjection extends
    { readonly identities: Readonly<Record<string, { readonly agentId: string; readonly status: string } | undefined>> } &
    { readonly resourceBalances: Readonly<Record<string, Partial<Record<EpochResourceId, number>>>> } &
    { readonly attributeScores: Readonly<Record<string, AttributeScoreBalance>> },
>(
  ctx: GameCoreResourceContext<TProjection>,
) {
  function grantResource(input: ResourceInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    requireActiveIdentity(current, agentId);
    const nextEvents = planResourceGrantEvents({
      projection: current,
      agentId,
      resource: input,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectResourceGrantBalance({ events: nextEvents, projection: nextProjection }));
  }

  function grantAttribute(input: AttributeInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    requireActiveIdentity(current, agentId);
    const nextEvents = planAttributeGainEvents({
      projection: current,
      agentId,
      attribute: input,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectAttributeGainBalance({ events: nextEvents, projection: nextProjection }));
  }

  function spendResource(input: ResourceInput, context: EpochCommandContext) {
    const current = ctx.projection();
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    requireActiveIdentity(current, agentId);
    const nextEvents = planResourceSpendEvents({
      projection: current,
      agentId,
      resource: input,
      makeEvent: eventFactory(ctx.clock, ctx.idFactory, context),
    });
    const nextProjection = ctx.applyEvents(current, nextEvents);
    return ctx.commit(nextEvents, projectResourceSpendBalance({ events: nextEvents, projection: nextProjection }));
  }

  return {
    grantResource,
    grantAttribute,
    spendResource,
  };
}
