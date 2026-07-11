# Obsidian Epoch Public Server Deployment

This deployment profile runs the Agent World server as a public sidecar with SQLite persistence.

## Files

- `Dockerfile`: Distroless Node 24 production container for the server plus one-shot backup and restore entrypoints.
- `Dockerfile.caddy` and `caddy-healthcheck.go`: reproducible Caddy 2.11.4 build on Go 1.26.5 with a non-root Distroless runtime and TLS-aware health probe.
- `docker-compose.yml`: local or single-host deployment with a persistent `/data` volume.
- `Caddyfile`: optional public profile with automatic HTTPS and security headers.
- `.env.example`: copy to `.env` and fill in public origin and trusted runner values.
- `systemd/obsidian-epoch-backup.service` and `systemd/obsidian-epoch-backup.timer`: daily backup rotation units for Linux hosts.
- `cron/obsidian-epoch-backup.cron`: `/etc/cron.d` backup rotation example for hosts that do not use systemd timers.
- `runbooks/off-host-restore.md`: operator checklist for restoring a copied backup on a fresh host.

## Prepare SQLite

From the repository root:

```bash
cd tools/graph-react-app
AGENT_SERVER_SQLITE_PATH=../agent-server/data/agent-world.sqlite npm run agent:migrate:sqlite
```

Set `AGENT_SERVER_SQLITE_MIGRATE_JSONL=1` only for an intentional one-time startup migration. Leave it `0` for normal production starts.

## Backup Rotation

Run backup rotation from cron, systemd timers or your deployment platform before upgrades and at the cadence your world can afford to lose:

```bash
cd tools/graph-react-app
AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_FILE=/etc/obsidian-epoch/backup-signing-private-key.pem \
AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE=/etc/obsidian-epoch/backup-verification-public-keys.json \
  npm run agent:backup -- --sqlite ../agent-server/data/agent-world.sqlite --sqlite-only --player-mcp-tokens ../agent-server/data/player-mcp-access-tokens.jsonl --backup-root /var/lib/obsidian-epoch-backups --keep-last 14 --require-signature --json
```

The backup command writes a timestamped directory under `--backup-root`, creates a read-only SQLite snapshot with `VACUUM INTO`, snapshots the separately configured player MCP token ledger as `auxiliary.playerMcpAccessTokens`, writes the immutable `recovery-backup.json` manifest and its detached `recovery-backup.signature.json`, then prunes only rotations trusted by the active backup key. Production selects one authoritative world store (`--sqlite-only` here); it never mixes a live SQLite database with stale migration JSONL. The token ledger is captured before and after the world snapshot, and the backup is rejected if it changes or references an explorer absent from the authoritative world snapshot. Backup validation is read-only and refuses an incomplete token-ledger tail instead of repairing the live source.

Every manifest file entry contains byte counts and SHA-256 hashes. The detached Ed25519 signature authenticates the exact manifest bytes with domain separation, and restore trusts only public keys supplied out-of-band. Generate a second Ed25519 keypair specifically for backups, store its `privateKeyPem` with mode `0400`, and store either its `publicKeyBase64` or a version-1 key ring such as `{"version":1,"keys":[{"keyId":"<sha256-spki>","publicKey":"<spki-base64>","status":"active"}]}` at the verification-key path. During rotation keep the old and new public keys in the ring; backup retention can then safely validate both generations. Never reuse `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM`, the operator key, or registration secrets. Send the `checkpoint` object printed by every signed backup to an audit system or immutable object-storage inventory outside the backup volume. The backup root must not be inside `AGENT_SERVER_DATA_DIR`; mount `/var/lib/obsidian-epoch-backups` or `/backups` on a separate filesystem/volume and copy completed rotations off-host.

For non-Compose Linux deployments where `/data` is a real host mount, install `systemd/obsidian-epoch-backup.service` plus `systemd/obsidian-epoch-backup.timer`, then enable the timer. The unit loads the private key through systemd credentials and creates private state at `/var/lib/obsidian-epoch-backups`; mount that path on storage independent from `/data`. SQLite's WAL snapshot may create or update its `-shm` coordination sidecar, so the job needs `/data` writable even though backup code never mutates logical world records. If the host uses cron instead, install `cron/obsidian-epoch-backup.cron` under `/etc/cron.d`, keep the referenced private-key file root-owned and mode `0400`, and pre-create `/var/lib/obsidian-epoch-backups` owned by `obsidian-epoch` with mode `0700`. These host units do not address the Docker named volume used by Compose.

For the bundled Compose deployment, run the image's one-shot backup service. It mounts the live `obsidian_epoch_data` volume at `/data` and writes only to the separate `obsidian_epoch_backups` volume:

```bash
cd tools/agent-server/deploy
docker compose --profile operations run --rm obsidian-epoch-backup
```

The separate named volume prevents backup rotation from consuming or deleting the primary data volume, but it is still on the same Docker host. Export completed backup directories to immutable off-host/object storage and alert on backup age.

## Restore Backup

Restore a backup into fresh target paths before pointing a server at it:

```bash
cd tools/graph-react-app
AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE=/etc/obsidian-epoch/backup-verification-public-keys.json \
AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE=/etc/obsidian-epoch/backup-trusted-checkpoint.json \
  npm run agent:restore-backup -- --backup /var/lib/obsidian-epoch-backups/2026-06-26T00-00-00-000Z --target-source ../agent-server/data/restored-jsonl --target-sqlite ../agent-server/data/restored-agent-world.sqlite --target-player-mcp-tokens ../agent-server/data/restored-player-mcp-access-tokens.jsonl --require-signature --require-replay-protection --json
```

The restore command verifies the detached signature with the pinned public-key ring before trusting manifest semantics, then rejects a backup older than the out-of-band trusted checkpoint before verifying files or writing targets. Never derive that checkpoint from the backup directory being restored. It stages all requested domains under sibling temporary paths, validates the restored world/token data, and publishes them only after every domain passes; a failure removes all staging and partially published targets. It refuses to overwrite an existing target JSONL directory, SQLite file, or player-token ledger. Production restores should target fresh paths, run `npm run agent:recovery-drill` against the restored world state, open the restored player-token ledger with the server during smoke testing, then update `AGENT_SERVER_DATA_DIR`, `AGENT_SERVER_SQLITE_PATH`, and `AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH` during the planned cutover.

Use `runbooks/off-host-restore.md` when rehearsing or executing a restore on a separate host. It keeps copy, restore, recovery drill and environment cutover steps explicit so an operator can prove a backup before exposing the restored server.

## Reproducible Release Inputs

Set immutable release provenance before building. `SOURCE_DATE_EPOCH` must be the release commit timestamp in whole Unix seconds; the package archiver uses it for every tar entry and rejects malformed values. When it is genuinely unset, local builds use the checked-in release revision epoch instead of filesystem mtimes.

```bash
export AGENT_IMAGE_REGISTRY=registry.example/your-team
export AGENT_IMAGE_VERSION=0.1.0-alpha
export AGENT_IMAGE_REVISION="$(git rev-parse HEAD)"
export AGENT_IMAGE_SOURCE=https://git.example/your-team/obsidian-epoch
export SOURCE_DATE_EPOCH="$(git show -s --format=%ct "$AGENT_IMAGE_REVISION")"
export AGENT_RELEASE_IMAGE_REFERENCE="$AGENT_IMAGE_REGISTRY/obsidian-epoch-agent-server:$AGENT_IMAGE_VERSION"
```

Both release images pin every base by registry digest. The application uses `node:24-bookworm-slim` only for the frontend build and runs on `gcr.io/distroless/nodejs24-debian13:nonroot`. The edge image builds Caddy 2.11.4 with the pinned `golang:1.26.5-alpine` builder and runs the resulting static binaries on `gcr.io/distroless/static-debian13:nonroot`; Compose references the project-owned edge image by the same immutable release version as the application. When an upstream base or Caddy version is intentionally upgraded, resolve and review the new digest, update its Dockerfile pin and deployment tests together, then rerun both image vulnerability gates. Never replace a release pin with a floating tag.

Compose tags the application image with the configured registry and immutable release version. The Dockerfile writes OCI title, description, version, revision, source and base-image provenance labels. Build, push, and then capture the registry-assigned immutable digest:

```bash
docker compose build --pull obsidian-epoch-agent-server
docker compose push obsidian-epoch-agent-server
export AGENT_RELEASE_IMAGE_DIGEST="$(docker buildx imagetools inspect "$AGENT_RELEASE_IMAGE_REFERENCE" | awk '/^Digest:/ {print $2; exit}')"
test -n "$AGENT_RELEASE_IMAGE_DIGEST"
```

Keep `AGENT_RELEASE_IMAGE_REFERENCE` and `AGENT_RELEASE_IMAGE_DIGEST` with the release evidence. The digest must include the `sha256:` prefix. Rebuilding with the same source, signing key, public server base and `SOURCE_DATE_EPOCH` produces the same package bytes and package sha256; a changed input is expected to produce a new digest.

Before building or rehearsing a production release, run `npm run check:release-source -- --revision "$AGENT_IMAGE_REVISION" --repository "$AGENT_IMAGE_SOURCE"` from `tools/graph-react-app`. The gate requires `HEAD` to equal the full release revision, `origin` to normalize to the canonical HTTPS source URL, the tracked and untracked working tree to be clean, and every critical Docker/CI/package-lock/world-data input to be tracked. Production `agent:release-rehearsal` executes the same gate automatically; `AGENT_RELEASE_SOURCE_WORKSPACE` may point at the repository root when the operator command runs from another directory.

## Release Signing

Generate an operator-owned Ed25519 release signing key before exposing a public install package:

```bash
cd tools/graph-react-app
npm run agent:generate-signing-key -- --json
```

Store the returned `privateKeyPem` in the deployment secret store and point `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM_FILE` at the mounted secret file; keep the returned `releaseKeyId` as the pinned production key id. Direct `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM` remains supported for local development, but Compose mounts the file as a secret so private material is absent from `docker inspect`. Do not commit the private key. Without either source, the server creates a process-ephemeral local alpha key for temporary smoke tests; no fallback private key is stored in the repository.

After deployment, require the live server to use that operator key. Production release smoke must run against the public HTTPS origin that operators and installed hosts will use; do not use `localhost`, `127.0.0.1`, a Docker service name or an internal reverse-proxy upstream as the production `serverBase`.

```bash
cd tools/graph-react-app
npm run agent:install-smoke -- --server https://your-domain.example --production --json
```

`--production` is the release-gate shorthand for remote smoke with operator signing and release-key pinning. On branches where that shorthand is not available yet, run the equivalent expanded command:

```bash
cd tools/graph-react-app
npm run agent:install-smoke -- --server https://your-domain.example --require-operator-signing --expected-release-key-id <releaseKeyId> --json
```

This production gate fails before gameplay if the live install manifest reports `local_alpha_fallback`, a missing operator key or a different `verification.packageReleaseKeyId`. It also fails before contacting the server when the local source revision, canonical `origin`, worktree cleanliness, or required tracked build inputs do not match `AGENT_IMAGE_REVISION` and `AGENT_IMAGE_SOURCE`. The process-ephemeral fallback identity is only a local alpha convenience for temporary local smoke; it is not a production trust root and changes when the server process restarts.

## Release Rehearsal

Run the release rehearsal before a public cutover or upgrade. It chains the live install smoke, operator overview, recovery drill, backup and restore proof into one JSON result:

```bash
cd tools/graph-react-app
npm run agent:release-rehearsal -- --server https://your-domain.example --operator-key "$AGENT_SERVER_OPERATOR_KEY" --json
```

For production, rehearse against the same public HTTPS origin that installers will use and pin the operator-owned release key:

```bash
cd tools/graph-react-app
npm run agent:release-rehearsal -- --server https://your-domain.example --operator-key "$AGENT_SERVER_OPERATOR_KEY" --expected-release-key-id <releaseKeyId> --image-reference "$AGENT_RELEASE_IMAGE_REFERENCE" --image-digest "$AGENT_RELEASE_IMAGE_DIGEST" --production --json
```

The production rehearsal fails if the immutable image digest is missing or malformed, or if install smoke cannot verify operator signing, the expected release key id, external console media, package integrity, public proof pages or persistent-store recovery health. Its JSON `artifacts` block records the operator-supplied registry image digest and the sha256 calculated from the live downloaded package. Treat a passing rehearsal as the final deploy gate before publishing the install URL to players.

## Implementation Boundary

Repository code implements the deterministic package archive, package integrity manifest, release signing metadata, production smoke gates, backup, restore, recovery drill and release rehearsal commands. It does not by itself complete public DNS, real HTTPS reachability, registry publication, production secret storage or a successful off-host restore on a separate machine.

Record production readiness only after the target environment supplies evidence for these external steps:

- Public DNS resolves to the intended host, and the public `AGENT_PUBLIC_SERVER_BASE` is reachable through HTTPS.
- The application image has been pushed to the configured registry and the registry-assigned immutable digest has been captured as `AGENT_RELEASE_IMAGE_DIGEST`.
- `AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM` is operator-owned, configured in the deployment secret store and verified by production smoke with the expected `releaseKeyId`.
- A backup has been copied to a fresh host or staging host, restored into fresh paths, passed `agent:recovery-drill`, started with the restored paths and passed remote install smoke at the restored public URL.

## Attested Runner

Configure attested runners only for operator-controlled hosts or remote runner services. Ordinary player MCP adapters remain untrusted clients.

```bash
AGENT_SERVER_ATTESTED_RUNNERS_FILE=/etc/obsidian-epoch/attested-runners.json
```

The runner signs the server-issued `obsidian_epoch.attestation_challenge` response before the selected hosted action is submitted:

```bash
cd tools/graph-react-app
npm run agent:sign-attestation -- --secret-file /run/secrets/attested-runner-secret --challenge-json '<challenge-json>' --json
```

Submit the returned `submitFields` plus the chosen `visibleText` to `obsidian_epoch.submit_attested_action`. The challenge is single use and expires, so replayed or modified MCP requests cannot create `host_attested` or `remote_attested_runner` settlement without the configured runner secret. Successful submissions write the runner `keyId` into attestation audit records. Operators can inspect sanitized runner state with `obsidian_epoch.operator_overview`: it exposes configured runner count, recent attestation count, runner `keyId`, `secretFingerprint`, trust class and latest attestation id, but never returns the raw secret.

## Recovery Drill

Before a cutover, backup restore or production upgrade, run the recovery drill against a copied SQLite path:

```bash
cd tools/graph-react-app
npm run agent:recovery-drill -- --source ../agent-server/data --sqlite ../agent-server/data/agent-world.recovery-drill.sqlite --json
```

The drill migrates the JSONL-compatible ledgers into the target SQLite file, compares JSONL and SQLite recovery manifest record counts and sha256 proofs, then hydrates the game runtime from SQLite and verifies that epoch events and result pages are readable. It exits non-zero if parity or hydration fails. Use a backup or candidate SQLite file for rehearsal; point `--sqlite` at production only when the operation is an intentional migration window.

## Run With Compose

```bash
cd tools/agent-server/deploy
cp .env.example .env
docker compose up --build -d
```

Compose reads local `.env` values automatically for interpolation. `.env.example` is only a template and is intentionally not loaded directly by the container; CI and hosted deploys can provide the same variables through the process environment. Compose fails closed when the image registry, version, revision, source URL or release epoch is missing.

The `operations` profile provides one-shot backup and isolated restore jobs without publishing ports or joining a network. A restore never mounts `obsidian_epoch_data`; it reads `obsidian_epoch_backups` read-only and writes into the disposable `obsidian_epoch_restore` staging volume:

```bash
# Pick a timestamped directory already present under the backup volume.
AGENT_SERVER_RESTORE_BACKUP=/backups/2026-06-26T00-00-00-000Z \
  docker compose --profile operations run --rm obsidian-epoch-restore
```

Inspect and smoke-test the staging volume before any planned cutover. Remove or rename the existing restore targets before another rehearsal because restore intentionally refuses to overwrite them.

The base profile binds the application only to `127.0.0.1:8787`. To expose the configured DNS name with automatic TLS, set `AGENT_PUBLIC_HOST` to the hostname portion of `AGENT_PUBLIC_SERVER_BASE`, point public DNS at the host, and enable the Caddy profile:

```bash
docker compose --profile public up --build -d
```

The release builds and publishes `obsidian-epoch-caddy` beside the application image. Caddy runs as UID/GID `65532`, publishes TCP 80/443 and UDP 443, stores certificate state in named volumes, and reaches the application over the internal Compose network. Its health probe verifies the loopback TLS certificate against Caddy's generated local root before checking the upstream health route. Keep the direct 8787 binding local; do not publish it on `0.0.0.0` in production.

CI runs the repository-import preflight through `npm run typecheck`, pins every reusable Action to a full commit SHA, runs `npm audit`, emits source and image CycloneDX SBOMs, and scans both release images with a digest-pinned Trivy image. The import gate considers both tracked files and non-ignored first-commit candidates, so generated media, runtime ledgers, static private keys, and oversized source sets fail before publication. Any detected high or critical runtime vulnerability fails the build; the JSON SBOMs are retained as workflow artifacts for release evidence.

### Application container hardening

The application service runs with Docker's init process, a read-only root filesystem, all Linux capabilities dropped and `no-new-privileges`. `/data` remains the only persistent writable volume. `/tmp` is a bounded, non-executable tmpfs for Node and runtime scratch files. Compose also applies PID, CPU and memory ceilings so a runaway process cannot consume the whole host.

The defaults are deliberately conservative for a single-host alpha deployment and can be tuned after load testing:

```bash
AGENT_SERVER_CPU_LIMIT=1.0
AGENT_SERVER_MEMORY_LIMIT=1g
AGENT_SERVER_PIDS_LIMIT=256
AGENT_SERVER_TMPFS_SIZE=64m
AGENT_SERVER_SHUTDOWN_TIMEOUT_MS=10000
AGENT_SERVER_STOP_GRACE_PERIOD=15s
```

`AGENT_SERVER_SHUTDOWN_TIMEOUT_MS` controls the server's own connection-drain deadline. `AGENT_SERVER_STOP_GRACE_PERIOD` is the longer Compose deadline before Docker sends `SIGKILL`; keep it above the server timeout so the process can emit its timeout evidence and exit itself. The one-shot backup/restore services use the same read-only root, dropped capabilities and bounded resources, and additionally run with `network_mode: none`. The bundled Caddy service retains its public 80/443 bindings and writable certificate/config volumes.

## Static Media

The production Docker image keeps the console HTML, generated `index-*.css` bundle files and world-map data, but intentionally excludes `00_总览/assets/media` from the Docker build context. Serve those large media files from a CDN, object storage bucket or mounted volume outside the production image, and set `AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL` to the public HTTPS base URL:

```bash
AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL=https://cdn.your-domain.example/obsidian-epoch/assets/media
```

At runtime `/epoch/console` rewrites `assets/media/...` references to this external media base. Keep the media origin cacheable and public; do not put secrets or per-user tokens in the URL.

Release smoke should verify the same external media base, not the image-local
media path. Pass it explicitly or set `AGENT_INSTALL_SMOKE_CONSOLE_MEDIA_BASE_URL`
to the same value:

```bash
npm run agent:install-smoke -- --production --server https://agent.your-domain.example --console-media-base-url "$AGENT_EPOCH_CONSOLE_MEDIA_BASE_URL" --json
```

The smoke probe fetches the known console smoke image from that base with a
bounded request. If production console media is missing, unreachable, redirected
or not served as an image, the install smoke fails before users get a broken
plugin page.

Health check:

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/epoch/health
```

Both health paths return the same body with `checks.store`, `checks.maintenance` and `checks.recovery`. They return HTTP 200 only when `ok` is true and HTTP 503 when any readiness check fails, so the bundled Compose healthcheck fails closed. A production server should report a persistent store (`jsonl` or `sqlite`), an enabled maintenance loop reports the latest start, success or error timestamps, and the recovery manifest reports ledger record counts plus sha256 proofs for the append-only JSONL-compatible ledgers. For SQLite deployments, `checks.recovery.status` should be `ok` and `checks.recovery.manifestSha256` should change only when canonical persisted records change.

Install manifest:

```bash
curl http://127.0.0.1:8787/api/epoch/install-manifest
```

The checked-in `package/install-manifest.json` and skill-side copy are development templates. They declare `distribution.mode: local-template` and `productionDistribution: forbidden`; do not upload them or an archive generated from them as a public production package. Production installers must use the live manifest and `/api/epoch/package/...` URL, where the server rewrites the canonical public base and marks the package `live-rewritten` before signing it.

Local install smoke:

```bash
cd tools/graph-react-app
npm run agent:install-smoke -- --server http://127.0.0.1:8787 --json
```

After exposing the server through HTTPS, replace the server URL with the public origin. Localhost smoke is useful before the reverse proxy is exposed, but it is not a production release gate because installed hosts need the same public `serverBase` that appears in the live install manifest and generated host configs. For production release, run the remote gate as:

```bash
cd tools/graph-react-app
npm run agent:install-smoke -- --server https://your-domain.example --production --json
```

If the current CLI does not expose `--production`, use the equivalent `--require-operator-signing --expected-release-key-id <releaseKeyId>` flags shown in Release Signing. The smoke command downloads the live package, verifies sha256/byte integrity, extracts it, and launches the same package-root `node obsidian-epoch/bin/mcp-proxy.ts` stdio path as installed hosts. It first verifies `/api/health`, `/api/epoch/health` and the manifest `health` paths return `ok: true` with store, maintenance and recovery checks, then verifies the live install manifest and package integrity, then verifies the package proxy with `tools/list`, resolves one server-issued turn, verifies the browser-only Web LLM bridge loop, and finally verifies the public result, bridge result and public agent pages. If the server reports a persistent store, install smoke requires the recovery manifest to be healthy before gameplay starts.

## Operator Moderation

Set an operator key before exposing moderation routes:

```bash
AGENT_SERVER_OPERATOR_KEY=replace-with-operator-secret
AGENT_SERVER_MCP_BEARER_TOKEN=replace-with-at-least-32-random-characters
AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH=/data/player-mcp-access-tokens.jsonl
AGENT_SERVER_MCP_PLAYER_TOKEN_TTL_SECONDS=43200
AGENT_SERVER_REGISTRATION_SECRET=replace-with-independent-32-character-secret
AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET=replace-with-a-different-32-character-secret
AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS=1
AGENT_SERVER_PUBLIC_REGISTRATION_MODE=enforce
```

For Compose production, place these values in the files named by `AGENT_SERVER_OPERATOR_KEY_FILE`, `AGENT_SERVER_MCP_BEARER_TOKEN_FILE`, `AGENT_SERVER_REGISTRATION_SECRET_FILE`, and `AGENT_SERVER_REGISTRATION_ACTOR_HASH_SECRET_FILE`. The direct variables above are local-development syntax; setting both the direct and `_FILE` form fails startup to prevent ambiguous secret precedence.

Queued public messages and region news are hidden from normal reads until an operator resolves them through `obsidian_epoch.resolve_moderation` or `POST /api/epoch/moderation/resolve`.

The global MCP bearer token protects `/mcp`, `/api/epoch/mcp`, `/api/epoch/mcp/tools/list`, and `/api/epoch/mcp/tools/call` for operator smoke tests and bootstrap administration. Never distribute that global token to players or embed it in a package or manifest. Players register through `/epoch/pair` or `POST /api/epoch/pairing/register`, then exchange their recovery proof at `POST /api/epoch/mcp/access-tokens` for an independent, short-lived token. Store that player token in the host environment as `AGENT_WORLD_MCP_TOKEN`. Player token records are persisted as SHA-256 hashes only and can be revoked per token or per explorer through `POST /api/epoch/mcp/access-tokens/revoke`.

The same ledger also stores the public pairing/token-issuance quota. Actor buckets are keyed HMAC values derived from the trusted client IP and, when present, a server-signed device challenge or configured invite; raw IP, device challenge and invite values are never persisted. Set `AGENT_SERVER_REGISTRATION_TRUST_PROXY_HOPS` to the exact reverse-proxy count (`1` for the bundled Caddy path). Production rejects permissive mode, missing persistent storage, missing hash secrets, and missing proxy-hop configuration. Check `checks.publicRegistration` in `/api/health` before exposing pairing.

The player-token ledger deliberately stays outside the canonical world SQLite/JSONL hydration set, but it is included as a separately hashed auxiliary backup artifact. Restore it to the configured `AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH` so active-token, revocation, and registration-quota history remains consistent with the selected backup point. As with all point-in-time recovery, tokens revoked after that backup must be treated according to the incident cutover policy; operators can revoke all restored tokens if credential exposure is suspected. Startup ignores only a provably incomplete final JSONL fragment left by an interrupted append; malformed complete records fail closed with `player_mcp_token_ledger_corrupt` and must be inspected rather than silently skipped.

## World Maintenance

The server runs a required maintenance loop in production so canonical world state advances without a player clicking a button. Production startup fails unless `AGENT_SERVER_MAINTENANCE_ENABLED=1` and `AGENT_SERVER_OPERATOR_KEY` is configured. Development remains opt-in. The loop calls the same server-owned tick commands used by MCP/HTTP tools, then appends resulting events to the configured JSONL or SQLite-backed store.

```bash
AGENT_SERVER_MAINTENANCE_ENABLED=1
AGENT_SERVER_MAINTENANCE_INTERVAL_MS=900000
AGENT_SERVER_MAINTENANCE_NPC_LIMIT=5
AGENT_SERVER_MAINTENANCE_MARKET_MAX_AGE_SECONDS=86400
AGENT_SERVER_MAINTENANCE_MARKET_LIMIT=50
AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_REGION_IDS=region_gray_harbor
AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_LIMIT=1
AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT=3
AGENT_SERVER_MAINTENANCE_ANOMALY_REGION_IDS=region_gray_harbor
AGENT_SERVER_MAINTENANCE_ANOMALY_LIMIT=1
AGENT_SERVER_MAINTENANCE_ANOMALY_TEMPLATE_KEY=obsidian_wyrm_boss
AGENT_SERVER_MAINTENANCE_SEASON_REGION_IDS=region_gray_harbor
AGENT_SERVER_MAINTENANCE_SEASON_LIMIT=1
AGENT_SERVER_MAINTENANCE_SEASON_KEY=gray_harbor_faction_season
AGENT_SERVER_MAINTENANCE_SEASON_SETTLEMENT_LIMIT=3
AGENT_SERVER_MAINTENANCE_PARTY_RUN_SETTLEMENT_LIMIT=5
AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT=5
AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_AMOUNT=1
AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_MIN_AGE_SECONDS=604800
AGENT_SERVER_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT=5
```

Leave `AGENT_SERVER_MAINTENANCE_NPC_REGION_ID` blank to tick all known NPC regions, or set a region id to focus maintenance on one zone. Maintenance region env values accept canonical ids and visible world-map aliases such as `region:棱镜水域`; startup parsing resolves them to canonical packaged ids and deduplicates each list. Set `AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_REGION_IDS` to a comma-separated region list when the worker should auto-spawn regional resource nodes; existing open nodes and spawn cooldowns are skipped by server rules. Set `AGENT_SERVER_MAINTENANCE_RESOURCE_NODE_SETTLEMENT_LIMIT` when the worker should settle contested open resource nodes whose server score is above zero. Set `AGENT_SERVER_MAINTENANCE_ANOMALY_REGION_IDS` plus `AGENT_SERVER_MAINTENANCE_ANOMALY_LIMIT` when the worker should auto-spawn server-owned anomaly/Boss chains; regions with an open anomaly are skipped. Leave `AGENT_SERVER_MAINTENANCE_ANOMALY_TEMPLATE_KEY` blank to rotate through the bundled server-owned Boss library by region and tick, or pin one template for a fixed operation. Current template keys include `obsidian_wyrm_boss`, `salt_mirror_leviathan_boss`, `glass_archive_seraph_boss`, `ash_crown_titan_boss` and `moonwell_hollow_queen_boss`; each Boss has multiple server-authored narrative variants chosen deterministically from the tick/region seed. Set `AGENT_SERVER_MAINTENANCE_SEASON_REGION_IDS` plus `AGENT_SERVER_MAINTENANCE_SEASON_LIMIT` when the worker should start built-in seasonal campaigns; regions with an active season are skipped. Set `AGENT_SERVER_MAINTENANCE_SEASON_SETTLEMENT_LIMIT` to let each tick settle mature active seasons whose total score has reached their target. Set `AGENT_SERVER_MAINTENANCE_PARTY_RUN_SETTLEMENT_LIMIT` to settle that many open, full parties per tick in stable creation order; keep it at `0` until the deployment is ready to close existing full parties automatically. Set `AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_LIMIT`, `AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_AMOUNT` and `AGENT_SERVER_MAINTENANCE_REGION_CONTROL_DECAY_MIN_AGE_SECONDS` to decay stale active region-control score and margin without changing the controlling faction or erasing season/control audit history. Set `AGENT_SERVER_MAINTENANCE_SERVER_HOSTED_JOB_LIMIT` to consume queued `obsidian_epoch.queue_server_hosted_action` work through the server-owned hosted-agent lane; keep it at `0` if this deployment only wants manual job execution. Each successful Boss/anomaly spawn also persists a server-derived `region_news_generated` alert for the region, and later operator resolution can publish a server-derived result story that lets the winning identity claim legend once. Set `AGENT_SERVER_MAINTENANCE_RUN_ON_START=1` only when you want one tick immediately after server boot.

## Public Reverse Proxy

Expose only the HTTP server port through your reverse proxy. Set `AGENT_PUBLIC_SERVER_BASE` to the canonical HTTPS server origin and `AGENT_SERVER_ALLOWED_ORIGINS` to the exact public web origins, for example `https://your-domain.example`. Generated install manifests, signed packages, host configs and MCP metadata always use `AGENT_PUBLIC_SERVER_BASE`; request `Host` and `X-Forwarded-*` headers cannot rewrite that trust root. Do not use `*`; MCP tools and browser calls should receive explicit CORS allow-listing.

For TLS, use the included Caddy public profile or an equivalent reverse proxy and forward to `http://obsidian-epoch-agent-server:8787`.

## Trusted Runners

Trusted runners are configured by the operator, never by clients:

```bash
AGENT_SERVER_ATTESTED_RUNNERS_FILE=/etc/obsidian-epoch/attested-runners.json
```

The mode-`0600` file contains a JSON array of runner configs with `runnerId`, optional `keyId`, `secret`, optional `label`, optional `trustClass` and optional `challengeTtlMs`; use `[]` to disable runners. Production rejects short, duplicate, or server-credential-reused runner secrets. Rotate by atomically replacing the file with a new secret and `keyId`, then restart; the operator overview shows the new `secretFingerprint` without exposing raw material.
