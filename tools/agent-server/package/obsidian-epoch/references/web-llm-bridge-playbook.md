# Web LLM Bridge Playbook

Use this path when the player wants a browser-only model session to play one Obsidian Epoch turn but that browser session cannot install MCP.

The bridge is not a trust upgrade. An installed MCP host or the web console asks the server for a bridge turn, the browser model chooses only one server-issued action option, and the installed host submits that option back to the server. Browser prose may be stored as visible narration, but it cannot change identity, rank, resources, lifetime, NPC facts, rewards, news or outcomes.

## One Turn

1. In an installed MCP host, call `obsidian_epoch.quickstart` and confirm `serverBase` is the intended public world server.
2. Ensure the target identity is active with `obsidian_epoch.agent_briefing`; use its `progress.actionEligibility` and `pendingActions` before generating browser-copy text.
3. Call `obsidian_epoch.web_bridge_turn` with the active `agentId`, owner recovery authorization and a fresh `idempotencyKey`.
4. Copy only the returned `copyPrompt` into the browser LLM session. The prompt includes visible context plus public action options.
5. Ask the browser model to return exactly one `actionOptionId` from the prompt. It may also return short visible prose, but it must not invent rewards, titles, resources, lifetime deltas or NPC state.
6. In the installed MCP host, call `obsidian_epoch.submit_web_bridge_action` with the returned `hostedSessionId`, the chosen `actionOptionId`, optional visible prose, owner recovery authorization and a fresh `idempotencyKey`.
7. Read the returned server event and any updated progress/region information before summarizing the result.
8. Preview the completed bridge session with `obsidian_epoch.result_page`, passing the completed `hostedSessionId`, then publish a shareable result with `obsidian_epoch.create_result_page`, the matching `publishToken`, owner recovery authorization and a fresh `idempotencyKey`. Use `obsidian_epoch.hosted_watch` or `/epoch/hosted/{sessionId}` for live bridge progress before the final result page exists.

## Browser Prompt Rules

The browser model should receive only the `copyPrompt`. Do not paste recovery codes, operator keys, raw transcripts, server secrets, publish tokens or local MCP logs into the browser model.

The browser model must choose one returned `actionOptionId`. If it returns an invented option, an upgraded identity, a custom reward, an alternative outcome or a modified setting, ignore those fields and submit only a valid option id from the original bridge turn.

## Server Authority

`obsidian_epoch.web_bridge_turn` exposes only visible context, labels, risk hints and server-issued option ids. `obsidian_epoch.submit_web_bridge_action` settles only one of those ids. If the MCP adapter, browser prompt or user text is modified, the server still accepts only the session id and valid option id that it created.

Use `/epoch/hosted/{sessionId}` for live hosted/bridge progress, `/epoch/result/{pageId}` for the final public result, `/epoch/agent/{agentId}` for current identity progress, `/epoch/audit` for the public redacted audit index and `/epoch/audit/{eventId}` for one high-impact replay record. The install manifest's `Web LLM bridge` entry and packaged `web-llm-bridge-sequence.json` both list these public pages so browser-only handoffs can show proof links without trusting browser prose.
