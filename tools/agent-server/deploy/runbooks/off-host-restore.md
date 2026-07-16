# Off-host restore

This runbook restores an Obsidian Epoch backup onto a fresh host or staging host before any production cutover.

The restore command and recovery drill are implemented in this repository, but
an off-host restore is complete only after these steps pass on the separate
host. Do not claim production disaster recovery is proven from local tests or
from the checked-in runbook alone.

## Inputs

- A backup directory that contains the immutable `recovery-backup.json` and detached `recovery-backup.signature.json`.
- The pinned Ed25519 verification public-key ring obtained from the recovery trust store, not from the backup directory.
- The signed backup `checkpoint` copied from an independent audit log, object-storage inventory, or approved change record.
- A checked-out server tree at `/opt/obsidian-epoch`.
- Fresh target paths for restored JSONL ledgers and SQLite state.

Do not overwrite production. The restore command refuses existing targets by design; keep that safety check intact.

## 1. Copy the backup to the recovery host

Use `rsync` when available so retries are safe:

```bash
rsync -a --checksum ops@primary.example:/data/backups/2026-06-26T00-00-00-000Z/ /srv/obsidian-epoch-restore/backups/2026-06-26T00-00-00-000Z/
```

If rsync is unavailable, copy the complete directory with `scp -r` and keep the timestamped directory name:

```bash
scp -r ops@primary.example:/data/backups/2026-06-26T00-00-00-000Z /srv/obsidian-epoch-restore/backups/
```

## 2. Restore into fresh target paths

```bash
cd /opt/obsidian-epoch/tools/graph-react-app
AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE=/etc/obsidian-epoch/backup-verification-public-keys.json \
AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE=/etc/obsidian-epoch/backup-trusted-checkpoint.json \
  npm run agent:restore-backup -- --backup /srv/obsidian-epoch-restore/backups/2026-06-26T00-00-00-000Z --target-source /srv/obsidian-epoch-restore/jsonl --target-sqlite /srv/obsidian-epoch-restore/agent-world.sqlite --target-player-mcp-tokens /srv/obsidian-epoch-restore/player-mcp-access-tokens.jsonl --require-signature --require-replay-protection --json
```

The command first authenticates the exact manifest bytes with the out-of-band Ed25519 public-key ring, then verifies that the candidate is not older than the independently stored checkpoint before checking file byte counts, SHA-256 hashes, and the cross-domain consistency proof. Record the reported backup key ID and compare it with the recovery key inventory. Do not trust a public key or checkpoint copied alongside the backup, and never calculate the checkpoint from the directory being restored; doing so would not prevent a valid old backup from being replayed.

## 3. Rehearse recovery from the restored paths

```bash
cd /opt/obsidian-epoch/tools/graph-react-app
npm run agent:recovery-drill -- --source /srv/obsidian-epoch-restore/jsonl --sqlite /srv/obsidian-epoch-restore/agent-world.sqlite --json
```

The drill must report matching recovery manifests and successful runtime hydration before the restored host is eligible for traffic.

## 4. Cut over the restored host

Only after restore and drill pass, point the service to the restored paths:

```bash
AGENT_SERVER_DATA_DIR=/srv/obsidian-epoch-restore/jsonl
AGENT_SERVER_SQLITE_PATH=/srv/obsidian-epoch-restore/agent-world.sqlite
AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH=/srv/obsidian-epoch-restore/player-mcp-access-tokens.jsonl
AGENT_SERVER_STORE=sqlite
```

Start the server, check `/api/health` and `/api/epoch/health`, then run the remote install smoke command against the public URL before moving player traffic.

## Compose staging restore

The default Compose deployment stores primary data and backups in different named volumes. Do not mount the primary `obsidian_epoch_data` volume into the restore job. After copying a verified timestamped backup into `obsidian_epoch_backups`, restore into the disposable staging volume:

```bash
cd /opt/obsidian-epoch/tools/agent-server/deploy
AGENT_SERVER_RESTORE_BACKUP=/backups/2026-06-26T00-00-00-000Z \
AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE=/etc/obsidian-epoch/backup-trusted-checkpoint.json \
  docker compose --profile operations run --rm obsidian-epoch-restore
```

The job reads `/backups` read-only and writes `/restore/jsonl`, `/restore/agent-world.sqlite`, and `/restore/player-mcp-access-tokens.jsonl` in `obsidian_epoch_restore`. Run recovery and server smoke against copies from that staging volume; promotion into production remains a planned operator action. A Docker named backup volume is not off-host protection, so retain the rsync/object-storage step and verify its checksums independently.
