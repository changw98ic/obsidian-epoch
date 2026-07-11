import assert from "node:assert/strict";
import test from "node:test";
import type { ExplorerIdentity } from "../types";
import type { PendingExplorerRecoveryRotation } from "./localIdentity";
import { completeExplorerRecoveryRotationTransaction } from "./recoveryRotationController";

const previous: ExplorerIdentity = {
  explorerId: "explorer_rotation_test",
  displayName: "探索者 test",
  localSecret: "local_rotation_previous",
  recoveryCode: btoa(JSON.stringify({
    explorerId: "explorer_rotation_test",
    localSecret: "local_rotation_previous",
  })),
  createdAt: "2026-07-10T00:00:00.000Z",
};

const next: ExplorerIdentity = {
  ...previous,
  localSecret: "local_rotation_next",
  recoveryCode: btoa(JSON.stringify({
    explorerId: "explorer_rotation_test",
    localSecret: "local_rotation_next",
  })),
};

const rotation: PendingExplorerRecoveryRotation = {
  previous,
  next,
  idempotencyKey: "rotation-transaction-test-1",
};

function transaction(overrides: Partial<Parameters<typeof completeExplorerRecoveryRotationTransaction>[0]> = {}) {
  return {
    rotation,
    resumeAfterReload: false,
    stagePending: () => undefined,
    rotateOnServer: async () => undefined,
    verifyNextCredential: async () => undefined,
    exposeAcceptedCredential: () => undefined,
    persistAcceptedCredential: () => undefined,
    clearPending: () => true,
    ...overrides,
  };
}

test("recovery rotation never reaches the server when pending storage fails", async () => {
  let serverCalls = 0;
  await assert.rejects(
    () => completeExplorerRecoveryRotationTransaction(transaction({
      stagePending: () => {
        throw new Error("storage_unavailable");
      },
      rotateOnServer: async () => {
        serverCalls += 1;
      },
    })),
    /storage_unavailable/,
  );
  assert.equal(serverCalls, 0);
});

test("accepted recovery remains exposed and pending when durable save fails", async () => {
  let exposed = false;
  let cleared = false;
  await assert.rejects(
    () => completeExplorerRecoveryRotationTransaction(transaction({
      exposeAcceptedCredential: () => {
        exposed = true;
      },
      persistAcceptedCredential: () => {
        throw new Error("quota_exceeded");
      },
      clearPending: () => {
        cleared = true;
        return true;
      },
    })),
    /recovery_rotated_local_save_failed/,
  );
  assert.equal(exposed, true);
  assert.equal(cleared, false);
});

test("reload verifies the proposed credential after a persisted server rotation", async () => {
  let verified = false;
  let persisted = false;
  await completeExplorerRecoveryRotationTransaction(transaction({
    resumeAfterReload: true,
    rotateOnServer: async () => {
      throw new Error("explorer_auth_invalid");
    },
    verifyNextCredential: async () => {
      verified = true;
    },
    persistAcceptedCredential: () => {
      persisted = true;
    },
  }));
  assert.equal(verified, true);
  assert.equal(persisted, true);
});

test("reload keeps pending state when neither credential can be verified", async () => {
  let exposed = false;
  await assert.rejects(
    () => completeExplorerRecoveryRotationTransaction(transaction({
      resumeAfterReload: true,
      rotateOnServer: async () => {
        throw new Error("explorer_auth_invalid");
      },
      verifyNextCredential: async () => {
        throw new Error("explorer_auth_required");
      },
      exposeAcceptedCredential: () => {
        exposed = true;
      },
    })),
    /explorer_auth_required/,
  );
  assert.equal(exposed, false);
});
