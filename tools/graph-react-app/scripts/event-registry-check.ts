/**
 * Event registry check — verifies every EPOCH_EVENT_TYPES entry has a
 * corresponding key in the PUBLIC_PAYLOAD_FIELDS whitelist inside
 * runtimePublicProjectionRules.ts.
 *
 * This prevents new event types from slipping through the default-deny
 * public-payload filter unnoticed.
 *
 * Exit 0 = all pass, exit 1 = missing entries.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_SERVER = process.env.EVENT_REGISTRY_CHECK_AGENT_SERVER ?? resolve(__dirname, "../../agent-server");

function readFile(relPath: string): string {
  return readFileSync(resolve(AGENT_SERVER, relPath), "utf-8");
}

// --- 1. Extract EPOCH_EVENT_TYPES from protocol.ts ---
const protocolSrc = readFile("lib/epoch/protocol.ts");

const eventTypesBlock = protocolSrc.match(
  /export\s+const\s+EPOCH_EVENT_TYPES\s*=\s*\[([\s\S]*?)\]\s*as\s*const\s*;/,
);
if (!eventTypesBlock) {
  console.error("ERROR: Could not find EPOCH_EVENT_TYPES in protocol.ts");
  process.exit(1);
}
const eventTypesSource = eventTypesBlock[1];
if (!eventTypesSource) {
  console.error("ERROR: EPOCH_EVENT_TYPES has no list body in protocol.ts");
  process.exit(1);
}

const eventTypes: string[] = [];
for (const m of eventTypesSource.matchAll(/"([a-z][a-z0-9_]*)"/g)) {
  const eventType = m[1];
  if (eventType) eventTypes.push(eventType);
}

if (eventTypes.length === 0) {
  console.error("ERROR: Extracted zero event types from protocol.ts");
  process.exit(1);
}

// --- 2. Extract PUBLIC_PAYLOAD_FIELDS keys from runtimePublicProjectionRules.ts ---
const rulesSrc = readFile("lib/epoch/runtimePublicProjectionRules.ts");

const fieldsBlock = rulesSrc.match(
  /const\s+PUBLIC_PAYLOAD_FIELDS\b[^=]*=\s*\{([\s\S]*?)\}\s*;/,
);
if (!fieldsBlock) {
  console.error(
    "ERROR: Could not find PUBLIC_PAYLOAD_FIELDS in runtimePublicProjectionRules.ts",
  );
  process.exit(1);
}
const fieldsSource = fieldsBlock[1];
if (!fieldsSource) {
  console.error("ERROR: PUBLIC_PAYLOAD_FIELDS has no object body in runtimePublicProjectionRules.ts");
  process.exit(1);
}

const publicFieldKeys = new Set<string>();
for (const m of fieldsSource.matchAll(/"([a-z][a-z0-9_]*)"\s*:/g)) {
  const fieldKey = m[1];
  if (fieldKey) publicFieldKeys.add(fieldKey);
}

// --- 3. Compare ---
const missing = eventTypes.filter((t) => !publicFieldKeys.has(t));

console.log(
  `event-registry-check: ${eventTypes.length} event types, ${publicFieldKeys.size} public-payload entries`,
);

if (missing.length > 0) {
  console.error(
    `FAIL: ${missing.length} event type(s) missing from PUBLIC_PAYLOAD_FIELDS:`,
  );
  for (const t of missing) {
    console.error(`  - ${t}`);
  }
  process.exit(1);
}

console.log("event-registry-check: ALL PASS — every event type has a public-payload entry.");
