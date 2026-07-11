import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPendingExplorerRecoveryRotation,
  createExplorerIdentityFromRegistration,
  createRotatedExplorerRecovery,
  exportEncryptedExplorerArchive,
  importEncryptedExplorerArchive,
  loadExplorerIdentity,
  loadPendingExplorerRecoveryRotation,
  savePendingExplorerRecoveryRotation,
  saveExplorerIdentity,
} from "./localIdentity";
import type { ExplorerIdentity } from "../types";

const explorer: ExplorerIdentity = {
  explorerId: "explorer_archive_001",
  displayName: "探索者 0001",
  localSecret: "local_archive_secret_001",
  recoveryCode: btoa(JSON.stringify({
    explorerId: "explorer_archive_001",
    localSecret: "local_archive_secret_001",
  })),
  createdAt: "2026-06-25T00:00:00.000Z",
};

function withMockLocalStorage(
  stored: Record<string, string>,
  callback: (writes: { readonly key: string; readonly value: string }[]) => void,
): void {
  const writes: { key: string; value: string }[] = [];
  const originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => stored[key] ?? null,
      setItem: (key: string, value: string) => {
        writes.push({ key, value });
        stored[key] = value;
      },
      removeItem: (key: string) => {
        delete stored[key];
      },
    },
  });

  try {
    callback(writes);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  }
}

test("loadExplorerIdentity returns null and does not write localStorage when no explorer is stored", () => {
  withMockLocalStorage({}, (writes) => {
    assert.equal(loadExplorerIdentity(), null);

    assert.deepEqual(writes, []);
  });
});

test("loadExplorerIdentity loads an existing stored explorer identity", () => {
  withMockLocalStorage({
    obsidian_epoch_agent_explorer: JSON.stringify(explorer),
  }, (writes) => {
    assert.deepEqual(loadExplorerIdentity(), explorer);

    assert.deepEqual(writes, []);
  });
});

test("server registration material becomes a validated local explorer identity", () => {
  const explorerId = "explorer_0123456789abcdef0123456789abcdef";
  const localSecret = "local_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const recoveryCode = btoa(JSON.stringify({ explorerId, localSecret }));

  const registered = createExplorerIdentityFromRegistration({ explorerId, recoveryCode });

  assert.equal(registered.explorerId, explorerId);
  assert.equal(registered.localSecret, localSecret);
  assert.equal(registered.recoveryCode, recoveryCode);
});

test("pending recovery rotation keeps both credentials until durable commit", () => {
  withMockLocalStorage({}, () => {
    const next = createRotatedExplorerRecovery(explorer);
    const rotation = {
      previous: explorer,
      next,
      idempotencyKey: "rotate-recovery-durable-1",
    };

    savePendingExplorerRecoveryRotation(rotation);
    assert.deepEqual(loadPendingExplorerRecoveryRotation(), rotation);
    assert.equal(clearPendingExplorerRecoveryRotation(), true);
    assert.equal(loadPendingExplorerRecoveryRotation(), null);
  });
});

test("encrypted explorer archive hides local secret material and round-trips identity", async () => {
  const archive = await exportEncryptedExplorerArchive(explorer, "correct horse battery staple");

  assert.doesNotMatch(archive, /local_archive_secret_001/);
  assert.doesNotMatch(archive, new RegExp(explorer.recoveryCode));
  assert.doesNotMatch(archive, /explorer_archive_001/);

  const imported = await importEncryptedExplorerArchive(archive, "correct horse battery staple");

  assert.deepEqual(imported, explorer);
});

test("encrypted explorer archive rejects wrong passphrases", async () => {
  const archive = await exportEncryptedExplorerArchive(explorer, "correct horse battery staple");

  await assert.rejects(
    () => importEncryptedExplorerArchive(archive, "wrong horse battery staple"),
    /explorer_archive_decrypt_failed/,
  );
});

test("encrypted explorer archive rejects identities with forged recovery material", async () => {
  await assert.rejects(
    () => exportEncryptedExplorerArchive({
      ...explorer,
      recoveryCode: btoa(JSON.stringify({
        explorerId: "explorer_archive_001",
        localSecret: "local_forged_secret",
      })),
    }, "correct horse battery staple"),
    /invalid_explorer_identity/,
  );
});

test("saveExplorerIdentity persists an imported archive identity", async () => {
  const stored: Record<string, string> = {};
  const originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => stored[key] ?? null,
      setItem: (key: string, value: string) => {
        stored[key] = value;
      },
    },
  });

  try {
    const archive = await exportEncryptedExplorerArchive(explorer, "correct horse battery staple");
    const imported = await importEncryptedExplorerArchive(archive, "correct horse battery staple");
    saveExplorerIdentity(imported);

    assert.ok(Object.values(stored).some((value) => value.includes("explorer_archive_001")));
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});
