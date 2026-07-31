import { epochPageSceneMediaForKey } from "./pageSceneAssets.ts";

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
    .notice {
      color: var(--warn);
      font-weight: 800;
    }
    .action-link {
      display: inline-flex;
      margin-top: 14px;
      min-height: 44px;
      align-items: center;
      padding: 10px 16px;
      border: 1px solid rgba(143, 216, 200, .56);
      border-radius: 6px;
      color: #07110f;
      background: var(--accent);
      font-weight: 800;
      text-decoration: none;
    }
    @media (max-width: 780px) {
      main { width: min(100vw - 20px, 1040px); }
      .action-link { width: 100%; justify-content: center; }
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

export function renderEpochPairingPageHtml() {
  return pairingPageShell(
    "由 Agent 创建首个身份",
    "连接发布 MCP 代理后，Agent 会请求服务器签发首世身份并接管短期凭证。网页不创建身份，也不显示凭证。",
    `<section aria-labelledby="pairing-agent-title">
      <h2 id="pairing-agent-title">无需网页操作</h2>
      <p>安装发布包后，让 Agent 调用 <code>obsidian_epoch.register_explorer</code>。服务器决定身份名称、寿命和首世资料；代理保管短期访问凭证，不把凭证或恢复码回显到对话。</p>
      <p class="notice">不要在网页、普通聊天或截图中创建、复制或粘贴身份凭证。</p>
      <a class="action-link" href="/epoch/install">查看 MCP 安装方式</a>
    </section>`,
  );
}
