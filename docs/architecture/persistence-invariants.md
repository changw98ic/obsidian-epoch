# Persistence Invariants

The canonical Epoch event log is append-only. A successful mutating HTTP or
MCP response means its complete event batch was durably appended first. The
server uses one mutation coordinator across HTTP/MCP writes and scheduled
maintenance so the sequence is always:

1. verify that the persistence guard is healthy;
2. perform one runtime mutation;
3. append the complete event batch atomically;
4. publish the response or continue maintenance.

If an append fails, the shared guard is permanently poisoned for that process.
Queued writes re-check the guard before mutation and receive
`epoch_persistence_unavailable`; the process stops accepting connections and
drains. The failed in-memory mutation is never treated as durable state and is
discarded when the process exits.

Graceful shutdown stops scheduling maintenance, closes the listener, then waits
for the maintenance in-flight promise and the shared mutation coordinator to
drain. The configured shutdown deadline remains authoritative; crossing it
forces connection termination and a non-zero exit instead of claiming a clean
stop with an unobserved write still pending.

Default sequential IDs resume from the highest persisted event and aggregate
IDs during hydration. A restart must therefore produce a strictly new event ID
before SQLite's unique event index is written. Removing that unique constraint
or allowing duplicate JSONL event IDs is not an acceptable recovery strategy.

Production backup has one authoritative world store. SQLite deployments use a
`VACUUM INTO` snapshot and do not mix stale migration JSONL into the recovery
point. The separately persisted player-token/admission ledger is read once
before and once after the world snapshot; both byte count and SHA-256 must be
identical, and every issued-token explorer must exist in the captured world.
Backup parsing is read-only: an incomplete token-ledger tail fails the backup
without repairing or truncating the live source.

Published recovery manifests are immutable version-2 documents. A dedicated
Ed25519 backup key signs the exact manifest bytes with domain separation into
`recovery-backup.signature.json`; the manifest then authenticates every data
file by byte count and SHA-256. Restore obtains a pinned public-key ring
out-of-band so old and new signing generations can coexist during rotation,
verifies the detached signature before trusting manifest semantics, and checks
the candidate against an out-of-band minimum trusted checkpoint. The checkpoint
must not live in or be derived from the backup directory. Restore then stages
all requested domains, validates them, and only then renames targets into place.
Release-package signing keys, operator credentials and backup keys are separate
trust domains.

These guarantees are process-local. Multi-replica active/active operation
requires a transactional shared event store, distributed sequencing and leader
or consensus ownership; SQLite plus the process-local coordinator deliberately
supports one authoritative writer only.
