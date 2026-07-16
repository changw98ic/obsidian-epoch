import type { EpochEvent } from "./events.ts";
import {
  assertNonEmptyString,
  type EpochCommandContext,
} from "./protocol.ts";
import type {
  EpochProjection,
  EpochRecoveryRotation,
  RotateExplorerRecoveryInput,
} from "./gameCore.ts";
import {
  explorerAuthCredentialFromInput,
  hashValuesMatch,
} from "./runtimeAuth.ts";
import type { EpochRuntimeResult } from "./runtimePublicProjectionRules.ts";
import { currentMcpRequestAuthContext } from "../mcpRequestAuthContext.ts";

type AnyRecord = Record<string, unknown>;

export interface ExplorerAuthRuntimeOptions {
  readonly initialEvents?: readonly EpochEvent[];
  readonly project: () => EpochProjection;
  readonly publicProjection: (projection: EpochProjection) => EpochProjection;
  readonly assertAbuseAllowed: (input: AnyRecord, options?: { readonly allowRestrictedScore?: boolean }) => void;
  readonly ownerVerifiedContextFromInput: (input: AnyRecord, explorerId: string) => EpochCommandContext;
  readonly rotateExplorerRecovery: (
    input: RotateExplorerRecoveryInput,
    context: EpochCommandContext,
  ) => EpochRuntimeResult<EpochRecoveryRotation>;
}

function recordValue(value: unknown): AnyRecord {
  return value && typeof value === "object" ? value as AnyRecord : {};
}

export function createExplorerAuthRuntime(options: ExplorerAuthRuntimeOptions) {
  const explorerSecretHashes = new Map<string, string>();
  const rotateRecoveryResults = new Map<string, EpochRuntimeResult<EpochRecoveryRotation>>();

  function hydrateEvent(event: EpochEvent) {
    if (event.eventType !== "identity_issued" && event.eventType !== "explorer_recovery_rotated") return;
    const payload = recordValue(event.payload);
    if (typeof payload.explorerId === "string" && typeof payload.explorerSecretHash === "string") {
      explorerSecretHashes.set(payload.explorerId, payload.explorerSecretHash);
    }
  }

  for (const event of options.initialEvents || []) {
    hydrateEvent(event);
  }

  function hasExplorerAuth(explorerId: string) {
    return explorerSecretHashes.has(explorerId);
  }

  function registerExplorerAuth(input: AnyRecord, explorerId: string) {
    const credential = explorerAuthCredentialFromInput(input, explorerId);
    if (!credential) return explorerSecretHashes.get(explorerId);
    const existing = explorerSecretHashes.get(explorerId);
    if (existing && !hashValuesMatch(existing, credential.explorerSecretHash)) {
      throw new Error("explorer_auth_invalid");
    }
    explorerSecretHashes.set(explorerId, credential.explorerSecretHash);
    return credential.explorerSecretHash;
  }

  function assertExplorerAuth(input: AnyRecord, explorerId: string) {
    const requestAuth = currentMcpRequestAuthContext();
    if (requestAuth?.kind === "player" && requestAuth.explorerId === explorerId) return;
    const expectedHash = explorerSecretHashes.get(explorerId);
    const credential = explorerAuthCredentialFromInput(input, explorerId);
    if (!credential) throw new Error("explorer_auth_required");
    if (!expectedHash) throw new Error("explorer_auth_required");
    if (!hashValuesMatch(expectedHash, credential.explorerSecretHash)) {
      throw new Error("explorer_auth_invalid");
    }
  }

  function rotateExplorerRecovery(input: AnyRecord = {}) {
    const explorerId = assertNonEmptyString(input.explorerId, "explorer_id");
    if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim().length === 0) {
      throw new Error("idempotency_key_required");
    }
    const currentCredential = explorerAuthCredentialFromInput(input, explorerId);
    if (!currentCredential) throw new Error("explorer_auth_required");
    const newCredential = explorerAuthCredentialFromInput({ recoveryCode: input.newRecoveryCode }, explorerId);
    if (!newCredential) throw new Error("new_recovery_code_required");

    const key = `rotate_recovery:${input.idempotencyKey.trim()}`;
    const cached = rotateRecoveryResults.get(key);
    const expectedHash = explorerSecretHashes.get(explorerId);
    if (!expectedHash) throw new Error("explorer_auth_required");
    if (cached) {
      if (
        !hashValuesMatch(expectedHash, currentCredential.explorerSecretHash)
        && !hashValuesMatch(expectedHash, newCredential.explorerSecretHash)
      ) {
        throw new Error("explorer_auth_invalid");
      }
      return {
        ...cached,
        events: [],
        projection: options.publicProjection(options.project()),
        duplicate: true,
      };
    }
    if (!hashValuesMatch(expectedHash, currentCredential.explorerSecretHash)) {
      throw new Error("explorer_auth_invalid");
    }
    if (hashValuesMatch(currentCredential.explorerSecretHash, newCredential.explorerSecretHash)) {
      throw new Error("new_recovery_code_unchanged");
    }

    options.assertAbuseAllowed(input, { allowRestrictedScore: true });
    const result = options.rotateExplorerRecovery({
      explorerId,
      explorerSecretHash: newCredential.explorerSecretHash,
    }, options.ownerVerifiedContextFromInput(input, explorerId));
    explorerSecretHashes.set(explorerId, newCredential.explorerSecretHash);
    rotateRecoveryResults.set(key, result);
    return result;
  }

  return {
    hydrateEvent,
    hasExplorerAuth,
    registerExplorerAuth,
    assertExplorerAuth,
    rotateExplorerRecovery,
  };
}
