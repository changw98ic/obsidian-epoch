import type { EpochInstallStatus } from "./api";

export interface AgentInstallReadiness {
  readonly page: string;
  readonly server: string;
  readonly serverDetail: string;
  readonly mcp: string;
  readonly mcpDetail: string;
  readonly package: string;
  readonly packageDetail: string;
  readonly signingTrust: string;
  readonly smoke: string;
  readonly smokeDetail: string;
  readonly operatorKey: string;
  readonly identityId: string;
  readonly idempotencyKey: string;
  readonly idempotencyDetail: string;
  readonly lastRequest: string;
  readonly lastError: string;
}

export interface AgentInstallReadinessInput {
  readonly installStatus: EpochInstallStatus | null;
  readonly installStatusError: string;
  readonly hasInstallManifest: boolean;
  readonly hasWorldOverview: boolean;
  readonly declaredToolCount: number;
  readonly mcpCommand: string;
  readonly operatorKey: string;
  readonly currentAgentId: string;
  readonly idempotencyScope: string;
  readonly busyAction: string;
  readonly lastAgentRequest: string;
  readonly error: string;
  readonly actionLabel: (label: string) => string;
}

export function createAgentInstallReadiness(input: AgentInstallReadinessInput): AgentInstallReadiness {
  const status = input.installStatus;
  return {
    page: "已打开",
    server: input.installStatusError
      ? "连接失败"
      : status?.ok
        ? "已连接"
        : input.hasInstallManifest
          ? "安装清单已读取"
          : input.hasWorldOverview
            ? "公开世界已读取"
            : "待检查",
    serverDetail: status?.truthLevel || (input.hasInstallManifest ? "manifest" : input.hasWorldOverview ? "world overview" : "未读取"),
    mcp: status
      ? `${status.hostInstall.mcpHostCount}/${status.hostInstall.hostCount} 个宿主已配置`
      : `${input.declaredToolCount} 个工具已声明`,
    mcpDetail: status?.hostInstall.status || input.mcpCommand,
    package: status ? "安装包已生成" : "安装包待检查",
    packageDetail: status ? `${status.package.bytes} bytes · sha256 ${status.package.sha256.slice(0, 12)}` : "待检查",
    signingTrust: status ? "签名状态已记录" : "签名状态待检查",
    smoke: status ? status.smoke.status === "not_run" ? "待运行" : "已记录" : "验收待检查",
    smokeDetail: status?.smoke.status === "not_run" ? "运行安装验收后记录状态" : "安装验收已记录",
    operatorKey: input.operatorKey.trim() ? "已填写" : "未填写",
    identityId: input.currentAgentId || "未签发",
    idempotencyKey: "自动生成",
    idempotencyDetail: `${input.idempotencyScope}_*`,
    lastRequest: input.busyAction ? `运行中：${input.actionLabel(input.busyAction)}` : input.lastAgentRequest,
    lastError: input.error || input.installStatusError || "无",
  };
}
