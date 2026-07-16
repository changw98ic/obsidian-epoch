import { mkdir, appendFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  epochEventsFromPersistenceRecord,
  serializeEpochEventBatch,
  type PersistEpochEventBatch,
} from "./epochPersistence.ts";
import { LEGACY_AGENT_WORLD_CHANNEL_CLASS, LEGACY_AGENT_WORLD_DELIVERY_TRUST } from "./legacyTrust.ts";
import { hashRunPayload } from "./tickets.ts";
import type { JourneyRuntimeEvent } from "./epoch/journeyReadModel.ts";

type JsonRecord = Record<string, unknown>;

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
export const dataDir = process.env.AGENT_SERVER_DATA_DIR || join(rootDir, "data");
const appendQueues = new Map<string, Promise<void>>();

export async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function appendSerializedJsonl(targetDataDir: string, fileName: string, serializedRecord: string) {
  const targetPath = join(targetDataDir, fileName);
  const previous = appendQueues.get(targetPath) || Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(async () => {
      await mkdir(targetDataDir, { recursive: true });
      await appendFile(targetPath, serializedRecord, "utf8");
    });
  appendQueues.set(targetPath, current);
  try {
    await current;
  } finally {
    if (appendQueues.get(targetPath) === current) appendQueues.delete(targetPath);
  }
}

export async function appendJsonl(fileName: string, record: unknown) {
  const serializedRecord = `${JSON.stringify(record)}\n`;
  await appendSerializedJsonl(dataDir, fileName, serializedRecord);
}

export function createEpochEventBatchJsonlAppender(targetDataDir: string): PersistEpochEventBatch {
  return async (events) => {
    if (events.length === 0) return;
    const serializedBatch = serializeEpochEventBatch(events);
    await appendSerializedJsonl(targetDataDir, "epoch-events.jsonl", serializedBatch);
  };
}

export const appendEpochEventBatchJsonl = createEpochEventBatchJsonlAppender(dataDir);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function dedupeCanonicalRecords<T>(
  values: readonly T[],
  idOf: (value: T) => unknown,
  idField: string,
  conflictCode: string,
) {
  const byId = new Map<string, { readonly value: T; readonly canonical: string }>();
  for (const value of values) {
    const id = nonEmptyString(idOf(value));
    if (!id) throw new Error(`${conflictCode.replace("_recovery_conflict", "")}_${idField}_required`);
    const canonical = canonicalJson(value);
    const existing = byId.get(id);
    if (existing && existing.canonical !== canonical) throw new Error(conflictCode);
    if (!existing) byId.set(id, { value, canonical });
  }
  return [...byId.values()].map((entry) => entry.value);
}

function dedupeCanonicalResultPages(values: readonly JsonRecord[]) {
  const revisions = new Map<string, {
    readonly page: JsonRecord;
    readonly canonical: string;
    readonly version: number;
    readonly pageOrder: number;
  }>();
  const pageOrder = new Map<string, number>();
  for (const page of values) {
    const pageId = nonEmptyString(page.pageId);
    if (!pageId) throw new Error("result_page_page_id_required");
    if (!pageOrder.has(pageId)) pageOrder.set(pageId, pageOrder.size);
    const version = typeof page.shareVersion === "number"
      && Number.isSafeInteger(page.shareVersion)
      && page.shareVersion > 0
      ? page.shareVersion
      : 1;
    const revisionId = `${pageId}:${version}`;
    const canonical = canonicalJson(page);
    const existing = revisions.get(revisionId);
    if (existing && existing.canonical !== canonical) throw new Error("result_page_recovery_conflict");
    if (!existing) revisions.set(revisionId, {
      page,
      canonical,
      version,
      pageOrder: pageOrder.get(pageId) || 0,
    });
  }
  return [...revisions.values()]
    .sort((left, right) => left.pageOrder - right.pageOrder || left.version - right.version)
    .map((entry) => entry.page);
}

export function validateCanonicalRecoveryConflicts({
  epochEvents = [],
  journeyEvents = [],
  commandEvents = [],
  resultPages = [],
}: {
  readonly epochEvents?: readonly object[];
  readonly journeyEvents?: readonly object[];
  readonly commandEvents?: readonly object[];
  readonly resultPages?: readonly object[];
} = {}) {
  const commandRecords = commandEvents.map(recordValue);
  dedupeCanonicalRecords(
    commandRecords.filter((record) => nonEmptyString(record.commandId) && nonEmptyString(record.command)),
    (record) => record.commandId,
    "command_id",
    "agent_command_commit_recovery_conflict",
  );
  dedupeCanonicalRecords([
    ...epochEvents.map(recordValue).flatMap((record) => epochEventsFromPersistenceRecord(record)),
    ...commandRecords.flatMap((record) => epochEventsFromPersistenceRecord({
      type: "epoch_event_batch",
      events: Array.isArray(record.epochEvents) ? record.epochEvents : [],
    })),
  ], (event) => event.eventId, "event_id", "epoch_event_recovery_conflict");
  dedupeCanonicalRecords([
    ...journeyEvents.map(recordValue).map((record) => record.type === "journey_event" ? record.event : record),
    ...commandRecords.flatMap((record) => Array.isArray(record.journeyEvents) ? record.journeyEvents : []),
  ]
    .filter((event): event is JsonRecord => isRecord(event)
      && nonEmptyString(event.eventId) !== undefined
      && nonEmptyString(event.eventType) !== undefined
      && nonEmptyString(event.journeyId) !== undefined
      && nonEmptyString(event.agentId) !== undefined
      && nonEmptyString(event.explorerId) !== undefined
      && nonEmptyString(event.occurredAt) !== undefined),
  (event) => event.eventId, "event_id", "journey_event_recovery_conflict");
  dedupeCanonicalResultPages([
    ...resultPages.map(recordValue).map((record) => record.type === "epoch_result_page" ? record.page : record),
    ...commandRecords.flatMap((record) => Array.isArray(record.resultPages) ? record.resultPages : []),
  ].filter((page): page is JsonRecord => isRecord(page) && nonEmptyString(page.pageId) !== undefined));
}

interface AgentCommandCommitRecord extends JsonRecord {
  readonly type: "agent_command_commit";
  readonly version: 1;
  readonly command: string;
  readonly commandId: string;
  readonly journeyEvents: readonly JsonRecord[];
  readonly epochEvents: readonly JsonRecord[];
  readonly resultPages: readonly JsonRecord[];
}

const JOURNEY_SNAPSHOT_EVENT_TYPES = new Set([
  "journey_prepared",
  "journey_world_window_reserved",
  "journey_task_plan_installed",
  "journey_started",
  "journey_episode_recorded",
  "journey_world_commit_recorded",
  "journey_verification_linked",
  "journey_status_changed",
]);

function assertRecordArray(record: JsonRecord, key: string) {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`agent_command_commit_${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_required`);
  if (!value.every(isRecord)) throw new Error(`agent_command_commit_${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_invalid`);
  return value;
}

function assertAgentCommandCommit(record: JsonRecord): AgentCommandCommitRecord {
  if (record.type !== "agent_command_commit") throw new Error("agent_command_commit_type_required");
  if (record.version !== 1) throw new Error("agent_command_commit_version_unsupported");
  if (!nonEmptyString(record.command)) throw new Error("agent_command_commit_command_required");
  if (!nonEmptyString(record.commandId)) throw new Error("agent_command_commit_command_id_required");
  const journeyEvents = assertRecordArray(record, "journeyEvents");
  const epochEvents = assertRecordArray(record, "epochEvents");
  const resultPages = assertRecordArray(record, "resultPages");
  for (const event of journeyEvents) {
    const invalidBase = !nonEmptyString(event.eventId)
      || !nonEmptyString(event.eventType)
      || !nonEmptyString(event.journeyId)
      || !nonEmptyString(event.agentId)
      || !nonEmptyString(event.explorerId)
      || !nonEmptyString(event.occurredAt);
    const validPayload = event.eventType === "journey_return_delivered"
      ? nonEmptyString(event.deliveredAt) && event.journey === undefined
      : JOURNEY_SNAPSHOT_EVENT_TYPES.has(String(event.eventType))
        && isRecord(event.journey)
        && event.deliveredAt === undefined;
    if (invalidBase || !validPayload) {
      throw new Error("agent_command_commit_journey_event_invalid");
    }
  }
  epochEventsFromPersistenceRecord({ type: "epoch_event_batch", events: epochEvents });
  for (const page of resultPages) {
    if (!nonEmptyString(page.pageId)
      || !nonEmptyString(page.createdAt)
      || !nonEmptyString(page.urlPath)) {
      throw new Error("agent_command_commit_result_page_invalid");
    }
  }
  return {
    ...record,
    type: "agent_command_commit",
    version: 1,
    command: record.command as string,
    commandId: record.commandId as string,
    journeyEvents,
    epochEvents,
    resultPages,
  };
}

export async function readJsonl(fileName: string): Promise<JsonRecord[]> {
  try {
    const raw = await readFile(join(dataDir, fileName), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown)
      .filter(isRecord);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

function withoutType(record: JsonRecord) {
  const { type: _type, ...rest } = record;
  return rest;
}

function submittedRunSummary(record: JsonRecord) {
  const run = recordValue(record.run);
  const adjudication = recordValue(record.adjudication);
  return {
    runTicket: record.runTicket,
    explorerId: run.explorerId,
    score: adjudication.score,
    visibility: run.visibility,
    worldImpact: adjudication.worldImpact,
    channelClass: stringValue(record.channelClass) || LEGACY_AGENT_WORLD_CHANNEL_CLASS,
    deliveryTrust: stringValue(record.deliveryTrust) || LEGACY_AGENT_WORLD_DELIVERY_TRUST,
    submittedAt: record.submittedAt,
  };
}

export function hydrateAgentRuntimeOptions({
  tickets = [],
  runs = [],
  lore = [],
  progression = [],
  factions = [],
  community = [],
  experience = [],
  transparency = [],
  epochEvents = [],
  journeyEvents = [],
  commandEvents = [],
  resultPages = [],
  contextSnapshots = [],
  outbox = [],
}: {
  tickets?: readonly object[];
  runs?: readonly object[];
  lore?: readonly object[];
  progression?: readonly object[];
  factions?: readonly object[];
  community?: readonly object[];
  experience?: readonly object[];
  transparency?: readonly object[];
  epochEvents?: readonly object[];
  journeyEvents?: readonly object[];
  commandEvents?: readonly object[];
  resultPages?: readonly object[];
  contextSnapshots?: readonly object[];
  outbox?: readonly object[];
  dataDir?: string;
} = {}) {
  const ticketRecords = tickets.map(recordValue);
  const runRecords = runs.map(recordValue);
  const loreRecords = lore.map(recordValue);
  const progressionRecords = progression.map(recordValue);
  const factionRecords = factions.map(recordValue);
  const communityRecords = community.map(recordValue);
  const experienceRecords = experience.map(recordValue);
  const transparencyRecords = transparency.map(recordValue);
  const epochEventRecords = epochEvents.map(recordValue);
  const journeyEventRecords = journeyEvents.map(recordValue);
  const commandEventRecords = dedupeCanonicalRecords(
    commandEvents.map(recordValue).map(assertAgentCommandCommit),
    (record) => record.commandId,
    "command_id",
    "agent_command_commit_recovery_conflict",
  );
  const resultPageRecords = resultPages.map(recordValue);
  const contextSnapshotRecords = contextSnapshots.map(recordValue);
  const outboxRecords = outbox.map(recordValue);
  const ticketById = new Map<string, JsonRecord>();
  for (const record of ticketRecords) {
    const runTicket = stringValue(record.runTicket);
    if ((record.type === "ticket_issued" || record.type === "ticket_heartbeat") && runTicket) {
      ticketById.set(runTicket, withoutType(record));
    }
  }

  const submittedRuns = runRecords
    .flatMap((record) => {
      const runTicket = stringValue(record.runTicket);
      if (record.type !== "run_submitted" || !runTicket) return [];
      const ticket = ticketById.get(runTicket) || { runTicket };
      ticketById.set(runTicket, {
        ...ticket,
        state: "settled",
        submittedAt: record.submittedAt,
        settledAt: record.settledAt || record.submittedAt,
        runHash: hashRunPayload(record.run),
        adjudication: record.adjudication,
      });
      return [submittedRunSummary(record)];
    });

  const latestLore = [...loreRecords].reverse().find((record) => record.type === "lore_admission" && isRecord(record.state));
  const latestProgression = [...progressionRecords].reverse().find((record) => record.type === "progression_awarded" && isRecord(record.state));
  const latestFactionState = [...factionRecords].reverse().find((record) => isRecord(record.state));
  const latestCommunityState = [...communityRecords].reverse().find((record) => record.type === "community_state" && isRecord(record.state));
  const experienceStates = [
    ...runRecords
      .filter((record) => record.type === "run_submitted" && isRecord(recordValue(record.experience).state))
      .map((record) => recordValue(recordValue(record.experience).state)),
    ...experienceRecords
      .filter((record) => record.type === "experience_state" && isRecord(record.state))
      .map((record) => recordValue(record.state)),
  ];
  const transparencyEntries = [
    ...transparencyRecords.filter((record) => record.entryHash),
    ...runRecords
      .filter((record) => record.type === "run_submitted" && isRecord(record.transparencyEntry))
      .map((record) => recordValue(record.transparencyEntry)),
  ];
  const transparencyAnchors = transparencyRecords
    .filter((record) => record.type === "transparency_anchor" && isRecord(record.anchor))
    .map((record) => recordValue(record.anchor));
  const canonicalEpochEvents = dedupeCanonicalRecords([
    ...epochEventRecords.flatMap((record) => epochEventsFromPersistenceRecord(record)),
    ...commandEventRecords.flatMap((record) => epochEventsFromPersistenceRecord({
      type: "epoch_event_batch",
      events: record.epochEvents,
    })),
  ], (event) => event.eventId, "event_id", "epoch_event_recovery_conflict");
  const canonicalJourneyEvents = dedupeCanonicalRecords([
    ...journeyEventRecords.map((record) => record.type === "journey_event" ? record.event : record),
    ...commandEventRecords.flatMap((record) => record.journeyEvents),
  ]
    .filter((event): event is JourneyRuntimeEvent => isRecord(event)
      && typeof event.eventId === "string"
      && typeof event.eventType === "string"
      && typeof event.journeyId === "string"),
  (event) => event.eventId, "event_id", "journey_event_recovery_conflict");
  const journeyOrder = new Map<string, number>();
  for (const event of canonicalJourneyEvents) {
    if (!journeyOrder.has(event.journeyId)) journeyOrder.set(event.journeyId, journeyOrder.size);
  }
  canonicalJourneyEvents.sort((left, right) => {
    const journeyComparison = (journeyOrder.get(left.journeyId) || 0) - (journeyOrder.get(right.journeyId) || 0);
    if (journeyComparison !== 0) return journeyComparison;
    const leftVersion = left.eventType === "journey_return_delivered" ? Number.MAX_SAFE_INTEGER : left.journey.version;
    const rightVersion = right.eventType === "journey_return_delivered" ? Number.MAX_SAFE_INTEGER : right.journey.version;
    return leftVersion - rightVersion || left.eventId.localeCompare(right.eventId);
  });
  const sharedResultPages = dedupeCanonicalResultPages([
    ...resultPageRecords.map((record) => record.type === "epoch_result_page" ? record.page : record),
    ...commandEventRecords.flatMap((record) => record.resultPages),
  ]
    .filter((page): page is JsonRecord => isRecord(page) && typeof page.pageId === "string"));
  const savedContextSnapshots = contextSnapshotRecords
    .map((record) => record.type === "context_snapshot" ? record.snapshot : record)
    .filter((snapshot): snapshot is JsonRecord => isRecord(snapshot) && typeof snapshot.snapshotId === "string");

  return {
    tickets: { initialTickets: [...ticketById.values()] },
    loreState: recordValue(latestLore?.state),
    progression: latestProgression?.state ? { initialExplorers: [recordValue(latestProgression.state)] } : {},
    factions: recordValue(latestFactionState?.state),
    community: recordValue(latestCommunityState?.state),
    experience: experienceStates.length ? { initialStates: experienceStates } : {},
    submittedRuns,
    transparencyEntries,
    transparencyAnchors,
    epochEvents: canonicalEpochEvents,
    journeyEvents: canonicalJourneyEvents,
    resultPages: sharedResultPages,
    contextSnapshots: savedContextSnapshots,
    outboxEvents: outboxRecords,
  };
}

export async function loadAgentRuntimeOptions() {
  await ensureDataDir();
  return hydrateAgentRuntimeOptions({
    tickets: await readJsonl("tickets.jsonl"),
    runs: await readJsonl("runs.jsonl"),
    lore: await readJsonl("lore.jsonl"),
    progression: await readJsonl("progression.jsonl"),
    factions: await readJsonl("factions.jsonl"),
    community: await readJsonl("community.jsonl"),
    experience: await readJsonl("experience.jsonl"),
    transparency: await readJsonl("transparency.jsonl"),
    epochEvents: await readJsonl("epoch-events.jsonl"),
    journeyEvents: await readJsonl("journey-events.jsonl"),
    commandEvents: await readJsonl("command-events.jsonl"),
    resultPages: await readJsonl("result-pages.jsonl"),
    contextSnapshots: await readJsonl("context-snapshots.jsonl"),
    outbox: await readJsonl("outbox.jsonl"),
  });
}
