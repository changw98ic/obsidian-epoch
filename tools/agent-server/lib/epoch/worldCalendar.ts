/**
 * A parseable storage coordinate for black-calendar minute zero. It is not a
 * wall-clock anchor: authoritative world time is derived from server elapsed
 * time, while events materialize that derived time for replay and simulation.
 */
export const EPOCH_WORLD_TIME_ORIGIN = "2026-01-01T00:00:00.000Z";
export const EPOCH_WORLD_CALENDAR_ORIGIN_YEAR = 1;

const WORLD_EPOCH_REAL_MS = Date.parse(EPOCH_WORLD_TIME_ORIGIN);
const WORLD_EPOCH_YEAR = EPOCH_WORLD_CALENDAR_ORIGIN_YEAR;
const WORLD_DAY_MS = 24 * 60 * 60 * 1_000;
export const EPOCH_WORLD_DAYS_PER_MONTH = 30;
export const EPOCH_WORLD_DAYS_PER_YEAR = 12 * EPOCH_WORLD_DAYS_PER_MONTH;
export const EPOCH_WORLD_MINUTES_PER_DAY = 24 * 60;
export const EPOCH_WORLD_MINUTES_PER_YEAR = EPOCH_WORLD_DAYS_PER_YEAR * EPOCH_WORLD_MINUTES_PER_DAY;

const WORLD_MONTH_NAMES = [
  "初火", "回声", "雾生", "潮汐", "雷鸣", "长昼",
  "烬雨", "星落", "霜降", "长夜", "余辉", "归零",
] as const;

export const EPOCH_WORLD_MONTH_NAMES = WORLD_MONTH_NAMES;

export function epochWorldTimeFromMinute(worldMinute: number): string {
  if (!Number.isSafeInteger(worldMinute) || worldMinute < 0) {
    throw new Error("world_minute_invalid");
  }
  return new Date(WORLD_EPOCH_REAL_MS + worldMinute * 60_000).toISOString();
}

export function epochWorldMinuteFromTime(iso: string): number {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) throw new Error("world_time_invalid");
  const elapsedMs = timestamp - WORLD_EPOCH_REAL_MS;
  if (elapsedMs < 0 || elapsedMs % 60_000 !== 0) throw new Error("world_time_not_on_minute_boundary");
  const minute = elapsedMs / 60_000;
  if (!Number.isSafeInteger(minute)) throw new Error("world_minute_invalid");
  return minute;
}

export interface EpochWorldCalendarMoment {
  readonly year: number;
  readonly monthName: typeof WORLD_MONTH_NAMES[number];
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function epochWorldCalendarMoment(iso: string | undefined): EpochWorldCalendarMoment | undefined {
  if (!iso) return undefined;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return undefined;
  const elapsedMs = timestamp - WORLD_EPOCH_REAL_MS;
  const elapsedDays = Math.floor(elapsedMs / WORLD_DAY_MS);
  const dayOfYear = positiveModulo(elapsedDays, EPOCH_WORLD_DAYS_PER_YEAR);
  const yearOffset = Math.floor(elapsedDays / EPOCH_WORLD_DAYS_PER_YEAR);
  const minuteOfDay = positiveModulo(Math.floor(elapsedMs / 60_000), EPOCH_WORLD_MINUTES_PER_DAY);
  return {
    year: WORLD_EPOCH_YEAR + yearOffset,
    monthName: WORLD_MONTH_NAMES[Math.floor(dayOfYear / EPOCH_WORLD_DAYS_PER_MONTH)]!,
    day: (dayOfYear % EPOCH_WORLD_DAYS_PER_MONTH) + 1,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
  };
}

function clock(moment: EpochWorldCalendarMoment): string {
  return `${String(moment.hour).padStart(2, "0")}:${String(moment.minute).padStart(2, "0")}`;
}

export function formatEpochWorldTime(iso: string | undefined, includeYear = true): string {
  const moment = epochWorldCalendarMoment(iso);
  if (!moment) return "游戏时间未记录";
  const date = `${moment.monthName}月${moment.day}日${clock(moment)}`;
  return includeYear ? `黑曜历${moment.year}年${date}` : date;
}

export function formatEpochWorldTimeRange(startedAt: string | undefined, dueAt: string | undefined): string {
  return `${formatEpochWorldTime(startedAt)}，返程时限${formatEpochWorldTime(dueAt, false)}`;
}
