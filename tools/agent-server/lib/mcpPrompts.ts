/**
 * MCP prompt templates for the obsidian-epoch-agent-world server.
 * Exposes structured guidance via `prompts/list` and `prompts/get`.
 */

type JsonRecord = Record<string, unknown>;

export interface McpPromptMessage {
  readonly role: "user" | "assistant";
  readonly content: { readonly type: "text"; readonly text: string };
}

export interface McpPromptDefinition {
  readonly name: string;
  readonly description: string;
  readonly arguments?: readonly McpPromptArgument[];
}

export interface McpPromptArgument {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
}

export interface McpPromptResult {
  readonly description: string;
  readonly messages: readonly McpPromptMessage[];
}

const PHASE6_TEN_RUN_PROMPT: McpPromptDefinition = {
  name: "phase6_ten_run",
  description: "Structured flow for Phase 6 ten-run acceptance: scenario matrix, per-run tool sequence, and key constraints.",
};

const QUICKSTART_PROMPT: McpPromptDefinition = {
  name: "quickstart",
  description: "Basic one-turn playbook for registering an explorer and starting a journey.",
};

const PROMPT_REGISTRY: readonly McpPromptDefinition[] = [
  PHASE6_TEN_RUN_PROMPT,
  QUICKSTART_PROMPT,
];

function userMessage(text: string): McpPromptMessage {
  return { role: "user", content: { type: "text", text } };
}

const SCENARIO_MATRIX = `| runIndex | scenarioTag | taskType |
|---|---|---|
| 1 | low-prepared-resource | resource_acquisition |
| 2 | low-underprepared-information | information_acquisition |
| 3 | medium-prepared-structured | structured_challenge |
| 4 | medium-borderline-companion | companion_support |
| 5 | medium-mismatched-preserve | resource_preservation |
| 6 | high-prepared-priority | priority_commission |
| 7 | high-underprepared-crisis | crisis_retreat |
| 8 | medium-prepared-cultivation | cultivation_material |
| 9 | medium-specialist-crafting | crafting_material |
| 10 | dynamic-mixed-repeat | repeated_route_audit |`;

const PHASE6_TEN_RUN_BODY = `Phase 6 ten-run numerical acceptance protocol for Obsidian Epoch. You are a player agent completing 10 game rounds via MCP tools. All data is server-authoritative.

## Initialization (once)
1. register_explorer — save explorerRef, identityRef, recoveryCode.
2. begin_phase6_experiment — targetRuns=10, save experimentId.

## Per-run flow (runIndex 1..10, serial)
1. prepare_journey — pass the taskType from the scenario matrix below.
2. begin_phase6_run — pass experimentId only; server auto-derives runIndex, scenarioTag, journeyId, seed, versions.
3. player_panel (pre-run) — pass recoveryCode per schema.
4. start_journey_compact — pass the startJourneyBinding object from step 2 verbatim, decisionMode="agent_native", taskGenerationMode="server_fallback".
5. Play loop (4-20 actions):
   - journey_status_compact → propose_journey_step_compact → commit_journey_action_compact
   - On version conflict: re-read journey_status_compact, then retry.
   - Repeat until server returns settled/complete.
6. journey_status_compact (post-settlement) — confirm phase6Settlement.ok=true, status="settled".
7. phase6_experiment_status — confirm run recorded.
8. run_receipt_compact — read the authoritative run receipt.
9. phase6_result_compact — read the authoritative result page.
10. player_panel (post-run) — pass recoveryCode per schema.
11. If identity archived and next run pending: reincarnate (idempotencyKey="phase6-reincarnate-after-run-{runIndex}").

## Scenario matrix
${SCENARIO_MATRIX}

## Operating notes
- One tool call per turn; wait for the result before the next call.
- Use compact tools (propose_journey_step_compact, commit_journey_action_compact, journey_status_compact).
- Pass recoveryCode to authenticated calls as the schema indicates.
- begin_phase6_run only needs experimentId — server handles the rest.
- Accept server-generated settlements, receipts, and result pages as-is.
- player_panel is called exactly 20 times total (2 per run).
- On version conflict: refresh via journey_status_compact before retrying.
- Accept no_retrieval RAG paths gracefully.
- Final output: "十局 MCP 执行完成".`;

const QUICKSTART_BODY = `You are starting an Obsidian Epoch journey via MCP.

## One-turn playbook
1. Call obsidian_epoch.quickstart to get server config and host setup.
2. Call obsidian_epoch.register_explorer with an idempotencyKey. Save the returned explorerId, agentId, and recoveryCode.
3. Call obsidian_epoch.prepare_journey with agentId, destinationRegionId, recoveryCode, and an idempotencyKey. This converts your intent into a structured plan.
4. Call obsidian_epoch.start_journey (or start_journey_compact for external agents) with the prepared plan binding.
5. Play loop:
   - obsidian_epoch.journey_status_compact — read current state and version.
   - obsidian_epoch.propose_journey_step_compact — propose a server-signed action.
   - obsidian_epoch.commit_journey_action_compact — commit at the latest version.
   - Repeat until the journey settles.
6. Call obsidian_epoch.progress to read final identity state.

## Key rules
- Always pass recoveryCode to authenticated tools.
- Use compact tools (journey_status_compact, propose_journey_step_compact, commit_journey_action_compact) for external agent hosts.
- One tool call per turn; wait for the result before proceeding.
- On version conflict, re-read status before retrying.
- Never fabricate results; accept server-authored settlements only.`;

function resolvePrompt(name: string): McpPromptResult {
  switch (name) {
    case "phase6_ten_run":
      return {
        description: PHASE6_TEN_RUN_PROMPT.description,
        messages: [userMessage(PHASE6_TEN_RUN_BODY)],
      };
    case "quickstart":
      return {
        description: QUICKSTART_PROMPT.description,
        messages: [userMessage(QUICKSTART_BODY)],
      };
    default:
      throw new Error(`prompt_not_found:${name}`);
  }
}

export function listMcpPrompts(): readonly JsonRecord[] {
  return PROMPT_REGISTRY.map((prompt) => ({
    name: prompt.name,
    description: prompt.description,
    ...(prompt.arguments ? { arguments: prompt.arguments } : {}),
  }));
}

export function getMcpPrompt(name: string): McpPromptResult {
  return resolvePrompt(name);
}
