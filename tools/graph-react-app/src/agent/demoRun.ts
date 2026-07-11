import { DEFAULT_AGENT, DEMO_CONTRACT } from "./agentTypes";
import type { ExplorerIdentity } from "../types";

export function createDemoRun(explorer: ExplorerIdentity) {
  return {
    mode: "demo",
    visibility: "private",
    explorerId: explorer.explorerId,
    agentId: DEFAULT_AGENT.agentId,
    mandate: DEMO_CONTRACT.mandate,
    anchors: DEMO_CONTRACT.anchors.map(({ type, id }) => ({ type, id })),
    events: [
      {
        id: "event_echo_pod_01",
        risk: "low",
        visibleText: "灰档-07 在腐林西缘记录到会模仿亲属声线的树洞回声。",
        outcome: "recorded first echo pattern",
      },
      {
        id: "event_echo_pod_02",
        risk: "medium",
        visibleText: "灰档-07 用盐化录音笔对比三段回声延迟。",
        outcome: "compared response timing",
      },
      {
        id: "event_echo_pod_03",
        risk: "high",
        authorized: true,
        visibleText: "委托人预授权后，灰档-07 封存一枚污染孢囊样本。",
        outcome: "sealed polluted sample",
      },
      {
        id: "event_echo_pod_04",
        risk: "low",
        visibleText: "灰档-07 撤回营地并提交可复核录音。",
        outcome: "returned with archive evidence",
      },
    ],
    ending: {
      type: "archive",
      summary: "灰档-07 证明树洞会复读死者录音，但没有触碰核心秘密。",
    },
    candidateClaims: [
      { subject: "会回信树洞", predicate: "effect", object: "会复读死者录音" },
      { subject: "盐化录音笔", predicate: "limit", object: "只能保存三次污染回声" },
      { subject: "灰档-07", predicate: "status", object: "听觉污染轻度" },
    ],
    agentDelta: {
      wounds: ["听觉污染轻度"],
      externalItems: ["盐化录音笔"],
    },
    clientModelInfo: {
      provider: "demo_local",
      modelName: "deterministic-demo",
    },
    clientScore: 999,
  };
}
