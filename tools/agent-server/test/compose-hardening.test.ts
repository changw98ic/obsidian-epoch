import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const composeFile = path.resolve(import.meta.dirname, "../deploy/docker-compose.yml");
const dockerfile = path.resolve(import.meta.dirname, "../deploy/Dockerfile");
const dockerignore = path.resolve(import.meta.dirname, "../../../.dockerignore");
const systemdBackupService = path.resolve(import.meta.dirname, "../deploy/systemd/obsidian-epoch-backup.service");
const cronBackup = path.resolve(import.meta.dirname, "../deploy/cron/obsidian-epoch-backup.cron");

const composeEnv: NodeJS.ProcessEnv = {
  ...process.env,
  SOURCE_DATE_EPOCH: "1780806923",
  AGENT_IMAGE_REGISTRY: "registry.example.test/obsidian-epoch",
  AGENT_IMAGE_VERSION: "0.1.0-alpha",
  AGENT_IMAGE_REVISION: "a".repeat(40),
  AGENT_IMAGE_SOURCE: "https://git.example.test/obsidian-epoch",
  AGENT_PUBLIC_SERVER_BASE: "https://epoch.example.test",
  AGENT_PUBLIC_HOST: "epoch.example.test",
  AGENT_SERVER_ALLOWED_ORIGINS: "https://epoch.example.test",
  AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL: "https://cdn.example.test/obsidian-epoch/assets/media",
  AGENT_SERVER_OPERATOR_KEY_FILE: "/tmp/operator-key.txt",
  AGENT_SERVER_MCP_BEARER_TOKEN_FILE: "/tmp/mcp-bearer-token.txt",
  AGENT_SERVER_REGISTRATION_SECRET_FILE: "/tmp/registration-secret.txt",
  AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET_FILE: "/tmp/actor-hash-secret.txt",
  AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS: "1",
  AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM_FILE: "/tmp/package-signing-key.pem",
  AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM_FILE: "/tmp/runtime-action-signing-key.pem",
  AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS_FILE: "/tmp/runtime-action-verification-public-keys.json",
  AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_FILE: "/tmp/independent-backup-signing-key.pem",
  AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE: "/tmp/independent-backup-public-key.txt",
  AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE: "/tmp/independent-backup-checkpoint.json",
  AGENT_SERVER_CPU_LIMIT: "1.5",
  AGENT_SERVER_MEMORY_LIMIT: "768m",
  AGENT_SERVER_PIDS_LIMIT: "192",
  AGENT_SERVER_TMPFS_SIZE: "48m",
  AGENT_SERVER_SHUTDOWN_TIMEOUT_MS: "12000",
  AGENT_SERVER_STOP_GRACE_PERIOD: "18s",
  AGENT_CADDY_CPU_LIMIT: "0.4",
  AGENT_CADDY_MEMORY_LIMIT: "192m",
  AGENT_CADDY_PIDS_LIMIT: "96",
  AGENT_CADDY_TMPFS_SIZE: "24m",
};

test("compose renders constrained application, operations, and Caddy services", () => {
  const result = spawnSync("docker", [
    "compose",
    "--file",
    composeFile,
    "--profile",
    "public",
    "--profile",
    "operations",
    "config",
    "--format",
    "json",
  ], {
    encoding: "utf8",
    env: composeEnv,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const config = JSON.parse(result.stdout) as {
    readonly services: Record<string, Record<string, unknown>>;
  };
  const app = config.services["obsidian-epoch-agent-server"];
  const backup = config.services["obsidian-epoch-backup"];
  const restore = config.services["obsidian-epoch-restore"];
  const caddy = config.services["obsidian-epoch-caddy"];
  assert.ok(app);
  assert.ok(backup);
  assert.ok(restore);
  assert.ok(caddy);
  assert.equal(backup.image, app.image);
  assert.equal(restore.image, app.image);

  assert.equal(app.init, true);
  assert.equal(app.read_only, true);
  assert.deepEqual(app.cap_drop, ["ALL"]);
  assert.deepEqual(app.security_opt, ["no-new-privileges:true"]);
  assert.equal(app.pids_limit, 192);
  assert.equal(app.cpus, 1.5);
  assert.equal(app.mem_limit, "805306368");
  assert.equal(app.stop_signal, "SIGTERM");
  assert.equal(app.stop_grace_period, "18s");
  const environment = app.environment as Record<string, string>;
  assert.equal(environment.AGENT_SERVER_SHUTDOWN_TIMEOUT_MS, "12000");
  for (const inlineSecret of [
    "AGENT_SERVER_OPERATOR_KEY",
    "AGENT_SERVER_MCP_BEARER_TOKEN",
    "AGENT_SERVER_REGISTRATION_SECRET",
    "AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET",
    "AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM",
    "AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM",
    "AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS",
    "AGENT_SERVER_REGISTRATION_INVITES",
    "AGENT_SERVER_ATTESTED_RUNNER_SECRET",
    "AGENT_SERVER_ATTESTED_RUNNERS",
  ]) {
    assert.equal(environment[inlineSecret], undefined);
  }
  assert.equal(environment.AGENT_SERVER_OPERATOR_KEY_FILE, "/run/secrets/obsidian_epoch_operator_key");
  assert.equal(environment.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM_FILE, "/run/secrets/obsidian_epoch_package_signing_private_key");
  assert.equal(environment.AGENT_RUNTIME_ACTION_SIGNING_PRIVATE_KEY_PEM_FILE,
    "/run/secrets/obsidian_epoch_runtime_action_signing_private_key");
  assert.equal(environment.AGENT_RUNTIME_ACTION_VERIFICATION_PUBLIC_KEYS_FILE,
    "/run/secrets/obsidian_epoch_runtime_action_verification_public_keys");
  assert.ok((app.secrets as readonly { readonly target: string }[]).some((secret) =>
    secret.target === "obsidian_epoch_runtime_action_verification_public_keys"));
  assert.equal(environment.AGENT_SERVER_REGISTRATION_INVITES_FILE, "/run/secrets/obsidian_epoch_registration_invites");
  assert.equal(environment.AGENT_SERVER_ATTESTED_RUNNERS_FILE, "/run/secrets/obsidian_epoch_attested_runners");

  const tmpfs = app.tmpfs as readonly string[];
  assert.ok(tmpfs.some((entry) => (
    entry.startsWith("/tmp:")
    && entry.includes("rw")
    && entry.includes("noexec")
    && entry.includes("nosuid")
    && entry.includes("nodev")
    && entry.includes("size=48m")
  )), JSON.stringify(tmpfs));

  const volumes = app.volumes as readonly {
    readonly type: string;
    readonly source: string;
    readonly target: string;
    readonly read_only?: boolean;
  }[];
  const dataVolume = volumes.find((volume) => volume.target === "/data");
  assert.ok(dataVolume);
  assert.equal(dataVolume.type, "volume");
  assert.match(dataVolume.source, /obsidian_epoch_data$/);
  assert.notEqual(dataVolume.read_only, true);

  for (const operation of [backup, restore]) {
    assert.equal(operation.init, true);
    assert.equal(operation.restart, "no");
    assert.equal(operation.network_mode, "none");
    assert.equal(operation.read_only, true);
    assert.deepEqual(operation.cap_drop, ["ALL"]);
    assert.deepEqual(operation.security_opt, ["no-new-privileges:true"]);
    assert.deepEqual(operation.profiles, ["operations"]);
  }

  assert.equal(caddy.read_only, true);
  assert.equal(caddy.user, "65532:65532");
  assert.deepEqual(caddy.cap_drop, ["ALL"]);
  assert.deepEqual(caddy.cap_add, ["NET_BIND_SERVICE"]);
  assert.deepEqual(caddy.security_opt, ["no-new-privileges:true"]);
  assert.equal(caddy.pids_limit, 96);
  assert.equal(caddy.cpus, 0.4);
  assert.equal(caddy.mem_limit, "201326592");
  assert.ok((caddy.tmpfs as readonly string[]).some((entry) => entry.includes("size=24m")));

  const backupVolumes = backup.volumes as readonly {
    readonly type: string;
    readonly source: string;
    readonly target: string;
    readonly read_only?: boolean;
  }[];
  const backupDataVolume = backupVolumes.find((volume) => volume.target === "/data");
  const backupOutputVolume = backupVolumes.find((volume) => volume.target === "/backups");
  assert.ok(backupDataVolume);
  assert.ok(backupOutputVolume);
  assert.match(backupDataVolume.source, /obsidian_epoch_data$/);
  assert.match(backupOutputVolume.source, /obsidian_epoch_backups$/);
  assert.notEqual(backupDataVolume.source, backupOutputVolume.source);
  assert.notEqual(backupDataVolume.read_only, true);
  assert.notEqual(backupOutputVolume.read_only, true);
  assert.match(JSON.stringify(backup.command), /tools\/agent-server\/backup\.ts/);
  assert.match(JSON.stringify(backup.command), /--backup-root.*\/backups/);
  assert.match(JSON.stringify(backup.command), /--sqlite-only/);
  assert.match(JSON.stringify(backup.command), /--require-signature/);
  const backupEnvironment = backup.environment as Record<string, string>;
  const restoreEnvironment = restore.environment as Record<string, string>;
  assert.equal(backupEnvironment.AGENT_SERVER_BACKUP_SIGNATURE_REQUIRED, "1");
  assert.equal(restoreEnvironment.AGENT_SERVER_BACKUP_SIGNATURE_REQUIRED, "1");
  assert.equal(restoreEnvironment.AGENT_SERVER_BACKUP_REPLAY_PROTECTION_REQUIRED, "1");
  assert.equal(restoreEnvironment.AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE, "/run/secrets/obsidian_epoch_backup_trusted_checkpoint");
  assert.equal(app.environment && (app.environment as Record<string, string>).AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_FILE, undefined);
  assert.equal(restoreEnvironment.AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_FILE, undefined);
  assert.equal(backupEnvironment.AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE, "/run/secrets/obsidian_epoch_backup_verification_public_key");

  const restoreVolumes = restore.volumes as readonly {
    readonly type: string;
    readonly source: string;
    readonly target: string;
    readonly read_only?: boolean;
  }[];
  const restoreInputVolume = restoreVolumes.find((volume) => volume.target === "/backups");
  const restoreOutputVolume = restoreVolumes.find((volume) => volume.target === "/restore");
  assert.ok(restoreInputVolume);
  assert.ok(restoreOutputVolume);
  assert.match(restoreInputVolume.source, /obsidian_epoch_backups$/);
  assert.equal(restoreInputVolume.read_only, true);
  assert.match(restoreOutputVolume.source, /obsidian_epoch_restore$/);
  assert.notEqual(restoreInputVolume.source, restoreOutputVolume.source);
  assert.equal(restoreVolumes.some((volume) => volume.target === "/data"), false);
  assert.match(JSON.stringify(restore.command), /tools\/agent-server\/restore-backup\.ts/);

  const dockerfileSource = readFileSync(dockerfile, "utf8");
  const dockerignoreSource = readFileSync(dockerignore, "utf8");
  assert.match(dockerfileSource, /COPY --chown=65532:65532 tools\/agent-server\/backup\.ts/);
  assert.match(dockerfileSource, /COPY --chown=65532:65532 tools\/agent-server\/restore-backup\.ts/);
  assert.match(dockerignoreSource, /!tools\/agent-server\/backup\.ts/);
  assert.match(dockerignoreSource, /!tools\/agent-server\/restore-backup\.ts/);
  const systemdSource = readFileSync(systemdBackupService, "utf8");
  const cronSource = readFileSync(cronBackup, "utf8");
  assert.doesNotMatch(systemdSource, /--backup-root \/data(?:\/|\s)/);
  assert.doesNotMatch(cronSource, /--backup-root \/data(?:\/|\s)/);

  const ports = caddy.ports as readonly { readonly target: number; readonly published: string }[];
  assert.ok(ports.some((port) => port.target === 80 && String(port.published) === "80"));
  assert.ok(ports.some((port) => port.target === 443 && String(port.published) === "443"));
});
