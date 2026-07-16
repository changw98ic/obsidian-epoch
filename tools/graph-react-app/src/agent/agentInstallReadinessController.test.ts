import assert from "node:assert/strict";
import test from "node:test";
import { createAgentInstallReadiness } from "./agentInstallReadinessController";
import type { EpochInstallStatus } from "./api";

function installStatus(input: {
  readonly ok?: boolean;
  readonly mcpHostCount?: number;
  readonly hostCount?: number;
  readonly bytes?: number;
  readonly sha256?: string;
  readonly smokeStatus?: "not_run" | "completed";
} = {}): EpochInstallStatus {
  return {
    ok: input.ok ?? true,
    truthLevel: "live_lightweight",
    hostInstall: {
      mcpHostCount: input.mcpHostCount ?? 2,
      hostCount: input.hostCount ?? 3,
      status: "generated",
    },
    package: {
      bytes: input.bytes ?? 1024,
      sha256: input.sha256 ?? "abcdef1234567890",
    },
    smoke: {
      status: input.smokeStatus ?? "not_run",
    },
  } as unknown as EpochInstallStatus;
}

function readinessInput(input: Partial<Parameters<typeof createAgentInstallReadiness>[0]> = {}) {
  return {
    installStatus: null,
    installStatusError: "",
    hasInstallManifest: false,
    hasWorldOverview: false,
    declaredToolCount: 80,
    mcpCommand: "npm run agent:mcp",
    operatorKey: "",
    currentAgentId: "",
    idempotencyScope: "web_install_check",
    busyAction: "",
    lastAgentRequest: "暂无请求",
    error: "",
    actionLabel: (label: string) => `行动 ${label}`,
    ...input,
  };
}

test("createAgentInstallReadiness reports the local empty install state", () => {
  const readiness = createAgentInstallReadiness(readinessInput());

  assert.equal(readiness.page, "已打开");
  assert.equal(readiness.server, "待检查");
  assert.equal(readiness.serverDetail, "未读取");
  assert.equal(readiness.mcp, "80 个工具已声明");
  assert.equal(readiness.mcpDetail, "npm run agent:mcp");
  assert.equal(readiness.package, "安装包待检查");
  assert.equal(readiness.smoke, "验收待检查");
  assert.equal(readiness.operatorKey, "未填写");
  assert.equal(readiness.identityId, "未签发");
  assert.equal(readiness.idempotencyDetail, "web_install_check_*");
  assert.equal(readiness.lastRequest, "暂无请求");
  assert.equal(readiness.lastError, "无");
});

test("createAgentInstallReadiness surfaces install status failures without hiding the latest error", () => {
  const readiness = createAgentInstallReadiness(readinessInput({
    installStatusError: "network down",
    hasInstallManifest: true,
    error: "operator key missing",
  }));

  assert.equal(readiness.server, "连接失败");
  assert.equal(readiness.serverDetail, "manifest");
  assert.equal(readiness.lastError, "operator key missing");
});

test("createAgentInstallReadiness reports live package host and busy action status", () => {
  const readiness = createAgentInstallReadiness(readinessInput({
    installStatus: installStatus({ mcpHostCount: 4, hostCount: 5, bytes: 4096, sha256: "1234567890abcdef" }),
    operatorKey: " operator ",
    currentAgentId: "agent_1",
    busyAction: "install-status",
  }));

  assert.equal(readiness.server, "已连接");
  assert.equal(readiness.serverDetail, "live_lightweight");
  assert.equal(readiness.mcp, "4/5 个宿主已配置");
  assert.equal(readiness.mcpDetail, "generated");
  assert.equal(readiness.package, "安装包已生成");
  assert.equal(readiness.packageDetail, "4096 bytes · sha256 1234567890ab");
  assert.equal(readiness.signingTrust, "签名状态已记录");
  assert.equal(readiness.smoke, "待运行");
  assert.equal(readiness.smokeDetail, "运行安装验收后记录状态");
  assert.equal(readiness.operatorKey, "已填写");
  assert.equal(readiness.identityId, "agent_1");
  assert.equal(readiness.lastRequest, "运行中：行动 install-status");
});
