import { createHash } from "node:crypto";

export interface EpochMcpInstallConfig {
  readonly serverName: string;
  readonly transport: "streamable-http";
  readonly url: string;
  readonly protocolVersion: "2025-06-18";
  readonly headers: Readonly<Record<string, string>>;
}

export interface EpochInstallConfigSnippet {
  readonly label: string;
  readonly format: "json";
  readonly pathHint: string;
  readonly body: unknown;
}

export interface EpochHostInstallEntry {
  readonly host: string;
  readonly type: string;
  readonly mcp?: EpochMcpInstallConfig;
  readonly quickstart?: {
    readonly tool: string;
    readonly firstTurnPlaybook: string;
  };
  readonly bridge?: {
    readonly entryTool: string;
    readonly submitTool: string;
    readonly resultTool?: string;
    readonly playbook: string;
    readonly publicPages?: Readonly<Record<string, string>>;
  };
  readonly pluginManifestPath?: string;
  readonly skill?: {
    readonly name: string;
    readonly path: string;
    readonly invoke: string;
  };
  readonly notes?: readonly string[];
  readonly configSnippets?: readonly EpochInstallConfigSnippet[];
}

export interface EpochHostConfigFile {
  readonly path: string;
  readonly content: string;
}

export interface EpochHostConfigManifestEntry {
  readonly path: string;
  readonly url: string;
  readonly contentType: "application/json";
  readonly bytes: number;
  readonly sha256: string;
}

type MutableRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MutableRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mcpServerSettings(mcp: EpochMcpInstallConfig) {
  return {
    type: "http",
    url: mcp.url,
    headers: { ...mcp.headers },
  };
}

function codexMcpServerSettings(mcp: EpochMcpInstallConfig) {
  return {
    type: "http",
    url: mcp.url,
    bearer_token_env_var: "AGENT_WORLD_MCP_TOKEN",
  };
}

const webBridgePublicPages = {
  console: "/epoch/console",
  play: "/epoch/web-play",
  install: "/epoch/install",
  world: "/epoch/world",
  auditIndex: "/epoch/audit",
  audit: "/epoch/audit/{eventId}",
  hosted: "/epoch/hosted/{sessionId}",
  result: "/epoch/result/{pageId}",
} as const;

function hostConfigSlug(host: string) {
  return host.toLowerCase().replaceAll(" ", "-");
}

function mcpHostConfigPath(host: string) {
  return `obsidian-epoch/host-config/${hostConfigSlug(host)}.mcp.json`;
}

function hostConfigFileName(pathHint: string) {
  return pathHint.split("/").pop() || pathHint;
}

function mcpJsonSnippet(host: string, mcp: EpochMcpInstallConfig): EpochInstallConfigSnippet {
  const remoteSettings = mcpServerSettings(mcp);
  const body = host === "Codex"
    ? {
        mcpServers: {
          [mcp.serverName]: codexMcpServerSettings(mcp),
        },
      }
    : host === "Hermes"
    ? {
        mcp_servers: {
          [mcp.serverName]: {
            url: mcp.url,
            headers: { ...mcp.headers },
            enabled: true,
          },
        },
      }
    : host === "OpenClaw"
      ? {
          mcp: {
            servers: {
              [mcp.serverName]: {
                url: mcp.url,
                transport: mcp.transport,
                headers: { ...mcp.headers },
              },
            },
          },
        }
      : {
          mcpServers: {
            [mcp.serverName]: remoteSettings,
          },
        };
  return {
    label: `${host} MCP JSON`,
    format: "json",
    pathHint: mcpHostConfigPath(host),
    body,
  };
}

function codexPluginSnippet(): EpochInstallConfigSnippet {
  return {
    label: "Codex plugin manifest",
    format: "json",
    pathHint: "obsidian-epoch/host-config/codex-plugin.json",
    body: {
      name: "obsidian-epoch-agent-world",
      version: "0.1.0-alpha",
      description: "Server-authoritative Obsidian Epoch MCP and Skill package for coding-agent hosts.",
      author: {
        name: "Obsidian Epoch",
      },
      skills: "./skills/",
      mcpServers: "./.mcp.json",
      interface: {
        displayName: "黑曜纪元",
        shortDescription: "服务器权威的 Agent 奇幻世界",
        longDescription: "让 Codex 通过服务器签发的身份和行动选项进入持续演化的多人奇幻世界。",
        developerName: "Obsidian Epoch",
        category: "Developer Tools",
        capabilities: ["Interactive", "Write"],
        defaultPrompt: [
          "签发我的身份并开始第一回合。",
          "查看我的托管进度和区域新闻。",
          "继续一次服务器权威行动。",
        ],
        brandColor: "#31B7A6",
      },
    },
  };
}

function browserBridgeSequenceSnippet(): EpochInstallConfigSnippet {
  return {
    label: "Browser bridge sequence",
    format: "json",
    pathHint: "obsidian-epoch/host-config/web-llm-bridge-sequence.json",
    body: {
      steps: [
        {
          tool: "obsidian_epoch.web_bridge_turn",
          purpose: "Issue a visible-context turn package that a browser-only model can read.",
        },
        {
          tool: "obsidian_epoch.submit_web_bridge_action",
          purpose: "Submit only the server-issued actionOptionId and browser model rationale.",
        },
        {
          tool: "obsidian_epoch.create_result_page",
          purpose: "Publish the server-settled bridge result after obsidian_epoch.result_page returns a publish token.",
        },
      ],
      publicPages: webBridgePublicPages,
    },
  };
}

export function epochHostInstallEntries(serverBase = "http://127.0.0.1:8787"): EpochHostInstallEntry[] {
  const baseMcp: EpochMcpInstallConfig = {
    serverName: "obsidian-epoch-agent-world",
    transport: "streamable-http",
    url: `${serverBase.replace(/\/+$/, "")}/mcp`,
    protocolVersion: "2025-06-18",
    headers: {
      Authorization: "Bearer ${AGENT_WORLD_MCP_TOKEN}",
    },
  };
  const genericSkill = {
    name: "obsidian-epoch",
    path: "obsidian-epoch/SKILL.md",
    invoke: "Use the Obsidian Epoch skill instructions with the MCP tools.",
  };
  const genericQuickstart = {
    tool: "obsidian_epoch.quickstart",
    firstTurnPlaybook: "obsidian-epoch/references/one-turn-playbook.md",
  };
  return [
    {
      host: "Claude Code",
      type: "mcp",
      mcp: baseMcp,
      quickstart: genericQuickstart,
      skill: {
        ...genericSkill,
        invoke: "$obsidian-epoch",
      },
      notes: [
        "Connect Claude Code directly to the remote Streamable HTTP MCP endpoint.",
        "The local MCP server is a client; server responses remain canonical.",
      ],
      configSnippets: [mcpJsonSnippet("Claude Code", baseMcp)],
    },
    {
      host: "Codex",
      type: "codex-plugin",
      mcp: baseMcp,
      quickstart: genericQuickstart,
      pluginManifestPath: ".codex-plugin/plugin.json",
      skill: {
        ...genericSkill,
        invoke: "$obsidian-epoch",
      },
      notes: [
        "Install this package as a Codex plugin or copy the skill folder into the Codex skills directory.",
        "The package manifest registers the remote HTTP MCP server without a local working-directory dependency.",
      ],
      configSnippets: [
        mcpJsonSnippet("Codex", baseMcp),
        codexPluginSnippet(),
      ],
    },
    {
      host: "Cursor",
      type: "mcp",
      mcp: baseMcp,
      quickstart: genericQuickstart,
      skill: genericSkill,
      notes: [
        "Add the remote HTTP MCP JSON snippet to Cursor's MCP server settings.",
        "Keep gameplay state on the public server, not in Cursor prompts.",
      ],
      configSnippets: [mcpJsonSnippet("Cursor", baseMcp)],
    },
    {
      host: "Hermes",
      type: "mcp",
      mcp: baseMcp,
      quickstart: genericQuickstart,
      skill: genericSkill,
      notes: [
        "Merge the mcp_servers JSON object into Hermes config.yaml; JSON is valid YAML 1.2 syntax.",
        "Treat Hermes as an untrusted client unless a trusted runner is configured.",
      ],
      configSnippets: [mcpJsonSnippet("Hermes", baseMcp)],
    },
    {
      host: "OpenClaw",
      type: "mcp",
      mcp: baseMcp,
      quickstart: genericQuickstart,
      skill: genericSkill,
      notes: [
        "Merge the mcp.servers object into OpenClaw's configuration and use Streamable HTTP.",
        "Do not grant canonical rewards from local OpenClaw text; wait for server events.",
      ],
      configSnippets: [mcpJsonSnippet("OpenClaw", baseMcp)],
    },
    {
      host: "Web LLM bridge",
      type: "web-bridge",
      bridge: {
        entryTool: "obsidian_epoch.web_bridge_turn",
        submitTool: "obsidian_epoch.submit_web_bridge_action",
        resultTool: "obsidian_epoch.create_result_page",
        playbook: "obsidian-epoch/references/web-llm-bridge-playbook.md",
        publicPages: webBridgePublicPages,
      },
      skill: {
        ...genericSkill,
        invoke: "Use references/web-llm-bridge-playbook.md to hand a single safe turn to a browser-only model.",
      },
      notes: [
        "Browser-only model sessions cannot install MCP, so an installed host or web console must generate and submit the bridge turn.",
        "The browser model sees only visible context and server-issued actionOptionId values; prose never becomes canonical settlement.",
      ],
      configSnippets: [browserBridgeSequenceSnippet()],
    },
  ];
}

export function epochHostConfigFiles(serverBase = "http://127.0.0.1:8787"): EpochHostConfigFile[] {
  const files = new Map<string, string>();
  for (const entry of epochHostInstallEntries(serverBase)) {
    for (const snippet of entry.configSnippets || []) {
      if (snippet.format !== "json" || !snippet.pathHint.startsWith("obsidian-epoch/host-config/")) continue;
      files.set(snippet.pathHint, `${JSON.stringify(snippet.body, null, 2)}\n`);
    }
  }
  return [...files].map(([path, content]) => ({ path, content }));
}

export function epochHostConfigManifestEntries(serverBase = "http://127.0.0.1:8787"): EpochHostConfigManifestEntry[] {
  return epochHostConfigFiles(serverBase).map((file) => {
    const content = Buffer.from(file.content, "utf8");
    return {
      path: file.path,
      url: `/api/epoch/host-config/${encodeURIComponent(hostConfigFileName(file.path))}`,
      contentType: "application/json",
      bytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  });
}

export function updateAgentWorldServerBaseInValue(value: unknown, serverBase: string): void {
  if (Array.isArray(value)) {
    for (const item of value) updateAgentWorldServerBaseInValue(item, serverBase);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (key === "AGENT_WORLD_SERVER") {
      value[key] = serverBase;
      continue;
    }
    if (key === "url" && typeof nested === "string" && /\/mcp\/?$/.test(nested)) {
      value[key] = `${serverBase.replace(/\/+$/, "")}/mcp`;
      continue;
    }
    updateAgentWorldServerBaseInValue(nested, serverBase);
  }
}

export function updateAgentWorldServerBaseInHostInstallEntry(entry: unknown, serverBase: string): void {
  if (!isRecord(entry)) return;
  if (isRecord(entry.mcp)) {
    entry.mcp.transport = "streamable-http";
    entry.mcp.url = `${serverBase.replace(/\/+$/, "")}/mcp`;
    entry.mcp.protocolVersion = "2025-06-18";
  }
  updateAgentWorldServerBaseInValue(entry.configSnippets, serverBase);
}
