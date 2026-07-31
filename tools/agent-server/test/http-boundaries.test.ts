import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const httpServerPath = new URL("../lib/httpServer.ts", import.meta.url);
const identityRoutesPath = new URL("../lib/http/identityRoutes.ts", import.meta.url);
const assetRoutesPath = new URL("../lib/http/assetRoutes.ts", import.meta.url);
const mcpRoutesPath = new URL("../lib/http/mcpRoutes.ts", import.meta.url);
const agentProfileRoutesPath = new URL("../lib/http/agentProfileRoutes.ts", import.meta.url);
const installRoutesPath = new URL("../lib/http/installRoutes.ts", import.meta.url);
const worldRoutesPath = new URL("../lib/http/worldRoutes.ts", import.meta.url);
const auditRoutesPath = new URL("../lib/http/auditRoutes.ts", import.meta.url);
const operatorRoutesPath = new URL("../lib/http/operatorRoutes.ts", import.meta.url);
const economyRoutesPath = new URL("../lib/http/economyRoutes.ts", import.meta.url);
const seasonRoutesPath = new URL("../lib/http/seasonRoutes.ts", import.meta.url);
const hostedRoutesPath = new URL("../lib/http/hostedRoutes.ts", import.meta.url);
const narrativeRoutesPath = new URL("../lib/http/narrativeRoutes.ts", import.meta.url);
const encounterRoutesPath = new URL("../lib/http/encounterRoutes.ts", import.meta.url);
const societyRoutesPath = new URL("../lib/http/societyRoutes.ts", import.meta.url);
const gameplayRoutesPath = new URL("../lib/http/gameplayRoutes.ts", import.meta.url);
const legacyRoutesPath = new URL("../lib/http/legacyRoutes.ts", import.meta.url);

test("HTTP server delegates identity routes to a focused route module", () => {
  assert.ok(existsSync(identityRoutesPath), "identityRoutes.ts should own identity HTTP endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const identityRoutes = readFileSync(identityRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochIdentityRoutes/);
  assert.match(identityRoutes, /export async function handleEpochIdentityRoutes/);
  assert.match(identityRoutes, /\/api\/epoch\/identity\/issue/);
  assert.match(identityRoutes, /\/api\/epoch\/recovery\/rotate/);
  assert.match(identityRoutes, /\/api\/epoch\/identity\/archive/);
  assert.match(identityRoutes, /\/api\/epoch\/identity\/reincarnate/);
  assert.match(identityRoutes, /pathname\.startsWith\("\/api\/epoch\/identity\/"\)/);

  assert.doesNotMatch(httpServer, /pathname === "\/api\/epoch\/identity\/issue"/);
  assert.doesNotMatch(httpServer, /pathname === "\/api\/epoch\/recovery\/rotate"/);
  assert.doesNotMatch(httpServer, /pathname === "\/api\/epoch\/identity\/archive"/);
  assert.doesNotMatch(httpServer, /pathname === "\/api\/epoch\/identity\/reincarnate"/);
});

test("HTTP server delegates console and Epoch asset routes to a focused route module", () => {
  assert.ok(existsSync(assetRoutesPath), "assetRoutes.ts should own static asset HTTP endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const assetRoutes = readFileSync(assetRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochAssetRoutes/);
  assert.match(assetRoutes, /export async function handleEpochAssetRoutes/);
  assert.match(assetRoutes, /\/epoch\/web-play/);
  assert.match(assetRoutes, /\/epoch\/web-play\/assets\//);
  assert.match(assetRoutes, /legacy_console_path_removed/);
  assert.match(assetRoutes, /\/api\/epoch\/assets\/boss\//);
  assert.match(assetRoutes, /\/api\/epoch\/assets\/season\//);

  assert.doesNotMatch(httpServer, /pathname === "\/epoch\/console"/);
  assert.doesNotMatch(httpServer, /pathname\.startsWith\(EPOCH_CONSOLE_ASSET_PREFIX\)/);
  assert.doesNotMatch(httpServer, /pathname\.startsWith\("\/api\/epoch\/assets\/boss\/"\)/);
  assert.doesNotMatch(httpServer, /pathname\.startsWith\("\/api\/epoch\/assets\/season\/"\)/);
});

test("HTTP server delegates MCP routes to a focused route module", () => {
  assert.ok(existsSync(mcpRoutesPath), "mcpRoutes.ts should own MCP HTTP endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const mcpRoutes = readFileSync(mcpRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochMcpRoutes/);
  assert.match(mcpRoutes, /export async function handleEpochMcpRoutes/);
  assert.match(mcpRoutes, /\/mcp/);
  assert.match(mcpRoutes, /\/api\/epoch\/mcp/);
  assert.match(mcpRoutes, /\/api\/epoch\/mcp\/tools\/list/);
  assert.match(mcpRoutes, /\/api\/epoch\/mcp\/tools\/call/);

  assert.doesNotMatch(httpServer, /if \(pathname === "\/mcp"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/mcp\/tools\/list"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/mcp\/tools\/call"/);
});

test("HTTP server delegates agent profile and briefing routes to a focused route module", () => {
  assert.ok(existsSync(agentProfileRoutesPath), "agentProfileRoutes.ts should own agent profile briefing and personality endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const agentProfileRoutes = readFileSync(agentProfileRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochAgentProfileRoutes/);
  assert.match(agentProfileRoutes, /export async function handleEpochAgentProfileRoutes/);
  assert.match(agentProfileRoutes, /\/api\/epoch\/personality\/confirm/);
  assert.match(agentProfileRoutes, /\/api\/epoch\/agent-briefing/);
  assert.match(agentProfileRoutes, /\/api\/epoch\/agent-memory/);
  assert.match(agentProfileRoutes, /\/api\/epoch\/personal-migration-summary/);
  assert.match(agentProfileRoutes, /pathname\.startsWith\("\/api\/epoch\/explorer\/"\)/);

  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/personality\/confirm"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/agent-briefing"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/agent-memory"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/personal-migration-summary"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/api\/epoch\/explorer\/"\)/);
});

test("HTTP server delegates install and package routes to a focused route module", () => {
  assert.ok(existsSync(installRoutesPath), "installRoutes.ts should own install and package HTTP endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const installRoutes = readFileSync(installRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochInstallRoutes/);
  assert.match(installRoutes, /export async function handleEpochInstallRoutes/);
  assert.match(installRoutes, /\/epoch\/install/);
  assert.match(installRoutes, /\/api\/epoch\/install-manifest/);
  assert.match(installRoutes, /\/api\/epoch\/install-status/);
  assert.match(installRoutes, /\/api\/epoch\/host-config\//);
  assert.match(installRoutes, /\/api\/epoch\/package\//);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/epoch\/install"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/install-manifest"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/install-status"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/api\/epoch\/host-config\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === `\/api\/epoch\/package\/\$\{OBSIDIAN_EPOCH_PACKAGE_FILE\}`/);
});

test("HTTP server delegates public world routes to a focused route module", () => {
  assert.ok(existsSync(worldRoutesPath), "worldRoutes.ts should own public world HTTP endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const worldRoutes = readFileSync(worldRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochWorldRoutes/);
  assert.match(worldRoutes, /export async function handleEpochWorldRoutes/);
  assert.match(worldRoutes, /\/api\/epoch\/world-overview/);
  assert.match(worldRoutes, /\/api\/epoch\/world-clock/);
  assert.match(worldRoutes, /\/api\/epoch\/world-state/);
  assert.match(worldRoutes, /\/api\/epoch\/world-content/);
  assert.match(worldRoutes, /\/api\/epoch\/archive\//);
  assert.match(worldRoutes, /\/epoch\/world/);
  assert.match(worldRoutes, /\/epoch\/agent\//);
  assert.match(worldRoutes, /\/epoch\/hosted\//);
  assert.match(worldRoutes, /\/epoch\/explorer\//);
  assert.match(worldRoutes, /\/epoch\/region\//);
  assert.match(worldRoutes, /\/epoch\/npc\//);
  assert.match(worldRoutes, /\/epoch\/archive\//);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/world-overview"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/api\/epoch\/archive\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && \(pathname === "\/epoch\/world"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/epoch\/agent\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/epoch\/hosted\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/epoch\/explorer\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/epoch\/region\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/epoch\/npc\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/epoch\/archive\/"\)/);
});

test("HTTP server delegates audit and season audit routes to a focused route module", () => {
  assert.ok(existsSync(auditRoutesPath), "auditRoutes.ts should own audit and season audit HTTP endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const auditRoutes = readFileSync(auditRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochAuditRoutes/);
  assert.match(auditRoutes, /export async function handleEpochAuditRoutes/);
  assert.match(auditRoutes, /\/api\/epoch\/audit/);
  assert.match(auditRoutes, /\/api\/epoch\/audit\/risk-review/);
  assert.match(auditRoutes, /\/epoch\/audit/);
  assert.match(auditRoutes, /\/epoch\/season\//);
  assert.match(auditRoutes, /audit-export/);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/audit"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/api\/epoch\/audit\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/audit\/risk-review"/);
  assert.doesNotMatch(httpServer, /seasonAuditExportRequest\(request\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/epoch\/season\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && \(pathname === "\/epoch\/audit"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/epoch\/audit\/"\)/);
});

test("HTTP server delegates operator control-plane routes to a focused route module", () => {
  assert.ok(existsSync(operatorRoutesPath), "operatorRoutes.ts should own operator and abuse HTTP endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const operatorRoutes = readFileSync(operatorRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochOperatorRoutes/);
  assert.match(operatorRoutes, /export async function handleEpochOperatorRoutes/);
  assert.match(operatorRoutes, /\/api\/epoch\/moderation/);
  assert.match(operatorRoutes, /\/api\/epoch\/moderation\/resolve/);
  assert.match(operatorRoutes, /\/api\/epoch\/abuse\/status/);
  assert.match(operatorRoutes, /\/api\/epoch\/abuse\/profiles/);
  assert.match(operatorRoutes, /\/api\/epoch\/abuse\/release/);
  assert.match(operatorRoutes, /\/api\/epoch\/operator\/overview/);
  assert.match(operatorRoutes, /\/api\/epoch\/maintenance\/run/);
  assert.match(operatorRoutes, /\/api\/epoch\/world-clock\/advance/);
  assert.match(operatorRoutes, /\/api\/epoch\/world-content\/migrate/);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/moderation"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/moderation\/resolve"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/abuse\/status"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/abuse\/profiles"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/abuse\/release"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/operator\/overview"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/maintenance\/run"/);
});

test("HTTP server delegates economy routes to a focused route module", () => {
  assert.ok(existsSync(economyRoutesPath), "economyRoutes.ts should own inventory shop market and direct trade endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const economyRoutes = readFileSync(economyRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochEconomyRoutes/);
  assert.match(economyRoutes, /export async function handleEpochEconomyRoutes/);
  assert.match(economyRoutes, /\/api\/epoch\/inventory/);
  assert.match(economyRoutes, /\/api\/epoch\/shop/);
  assert.match(economyRoutes, /\/api\/epoch\/market/);
  assert.match(economyRoutes, /\/api\/epoch\/direct-trades/);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/inventory"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/shop"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/inventory\/create"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/inventory\/craft"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/shop\/purchase"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/inventory\/bind"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/market"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/direct-trades"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/market\/risk-restrictions\/release"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/market\/orders"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/market\/fill"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/market\/cancel"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/direct-trades\/create"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/direct-trades\/accept"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/direct-trades\/cancel"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/direct-trades\/expiry\/tick"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/market\/expiry\/tick"/);
});

test("HTTP server delegates season write routes to a focused route module", () => {
  assert.ok(existsSync(seasonRoutesPath), "seasonRoutes.ts should own season campaign API endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const seasonRoutes = readFileSync(seasonRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochSeasonRoutes/);
  assert.match(seasonRoutes, /export async function handleEpochSeasonRoutes/);
  assert.match(seasonRoutes, /\/api\/epoch\/seasons/);
  assert.match(seasonRoutes, /\/api\/epoch\/seasons\/seed/);
  assert.match(seasonRoutes, /\/api\/epoch\/seasons\/contribute/);
  assert.match(seasonRoutes, /\/api\/epoch\/seasons\/settle/);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/seasons"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/seasons\/seed"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/seasons\/contribute"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/seasons\/settle"/);
});

test("HTTP server delegates hosted bridge and attestation routes to a focused route module", () => {
  assert.ok(existsSync(hostedRoutesPath), "hostedRoutes.ts should own hosted web bridge and attestation endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const hostedRoutes = readFileSync(hostedRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochHostedRoutes/);
  assert.match(hostedRoutes, /export async function handleEpochHostedRoutes/);
  assert.match(hostedRoutes, /\/api\/epoch\/hosted\/sessions/);
  assert.match(hostedRoutes, /\/api\/epoch\/hosted\/watch/);
  assert.match(hostedRoutes, /\/api\/epoch\/hosted\/start/);
  assert.match(hostedRoutes, /\/api\/epoch\/hosted\/action/);
  assert.match(hostedRoutes, /\/api\/epoch\/hosted\/server-action/);
  assert.match(hostedRoutes, /\/api\/epoch\/hosted\/server-jobs/);
  assert.match(hostedRoutes, /\/api\/epoch\/hosted\/server-jobs\/run/);
  assert.match(hostedRoutes, /\/api\/epoch\/web-bridge\/turn/);
  assert.match(hostedRoutes, /\/api\/epoch\/web-bridge\/action/);
  assert.match(hostedRoutes, /\/api\/epoch\/attestation\/challenge/);
  assert.match(hostedRoutes, /\/api\/epoch\/attestation\/action/);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/hosted\/sessions"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/hosted\/watch"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/hosted\/start"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/hosted\/action"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/hosted\/server-action"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/hosted\/server-jobs"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/hosted\/server-jobs"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/hosted\/server-jobs\/run"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/web-bridge\/turn"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/web-bridge\/action"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/attestation\/challenge"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/attestation\/action"/);
});

test("HTTP server delegates narrative, confirmation, news, and lore routes to a focused route module", () => {
  assert.ok(existsSync(narrativeRoutesPath), "narrativeRoutes.ts should own narrative confirmation news and lore endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const narrativeRoutes = readFileSync(narrativeRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochNarrativeRoutes/);
  assert.match(narrativeRoutes, /export async function handleEpochNarrativeRoutes/);
  assert.match(narrativeRoutes, /\/api\/epoch\/messages/);
  assert.match(narrativeRoutes, /\/api\/epoch\/messages\/post/);
  assert.match(narrativeRoutes, /\/api\/epoch\/confirmations\/request/);
  assert.match(narrativeRoutes, /\/api\/epoch\/confirmations\/list/);
  assert.match(narrativeRoutes, /\/api\/epoch\/confirmations\/confirm/);
  assert.match(narrativeRoutes, /\/api\/epoch\/news\/generate/);
  assert.match(narrativeRoutes, /\/api\/epoch\/news\/claim-legend/);
  assert.match(narrativeRoutes, /\/api\/epoch\/lore\/contribution/);
  assert.match(narrativeRoutes, /\/api\/epoch\/lore\/adjudicate/);
  assert.match(narrativeRoutes, /\/api\/epoch\/events/);
  assert.match(narrativeRoutes, /\/api\/epoch\/lore\/contributions/);
  assert.match(narrativeRoutes, /\/api\/epoch\/lore\/targets/);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/messages"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/messages\/post"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/confirmations\/request"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/confirmations\/list"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/confirmations\/confirm"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/news\/generate"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/news\/claim-legend"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/lore\/contribution"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/lore\/adjudicate"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/events"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/lore\/contributions"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/lore\/targets"/);
});

test("HTTP server delegates encounter objective resource anomaly and bounty routes to a focused route module", () => {
  assert.ok(existsSync(encounterRoutesPath), "encounterRoutes.ts should own encounter objective resource anomaly and bounty endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const encounterRoutes = readFileSync(encounterRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochEncounterRoutes/);
  assert.match(encounterRoutes, /export async function handleEpochEncounterRoutes/);
  assert.match(encounterRoutes, /\/api\/epoch\/objectives/);
  assert.match(encounterRoutes, /\/api\/epoch\/objectives\/seed/);
  assert.match(encounterRoutes, /\/api\/epoch\/objectives\/contribute/);
  assert.match(encounterRoutes, /\/api\/epoch\/objectives\/settle/);
  assert.match(encounterRoutes, /\/api\/epoch\/resource-nodes/);
  assert.match(encounterRoutes, /\/api\/epoch\/resource-nodes\/spawn/);
  assert.match(encounterRoutes, /\/api\/epoch\/resource-nodes\/contest/);
  assert.match(encounterRoutes, /\/api\/epoch\/resource-nodes\/settle/);
  assert.match(encounterRoutes, /\/api\/epoch\/anomalies/);
  assert.match(encounterRoutes, /\/api\/epoch\/anomalies\/spawn/);
  assert.match(encounterRoutes, /\/api\/epoch\/anomalies\/contest/);
  assert.match(encounterRoutes, /\/api\/epoch\/anomalies\/resolve/);
  assert.match(encounterRoutes, /\/api\/epoch\/bounties/);
  assert.match(encounterRoutes, /\/api\/epoch\/bounties\/create/);
  assert.match(encounterRoutes, /\/api\/epoch\/bounties\/claim/);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/objectives"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/objectives\/seed"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/objectives\/contribute"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/objectives\/settle"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/resource-nodes"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/resource-nodes\/spawn"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/resource-nodes\/contest"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/resource-nodes\/settle"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/anomalies"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/anomalies\/spawn"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/anomalies\/contest"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/anomalies\/resolve"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/bounties"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/bounties\/create"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/bounties\/claim"/);
});

test("HTTP server delegates downtime NPC organization social and region info routes to a focused route module", () => {
  assert.ok(existsSync(societyRoutesPath), "societyRoutes.ts should own downtime NPC organization social and region info endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const societyRoutes = readFileSync(societyRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochSocietyRoutes/);
  assert.match(societyRoutes, /export async function handleEpochSocietyRoutes/);
  assert.match(societyRoutes, /\/api\/epoch\/downtime\/set/);
  assert.match(societyRoutes, /\/api\/epoch\/downtime\/claim/);
  assert.match(societyRoutes, /\/api\/epoch\/downtime\/tick/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/canonicalize/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/candidates\/submit/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/candidates\/review/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/lifecycle\/tick/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/relationships/);
  assert.match(societyRoutes, /\/api\/epoch\/agent-npc-bonds/);
  assert.match(societyRoutes, /\/api\/epoch\/agent-npc-bonds\/update/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/memories/);
  assert.match(societyRoutes, /\/api\/epoch\/households/);
  assert.match(societyRoutes, /\/api\/epoch\/organizations/);
  assert.match(societyRoutes, /\/api\/epoch\/organizations\/create/);
  assert.match(societyRoutes, /\/api\/epoch\/organizations\/membership/);
  assert.match(societyRoutes, /\/api\/epoch\/organizations\/upgrades\/purchase/);
  assert.match(societyRoutes, /\/api\/epoch\/organizations\/treasury\/contribute/);
  assert.match(societyRoutes, /\/api\/epoch\/organizations\/budgets\/propose/);
  assert.match(societyRoutes, /\/api\/epoch\/organizations\/budgets\/resolve/);
  assert.match(societyRoutes, /\/api\/epoch\/organization-politics/);
  assert.match(societyRoutes, /\/api\/epoch\/organization-politics\/tick/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/careers/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/locations/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/assets/);
  assert.match(societyRoutes, /\/api\/epoch\/npc\/health/);
  assert.match(societyRoutes, /\/api\/epoch\/social-hooks/);
  assert.match(societyRoutes, /pathname\.startsWith\("\/api\/epoch\/region\/"\)/);

  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/downtime\/set"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/downtime\/claim"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/downtime\/tick"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/npc\/canonicalize"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/npc\/candidates\/submit"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/npc\/candidates\/review"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/npc\/lifecycle\/tick"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/npc\/relationships"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/agent-npc-bonds"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/agent-npc-bonds\/update"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/npc\/memories"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/households"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/organizations"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/organizations\/create"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/organizations\/membership"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/organizations\/upgrades\/purchase"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/organizations\/treasury\/contribute"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/organizations\/budgets\/propose"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/organizations\/budgets\/resolve"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/organization-politics"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/organization-politics\/tick"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/npc\/careers"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/npc\/locations"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/npc\/assets"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/npc\/health"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/social-hooks"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname\.startsWith\("\/api\/epoch\/region\/"\)/);
});

test("HTTP server delegates party raid diplomacy relationship and turn routes to a focused route module", () => {
  assert.ok(existsSync(gameplayRoutesPath), "gameplayRoutes.ts should own party raid diplomacy relationship and turn endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const gameplayRoutes = readFileSync(gameplayRoutesPath, "utf8");

  assert.match(httpServer, /handleEpochGameplayRoutes/);
  assert.match(gameplayRoutes, /export async function handleEpochGameplayRoutes/);
  assert.match(gameplayRoutes, /\/api\/epoch\/party-runs/);
  assert.match(gameplayRoutes, /\/api\/epoch\/party-runs\/create/);
  assert.match(gameplayRoutes, /\/api\/epoch\/party-runs\/invite/);
  assert.match(gameplayRoutes, /\/api\/epoch\/party-runs\/join/);
  assert.match(gameplayRoutes, /\/api\/epoch\/party-runs\/request-join/);
  assert.match(gameplayRoutes, /\/api\/epoch\/party-runs\/resolve-join-request/);
  assert.match(gameplayRoutes, /\/api\/epoch\/party-runs\/settle/);
  assert.match(gameplayRoutes, /\/api\/epoch\/raids/);
  assert.match(gameplayRoutes, /\/api\/epoch\/raids\/resolve/);
  assert.match(gameplayRoutes, /\/api\/epoch\/region-control\/revolt/);
  assert.match(gameplayRoutes, /\/api\/epoch\/retaliations\/resolve/);
  assert.match(gameplayRoutes, /\/api\/epoch\/diplomacy/);
  assert.match(gameplayRoutes, /\/api\/epoch\/diplomacy\/propose/);
  assert.match(gameplayRoutes, /\/api\/epoch\/diplomacy\/respond/);
  assert.match(gameplayRoutes, /\/api\/epoch\/relationships/);
  assert.match(gameplayRoutes, /\/api\/epoch\/relationships\/update/);
  assert.match(gameplayRoutes, /\/api\/epoch\/turns\/create/);
  assert.match(gameplayRoutes, /\/api\/epoch\/turns\/resolve/);

  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/party-runs"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/party-runs\/create"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/party-runs\/invite"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/party-runs\/join"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/party-runs\/request-join"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/party-runs\/resolve-join-request"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/party-runs\/settle"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/raids"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/raids\/resolve"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/region-control\/revolt"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/retaliations\/resolve"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/diplomacy"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/diplomacy\/propose"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/diplomacy\/respond"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/epoch\/relationships"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/relationships\/update"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/turns\/create"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/epoch\/turns\/resolve"/);
});

test("HTTP server delegates legacy run context world community experience and transparency routes to a focused route module", () => {
  assert.ok(existsSync(legacyRoutesPath), "legacyRoutes.ts should own legacy run context world community experience and transparency endpoints");
  const httpServer = readFileSync(httpServerPath, "utf8");
  const legacyRoutes = readFileSync(legacyRoutesPath, "utf8");

  assert.match(httpServer, /handleLegacyRuntimeRoutes/);
  assert.match(legacyRoutes, /export async function handleLegacyRuntimeRoutes/);
  assert.match(legacyRoutes, /\/api\/runs\/start/);
  assert.match(legacyRoutes, /\/api\/runs\/heartbeat/);
  assert.match(legacyRoutes, /\/api\/runs\/submit/);
  assert.match(legacyRoutes, /\/api\/runs\/archive/);
  assert.match(legacyRoutes, /\/api\/context\/package/);
  assert.match(legacyRoutes, /\/api\/world\/public-context/);
  assert.match(legacyRoutes, /\/api\/context\/snapshots/);
  assert.match(legacyRoutes, /\/api\/lore\/public/);
  assert.match(legacyRoutes, /\/api\/progression\/state/);
  assert.match(legacyRoutes, /\/api\/progression\/check/);
  assert.match(legacyRoutes, /\/api\/factions\/public/);
  assert.match(legacyRoutes, /\/api\/factions\/propose/);
  assert.match(legacyRoutes, /\/api\/factions\/support/);
  assert.match(legacyRoutes, /\/api\/factions\/reference/);
  assert.match(legacyRoutes, /\/api\/feedback\/repair/);
  assert.match(legacyRoutes, /\/api\/feedback\/events/);
  assert.match(legacyRoutes, /\/api\/feedback\/digest/);
  assert.match(legacyRoutes, /\/api\/outbox/);
  assert.match(legacyRoutes, /\/api\/review-queue/);
  assert.match(legacyRoutes, /\/api\/outbox\/replay/);
  assert.match(legacyRoutes, /\/api\/world\/browser/);
  assert.match(legacyRoutes, /\/api\/world\/runs/);
  assert.match(legacyRoutes, /\/api\/world\/source-graph/);
  assert.match(legacyRoutes, /\/api\/world\/claims\//);
  assert.match(legacyRoutes, /\/api\/world\/conflicts\//);
  assert.match(legacyRoutes, /\/api\/world\/factions\//);
  assert.match(legacyRoutes, /\/api\/community\/reaction/);
  assert.match(legacyRoutes, /\/api\/community\/comment/);
  assert.match(legacyRoutes, /\/api\/community\/flag/);
  assert.match(legacyRoutes, /\/api\/community\/thread/);
  assert.match(legacyRoutes, /\/api\/community\/moderation/);
  assert.match(legacyRoutes, /\/api\/experience\/state/);
  assert.match(legacyRoutes, /\/api\/experience\/voice/);
  assert.match(legacyRoutes, /\/api\/experience\/sound-style/);
  assert.match(legacyRoutes, /\/api\/transparency\/verify/);
  assert.match(legacyRoutes, /\/api\/transparency\/export/);
  assert.match(legacyRoutes, /\/api\/transparency\/anchor/);

  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/runs\/start"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/runs\/heartbeat"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/runs\/submit"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/runs\/archive"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/context\/package"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/world\/public-context"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/world\/public-context"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/context\/snapshots"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/lore\/public"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url\.startsWith\("\/api\/progression\/state"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url\.startsWith\("\/api\/progression\/check"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/factions\/public"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/factions\/propose"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/factions\/support"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/factions\/reference"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/feedback\/repair"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/feedback\/events"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url\.startsWith\("\/api\/feedback\/digest"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/outbox"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && pathname === "\/api\/review-queue"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && pathname === "\/api\/outbox\/replay"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/world\/browser"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/world\/runs"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/world\/source-graph"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url\.startsWith\("\/api\/world\/claims\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url\.startsWith\("\/api\/world\/conflicts\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url\.startsWith\("\/api\/world\/factions\/"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/community\/reaction"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/community\/comment"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/community\/flag"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url\.startsWith\("\/api\/community\/thread"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/community\/moderation"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url\.startsWith\("\/api\/experience\/state"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/experience\/voice"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url\.startsWith\("\/api\/experience\/sound-style"\)/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/transparency\/verify"/);
  assert.doesNotMatch(httpServer, /if \(method === "GET" && url === "\/api\/transparency\/export"/);
  assert.doesNotMatch(httpServer, /if \(method === "POST" && url === "\/api\/transparency\/anchor"/);
});
