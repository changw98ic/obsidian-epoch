import type { EpochEvent } from "./events.ts";
import type { EpochProjection } from "./gameCore.ts";
import {
  publicEventTypeLabel,
  publicRegionLabel,
  publicStatusLabel,
  publicText,
} from "./publicVocabulary.ts";

type AnyRecord = Record<string, unknown>;

export interface EpochRegionNewsDraft {
  readonly headline: string;
  readonly body: string;
  readonly legendDelta: number;
}

function recordValue(value: unknown): AnyRecord {
  return value && typeof value === "object" ? value as AnyRecord : {};
}

function publicActorName(value: unknown): string {
  const name = typeof value === "string" ? publicText(value) : "";
  return name && name !== "已记录" ? name : "相关探索者";
}

export function regionNewsEventRegionId(projection: EpochProjection, event: EpochEvent): string | undefined {
  const payload = recordValue(event.payload);
  if (typeof payload.regionId === "string") return payload.regionId;
  if (event.eventType === "contested_objective_contributed" || event.eventType === "contested_objective_settled") {
    const objectiveId = typeof payload.objectiveId === "string" ? payload.objectiveId : "";
    return projection.contestedObjectives[objectiveId]?.regionId;
  }
  if (event.eventType === "resource_node_contested" || event.eventType === "resource_node_settled") {
    const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "";
    return projection.resourceNodes[nodeId]?.regionId;
  }
  if (event.eventType === "anomaly_event_contested" || event.eventType === "anomaly_event_resolved") {
    const anomalyId = typeof payload.anomalyId === "string" ? payload.anomalyId : "";
    return projection.anomalyEvents[anomalyId]?.regionId;
  }
  return undefined;
}

export function regionNewsDraftForEvent(
  projection: EpochProjection,
  event: EpochEvent,
  regionId: string,
): EpochRegionNewsDraft {
  const payload = recordValue(event.payload);
  const regionName = publicRegionLabel(regionId);
  const agentId = typeof event.agentId === "string"
    ? event.agentId
    : typeof payload.agentId === "string"
      ? payload.agentId
      : typeof payload.winnerAgentId === "string"
        ? payload.winnerAgentId
        : "";
  const identity = agentId ? projection.identities[agentId] : undefined;
  const actorName = publicActorName(identity?.identityName || payload.explorerId || payload.winnerExplorerId || event.actorExplorerId);
  if (event.eventType === "message_posted") {
    const body = publicText(String(payload.body || "").slice(0, 120));
    return {
      headline: `${actorName} 登上${regionName}简报`,
      body: `服务器将一条区域发言整理为公开新闻：${body}`,
      legendDelta: 1,
    };
  }
  if (event.eventType === "raid_resolved") {
    const outcome = typeof payload.outcome === "string" ? publicStatusLabel(payload.outcome) : "未记录";
    return {
      headline: `${regionName}出现新的对抗结算`,
      body: `服务器记录了一次对抗：${outcome}，攻防强度已经结算。`,
      legendDelta: 1,
    };
  }
  if (event.eventType === "downtime_claimed" || event.eventType === "downtime_tick_resolved") {
    const diaryEntry = recordValue(payload.diaryEntry);
    const title = typeof diaryEntry.title === "string" ? publicText(diaryEntry.title) : "托管记录";
    const summary = typeof diaryEntry.summary === "string" ? publicText(diaryEntry.summary) : "服务器记录了一次托管进展。";
    return {
      headline: `${actorName} 的${title}托管记录`,
      body: `服务器将一次托管活动整理为区域新闻：${summary}`,
      legendDelta: event.eventType === "downtime_claimed" ? 1 : 0,
    };
  }
  if (event.eventType === "contested_objective_settled") {
    return {
      headline: `${regionName}公共目标完成结算`,
      body: `区域公共目标完成结算，胜者与奖励由服务器事件确认。`,
      legendDelta: 1,
    };
  }
  if (event.eventType === "resource_node_settled") {
    return {
      headline: `${regionName}资源点完成争夺结算`,
      body: `区域资源点完成争夺，胜者、分数和资源奖励由服务器事件确认。`,
      legendDelta: 1,
    };
  }
  if (event.eventType === "anomaly_event_spawned") {
    const title = typeof payload.title === "string" ? publicText(payload.title) : "区域异常";
    const severity = typeof payload.severity === "string" ? publicStatusLabel(payload.severity) : "未记录";
    const targetScore = typeof payload.targetScore === "number" ? payload.targetScore : 0;
    return {
      headline: `${regionName}异常警报：${title}`,
      body: `服务器在${regionName}刷新异常事件「${title}」，强度 ${severity}，目标压制分 ${targetScore}。`,
      legendDelta: 0,
    };
  }
  if (event.eventType === "anomaly_event_resolved") {
    const anomalyId = typeof payload.anomalyId === "string" ? payload.anomalyId : "";
    const anomaly = projection.anomalyEvents[anomalyId];
    const title = publicText(anomaly?.title || "区域异常");
    const outcome = payload.outcome === "contained" ? "压制成功" : "突破失控";
    const winningScore = typeof payload.winningScore === "number" ? payload.winningScore : 0;
    const winnerText = typeof payload.winnerAgentId === "string"
      ? actorName
      : "无人完成压制";
    return {
      headline: `${title}${outcome}`,
      body: `服务器结算${regionName}的异常事件「${title}」：${outcome}，胜者 ${winnerText}，有效分 ${winningScore}。`,
      legendDelta: payload.outcome === "contained" && typeof payload.winnerAgentId === "string" ? 2 : 1,
    };
  }
  return {
    headline: `${regionName}出现新的公共事件`,
    body: `服务器把${publicEventTypeLabel(event.eventType)}记录为区域公共新闻。`,
    legendDelta: 1,
  };
}
