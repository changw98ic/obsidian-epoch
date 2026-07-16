import type { EpochProjection } from "./gameCore.ts";
import { abuseLevelForScore } from "./operatorOverviewReadModel.ts";
import { runtimeAbuseActorKey } from "./runtimeInputRules.ts";

type AnyRecord = Record<string, unknown>;

const DEFAULT_ABUSE_STATE_CHANGES_PER_WINDOW = 120;
const DEFAULT_ABUSE_WINDOW_MS = 60_000;

export interface EpochRuntimeAbuseLimits {
  readonly disabled?: boolean;
  readonly stateChangesPerWindow?: number;
  readonly windowMs?: number;
}

export interface EpochAbuseStatus {
  readonly actorKey: string;
  readonly disabled: boolean;
  readonly limit: number;
  readonly windowMs: number;
  readonly count: number;
  readonly remaining: number;
  readonly limited: boolean;
  readonly resetAt?: string;
  readonly abuseScore: number;
  readonly abuseLevel: "clear" | "watch" | "restricted";
  readonly latestAbuseEventId?: string;
}

export interface RuntimeAbuseRuntimeOptions {
  readonly abuseLimits?: EpochRuntimeAbuseLimits;
  readonly clock: () => Date;
  readonly project: () => EpochProjection;
}

export function createRuntimeAbuseRuntime(options: RuntimeAbuseRuntimeOptions) {
  const abuseBuckets = new Map<string, { windowStartedAtMs: number; count: number }>();
  const abuseLimits = options.abuseLimits || {};
  const abuseWindowMs = Math.max(1, Number(abuseLimits.windowMs || DEFAULT_ABUSE_WINDOW_MS));
  const stateChangesPerWindow = Math.max(1, Number(
    abuseLimits.stateChangesPerWindow || DEFAULT_ABUSE_STATE_CHANGES_PER_WINDOW,
  ));

  function assertAllowed(input: AnyRecord, allowOptions: { readonly allowRestrictedScore?: boolean } = {}) {
    if (abuseLimits.disabled) return;
    const actorKey = runtimeAbuseActorKey(input);
    const abuseProfile = options.project().abuseScores[actorKey];
    if (!allowOptions.allowRestrictedScore && abuseLevelForScore(abuseProfile?.score || 0) === "restricted") {
      throw new Error("epoch_abuse_score_restricted");
    }
    const now = options.clock().getTime();
    const bucketKey = `epoch_state_change:${actorKey}`;
    const current = abuseBuckets.get(bucketKey);
    if (!current || now - current.windowStartedAtMs >= abuseWindowMs) {
      abuseBuckets.set(bucketKey, { windowStartedAtMs: now, count: 1 });
      return;
    }
    if (current.count >= stateChangesPerWindow) {
      throw new Error("epoch_abuse_limit_exceeded");
    }
    abuseBuckets.set(bucketKey, {
      windowStartedAtMs: current.windowStartedAtMs,
      count: current.count + 1,
    });
  }

  function status(input: AnyRecord = {}): EpochAbuseStatus {
    const actorKey = runtimeAbuseActorKey(input);
    const now = options.clock().getTime();
    const bucketKey = `epoch_state_change:${actorKey}`;
    const current = abuseBuckets.get(bucketKey);
    const active = current && now - current.windowStartedAtMs < abuseWindowMs ? current : undefined;
    if (current && !active) {
      abuseBuckets.delete(bucketKey);
    }
    const count = active ? active.count : 0;
    const limited = !abuseLimits.disabled && count >= stateChangesPerWindow;
    const abuseProfile = options.project().abuseScores[actorKey];
    const abuseScore = abuseProfile?.score || 0;
    return {
      actorKey,
      disabled: Boolean(abuseLimits.disabled),
      limit: stateChangesPerWindow,
      windowMs: abuseWindowMs,
      count,
      remaining: abuseLimits.disabled ? stateChangesPerWindow : Math.max(0, stateChangesPerWindow - count),
      limited,
      resetAt: active ? new Date(active.windowStartedAtMs + abuseWindowMs).toISOString() : undefined,
      abuseScore,
      abuseLevel: abuseLevelForScore(abuseScore),
      latestAbuseEventId: abuseProfile?.latestEventId,
    };
  }

  return {
    assertAllowed,
    status,
  };
}
