import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type EpochEvent, assertEpochEvent } from "./events.ts";

export interface EpochEventStore {
  append(events: readonly EpochEvent[]): Promise<void>;
  readAll(): Promise<EpochEvent[]>;
}

export function createInMemoryEpochEventStore(initialEvents: readonly EpochEvent[] = []): EpochEventStore {
  const events = [...initialEvents];
  return {
    async append(nextEvents: readonly EpochEvent[]) {
      events.push(...nextEvents);
    },
    async readAll() {
      return events.map((event) => ({ ...event, payload: { ...event.payload } }) as EpochEvent);
    },
  };
}

export function createJsonlEpochEventStore(filePath: string): EpochEventStore {
  return {
    async append(events: readonly EpochEvent[]) {
      if (events.length === 0) return;
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf8");
    },
    async readAll() {
      try {
        const raw = await readFile(filePath, "utf8");
        return raw
          .split("\n")
          .filter(Boolean)
          .map((line) => assertEpochEvent(JSON.parse(line)));
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
        throw error;
      }
    },
  };
}
