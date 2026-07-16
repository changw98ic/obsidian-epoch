import assert from "node:assert/strict";
import { appendFile, mkdir, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  PlayerMcpAccessTokenStore,
  PublicRegistrationRateLimitError,
  hashBearerToken,
} from "../lib/playerMcpAccessTokenStore.ts";
import { hashPublicRegistrationActor } from "../lib/publicRegistrationProtection.ts";

async function withTempStorePath(run: (jsonlPath: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "player-mcp-access-token-store-"));
  try {
    await run(join(directory, "tokens.jsonl"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function fixedNow(iso: string): () => Date {
  return () => new Date(iso);
}

test("issues opaque bearer tokens and never persists plaintext", async () => {
  await withTempStorePath(async (jsonlPath) => {
    const store = await PlayerMcpAccessTokenStore.open({ jsonlPath, now: fixedNow("2026-01-01T00:00:00.000Z") });
    const issued = await store.issue({ explorerId: "explorer_plaintext", ttlMs: 60_000 });
    const persisted = await readFile(jsonlPath, "utf8");

    assert.match(issued.bearerToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(issued.bearerToken, "base64url").byteLength, 32);
    assert.equal(persisted.includes(issued.bearerToken), false);
    assert.match(persisted, /"tokenHash":"sha256:[a-f0-9]{64}"/);
    assert.equal(hashBearerToken(issued.bearerToken).startsWith("sha256:"), true);
  });
});

test("opening a persistent store creates an empty private ledger for backup", async () => {
  await withTempStorePath(async (jsonlPath) => {
    const store = await PlayerMcpAccessTokenStore.open({ jsonlPath });
    const metadata = await stat(jsonlPath);

    assert.equal(store.persistent, true);
    assert.equal(await readFile(jsonlPath, "utf8"), "");
    assert.equal(metadata.mode & 0o777, 0o600);
  });
});

test("recovers issued and revoked records from jsonl after restart", async () => {
  await withTempStorePath(async (jsonlPath) => {
    const store = await PlayerMcpAccessTokenStore.open({ jsonlPath, now: fixedNow("2026-01-01T00:00:00.000Z") });
    const active = await store.issue({ explorerId: "explorer_recover_active", ttlMs: 60_000 });
    const revoked = await store.issue({ explorerId: "explorer_recover_revoked", ttlMs: 60_000 });
    await store.revokeToken(revoked.record.tokenId);

    const recovered = await PlayerMcpAccessTokenStore.open({ jsonlPath, now: fixedNow("2026-01-01T00:00:01.000Z") });

    assert.deepEqual(recovered.authenticate(active.bearerToken), active.record);
    assert.equal(recovered.authenticate(revoked.bearerToken), null);
    assert.equal(recovered.get(revoked.record.tokenId)?.revokedAt, "2026-01-01T00:00:00.000Z");
  });
});

test("rejects expired tokens", async () => {
  let now = new Date("2026-01-01T00:00:00.000Z");
  const store = await PlayerMcpAccessTokenStore.open({ now: () => now });
  const issued = await store.issue({ explorerId: "explorer_expired", ttlMs: 1_000 });

  assert.equal(store.authenticate(issued.bearerToken)?.tokenId, issued.record.tokenId);
  now = new Date("2026-01-01T00:00:01.000Z");
  assert.equal(store.authenticate(issued.bearerToken), null);
});

test("rejects tokens revoked individually or by explorer", async () => {
  const store = await PlayerMcpAccessTokenStore.open({ now: fixedNow("2026-01-01T00:00:00.000Z") });
  const first = await store.issue({ explorerId: "explorer_revoke", ttlMs: 60_000 });
  const second = await store.issue({ explorerId: "explorer_revoke", ttlMs: 60_000 });
  const other = await store.issue({ explorerId: "explorer_other", ttlMs: 60_000 });

  await store.revokeToken(first.record.tokenId);
  assert.equal(store.authenticate(first.bearerToken), null);
  assert.equal(store.authenticate(second.bearerToken)?.tokenId, second.record.tokenId);

  const revokedExplorerRecords = await store.revokeExplorer("explorer_revoke");
  assert.equal(revokedExplorerRecords.length, 1);
  assert.equal(store.authenticate(second.bearerToken), null);
  assert.equal(store.authenticate(other.bearerToken)?.tokenId, other.record.tokenId);
});

test("different tokens authenticate only their own records", async () => {
  const store = await PlayerMcpAccessTokenStore.open({ now: fixedNow("2026-01-01T00:00:00.000Z") });
  const first = await store.issue({ explorerId: "explorer_one", ttlMs: 60_000 });
  const second = await store.issue({ explorerId: "explorer_two", ttlMs: 60_000 });

  assert.notEqual(first.bearerToken, second.bearerToken);
  assert.notEqual(first.record.tokenId, second.record.tokenId);
  assert.deepEqual(store.authenticate(first.bearerToken), first.record);
  assert.deepEqual(store.authenticate(second.bearerToken), second.record);
  assert.equal(store.authenticate(`${first.bearerToken}x`), null);
});

test("a failed ledger append does not poison later token writes or fake revocation success", async () => {
  await withTempStorePath(async (jsonlPath) => {
    const store = await PlayerMcpAccessTokenStore.open({ jsonlPath, now: fixedNow("2026-01-01T00:00:00.000Z") });
    await rm(jsonlPath);
    await mkdir(jsonlPath);
    await assert.rejects(
      () => store.issue({ explorerId: "explorer_retry_issue", ttlMs: 60_000 }),
    );
    await rm(jsonlPath, { recursive: true });
    const issued = await store.issue({ explorerId: "explorer_retry_issue", ttlMs: 60_000 });
    assert.equal(store.authenticate(issued.bearerToken)?.tokenId, issued.record.tokenId);

    const backupPath = `${jsonlPath}.backup`;
    await rename(jsonlPath, backupPath);
    await mkdir(jsonlPath);
    await assert.rejects(() => store.revokeToken(issued.record.tokenId));
    assert.equal(store.authenticate(issued.bearerToken)?.tokenId, issued.record.tokenId);
    await rm(jsonlPath, { recursive: true });
    await rename(backupPath, jsonlPath);
    await store.revokeToken(issued.record.tokenId);
    assert.equal(store.authenticate(issued.bearerToken), null);
  });
});

test("restart atomically removes an incomplete trailing line before later appends and a second restart", async () => {
  await withTempStorePath(async (jsonlPath) => {
    const store = await PlayerMcpAccessTokenStore.open({ jsonlPath, now: fixedNow("2026-01-01T00:00:00.000Z") });
    const issued = await store.issue({ explorerId: "explorer_partial_ledger", ttlMs: 60_000 });
    const completeLedger = await readFile(jsonlPath, "utf8");
    await appendFile(jsonlPath, '{"type":"issue"', "utf8");

    const recovered = await PlayerMcpAccessTokenStore.open({
      jsonlPath,
      now: fixedNow("2026-01-01T00:00:01.000Z"),
    });
    assert.equal(recovered.authenticate(issued.bearerToken)?.tokenId, issued.record.tokenId);
    assert.equal(await readFile(jsonlPath, "utf8"), completeLedger);
    assert.equal((await stat(jsonlPath)).mode & 0o777, 0o600);

    await recovered.revokeToken(issued.record.tokenId);
    const restarted = await PlayerMcpAccessTokenStore.open({
      jsonlPath,
      now: fixedNow("2026-01-01T00:00:02.000Z"),
    });
    assert.equal(restarted.authenticate(issued.bearerToken), null);
    assert.equal(restarted.get(issued.record.tokenId)?.revokedAt, "2026-01-01T00:00:01.000Z");
    assert.equal((await readFile(jsonlPath, "utf8")).split("\n").filter(Boolean).length, 2);

    await appendFile(jsonlPath, '{"type":"issue"}\n', "utf8");
    await assert.rejects(
      () => PlayerMcpAccessTokenStore.open({ jsonlPath }),
      /player_mcp_token_ledger_corrupt/,
    );
  });
});

test("persists one shared quota for pairing registration and player token issuance across restart", async () => {
  await withTempStorePath(async (jsonlPath) => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const secret = "actor-hash-secret-used-only-for-unit-tests-123456";
    const actorHash = hashPublicRegistrationActor(secret, "ip", "203.0.113.10");
    const store = await PlayerMcpAccessTokenStore.open({ jsonlPath, now: () => now });
    const limits = {
      actorHashes: [actorHash],
      windowMs: 60_000,
      maxActions: 2,
      cooldownMs: 10_000,
    } as const;

    await store.consumePublicCredentialAction({ ...limits, action: "pairing_registration" });
    await store.consumePublicCredentialAction({ ...limits, action: "player_token_issuance" });
    await assert.rejects(
      () => store.consumePublicCredentialAction({ ...limits, action: "player_token_issuance" }),
      (error: unknown) => {
        assert.ok(error instanceof PublicRegistrationRateLimitError);
        assert.equal(error.retryAfterMs, 60_000);
        assert.equal(error.retryAt, "2026-01-01T00:01:00.000Z");
        return true;
      },
    );

    now = new Date("2026-01-01T00:00:15.000Z");
    const recovered = await PlayerMcpAccessTokenStore.open({ jsonlPath, now: () => now });
    await assert.rejects(
      () => recovered.consumePublicCredentialAction({ ...limits, action: "pairing_registration" }),
      (error: unknown) => {
        assert.ok(error instanceof PublicRegistrationRateLimitError);
        assert.equal(error.retryAfterMs, 45_000);
        return true;
      },
    );

    const persisted = await readFile(jsonlPath, "utf8");
    assert.equal(persisted.includes("203.0.113.10"), false);
    assert.equal(persisted.includes(secret), false);
    assert.match(persisted, /"actorHashes":\["hmac-sha256:[a-f0-9]{64}"\]/);
  });
});

test("serializes concurrent public credential admissions so quota cannot be raced", async () => {
  await withTempStorePath(async (jsonlPath) => {
    const store = await PlayerMcpAccessTokenStore.open({
      jsonlPath,
      now: fixedNow("2026-01-01T00:00:00.000Z"),
    });
    const actorHash = hashPublicRegistrationActor(
      "concurrent-actor-hash-secret-at-least-32-characters",
      "ip",
      "198.51.100.25",
    );
    const attempts = await Promise.allSettled([
      store.consumePublicCredentialAction({
        action: "pairing_registration",
        actorHashes: [actorHash],
        windowMs: 60_000,
        maxActions: 1,
        cooldownMs: 0,
      }),
      store.consumePublicCredentialAction({
        action: "player_token_issuance",
        actorHashes: [actorHash],
        windowMs: 60_000,
        maxActions: 1,
        cooldownMs: 0,
      }),
    ]);

    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
    const persisted = await readFile(jsonlPath, "utf8");
    assert.equal(persisted.split("\n").filter(Boolean).length, 1);
  });
});

test("retry time remains sufficient when operators lower an existing actor quota", async () => {
  let now = new Date("2026-01-01T00:00:00.000Z");
  const store = await PlayerMcpAccessTokenStore.open({ now: () => now });
  const actorHash = hashPublicRegistrationActor(
    "lowered-quota-actor-hash-secret-at-least-32-characters",
    "ip",
    "192.0.2.44",
  );
  for (const seconds of [0, 5, 10]) {
    now = new Date(`2026-01-01T00:00:${String(seconds).padStart(2, "0")}.000Z`);
    await store.consumePublicCredentialAction({
      action: "pairing_registration",
      actorHashes: [actorHash],
      windowMs: 60_000,
      maxActions: 3,
      cooldownMs: 0,
    });
  }

  now = new Date("2026-01-01T00:00:15.000Z");
  await assert.rejects(
    () => store.consumePublicCredentialAction({
      action: "player_token_issuance",
      actorHashes: [actorHash],
      windowMs: 60_000,
      maxActions: 2,
      cooldownMs: 0,
    }),
    (error: unknown) => {
      assert.ok(error instanceof PublicRegistrationRateLimitError);
      assert.equal(error.retryAt, "2026-01-01T00:01:05.000Z");
      assert.equal(error.retryAfterMs, 50_000);
      return true;
    },
  );
});
