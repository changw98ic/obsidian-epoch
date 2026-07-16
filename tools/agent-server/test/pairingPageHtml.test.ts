import assert from "node:assert/strict";
import test from "node:test";
import {
  renderEpochPairingCredentialPageHtml,
  renderEpochPairingPageHtml,
} from "../lib/pairingPageHtml.ts";

const credentialFixture = {
  explorerId: `explorer<&"'>`,
  agentId: `agent<&"'>`,
  recoveryCode: `recover<&"'>`,
  accessToken: `token<&"'>`,
  expiresAt: `2026-07-10T08:30:00.000Z<&"'>`,
  serverBase: `https://epoch.example.test/base?x=1&name=<bad>`,
};

function headHtml(html: string) {
  const match = html.match(/<head>([\s\S]*?)<\/head>/);
  assert.ok(match);
  return match[1] || "";
}

test("pairing form lets the server assign identity profile fields", () => {
  const html = renderEpochPairingPageHtml();

  assert.match(html, /<form method="post" action="\/epoch\/pair\/register" autocomplete="off">/);
  assert.doesNotMatch(html, /name="identityName"/);
  assert.doesNotMatch(html, /<input\b/);
  assert.match(html, /身份名称、初始寿命与第一世经历由服务器规则签发/);
});

test("pairing pages do not include inline or external script tags", () => {
  const formHtml = renderEpochPairingPageHtml();
  const credentialHtml = renderEpochPairingCredentialPageHtml(credentialFixture);

  assert.doesNotMatch(formHtml, /<script\b/i);
  assert.doesNotMatch(credentialHtml, /<script\b/i);
});

test("credential page strictly escapes dynamic values", () => {
  const html = renderEpochPairingCredentialPageHtml(credentialFixture);

  assert.doesNotMatch(html, /explorer<&"'>/);
  assert.doesNotMatch(html, /agent<&"'>/);
  assert.doesNotMatch(html, /recover<&"'>/);
  assert.doesNotMatch(html, /token<&"'>/);
  assert.match(html, /explorer&lt;&amp;&quot;&#39;&gt;/);
  assert.match(html, /agent&lt;&amp;&quot;&#39;&gt;/);
  assert.match(html, /recover&lt;&amp;&quot;&#39;&gt;/);
  assert.match(html, /token&lt;&amp;&quot;&#39;&gt;/);
  assert.match(html, /https:\/\/epoch\.example\.test\/base\?x=1&amp;name=&lt;bad&gt;/);
});

test("secrets are not emitted in title, meta, or URLs", () => {
  const secretInfo = {
    explorerId: "explorer-secret-scope",
    agentId: "agent-secret-scope",
    recoveryCode: "RECOVERY-SECRET-123",
    accessToken: "TOKEN-SECRET-456",
    expiresAt: "2026-07-10T08:30:00.000Z",
    serverBase: "https://epoch.example.test",
  };
  const html = renderEpochPairingCredentialPageHtml(secretInfo);
  const head = headHtml(html);
  const urlAttributes = [...html.matchAll(/\s(?:href|src|action)=["']([^"']+)["']/g)].map((match) => match[1] || "");

  assert.doesNotMatch(head, /RECOVERY-SECRET-123|TOKEN-SECRET-456/);
  assert.equal(urlAttributes.some((url) => url.includes(secretInfo.recoveryCode) || url.includes(secretInfo.accessToken)), false);
});

test("long tokens cannot force horizontal overflow", () => {
  const longToken = `mcp_${"a".repeat(512)}`;
  const html = renderEpochPairingCredentialPageHtml({
    explorerId: "explorer",
    agentId: "agent",
    recoveryCode: "recovery",
    accessToken: longToken,
    expiresAt: "2026-07-10T08:30:00.000Z",
    serverBase: "https://epoch.example.test",
  });

  assert.match(html, /overflow-wrap:\s*anywhere/);
  assert.match(html, /word-break:\s*break-word/);
  assert.match(html, new RegExp(longToken));
});

test("credential page explains one-time recovery code handling and unified host variables", () => {
  const html = renderEpochPairingCredentialPageHtml(credentialFixture);

  assert.match(html, /恢复码仅显示一次/);
  assert.match(html, /不要粘贴到普通聊天/);
  assert.equal((html.match(/AGENT_WORLD_SERVER/g) || []).length, 6);
  assert.equal((html.match(/AGENT_WORLD_MCP_TOKEN/g) || []).length, 7);
  for (const hostName of ["Claude Code", "Codex", "Cursor", "Hermes", "OpenClaw"]) {
    assert.match(html, new RegExp(hostName));
  }
});
