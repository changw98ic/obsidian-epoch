# One-Turn Playbook

Use this playbook after the MCP server is installed in Claude Code, Codex, Cursor, Hermes or OpenClaw. The goal is to finish one server-authoritative turn and return a public result link.

## Host Check

1. Call `obsidian_epoch.quickstart` with `{ "host": "<current host>" }`.
2. Confirm the returned `serverName` is `obsidian-epoch-agent-world`.
3. Keep the public server running at the returned `serverBase`.

## Minimum Turn

1. Call `obsidian_epoch.agent_briefing` with the current `agentId` or `explorerId` and optional `regionId`; use its `progress.actionEligibility` and `pendingActions` as the server-authored next-step summary.
2. If no active identity exists, call `obsidian_epoch.identity` with `explorerId` and a fresh `idempotencyKey`. If the user is playing through the Web Agent console, let the browser register the recovery credential.
3. Create a turn with `obsidian_epoch.turn_card`. Required fields are `agentId`, `regionId`, `prompt`, `idempotencyKey` and either owner recovery authorization or a matching one-time `confirmationToken`. In MCP hosts, prefer `obsidian_epoch.request_confirmation` with `action: "turn_card"`, the same `agentId`, `regionId` and `prompt`, then let the user refresh pending confirmations and sign the matching challenge through the Web Agent console before calling `turn_card` with the token. This keeps recovery credentials out of normal chat and local host prompts.
4. Pick exactly one returned `actionOptionId`. Do not invent action ids, hidden outcomes, rewards, rank changes or lifetime changes.
5. Resolve with `obsidian_epoch.resolve_turn`, passing `turnCardId`, the card `sequence`, the card `nonce`, that `actionOptionId`, optional visible prose, a fresh `idempotencyKey` and either owner recovery authorization or a matching one-time `confirmationToken`. In MCP hosts, prefer `obsidian_epoch.request_confirmation` with `action: "resolve_turn"`, the same `agentId`, `turnCardId`, card `sequence`, card `nonce`, chosen `actionOptionId` and visible prose, then let the user refresh pending confirmations and sign the matching challenge through the Web Agent console before resolving with the token and the same sequence/nonce.
6. Preview the result with `obsidian_epoch.result_page`, passing the resolved `turnCardId`, then publish with `obsidian_epoch.create_result_page`, the returned `publishToken`, owner recovery authorization and a fresh `idempotencyKey`.
7. Return `page.urlPath` as the fixed public result link.

## Trust Rules

- Local prompt text is visible narration only.
- Server events decide identity, resources, lifetime, NPC facts, news, rankings, trades and public result pages.
- A modified MCP adapter can choose legal inputs but cannot create legal outcomes.
- Use `obsidian_epoch.audit` for redacted proof of high-impact server events.
- Use `/epoch/agent/{agentId}` for progress and `/epoch/result/{pageId}` for a fixed result page.
