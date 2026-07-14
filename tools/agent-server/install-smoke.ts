import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import readline from "node:readline";
import { gunzipSync } from "node:zlib";
import { createSequentialEpochIdFactory } from "./lib/epoch/protocol.ts";
import { createAgentHttpServer } from "./lib/httpServer.ts";
import { MCP_PROTOCOL_VERSION, createAgentWorldRuntime } from "./lib/mcpTools.ts";
import {
  OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE,
  OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
  verifyObsidianEpochPackageIntegrity,
  type PackageIntegrityVerification,
} from "./lib/packageArchive.ts";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): AnyRecord {
  return isRecord(value) ? value : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function htmlEscapedText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlIncludesUrl(html: string, urlPath: string) {
  return html.includes(urlPath) || html.includes(htmlEscapedText(urlPath));
}

function requiredPublishToken(value: unknown, errorCode: string) {
  const publishToken = optionalString(value);
  if (!publishToken) throw new Error(errorCode);
  return publishToken;
}

interface JsonRpcClient {
  readonly child: ChildProcessWithoutNullStreams;
  request(method: string, params?: AnyRecord): Promise<AnyRecord>;
  notify(method: string, params?: AnyRecord): void;
  callTool(name: string, args?: AnyRecord): Promise<AnyRecord>;
  close(): Promise<void>;
}

interface InstallSmokeOptions {
  readonly seed?: string;
  readonly serverBase?: string;
  readonly mcpToken?: string;
  readonly production?: boolean;
  readonly requireOperatorSigning?: boolean;
  readonly expectedReleaseKeyId?: string;
  readonly requireExternalConsoleMedia?: boolean;
  readonly expectedConsoleMediaBaseUrl?: string;
}

interface PackageEntry {
  readonly name: string;
  readonly content: Buffer;
}

interface StreamableMcpSmokeResult {
  readonly streamableMcpVerified: true;
  readonly streamableMcpEndpoint: string;
  readonly streamableMcpProtocolVersion: string;
  readonly streamableMcpServerName: string;
  readonly streamableMcpInitializedStatus: number;
  readonly streamableMcpGetStatus: number;
  readonly streamableMcpToolCount: number;
  readonly streamableMcpWorldOverviewListed: true;
  readonly streamableMcpQuickstartServerBase: string;
}

interface ConsoleExternalMediaSmokeResult {
  readonly consoleExternalMediaVerified: boolean;
  readonly consoleExternalMediaRequired: boolean;
  readonly consoleExternalMediaBaseUrl: string | null;
  readonly consoleExternalMediaUrl: string | null;
  readonly consoleExternalMediaStatus: number | null;
  readonly consoleExternalMediaContentType: string | null;
  readonly consoleExternalMediaContentLength: number | null;
  readonly consoleExternalMediaBytesRead: number | null;
}

const CONSOLE_SMOKE_ASSET_PATH = "/epoch/console/assets/media/14a0091da9_%E5%AD%A2%E9%9B%BE%E5%B7%A1%E7%8C%8E%E8%80%85_%E6%A1%A3%E6%A1%88%E5%8D%A1.png";
const CONSOLE_SMOKE_ASSET_FILE = CONSOLE_SMOKE_ASSET_PATH.split("/").at(-1) || "";
const CONSOLE_EXTERNAL_MEDIA_BASE_URL_ENV = "AGENT_INSTALL_SMOKE_CONSOLE_MEDIA_BASE_URL";
const CONSOLE_EXTERNAL_MEDIA_REQUIRED_ENV = "AGENT_INSTALL_SMOKE_REQUIRE_EXTERNAL_CONSOLE_MEDIA";
const CONSOLE_RUNTIME_MEDIA_BASE_URL_ENV = "AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL";
const CONSOLE_EXTERNAL_MEDIA_TIMEOUT_MS = 5_000;
const CONSOLE_EXTERNAL_MEDIA_PROBE_BYTES = 1_024;
const CONSOLE_EXTERNAL_MEDIA_MAX_CONTENT_LENGTH = 50 * 1_024 * 1_024;
const MCP_STDIO_REQUEST_TIMEOUT_MS = 30_000;
const REQUIRED_MCP_HOST_CONFIGS = [
  ["Claude Code", "obsidian-epoch/host-config/claude-code.mcp.json"],
  ["Codex", "obsidian-epoch/host-config/codex.mcp.json"],
  ["Cursor", "obsidian-epoch/host-config/cursor.mcp.json"],
  ["Hermes", "obsidian-epoch/host-config/hermes.mcp.json"],
  ["OpenClaw", "obsidian-epoch/host-config/openclaw.mcp.json"],
] as const;
const HOST_INSTALL_MCP_SERVER_NAME = "obsidian-epoch-agent-world";
const HOST_INSTALL_MCP_COMMAND = "node";
const HOST_INSTALL_MCP_ARGS = ["obsidian-epoch/bin/mcp-proxy.ts"] as const;
const HOST_INSTALL_QUICKSTART_TOOL = "obsidian_epoch.quickstart";
const HOST_INSTALL_FIRST_TURN_PLAYBOOK = "obsidian-epoch/references/one-turn-playbook.md";
const INSTALL_SMOKE_COMMAND = "npm run agent:install-smoke -- --json";
const REMOTE_INSTALL_SMOKE_COMMAND = "npm run agent:install-smoke -- --server <serverBase> --json";
const RELEASE_REHEARSAL_COMMAND = "npm run agent:release-rehearsal -- --server <serverBase> --operator-key <operatorKey> --json";
const PRODUCTION_RELEASE_REHEARSAL_COMMAND = "npm run agent:release-rehearsal -- --server <publicHttpsOrigin> --operator-key <operatorKey> --expected-release-key-id <releaseKeyId> --production --json";

function parseServerArg(args: readonly string[]) {
  const inline = args.find((arg) => arg.startsWith("--server="));
  if (inline) return inline.slice("--server=".length);
  const index = args.indexOf("--server");
  if (index >= 0) return args[index + 1];
  return undefined;
}

function hasFlagArg(args: readonly string[], name: string) {
  return args.includes(name);
}

function parseValueArg(args: readonly string[], name: string) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return undefined;
}

function truthyEnv(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function normalizeServerBase(value: string) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("install_smoke_server_must_be_http_or_https");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function normalizedExpectedReleaseKeyId(value: string | undefined) {
  const keyId = String(value || "").trim().toLowerCase();
  if (!keyId) return undefined;
  if (!/^[a-f0-9]{64}$/.test(keyId)) throw new Error("install_smoke_expected_release_key_id_invalid");
  return keyId;
}

function normalizedMcpToken(value: string | undefined) {
  const token = String(value || "").trim();
  return token || undefined;
}

function authorizationHeaders(mcpToken: string | undefined): Record<string, string> {
  return mcpToken ? { Authorization: `Bearer ${mcpToken}` } : {};
}

function isPrivateIpv4(hostname: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
  if (!match) return false;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (first === 10 || first === 127 || first === 0) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return first === 192 && second === 168;
}

function isPublicHttpsServerBase(serverBase: string) {
  const parsed = new URL(serverBase);
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:") return false;
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
  if (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80")) return false;
  return !isPrivateIpv4(hostname);
}

function mcpSettingsFromSnippetBody(body: unknown) {
  const snippet = recordValue(body);
  const objectServers = recordValue(snippet.mcpServers);
  const objectServer = objectServers[HOST_INSTALL_MCP_SERVER_NAME];
  if (isRecord(objectServer)) return objectServer;

  const hermesServer = recordValue(snippet.mcp_servers)[HOST_INSTALL_MCP_SERVER_NAME];
  if (isRecord(hermesServer)) return hermesServer;

  const openClawServer = recordValue(recordValue(snippet.mcp).servers)[HOST_INSTALL_MCP_SERVER_NAME];
  return recordValue(openClawServer);
}

function verifyHostMcpEntry(settings: unknown, serverBase: string) {
  const mcp = recordValue(settings);
  return mcp.serverName === HOST_INSTALL_MCP_SERVER_NAME
    && mcp.transport === "streamable-http"
    && mcp.url === `${serverBase}/mcp`
    && mcp.protocolVersion === MCP_PROTOCOL_VERSION
    && recordValue(mcp.headers).Authorization === "Bearer ${AGENT_WORLD_MCP_TOKEN}";
}

function verifyHostMcpSettings(host: string, settings: unknown, serverBase: string) {
  const mcp = recordValue(settings);
  if (mcp.url !== `${serverBase}/mcp`) return false;
  if (host === "Codex") {
    return mcp.type === "http" && mcp.bearer_token_env_var === "AGENT_WORLD_MCP_TOKEN";
  }
  if (recordValue(mcp.headers).Authorization !== "Bearer ${AGENT_WORLD_MCP_TOKEN}") return false;
  if (host === "Hermes") return mcp.enabled === true;
  if (host === "OpenClaw") return mcp.transport === "streamable-http";
  return mcp.type === "http";
}

function verifyHostInstallMatrix(
  serverBase: string,
  manifest: AnyRecord,
  snippets: ReadonlyMap<string, unknown>,
  downloadedConfigPaths: ReadonlySet<string>,
) {
  const hostInstall = Array.isArray(manifest.hostInstall) ? manifest.hostInstall : [];
  const verifiedHosts: string[] = [];
  const verifiedConfigPaths: string[] = [];

  for (const [host, configPath] of REQUIRED_MCP_HOST_CONFIGS) {
    const entry = hostInstall.find((item) => isRecord(item) && item.host === host);
    if (!isRecord(entry)) throw new Error("install_smoke_host_install_matrix_missing");
    const quickstart = recordValue(entry.quickstart);
    if (
      quickstart.tool !== HOST_INSTALL_QUICKSTART_TOOL
      || quickstart.firstTurnPlaybook !== HOST_INSTALL_FIRST_TURN_PLAYBOOK
      || !verifyHostMcpEntry(entry.mcp, serverBase)
      || !downloadedConfigPaths.has(configPath)
      || !snippets.has(configPath)
    ) {
      throw new Error("install_smoke_host_install_matrix_invalid");
    }

    const configSettings = mcpSettingsFromSnippetBody(snippets.get(configPath));
    if (!verifyHostMcpSettings(host, configSettings, serverBase)) {
      throw new Error("install_smoke_host_install_matrix_config_invalid");
    }

    for (const snippet of Array.isArray(entry.configSnippets) ? entry.configSnippets : []) {
      const pathHint = String(recordValue(snippet).pathHint || "");
      if (!pathHint.endsWith(".json") || !snippets.has(pathHint)) continue;
      const body = snippets.get(pathHint);
      const settings = mcpSettingsFromSnippetBody(body);
      if (Object.keys(settings).length > 0 && !verifyHostMcpSettings(host, settings, serverBase)) {
        throw new Error("install_smoke_host_install_matrix_snippet_invalid");
      }
    }

    verifiedHosts.push(host);
    verifiedConfigPaths.push(configPath);
  }

  return {
    hostInstallMatrixVerified: true,
    hostInstallMatrixHosts: verifiedHosts,
    hostInstallMatrixConfigPaths: verifiedConfigPaths,
    hostInstallMatrixMcpCommand: `${HOST_INSTALL_MCP_COMMAND} ${HOST_INSTALL_MCP_ARGS.join(" ")}`,
    hostInstallMatrixServerEnv: "AGENT_WORLD_SERVER",
    hostInstallMatrixQuickstartTool: HOST_INSTALL_QUICKSTART_TOOL,
    hostInstallMatrixFirstTurnPlaybook: HOST_INSTALL_FIRST_TURN_PLAYBOOK,
  };
}

function contentPayload(response: AnyRecord) {
  const error = recordValue(response.error);
  if (response.error) throw new Error(optionalString(error.message) || "mcp_error");
  const result = recordValue(response.result);
  const content = Array.isArray(result.content) ? result.content : [];
  const firstContent = recordValue(content[0]);
  const text = firstContent.text;
  if (typeof text !== "string") throw new Error("mcp_text_payload_missing");
  return JSON.parse(text);
}

function packageEntries(archive: Buffer): PackageEntry[] {
  const raw = gunzipSync(archive);
  const entries: PackageEntry[] = [];
  let offset = 0;
  while (offset + 512 <= raw.length) {
    const header = raw.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    if (!name) break;
    if (name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) {
      throw new Error("install_smoke_package_path_invalid");
    }
    const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeText || "0", 8);
    const contentStart = offset + 512;
    entries.push({ name, content: raw.subarray(contentStart, contentStart + size) });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

async function extractPackageArchive(archive: Buffer, releasePublicKey: string) {
  const root = await mkdtemp(join(tmpdir(), "obsidian-epoch-install-smoke-"));
  const entries = packageEntries(archive);
  const names = new Set(entries.map((entry) => entry.name));
  if (
    !names.has("package.json")
    || !names.has(".codex-plugin/plugin.json")
    || !names.has(".mcp.json")
    || !names.has("obsidian-epoch/bin/mcp-proxy.ts")
  ) {
    throw new Error("install_smoke_package_proxy_missing");
  }
  const integrity = verifyObsidianEpochPackageIntegrity(entries, { publicKey: releasePublicKey });
  if (!integrity.verified || integrity.fileCount < 1) {
    throw new Error("install_smoke_package_file_integrity_failed");
  }
  for (const entry of entries) {
    const target = join(root, entry.name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, entry.content);
  }
  return { root, integrity };
}

function createJsonRpcClient(serverBase: string, packageRoot: string, mcpToken: string | undefined): JsonRpcClient {
  const child = spawn(process.execPath, ["obsidian-epoch/bin/mcp-proxy.ts"], {
    cwd: packageRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      AGENT_WORLD_SERVER: serverBase,
      ...(mcpToken ? { AGENT_WORLD_MCP_TOKEN: mcpToken } : {}),
    },
  });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const stderrChunks: Buffer[] = [];
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
  const childOutput = () => Buffer.concat(stderrChunks).toString("utf8").trim();
  let nextId = 1;

  async function request(method: string, params?: AnyRecord) {
    const id = nextId++;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`install_smoke_mcp_exited:${method}:${child.exitCode ?? ""}:${child.signalCode ?? ""}:${childOutput()}`);
    }
    const line = await new Promise<string>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        lines.off("line", onLine);
        child.off("exit", onExit);
      };
      const onLine = (value: string) => {
        cleanup();
        resolve(value);
      };
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        cleanup();
        reject(new Error(`install_smoke_mcp_exited:${method}:${code ?? ""}:${signal ?? ""}:${childOutput()}`));
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`install_smoke_mcp_timeout:${method}:${childOutput()}`));
      }, MCP_STDIO_REQUEST_TIMEOUT_MS);
      lines.once("line", onLine);
      child.once("exit", onExit);
      try {
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
    return JSON.parse(line);
  }

  return {
    child,
    request,
    notify(method: string, params?: AnyRecord) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, ...(params ? { params } : {}) })}\n`);
    },
    async callTool(name: string, args: AnyRecord = {}) {
      return request("tools/call", { name, arguments: args });
    },
    async close() {
      lines.close();
      child.stdin.destroy();
      if (!child.killed) child.kill();
      await Promise.race([
        once(child, "exit"),
        new Promise((resolve) => setTimeout(resolve, 1_000)),
      ]);
    },
  };
}

async function getStatus(baseUrl: string, path: string, headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  await response.arrayBuffer();
  return response.status;
}

async function getTextWithStatus(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    text: await response.text(),
  };
}

async function getJsonWithStatus(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json();
  return { status: response.status, body };
}

async function registerSmokeIdentity(serverBase: string, idempotencyKey: string) {
  const response = await fetch(`${serverBase}/api/epoch/pairing/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey }),
  });
  const body = recordValue(await response.json());
  const explorerId = optionalString(body.explorerId);
  const agentId = optionalString(body.agentId);
  const recoveryCode = optionalString(body.recoveryCode);
  if (![200, 201].includes(response.status) || !explorerId || !agentId || !recoveryCode) {
    throw new Error(`install_smoke_pairing_failed_${response.status}`);
  }
  return { explorerId, agentId, recoveryCode };
}

function normalizedConsoleExternalMediaBaseUrl(value: string | undefined) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("install_smoke_console_external_media_base_invalid");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("install_smoke_console_external_media_base_invalid");
  }
  return url.toString().replace(/\/+$/, "");
}

function consoleExternalMediaBaseFromEnv() {
  return process.env[CONSOLE_EXTERNAL_MEDIA_BASE_URL_ENV]
    || process.env[CONSOLE_RUNTIME_MEDIA_BASE_URL_ENV];
}

function consoleSmokeAssetUrlFromBase(baseUrl: string) {
  return new URL(CONSOLE_SMOKE_ASSET_FILE, `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function urlIsUnderBase(url: URL, baseUrl: string) {
  return url.toString().startsWith(`${baseUrl.replace(/\/+$/, "")}/`);
}

function externalConsoleSmokeAssetUrls(html: string, serverBase: string) {
  const serverOrigin = new URL(serverBase).origin;
  const urls = new Set<string>();
  const candidates = html.match(/https?:\/\/[^"' <>)\\]+/g) || [];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.origin === serverOrigin) continue;
      if (url.pathname.endsWith(`/${CONSOLE_SMOKE_ASSET_FILE}`)) urls.add(url.toString());
    } catch {
      continue;
    }
  }
  return [...urls];
}

function assertProductionSafeConsoleExternalMediaUrl(url: URL) {
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.search
    || url.hash
    || !isPublicHttpsServerBase(url.origin)
  ) {
    throw new Error("install_smoke_console_external_media_url_unsafe");
  }
}

async function readConsoleExternalMediaProbeBytes(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return 0;
  let bytesRead = 0;
  try {
    while (bytesRead < CONSOLE_EXTERNAL_MEDIA_PROBE_BYTES) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > 0) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return bytesRead;
}

async function fetchConsoleExternalMediaProbe(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONSOLE_EXTERNAL_MEDIA_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { range: `bytes=0-${CONSOLE_EXTERNAL_MEDIA_PROBE_BYTES - 1}` },
      redirect: "manual",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const contentLengthText = response.headers.get("content-length");
    const contentLength = contentLengthText ? Number(contentLengthText) : null;
    if (response.status >= 300 && response.status < 400) {
      throw new Error("install_smoke_console_external_media_redirect");
    }
    if (![200, 206].includes(response.status)) {
      throw new Error("install_smoke_console_external_media_failed");
    }
    if (contentLength !== null && (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > CONSOLE_EXTERNAL_MEDIA_MAX_CONTENT_LENGTH)) {
      throw new Error("install_smoke_console_external_media_too_large");
    }
    if (contentType && !/^image\//i.test(contentType)) {
      throw new Error("install_smoke_console_external_media_content_type");
    }
    const bytesRead = await readConsoleExternalMediaProbeBytes(response);
    if (bytesRead <= 0) {
      throw new Error("install_smoke_console_external_media_empty");
    }
    return {
      status: response.status,
      contentType,
      contentLength,
      bytesRead,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("install_smoke_console_external_media_")) throw error;
    if (controller.signal.aborted) throw new Error("install_smoke_console_external_media_timeout");
    throw new Error("install_smoke_console_external_media_failed");
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyConsoleExternalMedia(
  html: string,
  serverBase: string,
  options: {
    readonly requireExternalConsoleMedia?: boolean;
    readonly expectedConsoleMediaBaseUrl?: string;
    readonly production?: boolean;
  } = {},
): Promise<ConsoleExternalMediaSmokeResult> {
  const consoleExternalMediaRequired = Boolean(
    options.requireExternalConsoleMedia
      || options.production
      || truthyEnv(process.env[CONSOLE_EXTERNAL_MEDIA_REQUIRED_ENV]),
  );
  const consoleExternalMediaBaseUrl = normalizedConsoleExternalMediaBaseUrl(
    options.expectedConsoleMediaBaseUrl || consoleExternalMediaBaseFromEnv(),
  );
  if (options.production && !consoleExternalMediaBaseUrl) {
    throw new Error("install_smoke_console_external_media_base_missing");
  }
  const candidates = externalConsoleSmokeAssetUrls(html, serverBase);
  const consoleExternalMediaUrl = consoleExternalMediaBaseUrl
    ? candidates.find((candidate) => candidate === consoleSmokeAssetUrlFromBase(consoleExternalMediaBaseUrl))
    : candidates[0];
  if (consoleExternalMediaBaseUrl && !consoleExternalMediaUrl && candidates.length > 0) {
    throw new Error("install_smoke_console_external_media_unexpected_base");
  }
  if (!consoleExternalMediaUrl) {
    if (consoleExternalMediaRequired) {
      throw new Error("install_smoke_console_external_media_missing");
    }
    return {
      consoleExternalMediaVerified: false,
      consoleExternalMediaRequired,
      consoleExternalMediaBaseUrl: consoleExternalMediaBaseUrl || null,
      consoleExternalMediaUrl: null,
      consoleExternalMediaStatus: null,
      consoleExternalMediaContentType: null,
      consoleExternalMediaContentLength: null,
      consoleExternalMediaBytesRead: null,
    };
  }

  const url = new URL(consoleExternalMediaUrl);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("install_smoke_console_external_media_url_unsafe");
  }
  if (consoleExternalMediaBaseUrl && !urlIsUnderBase(url, consoleExternalMediaBaseUrl)) {
    throw new Error("install_smoke_console_external_media_unexpected_base");
  }
  if (options.production) assertProductionSafeConsoleExternalMediaUrl(url);

  const probe = await fetchConsoleExternalMediaProbe(url);
  return {
    consoleExternalMediaVerified: true,
    consoleExternalMediaRequired,
    consoleExternalMediaBaseUrl: consoleExternalMediaBaseUrl || new URL(".", consoleExternalMediaUrl).toString().replace(/\/+$/, ""),
    consoleExternalMediaUrl,
    consoleExternalMediaStatus: probe.status,
    consoleExternalMediaContentType: probe.contentType,
    consoleExternalMediaContentLength: probe.contentLength,
    consoleExternalMediaBytesRead: probe.bytesRead,
  };
}

async function verifyHostConfigFiles(serverBase: string, manifest: AnyRecord) {
  const hostConfigFiles = manifest.hostConfigFiles;
  if (!Array.isArray(hostConfigFiles) || hostConfigFiles.length !== 7) {
    throw new Error("install_smoke_host_config_manifest_missing");
  }

  const snippets = new Map<string, unknown>();
  for (const entry of Array.isArray(manifest.hostInstall) ? manifest.hostInstall : []) {
    for (const snippet of Array.isArray(entry?.configSnippets) ? entry.configSnippets : []) {
      if (typeof snippet.pathHint === "string") snippets.set(snippet.pathHint, snippet.body);
    }
  }

  const verifiedPaths: string[] = [];
  for (const file of hostConfigFiles) {
    const path = String(file?.path || "");
    const url = String(file?.url || "");
    const expectedBytes = Number(file?.bytes || 0);
    const expectedSha256 = String(file?.sha256 || "");
    if (
      !path.startsWith("obsidian-epoch/host-config/")
      || !url.startsWith("/api/epoch/host-config/")
      || file?.contentType !== "application/json"
      || expectedBytes <= 0
      || !/^[a-f0-9]{64}$/.test(expectedSha256)
      || !snippets.has(path)
    ) {
      throw new Error("install_smoke_host_config_manifest_invalid");
    }

    const response = await fetch(new URL(url, serverBase));
    const text = await response.text();
    const actualSha256 = createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
    if (
      response.status !== 200
      || !/^application\/json/.test(response.headers.get("content-type") || "")
      || Buffer.byteLength(text, "utf8") !== expectedBytes
      || actualSha256 !== expectedSha256
      || JSON.stringify(JSON.parse(text)) !== JSON.stringify(snippets.get(path))
    ) {
      throw new Error("install_smoke_host_config_download_failed");
    }
    verifiedPaths.push(path);
  }

  const missing = await getJsonWithStatus(serverBase, "/api/epoch/host-config/nope.json");
  if (missing.status !== 404 || missing.body?.error !== "host_config_not_found") {
    throw new Error("install_smoke_host_config_missing_route_failed");
  }
  const matrix = verifyHostInstallMatrix(serverBase, manifest, snippets, new Set(verifiedPaths));

  return {
    hostConfigFilesVerified: true,
    hostConfigFileCount: verifiedPaths.length,
    hostConfigFirstPath: verifiedPaths[0],
    hostConfigLastPath: verifiedPaths.at(-1),
    hostConfigMissingStatus: missing.status,
    ...matrix,
  };
}

async function postStreamableMcpJsonRpc(
  serverBase: string,
  payload: AnyRecord,
  mcpToken: string | undefined,
  expectedStatus = 200,
  sessionId?: string,
) {
  const response = await fetch(`${serverBase}/mcp`, {
    method: "POST",
    headers: {
      "accept": "application/json, text/event-stream",
      "content-type": "application/json",
      ...(sessionId ? {
        "mcp-session-id": sessionId,
        "mcp-protocol-version": MCP_PROTOCOL_VERSION,
      } : {}),
      ...authorizationHeaders(mcpToken),
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (response.status !== expectedStatus) {
    if (response.status === 401 && !mcpToken && text.includes("authentication_required")) {
      throw new Error("install_smoke_mcp_token_required");
    }
    throw new Error(`install_smoke_streamable_mcp_status:${payload.method}:${response.status}`);
  }
  if (!text) return { status: response.status, body: null, headers: response.headers };
  const body = JSON.parse(text);
  if (body?.error) {
    throw new Error(body.error.message || "install_smoke_streamable_mcp_error");
  }
  return { status: response.status, body, headers: response.headers };
}

async function verifyStreamableMcpEndpoint(serverBase: string, mcpToken: string | undefined): Promise<StreamableMcpSmokeResult> {
  const initialize = await postStreamableMcpJsonRpc(serverBase, {
    jsonrpc: "2.0",
    id: "install-smoke-initialize",
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "obsidian-epoch-install-smoke",
        version: "0.1.0",
      },
    },
  }, mcpToken);
  const initializeResult = initialize.body?.result;
  if (initializeResult?.protocolVersion !== MCP_PROTOCOL_VERSION) {
    throw new Error("install_smoke_streamable_mcp_protocol_mismatch");
  }
  const serverName = initializeResult?.serverInfo?.name;
  if (serverName !== "obsidian-epoch-agent-world") {
    throw new Error("install_smoke_streamable_mcp_server_mismatch");
  }
  const sessionId = initialize.headers.get("mcp-session-id") || "";
  if (!sessionId) throw new Error("install_smoke_streamable_mcp_session_missing");

  const initialized = await postStreamableMcpJsonRpc(serverBase, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, mcpToken, 202, sessionId);

  const tools = await postStreamableMcpJsonRpc(serverBase, {
    jsonrpc: "2.0",
    id: "install-smoke-tools",
    method: "tools/list",
  }, mcpToken, 200, sessionId);
  const toolEntries = tools.body?.result?.tools;
  if (!Array.isArray(toolEntries) || !toolEntries.some((tool: AnyRecord) => tool.name === "obsidian_epoch.quickstart")) {
    throw new Error("install_smoke_streamable_mcp_tools_missing");
  }
  if (!toolEntries.some((tool: AnyRecord) => tool.name === "obsidian_epoch.world_overview")) {
    throw new Error("install_smoke_streamable_mcp_world_overview_missing");
  }

  const quickstartResponse = await postStreamableMcpJsonRpc(serverBase, {
    jsonrpc: "2.0",
    id: "install-smoke-quickstart",
    method: "tools/call",
    params: {
      name: "obsidian_epoch.quickstart",
      arguments: { host: "Streamable HTTP MCP" },
    },
  }, mcpToken, 200, sessionId);
  const quickstart = contentPayload(quickstartResponse.body);
  if (quickstart.serverBase !== serverBase) {
    throw new Error("install_smoke_streamable_mcp_quickstart_server_mismatch");
  }

  return {
    streamableMcpVerified: true,
    streamableMcpEndpoint: `${serverBase}/mcp`,
    streamableMcpProtocolVersion: initializeResult.protocolVersion,
    streamableMcpServerName: serverName,
    streamableMcpInitializedStatus: initialized.status,
    streamableMcpGetStatus: await getStatus(serverBase, "/mcp", authorizationHeaders(mcpToken)),
    streamableMcpToolCount: toolEntries.length,
    streamableMcpWorldOverviewListed: true,
    streamableMcpQuickstartServerBase: quickstart.serverBase,
  };
}

async function preflightInstallSurface(
  serverBase: string,
  options: Pick<InstallSmokeOptions, "production" | "requireOperatorSigning" | "expectedReleaseKeyId" | "requireExternalConsoleMedia" | "expectedConsoleMediaBaseUrl"> = {},
) {
  const health = await getJsonWithStatus(serverBase, "/api/health");
  if (health.status !== 200 || health.body?.ok !== true) throw new Error("install_smoke_health_failed");
  const epochHealth = await getJsonWithStatus(serverBase, "/api/epoch/health");
  if (epochHealth.status !== 200 || epochHealth.body?.ok !== true) throw new Error("install_smoke_epoch_health_failed");
  if (!health.body?.checks?.store || !health.body?.checks?.maintenance || !health.body?.checks?.recovery) {
    throw new Error("install_smoke_health_checks_missing");
  }
  if (!epochHealth.body?.checks?.store || !epochHealth.body?.checks?.maintenance || !epochHealth.body?.checks?.recovery) {
    throw new Error("install_smoke_epoch_health_checks_missing");
  }
  if (health.body.checks.store.persistent && health.body.checks.recovery.status !== "ok") {
    throw new Error("install_smoke_recovery_check_failed");
  }

  const manifest = await getJsonWithStatus(serverBase, "/api/epoch/install-manifest");
  if (manifest.status !== 200) throw new Error("install_smoke_manifest_failed");
  const packageInfo = manifest.body?.package;
  const packageUrl = manifest.body?.packageUrl;
  if (!packageInfo || typeof packageUrl !== "string") throw new Error("install_smoke_package_manifest_missing");
  if (manifest.body?.serverBase !== serverBase) throw new Error("install_smoke_manifest_server_mismatch");
  const packageSignatureAlgorithm = String(manifest.body?.verification?.packageSignatureAlgorithm || "");
  const packageReleasePublicKey = String(manifest.body?.verification?.packageReleasePublicKey || "");
  const packageReleaseKeyId = String(manifest.body?.verification?.packageReleaseKeyId || "");
  const packageSigningTrust = String(manifest.body?.verification?.packageSigningTrust || "");
  const packageSigningKeySource = String(manifest.body?.verification?.packageSigningKeySource || "");
  if (
    packageSignatureAlgorithm !== OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM
    || !packageReleasePublicKey
    || !/^[a-f0-9]{64}$/.test(packageReleaseKeyId)
    || !["operator_configured", "local_alpha_fallback"].includes(packageSigningTrust)
    || !packageSigningKeySource
  ) {
    throw new Error("install_smoke_package_signature_manifest_missing");
  }
  const expectedReleaseKeyId = normalizedExpectedReleaseKeyId(options.expectedReleaseKeyId || process.env.AGENT_INSTALL_SMOKE_EXPECTED_RELEASE_KEY_ID);
  const requireOperatorSigning = Boolean(options.requireOperatorSigning)
    || truthyEnv(process.env.AGENT_INSTALL_SMOKE_REQUIRE_OPERATOR_SIGNING);
  if (requireOperatorSigning && packageSigningTrust !== "operator_configured") {
    throw new Error("install_smoke_operator_signing_required");
  }
  if (expectedReleaseKeyId && packageReleaseKeyId !== expectedReleaseKeyId) {
    throw new Error("install_smoke_release_key_id_mismatch");
  }
  const installSmokeCommand = String(manifest.body?.verification?.installSmokeCommand || "");
  const remoteInstallSmokeCommand = String(manifest.body?.verification?.remoteInstallSmokeCommand || "");
  const releaseRehearsalCommand = String(manifest.body?.verification?.releaseRehearsalCommand || "");
  const productionReleaseRehearsalCommand = String(manifest.body?.verification?.productionReleaseRehearsalCommand || "");
  const recoveryDrillCommand = String(manifest.body?.verification?.recoveryDrillCommand || "");
  const backupCommand = String(manifest.body?.verification?.backupCommand || "");
  const restoreBackupCommand = String(manifest.body?.verification?.restoreBackupCommand || "");
  if (
    installSmokeCommand !== INSTALL_SMOKE_COMMAND
    || remoteInstallSmokeCommand !== REMOTE_INSTALL_SMOKE_COMMAND
  ) {
    throw new Error("install_smoke_install_commands_missing");
  }
  if (
    recoveryDrillCommand !== "npm run agent:recovery-drill -- --json"
    || backupCommand !== "npm run agent:backup -- --json"
    || restoreBackupCommand !== "npm run agent:restore-backup -- --json"
  ) {
    throw new Error("install_smoke_recovery_commands_missing");
  }
  if (
    releaseRehearsalCommand !== RELEASE_REHEARSAL_COMMAND
    || productionReleaseRehearsalCommand !== PRODUCTION_RELEASE_REHEARSAL_COMMAND
  ) {
    throw new Error("install_smoke_release_rehearsal_commands_missing");
  }
  const consolePageUrl = manifest.body?.publicPages?.console;
  if (consolePageUrl !== "/epoch/console") throw new Error("install_smoke_console_manifest_missing");
  const worldPageUrl = manifest.body?.publicPages?.world;
  if (worldPageUrl !== "/epoch/world") throw new Error("install_smoke_world_manifest_missing");
  const webBridgeAuditIndexUrl = manifest.body?.publicPages?.auditIndex;
  const webBridgeAuditReplayTemplate = manifest.body?.publicPages?.audit;
  if (webBridgeAuditIndexUrl !== "/epoch/audit" || webBridgeAuditReplayTemplate !== "/epoch/audit/{eventId}") {
    throw new Error("install_smoke_audit_manifest_missing");
  }
  const webBridgeEntry = Array.isArray(manifest.body?.hostInstall)
    ? manifest.body.hostInstall.find((entry: AnyRecord) => entry?.host === "Web LLM bridge")
    : undefined;
  const webBridgePublicPages = webBridgeEntry?.bridge?.publicPages;
  const webBridgeSequence = Array.isArray(webBridgeEntry?.configSnippets)
    ? webBridgeEntry.configSnippets.find((snippet: AnyRecord) => snippet?.pathHint === "obsidian-epoch/host-config/web-llm-bridge-sequence.json")
    : undefined;
  const webBridgeSequencePublicPages = webBridgeSequence?.body?.publicPages;
  const webBridgeAuditPublicPagesVerified = webBridgePublicPages?.auditIndex === webBridgeAuditIndexUrl
    && webBridgePublicPages?.audit === webBridgeAuditReplayTemplate
    && webBridgeSequencePublicPages?.auditIndex === webBridgeAuditIndexUrl
    && webBridgeSequencePublicPages?.audit === webBridgeAuditReplayTemplate;
  if (!webBridgeAuditPublicPagesVerified) throw new Error("install_smoke_web_bridge_audit_manifest_missing");
  const healthPaths = manifest.body?.health;
  if (healthPaths?.readiness !== "/api/health" || healthPaths?.epochReadiness !== "/api/epoch/health") {
    throw new Error("install_smoke_health_manifest_missing");
  }
  const hostConfig = await verifyHostConfigFiles(serverBase, manifest.body);

  const consolePage = await getTextWithStatus(serverBase, consolePageUrl);
  const consolePageVerified = consolePage.status === 200
    && /text\/html/.test(consolePage.contentType)
    && consolePage.text.includes("<div id=\"root\"></div>")
    && consolePage.text.includes("window.__WORLD_MAP_DATA__")
    && consolePage.text.includes("<base href=\"/epoch/console/\">");
  if (!consolePageVerified) throw new Error("install_smoke_console_page_failed");

  const consoleExternalMedia = await verifyConsoleExternalMedia(consolePage.text, serverBase, {
    requireExternalConsoleMedia: options.requireExternalConsoleMedia,
    expectedConsoleMediaBaseUrl: options.expectedConsoleMediaBaseUrl,
    production: options.production,
  });
  const consoleAssetStatus = consoleExternalMedia.consoleExternalMediaVerified
    ? null
    : await getStatus(serverBase, CONSOLE_SMOKE_ASSET_PATH);
  const consoleAssetVerified = consoleAssetStatus === 200;
  if (!consoleExternalMedia.consoleExternalMediaVerified && !consoleAssetVerified) {
    throw new Error("install_smoke_console_asset_failed");
  }

  const webBridgeAuditIndexPage = await getTextWithStatus(serverBase, webBridgeAuditIndexUrl);
  const webBridgeAuditIndexVerified = webBridgeAuditIndexPage.status === 200
    && /text\/html/.test(webBridgeAuditIndexPage.contentType)
    && webBridgeAuditIndexPage.text.includes("公开审计索引")
    && !/<script/i.test(webBridgeAuditIndexPage.text);
  if (!webBridgeAuditIndexVerified) throw new Error("install_smoke_web_bridge_audit_index_failed");

  const packageResponse = await fetch(new URL(packageUrl, serverBase));
  const packageBuffer = Buffer.from(await packageResponse.arrayBuffer());
  const packageSha256 = createHash("sha256").update(packageBuffer).digest("hex");
  const expectedSha256 = String(packageInfo.sha256 || "");
  const expectedBytes = Number(packageInfo.bytes || 0);
  const headerSha256 = packageResponse.headers.get("x-obsidian-epoch-package-sha256");
  const packageIntegrityVerified = packageResponse.status === 200
    && packageBuffer.byteLength === expectedBytes
    && packageSha256 === expectedSha256
    && (!headerSha256 || headerSha256 === expectedSha256);
  if (!packageIntegrityVerified) throw new Error("install_smoke_package_integrity_failed");

  return {
    healthStatus: health.status,
    healthOk: Boolean(health.body.ok),
    epochHealthStatus: epochHealth.status,
    epochHealthOk: Boolean(epochHealth.body.ok),
    healthChecks: health.body.checks,
    epochHealthChecks: epochHealth.body.checks,
    manifestHealth: healthPaths,
    installManifestStatus: manifest.status,
    ...hostConfig,
    consolePageVerified,
    consoleAssetVerified,
    consolePageUrl,
    worldPageUrl,
    consolePageStatus: consolePage.status,
    consoleAssetStatus,
    ...consoleExternalMedia,
    webBridgeAuditPublicPagesVerified,
    webBridgeAuditIndexVerified,
    webBridgeAuditIndexUrl,
    webBridgeAuditIndexStatus: webBridgeAuditIndexPage.status,
    webBridgeAuditReplayTemplate,
    packageIntegrityVerified,
    packageSignatureAlgorithm,
    packageReleasePublicKey,
    packageReleaseKeyId,
    packageSigningTrust,
    packageSigningKeySource,
    operatorSigningRequired: requireOperatorSigning,
    expectedReleaseKeyId,
    releaseKeyPinned: Boolean(expectedReleaseKeyId),
    installSmokeCommand,
    remoteInstallSmokeCommand,
    releaseRehearsalCommand,
    productionReleaseRehearsalCommand,
    recoveryDrillCommand,
    backupCommand,
    restoreBackupCommand,
    packageArchive: packageBuffer,
    packageMcpCommand: String(manifest.body?.mcpCommand || ""),
    packageSha256,
    packageBytes: packageBuffer.byteLength,
  };
}

export async function runEpochInstallSmoke(options: InstallSmokeOptions = {}) {
  const seed = options.seed || process.env.AGENT_INSTALL_SMOKE_SEED || `install_smoke_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const remoteServerBase = options.serverBase || process.env.AGENT_WORLD_SERVER;
  const mcpToken = normalizedMcpToken(options.mcpToken || process.env.AGENT_WORLD_MCP_TOKEN);
  const production = Boolean(options.production) || truthyEnv(process.env.AGENT_INSTALL_SMOKE_PRODUCTION);
  if (production && !remoteServerBase) {
    throw new Error("install_smoke_production_requires_remote_server");
  }
  const serverBaseOverride = remoteServerBase ? normalizeServerBase(remoteServerBase) : undefined;
  if (production && serverBaseOverride && !isPublicHttpsServerBase(serverBaseOverride)) {
    throw new Error("install_smoke_production_server_must_be_public_https");
  }
  const runtime = serverBaseOverride ? undefined : createAgentWorldRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory(seed),
    },
  });
  const server = runtime ? createAgentHttpServer({ runtime }) : undefined;
  const mode = serverBaseOverride ? "remote" : "local";
  let packageRoot: string | undefined;
  let packageFileIntegrity: PackageIntegrityVerification | undefined;
  let mcp: JsonRpcClient | undefined;

  try {
    if (server) await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server?.address();
    if (server && (!address || typeof address !== "object")) throw new Error("install_smoke_server_address_missing");
    const serverBase = serverBaseOverride || `http://127.0.0.1:${(address as { port: number }).port}`;
    const preflight = await preflightInstallSurface(serverBase, {
      production,
      requireOperatorSigning: options.requireOperatorSigning || production,
      expectedReleaseKeyId: options.expectedReleaseKeyId,
      requireExternalConsoleMedia: options.requireExternalConsoleMedia,
      expectedConsoleMediaBaseUrl: options.expectedConsoleMediaBaseUrl,
    });
    const streamableMcp = await verifyStreamableMcpEndpoint(serverBase, mcpToken);
    const extractedPackage = await extractPackageArchive(preflight.packageArchive, preflight.packageReleasePublicKey);
    packageRoot = extractedPackage.root;
    packageFileIntegrity = extractedPackage.integrity;
    mcp = createJsonRpcClient(serverBase, packageRoot, mcpToken);

    const packageInitialize = await mcp.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "obsidian-epoch-install-smoke-package", version: "0.1.0" },
    });
    if (recordValue(packageInitialize.result).protocolVersion !== MCP_PROTOCOL_VERSION) {
      throw new Error("install_smoke_package_proxy_protocol_mismatch");
    }
    mcp.notify("notifications/initialized");

    const toolList = await mcp.request("tools/list");
    const packageToolEntries = recordValue(toolList.result).tools;
    if (!Array.isArray(packageToolEntries) || !packageToolEntries.some((tool: AnyRecord) => tool.name === "obsidian_epoch.quickstart")) {
      throw new Error("install_smoke_package_proxy_tools_missing");
    }
    if (!packageToolEntries.some((tool: AnyRecord) => tool.name === "obsidian_epoch.world_overview")) {
      throw new Error("install_smoke_package_proxy_world_overview_missing");
    }
    const quickstart = contentPayload(await mcp.callTool("obsidian_epoch.quickstart", { host: "Codex" }));
    if (quickstart.serverBase !== serverBase) throw new Error("install_smoke_quickstart_server_mismatch");

    const registration = await registerSmokeIdentity(serverBase, `${seed}-identity-1`);
    const { agentId, explorerId, recoveryCode: ownerRecoveryCode } = registration;

    const turnCard = contentPayload(await mcp.callTool("obsidian_epoch.turn_card", {
      agentId,
      regionId: "region_gray_harbor",
      prompt: "Run the MCP package install smoke flow.",
      recoveryCode: ownerRecoveryCode,
      idempotencyKey: `${seed}-turn-1`,
    }));
    const actionOptionId = turnCard.value.actionOptions[0].actionOptionId;

    const resolvedTurn = contentPayload(await mcp.callTool("obsidian_epoch.resolve_turn", {
      turnCardId: turnCard.value.turnCardId,
      sequence: turnCard.value.sequence,
      nonce: turnCard.value.nonce,
      actionOptionId,
      visibleText: "Install smoke selected one server-issued action option.",
      recoveryCode: ownerRecoveryCode,
      idempotencyKey: `${seed}-resolve-1`,
    }));
    if (resolvedTurn.value.actionOptionId !== actionOptionId) throw new Error("install_smoke_resolution_mismatch");

    const resultPagePreview = contentPayload(await mcp.callTool("obsidian_epoch.result_page", {
      turnCardId: turnCard.value.turnCardId,
    }));
    const resultPage = contentPayload(await mcp.callTool("obsidian_epoch.create_result_page", {
      turnCardId: turnCard.value.turnCardId,
      publishToken: requiredPublishToken(resultPagePreview.publishToken, "install_smoke_result_publish_token_missing"),
      recoveryCode: ownerRecoveryCode,
      idempotencyKey: `${seed}-result-page-1`,
    }));
    const resultPlayMode = String(resultPage.page.payload.receipt?.playMode || "");
    const resultTrustTier = String(resultPage.page.payload.receipt?.trustTier || "");
    if (resultPlayMode !== "ranked" || resultTrustTier !== "server_settled") {
      throw new Error("install_smoke_result_trust_mode_mismatch");
    }
    const resultPageUrl = resultPage.page.urlPath as string;
    const resultPageStatus = await getStatus(serverBase, resultPageUrl);
    const agentPageStatus = await getStatus(serverBase, `/epoch/agent/${encodeURIComponent(agentId)}`);
    if (resultPageStatus !== 200 || agentPageStatus !== 200) {
      throw new Error("install_smoke_public_pages_failed");
    }

    const explorerProfile = contentPayload(await mcp.callTool("obsidian_epoch.explorer_profile", {
      explorerId,
    }));
    const explorerPageUrl = String(explorerProfile.publicPages?.explorer || `/epoch/explorer/${encodeURIComponent(explorerId)}`);
    const explorerPage = await getTextWithStatus(serverBase, explorerPageUrl);
    const explorerProfileVerified = explorerProfile.explorerId === explorerId
      && explorerProfile.summary?.totalIdentities >= 1
      && Array.isArray(explorerProfile.identities)
      && explorerProfile.identities.some((entry: AnyRecord) => entry.agentId === agentId)
      && explorerPage.status === 200
      && /text\/html/.test(explorerPage.contentType)
      && explorerPage.text.includes(explorerId)
      && explorerPage.text.includes(agentId)
      && !/<script/i.test(explorerPage.text);
    if (!explorerProfileVerified) {
      throw new Error("install_smoke_explorer_profile_failed");
    }

    const webBridgeTurn = contentPayload(await mcp.callTool("obsidian_epoch.web_bridge_turn", {
      agentId,
      regionId: "region_gray_harbor",
      mandate: "Run the browser-only Web LLM bridge install smoke flow.",
      recoveryCode: ownerRecoveryCode,
      idempotencyKey: `${seed}-web-bridge-turn-1`,
    }));
    if (webBridgeTurn.value.channelClass !== "browser_copy_paste" || webBridgeTurn.value.deliveryTrust !== "untrusted_client") {
      throw new Error("install_smoke_web_bridge_trust_mismatch");
    }
    const webBridgeActionOptionId = webBridgeTurn.value.actionOptions?.[0]?.actionOptionId;
    if (typeof webBridgeActionOptionId !== "string" || !webBridgeTurn.value.copyPrompt?.includes(webBridgeActionOptionId)) {
      throw new Error("install_smoke_web_bridge_option_missing");
    }
    const webBridgeAction = contentPayload(await mcp.callTool("obsidian_epoch.submit_web_bridge_action", {
      sessionId: webBridgeTurn.value.sessionId,
      actionOptionId: webBridgeActionOptionId,
      visibleText: "Browser model smoke response chose one server-issued action option.",
      clientDeclaredOutcome: "legendary_empire_commander",
      recoveryCode: ownerRecoveryCode,
      idempotencyKey: `${seed}-web-bridge-submit-1`,
    }));
    if (webBridgeAction.value.channelClass !== "browser_copy_paste" || webBridgeAction.value.deliveryTrust !== "untrusted_client") {
      throw new Error("install_smoke_web_bridge_action_trust_mismatch");
    }
    if (webBridgeAction.value.action.actionOptionId !== webBridgeActionOptionId) {
      throw new Error("install_smoke_web_bridge_action_mismatch");
    }
    const webBridgeResultPagePreview = contentPayload(await mcp.callTool("obsidian_epoch.result_page", {
      hostedSessionId: webBridgeTurn.value.sessionId,
    }));
    const webBridgeResultPage = contentPayload(await mcp.callTool("obsidian_epoch.create_result_page", {
      hostedSessionId: webBridgeTurn.value.sessionId,
      publishToken: requiredPublishToken(webBridgeResultPagePreview.publishToken, "install_smoke_web_bridge_result_publish_token_missing"),
      recoveryCode: ownerRecoveryCode,
      idempotencyKey: `${seed}-web-bridge-result-page-1`,
    }));
    if (webBridgeResultPage.page.payload.focusHostedSession?.sessionId !== webBridgeTurn.value.sessionId) {
      throw new Error("install_smoke_web_bridge_result_focus_mismatch");
    }
    if (webBridgeResultPage.page.payload.focusHostedSession?.channelClass !== "browser_copy_paste") {
      throw new Error("install_smoke_web_bridge_result_focus_channel_mismatch");
    }
    const webBridgeResultPlayMode = String(webBridgeResultPage.page.payload.receipt?.playMode || "");
    const webBridgeResultTrustTier = String(webBridgeResultPage.page.payload.receipt?.trustTier || "");
    if (webBridgeResultPlayMode !== "casual" || webBridgeResultTrustTier !== "untrusted_capped") {
      throw new Error("install_smoke_web_bridge_result_trust_mode_mismatch");
    }
    const webBridgeResultPageUrl = webBridgeResultPage.page.urlPath as string;
    const webBridgeResultPageStatus = await getStatus(serverBase, webBridgeResultPageUrl);
    if (webBridgeResultPageStatus !== 200) {
      throw new Error("install_smoke_web_bridge_public_page_failed");
    }
    const webBridgeReceiptEvents = webBridgeResultPage.page.payload.receipt?.canonicalEvents;
    const webBridgeAuditReplayUrl = String((Array.isArray(webBridgeReceiptEvents)
      ? webBridgeReceiptEvents.find((event: AnyRecord) => typeof event?.auditUrl === "string" && event.auditUrl.startsWith("/epoch/audit/"))?.auditUrl
      : "") || "");
    if (!/^\/epoch\/audit\/[^/]+$/.test(webBridgeAuditReplayUrl)) {
      throw new Error("install_smoke_web_bridge_audit_replay_missing");
    }
    const webBridgeAuditReplayPage = await getTextWithStatus(serverBase, webBridgeAuditReplayUrl);
    const webBridgeAuditReplayVerified = webBridgeAuditReplayPage.status === 200
      && /text\/html/.test(webBridgeAuditReplayPage.contentType)
      && webBridgeAuditReplayPage.text.includes("净化摘要")
      && webBridgeAuditReplayPage.text.includes("回放链")
      && webBridgeAuditReplayPage.text.includes("内部编号")
      && !/<script/i.test(webBridgeAuditReplayPage.text);
    if (!webBridgeAuditReplayVerified) {
      throw new Error("install_smoke_web_bridge_audit_replay_failed");
    }
    let webBridgePostResultMutationError = "";
    try {
      contentPayload(await mcp.callTool("obsidian_epoch.submit_web_bridge_action", {
        sessionId: webBridgeTurn.value.sessionId,
        actionOptionId: webBridgeActionOptionId,
        visibleText: "Attempt to mutate a completed browser bridge session after the public result page exists.",
        recoveryCode: ownerRecoveryCode,
        idempotencyKey: `${seed}-web-bridge-post-result-mutation-1`,
      }));
    } catch (error) {
      webBridgePostResultMutationError = error instanceof Error ? error.message : String(error);
    }
    const webBridgePostResultMutationRejected = webBridgePostResultMutationError === "hosted_session_not_active";
    if (!webBridgePostResultMutationRejected) {
      throw new Error("install_smoke_web_bridge_post_result_mutation_not_rejected");
    }
    const worldPage = await getTextWithStatus(serverBase, preflight.worldPageUrl);
    const worldPageVerified = worldPage.status === 200
      && /text\/html/.test(worldPage.contentType)
      && worldPage.text.includes("世界总览")
      && htmlIncludesUrl(worldPage.text, resultPageUrl)
      && worldPage.text.includes(agentId)
      && !/<script/i.test(worldPage.text);
    if (!worldPageVerified) {
      throw new Error("install_smoke_world_page_failed");
    }
    const worldOverview = contentPayload(await mcp.callTool("obsidian_epoch.world_overview", { limit: 4 }));
    const worldOverviewPublicPage = String(worldOverview.publicPages?.world || "");
    const worldOverviewToolVerified = worldOverviewPublicPage === preflight.worldPageUrl
      && Array.isArray(worldOverview.recentResults)
      && worldOverview.recentResults.some((page: AnyRecord) => page.urlPath === resultPageUrl)
      && Array.isArray(worldOverview.regionHighlights);
    if (!worldOverviewToolVerified) {
      throw new Error("install_smoke_world_overview_tool_failed");
    }

    return {
      ok: true,
      mode,
      via: "stdio-mcp",
      serverBase,
      seed,
      explorerId,
      agentId,
      turnCardId: turnCard.value.turnCardId,
      resultPageUrl,
      resultPlayMode,
      resultTrustTier,
      worldPageUrl: preflight.worldPageUrl,
      explorerPageUrl,
      webBridgeSessionId: webBridgeTurn.value.sessionId,
      webBridgeResultPageUrl,
      webBridgeResultPlayMode,
      webBridgeResultTrustTier,
      webBridgeAuditReplayUrl,
      agentPageStatus,
      explorerPageStatus: explorerPage.status,
      explorerProfileVerified,
      explorerProfileIdentityCount: explorerProfile.summary.totalIdentities,
      resultPageStatus,
      worldPageStatus: worldPage.status,
      worldPageVerified,
      worldOverviewToolVerified,
      worldOverviewPublicPage,
      webBridgeChannelClass: webBridgeTurn.value.channelClass,
      webBridgeDeliveryTrust: webBridgeTurn.value.deliveryTrust,
      webBridgeActionChannelClass: webBridgeAction.value.channelClass,
      webBridgeActionDeliveryTrust: webBridgeAction.value.deliveryTrust,
      webBridgeResultFocusChannelClass: webBridgeResultPage.page.payload.focusHostedSession?.channelClass,
      webBridgePostResultMutationRejected,
      webBridgePostResultMutationError,
      webBridgeResultPageStatus,
      webBridgeAuditReplayStatus: webBridgeAuditReplayPage.status,
      webBridgeAuditReplayVerified,
      healthStatus: preflight.healthStatus,
      healthOk: preflight.healthOk,
      epochHealthStatus: preflight.epochHealthStatus,
      epochHealthOk: preflight.epochHealthOk,
      healthChecks: preflight.healthChecks,
      epochHealthChecks: preflight.epochHealthChecks,
      manifestHealth: preflight.manifestHealth,
      installManifestStatus: preflight.installManifestStatus,
      hostConfigFilesVerified: preflight.hostConfigFilesVerified,
      hostConfigFileCount: preflight.hostConfigFileCount,
      hostConfigFirstPath: preflight.hostConfigFirstPath,
      hostConfigLastPath: preflight.hostConfigLastPath,
      hostConfigMissingStatus: preflight.hostConfigMissingStatus,
      hostInstallMatrixVerified: preflight.hostInstallMatrixVerified,
      hostInstallMatrixHosts: preflight.hostInstallMatrixHosts,
      hostInstallMatrixConfigPaths: preflight.hostInstallMatrixConfigPaths,
      hostInstallMatrixMcpCommand: preflight.hostInstallMatrixMcpCommand,
      hostInstallMatrixServerEnv: preflight.hostInstallMatrixServerEnv,
      hostInstallMatrixQuickstartTool: preflight.hostInstallMatrixQuickstartTool,
      hostInstallMatrixFirstTurnPlaybook: preflight.hostInstallMatrixFirstTurnPlaybook,
      consolePageVerified: preflight.consolePageVerified,
      consoleAssetVerified: preflight.consoleAssetVerified,
      consolePageUrl: preflight.consolePageUrl,
      consolePageStatus: preflight.consolePageStatus,
      consoleAssetStatus: preflight.consoleAssetStatus,
      consoleExternalMediaVerified: preflight.consoleExternalMediaVerified,
      consoleExternalMediaRequired: preflight.consoleExternalMediaRequired,
      consoleExternalMediaBaseUrl: preflight.consoleExternalMediaBaseUrl,
      consoleExternalMediaUrl: preflight.consoleExternalMediaUrl,
      consoleExternalMediaStatus: preflight.consoleExternalMediaStatus,
      consoleExternalMediaContentType: preflight.consoleExternalMediaContentType,
      consoleExternalMediaContentLength: preflight.consoleExternalMediaContentLength,
      consoleExternalMediaBytesRead: preflight.consoleExternalMediaBytesRead,
      webBridgeAuditPublicPagesVerified: preflight.webBridgeAuditPublicPagesVerified,
      webBridgeAuditIndexVerified: preflight.webBridgeAuditIndexVerified,
      webBridgeAuditIndexUrl: preflight.webBridgeAuditIndexUrl,
      webBridgeAuditIndexStatus: preflight.webBridgeAuditIndexStatus,
      webBridgeAuditReplayTemplate: preflight.webBridgeAuditReplayTemplate,
      packageIntegrityVerified: preflight.packageIntegrityVerified,
      packageFileIntegrityVerified: packageFileIntegrity?.verified === true,
      packageFileSignatureVerified: packageFileIntegrity?.releaseSignatureVerified === true,
      packageFileIntegrityManifest: packageFileIntegrity?.manifestPath || OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE,
      packageFileIntegrityFileCount: packageFileIntegrity?.fileCount || 0,
      packageSignatureAlgorithm: packageFileIntegrity?.signatureAlgorithm || preflight.packageSignatureAlgorithm,
      packageReleasePublicKey: packageFileIntegrity?.releasePublicKey || preflight.packageReleasePublicKey,
      packageReleaseKeyId: packageFileIntegrity?.releaseKeyId || preflight.packageReleaseKeyId,
      packageSigningTrust: preflight.packageSigningTrust,
      packageSigningKeySource: preflight.packageSigningKeySource,
      operatorSigningRequired: preflight.operatorSigningRequired,
      expectedReleaseKeyId: preflight.expectedReleaseKeyId,
      releaseKeyPinned: preflight.releaseKeyPinned,
      installSmokeCommand: preflight.installSmokeCommand,
      remoteInstallSmokeCommand: preflight.remoteInstallSmokeCommand,
      releaseRehearsalCommand: preflight.releaseRehearsalCommand,
      productionReleaseRehearsalCommand: preflight.productionReleaseRehearsalCommand,
      recoveryDrillCommand: preflight.recoveryDrillCommand,
      backupCommand: preflight.backupCommand,
      restoreBackupCommand: preflight.restoreBackupCommand,
      packageProxyVerified: true,
      ...streamableMcp,
      webBridgeVerified: true,
      packageMcpCommand: preflight.packageMcpCommand,
      packageSha256: preflight.packageSha256,
      packageBytes: preflight.packageBytes,
    };
  } finally {
    if (mcp) await mcp.close();
    if (packageRoot) await rm(packageRoot, { recursive: true, force: true });
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const cliArgs = process.argv.slice(2);
  runEpochInstallSmoke({
    serverBase: parseServerArg(cliArgs),
    mcpToken: parseValueArg(cliArgs, "--mcp-token"),
    production: hasFlagArg(cliArgs, "--production"),
    requireOperatorSigning: hasFlagArg(cliArgs, "--require-operator-signing"),
    expectedReleaseKeyId: parseValueArg(cliArgs, "--expected-release-key-id"),
    requireExternalConsoleMedia: hasFlagArg(cliArgs, "--require-external-console-media"),
    expectedConsoleMediaBaseUrl: parseValueArg(cliArgs, "--console-media-base-url"),
  })
    .then((result) => {
      if (process.argv.includes("--json")) {
        console.log(JSON.stringify(result));
      } else {
        console.log(`Obsidian Epoch install smoke passed: ${result.agentId} -> ${result.resultPageUrl}`);
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (process.argv.includes("--json")) {
        console.log(JSON.stringify({ ok: false, error: message }));
      } else {
        console.error(`Obsidian Epoch install smoke failed: ${message}`);
      }
      process.exitCode = 1;
    });
}
