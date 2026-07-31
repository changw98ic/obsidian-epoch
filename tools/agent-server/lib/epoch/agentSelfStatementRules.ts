import type { EpochAgentIdentity } from "./gameCore.ts";
import type { EpochProgressView } from "./progressReadModel.ts";

export function agentSelfStatement(input: {
  readonly identity?: EpochAgentIdentity;
  readonly progress: EpochProgressView;
  readonly regionId?: string;
}): string {
  const identity = input.identity;
  const name = identity?.identityName || identity?.agentId || input.progress.agentId || "未签发身份";
  const regionText = input.regionId ? `在 ${input.regionId}` : "在黑曜纪元";
  const statusText = identity?.status === "archived" ? "已定档" : "仍在行动";
  const latestEvent = input.progress.latestEvents[0];
  const eventText = latestEvent ? `最近留下 ${latestEvent.eventType} 记录` : "等待第一条可审计经历";
  const statement = `我是${name}，${regionText}${statusText}，${eventText}。`;
  return /prompt|system|系统|规则|模型|提示/i.test(statement)
    ? `我是${name}，${regionText}${statusText}，以已记录经历继续前进。`
    : statement;
}
