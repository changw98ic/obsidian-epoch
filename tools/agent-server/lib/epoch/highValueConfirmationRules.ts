import { resolveEpochCanonicalRegionId } from "../regionAliases.ts";
import { assertNonEmptyString } from "./protocol.ts";
import { type EpochTurnCard } from "./gameCore.ts";
import { sha256Hex } from "./runtimeAuth.ts";

export type EpochHighValueConfirmationAction = "world_message" | "turn_card" | "resolve_turn";

type AnyRecord = Record<string, unknown>;

function turnCardPrompt(input: AnyRecord) {
  return typeof input.prompt === "string" && input.prompt.trim()
    ? input.prompt.trim()
    : "执行一次区域行动";
}

export function turnCardResponseEnvelope(input: AnyRecord, card: EpochTurnCard): { sequence: number; nonce: string } {
  const sequence = typeof input.sequence === "number"
    ? input.sequence
    : typeof input.sequence === "string" && input.sequence.trim()
      ? Number(input.sequence)
      : Number.NaN;
  if (!Number.isInteger(sequence) || sequence <= 0) throw new Error("turn_card_sequence_required");
  if (sequence !== card.sequence) throw new Error("turn_card_sequence_mismatch");
  const nonce = assertNonEmptyString(input.nonce, "turn_card_nonce_required");
  if (nonce !== card.nonce) throw new Error("turn_card_nonce_mismatch");
  return { sequence, nonce };
}

export function highValueConfirmationSubjectHash(input: {
  readonly action: EpochHighValueConfirmationAction;
  readonly request: AnyRecord;
  readonly turnCard?: EpochTurnCard;
}) {
  const { action, request } = input;
  if (action === "world_message") {
    return `sha256:${sha256Hex(assertNonEmptyString(request.body, "message_body"))}`;
  }
  if (action === "turn_card") {
    const agentId = assertNonEmptyString(request.agentId, "agent_id");
    const regionId = resolveEpochCanonicalRegionId(assertNonEmptyString(request.regionId, "region_id"));
    const prompt = turnCardPrompt(request);
    return `sha256:${sha256Hex(JSON.stringify({ agentId, regionId, prompt }))}`;
  }
  if (action === "resolve_turn") {
    const agentId = assertNonEmptyString(request.agentId, "agent_id");
    const turnCardId = assertNonEmptyString(request.turnCardId, "turn_card_id");
    const card = input.turnCard;
    if (!card) throw new Error("turn_card_not_found");
    if (card.agentId !== agentId) throw new Error("turn_card_agent_mismatch");
    const actionOptionId = assertNonEmptyString(request.actionOptionId, "turn_action_option_id");
    if (!card.actionOptions.some((option) => option.actionOptionId === actionOptionId)) {
      throw new Error("turn_action_option_not_found");
    }
    const envelope = turnCardResponseEnvelope(request, card);
    const visibleText = typeof request.visibleText === "string" ? request.visibleText : "";
    return `sha256:${sha256Hex(JSON.stringify({ agentId, turnCardId, sequence: envelope.sequence, nonce: envelope.nonce, actionOptionId, visibleText }))}`;
  }
  throw new Error("high_value_confirmation_action_invalid");
}

export function highValueConfirmationSummary(action: EpochHighValueConfirmationAction, input: AnyRecord) {
  if (typeof input.summary === "string" && input.summary.trim()) {
    return input.summary.trim().slice(0, 180);
  }
  if (action === "world_message") return assertNonEmptyString(input.body, "message_body").slice(0, 180);
  if (action === "turn_card") {
    const regionId = resolveEpochCanonicalRegionId(assertNonEmptyString(input.regionId, "region_id"));
    const prompt = turnCardPrompt(input);
    return `创建 ${regionId} 回合卡：${prompt}`.slice(0, 180);
  }
  if (action === "resolve_turn") {
    const turnCardId = assertNonEmptyString(input.turnCardId, "turn_card_id");
    const actionOptionId = assertNonEmptyString(input.actionOptionId, "turn_action_option_id");
    const visibleText = typeof input.visibleText === "string" && input.visibleText.trim()
      ? `：${input.visibleText.trim()}`
      : "";
    return `结算 ${turnCardId} 选项 ${actionOptionId}${visibleText}`.slice(0, 180);
  }
  return action;
}

export function confirmationActionForAuthScope(scope: string): EpochHighValueConfirmationAction | undefined {
  if (scope === "turn_card") return "turn_card";
  if (scope === "resolve_turn") return "resolve_turn";
  return undefined;
}
