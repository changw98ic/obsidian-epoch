# Agent Explorer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest local vertical slice of the Agent Explorer spec: a user creates a local explorer, starts a server-issued run ticket, drives a short agent run in the browser without uploading an API key, submits a battle report, and receives a deterministic server adjudication.

**Architecture:** Keep the current React/Vite world-map app as the client shell and add an `agent` feature area. Add a small Node server under `tools/agent-server` using only built-in Node modules for the MVP, so no new dependencies are required. Persist MVP records as JSONL files under `tools/agent-server/data` and keep all adjudication deterministic until the product loop is proven.

**Tech Stack:** React 19, Vite, browser Web Crypto, Node.js built-in `http`, `crypto`, `node:test`, JSON/JSONL files.

---

## Scope Decision

The full spec is too large for one implementation plan. This plan covers only the MVP vertical slice.

Separate later plans should cover:

- Shared lore graph overlay and map visualization.
- Real model-provider adapters and BYOK prompt orchestration.
- Claim deduplication, semantic similarity, and conflict graph.
- Reputation economy, source rewards, and anti-abuse analytics.
- Community dispute court, appeals, and moderation tooling.
- TTS, soundscapes, and settlement effects.
- Transparency log or decentralized hash anchoring.

## MVP Behavior

MVP must prove these properties:

- The user can complete one local agent run without logging in.
- The user API key never leaves the browser.
- A server-issued `runTicket` is required for settlement.
- The server ignores client-provided scores.
- The server returns an adjudication with score, rating, claim slots, and next action.
- Private/demo runs cannot create world-impacting records.
- Existing world data remains read-only.

## File Structure

Create:

- `tools/agent-server/server.mjs`  
  Node HTTP server and route dispatcher.
- `tools/agent-server/lib/store.mjs`  
  JSONL append/read helpers and data directory creation.
- `tools/agent-server/lib/tickets.mjs`  
  `runTicket` creation, state transitions, and idempotency checks.
- `tools/agent-server/lib/adjudicator.mjs`  
  Deterministic MVP scoring and claim-slot calculation.
- `tools/agent-server/lib/safety.mjs`  
  API-key pattern detection and public-safe text helpers.
- `tools/agent-server/test/adjudicator.test.mjs`  
  Node tests for scoring thresholds and client-score rejection.
- `tools/agent-server/test/tickets.test.mjs`  
  Node tests for ticket state and duplicate submission.
- `tools/graph-react-app/src/agent/agentTypes.js`  
  Frontend data shapes and constants.
- `tools/graph-react-app/src/agent/localIdentity.js`  
  Local explorer creation and recovery-code export.
- `tools/graph-react-app/src/agent/api.js`  
  Client calls to the local agent server.
- `tools/graph-react-app/src/agent/demoRun.js`  
  Deterministic demo mode and no-upload sample run.
- `tools/graph-react-app/src/agent/AgentExplorer.jsx`  
  MVP UI for first run, Key safety, run flow, and settlement.
- `tools/graph-react-app/src/agent/AgentExplorer.css`  
  MVP layout styles.

Modify:

- `tools/graph-react-app/src/App.jsx`  
  Add a mode switch or entry button for Agent Explorer without removing the existing map.
- `tools/graph-react-app/src/styles.css`  
  Import or compose the Agent Explorer styles.
- `tools/graph-react-app/package.json`  
  Add scripts for running the local agent server and server tests.

Do not modify:

- Existing Obsidian world Markdown files.
- Existing map data generator logic.
- Existing world-map JSON as a write target.

## Task 1: Server Skeleton and Health Check

**Files:**
- Create: `tools/agent-server/server.mjs`
- Create: `tools/agent-server/lib/store.mjs`
- Modify: `tools/graph-react-app/package.json`

- [ ] **Step 1: Add JSONL store helper**

Create `tools/agent-server/lib/store.mjs`:

```js
import { mkdir, appendFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
export const dataDir = join(rootDir, "data");

export async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

export async function appendJsonl(fileName, record) {
  await ensureDataDir();
  await appendFile(join(dataDir, fileName), `${JSON.stringify(record)}\n`, "utf8");
}

export async function readJsonl(fileName) {
  try {
    const raw = await readFile(join(dataDir, fileName), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
```

- [ ] **Step 2: Add server health route**

Create `tools/agent-server/server.mjs`:

```js
import http from "node:http";
import { ensureDataDir } from "./lib/store.mjs";

const port = Number(process.env.AGENT_SERVER_PORT || 8787);

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "http://127.0.0.1:5173",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(value));
}

async function handle(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }
  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { ok: true, service: "agent-server" });
    return;
  }
  sendJson(response, 404, { error: "not_found" });
}

await ensureDataDir();
http.createServer((request, response) => {
  handle(request, response).catch((error) => {
    sendJson(response, 500, { error: "internal_error", message: error.message });
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`agent-server listening on http://127.0.0.1:${port}`);
});
```

- [ ] **Step 3: Add package scripts**

Modify `tools/graph-react-app/package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "python3 ../build_world_map_data.py && vite build && node scripts/copy-data.mjs",
    "preview": "vite preview --host 127.0.0.1",
    "agent:server": "node ../agent-server/server.mjs",
    "agent:test": "node --test ../agent-server/test/*.test.mjs"
  }
}
```

- [ ] **Step 4: Verify server health**

Run:

```bash
cd tools/graph-react-app
npm run agent:server
```

Expected terminal line:

```text
agent-server listening on http://127.0.0.1:8787
```

In another terminal:

```bash
curl -s http://127.0.0.1:8787/api/health
```

Expected:

```json
{"ok":true,"service":"agent-server"}
```

## Task 2: RunTicket and Idempotent Submission

**Files:**
- Create: `tools/agent-server/lib/tickets.mjs`
- Create: `tools/agent-server/test/tickets.test.mjs`
- Modify: `tools/agent-server/server.mjs`

- [ ] **Step 1: Write ticket tests**

Create `tools/agent-server/test/tickets.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createRunTicket, acceptSubmission } from "../lib/tickets.mjs";

test("createRunTicket creates issued ticket with run id", () => {
  const ticket = createRunTicket({ explorerId: "explorer_a", agentId: "agent_a" });
  assert.equal(ticket.status, "issued");
  assert.match(ticket.runId, /^run_/);
  assert.equal(ticket.explorerId, "explorer_a");
});

test("acceptSubmission is idempotent for same payload hash", () => {
  const ticket = createRunTicket({ explorerId: "explorer_a", agentId: "agent_a" });
  const first = acceptSubmission(ticket, "hash_1");
  const second = acceptSubmission(first.ticket, "hash_1");
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(second.idempotent, true);
});

test("acceptSubmission rejects different payload after submit", () => {
  const ticket = createRunTicket({ explorerId: "explorer_a", agentId: "agent_a" });
  const first = acceptSubmission(ticket, "hash_1");
  assert.throws(() => acceptSubmission(first.ticket, "hash_2"), /already_submitted/);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
cd tools/graph-react-app
npm run agent:test
```

Expected: FAIL because `../lib/tickets.mjs` does not exist.

- [ ] **Step 3: Implement ticket module**

Create `tools/agent-server/lib/tickets.mjs`:

```js
import { randomUUID } from "node:crypto";

export function createRunTicket({ explorerId, agentId, risk = "balanced" }) {
  const now = new Date().toISOString();
  return {
    runTicket: `ticket_${randomUUID()}`,
    runId: `run_${randomUUID()}`,
    explorerId,
    agentId,
    risk,
    status: "issued",
    createdAt: now,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    payloadHash: null,
  };
}

export function acceptSubmission(ticket, payloadHash) {
  if (ticket.status === "submitted" || ticket.status === "settled") {
    if (ticket.payloadHash === payloadHash) {
      return { accepted: true, idempotent: true, ticket };
    }
    throw new Error("already_submitted");
  }
  if (ticket.status !== "issued" && ticket.status !== "active") {
    throw new Error(`invalid_ticket_status:${ticket.status}`);
  }
  return {
    accepted: true,
    idempotent: false,
    ticket: {
      ...ticket,
      status: "submitted",
      payloadHash,
      submittedAt: new Date().toISOString(),
    },
  };
}
```

- [ ] **Step 4: Run tests and confirm pass**

Run:

```bash
cd tools/graph-react-app
npm run agent:test
```

Expected: PASS for ticket tests.

## Task 3: Deterministic MVP Adjudicator

**Files:**
- Create: `tools/agent-server/lib/adjudicator.mjs`
- Create: `tools/agent-server/lib/safety.mjs`
- Create: `tools/agent-server/test/adjudicator.test.mjs`

- [ ] **Step 1: Write adjudicator tests**

Create `tools/agent-server/test/adjudicator.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { adjudicateRun } from "../lib/adjudicator.mjs";
import { containsSecretLikeText } from "../lib/safety.mjs";

test("adjudicator ignores client score and calculates threshold", () => {
  const result = adjudicateRun({
    clientScore: 100,
    anchors: [{ type: "place", id: "region:腐林" }],
    events: Array.from({ length: 8 }, (_, index) => ({ id: `event_${index}` })),
    candidateClaims: [
      {
        type: "place_anomaly",
        subject: "会回信的树洞",
        object: "会回应投入树洞的声音记录",
        limits: "只在孢雾浓度较高时出现",
      },
    ],
    ending: { summary: "agent 带回了可审档发现。" },
  });
  assert.notEqual(result.score, 100);
  assert.equal(result.rating, "入档");
  assert.equal(result.claimSlots, 1);
});

test("adjudicator seals report without anchors", () => {
  const result = adjudicateRun({
    anchors: [],
    events: [],
    candidateClaims: [],
    ending: { summary: "无锚点记录。" },
  });
  assert.equal(result.rating, "战报封存");
  assert.equal(result.claimSlots, 0);
});

test("safety detects api-key-like text", () => {
  assert.equal(containsSecretLikeText("sk-abcdefghijklmnopqrstuvwxyz1234567890"), true);
  assert.equal(containsSecretLikeText("腐林边界出现盐痕"), false);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
cd tools/graph-react-app
npm run agent:test
```

Expected: FAIL because adjudicator and safety modules do not exist.

- [ ] **Step 3: Implement safety helpers**

Create `tools/agent-server/lib/safety.mjs`:

```js
const secretPatterns = [
  /\bsk-[A-Za-z0-9_\-]{20,}\b/,
  /\b[A-Za-z0-9_\-]{32,}\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}\b/,
];

export function containsSecretLikeText(value) {
  const text = String(value || "");
  return secretPatterns.some((pattern) => pattern.test(text));
}

export function publicSafeSummary(value, maxLength = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
```

- [ ] **Step 4: Implement deterministic adjudicator**

Create `tools/agent-server/lib/adjudicator.mjs`:

```js
import { containsSecretLikeText, publicSafeSummary } from "./safety.mjs";

function ratingFor(score) {
  if (score >= 98) return ["夯级候选", 4];
  if (score >= 90) return ["铭刻", 4];
  if (score >= 80) return ["共鸣", 3];
  if (score >= 70) return ["记名", 2];
  if (score >= 60) return ["入档", 1];
  return ["战报封存", 0];
}

export function adjudicateRun(run) {
  const anchors = Array.isArray(run.anchors) ? run.anchors : [];
  const events = Array.isArray(run.events) ? run.events : [];
  const claims = Array.isArray(run.candidateClaims) ? run.candidateClaims : [];
  const text = JSON.stringify(run);
  if (containsSecretLikeText(text)) {
    return {
      score: 0,
      rating: "安全退回",
      claimSlots: 0,
      publicSummary: "提交内容疑似包含密钥或敏感凭证，未进入审档。",
      findings: ["疑似密钥内容"],
    };
  }

  let score = 20;
  score += Math.min(anchors.length, 3) * 10;
  score += Math.min(events.length, 10) * 2;
  score += Math.min(claims.length, 4) * 8;
  if (claims.some((claim) => claim.limits)) score += 8;
  if (run.ending?.summary) score += 8;
  score = Math.max(0, Math.min(97, score));

  if (!anchors.length) score = Math.min(score, 45);
  const [rating, claimSlots] = ratingFor(score);
  return {
    score,
    rating,
    claimSlots,
    publicSummary: publicSafeSummary(run.ending?.summary || "战报已审档。"),
    findings: [
      anchors.length ? "存在世界锚点" : "缺少世界锚点",
      claims.length ? "存在可入档发现" : "缺少可入档发现",
      run.ending?.summary ? "存在结局摘要" : "缺少结局摘要",
    ],
  };
}
```

- [ ] **Step 5: Run tests and confirm pass**

Run:

```bash
cd tools/graph-react-app
npm run agent:test
```

Expected: PASS for adjudicator and ticket tests.

## Task 4: Server RunTicket and Submit Routes

**Files:**
- Modify: `tools/agent-server/server.mjs`

- [ ] **Step 1: Add body parsing and routes**

Modify `tools/agent-server/server.mjs` to include these imports:

```js
import { createHash } from "node:crypto";
import { appendJsonl, readJsonl } from "./lib/store.mjs";
import { createRunTicket, acceptSubmission } from "./lib/tickets.mjs";
import { adjudicateRun } from "./lib/adjudicator.mjs";
```

Add helpers:

```js
async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function hashPayload(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
```

Inside `handle`, before the 404 route:

```js
if (request.method === "POST" && request.url === "/api/runs/start") {
  const body = await readJson(request);
  const ticket = createRunTicket({
    explorerId: body.explorerId || "anonymous",
    agentId: body.agentId || "agent_demo",
    risk: body.risk || "balanced",
  });
  await appendJsonl("tickets.jsonl", ticket);
  sendJson(response, 200, ticket);
  return;
}

if (request.method === "POST" && request.url === "/api/runs/submit") {
  const body = await readJson(request);
  const tickets = await readJsonl("tickets.jsonl");
  const ticket = tickets.find((item) => item.runTicket === body.runTicket);
  if (!ticket) {
    sendJson(response, 404, { error: "ticket_not_found" });
    return;
  }
  const payloadHash = hashPayload(body.run);
  const accepted = acceptSubmission(ticket, payloadHash);
  const adjudication = adjudicateRun(body.run || {});
  const record = {
    runTicket: body.runTicket,
    runId: ticket.runId,
    explorerId: ticket.explorerId,
    agentId: ticket.agentId,
    payloadHash,
    adjudication,
    createdAt: new Date().toISOString(),
  };
  await appendJsonl("submissions.jsonl", record);
  await appendJsonl("tickets.jsonl", accepted.ticket);
  sendJson(response, 200, record);
  return;
}
```

- [ ] **Step 2: Verify routes manually**

Start server:

```bash
cd tools/graph-react-app
npm run agent:server
```

Start run:

```bash
curl -s -X POST http://127.0.0.1:8787/api/runs/start \
  -H 'content-type: application/json' \
  -d '{"explorerId":"explorer_demo","agentId":"agent_demo","risk":"balanced"}'
```

Expected: JSON with `runTicket`, `runId`, and `status:"issued"`.

Submit run using the returned `runTicket`:

```bash
curl -s -X POST http://127.0.0.1:8787/api/runs/submit \
  -H 'content-type: application/json' \
  -d '{"runTicket":"PASTE_TICKET","run":{"anchors":[{"type":"place","id":"region:腐林"}],"events":[{"id":"event_1"}],"candidateClaims":[{"type":"place_anomaly","subject":"会回信的树洞","object":"回应声音","limits":"只在孢雾浓度高时"}],"ending":{"summary":"灰档-07 带回了一条可入档发现。"}}}'
```

Expected: JSON with `adjudication.score`, `adjudication.rating`, and `adjudication.claimSlots`.

## Task 5: Frontend Local Identity and Demo Run

**Files:**
- Create: `tools/graph-react-app/src/agent/localIdentity.js`
- Create: `tools/graph-react-app/src/agent/demoRun.js`

- [ ] **Step 1: Add local identity helper**

Create `tools/graph-react-app/src/agent/localIdentity.js`:

```js
const storageKey = "obsidianEpoch.explorer";

export function loadOrCreateExplorer() {
  const existing = localStorage.getItem(storageKey);
  if (existing) return JSON.parse(existing);
  const explorer = {
    explorerId: `explorer_${crypto.randomUUID().slice(0, 8)}`,
    displayName: "未署名探索者",
    createdAt: new Date().toISOString(),
    backedUp: false,
  };
  localStorage.setItem(storageKey, JSON.stringify(explorer));
  return explorer;
}

export function markExplorerBackedUp() {
  const explorer = loadOrCreateExplorer();
  const next = { ...explorer, backedUp: true };
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}
```

- [ ] **Step 2: Add deterministic demo run**

Create `tools/graph-react-app/src/agent/demoRun.js`:

```js
export function createDemoRun({ explorerId, agentId, runTicket }) {
  return {
    runTicket,
    run: {
      explorerId,
      agentId,
      anchors: [
        { type: "place", id: "region:腐林" },
        { type: "creature", id: "孢雾巡猎者" },
      ],
      events: [
        { id: "event_arrival", summary: "灰档-07 抵达腐林边界。" },
        { id: "event_echo", summary: "树洞回应了三天前的录音。" },
        { id: "event_retreat", summary: "agent 在孢雾升高前撤退。" },
      ],
      candidateClaims: [
        {
          type: "place_anomaly",
          subject: "会回信的树洞",
          object: "会回应投入树洞的声音记录",
          limits: "只在孢雾浓度较高时出现，回应来源不保证真实",
        },
      ],
      ending: {
        type: "survived",
        summary: "灰档-07 带回一条关于腐林西缘树洞的可入档发现。",
      },
    },
  };
}
```

## Task 6: Frontend Agent Explorer UI

**Files:**
- Create: `tools/graph-react-app/src/agent/api.js`
- Create: `tools/graph-react-app/src/agent/AgentExplorer.jsx`
- Create: `tools/graph-react-app/src/agent/AgentExplorer.css`
- Modify: `tools/graph-react-app/src/App.jsx`

- [ ] **Step 1: Add API wrapper**

Create `tools/graph-react-app/src/agent/api.js`:

```js
const baseUrl = "http://127.0.0.1:8787";

export async function startRun({ explorerId, agentId, risk }) {
  const response = await fetch(`${baseUrl}/api/runs/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ explorerId, agentId, risk }),
  });
  if (!response.ok) throw new Error(`startRun failed: ${response.status}`);
  return response.json();
}

export async function submitRun(payload) {
  const response = await fetch(`${baseUrl}/api/runs/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`submitRun failed: ${response.status}`);
  return response.json();
}
```

- [ ] **Step 2: Add Agent Explorer component**

Create `tools/graph-react-app/src/agent/AgentExplorer.jsx`:

```jsx
import { useMemo, useState } from "react";
import { startRun, submitRun } from "./api.js";
import { createDemoRun } from "./demoRun.js";
import { loadOrCreateExplorer } from "./localIdentity.js";
import "./AgentExplorer.css";

export default function AgentExplorer({ onBack }) {
  const explorer = useMemo(() => loadOrCreateExplorer(), []);
  const [risk, setRisk] = useState("balanced");
  const [ticket, setTicket] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const agentId = "agent_grayfile_07";

  async function handleStart() {
    setError("");
    setResult(null);
    const nextTicket = await startRun({ explorerId: explorer.explorerId, agentId, risk });
    setTicket(nextTicket);
  }

  async function handleDemoSubmit() {
    setError("");
    const activeTicket = ticket || await startRun({ explorerId: explorer.explorerId, agentId, risk });
    setTicket(activeTicket);
    const demo = createDemoRun({ explorerId: explorer.explorerId, agentId, runTicket: activeTicket.runTicket });
    const nextResult = await submitRun(demo);
    setResult(nextResult);
  }

  return (
    <main className="agent-explorer">
      <header className="agent-explorer__header">
        <button onClick={onBack}>返回地图</button>
        <div>
          <b>黑曜纪元 Agent 探索</b>
          <span>API Key 不上传服务器。演示模式不可产生真实世界影响。</span>
        </div>
      </header>
      <section className="agent-explorer__contract">
        <h1>档案馆推荐委托</h1>
        <p>派出灰档-07 调查腐林边界的异常回声。首局不会永久死亡。</p>
        <div className="agent-explorer__risks">
          {[
            ["cautious", "谨慎"],
            ["balanced", "均衡"],
            ["bold", "冒险"],
          ].map(([value, label]) => (
            <button className={risk === value ? "active" : ""} key={value} onClick={() => setRisk(value)}>
              {label}
            </button>
          ))}
        </div>
        <button className="agent-explorer__primary" onClick={handleStart}>签发 runTicket</button>
        <button onClick={handleDemoSubmit}>运行演示并提交审档</button>
      </section>
      {ticket ? (
        <section className="agent-explorer__panel">
          <b>runTicket</b>
          <code>{ticket.runTicket}</code>
          <span>{ticket.status}</span>
        </section>
      ) : null}
      {result ? (
        <section className="agent-explorer__result">
          <h2>审档结果</h2>
          <div>评分：{result.adjudication.score}</div>
          <div>评级：{result.adjudication.rating}</div>
          <div>可入档发现：{result.adjudication.claimSlots}</div>
          <p>{result.adjudication.publicSummary}</p>
        </section>
      ) : null}
      {error ? <section className="agent-explorer__error">{error}</section> : null}
    </main>
  );
}
```

- [ ] **Step 3: Add minimal styles**

Create `tools/graph-react-app/src/agent/AgentExplorer.css`:

```css
.agent-explorer {
  min-height: 100vh;
  padding: 24px;
  color: #efe7d4;
  background: #08100e;
}

.agent-explorer__header,
.agent-explorer__contract,
.agent-explorer__panel,
.agent-explorer__result,
.agent-explorer__error {
  max-width: 760px;
  margin: 0 auto 16px;
}

.agent-explorer__header {
  display: flex;
  gap: 16px;
  align-items: center;
}

.agent-explorer__header div {
  display: grid;
  gap: 4px;
}

.agent-explorer__contract,
.agent-explorer__panel,
.agent-explorer__result,
.agent-explorer__error {
  border: 1px solid rgba(239, 231, 212, 0.18);
  border-radius: 8px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.agent-explorer button {
  min-height: 38px;
  border: 1px solid rgba(239, 231, 212, 0.28);
  border-radius: 6px;
  padding: 0 12px;
  color: #efe7d4;
  background: rgba(255, 255, 255, 0.06);
}

.agent-explorer button.active,
.agent-explorer__primary {
  border-color: #66d6d1;
  background: rgba(102, 214, 209, 0.18);
}

.agent-explorer__risks {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}

.agent-explorer code {
  display: block;
  margin: 8px 0;
  word-break: break-all;
}
```

- [ ] **Step 4: Wire into App**

Modify `tools/graph-react-app/src/App.jsx` minimally:

```jsx
import AgentExplorer from "./agent/AgentExplorer.jsx";
```

Inside `App`, add state:

```jsx
const [appMode, setAppMode] = useState("map");
if (appMode === "agent") return <AgentExplorer onBack={() => setAppMode("map")} />;
```

Add a button near the existing top controls or header:

```jsx
<button onClick={() => setAppMode("agent")}>Agent 探索</button>
```

- [ ] **Step 5: Verify app flow**

Run two terminals:

```bash
cd tools/graph-react-app
npm run agent:server
```

```bash
cd tools/graph-react-app
npm run dev
```

Open `http://127.0.0.1:5173`, click `Agent 探索`, click `运行演示并提交审档`.

Expected:

- runTicket appears.
- adjudication score appears.
- no API key field is required for demo mode.
- map can be reached via `返回地图`.

## Task 7: MVP Verification Checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-06-23-agent-explorer-shared-world-spec.md` only if the implementation reveals a spec mismatch.

- [ ] **Step 1: Run server tests**

Run:

```bash
cd tools/graph-react-app
npm run agent:test
```

Expected: all Node tests pass.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd tools/graph-react-app
npm run build
```

Expected: Vite build succeeds and existing world-map export still runs.

- [ ] **Step 3: Manual no-Key check**

In browser devtools Network tab during demo mode:

Expected:

- No request body contains `sk-`.
- `/api/runs/start` contains only explorer/agent/risk.
- `/api/runs/submit` contains runTicket and demo run payload.

- [ ] **Step 4: Manual idempotency check**

Submit the same `runTicket` and identical `run` payload twice with curl.

Expected:

- Same payload is idempotent or returns the existing adjudication.
- Different payload for the same submitted ticket is rejected.

## Cut Lines

Do not implement in this MVP:

- Real LLM provider adapters.
- Real semantic claim deduplication.
- Community dispute court.
- TTS or soundscapes.
- Blockchain/transparency log.
- Real multi-user reputation economy.
- Full map overlay for shared lore.

Those are valuable only after the local vertical slice proves the loop.
