import {
  epochActivityMediaForKey,
  type EpochActivityAssetKey,
  type EpochActivityMedia,
} from "../activityAssets.ts";
import type { EpochAgentIdentity } from "./gameCore.ts";
import type { EpochProgressView } from "./progressReadModel.ts";
import type { EpochRegionCommissionSourceType } from "./regionCommissionReadModel.ts";
import type {
  EpochResultPageNextAction,
  EpochResultPageNextActionKind,
  EpochResultPageNextActionSourceType,
  EpochResultPageRegionalContext,
} from "./runtime.ts";

function activityMedia(activityKey: EpochActivityAssetKey): EpochActivityMedia {
  const media = epochActivityMediaForKey(activityKey);
  if (!media) throw new Error(`epoch_activity_media_missing:${activityKey}`);
  return media;
}

export function commissionToolName(sourceType: EpochRegionCommissionSourceType) {
  const tools: Record<EpochRegionCommissionSourceType, string> = {
    anomaly: "obsidian_epoch.contest_anomaly",
    bounty: "obsidian_epoch.claim_bounty",
    objective: "obsidian_epoch.contribute_objective",
    party_run: "obsidian_epoch.join_party_run",
    resource_node: "obsidian_epoch.contest_resource_node",
    social_hook: "obsidian_epoch.start_hosted_session",
  };
  return tools[sourceType];
}

export function resultPageNextActionMedia(input: {
  readonly kind: EpochResultPageNextActionKind;
  readonly sourceType?: EpochResultPageNextActionSourceType;
}) {
  if (input.kind === "continue_turn") return activityMedia("turn_card");
  if (input.kind === "resolve_retaliation") return activityMedia("retaliation");
  if (input.kind === "set_downtime") return activityMedia("downtime");
  if (input.kind === "reincarnate") return activityMedia("reincarnation");
  if (input.kind === "open_commission" && input.sourceType && input.sourceType !== "retaliation") {
    return activityMedia(input.sourceType);
  }
  return undefined;
}

export function resultPageNextActions(input: {
  readonly progress: EpochProgressView;
  readonly regionId?: string;
  readonly regionalContext?: EpochResultPageRegionalContext;
}): readonly EpochResultPageNextAction[] {
  const identity = input.progress.identity || input.progress.identities.at(-1);
  const actions: EpochResultPageNextAction[] = [];
  if (identity?.status === "active" && input.regionId) {
    actions.push({
      actionId: `continue_turn:${identity.agentId}:${input.regionId}`,
      kind: "continue_turn",
      label: "继续探索",
      reason: "回到控制台，恢复身份后继续派遣这个行动身份探索当前区域。",
      toolName: "obsidian_epoch.turn_card",
      regionId: input.regionId,
      media: resultPageNextActionMedia({ kind: "continue_turn" }),
      requiresRecoveryCode: true,
    });
  }
  const retaliation = identity
    ? input.regionalContext?.retaliations.find((item) => item.status === "open" && item.opportunityAgentId === identity.agentId)
    : undefined;
  if (identity?.status === "active" && retaliation) {
    actions.push({
      actionId: `retaliation:${retaliation.retaliationId}`,
      kind: "resolve_retaliation",
      label: "执行复仇",
      reason: `回应 ${retaliation.targetAgentId} 的袭击。`,
      toolName: "obsidian_epoch.resolve_retaliation",
      regionId: retaliation.regionId,
      sourceType: "retaliation",
      sourceId: retaliation.retaliationId,
      media: resultPageNextActionMedia({ kind: "resolve_retaliation", sourceType: "retaliation" }),
      requiresRecoveryCode: true,
    });
  }
  const primaryCommission = input.regionalContext?.commissions.find((commission) => commission.status === "open");
  if (identity?.status === "active" && primaryCommission) {
    actions.push({
      actionId: `commission:${primaryCommission.commissionId}`,
      kind: "open_commission",
      label: primaryCommission.actionLabel,
      reason: primaryCommission.title,
      toolName: commissionToolName(primaryCommission.sourceType),
      regionId: primaryCommission.regionId,
      sourceType: primaryCommission.sourceType,
      sourceId: primaryCommission.sourceId,
      media: resultPageNextActionMedia({ kind: "open_commission", sourceType: primaryCommission.sourceType }),
      requiresRecoveryCode: true,
    });
  }
  if (identity?.status === "active") {
    actions.push({
      actionId: `downtime:${identity.agentId}:${input.regionId || "world"}`,
      kind: "set_downtime",
      label: "设置托管",
      reason: "回到控制台设置托管，让行动身份在服务器时间里继续推进长期历程。",
      toolName: "obsidian_epoch.set_downtime",
      ...(input.regionId ? { regionId: input.regionId } : {}),
      media: resultPageNextActionMedia({ kind: "set_downtime" }),
      requiresRecoveryCode: true,
    });
  }
  if (identity?.status === "archived") {
    actions.push({
      actionId: `archive:${identity.agentId}`,
      kind: "view_archive",
      label: "查看终局档案",
      reason: "当前身份已经定档，公开档案和服务器收据可继续查看。",
      toolName: "obsidian_epoch.identity_archive",
      media: resultPageNextActionMedia({ kind: "view_archive" }),
    });
  }
  if (identity?.status === "archived" && !identity.nextAgentId) {
    actions.push({
      actionId: `reincarnate:${identity.agentId}`,
      kind: "reincarnate",
      label: "领取下一世身份",
      reason: "当前身份寿命结束后只能定档，可由服务器发放下一世身份。",
      toolName: "obsidian_epoch.reincarnate",
      media: resultPageNextActionMedia({ kind: "reincarnate" }),
      requiresRecoveryCode: true,
    });
  }
  return actions;
}

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
