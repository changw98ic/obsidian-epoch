export interface AgentPlayerActionReadiness {
  readonly identity: string;
  readonly downtime: string;
  readonly completeRun: string;
  readonly result: string;
  readonly installStatus: string;
}

export interface AgentPlayerActionReadinessInput {
  readonly isBusy: boolean;
  readonly busyReason: string;
  readonly currentAgentId: string;
  readonly hasExplorer: boolean;
  readonly identitySlotsAvailable?: number;
  readonly canUseActiveIdentity: boolean;
  readonly actionEligibilityReason?: string;
}

export function createAgentPlayerActionReadiness(
  input: AgentPlayerActionReadinessInput,
): AgentPlayerActionReadiness {
  if (input.isBusy) {
    return {
      identity: input.busyReason,
      downtime: input.busyReason,
      completeRun: input.busyReason,
      result: input.busyReason,
      installStatus: input.busyReason,
    };
  }

  return {
    identity: identityDisabledReason(input),
    downtime: activityDisabledReason(input, {
      missingIdentity: "需要先开始/继续身份，托管行动才会解锁。",
      missingExplorer: "正在载入玩家恢复凭据，载入后可选择托管行动。",
      inactiveIdentity: "身份尚未处于可行动状态，等待恢复或同步后再托管。",
    }),
    completeRun: activityDisabledReason(input, {
      missingIdentity: "需要先开始/继续身份，完整探索才会解锁。",
      missingExplorer: "正在载入玩家恢复凭据，载入后可完整探索。",
      inactiveIdentity: "身份尚未处于可行动状态，等待恢复或同步后再探索。",
    }),
    result: "",
    installStatus: "",
  };
}

function identityDisabledReason(input: AgentPlayerActionReadinessInput) {
  if (!input.currentAgentId && input.identitySlotsAvailable === 0) return "身份槽已满，需先归档或轮回一个身份。";
  return "";
}

function activityDisabledReason(
  input: AgentPlayerActionReadinessInput,
  copy: {
    readonly missingIdentity: string;
    readonly missingExplorer: string;
    readonly inactiveIdentity: string;
  },
) {
  if (!input.currentAgentId) return copy.missingIdentity;
  if (!input.hasExplorer) return copy.missingExplorer;
  if (!input.canUseActiveIdentity) return input.actionEligibilityReason || copy.inactiveIdentity;
  return "";
}
