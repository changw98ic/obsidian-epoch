# Agent Architecture Risk Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the current architecture and TypeScript risks found in the review while preserving the no `.js/.mjs/.jsx` source policy.

**Architecture:** Move HTTP and MCP onto one `createAgentWorldRuntime` domain runtime, then make persistence a runtime dependency instead of duplicated server code. Tighten validation and TypeScript gates around external inputs, and align build scripts with the export-only no-JS artifact policy.

**Tech Stack:** TypeScript, Node `http`, Node test runner, Vite/React/Three.

---

### Task 1: Lock Runtime Behavior With Tests

**Files:**
- Modify: `tools/agent-server/test/mcp.test.ts`
- Modify: `tools/agent-server/test/server.test.ts`

- [ ] Add a server/API test showing HTTP submit rejects a run whose `explorerId` does not match the issued ticket.
- [ ] Add a server/runtime test showing a restarted runtime can hydrate issued tickets and submitted runs from JSONL records.
- [ ] Add validation tests for malformed public-world payloads and no-JS gate ignore behavior.
- [ ] Run the focused tests and confirm the new tests fail for the expected reason.

### Task 2: Extract One Runtime Boundary

**Files:**
- Modify: `tools/agent-server/lib/mcpTools.ts`
- Modify: `tools/agent-server/server.ts`
- Modify: `tools/agent-server/lib/store.ts`

- [ ] Extend `createAgentWorldRuntime` with typed persistence hooks and initial state.
- [ ] Return structured settlement results that HTTP can persist without reimplementing the settlement pipeline.
- [ ] Replace HTTP globals and duplicated submit logic with runtime method calls.
- [ ] Keep MCP behavior unchanged by using the same runtime with no persistence hook.

### Task 3: Durable Hydration and Safer HTTP Boundaries

**Files:**
- Modify: `tools/agent-server/server.ts`
- Modify: `tools/agent-server/lib/store.ts`

- [ ] Load `tickets.jsonl`, `runs.jsonl`, `lore.jsonl`, and `progression.jsonl` at server startup.
- [ ] Add a JSON body size limit.
- [ ] Keep default localhost-only binding and make CORS origin configurable rather than permanently wildcard.

### Task 4: Type Safety, Validation, and Build Contract

**Files:**
- Modify: `tools/graph-react-app/tsconfig.agent-server.json`
- Modify: `tools/agent-server/**/*.ts`
- Modify: `tools/graph-react-app/src/validation.ts`
- Modify: `tools/graph-react-app/scripts/check-no-js-source.ts`
- Modify: `tools/graph-react-app/package.json`

- [ ] Move agent-server toward strict TypeScript by annotating touched runtime/server/store boundaries.
- [ ] Strengthen public-world validation enough to reject malformed arrays and summary counters.
- [ ] Make the no-JS checker ignore only known generated/runtime data paths.
- [ ] Rename preview/build scripts so the no-JS export-only contract is explicit.

### Task 5: Verification

**Commands:**
- `npm run typecheck`
- `npm run agent:test`
- `npm run batch:test`
- `npm run build`
- `find . -path './tools/graph-react-app/node_modules' -prune -o -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.jsx' \) -print`

- [ ] All commands pass.
- [ ] Strict agent-server typecheck no longer depends on `strict: false` for touched boundaries.
