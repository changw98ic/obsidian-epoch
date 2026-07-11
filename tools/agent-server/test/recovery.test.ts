import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createEpochGameCore } from "../lib/epoch/gameCore.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import {
  createRecoveryBackup,
  createJsonlRecoveryManifest,
  createSqliteRecoveryManifest,
  restoreRecoveryBackup,
  runJsonlToSqliteRecoveryDrill,
  runSqliteRecoveryDrill,
} from "../lib/recovery.ts";
import { migrateJsonlDataDirToSqlite } from "../lib/sqliteStore.ts";
import { PlayerMcpAccessTokenStore } from "../lib/playerMcpAccessTokenStore.ts";

async function writeJsonl(filePath: string, records: readonly unknown[]) {
  await writeFile(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

function tokenIssueRecord(tokenId: string, hashCharacter: string, explorerId = `explorer_${tokenId}`) {
  return {
    type: "issue",
    record: {
      tokenId,
      explorerId,
      issuedAt: "2026-06-26T00:00:00.000Z",
      expiresAt: "2026-06-27T00:00:00.000Z",
      tokenHash: `sha256:${hashCharacter.repeat(64)}`,
    },
  };
}

function backupSigningMaterial() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyBase64: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  };
}

async function writePublishedBackupMarker(backupRoot: string, backupId: string, generatedAt: string) {
  const backupPath = path.join(backupRoot, backupId);
  await mkdir(backupPath, { recursive: true });
  await writeFile(path.join(backupPath, "recovery-backup.json"), JSON.stringify({
    ok: true,
    backupId,
    generatedAt,
    files: [],
  }), "utf8");
}

async function runCli(script: string, args: readonly string[], env: NodeJS.ProcessEnv = {}) {
  const graphAppRoot = path.resolve(import.meta.dirname, "../../graph-react-app");
  const child = spawn(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: graphAppRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
  const [code] = await once(child, "exit");
  return {
    code,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
  };
}

test("recovery manifest gives matching JSONL and SQLite ledger proofs after migration", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-manifest-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  await mkdir(sourceDir, { recursive: true });
  try {
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("recovery_manifest"),
    });
    const identity = core.issueIdentity({
      explorerId: "explorer_recovery_manifest",
      identityName: "恢复清单校验者",
    }, {
      actorExplorerId: "explorer_recovery_manifest",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-recovery-manifest-1",
    });
    const resultPage = {
      type: "epoch_result_page",
      page: {
        pageId: "page_recovery_manifest",
        createdAt: "2026-06-26T00:00:00.000Z",
        urlPath: "/epoch/result/page_recovery_manifest",
        payload: { pageType: "agent_result", generatedAt: "2026-06-26T00:00:00.000Z", progress: {} },
        createdBy: "explorer_recovery_manifest",
        idempotencyKey: "result_page:recovery_manifest",
      },
    };
    const contextSnapshot = {
      type: "context_snapshot",
      snapshot: {
        snapshotId: "ctxsnap_recovery_manifest_001",
        contextVersion: "obsidian-epoch-context-pack-test",
        versions: { contextPackVersion: "obsidian-epoch-context-pack-test" },
        retrievalParams: {
          requestedAgentId: "agent_grayfile_07",
          resolvedAgentId: "agent_grayfile_07",
          explorerId: "explorer_recovery_manifest",
          mandate: "recovery manifest",
          anchorCount: 0,
          anchorIds: [],
        },
        filteringReasons: ["core_secrets_excluded"],
        settingCards: [{
          cardId: "agent:agent_grayfile_07",
          version: "obsidian-epoch-context-pack-test",
          publicSummary: "灰档-07 public summary",
          filteringReasons: ["core_secrets_excluded"],
        }],
      },
    };

    await writeJsonl(path.join(sourceDir, "epoch-events.jsonl"), identity.events.map((event) => ({
      type: "epoch_event",
      event,
    })));
    await writeJsonl(path.join(sourceDir, "result-pages.jsonl"), [resultPage]);
    await writeJsonl(path.join(sourceDir, "context-snapshots.jsonl"), [contextSnapshot]);
    await migrateJsonlDataDirToSqlite({ sourceDataDir: sourceDir, dbPath });

    const jsonlManifest = await createJsonlRecoveryManifest(sourceDir, new Date("2026-06-26T00:01:00.000Z"));
    const sqliteManifest = await createSqliteRecoveryManifest(dbPath, new Date("2026-06-26T00:01:00.000Z"));

    assert.equal(jsonlManifest.status, "ok");
    assert.equal(sqliteManifest.status, "ok");
    assert.equal(jsonlManifest.storeKind, "jsonl");
    assert.equal(sqliteManifest.storeKind, "sqlite");
    assert.equal(jsonlManifest.files["epoch-events.jsonl"].records, 1);
    assert.equal(jsonlManifest.files["result-pages.jsonl"].records, 1);
    assert.equal(jsonlManifest.files["context-snapshots.jsonl"].records, 1);
    assert.equal(sqliteManifest.files["epoch-events.jsonl"].records, 1);
    assert.equal(sqliteManifest.files["result-pages.jsonl"].records, 1);
    assert.equal(sqliteManifest.files["context-snapshots.jsonl"].records, 1);
    assert.equal(
      sqliteManifest.files["epoch-events.jsonl"].sha256,
      jsonlManifest.files["epoch-events.jsonl"].sha256,
    );
    assert.equal(
      sqliteManifest.files["result-pages.jsonl"].sha256,
      jsonlManifest.files["result-pages.jsonl"].sha256,
    );
    assert.equal(
      sqliteManifest.files["context-snapshots.jsonl"].sha256,
      jsonlManifest.files["context-snapshots.jsonl"].sha256,
    );
    assert.equal(jsonlManifest.epochEvents.latestEventId, identity.events[0].eventId);
    assert.equal(sqliteManifest.epochEvents.latestEventId, identity.events[0].eventId);
    assert.match(jsonlManifest.manifestSha256, /^[a-f0-9]{64}$/);
    assert.equal(sqliteManifest.manifestSha256, jsonlManifest.manifestSha256);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("recovery manifests give legacy records and batch envelopes the same logical epoch proof", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-batch-proof-"));
  const legacyDir = path.join(tempDir, "legacy-jsonl");
  const batchDir = path.join(tempDir, "batch-jsonl");
  const dbPath = path.join(tempDir, "batch.sqlite");
  await mkdir(legacyDir, { recursive: true });
  await mkdir(batchDir, { recursive: true });
  try {
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("recovery_batch_proof"),
    });
    const first = core.issueIdentity({
      explorerId: "explorer_recovery_batch_1",
      identityName: "恢复批次一号",
    }, {
      actorExplorerId: "explorer_recovery_batch_1",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-recovery-batch-1",
    });
    const second = core.issueIdentity({
      explorerId: "explorer_recovery_batch_2",
      identityName: "恢复批次二号",
    }, {
      actorExplorerId: "explorer_recovery_batch_2",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-recovery-batch-2",
    });
    const events = [first.events[0], second.events[0]];

    await writeJsonl(path.join(legacyDir, "epoch-events.jsonl"), events.map((event) => ({
      type: "epoch_event",
      event,
    })));
    await writeJsonl(path.join(batchDir, "epoch-events.jsonl"), [{
      type: "epoch_event_batch",
      events,
    }]);
    await migrateJsonlDataDirToSqlite({ sourceDataDir: batchDir, dbPath });

    const generatedAt = new Date("2026-06-26T00:01:30.000Z");
    const legacyManifest = await createJsonlRecoveryManifest(legacyDir, generatedAt);
    const batchManifest = await createJsonlRecoveryManifest(batchDir, generatedAt);
    const sqliteManifest = await createSqliteRecoveryManifest(dbPath, generatedAt);

    assert.equal(legacyManifest.files["epoch-events.jsonl"].records, 2);
    assert.equal(batchManifest.files["epoch-events.jsonl"].records, 2);
    assert.equal(sqliteManifest.files["epoch-events.jsonl"].records, 2);
    assert.equal(batchManifest.epochEvents.records, 2);
    assert.equal(batchManifest.epochEvents.latestEventId, second.events[0].eventId);
    assert.equal(
      batchManifest.files["epoch-events.jsonl"].sha256,
      legacyManifest.files["epoch-events.jsonl"].sha256,
    );
    assert.equal(
      sqliteManifest.files["epoch-events.jsonl"].sha256,
      legacyManifest.files["epoch-events.jsonl"].sha256,
    );
    assert.equal(batchManifest.manifestSha256, legacyManifest.manifestSha256);
    assert.equal(sqliteManifest.manifestSha256, legacyManifest.manifestSha256);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("recovery drill migrates ledgers and proves hydrated runtime state", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-drill-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  await mkdir(sourceDir, { recursive: true });
  try {
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("recovery_drill"),
    });
    const identity = core.issueIdentity({
      explorerId: "explorer_recovery_drill",
      identityName: "恢复演练校验者",
    }, {
      actorExplorerId: "explorer_recovery_drill",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-recovery-drill-1",
    });
    const resultPage = {
      type: "epoch_result_page",
      page: {
        pageId: "page_recovery_drill",
        createdAt: "2026-06-26T00:02:00.000Z",
        urlPath: "/epoch/result/page_recovery_drill",
        payload: { pageType: "agent_result", generatedAt: "2026-06-26T00:02:00.000Z", progress: {} },
        createdBy: "explorer_recovery_drill",
        idempotencyKey: "result_page:recovery_drill",
      },
    };

    await writeJsonl(path.join(sourceDir, "epoch-events.jsonl"), identity.events.map((event) => ({
      type: "epoch_event",
      event,
    })));
    await writeJsonl(path.join(sourceDir, "result-pages.jsonl"), [resultPage]);

    const drill = await runJsonlToSqliteRecoveryDrill({
      sourceDataDir: sourceDir,
      sqlitePath: dbPath,
      generatedAt: new Date("2026-06-26T00:03:00.000Z"),
      expectedAgentId: identity.value.agentId,
      expectedResultPageId: "page_recovery_drill",
    });

    assert.equal(drill.ok, true);
    assert.equal(drill.migration.records, 2);
    assert.equal(drill.parity.ok, true);
    assert.deepEqual(drill.parity.mismatches, []);
    assert.equal(drill.hydration.ok, true);
    assert.equal(drill.hydration.epochEvents, 1);
    assert.equal(drill.hydration.resultPages, 1);
    assert.equal(drill.hydration.latestEventId, identity.events[0].eventId);
    assert.equal(drill.hydration.expectedAgent?.agentId, identity.value.agentId);
    assert.equal(drill.hydration.expectedAgent?.identityName, "恢复演练校验者");
    assert.equal(drill.hydration.expectedResultPage?.pageId, "page_recovery_drill");
    assert.match(drill.source.manifestSha256, /^[a-f0-9]{64}$/);
    assert.equal(drill.target.manifestSha256, drill.source.manifestSha256);
    const sqliteOnlyDrill = await runSqliteRecoveryDrill({
      sqlitePath: dbPath,
      expectedAgentId: identity.value.agentId,
      expectedResultPageId: "page_recovery_drill",
    });
    assert.equal(sqliteOnlyDrill.ok, true);
    assert.equal(sqliteOnlyDrill.parity.ok, true);
    assert.equal(sqliteOnlyDrill.hydration.expectedAgent?.found, true);
    assert.equal(sqliteOnlyDrill.hydration.expectedResultPage?.found, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("recovery backup snapshots JSONL and SQLite ledgers and prunes old rotations", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-backup-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const playerMcpTokenJsonlPath = path.join(tempDir, "credentials", "player-mcp-access-tokens.jsonl");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(playerMcpTokenJsonlPath), { recursive: true });
  await writePublishedBackupMarker(backupRoot, "2026-06-24T00-00-00-000Z", "2026-06-24T00:00:00.000Z");
  await writePublishedBackupMarker(backupRoot, "2026-06-25T00-00-00-000Z", "2026-06-25T00:00:00.000Z");
  try {
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("recovery_backup"),
    });
    const identity = core.issueIdentity({
      explorerId: "explorer_recovery_backup",
      identityName: "恢复备份校验者",
    }, {
      actorExplorerId: "explorer_recovery_backup",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-recovery-backup-1",
    });
    const resultPage = {
      type: "epoch_result_page",
      page: {
        pageId: "page_recovery_backup",
        createdAt: "2026-06-26T00:04:00.000Z",
        urlPath: "/epoch/result/page_recovery_backup",
        payload: { pageType: "agent_result", generatedAt: "2026-06-26T00:04:00.000Z", progress: {} },
        createdBy: "explorer_recovery_backup",
        idempotencyKey: "result_page:recovery_backup",
      },
    };

    await writeJsonl(path.join(sourceDir, "epoch-events.jsonl"), identity.events.map((event) => ({
      type: "epoch_event",
      event,
    })));
    await writeJsonl(path.join(sourceDir, "result-pages.jsonl"), [resultPage]);
    await writeJsonl(playerMcpTokenJsonlPath, [
      tokenIssueRecord("token_backup_1", "a", "explorer_recovery_backup"),
      { type: "revokeToken", tokenId: "token_backup_1", revokedAt: "2026-06-26T00:04:30.000Z" },
    ]);
    await migrateJsonlDataDirToSqlite({ sourceDataDir: sourceDir, dbPath });

    const backup = await createRecoveryBackup({
      sourceDataDir: sourceDir,
      sqlitePath: dbPath,
      playerMcpTokenJsonlPath,
      backupRoot,
      generatedAt: new Date("2026-06-26T00:05:00.000Z"),
      keepLast: 2,
    });
    const manifest = JSON.parse(await readFile(backup.manifestPath, "utf8"));
    const rotations = (await readdir(backupRoot)).sort();

    assert.equal(backup.ok, true);
    assert.equal(backup.backupId, "2026-06-26T00-05-00-000Z");
    assert.equal(backup.retention.keepLast, 2);
    assert.deepEqual(rotations, ["2026-06-25T00-00-00-000Z", "2026-06-26T00-05-00-000Z"]);
    assert.equal(manifest.manifests.jsonl.source.manifestSha256, manifest.manifests.jsonl.backup.manifestSha256);
    assert.equal(manifest.manifests.sqlite.source.manifestSha256, manifest.manifests.sqlite.backup.manifestSha256);
    assert.equal(manifest.auxiliary.playerMcpAccessTokens.records, 2);
    assert.equal(manifest.auxiliary.playerMcpAccessTokens.sourcePath, undefined);
    assert.equal(manifest.manifests.jsonl.source.records, 2);
    assert.equal(manifest.manifests.sqlite.source.records, 2);
    assert.equal(manifest.manifests.jsonl.backup.epochEvents.latestEventId, identity.events[0].eventId);
    assert.equal(manifest.manifests.sqlite.backup.resultPages.latestPageId, "page_recovery_backup");
    assert.ok(backup.files.some((file) => file.relativePath === "jsonl/epoch-events.jsonl" && file.bytes > 0));
    assert.ok(backup.files.some((file) => file.relativePath === "sqlite/agent-world.sqlite" && file.bytes > 0));
    assert.ok(backup.files.some((file) => file.relativePath === "auxiliary/player-mcp-access-tokens.jsonl" && file.bytes > 0));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("signed recovery backups require the pinned Ed25519 trust root and reject manifest rewriting", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-signed-backup-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  const restoredDir = path.join(tempDir, "restored");
  const symlinkRestoreDir = path.join(tempDir, "symlink-restore");
  const tamperedRestoreDir = path.join(tempDir, "tampered-restore");
  const signing = backupSigningMaterial();
  const wrongSigning = backupSigningMaterial();
  await mkdir(sourceDir, { recursive: true });
  await writeJsonl(path.join(sourceDir, "tickets.jsonl"), [{
    type: "ticket",
    ticketId: "ticket_signed_backup_001",
    createdAt: "2026-06-26T01:00:00.000Z",
  }]);

  try {
    const backup = await createRecoveryBackup({
      sourceDataDir: sourceDir,
      backupRoot,
      generatedAt: new Date("2026-06-26T01:01:00.000Z"),
      signingPrivateKeyPem: signing.privateKeyPem,
      requireSignature: true,
    });
    const diskManifest = JSON.parse(await readFile(backup.manifestPath, "utf8"));
    const signaturePath = path.join(backup.backupPath, "recovery-backup.signature.json");
    const signatureContent = await readFile(signaturePath);
    const signatureEnvelope = JSON.parse(signatureContent.toString("utf8"));

    assert.equal(diskManifest.type, "obsidian_epoch_recovery_backup");
    assert.equal(diskManifest.version, 2);
    assert.equal(diskManifest.backupPath, undefined);
    assert.equal(diskManifest.retention, undefined);
    assert.equal(diskManifest.files[0].sourcePath, undefined);
    assert.equal(signatureEnvelope.algorithm, "Ed25519");
    assert.equal(backup.signature?.keyId, signatureEnvelope.keyId);

    await assert.rejects(
      () => restoreRecoveryBackup({
        backupPath: backup.backupPath,
        targetDataDir: restoredDir,
        requireSignature: true,
      }),
      /recovery_backup_verification_public_key_required/,
    );
    await assert.rejects(() => readdir(restoredDir), /ENOENT/);

    await assert.rejects(
      () => restoreRecoveryBackup({
        backupPath: backup.backupPath,
        targetDataDir: restoredDir,
        verificationPublicKey: wrongSigning.publicKeyBase64,
        requireSignature: true,
      }),
      /recovery_backup_signature_key_mismatch/,
    );

    const restore = await restoreRecoveryBackup({
      backupPath: backup.backupPath,
      targetDataDir: restoredDir,
      verificationPublicKey: signing.publicKeyBase64,
      requireSignature: true,
    });
    assert.equal(restore.verification.signature?.verified, true);
    assert.equal(restore.verification.signature?.keyId, signatureEnvelope.keyId);

    const outsideSignaturePath = path.join(tempDir, "outside-signature.json");
    await writeFile(outsideSignaturePath, signatureContent);
    await rm(signaturePath);
    await symlink(outsideSignaturePath, signaturePath);
    await assert.rejects(
      () => restoreRecoveryBackup({
        backupPath: backup.backupPath,
        targetDataDir: symlinkRestoreDir,
        verificationPublicKey: signing.publicKeyBase64,
        requireSignature: true,
      }),
      /recovery_backup_file_symlink/,
    );
    await assert.rejects(() => readdir(symlinkRestoreDir), /ENOENT/);
    await rm(signaturePath);
    await writeFile(signaturePath, signatureContent);

    const dataPath = path.join(backup.backupPath, "jsonl", "tickets.jsonl");
    const tamperedContent = Buffer.from(`${JSON.stringify({ type: "ticket", ticketId: "tampered" })}\n`, "utf8");
    await writeFile(dataPath, tamperedContent);
    diskManifest.files[0].bytes = tamperedContent.byteLength;
    diskManifest.files[0].sha256 = createHash("sha256").update(tamperedContent).digest("hex");
    await writeFile(backup.manifestPath, `${JSON.stringify(diskManifest, null, 2)}\n`, "utf8");

    await assert.rejects(
      () => restoreRecoveryBackup({
        backupPath: backup.backupPath,
        targetDataDir: tamperedRestoreDir,
        verificationPublicKey: signing.publicKeyBase64,
        requireSignature: true,
      }),
      /recovery_backup_signature_manifest_mismatch/,
    );
    await assert.rejects(() => readdir(tamperedRestoreDir), /ENOENT/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("required backup signatures fail before publishing when no independent key is configured", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-signature-required-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  await mkdir(sourceDir, { recursive: true });
  try {
    await assert.rejects(
      () => createRecoveryBackup({
        sourceDataDir: sourceDir,
        backupRoot,
        requireSignature: true,
      }),
      /recovery_backup_signing_private_key_required/,
    );
    await assert.rejects(() => readdir(backupRoot), /ENOENT/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("backup trust keyrings preserve rotated keys and trusted checkpoints reject signed rollback", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-keyring-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  const restoredOldDir = path.join(tempDir, "restored-old");
  const restoredNewDir = path.join(tempDir, "restored-new");
  const oldSigning = backupSigningMaterial();
  const newSigning = backupSigningMaterial();
  await mkdir(sourceDir, { recursive: true });
  await writeJsonl(path.join(sourceDir, "tickets.jsonl"), [{
    type: "ticket",
    ticketId: "ticket_before_rotation",
    createdAt: "2026-06-26T01:00:00.000Z",
  }]);

  try {
    const oldBackup = await createRecoveryBackup({
      sourceDataDir: sourceDir,
      backupRoot,
      generatedAt: new Date("2026-06-26T01:01:00.000Z"),
      signingPrivateKeyPem: oldSigning.privateKeyPem,
      requireSignature: true,
    });
    await writeJsonl(path.join(sourceDir, "tickets.jsonl"), [{
      type: "ticket",
      ticketId: "ticket_after_rotation",
      createdAt: "2026-06-26T02:00:00.000Z",
    }]);
    const newBackup = await createRecoveryBackup({
      sourceDataDir: sourceDir,
      backupRoot,
      generatedAt: new Date("2026-06-26T02:01:00.000Z"),
      signingPrivateKeyPem: newSigning.privateKeyPem,
      retentionVerificationPublicKeys: [oldSigning.publicKeyBase64, newSigning.publicKeyBase64],
      requireSignature: true,
    });

    assert.equal(oldBackup.checkpoint?.keyId, oldBackup.signature?.keyId);
    assert.equal(newBackup.checkpoint?.keyId, newBackup.signature?.keyId);
    await assert.rejects(
      () => restoreRecoveryBackup({
        backupPath: oldBackup.backupPath,
        targetDataDir: restoredOldDir,
        verificationPublicKeys: [oldSigning.publicKeyBase64, newSigning.publicKeyBase64],
        trustedCheckpoint: newBackup.checkpoint,
        requireSignature: true,
      }),
      /recovery_backup_rollback_detected/,
    );
    await assert.rejects(() => readdir(restoredOldDir), /ENOENT/);

    const restored = await restoreRecoveryBackup({
      backupPath: newBackup.backupPath,
      targetDataDir: restoredNewDir,
      verificationPublicKeys: [oldSigning.publicKeyBase64, newSigning.publicKeyBase64],
      trustedCheckpoint: newBackup.checkpoint,
      requireSignature: true,
    });
    assert.equal(restored.verification.signature?.keyId, newBackup.signature?.keyId);
    assert.equal(restored.verification.checkpoint?.verified, true);
    assert.equal(restored.verification.checkpoint?.minimumBackupId, newBackup.backupId);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("a failed recovery backup is never published and does not prune valid rotations", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-backup-failure-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  const tokenLedgerPath = path.join(tempDir, "credentials", "player-mcp-access-tokens.jsonl");
  const oldBackupIds = [
    "2026-06-24T00-00-00-000Z",
    "2026-06-25T00-00-00-000Z",
  ];
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(tokenLedgerPath), { recursive: true });
  await writeJsonl(tokenLedgerPath, [{ type: "issue" }]);
  await writePublishedBackupMarker(backupRoot, oldBackupIds[0], "2026-06-24T00:00:00.000Z");
  await writePublishedBackupMarker(backupRoot, oldBackupIds[1], "2026-06-25T00:00:00.000Z");

  try {
    await assert.rejects(
      () => createRecoveryBackup({
        sourceDataDir: sourceDir,
        playerMcpTokenJsonlPath: tokenLedgerPath,
        backupRoot,
        generatedAt: new Date("2026-06-26T00:00:00.000Z"),
        keepLast: 1,
      }),
      /player_mcp_token_ledger_corrupt/,
    );

    assert.deepEqual((await readdir(backupRoot)).sort(), oldBackupIds);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("backup validation never repairs or truncates an incomplete live player token ledger", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-readonly-token-ledger-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  const tokenLedgerPath = path.join(tempDir, "credentials", "player-mcp-access-tokens.jsonl");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(tokenLedgerPath), { recursive: true });
  const original = `${JSON.stringify(tokenIssueRecord("token_readonly_1", "d"))}\n{"type":"revokeToken"`;
  await writeFile(tokenLedgerPath, original, "utf8");

  try {
    await assert.rejects(
      () => createRecoveryBackup({
        sourceDataDir: sourceDir,
        playerMcpTokenJsonlPath: tokenLedgerPath,
        backupRoot,
      }),
      /player_mcp_token_ledger_incomplete/,
    );
    assert.equal(await readFile(tokenLedgerPath, "utf8"), original);
    assert.deepEqual(await readdir(backupRoot), []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("backup rejects player tokens whose explorer is absent from the authoritative world snapshot", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-cross-domain-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  const tokenLedgerPath = path.join(tempDir, "credentials", "player-mcp-access-tokens.jsonl");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(tokenLedgerPath), { recursive: true });
  await writeJsonl(tokenLedgerPath, [
    tokenIssueRecord("token_orphaned_1", "e", "explorer_missing_from_world"),
  ]);

  try {
    await assert.rejects(
      () => createRecoveryBackup({
        sourceDataDir: sourceDir,
        playerMcpTokenJsonlPath: tokenLedgerPath,
        backupRoot,
      }),
      /recovery_backup_cross_domain_inconsistent:explorer_missing_from_world/,
    );
    assert.deepEqual(await readdir(backupRoot), []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("recovery restore rejects traversal, duplicate, symlink, non-regular, and escaped files before writes", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-restore-layout-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  await mkdir(sourceDir, { recursive: true });
  const core = createEpochGameCore({
    idFactory: createSequentialEpochIdFactory("recovery_layout"),
  });
  const identity = core.issueIdentity({
    explorerId: "explorer_recovery_layout",
    identityName: "恢复路径校验者",
  }, {
    actorExplorerId: "explorer_recovery_layout",
    trustClass: "untrusted_client",
    idempotencyKey: "issue-recovery-layout-1",
  });
  await writeJsonl(path.join(sourceDir, "epoch-events.jsonl"), identity.events.map((event) => ({
    type: "epoch_event",
    event,
  })));

  try {
    const backup = await createRecoveryBackup({
      sourceDataDir: sourceDir,
      backupRoot,
      generatedAt: new Date("2026-06-26T00:01:00.000Z"),
    });
    const manifest = JSON.parse(await readFile(backup.manifestPath, "utf8"));
    const originalManifest = `${JSON.stringify(manifest, null, 2)}\n`;
    const backupFilePath = path.join(backup.backupPath, "jsonl", "epoch-events.jsonl");
    const backupFileContent = await readFile(backupFilePath);

    manifest.files[0].relativePath = "../outside.jsonl";
    await writeFile(backup.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const traversalTarget = path.join(tempDir, "restore-traversal");
    await assert.rejects(
      () => restoreRecoveryBackup({ backupPath: backup.backupPath, targetDataDir: traversalTarget }),
      /recovery_backup_relative_path_invalid/,
    );
    await assert.rejects(() => readdir(traversalTarget), /ENOENT/);

    await writeFile(backup.manifestPath, originalManifest, "utf8");
    const duplicateManifest = JSON.parse(originalManifest);
    duplicateManifest.files.push({ ...duplicateManifest.files[0] });
    await writeFile(backup.manifestPath, `${JSON.stringify(duplicateManifest, null, 2)}\n`, "utf8");
    const duplicateTarget = path.join(tempDir, "restore-duplicate");
    await assert.rejects(
      () => restoreRecoveryBackup({ backupPath: backup.backupPath, targetDataDir: duplicateTarget }),
      /recovery_backup_file_duplicate/,
    );
    await assert.rejects(() => readdir(duplicateTarget), /ENOENT/);

    await writeFile(backup.manifestPath, originalManifest, "utf8");
    const outsideFilePath = path.join(tempDir, "outside-epoch-events.jsonl");
    await writeFile(outsideFilePath, backupFileContent);
    await rm(backupFilePath);
    await symlink(outsideFilePath, backupFilePath);
    const symlinkTarget = path.join(tempDir, "restore-symlink");
    await assert.rejects(
      () => restoreRecoveryBackup({ backupPath: backup.backupPath, targetDataDir: symlinkTarget }),
      /recovery_backup_file_symlink/,
    );
    await assert.rejects(() => readdir(symlinkTarget), /ENOENT/);

    await rm(backupFilePath);
    await mkdir(backupFilePath);
    const nonRegularTarget = path.join(tempDir, "restore-non-regular");
    await assert.rejects(
      () => restoreRecoveryBackup({ backupPath: backup.backupPath, targetDataDir: nonRegularTarget }),
      /recovery_backup_file_not_regular/,
    );
    await assert.rejects(() => readdir(nonRegularTarget), /ENOENT/);

    const backupJsonlDir = path.dirname(backupFilePath);
    const outsideJsonlDir = path.join(tempDir, "outside-jsonl");
    await rm(backupJsonlDir, { recursive: true });
    await mkdir(outsideJsonlDir);
    await writeFile(path.join(outsideJsonlDir, "epoch-events.jsonl"), backupFileContent);
    await symlink(outsideJsonlDir, backupJsonlDir, "dir");
    const containmentTarget = path.join(tempDir, "restore-containment");
    await assert.rejects(
      () => restoreRecoveryBackup({ backupPath: backup.backupPath, targetDataDir: containmentTarget }),
      /recovery_backup_file_outside_root/,
    );
    await assert.rejects(() => readdir(containmentTarget), /ENOENT/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("recovery restore verifies backup manifest and restores to fresh JSONL and SQLite targets", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-restore-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  const restoreDir = path.join(tempDir, "restored-jsonl");
  const restoreSqlitePath = path.join(tempDir, "restored.sqlite");
  const playerMcpTokenJsonlPath = path.join(tempDir, "credentials", "player-mcp-access-tokens.jsonl");
  const restorePlayerMcpTokenJsonlPath = path.join(tempDir, "restored-credentials", "player-mcp-access-tokens.jsonl");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(playerMcpTokenJsonlPath), { recursive: true });
  try {
    const core = createEpochGameCore({
      idFactory: createSequentialEpochIdFactory("recovery_restore"),
    });
    const identity = core.issueIdentity({
      explorerId: "explorer_recovery_restore",
      identityName: "恢复执行校验者",
    }, {
      actorExplorerId: "explorer_recovery_restore",
      trustClass: "untrusted_client",
      idempotencyKey: "issue-recovery-restore-1",
    });
    const resultPage = {
      type: "epoch_result_page",
      page: {
        pageId: "page_recovery_restore",
        createdAt: "2026-06-26T00:06:00.000Z",
        urlPath: "/epoch/result/page_recovery_restore",
        payload: { pageType: "agent_result", generatedAt: "2026-06-26T00:06:00.000Z", progress: {} },
        createdBy: "explorer_recovery_restore",
        idempotencyKey: "result_page:recovery_restore",
      },
    };

    await writeJsonl(path.join(sourceDir, "epoch-events.jsonl"), identity.events.map((event) => ({
      type: "epoch_event",
      event,
    })));
    await writeJsonl(path.join(sourceDir, "result-pages.jsonl"), [resultPage]);
    await writeJsonl(playerMcpTokenJsonlPath, [
      tokenIssueRecord("token_restore_1", "b", "explorer_recovery_restore"),
      { type: "revokeToken", tokenId: "token_restore_1", revokedAt: "2026-06-26T00:06:30.000Z" },
    ]);
    await migrateJsonlDataDirToSqlite({ sourceDataDir: sourceDir, dbPath });

    const backup = await createRecoveryBackup({
      sourceDataDir: sourceDir,
      sqlitePath: dbPath,
      playerMcpTokenJsonlPath,
      backupRoot,
      generatedAt: new Date("2026-06-26T00:07:00.000Z"),
      keepLast: 3,
    });
    const restore = await restoreRecoveryBackup({
      backupPath: backup.backupPath,
      targetDataDir: restoreDir,
      targetSqlitePath: restoreSqlitePath,
      targetPlayerMcpTokenJsonlPath: restorePlayerMcpTokenJsonlPath,
      generatedAt: new Date("2026-06-26T00:08:00.000Z"),
    });
    const restoredJsonlManifest = await createJsonlRecoveryManifest(restoreDir, new Date("2026-06-26T00:09:00.000Z"));
    const restoredSqliteManifest = await createSqliteRecoveryManifest(
      restoreSqlitePath,
      new Date("2026-06-26T00:09:00.000Z"),
    );
    const restoredFiles = (await readdir(restoreDir)).sort();

    assert.equal(restore.ok, true);
    assert.equal(restore.backupId, backup.backupId);
    assert.equal(restore.verification.ok, true);
    assert.equal(restore.restored.jsonl?.manifest.manifestSha256, backup.manifests.jsonl?.backup.manifestSha256);
    assert.equal(restore.restored.sqlite?.manifest.manifestSha256, backup.manifests.sqlite?.backup.manifestSha256);
    assert.equal(restore.restored.playerMcpAccessTokens?.records, 2);
    assert.equal(
      restore.restored.playerMcpAccessTokens?.sha256,
      backup.auxiliary?.playerMcpAccessTokens?.sha256,
    );
    assert.equal(
      await readFile(restorePlayerMcpTokenJsonlPath, "utf8"),
      await readFile(playerMcpTokenJsonlPath, "utf8"),
    );
    const restoredTokenStore = await PlayerMcpAccessTokenStore.open({ jsonlPath: restorePlayerMcpTokenJsonlPath });
    assert.equal(restoredTokenStore.get("token_restore_1")?.revokedAt, "2026-06-26T00:06:30.000Z");
    assert.equal(restoredJsonlManifest.epochEvents.latestEventId, identity.events[0].eventId);
    assert.equal(restoredSqliteManifest.resultPages.latestPageId, "page_recovery_restore");
    assert.ok(restoredFiles.includes("epoch-events.jsonl"));
    assert.ok(restoredFiles.includes("result-pages.jsonl"));

    await assert.rejects(
      () => restoreRecoveryBackup({
        backupPath: backup.backupPath,
        targetDataDir: restoreDir,
        targetSqlitePath: restoreSqlitePath,
      }),
      /restore_target_exists/,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("multi-domain restore removes every staging and published target when the final domain fails", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-restore-atomic-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const backupRoot = path.join(tempDir, "backups");
  const dbPath = path.join(tempDir, "source.sqlite");
  const tokenLedgerPath = path.join(tempDir, "credentials", "player-mcp-access-tokens.jsonl");
  const targetDataDir = path.join(tempDir, "target-jsonl");
  const targetSqlitePath = path.join(tempDir, "target.sqlite");
  const targetTokenPath = path.join(tempDir, "target-player-tokens.jsonl");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(tokenLedgerPath), { recursive: true });
  const core = createEpochGameCore({ idFactory: createSequentialEpochIdFactory("restore_atomic") });
  const identity = core.issueIdentity({
    explorerId: "explorer_restore_atomic",
    identityName: "原子恢复验证者",
  }, {
    actorExplorerId: "explorer_restore_atomic",
    trustClass: "untrusted_client",
    idempotencyKey: "restore-atomic-identity-1",
  });
  await writeJsonl(path.join(sourceDir, "epoch-events.jsonl"), identity.events.map((event) => ({
    type: "epoch_event",
    event,
  })));
  await writeJsonl(tokenLedgerPath, [
    tokenIssueRecord("token_restore_atomic", "f", "explorer_restore_atomic"),
  ]);
  await migrateJsonlDataDirToSqlite({ sourceDataDir: sourceDir, dbPath });

  try {
    const backup = await createRecoveryBackup({
      sourceDataDir: sourceDir,
      sqlitePath: dbPath,
      playerMcpTokenJsonlPath: tokenLedgerPath,
      backupRoot,
    });
    const tokenBackupPath = path.join(backup.backupPath, "auxiliary", "player-mcp-access-tokens.jsonl");
    const invalidTokenLedger = Buffer.from(`${JSON.stringify({ type: "issue" })}\n`, "utf8");
    const invalidSha = createHash("sha256").update(invalidTokenLedger).digest("hex");
    await writeFile(tokenBackupPath, invalidTokenLedger);
    const manifest = JSON.parse(await readFile(backup.manifestPath, "utf8"));
    const fileEntry = manifest.files.find((entry: { relativePath: string }) => (
      entry.relativePath === "auxiliary/player-mcp-access-tokens.jsonl"
    ));
    fileEntry.bytes = invalidTokenLedger.byteLength;
    fileEntry.sha256 = invalidSha;
    manifest.auxiliary.playerMcpAccessTokens.bytes = invalidTokenLedger.byteLength;
    manifest.auxiliary.playerMcpAccessTokens.sha256 = invalidSha;
    manifest.auxiliary.playerMcpAccessTokens.records = 1;
    manifest.consistency.playerTokenLedgerSha256 = invalidSha;
    await writeFile(backup.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await assert.rejects(
      () => restoreRecoveryBackup({
        backupPath: backup.backupPath,
        targetDataDir,
        targetSqlitePath,
        targetPlayerMcpTokenJsonlPath: targetTokenPath,
      }),
      /player_mcp_token_ledger_corrupt/,
    );
    await assert.rejects(() => readdir(targetDataDir), /ENOENT/);
    await assert.rejects(() => readFile(targetSqlitePath), /ENOENT/);
    await assert.rejects(() => readFile(targetTokenPath), /ENOENT/);
    const leftovers = (await readdir(tempDir)).filter((entry) => entry.includes(".restore-"));
    assert.deepEqual(leftovers, []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("backup and restore CLIs carry the configured player MCP token ledger independently", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-recovery-cli-"));
  const sourceDir = path.join(tempDir, "jsonl");
  const tokenLedgerPath = path.join(tempDir, "credentials", "tokens.jsonl");
  const backupRoot = path.join(tempDir, "backups");
  const restoredDataDir = path.join(tempDir, "restored-jsonl");
  const restoredTokenLedgerPath = path.join(tempDir, "restored-credentials", "tokens.jsonl");
  const signing = backupSigningMaterial();
  const privateKeyPath = path.join(tempDir, "backup-private.pem");
  const publicKeyPath = path.join(tempDir, "backup-public.txt");
  const checkpointPath = path.join(tempDir, "backup-checkpoint.json");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(tokenLedgerPath), { recursive: true });
  const core = createEpochGameCore({ idFactory: createSequentialEpochIdFactory("recovery_cli") });
  const identity = core.issueIdentity({
    explorerId: "explorer_token_cli_1",
    identityName: "命令行恢复验证者",
  }, {
    actorExplorerId: "explorer_token_cli_1",
    trustClass: "untrusted_client",
    idempotencyKey: "issue-recovery-cli-1",
  });
  await writeJsonl(path.join(sourceDir, "epoch-events.jsonl"), identity.events.map((event) => ({
    type: "epoch_event",
    event,
  })));
  await writeJsonl(tokenLedgerPath, [
    tokenIssueRecord("token_cli_1", "c", "explorer_token_cli_1"),
  ]);
  await writeFile(privateKeyPath, signing.privateKeyPem, { mode: 0o600 });
  const signingKeyId = createHash("sha256").update(Buffer.from(signing.publicKeyBase64, "base64")).digest("hex");
  await writeFile(publicKeyPath, JSON.stringify({
    version: 1,
    keys: [{ keyId: signingKeyId, publicKey: signing.publicKeyBase64, status: "active" }],
  }), { mode: 0o600 });

  try {
    const backupResult = await runCli(path.resolve(import.meta.dirname, "../backup.ts"), [
      "--source",
      sourceDir,
      "--backup-root",
      backupRoot,
      "--jsonl-only",
      "--json",
    ], {
      NODE_ENV: "production",
      AGENT_SERVER_MCP_PLAYER_TOKEN_JSONL_PATH: tokenLedgerPath,
      AGENT_SERVER_BACKUP_SIGNING_PRIVATE_KEY_FILE: privateKeyPath,
    });
    assert.equal(backupResult.code, 0, backupResult.stderr || backupResult.stdout);
    const backup = JSON.parse(backupResult.stdout.trim());
    assert.equal(backup.auxiliary.playerMcpAccessTokens.records, 1);
    assert.equal(backup.signature.algorithm, "Ed25519");
    assert.equal(backup.checkpoint.manifestSha256, backup.signature.manifestSha256);
    assert.doesNotMatch(backupResult.stdout, /BEGIN PRIVATE KEY/);
    await writeFile(checkpointPath, `${JSON.stringify(backup.checkpoint)}\n`, { mode: 0o600 });

    const missingCheckpoint = await runCli(path.resolve(import.meta.dirname, "../restore-backup.ts"), [
      "--backup",
      backup.backupPath,
      "--target-source",
      restoredDataDir,
      "--json",
    ], {
      NODE_ENV: "production",
      AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE: publicKeyPath,
    });
    assert.notEqual(missingCheckpoint.code, 0);
    assert.match(missingCheckpoint.stderr || missingCheckpoint.stdout, /recovery_backup_trusted_checkpoint_required/);
    await assert.rejects(() => readdir(restoredDataDir), /ENOENT/);

    const restoreResult = await runCli(path.resolve(import.meta.dirname, "../restore-backup.ts"), [
      "--backup",
      backup.backupPath,
      "--target-source",
      restoredDataDir,
      "--json",
    ], {
      NODE_ENV: "production",
      AGENT_SERVER_RESTORE_MCP_PLAYER_TOKEN_JSONL_PATH: restoredTokenLedgerPath,
      AGENT_SERVER_BACKUP_VERIFICATION_PUBLIC_KEY_FILE: publicKeyPath,
      AGENT_SERVER_BACKUP_TRUSTED_CHECKPOINT_FILE: checkpointPath,
    });
    assert.equal(restoreResult.code, 0, restoreResult.stderr || restoreResult.stdout);
    const restore = JSON.parse(restoreResult.stdout.trim());
    assert.equal(restore.restored.playerMcpAccessTokens.records, 1);
    assert.equal(restore.verification.signature.verified, true);
    assert.equal(restore.verification.checkpoint.verified, true);
    assert.equal(await readFile(restoredTokenLedgerPath, "utf8"), await readFile(tokenLedgerPath, "utf8"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
