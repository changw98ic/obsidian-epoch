import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isDirectEntrypoint } from "./lib/cliEntrypoint.ts";

type JsonRecord = Record<string, unknown>;

function valueAfterFlag(args: readonly string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function docker(args: readonly string[], options: { readonly allowFailure?: boolean } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`container_lifecycle_docker_failed:${args[0] || "unknown"}:${result.stderr || result.stdout}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function parseJsonOutput(output: string) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed: unknown = JSON.parse(lines[index] || "");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as JsonRecord;
    } catch {
      // Keep scanning past runtime warnings emitted before the JSON result.
    }
  }
  throw new Error(`container_lifecycle_json_output_missing:${output}`);
}

function signingMaterial() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyBase64: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  };
}

function serverEnvironment(paths?: {
  readonly dataDir: string;
  readonly sqlitePath: string;
  readonly playerTokenPath: string;
}) {
  const operatorKey = "container-lifecycle-operator-key-000000000001";
  const mcpBearerToken = "container-lifecycle-mcp-bearer-token-00000001";
  const values = {
    AGENT_PUBLIC_SERVER_BASE: "https://container-lifecycle.example.test",
    AGENT_SERVER_ALLOWED_ORIGINS: "https://container-lifecycle.example.test",
    AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL: "https://cdn.example.test/obsidian-epoch/assets/media",
    AGENT_SERVER_OPERATOR_KEY: operatorKey,
    AGENT_SERVER_MCP_BEARER_TOKEN: mcpBearerToken,
    AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH: paths?.playerTokenPath || "/data/player-mcp-access-tokens.jsonl",
    AGENT_SERVER_REGISTRATION_SECRET: "container-lifecycle-registration-secret-000001",
    AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET: "container-lifecycle-actor-hash-secret-0001",
    AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS: "0",
    AGENT_SERVER_PUBLIC_REGISTRATION_MODE: "enforce",
    AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM_FILE: "/run/secrets/package-private.pem",
    AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM_FILE: "/run/secrets/runtime-action-private.pem",
    AGENT_SERVER_MAINTENANCE_ENABLED: "1",
    AGENT_SERVER_MAINTENANCE_RUN_ON_START: "0",
    AGENT_SERVER_DATA_DIR: paths?.dataDir || "/data",
    AGENT_SERVER_SQLITE_PATH: paths?.sqlitePath || "/data/agent-world.sqlite",
  } as const;
  return { values, operatorKey, mcpBearerToken };
}

function environmentArgs(values: Readonly<Record<string, string>>) {
  return Object.entries(values).flatMap(([name, value]) => ["--env", `${name}=${value}`]);
}

function containerPort(containerName: string) {
  const output = docker(["port", containerName, "8787/tcp"]).stdout;
  const match = output.match(/(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d+)/);
  if (!match?.[1]) throw new Error(`container_lifecycle_port_missing:${output}`);
  return Number(match[1]);
}

async function waitForHealthy(containerName: string, port: number) {
  const deadline = Date.now() + 45_000;
  let last = "not_started";
  while (Date.now() < deadline) {
    const inspect = docker([
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      containerName,
    ], { allowFailure: true });
    last = inspect.stdout || inspect.stderr || `status_${inspect.status}`;
    if (last === "healthy") {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      const body = await response.json() as JsonRecord;
      if (response.status === 200 && body.ok === true) return body;
      last = `http_${response.status}`;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  const logs = docker(["logs", containerName], { allowFailure: true });
  throw new Error(`container_lifecycle_health_timeout:${last}:${logs.stderr || logs.stdout}`);
}

async function callTool(baseUrl: string, bearerToken: string, name: string, args: JsonRecord) {
  const response = await fetch(`${baseUrl}/api/epoch/mcp/tools/call`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name, arguments: args }),
  });
  const body = await response.json() as JsonRecord;
  if (response.status !== 200) {
    throw new Error(`container_lifecycle_tool_failed:${name}:${response.status}:${JSON.stringify(body)}`);
  }
  const content = Array.isArray(body.content) ? body.content[0] : undefined;
  const text = content && typeof content === "object" && "text" in content ? content.text : undefined;
  if (typeof text !== "string") return body;
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return parseJsonOutput(text);
  }
}

async function registerExplorer(baseUrl: string) {
  const challengeResponse = await fetch(`${baseUrl}/api/epoch/pairing/challenge`);
  const challenge = await challengeResponse.json() as JsonRecord;
  const setCookies = challengeResponse.headers.getSetCookie();
  const cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
  const challengeHeader = String(challenge.headerName || "x-obsidian-epoch-device-challenge");
  const challengeValue = String(challenge.challenge || "");
  assert.equal(challengeResponse.status, 200);
  assert.ok(cookie);
  assert.ok(challengeValue);
  const response = await fetch(`${baseUrl}/api/epoch/pairing/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      [challengeHeader]: challengeValue,
    },
    body: JSON.stringify({ idempotencyKey: "container-lifecycle-identity-1" }),
  });
  const body = await response.json() as JsonRecord;
  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`container_lifecycle_registration_failed:${response.status}:${JSON.stringify(body)}`);
  }
  return body;
}

function stopAndRequireCleanExit(containerName: string) {
  docker(["stop", "--time", "20", containerName]);
  const exitCode = Number(docker(["inspect", "--format", "{{.State.ExitCode}}", containerName]).stdout);
  assert.equal(exitCode, 0, `container ${containerName} exit code`);
}

function stageSecretFile(input: {
  readonly image: string;
  readonly secretVolume: string;
  readonly sourcePath: string;
  readonly targetName: string;
}) {
  docker([
    "run",
    "--rm",
    "--network=none",
    "--read-only",
    "--user",
    "0:0",
    "--security-opt=no-new-privileges:true",
    "--mount",
    `type=bind,source=${resolve(input.sourcePath)},target=/input/secret,readonly`,
    "--volume",
    `${input.secretVolume}:/run/secrets`,
    "--entrypoint",
    "/nodejs/bin/node",
    input.image,
    "--input-type=module",
    "--eval",
    `import { chmodSync, copyFileSync } from 'node:fs'; copyFileSync('/input/secret', ${JSON.stringify(`/run/secrets/${input.targetName}`)}); chmodSync(${JSON.stringify(`/run/secrets/${input.targetName}`)}, 0o444);`,
  ]);
}

function startServer(input: {
  readonly image: string;
  readonly containerName: string;
  readonly volumeMount: string;
  readonly secretVolume: string;
  readonly environment: Readonly<Record<string, string>>;
}) {
  docker([
    "run",
    "--detach",
    "--name",
    input.containerName,
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges:true",
    "--pids-limit=256",
    "--memory=1g",
    "--cpus=1",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777",
    "--publish",
    "127.0.0.1::8787",
    "--volume",
    input.volumeMount,
    "--volume",
    `${input.secretVolume}:/run/secrets:ro`,
    ...environmentArgs(input.environment),
    input.image,
  ]);
}

export async function runContainerLifecycleGate(image: string) {
  const suffix = `${process.pid}-${randomBytes(4).toString("hex")}`;
  const primaryContainer = `obsidian-epoch-gate-primary-${suffix}`;
  const restoredContainer = `obsidian-epoch-gate-restored-${suffix}`;
  const dataVolume = `obsidian-epoch-gate-data-${suffix}`;
  const backupVolume = `obsidian-epoch-gate-backup-${suffix}`;
  const restoreVolume = `obsidian-epoch-gate-restore-${suffix}`;
  const secretVolume = `obsidian-epoch-gate-secrets-${suffix}`;
  const tempDir = await mkdtemp(join(tmpdir(), "obsidian-epoch-container-gate-"));
  const packageSigning = signingMaterial();
  const runtimeActionSigning = signingMaterial();
  const backupSigning = signingMaterial();
  const backupPrivateKeyPath = join(tempDir, "backup-private.pem");
  const backupPublicKeyPath = join(tempDir, "backup-public.txt");
  const backupCheckpointPath = join(tempDir, "backup-checkpoint.json");
  const packagePrivateKeyPath = join(tempDir, "package-private.pem");
  const runtimeActionPrivateKeyPath = join(tempDir, "runtime-action-private.pem");
  await writeFile(backupPrivateKeyPath, backupSigning.privateKeyPem, { mode: 0o600 });
  await writeFile(backupPublicKeyPath, backupSigning.publicKeyBase64, { mode: 0o600 });
  await writeFile(packagePrivateKeyPath, packageSigning.privateKeyPem, { mode: 0o600 });
  await writeFile(runtimeActionPrivateKeyPath, runtimeActionSigning.privateKeyPem, { mode: 0o600 });
  const primaryServer = serverEnvironment();
  let agentId = "";
  let issuedToken = "";
  let tokenId = "";

  for (const volume of [dataVolume, backupVolume, restoreVolume, secretVolume]) docker(["volume", "create", volume]);
  try {
    for (const [sourcePath, targetName] of [
      [packagePrivateKeyPath, "package-private.pem"],
      [runtimeActionPrivateKeyPath, "runtime-action-private.pem"],
      [backupPrivateKeyPath, "backup-private.pem"],
      [backupPublicKeyPath, "backup-public.txt"],
    ] as const) {
      stageSecretFile({ image, secretVolume, sourcePath, targetName });
    }
    startServer({
      image,
      containerName: primaryContainer,
      volumeMount: `${dataVolume}:/data`,
      secretVolume,
      environment: primaryServer.values,
    });
    const primaryPort = containerPort(primaryContainer);
    const primaryHealth = await waitForHealthy(primaryContainer, primaryPort);
    assert.equal((primaryHealth.checks as JsonRecord | undefined)?.store !== undefined, true);
    const identity = await registerExplorer(`http://127.0.0.1:${primaryPort}`);
    agentId = String(identity.agentId || "");
    const explorerId = String(identity.explorerId || "");
    assert.match(agentId, /agent/);
    assert.match(explorerId, /explorer/);
    stopAndRequireCleanExit(primaryContainer);

    const tokenIssue = docker([
      "run",
      "--rm",
      "--network=none",
      "--volume",
      `${dataVolume}:/data`,
      "--entrypoint",
      "/nodejs/bin/node",
      image,
      "--input-type=module",
      "--eval",
      `import { PlayerMcpAccessTokenStore } from './tools/agent-server/lib/playerMcpAccessTokenStore.ts'; const store = await PlayerMcpAccessTokenStore.open({ jsonlPath: '/data/player-mcp-access-tokens.jsonl' }); console.log(JSON.stringify(await store.issue({ explorerId: ${JSON.stringify(explorerId)}, ttlMs: 3600000 })));`,
    ]);
    const tokenBody = parseJsonOutput(tokenIssue.stdout);
    issuedToken = String(tokenBody.bearerToken || "");
    tokenId = String((tokenBody.record as JsonRecord | undefined)?.tokenId || "");
    assert.ok(issuedToken.length >= 32);
    assert.ok(tokenId);

    const backupRun = docker([
      "run",
      "--rm",
      "--network=none",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777",
      "--volume",
      `${dataVolume}:/data`,
      "--volume",
      `${backupVolume}:/backups`,
      "--volume",
      `${secretVolume}:/run/secrets:ro`,
      "--env",
      "AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_FILE=/run/secrets/backup-private.pem",
      "--env",
      "AGENT_SERVER_BACKUP_SIGNATURE_REQUIRED=1",
      "--entrypoint",
      "/nodejs/bin/node",
      image,
      "tools/agent-server/backup.ts",
      "--sqlite",
      "/data/agent-world.sqlite",
      "--sqlite-only",
      "--player-mcp-tokens",
      "/data/player-mcp-access-tokens.jsonl",
      "--backup-root",
      "/backups",
      "--require-signature",
      "--json",
    ]);
    const backup = parseJsonOutput(backupRun.stdout);
    assert.equal(backup.ok, true);
    const backupId = String(backup.backupId || "");
    const backupSignature = backup.signature as JsonRecord | undefined;
    const backupCheckpoint = backup.checkpoint as JsonRecord | undefined;
    assert.ok(backupId);
    assert.equal(backupSignature?.algorithm, "Ed25519");
    assert.equal(backupCheckpoint?.manifestSha256, backupSignature?.manifestSha256);
    await writeFile(backupCheckpointPath, `${JSON.stringify(backupCheckpoint)}\n`, { mode: 0o600 });
    stageSecretFile({
      image,
      secretVolume,
      sourcePath: backupCheckpointPath,
      targetName: "backup-checkpoint.json",
    });

    const restoreRun = docker([
      "run",
      "--rm",
      "--network=none",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777",
      "--volume",
      `${backupVolume}:/backups:ro`,
      "--volume",
      `${restoreVolume}:/restore`,
      "--volume",
      `${secretVolume}:/run/secrets:ro`,
      "--env",
      `AGENT_SERVER_RESTORE_BACKUP=/backups/${backupId}`,
      "--env",
      "AGENT_SERVER_RESTORE_SQLITE_PATH=/restore/agent-world.sqlite",
      "--env",
      "AGENT_SERVER_RESTORE_MCP_PLAYER_TOKEN_JSONL_PATH=/restore/player-mcp-access-tokens.jsonl",
      "--env",
      "AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE=/run/secrets/backup-public.txt",
      "--env",
      "AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE=/run/secrets/backup-checkpoint.json",
      "--env",
      "AGENT_SERVER_BACKUP_SIGNATURE_REQUIRED=1",
      "--entrypoint",
      "/nodejs/bin/node",
      image,
      "tools/agent-server/restore-backup.ts",
      "--require-signature",
      "--json",
    ]);
    const restore = parseJsonOutput(restoreRun.stdout);
    assert.equal(restore.ok, true);
    assert.equal(((restore.verification as JsonRecord).signature as JsonRecord).verified, true);
    assert.equal(((restore.verification as JsonRecord).checkpoint as JsonRecord).verified, true);

    const restoredServer = serverEnvironment({
      dataDir: "/restore",
      sqlitePath: "/restore/agent-world.sqlite",
      playerTokenPath: "/restore/player-mcp-access-tokens.jsonl",
    });
    startServer({
      image,
      containerName: restoredContainer,
      volumeMount: `${restoreVolume}:/restore`,
      secretVolume,
      environment: restoredServer.values,
    });
    const restoredPort = containerPort(restoredContainer);
    await waitForHealthy(restoredContainer, restoredPort);
    const restoredIdentity = await callTool(
      `http://127.0.0.1:${restoredPort}`,
      restoredServer.mcpBearerToken,
      "obsidian_epoch.identity",
      { agentId },
    );
    assert.equal(restoredIdentity.agentId || (restoredIdentity.value as JsonRecord | undefined)?.agentId, agentId);
    const playerQuickstart = await callTool(
      `http://127.0.0.1:${restoredPort}`,
      issuedToken,
      "obsidian_epoch.quickstart",
      { host: "container-lifecycle-gate" },
    );
    assert.equal(playerQuickstart.serverName, "obsidian-epoch-agent-world");
    stopAndRequireCleanExit(restoredContainer);

    return {
      ok: true,
      image,
      agentId,
      tokenId,
      backupId,
      backupKeyId: String(backupSignature?.keyId || ""),
      signatureVerified: true,
      replayProtectionVerified: true,
      primaryExitCode: 0,
      restoredExitCode: 0,
    } as const;
  } finally {
    docker(["rm", "--force", primaryContainer], { allowFailure: true });
    docker(["rm", "--force", restoredContainer], { allowFailure: true });
    for (const volume of [dataVolume, backupVolume, restoreVolume, secretVolume]) {
      docker(["volume", "rm", "--force", volume], { allowFailure: true });
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (isDirectEntrypoint(import.meta.url)) {
  const image = valueAfterFlag(process.argv.slice(2), "--image");
  if (!image) {
    console.error("container lifecycle gate failed: --image is required");
    process.exitCode = 1;
  } else {
    runContainerLifecycleGate(image)
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`container lifecycle gate failed: ${message}`);
        process.exitCode = 1;
      });
  }
}
