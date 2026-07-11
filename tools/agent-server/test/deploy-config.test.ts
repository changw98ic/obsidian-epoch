import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const deployDir = path.resolve(import.meta.dirname, "../deploy");
const graphAppDir = path.resolve(import.meta.dirname, "../../graph-react-app");

async function readDeployFile(...segments: string[]) {
  return readFile(path.join(deployDir, ...segments), "utf8");
}

async function readOptionalRepoFile(...segments: string[]) {
  try {
    return await readFile(path.join(repoRoot, ...segments), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

test("public deployment config ships Docker, Compose, env example, and operator docs", async () => {
  const dockerfile = await readDeployFile("Dockerfile");
  const caddyDockerfile = await readDeployFile("Dockerfile.caddy");
  const caddyHealthcheck = await readDeployFile("caddy-healthcheck.go");
  const compose = await readDeployFile("docker-compose.yml");
  const caddyfile = await readDeployFile("Caddyfile");
  const envExample = await readDeployFile(".env.example");
  const readme = await readDeployFile("README.md");
  const packageJson = JSON.parse(await readFile(path.join(graphAppDir, "package.json"), "utf8"));

  assert.match(packageJson.scripts["check:repository-import"], /check-repository-import\.ts/);
  assert.match(packageJson.scripts["check:asset-manifest"], /object-storage-manifest\.ts --check/);
  assert.match(packageJson.scripts["asset:manifest:verify-local"], /--verify-local/);
  assert.match(packageJson.scripts["asset:manifest:verify-remote"], /--verify-remote/);
  assert.match(packageJson.scripts["check:release-source"], /verify-release-source\.ts/);
  assert.match(packageJson.scripts.typecheck, /check:repository-import/);
  assert.match(packageJson.scripts.typecheck, /check:asset-manifest/);

  assert.match(dockerfile, /FROM node:24-bookworm-slim@sha256:[a-f0-9]{64} AS web-build/);
  assert.match(dockerfile, /FROM gcr\.io\/distroless\/nodejs24-debian13:nonroot@sha256:[a-f0-9]{64} AS runtime/);
  assert.match(readme, /uses `node:24-bookworm-slim` only for the frontend build/);
  assert.match(readme, /runs on `gcr\.io\/distroless\/nodejs24-debian13:nonroot`/);
  assert.match(readme, /builds Caddy 2\.11\.4 with the pinned `golang:1\.26\.5-alpine` builder/);
  assert.doesNotMatch(readme, /caddy:2\.10-alpine/);
  assert.match(dockerfile, /org\.opencontainers\.image\.version/);
  assert.match(dockerfile, /org\.opencontainers\.image\.revision/);
  assert.match(dockerfile, /org\.opencontainers\.image\.source/);
  assert.match(dockerfile, /org\.opencontainers\.image\.base\.name="gcr\.io\/distroless\/nodejs24-debian13:nonroot"/);
  assert.match(dockerfile, /org\.opencontainers\.image\.base\.digest="sha256:[a-f0-9]{64}"/);
  assert.match(dockerfile, /ENV SOURCE_DATE_EPOCH=\$\{SOURCE_DATE_EPOCH\}/);
  assert.match(dockerfile, /^ARG SOURCE_DATE_EPOCH$/m);
  assert.match(dockerfile, /^ARG OCI_IMAGE_VERSION$/m);
  assert.match(dockerfile, /^ARG OCI_IMAGE_REVISION$/m);
  assert.doesNotMatch(dockerfile, /^ARG (?:SOURCE_DATE_EPOCH|OCI_IMAGE_VERSION|OCI_IMAGE_REVISION)=/m);
  assert.match(dockerfile, /test "\$\{#OCI_IMAGE_REVISION\}" -eq 40/);
  assert.match(dockerfile, /AGENT_SERVER_HOST=0\.0\.0\.0/);
  assert.match(dockerfile, /^RUN mkdir -p \/runtime-dirs\/data \/runtime-dirs\/backups \/runtime-dirs\/restore$/m);
  assert.match(dockerfile, /^WORKDIR \/app$/m);
  assert.match(dockerfile, /^USER 65532:65532$/m);
  assert.match(dockerfile, /^ENTRYPOINT \["\/nodejs\/bin\/node"\]$/m);
  assert.match(dockerfile, /^CMD \["tools\/agent-server\/server\.ts"\]$/m);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /\/api\/health/);
  assert.match(dockerfile, /^COPY tools\/graph-react-app \.\/tools\/graph-react-app$/m);
  assert.match(dockerfile, /^COPY 00_总览\/world-map-data\.json \.\/00_总览\/world-map-data\.json$/m);
  assert.match(dockerfile, /^RUN cd tools\/graph-react-app && npm run build:container$/m);
  assert.match(dockerfile, /^COPY --from=web-build --chown=65532:65532 \/build\/00_总览\/黑曜纪元3D世界地图\.html \.\/00_总览\/黑曜纪元3D世界地图\.html$/m);
  assert.match(dockerfile, /^COPY --from=web-build --chown=65532:65532 \/build\/00_总览\/assets \.\/00_总览\/assets$/m);
  assert.match(dockerfile, /^COPY --from=web-build --chown=65532:65532 \/build\/00_总览\/data \.\/00_总览\/data$/m);
  assert.doesNotMatch(dockerfile, /^COPY \[?"?00_总览\/黑曜纪元3D世界地图\.html/m);
  assert.doesNotMatch(dockerfile, /^COPY 00_总览\/assets\/index-/m);
  assert.doesNotMatch(dockerfile, /COPY\s+00_总览\/assets\/media\b/);
  assert.equal(packageJson.scripts["build:container"], "vite build && tsx scripts/copy-data.ts --skip-media");
  assert.equal(
    packageJson.scripts["agent:container-lifecycle-gate"],
    "node --import tsx ../agent-server/container-lifecycle-gate.ts",
  );
  assert.equal(
    packageJson.scripts["agent:caddy-container-gate"],
    "node --import tsx ../agent-server/caddy-container-gate.ts",
  );

  assert.match(compose, /obsidian-epoch-agent-server/);
  assert.match(compose, /127\.0\.0\.1:8787:8787/);
  assert.match(compose, /obsidian-epoch-caddy/);
  assert.match(compose, /image: \$\{AGENT_IMAGE_REGISTRY:\?set image registry\}\/obsidian-epoch-agent-server:\$\{AGENT_IMAGE_VERSION:\?set immutable release version\}/);
  assert.match(compose, /SOURCE_DATE_EPOCH: \$\{SOURCE_DATE_EPOCH:\?set immutable release epoch/);
  assert.match(compose, /OCI_IMAGE_VERSION: \$\{AGENT_IMAGE_VERSION:\?set immutable release version\}/);
  assert.match(compose, /OCI_IMAGE_REVISION: \$\{AGENT_IMAGE_REVISION:\?set full release commit sha\}/);
  assert.match(compose, /OCI_IMAGE_SOURCE: \$\{AGENT_IMAGE_SOURCE:\?set canonical source repository URL\}/);
  assert.match(compose, /image: \$\{AGENT_IMAGE_REGISTRY:\?set image registry\}\/obsidian-epoch-caddy:\$\{AGENT_IMAGE_VERSION:\?set immutable release version\}/);
  assert.match(compose, /profiles: \["public"\]/);
  assert.match(compose, /443:443\/udp/);
  assert.match(compose, /\/usr\/bin\/caddy-healthcheck/);
  assert.match(caddyDockerfile, /FROM golang:1\.26\.5-alpine@sha256:[a-f0-9]{64} AS build/);
  assert.match(caddyDockerfile, /github\.com\/caddyserver\/caddy\/v2\/cmd\/caddy@\$\{CADDY_VERSION\}/);
  assert.match(caddyDockerfile, /FROM gcr\.io\/distroless\/static-debian13:nonroot@sha256:[a-f0-9]{64}/);
  assert.match(caddyDockerfile, /^USER 65532:65532$/m);
  assert.match(caddyDockerfile, /CMD \["\/usr\/bin\/caddy-healthcheck"\]/);
  assert.match(caddyHealthcheck, /RootCAs: rootCertificates/);
  assert.match(caddyHealthcheck, /https:\/\/127\.0\.0\.1\/api\/health/);
  assert.match(compose, /AGENT_PUBLIC_HOST/);
  assert.doesNotMatch(compose, /\.env\.example/);
  assert.doesNotMatch(compose, /env_file:/);
  assert.doesNotMatch(compose, /\$\{AGENT_SERVER_ALLOWED_ORIGINS:-/);
  assert.match(compose, /\$\{AGENT_PUBLIC_SERVER_BASE:\?set canonical HTTPS server origin\}/);
  assert.match(compose, /\$\{AGENT_SERVER_ALLOWED_ORIGINS:\?set exact HTTPS production origin\}/);
  assert.match(compose, /\$\{AGENT_SERVER_OPERATOR_KEY_FILE:\?set path to operator key file\}/);
  assert.match(compose, /\$\{AGENT_SERVER_MCP_BEARER_TOKEN_FILE:\?set path to MCP bearer token file\}/);
  assert.match(compose, /AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH/);
  assert.match(compose, /AGENT_SERVER_MCP_PLAYER_TOKEN_TTL_SECONDS/);
  assert.match(compose, /fetch\('http:\/\/127\.0\.0\.1:8787\/api\/health'\)/);
  assert.match(compose, /process\.exit\(response\.ok \? 0 : 1\)/);
  assert.match(compose, /\$\{AGENT_SERVER_REGISTRATION_SECRET_FILE:\?set path to registration HMAC secret file\}/);
  assert.match(compose, /\$\{AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET_FILE:\?set path to actor hash secret file\}/);
  assert.match(compose, /\$\{AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS:\?set exact trusted proxy hop count\}/);
  assert.match(compose, /AGENT_SERVER_PUBLIC_REGISTRATION_MODE: enforce/);
  assert.match(compose, /AGENT_SERVER_STORE: sqlite/);
  assert.match(compose, /AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL/);
  assert.match(compose, /AGENT_SERVER_MAINTENANCE_ENABLED/);
  assert.match(compose, /AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_REGION_IDS/);
  assert.match(compose, /AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT/);
  assert.match(compose, /AGENT_SERVER_MAINTENANCE_SEASON_REGION_IDS/);
  assert.match(compose, /AGENT_SERVER_MAINTENANCE_SEASON_SETTLEMENT_LIMIT/);
  assert.match(compose, /AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT/);
  assert.match(compose, /AGENT_SERVER_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT/);
  assert.match(compose, /AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM_FILE/);
  assert.doesNotMatch(compose, /AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM:/);
  assert.match(compose, /\$\{AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM_FILE:\?set path to package signing private key file\}/);
  assert.match(compose, /AGENT_SERVER_ATTESTED_RUNNERS_FILE: \/run\/secrets\/obsidian_epoch_attested_runners/);
  assert.match(compose, /AGENT_SERVER_REGISTRATION_INVITES_FILE: \/run\/secrets\/obsidian_epoch_registration_invites/);
  assert.match(compose, /AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE: \/run\/secrets\/obsidian_epoch_backup_trusted_checkpoint/);
  assert.match(compose, /obsidian_epoch_data/);

  assert.match(envExample, /AGENT_PUBLIC_SERVER_BASE=https:\/\/your-domain\.example/);
  assert.match(envExample, /AGENT_IMAGE_REGISTRY=/);
  assert.match(envExample, /AGENT_IMAGE_VERSION=0\.1\.0-alpha/);
  assert.match(envExample, /AGENT_IMAGE_REVISION=/);
  assert.match(envExample, /AGENT_IMAGE_SOURCE=/);
  assert.match(envExample, /SOURCE_DATE_EPOCH=/);
  assert.match(envExample, /AGENT_RELEASE_IMAGE_DIGEST=/);
  assert.match(envExample, /AGENT_RELEASE_IMAGE_REFERENCE=/);
  assert.match(envExample, /AGENT_PUBLIC_HOST=your-domain\.example/);
  assert.match(envExample, /AGENT_SERVER_ALLOWED_ORIGINS=https:\/\/your-domain\.example/);
  assert.match(envExample, /AGENT_SERVER_SQLITE_PATH=\/data\/agent-world\.sqlite/);
  assert.match(envExample, /AGENT_SERVER_BACKUP_DIR=\/backups/);
  assert.match(envExample, /AGENT_SERVER_BACKUP_KEEP_LAST=14/);
  assert.match(envExample, /AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL=https:\/\/cdn\.your-domain\.example\/obsidian-epoch\/assets\/media/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_ENABLED=1/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_INTERVAL_MS=900000/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_REGION_IDS=/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_LIMIT=0/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT=0/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_SEASON_REGION_IDS=/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_SEASON_LIMIT=0/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_SEASON_KEY=/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_SEASON_SETTLEMENT_LIMIT=0/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT=0/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_AMOUNT=1/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_MIN_AGE_SECONDS=604800/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT=0/);
  assert.match(envExample, /AGENT_SERVER_MAINTENANCE_RUN_ON_START=1/);
  assert.match(envExample, /AGENT_SERVER_MCP_BEARER_TOKEN_FILE=/);
  assert.match(envExample, /AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH=\/data\/player-mcp-access-tokens\.jsonl/);
  assert.match(envExample, /AGENT_SERVER_MCP_PLAYER_TOKEN_TTL_SECONDS=43200/);
  assert.match(envExample, /AGENT_SERVER_REGISTRATION_SECRET_FILE=/);
  assert.match(envExample, /AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET_FILE=/);
  assert.match(envExample, /AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS=1/);
  assert.match(envExample, /AGENT_SERVER_PUBLIC_REGISTRATION_MODE=enforce/);
  assert.match(envExample, /AGENT_SERVER_REGISTRATION_MAX_ACTIONS=8/);
  assert.match(envExample, /AGENT_SERVER_ATTESTED_RUNNERS_FILE=/);
  assert.match(envExample, /AGENT_SERVER_REGISTRATION_INVITES_FILE=/);
  assert.match(envExample, /AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE=/);
  assert.match(envExample, /AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM_FILE=/);
  assert.doesNotMatch(envExample, /AGENT_SERVER_ALLOWED_ORIGINS=\*/);

  assert.match(readme, /npm run agent:migrate:sqlite/);
  assert.match(readme, /docker compose up/);
  assert.match(readme, /docker compose --profile public up/);
  assert.match(readme, /Compose reads local `\.env` values automatically/);
  assert.match(readme, /AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL/);
  assert.match(readme, /AGENT_PUBLIC_SERVER_BASE/);
  assert.match(readme, /AGENT_WORLD_MCP_TOKEN/);
  assert.match(readme, /AGENT_SERVER_MAINTENANCE_ENABLED=1/);
  assert.match(readme, /AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_REGION_IDS=region_gray_harbor/);
  assert.match(readme, /AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT=3/);
  assert.match(readme, /AGENT_SERVER_MAINTENANCE_SEASON_REGION_IDS=region_gray_harbor/);
  assert.match(readme, /AGENT_SERVER_MAINTENANCE_SEASON_SETTLEMENT_LIMIT=3/);
  assert.match(readme, /AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT=5/);
  assert.match(readme, /AGENT_SERVER_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT=5/);
  assert.match(readme, /recovery manifest/);
  assert.match(readme, /checks\.recovery/);
  assert.match(readme, /npm run agent:recovery-drill/);
  assert.match(readme, /npm run agent:backup/);
  assert.match(readme, /npm run agent:restore-backup/);
  assert.match(readme, /auxiliary\.playerMcpAccessTokens/);
  assert.match(readme, /HTTP 503/);
  assert.match(readme, /systemd\/obsidian-epoch-backup\.timer/);
  assert.match(readme, /cron\/obsidian-epoch-backup\.cron/);
  assert.match(readme, /runbooks\/off-host-restore\.md/);
  assert.match(readme, /\/api\/epoch\/install-manifest/);
  assert.match(readme, /npm run agent:generate-signing-key/);
  assert.match(readme, /npm run agent:sign-attestation/);
  assert.match(readme, /AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM/);
  assert.match(readme, /AGENT_SERVER_ATTESTED_RUNNERS_FILE/);
  assert.match(readme, /secretFingerprint/);
  assert.match(readme, /operator_overview/);
  assert.match(readme, /--secret-file/);
  assert.match(readme, /trusted checkpoint|trusted-checkpoint|TRUSTED_CHECKPOINT/i);
  assert.match(readme, /--require-operator-signing/);
  assert.match(readme, /--expected-release-key-id/);
  assert.match(readme, /npm run agent:release-rehearsal/);
  assert.match(readme, /--operator-key/);
  assert.match(readme, /--production/);
  assert.match(readme, /SOURCE_DATE_EPOCH/);
  assert.match(readme, /docker buildx imagetools inspect/);
  assert.match(readme, /AGENT_RELEASE_IMAGE_DIGEST/);
  assert.match(readme, /--image-digest/);
  assert.match(readme, /distribution\.mode: local-template/);
  assert.match(readme, /live-rewritten/);
  assert.equal(packageJson.scripts["agent:recovery-drill"], "node --import tsx ../agent-server/recovery-drill.ts");
  assert.equal(packageJson.scripts["agent:backup"], "node --import tsx ../agent-server/backup.ts");
  assert.equal(packageJson.scripts["agent:restore-backup"], "node --import tsx ../agent-server/restore-backup.ts");
  assert.equal(packageJson.scripts["agent:release-rehearsal"], "node --import tsx ../agent-server/release-rehearsal.ts");
  assert.equal(packageJson.scripts["agent:generate-signing-key"], "node --import tsx ../agent-server/generate-signing-key.ts");
  assert.equal(packageJson.scripts["agent:sign-attestation"], "node --import tsx ../agent-server/sign-attestation.ts");

  assert.match(caddyfile, /\{\$AGENT_PUBLIC_HOST\}/);
  assert.match(caddyfile, /reverse_proxy obsidian-epoch-agent-server:8787/);
  assert.match(caddyfile, /\/api\/epoch\/package\/\*/);
  assert.match(caddyfile, /max_conns_per_host 4/);
  assert.match(caddyfile, /response_header_timeout 30s/);
  assert.match(caddyfile, /Strict-Transport-Security/);
});

test("production Docker runtime contains only server and builder-produced web artifacts", async () => {
  const dockerfile = await readDeployFile("Dockerfile");
  const runtimeStage = dockerfile.slice(dockerfile.indexOf(" AS runtime"));

  assert.match(runtimeStage, /COPY --chown=65532:65532 tools\/agent-server\/server\.ts/);
  assert.match(runtimeStage, /COPY --chown=65532:65532 tools\/agent-server\/lib/);
  assert.match(runtimeStage, /COPY --chown=65532:65532 tools\/agent-server\/package/);
  assert.match(runtimeStage, /COPY --from=web-build --chown=65532:65532 \/build\/00_总览\/assets/);
  assert.doesNotMatch(runtimeStage, /npm ci/);
  assert.doesNotMatch(runtimeStage, /node_modules/);
  assert.doesNotMatch(runtimeStage, /COPY tools\/graph-react-app/);
  assert.doesNotMatch(runtimeStage, /--import", "tsx/);
});

test("CI removes host web exports before the Docker source build", async () => {
  const workflow = await readOptionalRepoFile(".github", "workflows", "ci.yml");

  assert.ok(workflow, "CI workflow must exist");
  assert.match(workflow, /npm run build:container/);
  assert.match(workflow, /rm -f "00_总览\/黑曜纪元3D世界地图\.html"/);
  assert.match(workflow, /rm -rf "00_总览\/assets" "00_总览\/data"/);
  assert.match(workflow, /docker build[\s\S]*--file tools\/agent-server\/deploy\/Dockerfile/);
  assert.match(workflow, /--build-arg "OCI_IMAGE_REVISION=\$GITHUB_SHA"/);
  assert.match(workflow, /Verify immutable image provenance labels/);
  assert.match(workflow, /agent:container-lifecycle-gate/);
  assert.match(workflow, /agent:caddy-container-gate/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /npm run check:release-source -- --revision "\$GITHUB_SHA" --repository "\$GITHUB_SERVER_URL\/\$GITHUB_REPOSITORY"/);
  assert.match(workflow, /npm sbom --package-lock-only --sbom-format=cyclonedx/);
  assert.match(workflow, /Dockerfile\.caddy/);
  assert.match(workflow, /aquasec\/trivy@sha256:[a-f0-9]{64}/);
  assert.match(workflow, /--severity HIGH,CRITICAL --exit-code 1/);
  assert.doesNotMatch(workflow, /^\s*uses:\s+[^\s]+@v\d+/m);
  for (const action of workflow.matchAll(/^\s*uses:\s+([^\s#]+)/gm)) {
    assert.match(action[1] || "", /@[a-f0-9]{40}$/);
  }
  assert.ok(
    workflow.indexOf("Remove host-generated web artifacts") < workflow.indexOf("Build production image"),
    "host exports must be removed before Docker builds from source",
  );
});

test("production Docker context excludes local runtime ledgers and secrets", async () => {
  const dockerignore = await readOptionalRepoFile(".dockerignore");
  const dockerfile = await readDeployFile("Dockerfile");

  assert.ok(dockerignore, "root .dockerignore must exist for the production build context");
  assert.match(dockerignore, /^\*$/m);
  assert.match(dockerignore, /^!tools\/graph-react-app\/\*\*$/m);
  assert.match(dockerignore, /^!tools\/agent-server\/server\.ts$/m);
  assert.match(dockerignore, /^!tools\/agent-server\/backup\.ts$/m);
  assert.match(dockerignore, /^!tools\/agent-server\/restore-backup\.ts$/m);
  assert.match(dockerignore, /^!tools\/agent-server\/lib\/\*\*$/m);
  assert.match(dockerignore, /^!tools\/agent-server\/package\/\*\*$/m);
  assert.doesNotMatch(dockerignore, /^!00_总览\/黑曜纪元3D世界地图\.html$/m);
  assert.doesNotMatch(dockerignore, /^!00_总览\/assets(?:\/|$)/m);
  assert.match(dockerignore, /^00_总览\/assets\/media\/$/m);
  assert.match(dockerignore, /^00_总览\/assets\/media\/\*\*$/m);
  assert.doesNotMatch(dockerignore, /^!00_总览\/assets\/media\/\*\*$/m);
  assert.doesNotMatch(dockerignore, /^!00_总览\/data(?:\/|$)/m);
  assert.match(dockerignore, /^!00_总览\/world-map-data\.json$/m);
  assert.match(dockerignore, /^tools\/agent-server\/data\/$/m);
  assert.match(dockerignore, /^tools\/agent-server\/data-\*$/m);
  assert.match(dockerignore, /^tools\/agent-server\/backups\/$/m);
  assert.match(dockerignore, /^\*\*\/node_modules\/$/m);
  assert.match(dockerignore, /^\*\*\/dist\/$/m);
  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^\*\*\/\.env$/m);
  assert.match(dockerignore, /^\*\*\/\.env\.\*$/m);
  assert.match(dockerignore, /^!\*\*\/\.env\.example$/m);
  assert.match(dockerignore, /^\*\*\/\*\.sqlite$/m);
  assert.match(dockerignore, /^\*\*\/\*\.jsonl$/m);

  assert.doesNotMatch(dockerfile, /COPY\s+tools\/agent-server\/data\b/);
  assert.doesNotMatch(dockerfile, /COPY\s+\.env\b/);
  assert.doesNotMatch(dockerfile, /^COPY 00_总览\/assets/m);
  assert.doesNotMatch(dockerfile, /^COPY 00_总览\/data/m);
});

test("production Docker docs keep large media outside the image", async () => {
  const readme = await readDeployFile("README.md");

  assert.match(readme, /00_总览\/assets\/media/);
  assert.match(readme, /CDN|object storage|volume/);
  assert.match(readme, /outside the production image|outside the Docker image/);
});

test("public deployment config ships scheduled backup and off-host restore runbook artifacts", async () => {
  const systemdService = await readDeployFile("systemd", "obsidian-epoch-backup.service");
  const systemdTimer = await readDeployFile("systemd", "obsidian-epoch-backup.timer");
  const cron = await readDeployFile("cron", "obsidian-epoch-backup.cron");
  const runbook = await readDeployFile("runbooks", "off-host-restore.md");

  assert.match(systemdService, /\[Unit\]/);
  assert.match(systemdService, /Description=Obsidian Epoch backup rotation/);
  assert.match(systemdService, /User=obsidian-epoch/);
  assert.match(systemdService, /WorkingDirectory=\/opt\/obsidian-epoch\/tools\/graph-react-app/);
  assert.match(
    systemdService,
    /ExecStart=\/usr\/bin\/env npm run agent:backup -- --sqlite \/data\/agent-world\.sqlite --sqlite-only --player-mcp-tokens \/data\/player-mcp-access-tokens\.jsonl --backup-root \/var\/lib\/obsidian-epoch-backups --keep-last 14 --require-signature --json/,
  );
  assert.match(systemdService, /LoadCredential=backup-signing-private-key\.pem:\/etc\/obsidian-epoch\/backup-signing-private-key\.pem/);
  assert.match(systemdService, /LoadCredential=backup-verification-public-keys\.json:\/etc\/obsidian-epoch\/backup-verification-public-keys\.json/);
  assert.match(systemdService, /AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_FILE=%d\/backup-signing-private-key\.pem/);
  assert.match(systemdService, /ReadWritePaths=\/data \/var\/lib\/obsidian-epoch-backups/);

  assert.match(systemdTimer, /\[Timer\]/);
  assert.match(systemdTimer, /OnCalendar=\*-\*-\* 03:15:00/);
  assert.match(systemdTimer, /Persistent=true/);
  assert.match(systemdTimer, /Unit=obsidian-epoch-backup\.service/);
  assert.match(systemdTimer, /\[Install\]/);
  assert.match(systemdTimer, /WantedBy=timers\.target/);

  assert.match(cron, /MAILTO=/);
  assert.match(
    cron,
    /15 3 \* \* \* obsidian-epoch umask 077 && cd \/opt\/obsidian-epoch\/tools\/graph-react-app && AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_FILE=\/etc\/obsidian-epoch\/backup-signing-private-key\.pem AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE=\/etc\/obsidian-epoch\/backup-verification-public-keys\.json npm run agent:backup -- --sqlite \/data\/agent-world\.sqlite --sqlite-only --player-mcp-tokens \/data\/player-mcp-access-tokens\.jsonl --backup-root \/var\/lib\/obsidian-epoch-backups --keep-last 14 --require-signature --json/,
  );

  assert.match(runbook, /Off-host restore/);
  assert.match(runbook, /rsync|scp/);
  assert.match(runbook, /npm run agent:restore-backup/);
  assert.match(runbook, /--target-player-mcp-tokens/);
  assert.match(runbook, /AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH=/);
  assert.match(runbook, /AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE/);
  assert.match(runbook, /never calculate the checkpoint from the directory being restored/i);
  assert.match(runbook, /npm run agent:recovery-drill/);
  assert.match(runbook, /--target-source/);
  assert.match(runbook, /--target-sqlite/);
  assert.match(runbook, /Do not overwrite production/);
  assert.match(runbook, /AGENT_SERVER_DATA_DIR/);
  assert.match(runbook, /AGENT_SERVER_SQLITE_PATH/);
});
