import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import https from "node:https";
import { type IncomingHttpHeaders } from "node:http";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

function valueAfterFlag(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function docker(args: readonly string[], allowFailure = false) {
  const result = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`caddy_gate_docker_failed:${args[0] || "unknown"}:${result.stderr || result.stdout}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function parseJson(value: string, source: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`caddy_gate_json_invalid:${source}:${value.slice(0, 200)}`);
  }
}

function httpsRequest(port: number) {
  return new Promise<{ readonly status: number; readonly body: string; readonly headers: IncomingHttpHeaders }>((resolveRequest, rejectRequest) => {
    const request = https.get({
      host: "127.0.0.1",
      servername: "localhost",
      port,
      path: "/api/health",
      headers: { host: "localhost" },
      rejectUnauthorized: false,
      timeout: 2_000,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolveRequest({
        status: response.statusCode || 0,
        body: Buffer.concat(chunks).toString("utf8"),
        headers: response.headers,
      }));
    });
    request.on("timeout", () => request.destroy(new Error("caddy_gate_request_timeout")));
    request.on("error", rejectRequest);
  });
}

async function waitForProxy(port: number) {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await httpsRequest(port);
    } catch (error) {
      lastError = error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("caddy_gate_proxy_not_ready");
}

async function waitForHealthy(container: string) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const status = docker(["inspect", "--format", "{{.State.Health.Status}}", container], true).stdout;
    if (status === "healthy") return;
    if (status === "unhealthy") {
      const health = docker(["inspect", "--format", "{{json .State.Health}}", container], true).stdout;
      throw new Error(`caddy_gate_healthcheck_unhealthy:${health}`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("caddy_gate_healthcheck_timeout");
}

async function main() {
  const upstreamImage = valueAfterFlag("--upstream-image") || "obsidian-epoch-agent-server:enterprise-final";
  const caddyImage = valueAfterFlag("--caddy-image") || "obsidian-epoch-caddy:hardened";
  const caddyfile = resolve(valueAfterFlag("--caddyfile") || "../agent-server/deploy/Caddyfile");
  const suffix = randomBytes(6).toString("hex");
  const network = `obsidian-caddy-gate-${suffix}`;
  const upstream = `obsidian-caddy-upstream-${suffix}`;
  const proxy = `obsidian-caddy-proxy-${suffix}`;
  const dataVolume = `obsidian-caddy-data-${suffix}`;
  const configVolume = `obsidian-caddy-config-${suffix}`;
  try {
    const validation = docker([
      "run", "--rm", "--network=none", "--read-only", "--cap-drop=ALL", "--cap-add=NET_BIND_SERVICE",
      "--security-opt=no-new-privileges:true", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=32m,mode=1777",
      "--tmpfs", "/data:rw,noexec,nosuid,nodev,size=32m,mode=1777", "--tmpfs", "/config:rw,noexec,nosuid,nodev,size=8m,mode=1777",
      "--env", "AGENT_PUBLIC_HOST=localhost", "--volume", `${caddyfile}:/etc/caddy/Caddyfile:ro`,
      caddyImage, "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile",
    ]);
    assert.equal(validation.status, 0);
    docker(["network", "create", network]);
    docker(["volume", "create", dataVolume]);
    docker(["volume", "create", configVolume]);
    docker([
      "run", "--detach", "--name", upstream, "--network", network,
      "--network-alias", "obsidian-epoch-agent-server", "--read-only", "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true", "--entrypoint", "/nodejs/bin/node", upstreamImage,
      "--input-type=module", "--eval",
      "import { createServer } from 'node:http'; createServer((_, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, via: 'caddy-gate' })); }).listen(8787, '0.0.0.0');",
    ]);
    docker([
      "run", "--detach", "--name", proxy, "--network", network, "--read-only",
      "--cap-drop=ALL", "--cap-add=NET_BIND_SERVICE", "--security-opt=no-new-privileges:true",
      "--pids-limit", "128", "--cpus", "0.5", "--memory", "256m",
      "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=32m,mode=1777",
      "--env", "AGENT_PUBLIC_HOST=localhost", "--publish", "127.0.0.1::443/tcp",
      "--health-interval", "1s", "--health-timeout", "2s", "--health-retries", "10",
      "--volume", `${caddyfile}:/etc/caddy/Caddyfile:ro`,
      "--volume", `${dataVolume}:/data`, "--volume", `${configVolume}:/config`, caddyImage,
    ]);
    const portOutput = docker(["port", proxy, "443/tcp"]).stdout;
    const port = Number(portOutput.match(/:(\d+)$/)?.[1]);
    assert.ok(Number.isSafeInteger(port) && port > 0, portOutput);
    const response = await waitForProxy(port);
    await waitForHealthy(proxy);
    assert.equal(response.status, 200);
    assert.deepEqual(parseJson(response.body, "upstream_response"), { ok: true, via: "caddy-gate" });
    assert.equal(response.headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["referrer-policy"], "strict-origin-when-cross-origin");
    assert.equal(response.headers.server, undefined);
    const inspectPayload = parseJson(docker(["inspect", proxy]).stdout, "docker_inspect");
    assert.ok(Array.isArray(inspectPayload) && inspectPayload[0]);
    const inspect = inspectPayload[0] as {
      readonly Config: { readonly User: string };
      readonly HostConfig: {
        readonly ReadonlyRootfs: boolean;
        readonly CapDrop: readonly string[];
        readonly CapAdd: readonly string[];
        readonly SecurityOpt: readonly string[];
        readonly PidsLimit: number;
        readonly Memory: number;
        readonly NanoCpus: number;
      };
    };
    assert.equal(inspect.Config.User, "65532:65532");
    assert.equal(inspect.HostConfig.ReadonlyRootfs, true);
    assert.deepEqual(inspect.HostConfig.CapDrop, ["ALL"]);
    assert.deepEqual(inspect.HostConfig.CapAdd.map((capability) => capability.replace(/^CAP_/, "")), ["NET_BIND_SERVICE"]);
    assert.ok(inspect.HostConfig.SecurityOpt.some((option) => option.startsWith("no-new-privileges")));
    assert.equal(inspect.HostConfig.PidsLimit, 128);
    assert.equal(inspect.HostConfig.Memory, 256 * 1024 * 1024);
    assert.equal(inspect.HostConfig.NanoCpus, 500_000_000);
    console.log(JSON.stringify({ ok: true, image: caddyImage, upstreamImage, httpsStatus: response.status, securityHeaders: true }));
  } finally {
    docker(["rm", "--force", proxy], true);
    docker(["rm", "--force", upstream], true);
    docker(["network", "rm", network], true);
    docker(["volume", "rm", dataVolume], true);
    docker(["volume", "rm", configVolume], true);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
