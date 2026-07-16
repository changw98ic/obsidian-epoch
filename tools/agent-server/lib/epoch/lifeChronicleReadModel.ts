import type { JourneyProjection } from "./journeyReadModel.ts";
import { journeyPostcards, OBSIDIAN_WORLD_CALENDAR_VERSION, type JourneyPostcard } from "./journeyAlbumReadModel.ts";
import {
  EPOCH_WORLD_CALENDAR_ORIGIN_YEAR,
  EPOCH_WORLD_MINUTES_PER_YEAR,
  EPOCH_WORLD_MONTH_NAMES,
  epochWorldCalendarMoment,
  epochWorldTimeFromMinute,
} from "./worldCalendar.ts";

export interface ChronicleParagraph {
  readonly text: string;
  readonly sourceEventIds: readonly string[];
}

export interface LifeChronicleMonth {
  readonly month: number;
  readonly label: string;
  readonly journeyIds: readonly string[];
  readonly postcardIds: readonly string[];
  readonly paragraphs: readonly ChronicleParagraph[];
}

export interface LifeAnnualChronicle {
  readonly status: "ready" | "not_ready";
  readonly year: number;
  readonly calendarVersion: typeof OBSIDIAN_WORLD_CALENDAR_VERSION;
  readonly coverage: { readonly startsAt: string; readonly endsAt: string; readonly nowWorld: string };
  readonly title?: string;
  readonly chapters?: readonly LifeChronicleMonth[];
  readonly narrative?: string;
  readonly sourceEventIds?: readonly string[];
  readonly reason?: "identity_started_after_year_open" | "year_not_complete";
}

const MONTH_LABELS = EPOCH_WORLD_MONTH_NAMES.map((monthName) => `${monthName}月`);

function yearStart(year: number) {
  if (!Number.isSafeInteger(year) || year < EPOCH_WORLD_CALENDAR_ORIGIN_YEAR) {
    throw new Error("life_chronicle_year_invalid");
  }
  return epochWorldTimeFromMinute(
    (year - EPOCH_WORLD_CALENDAR_ORIGIN_YEAR) * EPOCH_WORLD_MINUTES_PER_YEAR,
  );
}

function yearEnd(year: number) {
  return yearStart(year + 1);
}

function postcardMonth(postcard: JourneyPostcard) {
  const monthName = epochWorldCalendarMoment(postcard.worldTime)?.monthName;
  const index = monthName ? EPOCH_WORLD_MONTH_NAMES.indexOf(monthName) : -1;
  return index >= 0 ? index + 1 : undefined;
}

function postcardParagraphs(postcard: JourneyPostcard): readonly ChronicleParagraph[] {
  const people = postcard.participants.length
    ? `这次片段中被服务器记录的参与者有：${postcard.participants.map((participant) => participant.label).join("、")}。`
    : "这次片段没有记录可公开的共同参与者。";
  return [
    { text: postcard.narrative, sourceEventIds: postcard.sourceEventIds },
    { text: `${people}所有叙述都指向同一组来源事件，没有补写未发生的奖励、关系或伤亡。`, sourceEventIds: postcard.sourceEventIds },
  ];
}

export function monthlyLifeReports(input: {
  readonly agentId: string;
  readonly year: number;
  readonly projection: JourneyProjection;
}): readonly LifeChronicleMonth[] {
  const postcards = journeyPostcards(input.projection, input.agentId)
    .filter((postcard) => epochWorldCalendarMoment(postcard.worldTime)?.year === input.year);
  return MONTH_LABELS.map((label, index) => {
    const month = index + 1;
    const current = postcards.filter((postcard) => postcardMonth(postcard) === month);
    const paragraphs = current.length
      ? current.flatMap(postcardParagraphs)
      : [
          { text: "本月没有可由服务器事件汇总的经历；编年史不会用模型补写空白。", sourceEventIds: [] },
          { text: "服务器日历仍保留这个月的位置：没有旅程、明信片或结算来源，就明确记作安静月份，不把推测、日常想象或模型生成的桥段写成这一世的事实。", sourceEventIds: [] },
        ];
    return {
      month,
      label,
      journeyIds: [...new Set(current.map((postcard) => postcard.journeyId))],
      postcardIds: current.map((postcard) => postcard.postcardId),
      paragraphs,
    };
  });
}

export function buildAnnualLifeChronicle(input: {
  readonly agentId: string;
  readonly identityName: string;
  readonly identityStartedAtWorldTime: string;
  readonly year: number;
  readonly nowWorld: string;
  readonly projection: JourneyProjection;
}): LifeAnnualChronicle {
  const startsAt = yearStart(input.year);
  const endsAt = yearEnd(input.year);
  const coverage = { startsAt, endsAt, nowWorld: input.nowWorld };
  if (Date.parse(input.identityStartedAtWorldTime) > Date.parse(startsAt)) {
    return { status: "not_ready", year: input.year, calendarVersion: OBSIDIAN_WORLD_CALENDAR_VERSION, coverage, reason: "identity_started_after_year_open" };
  }
  if (Date.parse(input.nowWorld) < Date.parse(endsAt)) {
    return { status: "not_ready", year: input.year, calendarVersion: OBSIDIAN_WORLD_CALENDAR_VERSION, coverage, reason: "year_not_complete" };
  }
  const chapters = monthlyLifeReports({ agentId: input.agentId, year: input.year, projection: input.projection });
  const sourceEventIds = [...new Set(chapters.flatMap((chapter) => chapter.paragraphs.flatMap((paragraph) => paragraph.sourceEventIds)))];
  const journeyCount = new Set(chapters.flatMap((chapter) => chapter.journeyIds)).size;
  const postcardCount = chapters.reduce((sum, chapter) => sum + chapter.postcardIds.length, 0);
  const title = `黑曜历${input.year}年 · ${input.identityName}的一整年`;
  const opening = `${input.identityName}在这一服务器年度留下 ${journeyCount} 次可验证旅程、${postcardCount} 张事实明信片。以下十二章严格按世界时间排列。`;
  const narrative = [
    title,
    opening,
    ...chapters.flatMap((chapter) => [
      `\n${chapter.label}`,
      chapter.journeyIds.length
        ? `本章收录 ${chapter.journeyIds.length} 次服务器旅程与 ${chapter.postcardIds.length} 张事实明信片，以下段落按 canonical source events 汇总。`
        : "本章没有可验证旅程；保留这一章是为了让年度时间线完整，而不是用虚构事件填满它。",
      ...chapter.paragraphs.map((paragraph) => paragraph.text),
    ]),
    `\n年末回望：这一年共有 ${sourceEventIds.length} 个去重后的来源事件进入编年史。没有来源的月份被明确保留为空白。`,
  ].join("\n");
  return {
    status: "ready",
    year: input.year,
    calendarVersion: OBSIDIAN_WORLD_CALENDAR_VERSION,
    coverage,
    title,
    chapters,
    narrative,
    sourceEventIds,
  };
}
