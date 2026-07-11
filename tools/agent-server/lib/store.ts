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
  const canonicalEpochEvents = epochEventRecords
    .flatMap((record) => epochEventsFromPersistenceRecord(record));
  const sharedResultPages = resultPageRecords
    .map((record) => record.type === "epoch_result_page" ? record.page : record)
    .filter((page): page is JsonRecord => isRecord(page) && typeof page.pageId === "string");
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
    resultPages: await readJsonl("result-pages.jsonl"),
    contextSnapshots: await readJsonl("context-snapshots.jsonl"),
    outbox: await readJsonl("outbox.jsonl"),
  });
}
