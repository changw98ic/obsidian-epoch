/**
 * journeyRoleplayRules.ts — PR1 pure type freeze.
 *
 * Defines the server-authoritative "expected life pattern" contract issued at
 * identity issuance, the NPC doubt events recorded against it during a mirror
 * journey, and the roleplay-deviation scoring + hidden-prerequisite link shape
 * used by settlement adjudication.
 *
 * PR1 scope: signatures only. No runtime logic is added or modified here; the
 * only runtime value is the frozen {@link ROLEPLAY_PATTERN_VERSION} constant.
 * Every persisted field is `readonly` and new optional fields are added with
 * `?` so existing construction sites do not break.
 *
 * Zero-bonus boundary: every type in this file is INTERNAL (server-issued
 * pattern, mirror-ledger doubt, scoring result, hidden-objective adjudication).
 * None of them is a Public client offer type (cf. PublicQuestOffer /
 * PublicActionOption), and accordingly none carries the public-leak fields
 * `taskFamilyId` / `strategyAffinity` / `fitBps` / `expectedApproach` (singular)
 * / bonus markers. The plural `expectedApproaches` / `forbiddenApproaches`
 * fields below are the server-owned roleplay norm and live exclusively on
 * Internal identity-payload types.
 */

import type { ApproachTag } from "./journeyStrategyRules.ts";

/**
 * Schema version for the roleplay-pattern contract.
 *
 * Gates the persisted shape of {@link ExpectedLifePattern}, {@link RoleplayScore},
 * and {@link NpcDoubtEvent}. Persisted with the identity payload so a future
 * bump can be detected and the identity re-issued rather than silently
 * mis-scored against an obsolete template.
 */
export const ROLEPLAY_PATTERN_VERSION = 1 as const;

/**
 * Severity of a single NPC doubt observation recorded during a mirror journey.
 *
 * Ordered low < moderate < high < severe. Aggregated into
 * {@link RoleplayScore.deviationBps} by the scoring pass; never persisted to
 * the canonical world on its own — it lives in the mirror ledger until the
 * journey solidifies.
 */
export type DoubtStrength = "low" | "moderate" | "high" | "severe";

/**
 * Server-frozen roleplay norm for a single faction context.
 *
 * `expectedApproaches` / `forbiddenApproaches` constrain the same
 * {@link ApproachTag} space used by strategy adjudication. `toleranceBps`
 * is the per-faction leeway (in basis points, 0–10000) before a deviation
 * upgrades to the next {@link RoleplayDeviationClassification}.
 */
export interface RoleNorm {
  readonly factionId: string;
  readonly expectedApproaches: readonly ApproachTag[];
  readonly forbiddenApproaches: readonly ApproachTag[];
  readonly toleranceBps: number;
}

/**
 * Server-issued, immutable "expected life pattern" bound to one identity.
 *
 * Issued at identity issuance from the identity inputs (race / role / unit /
 * faction / background / lifeGoal / needs / personalityTraits). The first
 * version is produced by a deterministic rule template; server AI may only
 * enrich descriptive text/tags on top — it must never mutate the frozen
 * pattern fields. Carried on the identity payload and read by every
 * roleplay-scoring pass for that identity's lifetime.
 *
 * `patternVersion` ties this instance to {@link ROLEPLAY_PATTERN_VERSION} so an
 * obsolete pattern can be detected and re-issued rather than mis-scored.
 * `inputHash` is the `sha256:` of the deterministic input bundle that produced
 * this pattern, for audit and replay verification.
 */
export interface ExpectedLifePattern {
  readonly identityId: string;
  readonly patternVersion: typeof ROLEPLAY_PATTERN_VERSION;
  /** Server-owned roleplay norm; the plural form is distinct from the public `expectedApproach` bonus marker. */
  readonly expectedApproaches: readonly ApproachTag[];
  readonly forbiddenApproaches: readonly ApproachTag[];
  readonly factionRoleNorms: Readonly<Record<string, RoleNorm>>;
  readonly inputHash: `sha256:${string}`;
  readonly frozenAt: string;
}

/**
 * One NPC doubt observation recorded against an identity's expected pattern.
 *
 * The observation lives in the mirror ledger (`mirrorLedgerEntryId`) and is
 * promoted to the canonical world only when (and if) the journey solidifies.
 * `sourceActionEventId` ties the doubt to the concrete action that triggered
 * it, enabling replay and audit.
 */
export interface NpcDoubtEvent {
  readonly doubtEventId: string;
  readonly journeyId: string;
  readonly identityId: string;
  readonly npcId: string;
  readonly factionId?: string;
  readonly regionId: string;
  readonly doubtStrength: DoubtStrength;
  readonly sourceActionEventId: string;
  readonly reason: string;
  /** Mirror-ledger entry that owns this doubt until solidify; canonical only after solidify. */
  readonly mirrorLedgerEntryId: string;
  readonly recordedAt: string;
}

/**
 * Discrete classification of how far an observed action sequence deviated from
 * the {@link ExpectedLifePattern}. Ordered worst → best as:
 * `forbidden_action` > `major_deviation` > `minor_deviation` > `aligned`.
 *
 * Feeds both collateral sizing and {@link RoleplayScore.exposed}.
 */
export type RoleplayDeviationClassification =
  | "aligned"
  | "minor_deviation"
  | "major_deviation"
  | "forbidden_action";

/**
 * Roleplay-deviation score produced by the scoring pass for one journey.
 *
 * `deviationBps` is the aggregate basis-point penalty (0–10000; higher = worse
 * roleplay) that feeds collateral and `viability.doubtedBy`.
 * `npcDoubtEvents` are the observations that produced the score, in ledger
 * order. `exposed` marks whether the deviation crossed the threshold to
 * surface to the player / canon.
 *
 * Distinct from `journeyStoryReport.identityFidelityPercent`: the story report
 * is a narrative-side fidelity read for presentation; this score is the
 * adjudication-side penalty input to settlement. The two must NOT be merged.
 */
export interface RoleplayScore {
  /** Higher = worse roleplay; feeds collateral + viability.doubtedBy. */
  readonly deviationBps: number;
  readonly classification: RoleplayDeviationClassification;
  readonly npcDoubtEvents: readonly NpcDoubtEvent[];
  readonly exposed: boolean;
  readonly patternVersion: typeof ROLEPLAY_PATTERN_VERSION;
  readonly computedAt: string;
}

/**
 * Lifecycle status of a hidden prerequisite object that an unrevealed
 * objective depends on.
 *
 * `intact` = untouched. `degraded` = partially compromised but still usable.
 * `destroyed` = irreversibly removed (first version: destruction is
 * irreversible — there is no `repaired` state yet).
 */
export type HiddenPrerequisiteStatus = "intact" | "destroyed" | "degraded";

/**
 * Adjudication link between a hidden objective and a prerequisite world object
 * whose status affects whether that objective can still be revealed/completed.
 *
 * Persists into the canonical world on solidify; future journeys read these
 * links for hidden-objective adjudication. In the first version, destruction
 * is irreversible — once `status === "destroyed"`, no later journey can
 * restore the prerequisite.
 */
export interface HiddenPrerequisiteLink {
  /** Hidden objective whose availability depends on this prerequisite. */
  readonly objectiveId: string;
  readonly prerequisiteObjectId: string;
  readonly status: HiddenPrerequisiteStatus;
  readonly destroyedAtActionEventId?: string;
  readonly degradedAtActionEventId?: string;
  /** Ledger entry that observed the status change; canonical only after solidify. */
  readonly sourceLedgerEntryId?: string;
  readonly observedAt: string;
}
