import { createHash } from "node:crypto";

type UnknownRecord = Record<string, unknown>;

interface TransparencyEntry {
  readonly index: number;
  readonly previousHash: string;
  readonly payloadHash: string;
  readonly entryHash: string;
  readonly record: UnknownRecord;
  readonly createdAt: string;
}

interface TransparencyVerification {
  readonly ok: boolean;
  readonly failedIndex?: number;
  readonly entryCount: number;
  readonly rootHash: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashRecord(record: unknown): string {
  return createHash("sha256").update(stableJson(record)).digest("hex");
}

export function publicVerificationRecord({
  runTicket,
  run = {},
  adjudication = {},
  lore = {},
  channelClass,
  deliveryTrust,
}: {
  readonly runTicket?: unknown;
  readonly run?: UnknownRecord;
  readonly adjudication?: UnknownRecord;
  readonly lore?: UnknownRecord;
  readonly channelClass?: unknown;
  readonly deliveryTrust?: unknown;
}) {
  const loreDecisions = recordArray(lore.decisions).map((decision) => ({
    status: decision.status,
    claimId: decision.claimId,
    claimHash: optionalString(decision.claimHash),
  }));
  const claimHashes = loreDecisions
    .map((decision) => decision.claimHash)
    .filter((claimHash): claimHash is string => Boolean(claimHash))
    .sort();
  const recordChannelClass = optionalString(channelClass);
  const recordDeliveryTrust = optionalString(deliveryTrust);
  const trustLabels = {
    ...(recordChannelClass ? { channelClass: recordChannelClass } : {}),
    ...(recordDeliveryTrust ? { deliveryTrust: recordDeliveryTrust } : {}),
  };
  return {
    type: "run_verification",
    ...trustLabels,
    runTicket,
    runHash: hashRecord({
      explorerId: run?.explorerId,
      agentId: run?.agentId,
      mandate: run?.mandate,
      anchors: run?.anchors || [],
      eventCount: Array.isArray(run?.events) ? run.events.length : 0,
      candidateClaimCount: Array.isArray(run?.candidateClaims) ? run.candidateClaims.length : 0,
    }),
    claimHashes,
    scoreHash: hashRecord({
      claimSlots: adjudication?.claimSlots,
      rating: adjudication?.rating,
      score: adjudication?.score,
      worldImpact: adjudication?.worldImpact,
    }),
    adjudication: {
      score: adjudication?.score,
      rating: adjudication?.rating,
      claimSlots: adjudication?.claimSlots,
      worldImpact: adjudication?.worldImpact,
    },
    lore: {
      decisions: loreDecisions,
    },
  };
}

export function createTransparencyLedger(options: {
  readonly initialEntries?: readonly UnknownRecord[];
  readonly initialAnchors?: readonly UnknownRecord[];
} = {}) {
  const entries: TransparencyEntry[] = (options.initialEntries || []).map((entry) => ({
    ...entry,
    index: Number(entry.index || 0),
    previousHash: String(entry.previousHash || ""),
    payloadHash: String(entry.payloadHash || ""),
    entryHash: String(entry.entryHash || ""),
    record: isRecord(entry.record) ? { ...entry.record } : {},
    createdAt: String(entry.createdAt || ""),
  }));
  const anchors = (options.initialAnchors || []).map((anchor) => ({ ...anchor }));

  function append(record: UnknownRecord) {
    const previousHash = entries.at(-1)?.entryHash || "0".repeat(64);
    const payloadHash = hashRecord(record);
    const entry = {
      index: entries.length,
      previousHash,
      payloadHash,
      entryHash: hashRecord({ index: entries.length, previousHash, payloadHash }),
      record,
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    return { ...entry };
  }

  function verify(): TransparencyVerification {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const previousHash = index === 0 ? "0".repeat(64) : entries[index - 1].entryHash;
      const payloadHash = hashRecord(entry.record);
      const entryHash = hashRecord({ index, previousHash, payloadHash });
      if (entry.index !== index || entry.previousHash !== previousHash || entry.payloadHash !== payloadHash || entry.entryHash !== entryHash) {
        return {
          ok: false,
          failedIndex: index,
          entryCount: entries.length,
          rootHash: entries.at(-1)?.entryHash || "0".repeat(64),
        };
      }
    }
    return { ok: true, entryCount: entries.length, rootHash: entries.at(-1)?.entryHash || "0".repeat(64) };
  }

  function exportBundle() {
    return {
      entries: entries.map((entry) => ({ ...entry, record: { ...entry.record } })),
      verification: verify(),
      anchors: anchors.map((anchor) => ({ ...anchor })),
    };
  }

  function createAnchor({ provider = "manual", externalRef = "" }: UnknownRecord = {}) {
    const verification = verify();
    const anchor = {
      status: "prepared",
      provider,
      externalRef,
      rootHash: verification.rootHash,
      entryCount: verification.entryCount,
      createdAt: new Date().toISOString(),
    };
    anchors.push(anchor);
    return { ...anchor };
  }

  return {
    append,
    verify,
    exportBundle,
    createAnchor,
    entries: () => entries.map((entry) => ({ ...entry, record: { ...entry.record } })),
  };
}
