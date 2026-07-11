import type { PendingExplorerRecoveryRotation } from "./localIdentity";

export interface ExplorerRecoveryRotationTransaction {
  readonly rotation: PendingExplorerRecoveryRotation;
  readonly resumeAfterReload: boolean;
  readonly stagePending: () => void;
  readonly rotateOnServer: () => Promise<void>;
  readonly verifyNextCredential: () => Promise<void>;
  readonly exposeAcceptedCredential: () => void;
  readonly persistAcceptedCredential: () => void;
  readonly clearPending: () => boolean;
}

export async function completeExplorerRecoveryRotationTransaction(
  transaction: ExplorerRecoveryRotationTransaction,
): Promise<void> {
  if (!transaction.resumeAfterReload) transaction.stagePending();

  try {
    await transaction.rotateOnServer();
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";
    if (!transaction.resumeAfterReload || code !== "explorer_auth_invalid") throw cause;
    await transaction.verifyNextCredential();
  }

  transaction.exposeAcceptedCredential();
  try {
    transaction.persistAcceptedCredential();
  } catch {
    throw new Error("recovery_rotated_local_save_failed");
  }
  transaction.clearPending();
}
