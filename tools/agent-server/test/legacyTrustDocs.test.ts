import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(testDir, "../package/obsidian-epoch");

function assertIncludesInOrder(source: string, parts: readonly string[]) {
  let offset = 0;
  for (const part of parts) {
    const index = source.indexOf(part, offset);
    assert.notEqual(index, -1, `expected ${JSON.stringify(part)} after offset ${offset}`);
    offset = index + part.length;
  }
}

test("legacy authored-report docs declare channel and delivery trust labels", () => {
  const packagedSkill = readFileSync(join(packageDir, "SKILL.md"), "utf8");
  const protocolReference = readFileSync(join(packageDir, "references/protocol.md"), "utf8");

  assertIncludesInOrder(packagedSkill, [
    "legacy_authored_report",
    "channelClass",
    "external_agent_hosted",
    "deliveryTrust",
    "untrusted_client",
    "contextVersion",
    "signedEnvelope",
    "contentHash",
    "signature",
    "sequenceWindow",
    "issued",
    "active",
    "submitted",
    "settled",
    "expired",
    "void",
    "agent_world.run_heartbeat",
    "heartbeatAt",
    "agent_world.archive_local_report",
    "local_trial_archive",
    "does not require runTicket",
    "ticket_context_envelope_required",
    "ticket_context_envelope_mismatch",
    "ticket_high_risk_confirmation_required",
    "ticket_cooldown_rule_unverified",
    "ticket_canonical_action_unverified",
    "ticket_outcome_state_unverified",
    "candidateClaims",
    "does not raise score",
    "server-capped claimSlots",
    "sourceRewards",
    "pending",
    "released",
    "claim status migration table",
    "rumor",
    "inscribed",
    "manualApprovalId",
    "canonAdoptionEventId",
    "agent_world.community_react",
    "reactionPolicy.claimStatusEffect",
    "none",
    "sorting",
    "attention",
    "truth adjudication",
    "outbox.summary",
    "status",
    "retryCount",
    "deadLetter",
    "agent_world.outbox",
    "dead-letter queue",
    "agent_world.replay_outbox",
    "ticket_identity_archived",
    "ticket_event_schema_invalid",
    "ticket_event_sequence_invalid",
    "ticket_item_use_unverified",
  ]);
  assertIncludesInOrder(protocolReference, [
    "legacy_authored_report",
    "channelClass",
    "external_agent_hosted",
    "deliveryTrust",
    "untrusted_client",
    "contextVersion",
    "signedEnvelope",
    "contentHash",
    "signature",
    "sequenceWindow",
    "issued",
    "active",
    "submitted",
    "settled",
    "expired",
    "void",
    "agent_world.run_heartbeat",
    "heartbeatAt",
    "agent_world.archive_local_report",
    "local_trial_archive",
    "does not require runTicket",
    "ticket_context_version_mismatch",
    "ticket_context_envelope_required",
    "ticket_context_envelope_mismatch",
    "ticket_high_risk_confirmation_required",
    "ticket_cooldown_rule_unverified",
    "ticket_canonical_action_unverified",
    "ticket_outcome_state_unverified",
    "candidateClaims",
    "does not raise score",
    "server-capped claimSlots",
    "sourceRewards",
    "pending",
    "released",
    "claim status migration table",
    "rumor",
    "inscribed",
    "manualApprovalId",
    "canonAdoptionEventId",
    "agent_world.community_react",
    "reactionPolicy.claimStatusEffect",
    "none",
    "sorting",
    "attention",
    "truth adjudication",
    "outbox.summary",
    "status",
    "retryCount",
    "deadLetter",
    "agent_world.outbox",
    "dead-letter queue",
    "agent_world.replay_outbox",
    "outbox.jsonl",
    "ticket_identity_archived",
    "ticket_event_schema_invalid",
    "ticket_event_sequence_invalid",
    "ticket_item_use_unverified",
    "ticket_sequence_mismatch",
    "submitted run summary",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "graphSync",
    "pending_sync",
    "synced",
    "retry_later",
    "待同步",
    "已同步",
    "稍后重试",
  ]);
  assertIncludesInOrder(protocolReference, [
    "graphSync",
    "pending_sync",
    "synced",
    "retry_later",
    "待同步",
    "已同步",
    "稍后重试",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "review budget",
    "identity reputation",
    "runTicket",
    "length",
    "similarity",
    "system load",
    "delayed review queue",
    "agent_world.review_queue",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "contextSnapshot",
    "settingCards",
    "selectionReason",
    "exposureLevel",
    "retrievalParams",
    "diversityPolicy",
    "filteringReasons",
    "low-exposure",
    "agent_world.context_snapshots",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "obsidian_epoch.delete_result_page",
    "deleted",
    "deletionSummary",
    "fullPayloadHash",
    "receiptPayloadHash",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "shareToken",
    "shareVersion",
    "result_page_share_version_required",
    "result_page_share_version_mismatch",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "agentSelfStatement",
    "identity",
    "region",
    "recorded event facts",
    "prompt",
    "system",
    "rules",
    "model",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "promptLayers",
    "system_policy",
    "agent_identity_boundary",
    "user_mandate",
    "user_additional_instruction",
    "additionalInstruction",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "goalPriority",
    "safety_boundary",
    "user_behavior_red_lines",
    "user_mandate",
    "agent_long_term_goals",
    "opportunistic_side_quests",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "partyRunId",
    "participantRole",
    "multiAgentReservation",
    "reserved_only",
    "legacy authored-report party play",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "behaviorRedLines",
    "not betraying allies",
    "not harming civilians",
    "not contacting old gods",
    "explicit_user_authorization_required",
  ]);
  assertIncludesInOrder(packagedSkill, [
    "drama",
    "high-risk conflict",
    "event chain",
  ]);
  assertIncludesInOrder(protocolReference, [
    "review budget",
    "identity reputation",
    "runTicket",
    "length",
    "similarity",
    "system load",
    "delayed review queue",
    "agent_world.review_queue",
    "/api/review-queue",
  ]);
  assertIncludesInOrder(protocolReference, [
    "contextSnapshot",
    "settingCards",
    "selectionReason",
    "exposureLevel",
    "retrievalParams",
    "diversityPolicy",
    "filteringReasons",
    "low-exposure",
    "agent_world.context_snapshots",
    "/api/context/snapshots",
    "context-snapshots.jsonl",
  ]);
  assertIncludesInOrder(protocolReference, [
    "obsidian_epoch.delete_result_page",
    "/api/epoch/result-page/delete",
    "deleted",
    "deletionSummary",
    "fullPayloadHash",
    "receiptPayloadHash",
    "result-pages.jsonl",
  ]);
  assertIncludesInOrder(protocolReference, [
    "shareToken",
    "shareVersion",
    "result_page_share_version_required",
    "result_page_share_version_mismatch",
  ]);
  assertIncludesInOrder(protocolReference, [
    "agentSelfStatement",
    "identity",
    "region",
    "recorded event facts",
    "prompt",
    "system",
    "rules",
    "model",
  ]);
  assertIncludesInOrder(protocolReference, [
    "promptLayers",
    "system_policy",
    "agent_identity_boundary",
    "user_mandate",
    "user_additional_instruction",
    "additionalInstruction",
  ]);
  assertIncludesInOrder(protocolReference, [
    "goalPriority",
    "safety_boundary",
    "user_behavior_red_lines",
    "user_mandate",
    "agent_long_term_goals",
    "opportunistic_side_quests",
  ]);
  assertIncludesInOrder(protocolReference, [
    "partyRunId",
    "participantRole",
    "multiAgentReservation",
    "reserved_only",
    "legacy authored-report party play",
  ]);
  assertIncludesInOrder(protocolReference, [
    "behaviorRedLines",
    "betray allies",
    "harm civilians",
    "contact old gods",
    "explicit_user_authorization_required",
  ]);
  assertIncludesInOrder(protocolReference, [
    "drama",
    "high-risk conflict",
    "event chain",
  ]);
});

test("hosted action docs declare action-level channel and delivery trust labels", () => {
  const packagedSkill = readFileSync(join(packageDir, "SKILL.md"), "utf8");
  const protocolReference = readFileSync(join(packageDir, "references/protocol.md"), "utf8");

  assertIncludesInOrder(packagedSkill, [
    "trusted-runner play",
    "channelClass",
    "deliveryTrust",
    "remote_attested_runner",
    "signedEnvelope",
    "contentHash",
    "signature",
  ]);
  assertIncludesInOrder(protocolReference, [
    "hosted_action_recorded",
    "channelClass",
    "deliveryTrust",
    "remote_attested_runner",
    "signedEnvelope",
    "contentHash",
    "signature",
  ]);
  assert.match(packagedSkill, /returned hosted action declares[\s\S]*signedEnvelope[\s\S]*contentHash[\s\S]*signature/);
  assert.match(protocolReference, /Each hosted action response[\s\S]*signedEnvelope[\s\S]*contentHash[\s\S]*signature/);
});

test("public client trust docs declare forged trust downgrades", () => {
  const packagedSkill = readFileSync(join(packageDir, "SKILL.md"), "utf8");
  const protocolReference = readFileSync(join(packageDir, "references/protocol.md"), "utf8");

  assertIncludesInOrder(packagedSkill, [
    "obsidian_epoch.identity",
    "obsidian_epoch.npc_note",
    "obsidian_epoch.request_confirmation",
    "trustClass",
    "untrusted_client",
  ]);
  assertIncludesInOrder(protocolReference, [
    "obsidian_epoch.identity",
    "obsidian_epoch.npc_note",
    "obsidian_epoch.request_confirmation",
    "client-declared",
    "trustClass",
    "untrusted_client",
  ]);
});
