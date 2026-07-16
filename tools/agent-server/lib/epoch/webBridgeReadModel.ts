import { buildAgentPromptLayers, type AgentPromptLayers } from "../contextPackage.ts";
import type { HostedActionRisk } from "./events.ts";
import type { EpochHostedSession } from "./gameCore.ts";

export interface EpochWebBridgeActionOption {
  readonly actionOptionId: string;
  readonly label: string;
  readonly risk: HostedActionRisk;
  readonly socialHookId?: string;
}

export interface EpochWebBridgeTurn {
  readonly sessionId: string;
  readonly agentId: string;
  readonly regionId: string;
  readonly mandate: string;
  readonly channelClass: "browser_copy_paste";
  readonly deliveryTrust: "untrusted_client";
  readonly actionOptions: readonly EpochWebBridgeActionOption[];
  readonly promptLayers: AgentPromptLayers;
  readonly copyPrompt: string;
}

export function webBridgeActionOptions(session: EpochHostedSession): readonly EpochWebBridgeActionOption[] {
  return session.actionOptions.map((option) => ({
    actionOptionId: option.actionOptionId,
    label: option.label,
    risk: option.risk,
    socialHookId: option.socialHookId,
  }));
}

export function webBridgePromptLayers(session: EpochHostedSession, additionalInstruction?: string): AgentPromptLayers {
  return buildAgentPromptLayers({
    agent: {
      agentId: session.agentId,
      name: session.agentId,
      riskPolicy: "server_issued_options_only",
      temperament: ["visible_narration_only"],
      traits: ["server_option_bound"],
    },
    mandate: session.mandate,
    additionalInstruction,
  });
}

export function webBridgeCopyPrompt(session: EpochHostedSession, promptLayers: AgentPromptLayers): string {
  const optionsJson = JSON.stringify(webBridgeActionOptions(session), null, 2);
  return [
    "黑曜纪元 Web LLM Bridge",
    "PROMPT_PRIORITY_ORDER: SYSTEM_POLICY > AGENT_IDENTITY_BOUNDARY > USER_MANDATE > USER_ADDITIONAL_INSTRUCTION",
    "SYSTEM_POLICY:",
    ...promptLayers.systemPolicy.effectiveInstructions.map((instruction) => `- ${instruction}`),
    "AGENT_IDENTITY_BOUNDARY:",
    `agentId: ${session.agentId}`,
    `regionId: ${session.regionId}`,
    `riskPolicy: ${promptLayers.agentIdentityBoundary.riskPolicy}`,
    ...promptLayers.agentIdentityBoundary.effectiveInstructions.map((instruction) => `- ${instruction}`),
    "USER_MANDATE:",
    promptLayers.userMandate.effectiveText,
    "USER_ADDITIONAL_INSTRUCTION:",
    `status: ${promptLayers.userAdditionalInstruction.status}`,
    `effectiveText: ${promptLayers.userAdditionalInstruction.effectiveText}`,
    `filteringReasons: ${promptLayers.userAdditionalInstruction.filteringReasons.join(",") || "none"}`,
    "你正在为一个实时网游生成可见叙事。服务器只接受下列服务器签发的 actionOptionId；你的文字不会改变奖励、寿命、身份、排名或最终判定。",
    "从 options 中选择一个 actionOptionId，并返回 JSON: {\"actionOptionId\":\"...\",\"visibleText\":\"...\"}",
    `options:\n${optionsJson}`,
  ].join("\n");
}

export function webBridgeTurnView(session: EpochHostedSession, additionalInstruction?: string): EpochWebBridgeTurn {
  const promptLayers = webBridgePromptLayers(session, additionalInstruction);
  return {
    sessionId: session.sessionId,
    agentId: session.agentId,
    regionId: session.regionId,
    mandate: session.mandate,
    channelClass: "browser_copy_paste",
    deliveryTrust: "untrusted_client",
    actionOptions: webBridgeActionOptions(session),
    promptLayers,
    copyPrompt: webBridgeCopyPrompt(session, promptLayers),
  };
}
