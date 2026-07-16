import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import {
  assertNonEmptyString,
  type EpochCommandContext,
} from "./protocol.ts";
import type { ExperimentMainRuleReview } from "./events.ts";
import type {
  CanonicalizeNpcInput,
  EpochAgentIdentity,
  EpochCommandResult,
  EpochNpcRecord,
  ReviewNpcCandidateInput,
  SubmitNpcCandidateInput,
  SubmitNpcCandidateResult,
} from "./gameCore.ts";
import {
  commandResult,
  type EpochRuntimeResult,
} from "./runtimePublicProjectionRules.ts";

type RuntimeInput = Record<string, unknown>;

export interface NpcCandidateRuntimeOptions {
  readonly assertOperatorKey: (input: RuntimeInput) => void;
  readonly requireIdentity: (agentId: string) => EpochAgentIdentity;
  readonly requireActiveIdentity: (agentId: string) => EpochAgentIdentity;
  readonly ownerVerifiedContext: (input: RuntimeInput, explorerId: string) => EpochCommandContext;
  readonly idempotentlyWithSubject: <TValue>(
    scope: string,
    input: RuntimeInput,
    subject: string,
    run: () => EpochRuntimeResult<TValue>,
    options?: { readonly allowRestrictedScore?: boolean },
  ) => EpochRuntimeResult<TValue>;
  readonly idempotentlyAfterExplorerAuth: <TValue>(
    scope: string,
    input: RuntimeInput,
    explorerId: string,
    run: () => EpochRuntimeResult<TValue>,
    options?: { readonly allowRestrictedScore?: boolean },
  ) => EpochRuntimeResult<TValue>;
  readonly idempotently: <TValue>(
    scope: string,
    input: RuntimeInput,
    run: () => EpochRuntimeResult<TValue>,
    options?: { readonly allowRestrictedScore?: boolean },
  ) => EpochRuntimeResult<TValue>;
  readonly canonicalizeNpc: (
    input: CanonicalizeNpcInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<EpochNpcRecord>;
  readonly submitNpcCandidate: (
    input: SubmitNpcCandidateInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<SubmitNpcCandidateResult>;
  readonly reviewNpcCandidate: (
    input: ReviewNpcCandidateInput,
    context: EpochCommandContext,
  ) => EpochCommandResult<SubmitNpcCandidateResult>;
}

export interface NpcCandidateRuntime {
  readonly npcNote: (input?: RuntimeInput) => EpochRuntimeResult<EpochNpcRecord>;
  readonly submitNpcCandidate: (input?: RuntimeInput) => EpochRuntimeResult<SubmitNpcCandidateResult>;
  readonly reviewNpcCandidate: (input?: RuntimeInput) => EpochRuntimeResult<SubmitNpcCandidateResult>;
}

function isRecord(value: unknown): value is RuntimeInput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function inputString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function createNpcCandidateRuntime(options: NpcCandidateRuntimeOptions): NpcCandidateRuntime {
  function npcNote(input: RuntimeInput = {}) {
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = options.requireActiveIdentity(agentId);
    return options.idempotentlyAfterExplorerAuth("npc_note", input, identity.explorerId, () => commandResult(options.canonicalizeNpc({
      displayName: assertNonEmptyString(input.displayName, "npc_display_name"),
      regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
      traits: Array.isArray(input.traits) ? input.traits : [],
      sourceEventId: optionalString(input.sourceEventId),
    }, options.ownerVerifiedContext(input, identity.explorerId))), { allowRestrictedScore: false });
  }

  function submitNpcCandidate(input: RuntimeInput = {}) {
    const agentId = assertNonEmptyString(input.agentId, "agent_id");
    const identity = options.requireIdentity(agentId);
    return options.idempotentlyAfterExplorerAuth("submit_npc_candidate", input, identity.explorerId, () => commandResult(options.submitNpcCandidate({
      agentId,
      displayName: assertNonEmptyString(input.displayName, "npc_display_name"),
      regionId: resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id")),
      traits: Array.isArray(input.traits) ? input.traits : [],
      storyEvidence: assertNonEmptyString(input.storyEvidence, "story_evidence"),
      sourceEventId: inputString(input.sourceEventId),
      experimentId: inputString(input.experimentId),
      mainRuleReview: isRecord(input.mainRuleReview)
        ? input.mainRuleReview as unknown as ExperimentMainRuleReview
        : undefined,
    }, options.ownerVerifiedContext(input, identity.explorerId))));
  }

  function reviewNpcCandidate(input: RuntimeInput = {}) {
    options.assertOperatorKey(input);
    return options.idempotently("review_npc_candidate", input, () => commandResult(options.reviewNpcCandidate({
      candidateId: assertNonEmptyString(input.candidateId, "candidate_id"),
      resolution: assertNonEmptyString(input.resolution, "npc_candidate_resolution") as "promote" | "reject",
      note: inputString(input.note),
    }, {
      actorExplorerId: "operator",
      trustClass: "system_worker",
      idempotencyKey: optionalString(input.idempotencyKey),
      causationId: inputString(input.causationId),
      correlationId: inputString(input.correlationId),
    })), { allowRestrictedScore: true });
  }

  return {
    npcNote,
    submitNpcCandidate,
    reviewNpcCandidate,
  };
}
