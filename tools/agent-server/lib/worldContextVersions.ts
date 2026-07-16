import { createHash } from "node:crypto";
import { EPOCH_PROTOCOL_VERSION } from "./epoch/protocol.ts";

export const EPOCH_CONTEXT_PACK_VERSION = "obsidian-epoch-context-pack-2026-07-01";
export const EPOCH_ADJUDICATOR_VERSION = "obsidian-epoch-adjudicator-alpha1-2026-06-24";

export interface EpochWorldContextVersions {
  readonly worldVersion: string;
  readonly sharedLoreSnapshotVersion: string;
  readonly adjudicatorVersion: string;
  readonly contextPackVersion: string;
}

export interface EpochWorldContextVersionInput {
  readonly sharedLoreSnapshotParts?: readonly string[];
}

export function createSharedLoreSnapshotVersion(parts: readonly string[] = []) {
  const normalizedParts = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const hash = createHash("sha256");
  hash.update("obsidian-epoch-shared-lore-snapshot\n");
  for (const part of normalizedParts) {
    hash.update(part);
    hash.update("\n");
  }
  return `shared-lore:${normalizedParts.length}:${hash.digest("hex").slice(0, 16)}`;
}

export function createWorldContextVersions(
  input: EpochWorldContextVersionInput = {},
): EpochWorldContextVersions {
  return {
    worldVersion: EPOCH_PROTOCOL_VERSION,
    sharedLoreSnapshotVersion: createSharedLoreSnapshotVersion(input.sharedLoreSnapshotParts),
    adjudicatorVersion: EPOCH_ADJUDICATOR_VERSION,
    contextPackVersion: EPOCH_CONTEXT_PACK_VERSION,
  };
}
