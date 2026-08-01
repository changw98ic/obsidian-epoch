/**
 * Identity-related MCP tool handlers, extracted from mcpTools.ts.
 *
 * `registerIdentityHandlers` adds all identity tool entries to the shared
 * handler Map.  The `quickstart` tool is a standalone utility that produces
 * connection/playbook metadata; the `identity` tool supports an optional
 * authoritative-issuance flow; and the `agent_briefing` tool uses a
 * pre-bound `agentBriefingWithFinalVerification` helper so that the
 * complex settle-verification closure stays co-located in the parent scope.
 */

import {
  EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
  EPOCH_ARCHIVED_IDENTITY_LIFECYCLE_TOOL_NAMES,
} from "./epoch/actionEligibilityReadModel.ts";
import { EPOCH_CONTENT_POLICY_REGION_ENV_VAR, resolveEpochContentPolicy } from "./contentPolicy.ts";
import { resolveEpochFrontstageStatus } from "./frontstageStatus.ts";
import { AGENT_WORLD_TOOLS } from "./mcpToolDefinitions.ts";
import {
  optionalString,
  epochActiveIdentityToolAudit,
} from "./mcpToolsHelpers.ts";
import { assertPublicSafe } from "./safety.ts";
import { MCP_SERVER_INFO } from "./mcpConstants.ts";

type AnyRecord = Record<string, unknown>;

// ── Identity tool names ────────────────────────────────────────────

export const IDENTITY_TOOL_NAMES: readonly string[] = [
  "obsidian_epoch.register_explorer",
  "obsidian_epoch.quickstart",
  "obsidian_epoch.identity",
  "obsidian_epoch.rotate_recovery",
  "obsidian_epoch.progress",
  "obsidian_epoch.agent_briefing",
  "obsidian_epoch.archive_identity",
  "obsidian_epoch.reincarnate",
  "obsidian_epoch.identity_archive",
  "obsidian_epoch.explorer_profile",
  "obsidian_epoch.player_data_export",
  "obsidian_epoch.change_agent_custody",
  "obsidian_epoch.competitive_ladder",
];

// ── Minimal runtime interface for the identity delegates ───────────

interface IdentityRuntime {
  epochRegisterExplorer(args: AnyRecord): unknown;
  epochIdentity(args: AnyRecord): unknown;
  epochVerifyExplorerAuth(args: AnyRecord): unknown;
  epochRotateRecovery(args: AnyRecord): unknown;
  epochProgress(args: AnyRecord): unknown;
  epochArchiveIdentity(args: AnyRecord): unknown;
  epochReincarnate(args: AnyRecord): unknown;
  epochIdentityArchive(args: AnyRecord): unknown;
  epochExplorerProfile(args: AnyRecord): unknown;
  epochPlayerDataExport(args: AnyRecord): unknown;
  epochChangeAgentCustody(args: AnyRecord): unknown;
  epochCompetitiveLadder(args: AnyRecord): unknown;
}

// ── Helper interface ───────────────────────────────────────────────

/** Pre-bound helpers provided by the parent scope. */
export interface IdentityHandlerHelpers {
  /** Authoritative identity issuance flag. */
  readonly authoritativeIdentityIssuance: boolean;
  /** Strip identityName/maxLifetime from client input for server-owned issuance. */
  readonly serverAssignedIdentityInput: (input: AnyRecord) => AnyRecord;
  /** Pre-bound briefing handler with journey settle-verification. */
  readonly agentBriefingWithFinalVerification: (args: AnyRecord) => unknown;
}

// ── Quickstart utility (self-contained) ────────────────────────────

function epochQuickstart(input: AnyRecord = {}) {
  assertPublicSafe(input);
  const serverBase = typeof input.serverBase === "string" && input.serverBase.trim()
    ? input.serverBase.trim()
    : process.env.AGENT_WORLD_SERVER || "http://127.0.0.1:8787";
  const host = typeof input.host === "string" && input.host.trim() ? input.host.trim() : "generic MCP host";
  const contentPolicy = resolveEpochContentPolicy({
    requestedRegion: optionalString(input.contentPolicyRegion) || optionalString(input.regionCode),
  });
  return {
    serverName: MCP_SERVER_INFO.name,
    host,
    serverBase,
    installManifest: `${serverBase}/api/epoch/install-manifest`,
    installPage: `${serverBase}/epoch/install`,
    webConsole: `${serverBase}/epoch/web-play`,
    contentPolicy,
    frontstageStatus: resolveEpochFrontstageStatus(),
    playbookPath: "obsidian-epoch/references/one-turn-playbook.md",
    smokePlaybookPath: "obsidian-epoch/references/smoke-playbook.md",
    identityLifecycle: {
      statusField: "progress.identity.status",
      activeValue: "active",
      archivedValue: "archived",
      rule: "Only identities whose server progress identity status is active may use active gameplay tools. Archived identities cannot use active gameplay tools.",
      activeOnlyTools: EPOCH_ACTIVE_IDENTITY_TOOL_NAMES,
      activeOnlyAudit: epochActiveIdentityToolAudit(AGENT_WORLD_TOOLS),
      archivedLifecycleTools: EPOCH_ARCHIVED_IDENTITY_LIFECYCLE_TOOL_NAMES.map((tool) => ({
        tool,
        availability: "available_when_archived",
        purpose: tool === "obsidian_epoch.identity_archive"
          ? "Returns the terminal archive, lineage and final server-authored identity state."
          : tool === "obsidian_epoch.result_page"
            ? "Returns canonical public history without creating new active play."
            : "Accepts a reincarnation request only when server lifecycle rules allow it.",
      })),
    },
    hostConfig: {
      serverName: MCP_SERVER_INFO.name,
      command: "node",
      args: ["obsidian-epoch/bin/mcp-proxy.ts"],
      cwd: ".",
      env: {
        AGENT_WORLD_SERVER: serverBase,
        [EPOCH_CONTENT_POLICY_REGION_ENV_VAR]: contentPolicy.regionCode,
      },
    },
    journeyFlow: [
      {
        step: "briefing",
        tool: "obsidian_epoch.agent_briefing",
        purpose: "恢复当前旅程、领取已返程经历并聚合待决事项。",
      },
      {
        step: "prepare",
        tool: "obsidian_epoch.prepare_journey",
        purpose: "把一句自然语言意图转换为谨慎、均衡或探索预设的可读计划。",
        requires: ["agentId", "destinationRegionId", "owner authorization", "idempotencyKey"],
      },
      {
        step: "depart",
        tool: "obsidian_epoch.start_journey",
        purpose: "冻结现实/世界返程时间并记录到达段；默认暂停在 Agent 主事件决策。",
        requires: ["journeyId", "expectedVersion", "owner authorization", "idempotencyKey"],
      },
      {
        step: "propose_main_step",
        tool: "obsidian_epoch.propose_journey_step",
        purpose: "取得当前主事件的服务器签名 SceneContract，不产生结算。",
        requires: ["journeyId", "expectedVersion", "owner authorization", "idempotencyKey"],
      },
      {
        step: "commit_main_action",
        tool: "obsidian_epoch.commit_journey_action",
        purpose: "提交 Agent 选中的签名行动，并记录主事件与基于已确认路线的返程段。",
        requires: ["journeyId", "sceneId", "episodeId", "actionOptionId", "signature", "expectedVersion", "owner authorization", "idempotencyKey"],
      },
      {
        step: "wait_or_reconnect",
        tool: "obsidian_epoch.journey_status",
        purpose: "按 nextPollAt 读取状态；Host 离线不取消旅程，服务器在到期后幂等 catch-up。",
      },
      {
        step: "safe_recall",
        tool: "obsidian_epoch.recall_journey",
        purpose: "请求安全返程，不瞬移且不回滚已经发生的服务器事件。",
      },
      {
        step: "album",
        tool: "obsidian_epoch.journey_album",
        purpose: "读取长期身份的旅程与可验证 episode 收藏。",
      },
    ],
    oneTurnFlow: [
      {
        step: "inspect",
        tool: "obsidian_epoch.agent_briefing",
        purpose: "Read the current identity, resources, lifetime, region context, pending decisions and server action constraints.",
      },
      {
        step: "register_first_identity_if_needed",
        tool: "obsidian_epoch.register_explorer",
        purpose: "When this published proxy has no player identity, ask the server to issue the first server-owned identity and let the proxy retain the short-lived player credential.",
        requires: ["idempotencyKey"],
        anonymousBootstrapOnly: true,
      },
      {
        step: "issue_additional_identity_if_slot_available",
        tool: "obsidian_epoch.identity",
        purpose: "Issue a server-owned additional identity only when the existing explorer has an unlocked identity slot.",
        requires: ["explorerId", "idempotencyKey"],
      },
      {
        step: "create_turn_card",
        tool: "obsidian_epoch.turn_card",
        purpose: "Ask the server for visible context and public action options.",
        requires: ["agentId", "regionId", "prompt", "owner recovery authorization", "idempotencyKey"],
        requiresActiveIdentity: true,
        blockedWhen: "progress.identity.status is archived; use identity_archive/result_page/reincarnate instead.",
      },
      {
        step: "resolve_turn_intent",
        tool: "obsidian_epoch.resolve_turn_intent",
        purpose: "Describe the intended action in natural language; the server matches it to the current action options and Game Core settles the result.",
        requires: ["turnCardId", "sequence", "nonce", "intentText", "owner recovery authorization", "idempotencyKey"],
        requiresActiveIdentity: true,
        blockedWhen: "The turn card belongs to an archived identity or is not open.",
      },
      {
        step: "resolve_turn_signed_compatibility",
        tool: "obsidian_epoch.resolve_turn",
        purpose: "Compatibility path for clients that intentionally submit a server-issued actionOptionId and the matching card envelope.",
        requires: ["turnCardId", "sequence", "nonce", "actionOptionId", "owner recovery authorization", "idempotencyKey"],
        requiresActiveIdentity: true,
      },
      {
        step: "publish_result",
        tool: "obsidian_epoch.create_result_page",
        purpose: "Create a fixed public result page after obsidian_epoch.result_page returns a publishToken.",
        requires: ["publishToken", "owner recovery authorization", "idempotencyKey"],
      },
      {
        step: "watch_hosted_session",
        tool: "obsidian_epoch.hosted_watch",
        purpose: "Open the public spectator DTO for one hosted session; active action option IDs stay hidden.",
        requires: ["sessionId"],
      },
    ],
    trustBoundary: [
      "MCP hosts are clients, not authorities.",
      "Do not paste recovery credentials into ordinary chat; prefer the Web Agent console for owner-authorized writes.",
      "Canonical rewards, lifetime changes, rankings, NPC facts and public results come only from server events.",
      "Do not treat an agentId alone as permission to act; progress.identity.status must be active for active gameplay tools.",
    ],
  };
}

// ── Registration ───────────────────────────────────────────────────

export function registerIdentityHandlers(
  handlers: Map<string, (args: AnyRecord) => unknown>,
  runtime: IdentityRuntime,
  helpers: IdentityHandlerHelpers,
): void {
  handlers.set(
    "obsidian_epoch.register_explorer",
    (args) => runtime.epochRegisterExplorer(args),
  );

  handlers.set(
    "obsidian_epoch.quickstart",
    (args) => epochQuickstart(args),
  );

  handlers.set("obsidian_epoch.identity", (args) => {
    if (args.agentId && !args.explorerId) return runtime.epochIdentity(args);
    if (!helpers.authoritativeIdentityIssuance) return runtime.epochIdentity(args);
    runtime.epochVerifyExplorerAuth(args);
    return runtime.epochIdentity(helpers.serverAssignedIdentityInput(args));
  });

  handlers.set(
    "obsidian_epoch.rotate_recovery",
    (args) => runtime.epochRotateRecovery(args),
  );

  handlers.set(
    "obsidian_epoch.progress",
    (args) => runtime.epochProgress(args),
  );

  handlers.set(
    "obsidian_epoch.agent_briefing",
    (args) => helpers.agentBriefingWithFinalVerification(args),
  );

  handlers.set(
    "obsidian_epoch.archive_identity",
    (args) => runtime.epochArchiveIdentity(args),
  );

  handlers.set(
    "obsidian_epoch.reincarnate",
    (args) => runtime.epochReincarnate(args),
  );

  handlers.set(
    "obsidian_epoch.identity_archive",
    (args) => runtime.epochIdentityArchive(args),
  );

  handlers.set(
    "obsidian_epoch.explorer_profile",
    (args) => runtime.epochExplorerProfile(args),
  );

  handlers.set(
    "obsidian_epoch.player_data_export",
    (args) => runtime.epochPlayerDataExport(args),
  );

  handlers.set(
    "obsidian_epoch.change_agent_custody",
    (args) => runtime.epochChangeAgentCustody(args),
  );

  handlers.set(
    "obsidian_epoch.competitive_ladder",
    (args) => runtime.epochCompetitiveLadder(args),
  );
}
