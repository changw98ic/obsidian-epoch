import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { isDirectEntrypoint } from "../lib/cliEntrypoint.ts";
import { isDirectEntrypoint as isPackagedDirectEntrypoint } from "../package/obsidian-epoch/bin/cliEntrypoint.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const graphAppRoot = resolve(repoRoot, "tools/graph-react-app");

function runCli(scriptPath: string, env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
    cwd: graphAppRoot,
    encoding: "utf8",
    env,
    maxBuffer: 16 * 1024 * 1024,
  });
}

test("direct entrypoint comparison normalizes URL escapes and symlink paths", () => {
  const root = mkdtempSync(join(tmpdir(), "obsidian-entrypoint-"));
  try {
    const projectRoot = join(root, "com~apple~CloudDocs", "Project With Spaces");
    mkdirSync(projectRoot, { recursive: true });
    const entryFile = join(projectRoot, "entry.ts");
    writeFileSync(entryFile, "export {};\n", "utf8");

    const linkedProjectRoot = join(root, "linked-project");
    symlinkSync(projectRoot, linkedProjectRoot, "dir");
    const argvEntry = join(linkedProjectRoot, "entry.ts");
    const loaderUrl = pathToFileURL(entryFile).href.replaceAll("~", "%7E");

    assert.equal(isDirectEntrypoint(loaderUrl, argvEntry), true);
    assert.equal(isPackagedDirectEntrypoint(loaderUrl, argvEntry), true);
    assert.equal(isDirectEntrypoint(loaderUrl, join(root, "missing.ts")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("container lifecycle CLI executes and rejects a missing image", () => {
  const result = runCli(resolve(repoRoot, "tools/agent-server/container-lifecycle-gate.ts"));
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /container lifecycle gate failed: --image is required/);
});

test("Caddy container CLI stages its config before reaching Docker", () => {
  const fakeBin = mkdtempSync(join(tmpdir(), "obsidian-fake-docker-"));
  try {
    const fakeDocker = join(fakeBin, "docker");
    const dockerArgs = join(fakeBin, "docker-args.log");
    writeFileSync(
      fakeDocker,
      "#!/bin/sh\nprintf '%s\\n' \"$@\" >> \"$FAKE_DOCKER_ARGS\"\nprintf 'fake docker unavailable\\n' >&2\nexit 73\n",
      "utf8",
    );
    chmodSync(fakeDocker, 0o755);
    const result = runCli(resolve(repoRoot, "tools/agent-server/caddy-container-gate.ts"), {
      ...process.env,
      FAKE_DOCKER_ARGS: dockerArgs,
      PATH: `${fakeBin}${delimiter}${process.env.PATH || ""}`,
    });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /caddy_gate_docker_failed:run:fake docker unavailable/);
    const loggedArgs = readFileSync(dockerArgs, "utf8").split("\n");
    const caddyfileMount = loggedArgs.find((argument) => argument.endsWith(":/etc/caddy/Caddyfile:ro"));
    assert.ok(caddyfileMount, loggedArgs.join(" "));
    assert.match(caddyfileMount, /obsidian-caddy-gate-/);
    assert.equal(caddyfileMount.startsWith(resolve(repoRoot, "tools/agent-server/deploy/Caddyfile")), false);
  } finally {
    rmSync(fakeBin, { recursive: true, force: true });
  }
});
