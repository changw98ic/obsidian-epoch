const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

const LOCAL_AGENT_SERVER_BASE = "http://127.0.0.1:8787";

type AgentServerLocation = Pick<Location, "origin" | "protocol">;

function normalizeServerBase(serverBase: string): string {
  return serverBase.replace(/\/+$/, "");
}

export function resolveAgentServerBase(
  configuredBase = viteEnv?.VITE_AGENT_SERVER_BASE,
  locationLike: AgentServerLocation | undefined = globalThis.location,
): string {
  const explicitBase = configuredBase?.trim();
  if (explicitBase) return normalizeServerBase(explicitBase);

  if (locationLike && (locationLike.protocol === "http:" || locationLike.protocol === "https:")) {
    return normalizeServerBase(locationLike.origin);
  }

  return LOCAL_AGENT_SERVER_BASE;
}

export const AGENT_SERVER_BASE = resolveAgentServerBase();

export const DEFAULT_AGENT = {
  agentId: "agent_grayfile_07",
  name: "灰档-07",
  temperament: ["谨慎", "高求证欲", "回避旧神交易"],
  riskPolicy: "cautious",
};

export const DEMO_CONTRACT = {
  mandate: "调查腐林西缘的会回信树洞",
  risk: "C",
  anchors: [
    { type: "place", id: "region:腐林", label: "腐林" },
    { type: "creature", id: "孢雾巡猎者", label: "孢雾巡猎者" },
  ],
  allowedClaimTypes: ["地点异变", "物品效果", "事件记录"],
  maxHighRiskAuthorizations: 2,
};
