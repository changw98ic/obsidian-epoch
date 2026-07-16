import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface CliOptions {
  readonly serverBase: string;
  readonly outDir: string;
  readonly chromePath?: string;
  readonly json: boolean;
}

interface CdpError {
  readonly message?: string;
  readonly code?: number;
}

interface CdpResponse {
  readonly id?: number;
  readonly result?: unknown;
  readonly error?: CdpError;
}

interface TargetInfo {
  readonly webSocketDebuggerUrl?: string;
}

interface ViewportSpec {
  readonly name: "desktop" | "mobile";
  readonly width: number;
  readonly height: number;
  readonly mobile: boolean;
  readonly screenshotName: string;
}

interface WatchLightMetric {
  readonly text: string;
  readonly width: number;
  readonly height: number;
}

interface WatchBoardMetric {
  readonly watchVisible: boolean;
  readonly hasLiveInstall: boolean;
  readonly hasPackageHash: boolean;
  readonly scrollWidth: number;
  readonly viewportWidth: number;
  readonly overflow: boolean;
  readonly lights: readonly WatchLightMetric[];
}

interface ViewportResult extends WatchBoardMetric {
  readonly name: ViewportSpec["name"];
  readonly screenshotPath: string;
}

interface VisualQaResult {
  readonly ok: boolean;
  readonly serverBase: string;
  readonly installTruthLevel: string;
  readonly results: readonly ViewportResult[];
}

const DEFAULT_SERVER_BASE = "http://127.0.0.1:8787";
const DEFAULT_OUT_DIR = "/tmp";
const VIEWPORTS: readonly ViewportSpec[] = [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    mobile: false,
    screenshotName: "obsidian-epoch-agent-console-desktop-live-install.png",
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    mobile: true,
    screenshotName: "obsidian-epoch-agent-console-mobile-live-install.png",
  },
];

function parseArgs(argv: readonly string[]): CliOptions {
  let serverBase = process.env.AGENT_WORLD_SERVER || DEFAULT_SERVER_BASE;
  let outDir = process.env.AGENT_VISUAL_QA_OUT_DIR || DEFAULT_OUT_DIR;
  let chromePath = process.env.CHROME_PATH;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--server") {
      const value = argv[index + 1];
      if (!value) throw new Error("--server requires a value");
      serverBase = value;
      index += 1;
      continue;
    }
    if (arg === "--out-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--out-dir requires a value");
      outDir = value;
      index += 1;
      continue;
    }
    if (arg === "--chrome") {
      const value = argv[index + 1];
      if (!value) throw new Error("--chrome requires a value");
      chromePath = value;
      index += 1;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    throw new Error(`unknown_arg:${arg}`);
  }

  return {
    serverBase: normalizedServerBase(serverBase),
    outDir: path.resolve(outDir),
    chromePath,
    json,
  };
}

function normalizedServerBase(value: string) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function pathExists(candidate: string) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function resolveChromePath(explicitPath?: string) {
  if (explicitPath) {
    if (!(await pathExists(explicitPath))) throw new Error(`chrome_not_found:${explicitPath}`);
    return explicitPath;
  }

  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }

  for (const command of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [command], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }

  throw new Error("chrome_not_found:set_CHROME_PATH_or_install_chrome");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`request_failed:${response.status}:${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

async function waitForDevtoolsPort(profileDir: string, chrome: ChildProcess) {
  const activePortFile = path.join(profileDir, "DevToolsActivePort");
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    if (chrome.exitCode !== null) throw new Error(`chrome_exited:${chrome.exitCode}`);
    try {
      const [port] = (await fs.readFile(activePortFile, "utf8")).trim().split("\n");
      if (port) return Number(port);
    } catch {
      await delay(100);
    }
  }
  throw new Error("chrome_devtools_timeout");
}

class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, {
    readonly resolve: (value: unknown) => void;
    readonly reject: (error: Error) => void;
  }>();

  private constructor(private readonly ws: WebSocket) {
    this.ws.addEventListener("message", (event) => this.onMessage(event));
    this.ws.addEventListener("error", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("cdp_websocket_error"));
      this.pending.clear();
    });
  }

  static async connect(url: string) {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("cdp_connect_timeout")), 10_000);
      ws.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      ws.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("cdp_connect_error"));
      }, { once: true });
    });
    return new CdpClient(ws);
  }

  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId;
    this.nextId += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
  }

  close() {
    this.ws.close();
  }

  private onMessage(event: MessageEvent) {
    const message = JSON.parse(String(event.data)) as CdpResponse;
    if (message.id === undefined) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message || `cdp_error:${message.error.code || "unknown"}`));
      return;
    }
    pending.resolve(message.result);
  }
}

async function evaluate<T>(client: CdpClient, expression: string): Promise<T> {
  const response = await client.send<{
    readonly result?: {
      readonly value?: unknown;
      readonly description?: string;
    };
    readonly exceptionDetails?: {
      readonly text?: string;
    };
  }>("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "runtime_evaluate_failed");
  return response.result?.value as T;
}

function watchBoardMetricExpression() {
  return `(() => {
    const watch = document.querySelector(".agent-player-watch");
    const text = watch?.textContent || "";
    const lights = [...document.querySelectorAll(".agent-player-watch-lights span")].map((node) => ({
      text: node.textContent?.replace(/\\s+/g, " ").trim() || "",
      width: Math.round(node.getBoundingClientRect().width),
      height: Math.round(node.getBoundingClientRect().height),
    }));
    const scrollWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
    return {
      watchVisible: Boolean(watch && watch.getBoundingClientRect().width > 0 && watch.getBoundingClientRect().height > 0),
      hasLiveInstall: text.includes("live_lightweight"),
      hasPackageHash: /sha256 [a-f0-9]{12}/.test(text),
      scrollWidth,
      viewportWidth: window.innerWidth,
      overflow: scrollWidth > window.innerWidth,
      lights,
    };
  })()`;
}

function assertWatchBoardMetric(spec: ViewportSpec, metric: WatchBoardMetric) {
  if (!metric.watchVisible) throw new Error(`${spec.name}:watch_board_not_visible`);
  if (!metric.hasLiveInstall) throw new Error(`${spec.name}:live_lightweight_missing`);
  if (!metric.hasPackageHash) throw new Error(`${spec.name}:package_hash_missing`);
  if (metric.overflow) throw new Error(`${spec.name}:horizontal_overflow:${metric.scrollWidth}>${metric.viewportWidth}`);
  if (metric.lights.length < 5) throw new Error(`${spec.name}:status_lights_missing:${metric.lights.length}`);
}

async function waitForWatchBoardMetric(client: CdpClient, spec: ViewportSpec) {
  const startedAt = Date.now();
  let latest: WatchBoardMetric | null = null;
  while (Date.now() - startedAt < 10_000) {
    latest = await evaluate<WatchBoardMetric>(client, watchBoardMetricExpression());
    if (latest.watchVisible && latest.hasLiveInstall && latest.hasPackageHash && !latest.overflow) return latest;
    await delay(250);
  }
  if (latest) assertWatchBoardMetric(spec, latest);
  throw new Error(`${spec.name}:watch_board_timeout`);
}

async function captureViewport(client: CdpClient, spec: ViewportSpec, outDir: string): Promise<ViewportResult> {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: spec.width,
    height: spec.height,
    deviceScaleFactor: 1,
    mobile: spec.mobile,
  });
  await delay(250);
  const metric = await waitForWatchBoardMetric(client, spec);
  assertWatchBoardMetric(spec, metric);
  const screenshot = await client.send<{ readonly data?: string }>("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  if (!screenshot.data) throw new Error(`${spec.name}:screenshot_missing`);
  const screenshotPath = path.join(outDir, spec.screenshotName);
  await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  return { name: spec.name, screenshotPath, ...metric };
}

async function runVisualQa(options: CliOptions): Promise<VisualQaResult> {
  const installStatusUrl = new URL("/api/epoch/install-status", options.serverBase).toString();
  const installStatus = await fetchJson<{ readonly ok: boolean; readonly truthLevel?: string }>(installStatusUrl);
  if (!installStatus.ok || installStatus.truthLevel !== "live_lightweight") {
    throw new Error(`install_status_not_live:${installStatus.truthLevel || "unknown"}`);
  }

  await fs.mkdir(options.outDir, { recursive: true });
  const chromePath = await resolveChromePath(options.chromePath);
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-epoch-visual-qa-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  try {
    const port = await waitForDevtoolsPort(profileDir, chrome);
    const consoleUrl = new URL("/epoch/console/?agent=1", options.serverBase).toString();
    const target = await fetchJson<TargetInfo>(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(consoleUrl)}`,
      { method: "PUT" },
    );
    if (!target.webSocketDebuggerUrl) throw new Error("chrome_target_websocket_missing");
    const client = await CdpClient.connect(target.webSocketDebuggerUrl);
    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await delay(500);
      const results: ViewportResult[] = [];
      for (const spec of VIEWPORTS) results.push(await captureViewport(client, spec, options.outDir));
      return {
        ok: true,
        serverBase: options.serverBase,
        installTruthLevel: installStatus.truthLevel,
        results,
      };
    } finally {
      client.close();
    }
  } finally {
    chrome.kill();
    await fs.rm(profileDir, { recursive: true, force: true });
  }
}

function printResult(result: VisualQaResult, json: boolean) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Agent Console visual QA passed for ${result.serverBase}`);
  for (const viewport of result.results) {
    console.log(`- ${viewport.name}: ${viewport.viewportWidth}px viewport, scrollWidth=${viewport.scrollWidth}, screenshot=${viewport.screenshotPath}`);
  }
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    printResult(await runVisualQa(parseArgs(process.argv.slice(2))), process.argv.includes("--json"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { runVisualQa };
