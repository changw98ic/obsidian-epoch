import { epochPageSceneMediaForKey } from "./pageSceneAssets.ts";

export interface EpochPairingCredentialPageInfo {
  readonly explorerId: string;
  readonly agentId: string;
  readonly recoveryCode: string;
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly serverBase: string;
}

const hostNames = ["Claude Code", "Codex", "Cursor", "Hermes", "OpenClaw"] as const;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pairingPageShell(title: string, summary: string, body: string) {
  const heroMedia = epochPageSceneMediaForKey("install_portal");
  const heroImage = heroMedia
    ? `<img class="hero-image" src="${escapeHtml(heroMedia.imageUrl)}" alt="${escapeHtml(heroMedia.publicAlt)}" loading="eager">`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="黑曜纪元服务器配对工具。">
  <title>${escapeHtml(title)} - 黑曜纪元</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #080a09;
      --panel: #111614;
      --panel-strong: #171d1a;
      --line: rgba(169, 183, 174, .24);
      --text: #f2f5ef;
      --soft: #bcc8c0;
      --muted: #8b9790;
      --accent: #8fd8c8;
      --warn: #e4bc72;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
    }
    main {
      width: min(1040px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 24px 0 40px;
    }
    .hero {
      position: relative;
      min-height: 250px;
      overflow: hidden;
      display: grid;
      align-content: end;
      gap: 14px;
      padding: clamp(22px, 5vw, 42px);
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: 0;
      background: rgba(8, 10, 9, .62);
      pointer-events: none;
    }
    .hero > * {
      position: relative;
      z-index: 1;
    }
    .hero-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: .8;
    }
    .eyebrow {
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      max-width: 760px;
      font-size: clamp(32px, 7vw, 68px);
      line-height: 1;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    .summary {
      max-width: 680px;
      margin: 0;
      color: var(--soft);
      font-size: 16px;
      line-height: 1.65;
    }
    .content {
      display: grid;
      gap: 22px;
      margin-top: 26px;
    }
    section {
      min-width: 0;
      padding: 0 0 22px;
      border-bottom: 1px solid var(--line);
    }
    section:last-child { border-bottom: 0; }
    h2 {
      margin: 0 0 12px;
      font-size: 19px;
      letter-spacing: 0;
    }
    p {
      margin: 0;
      color: var(--soft);
      line-height: 1.65;
    }
    form {
      display: grid;
      gap: 12px;
      max-width: 560px;
    }
    label {
      display: grid;
      gap: 8px;
      color: var(--soft);
      font-weight: 700;
    }
    input {
      width: 100%;
      min-height: 46px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 12px;
      color: var(--text);
      background: var(--panel);
      font: inherit;
    }
    button {
      width: fit-content;
      min-height: 44px;
      border: 1px solid rgba(143, 216, 200, .56);
      border-radius: 6px;
      padding: 10px 16px;
      color: #07110f;
      background: var(--accent);
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    .split {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .field-list {
      display: grid;
      gap: 10px;
      margin: 0;
    }
    .field {
      min-width: 0;
      display: grid;
      gap: 5px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-strong);
    }
    .field dt {
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    .field dd {
      margin: 0;
      color: var(--text);
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .secret {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.55;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .notice {
      color: var(--warn);
      font-weight: 800;
    }
    .host-list {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .host-list li {
      min-width: 0;
      display: grid;
      gap: 6px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-strong);
    }
    .host-name {
      color: var(--text);
      font-weight: 800;
    }
    code {
      color: var(--soft);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    @media (max-width: 780px) {
      main { width: min(100vw - 20px, 1040px); }
      .split,
      .host-list {
        grid-template-columns: 1fr;
      }
      button { width: 100%; }
    }
  </style>
</head>
<body>
  <main>
    <header class="hero">
      ${heroImage}
      <div class="eyebrow">黑曜纪元 / 服务器配对</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="summary">${escapeHtml(summary)}</p>
    </header>
    <div class="content">
      ${body}
    </div>
  </main>
</body>
</html>`;
}

function field(label: string, value: string, className = "") {
  const valueClass = className ? ` class="${escapeHtml(className)}"` : "";
  return `<div class="field"><dt>${escapeHtml(label)}</dt><dd${valueClass}>${escapeHtml(value)}</dd></div>`;
}

export function renderEpochPairingPageHtml() {
  return pairingPageShell(
    "配对你的行动身份",
    "由服务器分配首世身份、寿命与 Explorer 凭证，再复制到你使用的宿主环境变量中。",
    `<section aria-labelledby="pairing-form-title">
      <h2 id="pairing-form-title">注册身份</h2>
      <form method="post" action="/epoch/pair/register" autocomplete="off">
        <p class="notice">身份名称、初始寿命与第一世经历由服务器规则签发，客户端不能自定义。</p>
        <button type="submit">由服务器签发身份</button>
      </form>
    </section>`,
  );
}

export function renderEpochPairingCredentialPageHtml(info: EpochPairingCredentialPageInfo) {
  const hostItems = hostNames.map((hostName) => `<li>
    <span class="host-name">${escapeHtml(hostName)}</span>
    <code>AGENT_WORLD_SERVER=${escapeHtml(info.serverBase)}</code>
    <code>AGENT_WORLD_MCP_TOKEN=${escapeHtml(info.accessToken)}</code>
  </li>`);

  return pairingPageShell(
    "配对凭证已签发",
    "此页面只用于安装时复制凭证；不要把 token 或恢复码放进普通聊天、截图或公开工单。",
    `<section aria-labelledby="identity-title">
      <h2 id="identity-title">身份</h2>
      <dl class="field-list split">
        ${field("Explorer ID", info.explorerId)}
        ${field("Agent ID", info.agentId)}
      </dl>
    </section>
    <section aria-labelledby="token-title">
      <h2 id="token-title">短期 MCP token</h2>
      <dl class="field-list">
        ${field("AGENT_WORLD_MCP_TOKEN", info.accessToken, "secret")}
        ${field("有效期", info.expiresAt)}
      </dl>
    </section>
    <section aria-labelledby="recovery-title">
      <h2 id="recovery-title">恢复码</h2>
      <p class="notice">恢复码仅显示一次。不要粘贴到普通聊天、公开频道、Issue、PR 或日志中。</p>
      <dl class="field-list">
        ${field("一次性恢复码", info.recoveryCode, "secret")}
      </dl>
    </section>
    <section aria-labelledby="hosts-title">
      <h2 id="hosts-title">五个宿主统一环境变量</h2>
      <p>五个宿主使用同一组变量名：<code>AGENT_WORLD_SERVER</code> 和 <code>AGENT_WORLD_MCP_TOKEN</code>。</p>
      <ul class="host-list">
        ${hostItems.join("")}
      </ul>
    </section>`,
  );
}
