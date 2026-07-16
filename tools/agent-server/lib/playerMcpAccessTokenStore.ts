import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, open as openFile, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  type PublicCredentialAction,
  isPublicRegistrationActorHash,
} from "./publicRegistrationProtection.ts";

const TOKEN_BYTES = 32;
const TOKEN_ID_BYTES = 16;
const HASH_PREFIX = "sha256:";

export interface PlayerMcpAccessTokenRecord {
  readonly tokenId: string;
  readonly explorerId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revokedAt?: string;
}

export interface IssuedPlayerMcpAccessToken {
  readonly bearerToken: string;
  readonly record: PlayerMcpAccessTokenRecord;
}

export interface PlayerMcpAccessTokenStoreOptions {
  readonly jsonlPath?: string;
  readonly now?: () => Date;
}

export interface IssuePlayerMcpAccessTokenOptions {
  readonly explorerId: string;
  readonly ttlMs: number;
}

export interface ConsumePublicCredentialActionOptions {
  readonly action: PublicCredentialAction;
  readonly actorHashes: readonly string[];
  readonly windowMs: number;
  readonly maxActions: number;
  readonly cooldownMs: number;
}

export interface PublicCredentialAdmissionRecord {
  readonly action: PublicCredentialAction;
  readonly actorHashes: readonly string[];
  readonly occurredAt: string;
}

export class PublicRegistrationRateLimitError extends Error {
  readonly retryAfterMs: number;
  readonly retryAt: string;

  constructor(retryAfterMs: number, retryAt: string) {
    super("public_registration_rate_limited");
    this.name = "PublicRegistrationRateLimitError";
    this.retryAfterMs = retryAfterMs;
    this.retryAt = retryAt;
  }
}

interface StoredPlayerMcpAccessTokenRecord extends PlayerMcpAccessTokenRecord {
  readonly tokenHash: string;
}

interface IssueTokenEvent {
  readonly type: "issue";
  readonly record: StoredPlayerMcpAccessTokenRecord;
}

interface RevokeTokenEvent {
  readonly type: "revokeToken";
  readonly tokenId: string;
  readonly revokedAt: string;
}

interface RevokeExplorerEvent {
  readonly type: "revokeExplorer";
  readonly explorerId: string;
  readonly revokedAt: string;
}

interface PublicCredentialAdmissionEvent {
  readonly type: "publicCredentialAdmission";
  readonly record: PublicCredentialAdmissionRecord;
}

type TokenStoreEvent = IssueTokenEvent | RevokeTokenEvent | RevokeExplorerEvent | PublicCredentialAdmissionEvent;

export function validatePlayerMcpAccessTokenLedgerContent(content: string) {
  if (content.length > 0 && !/\r?\n$/.test(content)) {
    throw new Error("player_mcp_token_ledger_incomplete");
  }
  let records = 0;
  const issuedExplorerIds = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = parseTokenStoreEvent(JSON.parse(line));
      if (event.type === "issue") issuedExplorerIds.add(event.record.explorerId);
      records += 1;
    } catch {
      throw new Error("player_mcp_token_ledger_corrupt");
    }
  }
  return { records, issuedExplorerIds: [...issuedExplorerIds].sort() } as const;
}

export class PlayerMcpAccessTokenStore {
  private readonly jsonlPath?: string;
  private readonly now: () => Date;
  private readonly recordsByTokenId = new Map<string, StoredPlayerMcpAccessTokenRecord>();
  private readonly tokenIdByHash = new Map<string, string>();
  private readonly publicCredentialAdmissions: PublicCredentialAdmissionRecord[] = [];
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(options: PlayerMcpAccessTokenStoreOptions) {
    this.jsonlPath = options.jsonlPath;
    this.now = options.now ?? (() => new Date());
  }

  static async open(options: PlayerMcpAccessTokenStoreOptions = {}): Promise<PlayerMcpAccessTokenStore> {
    const store = new PlayerMcpAccessTokenStore(options);
    await store.ensurePersistentLedger();
    await store.load();
    return store;
  }

  get persistent(): boolean {
    return this.jsonlPath !== undefined;
  }

  async issue(options: IssuePlayerMcpAccessTokenOptions): Promise<IssuedPlayerMcpAccessToken> {
    const explorerId = validateIdentifier(options.explorerId, "explorerId");
    const ttlMs = validateTtlMs(options.ttlMs);
    const issuedAtDate = this.now();
    const expiresAtDate = new Date(issuedAtDate.getTime() + ttlMs);
    const bearerToken = randomBearerToken();
    const record: StoredPlayerMcpAccessTokenRecord = {
      tokenId: randomTokenId(),
      explorerId,
      issuedAt: issuedAtDate.toISOString(),
      expiresAt: expiresAtDate.toISOString(),
      tokenHash: hashBearerToken(bearerToken),
    };

    await this.commitEvent({ type: "issue", record });

    return {
      bearerToken,
      record: publicRecord(record),
    };
  }

  async consumePublicCredentialAction(
    options: ConsumePublicCredentialActionOptions,
  ): Promise<PublicCredentialAdmissionRecord> {
    const action = validatePublicCredentialAction(options.action);
    const actorHashes = validateActorHashes(options.actorHashes);
    const windowMs = validatePositiveInteger(options.windowMs, "public_registration_window_invalid");
    const maxActions = validatePositiveInteger(options.maxActions, "public_registration_quota_invalid");
    const cooldownMs = validateNonNegativeInteger(options.cooldownMs, "public_registration_cooldown_invalid");

    return this.enqueueMutation(async () => {
      const nowDate = this.now();
      const nowMs = nowDate.getTime();
      const retryCandidates: number[] = [];

      for (const actorHash of actorHashes) {
        const actorRecords = this.publicCredentialAdmissions.filter((record) => record.actorHashes.includes(actorHash));
        const recent = actorRecords
          .filter((record) => Date.parse(record.occurredAt) > nowMs - windowMs)
          .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
        if (recent.length >= maxActions) {
          const requiredExpiryIndex = recent.length - maxActions;
          const requiredExpiryAt = Date.parse(recent[requiredExpiryIndex]?.occurredAt || "");
          retryCandidates.push(requiredExpiryAt + windowMs);
        }

        const lastSameActionAt = actorRecords
          .filter((record) => record.action === action && Date.parse(record.occurredAt) > nowMs - cooldownMs)
          .reduce((latest, record) => Math.max(latest, Date.parse(record.occurredAt)), 0);
        if (cooldownMs > 0 && lastSameActionAt + cooldownMs > nowMs) {
          retryCandidates.push(lastSameActionAt + cooldownMs);
        }
      }

      if (retryCandidates.length > 0) {
        const retryAtMs = Math.max(...retryCandidates);
        throw new PublicRegistrationRateLimitError(
          Math.max(1, retryAtMs - nowMs),
          new Date(retryAtMs).toISOString(),
        );
      }

      const record: PublicCredentialAdmissionRecord = {
        action,
        actorHashes,
        occurredAt: nowDate.toISOString(),
      };
      const event: PublicCredentialAdmissionEvent = { type: "publicCredentialAdmission", record };
      await this.persistEvent(event);
      this.applyEvent(event);
      return record;
    });
  }

  authenticate(bearerToken: string): PlayerMcpAccessTokenRecord | null {
    let tokenHash: string;
    try {
      tokenHash = hashBearerToken(bearerToken);
    } catch {
      return null;
    }
    const nowMs = this.now().getTime();
    const tokenId = this.tokenIdByHash.get(tokenHash);
    const matchedRecord = tokenId ? this.recordsByTokenId.get(tokenId) : undefined;
    if (!matchedRecord || !constantTimeHashEquals(tokenHash, matchedRecord.tokenHash)) return null;
    if (matchedRecord.revokedAt !== undefined) {
      return null;
    }
    if (Date.parse(matchedRecord.expiresAt) <= nowMs) {
      return null;
    }

    return publicRecord(matchedRecord);
  }

  async revokeToken(tokenId: string): Promise<PlayerMcpAccessTokenRecord | null> {
    const normalizedTokenId = validateIdentifier(tokenId, "tokenId");
    const record = this.recordsByTokenId.get(normalizedTokenId);
    if (record === undefined) {
      return null;
    }
    if (record.revokedAt !== undefined) {
      return publicRecord(record);
    }

    const revokedAt = this.now().toISOString();
    await this.commitEvent({ type: "revokeToken", tokenId: normalizedTokenId, revokedAt });
    const revokedRecord = this.recordsByTokenId.get(normalizedTokenId) || { ...record, revokedAt };
    return publicRecord(revokedRecord);
  }

  async revokeExplorer(explorerId: string): Promise<readonly PlayerMcpAccessTokenRecord[]> {
    const normalizedExplorerId = validateIdentifier(explorerId, "explorerId");
    const revokedAt = this.now().toISOString();
    const revokedRecords: PlayerMcpAccessTokenRecord[] = [];

    for (const record of this.recordsByTokenId.values()) {
      if (record.explorerId === normalizedExplorerId && record.revokedAt === undefined) {
        revokedRecords.push(publicRecord({ ...record, revokedAt }));
      }
    }

    if (revokedRecords.length > 0) {
      const event: RevokeExplorerEvent = { type: "revokeExplorer", explorerId: normalizedExplorerId, revokedAt };
      await this.commitEvent(event);
    }

    return revokedRecords;
  }

  get(tokenId: string): PlayerMcpAccessTokenRecord | null {
    const normalizedTokenId = validateIdentifier(tokenId, "tokenId");
    const record = this.recordsByTokenId.get(normalizedTokenId);
    return record === undefined ? null : publicRecord(record);
  }

  private async load(): Promise<void> {
    if (this.jsonlPath === undefined) {
      return;
    }

    let content: string;
    try {
      content = await readFile(this.jsonlPath, "utf8");
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return;
      }
      throw error;
    }

    const events: TokenStoreEvent[] = [];
    const lines = content.split(/\r?\n/);
    const hasCompleteTrailingLine = /\r?\n$/.test(content);
    let repairedContent: string | undefined;
    for (const [index, line] of lines.entries()) {
      if (line.trim() === "") {
        continue;
      }
      try {
        events.push(parseTokenStoreEvent(JSON.parse(line)));
      } catch {
        const isIncompleteTrailingLine = index === lines.length - 1 && !hasCompleteTrailingLine;
        if (isIncompleteTrailingLine) {
          repairedContent = content.slice(0, content.lastIndexOf("\n") + 1);
          break;
        }
        throw new Error("player_mcp_token_ledger_corrupt");
      }
    }
    if (!hasCompleteTrailingLine && repairedContent === undefined && content.length > 0) {
      repairedContent = `${content}\n`;
    }
    if (repairedContent !== undefined) {
      await this.atomicReplaceLedger(repairedContent);
    }
    for (const event of events) this.applyEvent(event);
  }

  private async atomicReplaceLedger(content: string): Promise<void> {
    if (this.jsonlPath === undefined) return;
    const directory = dirname(this.jsonlPath);
    const temporaryPath = join(directory, `.${basename(this.jsonlPath)}.repair-${randomUUID()}`);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
      await rename(temporaryPath, this.jsonlPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  private async ensurePersistentLedger(): Promise<void> {
    if (this.jsonlPath === undefined) return;
    await mkdir(dirname(this.jsonlPath), { recursive: true, mode: 0o700 });
    const file = await openFile(this.jsonlPath, "a", 0o600);
    await file.close();
  }

  private async persistEvent(event: TokenStoreEvent): Promise<void> {
    if (this.jsonlPath === undefined) {
      return;
    }
    await mkdir(dirname(this.jsonlPath), { recursive: true, mode: 0o700 });
    await appendFile(this.jsonlPath, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  private async commitEvent(event: TokenStoreEvent): Promise<void> {
    await this.enqueueMutation(async () => {
      await this.persistEvent(event);
      this.applyEvent(event);
    });
  }

  private async enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.catch(() => undefined).then(operation);
    this.writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private applyEvent(event: TokenStoreEvent): void {
    if (event.type === "issue") {
      const previous = this.recordsByTokenId.get(event.record.tokenId);
      if (previous) this.tokenIdByHash.delete(previous.tokenHash);
      this.recordsByTokenId.set(event.record.tokenId, event.record);
      this.tokenIdByHash.set(event.record.tokenHash, event.record.tokenId);
      return;
    }

    if (event.type === "revokeToken") {
      const record = this.recordsByTokenId.get(event.tokenId);
      if (record !== undefined) {
        this.recordsByTokenId.set(event.tokenId, { ...record, revokedAt: event.revokedAt });
      }
      return;
    }

    if (event.type === "publicCredentialAdmission") {
      this.publicCredentialAdmissions.push(event.record);
      return;
    }

    for (const record of this.recordsByTokenId.values()) {
      if (record.explorerId === event.explorerId && record.revokedAt === undefined) {
        this.recordsByTokenId.set(record.tokenId, { ...record, revokedAt: event.revokedAt });
      }
    }
  }
}

export function hashBearerToken(bearerToken: string): string {
  return `${HASH_PREFIX}${createHash("sha256").update(validateBearerToken(bearerToken), "utf8").digest("hex")}`;
}

function randomBearerToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function randomTokenId(): string {
  return randomBytes(TOKEN_ID_BYTES).toString("hex");
}

function publicRecord(record: StoredPlayerMcpAccessTokenRecord): PlayerMcpAccessTokenRecord {
  return {
    tokenId: record.tokenId,
    explorerId: record.explorerId,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    ...(record.revokedAt === undefined ? {} : { revokedAt: record.revokedAt }),
  };
}

function validateIdentifier(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName}_invalid`);
  }
  return value;
}

function validateBearerToken(value: string): string {
  if (typeof value !== "string" || value.trim().length < 16 || value.trim().length > 512) {
    throw new Error("bearer_token_invalid");
  }
  return value.trim();
}

function validateTtlMs(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("token_ttl_invalid");
  }
  return value;
}

function constantTimeHashEquals(left: string, right: string): boolean {
  if (!isSha256Hash(left) || !isSha256Hash(right)) {
    return false;
  }

  const leftBytes = Buffer.from(left.slice(HASH_PREFIX.length), "hex");
  const rightBytes = Buffer.from(right.slice(HASH_PREFIX.length), "hex");
  return timingSafeEqual(leftBytes, rightBytes);
}

function isSha256Hash(value: string): boolean {
  return value.startsWith(HASH_PREFIX) && /^[a-f0-9]{64}$/.test(value.slice(HASH_PREFIX.length));
}

function parseTokenStoreEvent(value: unknown): TokenStoreEvent {
  if (!isRecord(value)) {
    throw new Error("token_store_event_invalid");
  }

  if (value.type === "issue" && isStoredRecord(value.record)) {
    return { type: "issue", record: value.record };
  }
  if (value.type === "revokeToken" && typeof value.tokenId === "string" && typeof value.revokedAt === "string") {
    return { type: "revokeToken", tokenId: value.tokenId, revokedAt: value.revokedAt };
  }
  if (value.type === "revokeExplorer" && typeof value.explorerId === "string" && typeof value.revokedAt === "string") {
    return { type: "revokeExplorer", explorerId: value.explorerId, revokedAt: value.revokedAt };
  }
  if (value.type === "publicCredentialAdmission" && isPublicCredentialAdmissionRecord(value.record)) {
    return { type: "publicCredentialAdmission", record: value.record };
  }

  throw new Error("token_store_event_invalid");
}

function isPublicCredentialAdmissionRecord(value: unknown): value is PublicCredentialAdmissionRecord {
  return isRecord(value)
    && (value.action === "pairing_registration" || value.action === "player_token_issuance")
    && Array.isArray(value.actorHashes)
    && value.actorHashes.length > 0
    && value.actorHashes.every((actorHash) => typeof actorHash === "string" && isPublicRegistrationActorHash(actorHash))
    && typeof value.occurredAt === "string"
    && Number.isFinite(Date.parse(value.occurredAt));
}

function validatePublicCredentialAction(value: PublicCredentialAction): PublicCredentialAction {
  if (value !== "pairing_registration" && value !== "player_token_issuance") {
    throw new Error("public_registration_action_invalid");
  }
  return value;
}

function validateActorHashes(values: readonly string[]): readonly string[] {
  const normalized = [...new Set(values.map((value) => value.trim()))];
  if (normalized.length === 0 || normalized.length > 3 || normalized.some((value) => !isPublicRegistrationActorHash(value))) {
    throw new Error("public_registration_actor_hash_invalid");
  }
  return normalized;
}

function validatePositiveInteger(value: number, errorCode: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(errorCode);
  return value;
}

function validateNonNegativeInteger(value: number, errorCode: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

function isStoredRecord(value: unknown): value is StoredPlayerMcpAccessTokenRecord {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.tokenId === "string" &&
    typeof value.explorerId === "string" &&
    typeof value.issuedAt === "string" &&
    typeof value.expiresAt === "string" &&
    typeof value.tokenHash === "string" &&
    (value.revokedAt === undefined || typeof value.revokedAt === "string") &&
    isSha256Hash(value.tokenHash)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}
