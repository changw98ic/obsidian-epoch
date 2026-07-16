import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPersistedJourneyNarrative,
  buildServerJourneyEpisodeFacts,
} from "../lib/epoch/journeyNarrativeRules.ts";
import { buildGroundedJourneyStoryReport } from "../lib/epoch/journeyStoryReport.ts";

function episode(
  phase: "arrival" | "main" | "return",
  title: string,
  optionLabel: string,
  outcomeSummary: string,
  optionKey?: string,
) {
  const episodeId = `episode_${phase}`;
  const serverFacts = buildServerJourneyEpisodeFacts({
    journeyId: "journey_story",
    episodeId,
    phase,
    title,
    agent: { id: "agent_moth", displayName: "灯蛾" },
    worldObjectRefs: phase === "main" ? [
      { id: "region_gray_harbor", type: "region", label: "灰港" },
      { id: "location_gray_harbor_civic_ledger", type: "workplace", label: "灰港民务账房" },
      { id: "organization_gray_harbor_civic_office", type: "organization", label: "灰港民务所" },
      { id: "npc_night_clerk_kelan", type: "npc", label: "夜班书记珂岚" },
      { id: "document_gray_harbor_salt_ledger", type: "document", label: "灰港盐票账册" },
    ] : [{ id: "region_gray_harbor", type: "region", label: "灰港" }],
    action: { ...(optionKey ? { optionKey } : {}), optionLabel, outcomeSummary },
    canonicalEventIds: [`event_${phase}`],
  });
  const narrative = buildPersistedJourneyNarrative({ serverFacts }).value;
  return { episodeId, phase, title, serverFacts, narrative };
}

const episodes = [
  episode("arrival", "抵达灰港", "沿登记路线入港", "灯蛾完成入港登记"),
  episode("main", "盐账核对", "逐页复核盐账", "灯蛾发现并标记一处数字差异", "verify_salt_ledger"),
  episode("return", "返回档案馆", "带着核对记录返程", "灯蛾安全返回并提交记录"),
] as const;

test("composes a complete server-grounded story report from three settled episodes", () => {
  const report = buildGroundedJourneyStoryReport({
    journeyId: "journey_story",
    status: "settled",
    objective: "找一份稳定工作",
    regionId: "region_gray_harbor",
    startedAtWorldTime: "2026-01-01T08:00:00.000Z",
    dueAtWorldTime: "2026-01-01T09:30:00.000Z",
    episodes,
  });

  assert.ok(report);
  assert.equal(report.kind, "grounded_story_report");
  assert.equal(report.version, 3);
  assert.equal(report.profile.codeName, "X-NTMOTH");
  assert.equal(report.profile.reincarnation, "轮回第一世");
  assert.equal(report.profile.identity, "灯蛾");
  assert.equal(report.profile.objective, "找一份稳定工作");
  assert.equal(report.evaluation.taskCompletionGrade, "C");
  assert.equal(report.evaluation.identityFidelityPercent, 40);
  assert.equal(report.evaluation.warning, "该身份将无法保留");
  assert.equal(report.storyElements.time, "黑曜历1年初火月1日08:00，返程时限初火月1日09:30");
  assert.equal(report.storyElements.place, "灰港、灰港民务账房");
  assert.deepEqual(report.storyElements.characters, ["灯蛾", "夜班书记珂岚"]);
  assert.match(report.storyElements.beginning, /你现在已经转生成为灯蛾/);
  assert.match(report.storyElements.event, /核对中出现一处差额/);
  assert.match(report.storyElements.action, /逐项核对灰港盐票账册和原始登记/);
  assert.match(report.storyElements.result, /安全返回并提交记录/);
  assert.deepEqual(Object.keys(report.storyElements), [
    "time", "place", "characters", "beginning", "event", "action", "result",
  ]);
  assert.deepEqual(Object.keys(report.structure), ["desire", "obstacle", "choice", "consequence"]);
  assert.deepEqual(report.chapters.map((chapter) => chapter.key), [
    "departure", "arrival", "encounter", "decision", "consequence", "return", "aftermath",
  ]);
  assert.deepEqual(report.chapters.map((chapter) => chapter.title), [
    "一、转生与出发", "二、抵达灰港", "三、账房里的盐账", "四、核对盐账", "五、发现差额", "六、返程", "七、结果",
  ]);
  assert.doesNotMatch(report.chapters.map((chapter) => chapter.title).join(" "), /任务简报|行动与后果/);
  assert.equal(report.storyContent.split("\n\n").length, report.chapters.length);
  assert.match(report.narrative, /^代号：X-NTMOTH\n轮回第一世。\n身份：灯蛾\n该局目标：找一份稳定工作/u);
  assert.match(report.narrative, /故事内容：\n\n你现在已经转生成为灯蛾。/u);
  assert.match(report.narrative, /评价：\n任务完成度：C\n身份还原度：40%\n获得奖励：未获得独立奖励\n其他玩家影响：未记录其他玩家直接参与；本局没有对其他玩家增减资源或改写身份。\n警告：该身份将无法保留$/u);
  assert.match(report.narrative, /找一份稳定工作/);
  assert.match(report.storyContent, /灰港民务账房/);
  assert.match(report.storyContent, /灰港民务所/);
  assert.match(report.storyContent, /夜班书记珂岚/);
  assert.match(report.storyContent, /灰港盐票账册/);
  assert.match(report.storyContent, /开始逐项核对灰港盐票账册和原始登记/);
  assert.match(report.storyContent, /安全返回并提交记录/);
  assert.match(report.storyContent, /黑曜历1年初火月1日08:00/);
  assert.match(report.storyContent, /返程时限初火月1日09:30/);
  assert.doesNotMatch(report.storyContent, /2026年|现实时间|北京时间/u);
  assert.match(report.evaluation.playerImpact.summary, /未记录其他玩家直接参与/u);
  assert.doesNotMatch(report.storyContent, /找一份稳定工作/);
  assert.doesNotMatch(report.storyContent, /选择了「/);
  assert.doesNotMatch(report.storyContent, /任务|目标|委托|完成标准|成功条件|失败条件|结算|可追溯/);
  assert.doesNotMatch(report.storyContent, /凭印象|下结论|原因保持未定|能够确认|编造原因|问题本身留在/);
  assert.doesNotMatch(report.storyContent, /只有一个返程时限|真正的变故|当班桌|当着.*的面|办事结果|否则|足以证明|返程时限已经逼近|终于|入口放行|先核总数/);
  assert.match(report.storyContent, /核对中出现一处差额/);
  assert.doesNotMatch(report.storyContent.split("\n\n").slice(1).join("\n\n"), /灯蛾|他|她/);
  assert.doesNotMatch(report.title, /任务报告/);
  assert.doesNotMatch(report.summary, /灰港民务账房在灰港民务账房/);
  assert.ok((report.narrative.match(/灯蛾/g) || []).length <= 5, "protagonist name is repeated mechanically");
  assert.doesNotMatch(
    report.storyContent,
    /服务器|本局|成功条件|失败条件|结算边界|阶段任务|可追溯|未经结算|分开记账|标记为[“"](?:完成|失败)/,
  );
  assert.doesNotMatch(report.narrative, /必须在这里作出一次具体选择|这次旅程至此完成结算/);
  assert.equal(report.resolution.journeyStatus, "completed");
  assert.equal(report.mission.status, "completed");
  assert.equal(report.resolution.missionStatus, "completed");
  assert.equal(report.resolution.objectiveStatus, "progressed");
  assert.match(report.resolution.unresolved, /任务已经完成/);
  assert.match(report.resolution.unresolved, /后续旅程/);
  assert.ok(report.chapters.every((chapter) => chapter.sourceEventIds.length > 0));
  assert.deepEqual(report.episodeIds, episodes.map((entry) => entry.episodeId));
  assert.deepEqual(report.sourceEventIds, ["event_arrival", "event_main", "event_return"]);
  assert.doesNotMatch(JSON.stringify({
    title: report.title,
    summary: report.summary,
    narrative: report.narrative,
    structure: report.structure,
    chapters: report.chapters.map((chapter) => ({ title: chapter.title, text: chapter.text })),
    resolution: report.resolution,
  }), /agent_moth|region_gray_harbor|event_main/);
});

test("settles an off-mission choice as a clear failed mission instead of an unresolved success", () => {
  const failedEpisodes = [
    episodes[0],
    episode(
      "main",
      "盐账核对",
      "说明后离开账房",
      "灯蛾没有接受登记事务，安全离开账房",
      "leave_without_commitment",
    ),
    episodes[2],
  ] as const;
  const report = buildGroundedJourneyStoryReport({
    journeyId: "journey_story",
    status: "settled",
    objective: "找一份稳定工作",
    regionId: "region_gray_harbor",
    startedAtWorldTime: "2026-01-01T08:00:00.000Z",
    dueAtWorldTime: "2026-01-01T09:30:00.000Z",
    episodes: failedEpisodes,
  });

  assert.ok(report);
  assert.equal(report.mission.status, "failed");
  assert.equal(report.resolution.missionStatus, "failed");
  assert.equal(report.mission.outcome?.result, "failure");
  assert.equal(report.mission.tasks[1]?.status, "failed");
  assert.equal(report.evaluation.taskCompletionGrade, "F");
  assert.match(report.narrative, /任务完成度：F/);
  assert.doesNotMatch(report.storyContent, /任务|目标|委托|成功|失败|结算|可追溯/);
});

test("fails closed until a settled journey has all three grounded episodes", () => {
  assert.equal(buildGroundedJourneyStoryReport({
    journeyId: "journey_story",
    status: "running",
    objective: "找一份稳定工作",
    regionId: "region_gray_harbor",
    episodes,
  }), undefined);
  assert.equal(buildGroundedJourneyStoryReport({
    journeyId: "journey_story",
    status: "settled",
    objective: "找一份稳定工作",
    regionId: "region_gray_harbor",
    episodes: episodes.slice(0, 2),
  }), undefined);
});
