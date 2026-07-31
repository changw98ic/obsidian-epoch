import assert from "node:assert/strict";
import test from "node:test";
import { renderEpochPairingPageHtml } from "../lib/pairingPageHtml.ts";

test("pairing page directs the installed Agent to create the first identity through MCP", () => {
  const html = renderEpochPairingPageHtml();

  assert.match(html, /obsidian_epoch\.register_explorer/);
  assert.match(html, /href="\/epoch\/install"/);
  assert.match(html, /网页不创建身份，也不显示凭证/);
  assert.doesNotMatch(html, /\/epoch\/pair\/register/);
  assert.doesNotMatch(html, /<button\b/);
  assert.doesNotMatch(html, /<input\b/);
});

test("pairing page has no executable web registration or script", () => {
  const html = renderEpochPairingPageHtml();

  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /AGENT_WORLD_MCP_TOKEN/);
  assert.doesNotMatch(html, /恢复码仅显示一次/);
});
