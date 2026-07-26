/**
 * PR8: Action option three-way split and per-outlet public serializers.
 *
 * Splits a full {@link JourneySceneActionOption} (server-internal merged type)
 * into three disjoint surfaces:
 *
 *  - **PublicActionOption** — zero-bonus whitelist for all client-facing outlets.
 *  - **InternalActionOption** — server-only fields (never serialized to clients).
 *  - **SignedActionOption** — signature envelope for tamper detection and replay.
 *
 * Per-outlet serializers (`serializeCompact`, `serializeHosted`,
 * `serializeSession`, `serializeSampling`) emit ONLY public fields. The server
 * rebuilds internal data from `(journeyId, sceneId, actionOptionId,
 * contractVersion)` on commit.
 *
 * Zero-bonus hard constraint: `PublicActionOption` MUST NOT contain
 * `taskFamilyId`, `strategyAffinity`, `fitBps`, `expectedApproach`, or any
 * bonus marker. `riskTerms` (numeric resource cost/reward) is server-internal
 * only — replaced by a narrative `riskLabel` on the public surface.
 */

import type {
  JourneySceneActionOption,
  JourneySceneActionRisk,
} from "./journeySceneContractRules.ts";

// ── Public surface (zero-bonus whitelist) ─────────────────────────────────

/** Decision effect category derived from the action's completion semantics. */
export type ActionDecisionEffect =
  | "attempt_objective"
  | "skip_optional_side"
  | "abandon_required_objective";

/**
 * Public action option — the ONLY fields serialised to client-facing outlets.
 *
 * Zero-bonus boundary: this type MUST NOT contain `taskFamilyId`,
 * `strategyAffinity`, `fitBps`, `expectedApproach`, `approachTags`,
 * `preconditionRefs`, `allowedEffectKinds`, `targetEntityIds`,
 * `actionObjectImpact`, or any numeric `riskTerms` field.
 */
export interface PublicActionOption {
  readonly actionOptionId: string;
  readonly optionKey: string;
  readonly label: string;
  readonly intent: string;
  readonly risk: JourneySceneActionRisk;
  /** Narrative risk description (qualitative only, no numeric encoding). */
  readonly riskLabel: string;
  readonly available: boolean;
  readonly disabledReason?: string;
  readonly decisionEffect: ActionDecisionEffect;
}

// ── Internal surface (server-only, never serialized to clients) ───────────

/**
 * Server-internal fields extracted from a full action option. These fields
 * drive validation, scoring, effect application, and roleplay-doubt hooks.
 * They are NEVER serialized to any client-facing outlet.
 */
export interface InternalActionOption {
  readonly approachTags: readonly string[];
  readonly riskTerms?: {
    readonly resourceCost?: {
      readonly resourceId: "focus" | "stamina";
      readonly amount: number;
    };
    readonly successReward?: {
      readonly resourceId: "coin";
      readonly amount: number;
    };
    readonly exceptionalSuccessReward?: {
      readonly resourceId: "coin";
      readonly amount: number;
    };
  };
  readonly preconditionRefs: readonly string[];
  readonly allowedEffectKinds: readonly string[];
  readonly targetEntityIds: readonly string[];
  readonly expectedApproach?: string;
  readonly actionObjectImpact?: {
    readonly targetEntityId: string;
    readonly effectKind: string;
    readonly degree: number;
  };
  readonly outcomeSummary?: string;
  readonly taskObjectiveId?: string;
  readonly completionKind?: "complete" | "skip";
  readonly routeSelection?: {
    readonly routeId: string;
    readonly factionObjectId?: string;
  };
}

// ── Signed envelope (tamper detection + replay) ───────────────────────────

/**
 * Signature envelope fields present on every public action option. The server
 * verifies by rebuilding internal data from `(journeyId, sceneId,
 * actionOptionId, contractVersion)` and checking the signature against the
 * rebuilt content hash.
 */
export interface SignedActionOption {
  readonly journeyId: string;
  readonly sceneId: string;
  readonly actionOptionId: string;
  readonly contractVersion: number;
  readonly optionHash: `sha256:${string}`;
  readonly signatureAlgorithm: string;
  readonly signatureVersion: 1;
  readonly signingPurpose: string;
  readonly signingKeyId: string;
  readonly serverPublicKey: string;
  readonly signature: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

// ── Three-way split result ────────────────────────────────────────────────

export interface SplitActionOptionResult {
  readonly public: PublicActionOption;
  readonly internal: InternalActionOption;
  readonly signed: SignedActionOption;
}

/**
 * Narrative risk label templates. Qualitative only — no numeric encoding of
 * reward/score/resource cost. Generated server-side from a template that maps
 * risk level to descriptive text.
 */
const RISK_LABELS: Readonly<Record<JourneySceneActionRisk, string>> = Object.freeze({
  low: "低风险：消耗少量集中力，面临轻度对抗",
  medium: "中风险：消耗专注力，可能获得额外报酬",
  high: "高风险：消耗体力，面临较强对抗，携带资源与装备可能改善判定",
});

/**
 * Derive `decisionEffect` from the action's completion semantics and the
 * owning objective kind.
 */
export function deriveDecisionEffect(
  completionKind: "complete" | "skip" | undefined,
  objectiveKind: "main" | "side" | "choice" | undefined,
): ActionDecisionEffect {
  if (completionKind === "skip") {
    return objectiveKind === "side" ? "skip_optional_side" : "abandon_required_objective";
  }
  return "attempt_objective";
}

/**
 * Derive `available` and `disabledReason` from the action option. Currently
 * all server-signed actions are available. Future PRs may gate actions behind
 * precondition checks and return `available: false` with a narrative reason.
 */
function deriveAvailability(_action: JourneySceneActionOption): {
  readonly available: boolean;
  readonly disabledReason?: string;
} {
  // All server-signed actions are available by default.
  // Precondition failures are caught at commit time, not at display time.
  return { available: true };
}

/**
 * Split a full server-internal {@link JourneySceneActionOption} into three
 * disjoint surfaces: public, internal, and signed envelope.
 *
 * @param action - The full merged action option (server-internal type).
 * @param journeyId - Owning journey ID for signature binding.
 * @param sceneId - Owning scene contract ID.
 * @param contractVersion - Scene contract expectedVersion for replay.
 * @param objectiveKind - Kind of the owning objective (for decisionEffect).
 * @param expiresAt - ISO-8601 timestamp when the signed envelope expires.
 */
export function splitActionOption(
  action: JourneySceneActionOption,
  journeyId: string,
  sceneId: string,
  contractVersion: number,
  objectiveKind: "main" | "side" | "choice" | undefined,
  expiresAt: string,
): SplitActionOptionResult {
  const { available, disabledReason } = deriveAvailability(action);
  const decisionEffect = deriveDecisionEffect(action.completionKind, objectiveKind);
  const riskLabel = RISK_LABELS[action.risk];

  const publicOption: PublicActionOption = {
    actionOptionId: action.actionOptionId,
    optionKey: action.optionKey,
    label: action.label,
    intent: action.intent,
    risk: action.risk,
    riskLabel,
    available,
    ...(disabledReason !== undefined ? { disabledReason } : {}),
    decisionEffect,
  };

  const internalOption: InternalActionOption = {
    approachTags: action.approachTags ? [...action.approachTags] : [],
    ...(action.riskTerms !== undefined ? { riskTerms: action.riskTerms } : {}),
    preconditionRefs: [...action.preconditionRefs],
    allowedEffectKinds: [...action.allowedEffectKinds],
    targetEntityIds: [...action.targetEntityIds],
    ...(action.outcomeSummary !== undefined ? { outcomeSummary: action.outcomeSummary } : {}),
    ...(action.taskObjectiveId !== undefined ? { taskObjectiveId: action.taskObjectiveId } : {}),
    ...(action.completionKind !== undefined ? { completionKind: action.completionKind } : {}),
    ...(action.routeSelection !== undefined ? { routeSelection: action.routeSelection } : {}),
    ...(action.actionObjectImpact !== undefined ? { actionObjectImpact: action.actionObjectImpact } : {}),
  };

  const signedOption: SignedActionOption = {
    journeyId,
    sceneId,
    actionOptionId: action.actionOptionId,
    contractVersion,
    optionHash: action.contentHash,
    signatureAlgorithm: action.signatureAlgorithm,
    signatureVersion: action.signatureVersion,
    signingPurpose: action.signingPurpose,
    signingKeyId: action.signingKeyId,
    serverPublicKey: action.serverPublicKey,
    signature: action.signature,
    issuedAt: new Date().toISOString(),
    expiresAt,
  };

  return {
    public: publicOption,
    internal: internalOption,
    signed: signedOption,
  };
}

// ── Per-outlet serializers ────────────────────────────────────────────────

/**
 * Compact transport (MCP tools). Returns only public fields.
 * Bumps transportVersion from 'v1' to 'v2' — old clients get a clear
 * version mismatch.
 */
export function serializeCompact(
  action: JourneySceneActionOption,
  journeyId: string,
  sceneId: string,
  contractVersion: number,
  objectiveKind: "main" | "side" | "choice" | undefined,
  expiresAt: string,
): PublicActionOption & { readonly signed: SignedActionOption } {
  const split = splitActionOption(action, journeyId, sceneId, contractVersion, objectiveKind, expiresAt);
  return { ...split.public, signed: split.signed };
}

/**
 * Hosted session transport. Returns only public fields.
 */
export function serializeHosted(
  action: JourneySceneActionOption,
  journeyId: string,
  sceneId: string,
  contractVersion: number,
  objectiveKind: "main" | "side" | "choice" | undefined,
  expiresAt: string,
): PublicActionOption {
  const split = splitActionOption(action, journeyId, sceneId, contractVersion, objectiveKind, expiresAt);
  return split.public;
}

/**
 * Session transport (sampling createMessage). Returns only public fields.
 */
export function serializeSession(
  action: JourneySceneActionOption,
  journeyId: string,
  sceneId: string,
  contractVersion: number,
  objectiveKind: "main" | "side" | "choice" | undefined,
  expiresAt: string,
): PublicActionOption {
  const split = splitActionOption(action, journeyId, sceneId, contractVersion, objectiveKind, expiresAt);
  return split.public;
}

/**
 * Sampling transport (LLM prompt). Returns only public fields.
 */
export function serializeSampling(
  action: JourneySceneActionOption,
  journeyId: string,
  sceneId: string,
  contractVersion: number,
  objectiveKind: "main" | "side" | "choice" | undefined,
  expiresAt: string,
): PublicActionOption {
  const split = splitActionOption(action, journeyId, sceneId, contractVersion, objectiveKind, expiresAt);
  return split.public;
}

// ── Zero-bonus assertion ──────────────────────────────────────────────────

/**
 * Fields that MUST NOT appear on a public action option. If any of these
 * keys are present, the zero-bonus boundary is violated.
 */
const PUBLIC_FORBIDDEN_KEYS: readonly string[] = [
  "taskFamilyId",
  "strategyAffinity",
  "fitBps",
  "expectedApproach",
  "bonus",
  "approachTags",
  "preconditionRefs",
  "allowedEffectKinds",
  "targetEntityIds",
  "actionObjectImpact",
  "riskTerms",
  "outcomeSummary",
  "taskObjectiveId",
  "completionKind",
  "routeSelection",
  "contentHash",
];

/**
 * Assert that a public action option does not contain any forbidden
 * (server-internal) fields. Throws at runtime if a forbidden key is detected.
 *
 * This is a defence-in-depth check — the type system enforces the whitelist
 * at compile time, but runtime assertions catch accidental spread operators
 * or dynamic field assignment.
 */
export function assertPublicActionSafe(option: unknown): asserts option is PublicActionOption {
  if (!option || typeof option !== "object" || Array.isArray(option)) {
    throw new Error("public_action_option_not_object");
  }
  const record = option as Record<string, unknown>;
  for (const key of PUBLIC_FORBIDDEN_KEYS) {
    if (key in record) {
      throw new Error(`public_action_option_forbidden_field:${key}`);
    }
  }
  // Verify required public fields are present
  if (typeof record.actionOptionId !== "string" || !record.actionOptionId) {
    throw new Error("public_action_option_missing_actionOptionId");
  }
  if (typeof record.optionKey !== "string" || !record.optionKey) {
    throw new Error("public_action_option_missing_optionKey");
  }
  if (typeof record.label !== "string") {
    throw new Error("public_action_option_missing_label");
  }
  if (typeof record.intent !== "string") {
    throw new Error("public_action_option_missing_intent");
  }
  if (record.risk !== "low" && record.risk !== "medium" && record.risk !== "high") {
    throw new Error("public_action_option_invalid_risk");
  }
  if (typeof record.riskLabel !== "string" || !record.riskLabel) {
    throw new Error("public_action_option_missing_riskLabel");
  }
  if (typeof record.available !== "boolean") {
    throw new Error("public_action_option_missing_available");
  }
  if (typeof record.decisionEffect !== "string") {
    throw new Error("public_action_option_missing_decisionEffect");
  }
}

/**
 * Assert that a public action option carries zero numeric bonus information.
 * This is a stricter check than `assertPublicActionSafe` — it verifies that
 * no numeric patterns leak through `riskLabel` or other text fields.
 *
 * Forbidden patterns in `riskLabel`:
 * - Digit sequences > 2 characters (e.g. "收益+300")
 * - Currency/resource names paired with numbers (e.g. "金币 5")
 */
export function assertPublicActionZeroBonus(option: PublicActionOption): void {
  assertPublicActionSafe(option);

  // Check riskLabel for numeric encoding
  const { riskLabel } = option;
  // Reject digit sequences of 3+ (would encode reward/amount values)
  if (/\d{3,}/.test(riskLabel)) {
    throw new Error("public_action_option_riskLabel_numeric_leak");
  }
  // Reject resource names paired with numbers
  if (/(?:金币|coin|focus|stamina|体力|专注)\s*\d/i.test(riskLabel)) {
    throw new Error("public_action_option_riskLabel_resource_leak");
  }
}
