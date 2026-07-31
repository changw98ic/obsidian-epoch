import assert from "node:assert/strict";
import test from "node:test";
import { resolveAgentServerBase } from "./agentTypes";
import {
  AGENT_SERVER_NOT_CONNECTED_CODE,
  AgentServerConnectionError,
  adjudicateEpochLoreTarget,
  bindEpochInventoryItem,
  confirmEpochPersonalityDrift,
  createEpochInventoryItem,
  craftEpochInventoryItem,
  acceptEpochDirectTrade,
  cancelEpochDirectTrade,
  createEpochDirectTrade,
  createEpochOrganization,
  getEpochAgentBriefing,
  getEpochAgentMemory,
  getEpochPersonalMigrationSummary,
  getEpochAbuseProfiles,
  getEpochAbuseStatus,
  getEpochDirectTrades,
  getEpochExplorerProfile,
  getEpochHostedSessionWatch,
  getEpochHostedSessions,
  getEpochInstallStatus,
  getEpochInventory,
  getEpochLoreContributions,
  getEpochLoreTargets,
  getEpochModerationQueue,
  getEpochOperatorOverview,
  getEpochOrganizations,
  getEpochResultPage,
  getEpochWorldOverview,
  getPublicWorldContext,
  getEpochServerHostedJobs,
  getEpochShop,
  postEpochMessage,
  contributeEpochOrganizationTreasury,
  proposeEpochOrganizationBudget,
  purchaseEpochOrganizationUpgrade,
  purchaseEpochShopOffer,
  queueEpochServerHostedAction,
  releaseEpochAbuseRestriction,
  registerEpochExplorer,
  requestEpochPartyJoin,
  resolveEpochRegionRevolt,
  revokeEpochResultPage,
  resolveEpochOrganizationBudget,
  resolveEpochPartyJoinRequest,
  resolveEpochModeration,
  rotateEpochRecovery,
  runEpochServerHostedAction,
  runEpochServerHostedJob,
  runEpochMaintenance,
  tickEpochDirectTradeExpiry,
  updateEpochPartyInvite,
  updateEpochOrganizationMembership,
} from "./api";

test("agent API base resolves to current HTTPS origin for deployed web console", () => {
  assert.equal(
    resolveAgentServerBase(undefined, {
      protocol: "https:",
      origin: "https://epoch.example",
    }),
    "https://epoch.example",
  );
  assert.equal(
    resolveAgentServerBase(undefined, {
      protocol: "http:",
      origin: "http://127.0.0.1:5173",
    }),
    "http://127.0.0.1:5173",
  );
  assert.equal(
    resolveAgentServerBase(undefined, {
      protocol: "file:",
      origin: "null",
    }),
    "http://127.0.0.1:8787",
  );
  assert.equal(
    resolveAgentServerBase("https://configured.example///", {
      protocol: "https:",
      origin: "https://epoch.example",
    }),
    "https://configured.example",
  );
});

test("Epoch JSON APIs report HTML and invalid content types as Agent Server connection errors", async () => {
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response("<!doctype html><title>Vite app</title>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    }),
  ];

  try {
    for (const response of responses) {
      globalThis.fetch = async () => response.clone();
      await assert.rejects(
        () => getEpochInstallStatus(),
        (error: unknown) => {
          assert.ok(error instanceof AgentServerConnectionError);
          assert.equal(error.code, AGENT_SERVER_NOT_CONNECTED_CODE);
          assert.equal(error.path, "/api/epoch/install-status");
          assert.match(error.message, /未连接 Agent Server/);
          assert.doesNotMatch(error.message, /Unexpected token/);
          return true;
        },
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch API blocks key-shaped user text before network requests", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await assert.rejects(
      () => postEpochMessage({
        agentId: "agent_key_text",
        scope: "region",
        regionId: "region_gray_harbor",
        body: "误贴 API Key sk-proj-abcdefghijklmnopqrstuvwxyz0123456789",
        idempotencyKey: "web_key_text_block",
      }),
      /api_key_detected/,
    );
    assert.equal(called, false);

    await postEpochMessage({
      operatorKey: "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789",
      agentId: "agent_key_text",
      scope: "region",
      regionId: "region_gray_harbor",
      body: "安全正文",
      idempotencyKey: "web_key_text_safe",
    });
    assert.equal(called, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch install status API wraps live lightweight readiness route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/install-status")) {
      return new Response(JSON.stringify({
        ok: true,
        generatedAt: "2026-06-30T00:00:00.000Z",
        serverBase: "http://127.0.0.1:8787",
        truthLevel: "live_lightweight",
        manifest: {
          endpoint: "/api/epoch/install-manifest",
          name: "obsidian-epoch",
          version: "0.1.0-alpha",
          packageUrl: "http://127.0.0.1:8787/api/epoch/package/obsidian-epoch-agent-world-0.1.0-alpha.tar.gz",
        },
        package: {
          fileName: "obsidian-epoch-agent-world-0.1.0-alpha.tar.gz",
          contentType: "application/gzip",
          bytes: 12345,
          sha256: "abc123",
          url: "http://127.0.0.1:8787/api/epoch/package/obsidian-epoch-agent-world-0.1.0-alpha.tar.gz",
          signatureAlgorithm: "ed25519",
          integrityManifest: "obsidian-epoch/package-integrity.json",
          releasePublicKey: "release-public-key",
          releaseKeyId: "release-key-id",
          signingTrust: "developer_generated",
          signingKeySource: "bundled",
        },
        hostInstall: {
          status: "generated",
          hosts: ["codex", "claude-code"],
          hostCount: 2,
          mcpHosts: ["codex"],
          mcpHostCount: 1,
          bridgeHosts: ["claude-code"],
          hostConfigFiles: [{
            path: "obsidian-epoch/host-config/codex-plugin.json",
            url: "/api/epoch/host-config/codex-plugin.json",
            contentType: "application/json",
            bytes: 321,
            sha256: "config-sha",
          }],
        },
        smoke: {
          status: "not_run",
          lightweightOnly: true,
          installSmokeCommand: "npm run agent:install-smoke -- --json",
          remoteInstallSmokeCommand: "npm run agent:install-smoke -- --server <serverBase> --json",
          proofRequired: "This endpoint does not run MCP/Skill smoke; run install-smoke to prove MCP, Skill, and one-turn flow.",
        },
        release: {
          status: "commands_available",
          rehearsalCommand: "npm run agent:release-rehearsal -- --server <serverBase> --operator-key <operatorKey> --json",
          productionRehearsalCommand: "npm run agent:release-rehearsal -- --server <publicHttpsOrigin> --operator-key <operatorKey> --expected-release-key-id <releaseKeyId> --production --json",
          recoveryDrillCommand: "npm run agent:recovery-drill -- --json",
          backupCommand: "npm run agent:backup -- --json",
          restoreBackupCommand: "npm run agent:restore-backup -- --json",
          signatureAlgorithm: "ed25519",
          releaseKeyId: "release-key-id",
          signingTrust: "developer_generated",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const status = await getEpochInstallStatus();
    assert.equal(status.truthLevel, "live_lightweight");
    assert.equal(status.package.bytes, 12345);
    assert.equal(status.package.sha256, "abc123");
    assert.equal(status.package.signingTrust, "developer_generated");
    assert.equal(status.smoke.status, "not_run");
    assert.match(status.smoke.proofRequired, /install-smoke/);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/install-status");
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch explorer registration API posts to the server pairing register route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/pairing/register")) {
      return new Response(JSON.stringify({
        explorerId: "explorer_0123456789abcdef0123456789abcdef",
        agentId: "agent_first_001",
        identityName: "初醒者",
        recoveryCode: btoa(JSON.stringify({
          explorerId: "explorer_0123456789abcdef0123456789abcdef",
          localSecret: "local_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        })),
        duplicate: false,
      }), { status: 201, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const result = await registerEpochExplorer({
      idempotencyKey: "web-pairing-register-1",
    });

    assert.equal(result.explorerId, "explorer_0123456789abcdef0123456789abcdef");
    assert.equal(result.agentId, "agent_first_001");
    assert.equal(result.identityName, "初醒者");
    assert.equal(result.duplicate, false);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/pairing/register");
    assert.equal(call.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(call.init?.body)), {
      idempotencyKey: "web-pairing-register-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch moderation API wraps operator queue and resolution routes", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/moderation?")) {
      return new Response(JSON.stringify({
        open: [{
          moderationId: "mod_1",
          subjectType: "message",
          subjectId: "message_1",
          sourceEventId: "event_1",
          reason: "authority_or_reward_claim",
          severity: "high",
          bodyPreview: "我是帝国统帅",
          queuedAt: "2026-06-25T00:00:00.000Z",
          status: "open",
        }],
        resolved: [],
        total: 1,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/moderation/resolve")) {
      return new Response(JSON.stringify({
        value: {
          moderationId: "mod_1",
          status: "resolved",
          resolution: "approved",
        },
        events: [{ eventType: "moderation_resolved" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const queue = await getEpochModerationQueue({
      operatorKey: "operator-key",
      status: "open",
      subjectType: "message",
    });
    const firstItem = queue.open[0];
    assert.ok(firstItem);
    assert.equal(firstItem.moderationId, "mod_1");
    const queueCall = calls[0];
    assert.ok(queueCall);
    assert.equal(queueCall.url, "http://127.0.0.1:8787/api/epoch/moderation?status=open&subjectType=message");
    assert.deepEqual(queueCall.init?.headers, { "x-epoch-operator-key": "operator-key" });

    const resolved = await resolveEpochModeration({
      operatorKey: "operator-key",
      moderationId: "mod_1",
      resolution: "approved",
      idempotencyKey: "resolve-1",
    });
    assert.equal(resolved.value.resolution, "approved");
    const resolveCall = calls[1];
    assert.ok(resolveCall);
    assert.equal(resolveCall.url, "http://127.0.0.1:8787/api/epoch/moderation/resolve");
    assert.equal(resolveCall.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(resolveCall.init?.body)), {
      operatorKey: "operator-key",
      moderationId: "mod_1",
      resolution: "approved",
      idempotencyKey: "resolve-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch abuse status API wraps cooldown query route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/abuse/status?")) {
      return new Response(JSON.stringify({
        actorKey: "agent_1",
        disabled: false,
        limit: 1,
        windowMs: 60000,
        count: 1,
        remaining: 0,
        limited: true,
        resetAt: "2026-06-25T00:01:00.000Z",
        abuseScore: 3,
        abuseLevel: "watch",
        latestAbuseEventId: "epoch_event_abuse_score_1",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const status = await getEpochAbuseStatus({ agentId: "agent_1" });
    assert.equal(status.actorKey, "agent_1");
    assert.equal(status.limited, true);
    assert.equal(status.remaining, 0);
    assert.equal(status.abuseScore, 3);
    assert.equal(status.abuseLevel, "watch");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/abuse/status?agentId=agent_1");
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch direct trade API wraps private escrow routes", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/direct-trades?")) {
      return new Response(JSON.stringify({
        regionId: "region_gray_harbor",
        agentId: "agent_direct_a",
        status: "open",
        trades: [{
          tradeId: "trade_1",
          regionId: "region_gray_harbor",
          proposerAgentId: "agent_direct_a",
          counterpartyAgentId: "agent_direct_b",
          offeredAsset: {
            kind: "resource",
            resourceId: "aether",
            amount: 2,
          },
          requestedAsset: {
            kind: "resource",
            resourceId: "coin",
            amount: 7,
          },
          status: "open",
          createdAt: "2026-06-30T00:00:00.000Z",
          tradeRiskFlags: [],
          tradeRiskScore: 0,
          publicPages: {
            trade: "/epoch/direct-trade/trade_1",
            audit: "/epoch/audit?aggregateId=trade_1",
            region: "/epoch/region/region_gray_harbor",
            proposer: "/epoch/agent/agent_direct_a",
            counterparty: "/epoch/agent/agent_direct_b",
          },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/direct-trades/create")) {
      return new Response(JSON.stringify({ value: { tradeId: "trade_1", status: "open" }, events: [], projection: {} }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/direct-trades/accept")) {
      return new Response(JSON.stringify({ value: { tradeId: "trade_1", status: "accepted" }, events: [], projection: {} }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/direct-trades/cancel")) {
      return new Response(JSON.stringify({ value: { tradeId: "trade_1", status: "cancelled" }, events: [], projection: {} }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/direct-trades/expiry/tick")) {
      return new Response(JSON.stringify({ value: { tickedAt: "2026-06-30T00:02:00.000Z", updated: [] }, events: [], projection: {} }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const trades = await getEpochDirectTrades({
      regionId: "region_gray_harbor",
      agentId: "agent_direct_a",
      status: "open",
    });
    assert.equal(trades.trades[0]?.tradeId, "trade_1");
    assert.equal(trades.trades[0]?.offeredAsset.amount, 2);
    assert.equal(trades.trades[0]?.publicPages?.trade, "/epoch/direct-trade/trade_1");
    assert.equal(calls[0]?.url, "http://127.0.0.1:8787/api/epoch/direct-trades?agentId=agent_direct_a&regionId=region_gray_harbor&status=open");

    await createEpochDirectTrade({ tradeId: "new_trade" });
    assert.equal(calls[1]?.url, "http://127.0.0.1:8787/api/epoch/direct-trades/create");
    assert.equal(calls[1]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { tradeId: "new_trade" });

    await acceptEpochDirectTrade({ tradeId: "trade_1" });
    assert.equal(calls[2]?.url, "http://127.0.0.1:8787/api/epoch/direct-trades/accept");

    await cancelEpochDirectTrade({ tradeId: "trade_1" });
    assert.equal(calls[3]?.url, "http://127.0.0.1:8787/api/epoch/direct-trades/cancel");

    await tickEpochDirectTradeExpiry({ idempotencyKey: "tick-direct-1" });
    assert.equal(calls[4]?.url, "http://127.0.0.1:8787/api/epoch/direct-trades/expiry/tick");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch party invite API wraps leader invite route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/party-runs/invite")) {
      return new Response(JSON.stringify({
        value: {
          partyRunId: "party_1",
          joinPolicy: "invite_only",
          inviteTokenUseLimit: 1,
          inviteTokenUses: 0,
          inviteRecipientAgentId: "agent_scout",
          status: "open",
          members: [],
        },
        events: [{ eventType: "party_invite_updated", payload: { partyRunId: "party_1" } }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/party-runs/request-join")) {
      return new Response(JSON.stringify({
        value: {
          partyRunId: "party_1",
          status: "open",
          members: [],
          joinRequests: [{
            requestId: "request_1",
            agentId: "agent_scout",
            status: "pending",
          }],
        },
        events: [{ eventType: "party_join_requested", payload: { requestId: "request_1" } }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/party-runs/resolve-join-request")) {
      return new Response(JSON.stringify({
        value: {
          partyRunId: "party_1",
          status: "open",
          members: [{ agentId: "agent_scout", participantRole: "scout" }],
          joinRequests: [{
            requestId: "request_1",
            agentId: "agent_scout",
            status: "approved",
          }],
        },
        events: [
          { eventType: "party_join_request_resolved", payload: { requestId: "request_1" } },
          { eventType: "party_member_joined", payload: { agentId: "agent_scout" } },
        ],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const result = await updateEpochPartyInvite({
      partyRunId: "party_1",
      leaderAgentId: "agent_leader",
      inviteToken: "new-token",
      inviteTokenUseLimit: 1,
      inviteRecipientAgentId: "agent_scout",
    });
    assert.equal(result.value.partyRunId, "party_1");
    assert.equal(result.value.inviteRecipientAgentId, "agent_scout");
    assert.equal(calls[0]?.url, "http://127.0.0.1:8787/api/epoch/party-runs/invite");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
      partyRunId: "party_1",
      leaderAgentId: "agent_leader",
      inviteToken: "new-token",
      inviteTokenUseLimit: 1,
      inviteRecipientAgentId: "agent_scout",
    });

    const requested = await requestEpochPartyJoin({
      partyRunId: "party_1",
      agentId: "agent_scout",
      participantRole: "scout",
      requestNote: "ready",
    });
    assert.equal(requested.value.joinRequests?.[0]?.status, "pending");
    assert.equal(calls[1]?.url, "http://127.0.0.1:8787/api/epoch/party-runs/request-join");
    assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), {
      partyRunId: "party_1",
      agentId: "agent_scout",
      participantRole: "scout",
      requestNote: "ready",
    });

    const resolved = await resolveEpochPartyJoinRequest({
      partyRunId: "party_1",
      leaderAgentId: "agent_leader",
      requestId: "request_1",
      resolution: "approved",
    });
    assert.equal(resolved.value.joinRequests?.[0]?.status, "approved");
    assert.equal(calls[2]?.url, "http://127.0.0.1:8787/api/epoch/party-runs/resolve-join-request");
    assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), {
      partyRunId: "party_1",
      leaderAgentId: "agent_leader",
      requestId: "request_1",
      resolution: "approved",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch organization API supports agent membership queries and updates", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/organizations?")) {
      return new Response(JSON.stringify({
        agentId: "agent_org_a",
        organizations: [{
          organizationId: "organization_vanguard",
          organizationKey: "vanguard",
          displayName: "Vanguard",
          regionId: "region_gray_harbor",
          memberNpcIds: ["npc_captain"],
          memberAgentIds: ["agent_org_a"],
          standing: 3,
          treasury: { coin: 10 },
          upgradeKeys: [],
          upgrades: [],
          budgets: [{
            budgetId: "budget_1",
            organizationId: "organization_vanguard",
            organizationName: "Vanguard",
            regionId: "region_gray_harbor",
            proposedByAgentId: "agent_org_a",
            proposedByExplorerId: "explorer_org_a",
            title: "修补灰港灯塔",
            resourceId: "coin",
            amount: 5,
            status: "proposed",
            approvalThreshold: 2,
            rejectionThreshold: 2,
            approvalCount: 1,
            rejectionCount: 0,
            votes: [{
              voteId: "vote_budget_1",
              budgetId: "budget_1",
              organizationId: "organization_vanguard",
              organizationName: "Vanguard",
              regionId: "region_gray_harbor",
              resourceId: "coin",
              amount: 5,
              decision: "approved",
              voterAgentId: "agent_org_b",
              voterExplorerId: "explorer_org_b",
              voterRole: "vanguard",
              approvalCount: 1,
              rejectionCount: 0,
              approvalThreshold: 2,
              rejectionThreshold: 2,
              sourceEventIds: ["event_budget_1"],
              votedAt: "2026-06-30T00:03:00.000Z",
            }],
            sourceEventIds: ["event_budget_1"],
            proposedAt: "2026-06-30T00:00:00.000Z",
          }],
          treasuryLedger: [],
          recordedAt: "2026-06-30T00:00:00.000Z",
        }],
        memberships: [{
          membershipId: "membership_agent_org_a",
          organizationId: "organization_vanguard",
          organizationName: "Vanguard",
          memberType: "agent",
          agentId: "agent_org_a",
          explorerId: "explorer_org_a",
          regionId: "region_gray_harbor",
          role: "scout",
          status: "active",
          sourceEventIds: ["event_org_a"],
          recordedAt: "2026-06-30T00:00:00.000Z",
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/organizations/membership")) {
      return new Response(JSON.stringify({
        value: {
          membershipId: "membership_agent_org_a",
          organizationId: "organization_vanguard",
          organizationName: "Vanguard",
          memberType: "agent",
          agentId: "agent_org_a",
          explorerId: "explorer_org_a",
          regionId: "region_gray_harbor",
          role: "scout",
          status: "active",
          sourceEventIds: ["event_org_a"],
          recordedAt: "2026-06-30T00:00:00.000Z",
        },
        events: [{ eventType: "organization_membership_changed" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/organizations/upgrades/purchase")) {
      return new Response(JSON.stringify({
        value: {
          upgradeId: "upgrade_training_hall",
          organizationId: "organization_vanguard",
          organizationName: "Vanguard",
          regionId: "region_gray_harbor",
          upgradeKey: "training_hall",
          title: "训练厅",
          description: "Shared training.",
          purchasedByAgentId: "agent_org_a",
          purchasedByExplorerId: "explorer_org_a",
          costResourceId: "legend",
          costAmount: 2,
          sourceEventIds: ["event_treasury_spent"],
          purchasedAt: "2026-06-30T00:00:00.000Z",
        },
        events: [{ eventType: "organization_upgrade_purchased" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/organizations/treasury/contribute")) {
      return new Response(JSON.stringify({
        value: {
          treasuryEventId: "treasury_contribution_1",
          organizationId: "organization_vanguard",
          organizationName: "Vanguard",
          regionId: "region_gray_harbor",
          resourceId: "coin",
          amountDelta: 3,
          balanceAfter: 3,
          reason: "organization_contribution:agent_org_a",
          sourceEventIds: ["resource_spent_1"],
          recordedAt: "2026-06-30T00:00:00.000Z",
        },
        events: [
          { eventType: "resource_spent" },
          { eventType: "organization_treasury_changed" },
        ],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/organizations/budgets/propose")) {
      return new Response(JSON.stringify({
        value: {
          budgetId: "budget_1",
          organizationId: "organization_vanguard",
          organizationName: "Vanguard",
          regionId: "region_gray_harbor",
          proposedByAgentId: "agent_org_a",
          proposedByExplorerId: "explorer_org_a",
          title: "修补灰港灯塔",
          resourceId: "coin",
          amount: 5,
          status: "proposed",
          approvalThreshold: 2,
          rejectionThreshold: 2,
          approvalCount: 0,
          rejectionCount: 0,
          votes: [],
          sourceEventIds: ["event_budget_1"],
          proposedAt: "2026-06-30T00:00:00.000Z",
        },
        events: [{ eventType: "organization_budget_proposed" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/organizations/budgets/resolve")) {
      return new Response(JSON.stringify({
        value: {
          budgetId: "budget_1",
          organizationId: "organization_vanguard",
          organizationName: "Vanguard",
          regionId: "region_gray_harbor",
          proposedByAgentId: "agent_org_a",
          proposedByExplorerId: "explorer_org_a",
          title: "修补灰港灯塔",
          resourceId: "coin",
          amount: 5,
          status: "proposed",
          approvalThreshold: 2,
          rejectionThreshold: 2,
          approvalCount: 1,
          rejectionCount: 0,
          votes: [{
            voteId: "vote_budget_1",
            budgetId: "budget_1",
            organizationId: "organization_vanguard",
            organizationName: "Vanguard",
            regionId: "region_gray_harbor",
            resourceId: "coin",
            amount: 5,
            decision: "approved",
            voterAgentId: "agent_org_b",
            voterExplorerId: "explorer_org_b",
            voterRole: "vanguard",
            approvalCount: 1,
            rejectionCount: 0,
            approvalThreshold: 2,
            rejectionThreshold: 2,
            note: "批准公共工程预算。",
            sourceEventIds: ["event_budget_1"],
            votedAt: "2026-06-30T00:05:00.000Z",
          }],
          sourceEventIds: ["event_budget_vote_1"],
          proposedAt: "2026-06-30T00:00:00.000Z",
        },
        events: [{ eventType: "organization_budget_vote_recorded" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const organizations = await getEpochOrganizations({ agentId: "agent_org_a" });
    assert.equal(organizations.agentId, "agent_org_a");
    assert.equal(organizations.organizations[0]?.memberAgentIds[0], "agent_org_a");
    assert.equal(organizations.organizations[0]?.budgets[0]?.approvalThreshold, 2);
    assert.equal(organizations.organizations[0]?.budgets[0]?.approvalCount, 1);
    assert.equal(organizations.organizations[0]?.budgets[0]?.votes[0]?.voterRole, "vanguard");
    assert.equal(organizations.memberships[0]?.memberType, "agent");
    assert.equal(calls[0]?.url, "http://127.0.0.1:8787/api/epoch/organizations?agentId=agent_org_a");

    await updateEpochOrganizationMembership({
      agentId: "agent_org_a",
      organizationId: "organization_vanguard",
      role: "scout",
      status: "active",
      recoveryCode: "owner-code",
      idempotencyKey: "org-join-1",
    });
    assert.equal(calls[1]?.url, "http://127.0.0.1:8787/api/epoch/organizations/membership");
    assert.equal(calls[1]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), {
      agentId: "agent_org_a",
      organizationId: "organization_vanguard",
      role: "scout",
      status: "active",
      recoveryCode: "owner-code",
      idempotencyKey: "org-join-1",
    });

    await purchaseEpochOrganizationUpgrade({
      agentId: "agent_org_a",
      organizationId: "organization_vanguard",
      upgradeKey: "training_hall",
      recoveryCode: "owner-code",
      idempotencyKey: "org-upgrade-1",
    });
    assert.equal(calls[2]?.url, "http://127.0.0.1:8787/api/epoch/organizations/upgrades/purchase");
    assert.equal(calls[2]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), {
      agentId: "agent_org_a",
      organizationId: "organization_vanguard",
      upgradeKey: "training_hall",
      recoveryCode: "owner-code",
      idempotencyKey: "org-upgrade-1",
    });

    await contributeEpochOrganizationTreasury({
      agentId: "agent_org_a",
      organizationId: "organization_vanguard",
      resourceId: "coin",
      amount: 3,
      recoveryCode: "owner-code",
      idempotencyKey: "org-contribution-1",
    });
    assert.equal(calls[3]?.url, "http://127.0.0.1:8787/api/epoch/organizations/treasury/contribute");
    assert.equal(calls[3]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[3]?.init?.body)), {
      agentId: "agent_org_a",
      organizationId: "organization_vanguard",
      resourceId: "coin",
      amount: 3,
      recoveryCode: "owner-code",
      idempotencyKey: "org-contribution-1",
    });

    await proposeEpochOrganizationBudget({
      agentId: "agent_org_a",
      organizationId: "organization_vanguard",
      title: "修补灰港灯塔",
      description: "给公共工程申请预算。",
      resourceId: "coin",
      amount: 5,
      recoveryCode: "owner-code",
      idempotencyKey: "org-budget-propose-1",
    });
    assert.equal(calls[4]?.url, "http://127.0.0.1:8787/api/epoch/organizations/budgets/propose");
    assert.equal(calls[4]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[4]?.init?.body)), {
      agentId: "agent_org_a",
      organizationId: "organization_vanguard",
      title: "修补灰港灯塔",
      description: "给公共工程申请预算。",
      resourceId: "coin",
      amount: 5,
      recoveryCode: "owner-code",
      idempotencyKey: "org-budget-propose-1",
    });

    const resolved = await resolveEpochOrganizationBudget({
      agentId: "agent_org_b",
      budgetId: "budget_1",
      resolution: "approved",
      note: "批准公共工程预算。",
      recoveryCode: "approver-code",
      idempotencyKey: "org-budget-resolve-1",
    });
    assert.equal(resolved.value.status, "proposed");
    assert.equal(resolved.value.approvalCount, 1);
    assert.equal(resolved.value.votes[0]?.decision, "approved");
    assert.equal(resolved.events[0]?.eventType, "organization_budget_vote_recorded");
    assert.equal(calls[5]?.url, "http://127.0.0.1:8787/api/epoch/organizations/budgets/resolve");
    assert.equal(calls[5]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[5]?.init?.body)), {
      agentId: "agent_org_b",
      budgetId: "budget_1",
      resolution: "approved",
      note: "批准公共工程预算。",
      recoveryCode: "approver-code",
      idempotencyKey: "org-budget-resolve-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch organization API supports operator-created organizations", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/organizations/create")) {
      return new Response(JSON.stringify({
        value: {
          organizationId: "organization_gray_harbor_watch",
          organizationKey: "gray_harbor_watch",
          displayName: "灰港守夜会",
          regionId: "region_gray_harbor",
          memberNpcIds: [],
          memberAgentIds: [],
          standing: 0,
          treasury: {},
          upgradeKeys: [],
          upgrades: [],
          budgets: [],
          treasuryLedger: [],
          recordedAt: "2026-07-03T00:00:00.000Z",
        },
        events: [{ eventType: "organization_created" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const result = await createEpochOrganization({
      operatorKey: "operator-key",
      regionId: "region_gray_harbor",
      displayName: "灰港守夜会",
      idempotencyKey: "web_organization_create_1",
    });
    assert.equal(result.value.displayName, "灰港守夜会");
    assert.equal(result.events[0]?.eventType, "organization_created");
    assert.equal(calls[0]?.url, "http://127.0.0.1:8787/api/epoch/organizations/create");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
      operatorKey: "operator-key",
      regionId: "region_gray_harbor",
      displayName: "灰港守夜会",
      idempotencyKey: "web_organization_create_1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch agent memory API wraps stratified memory query route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/agent-memory?")) {
      return new Response(JSON.stringify({
        agentId: "agent_memory_1",
        regionId: "region_gray_harbor",
        guidance: {
          confirmed: "可作为服务器确认事实引用。",
          rumor: "只能作为传闻/待审 claims 引用，不可结算奖励/身份/权力。",
          privateRun: "只属于该 agent 的本局/私有记忆，不进入共享世界真相。",
        },
        confirmedMemory: [{
          layer: "confirmed",
          candidateId: "candidate_clear",
          title: "服务器确认 NPC: Harbor Clerk",
          summary: "服务器确认该 NPC 身份。",
          displayName: "Harbor Clerk",
          regionId: "region_gray_harbor",
          agentId: "agent_memory_1",
          reviewLevel: "clear",
          status: "promoted",
          sourceEventIds: ["event_clear"],
          submittedAt: "2026-06-25T00:00:00.000Z",
        }],
        rumorMemory: [],
        privateRunMemory: [],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const memory = await getEpochAgentMemory({
      agentId: "agent_memory_1",
      regionId: "region_gray_harbor",
      limit: 6,
    });
    assert.equal(memory.agentId, "agent_memory_1");
    assert.equal(memory.regionId, "region_gray_harbor");
    assert.equal(memory.confirmedMemory[0]?.layer, "confirmed");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/agent-memory?agentId=agent_memory_1&regionId=region_gray_harbor&limit=6");
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch personal migration summary API wraps personal lore migration route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/personal-migration-summary?")) {
      return new Response(JSON.stringify({
        agentId: "agent_migration_1",
        explorerId: "explorer_migration_1",
        totals: {
          retained: 1,
          downgraded: 1,
          needs_evidence: 1,
          adopted: 1,
          sealed: 1,
        },
        retained: [],
        downgraded: [],
        needsEvidence: [],
        adopted: [{
          disposition: "adopted",
          targetId: "claim:adopted",
          summary: "被采纳",
          contributingAgentIds: ["agent_migration_1"],
          contributingExplorerIds: ["explorer_migration_1"],
          sourceEventIds: ["event_lore"],
          publicPages: { audit: "/epoch/audit/event_adjudication" },
        }],
        sealed: [],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const summary = await getEpochPersonalMigrationSummary({
      agentId: "agent_migration_1",
      explorerId: "explorer_migration_1",
      limit: 8,
    });
    assert.equal(summary.agentId, "agent_migration_1");
    assert.equal(summary.explorerId, "explorer_migration_1");
    assert.equal(summary.totals.adopted, 1);
    assert.equal(summary.adopted[0]?.disposition, "adopted");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/personal-migration-summary?agentId=agent_migration_1&explorerId=explorer_migration_1&limit=8");
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch agent briefing API wraps unified progress and regional context route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/agent-briefing?")) {
      return new Response(JSON.stringify({
        generatedAt: "2026-06-30T00:00:00.000Z",
        agentId: "agent_briefing_1",
        explorerId: "explorer_briefing_1",
        regionId: "region_gray_harbor",
        progress: {
          agentId: "agent_briefing_1",
          explorerId: "explorer_briefing_1",
          lineage: ["agent_briefing_1"],
          identities: [],
          resources: { coin: 2 },
          resourceMedia: {},
          inventoryItems: [],
          equipmentEffects: [],
          downtime: null,
          pendingDowntime: null,
          actionEligibility: {
            statusField: "progress.identity.status",
            status: "active",
            canUseActiveTools: true,
            reason: "身份可行动。",
            activeOnlyTools: [],
            blockedTools: [],
          },
          claimableLegendNews: [],
          downtimeDiaryEntries: [],
          personalityDrifts: [],
          latestEvents: [],
        },
        regionalContext: {
          regionId: "region_gray_harbor",
          messages: [{
            messageId: "message_briefing_1",
            scope: "region",
            agentId: "agent_briefing_1",
            explorerId: "explorer_briefing_1",
            regionId: "region_gray_harbor",
            body: "灰港出现新的可行动线索。",
            postedAt: "2026-06-30T00:00:00.000Z",
            moderationStatus: "visible",
          }],
          news: [],
          commissions: [],
          raids: [],
          retaliations: [],
          traces: [],
        },
        world: {
          publicPages: {
            world: "/epoch/world",
            install: "/epoch/install",
            console: "/epoch/web-play",
          },
          news: [],
          regionHighlights: [],
          activeSeasons: [],
        },
        publicPages: {
          world: "/epoch/world",
          console: "/epoch/web-play",
          agent: "/epoch/agent/agent_briefing_1",
          explorer: "/epoch/explorer/explorer_briefing_1",
          region: "/epoch/region/region_gray_harbor",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const briefing = await getEpochAgentBriefing({
      agentId: "agent_briefing_1",
      explorerId: "explorer_briefing_1",
      regionId: "region_gray_harbor",
      limit: 6,
    });
    assert.equal(briefing.progress.agentId, "agent_briefing_1");
    assert.equal(Object.hasOwn(briefing, "pendingActions"), false);
    assert.equal(briefing.regionalContext?.messages[0]?.body, "灰港出现新的可行动线索。");
    assert.equal(briefing.publicPages.region, "/epoch/region/region_gray_harbor");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/agent-briefing?agentId=agent_briefing_1&explorerId=explorer_briefing_1&regionId=region_gray_harbor&limit=6");
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch agent briefing API encodes live cockpit query parameters", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return new Response(JSON.stringify({
      generatedAt: "2026-06-30T00:00:00.000Z",
      progress: {
        lineage: [],
        identities: [],
        resources: {},
        resourceMedia: {},
        inventoryItems: [],
        equipmentEffects: [],
        downtime: null,
        pendingDowntime: null,
        actionEligibility: {
          statusField: "progress.identity.status",
          status: "missing",
          canUseActiveTools: false,
          reason: "身份不存在。",
          activeOnlyTools: [],
          blockedTools: [],
        },
        claimableLegendNews: [],
        downtimeDiaryEntries: [],
        personalityDrifts: [],
        latestEvents: [],
      },
      world: {
        publicPages: {
          world: "/epoch/world",
          install: "/epoch/install",
          console: "/epoch/web-play",
        },
        news: [],
        regionHighlights: [],
        activeSeasons: [],
      },
      publicPages: {
        world: "/epoch/world",
        console: "/epoch/web-play",
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    await getEpochAgentBriefing({
      agentId: "agent/live 1",
      explorerId: "explorer/玩家",
      regionId: "region:盐门",
    });
    const call = calls[0];
    assert.ok(call);
    assert.equal(
      call.url,
      "http://127.0.0.1:8787/api/epoch/agent-briefing?agentId=agent%2Flive+1&explorerId=explorer%2F%E7%8E%A9%E5%AE%B6&regionId=region%3A%E7%9B%90%E9%97%A8",
    );
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Public world context API wraps versioned public context route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/world/public-context")) {
      return new Response(JSON.stringify({
        loopMode: "legacy_authored_report",
        worldVersion: "obsidian-epoch-alpha1-2026-06-25",
        sharedLoreSnapshotVersion: "shared-lore:0:abc",
        adjudicatorVersion: "obsidian-epoch-adjudicator-alpha1-2026-06-24",
        contextPackVersion: "obsidian-epoch-context-pack-2026-07-01",
        contextVersion: "obsidian-epoch-context-pack-2026-07-01",
        versions: {
          worldVersion: "obsidian-epoch-alpha1-2026-06-25",
          sharedLoreSnapshotVersion: "shared-lore:0:abc",
          adjudicatorVersion: "obsidian-epoch-adjudicator-alpha1-2026-06-24",
          contextPackVersion: "obsidian-epoch-context-pack-2026-07-01",
        },
        agent: { agentId: "agent_grayfile_07" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const context = await getPublicWorldContext({
      agentId: "agent_grayfile_07",
      explorerId: "explorer_api_context",
    }) as {
      readonly worldVersion: string;
      readonly sharedLoreSnapshotVersion: string;
      readonly contextVersion: string;
      readonly contextPackVersion: string;
      readonly agent: { readonly agentId: string };
    };
    assert.equal(context.agent.agentId, "agent_grayfile_07");
    assert.equal(context.contextVersion, context.contextPackVersion);
    assert.equal(context.sharedLoreSnapshotVersion, "shared-lore:0:abc");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/world/public-context");
    assert.equal(call.init?.method, "POST");
    assert.equal(call.init?.body, JSON.stringify({
      agentId: "agent_grayfile_07",
      explorerId: "explorer_api_context",
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch world overview API wraps canonical public overview route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/world-overview?")) {
      return new Response(JSON.stringify({
        generatedAt: "2026-06-28T00:00:00.000Z",
        worldVersion: "obsidian-epoch-alpha1-2026-06-25",
        sharedLoreSnapshotVersion: "shared-lore:2:def",
        adjudicatorVersion: "obsidian-epoch-adjudicator-alpha1-2026-06-24",
        contextPackVersion: "obsidian-epoch-context-pack-2026-07-01",
        totals: {
          identities: 3,
          activeIdentities: 2,
          archivedIdentities: 1,
          regionsWithNews: 1,
          resultPages: 2,
        },
        publicPages: {
          world: "/epoch/world",
          install: "/epoch/install",
          console: "/epoch/web-play",
        },
        news: [{
          newsId: "news_1",
          regionId: "region_gray_harbor",
          headline: "灰港上新闻",
          body: "服务器生成的区域新闻。",
          legendDelta: 2,
          sourceEventIds: ["event_news"],
          createdAt: "2026-06-28T00:00:00.000Z",
          moderationStatus: "visible",
          media: {
            kind: "news",
            title: "区域新闻",
            subtitle: "世界表面",
            imageUrl: "/api/epoch/assets/surface/news.png",
            assetPath: "obsidian-epoch/assets/surface/news.png",
          },
        }],
        recentResults: [{
          pageId: "page_1",
          createdAt: "2026-06-28T00:00:00.000Z",
          urlPath: "/epoch/result/page_1",
          createdBy: "agent",
          agentId: "agent_1",
          explorerId: "explorer_1",
          identityName: "盐门记录员",
          receiptHash: "sha256:abc",
          receiptFocus: { kind: "agent_snapshot", id: "agent_1" },
          canonicalEventCount: 2,
        }],
        legendaryDeaths: [],
        honorBoards: [],
        recentLoreContributions: [{
          contributionId: "lore_1",
          claimId: "lore_1",
          claimType: "confirmation",
          claimText: "灰港航标已被服务器事件证实。",
          claimHash: "sha256:lore_1_claim",
          eventId: "event_lore_1",
          category: "confirmation",
          agentId: "agent_1",
          explorerId: "explorer_1",
          identityName: "盐门记录员",
          targetId: "claim:gray-harbor",
          summary: "灰港航标已被服务器事件证实。",
          sourceEventIds: ["event_news"],
          provenance: {
            receiptType: "lore_contribution_provenance",
            contributionEventId: "event_lore_1",
            targetId: "claim:gray-harbor",
            sourceEventIds: ["event_news"],
            sourceEventCount: 1,
            sourceEventTypes: ["region_news_generated"],
            sourceAgentIds: ["agent_1"],
            sourceAggregateIds: ["region_gray_harbor"],
            sourceTrustClasses: ["system_worker"],
            sourceEvents: [{
              eventId: "event_news",
              eventType: "region_news_generated",
              aggregateType: "region",
              aggregateId: "region_gray_harbor",
              agentId: "agent_1",
              actorExplorerId: "system",
              trustClass: "system_worker",
              createdAt: "2026-06-28T00:00:00.000Z",
              publicPages: { audit: "/epoch/audit/event_news" },
            }],
            evidenceHash: "sha256:lore_1_evidence",
            recordedAt: "2026-06-28T00:00:00.000Z",
          },
          trustClass: "user_verified_web",
          recordedAt: "2026-06-28T00:00:00.000Z",
          publicPages: {
            agent: "/epoch/agent/agent_1",
            explorer: "/epoch/explorer/explorer_1",
            audit: "/epoch/audit/event_lore_1",
          },
        }],
        loreTargetStatuses: [{
          targetId: "claim:gray-harbor",
          status: "confirmed",
          statusSource: "system_adjudication",
          counts: {
            confirmation: 1,
            refutation: 0,
            revision: 0,
            total: 1,
          },
          contributingAgentIds: ["agent_1"],
          sourceEventIds: ["event_news"],
          latestContribution: {
            contributionId: "lore_1",
            claimId: "lore_1",
            claimType: "confirmation",
            claimText: "灰港航标已被服务器事件证实。",
            claimHash: "sha256:lore_1_claim",
            eventId: "event_lore_1",
            category: "confirmation",
            agentId: "agent_1",
            explorerId: "explorer_1",
            identityName: "盐门记录员",
            targetId: "claim:gray-harbor",
            summary: "灰港航标已被服务器事件证实。",
            sourceEventIds: ["event_news"],
            provenance: {
              receiptType: "lore_contribution_provenance",
              contributionEventId: "event_lore_1",
              targetId: "claim:gray-harbor",
              sourceEventIds: ["event_news"],
              sourceEventCount: 1,
              sourceEventTypes: ["region_news_generated"],
              sourceAgentIds: ["agent_1"],
              sourceAggregateIds: ["region_gray_harbor"],
              sourceTrustClasses: ["system_worker"],
              sourceEvents: [{
                eventId: "event_news",
                eventType: "region_news_generated",
                aggregateType: "region",
                aggregateId: "region_gray_harbor",
                agentId: "agent_1",
                actorExplorerId: "system",
                trustClass: "system_worker",
                createdAt: "2026-06-28T00:00:00.000Z",
                publicPages: { audit: "/epoch/audit/event_news" },
              }],
              evidenceHash: "sha256:lore_1_evidence",
              recordedAt: "2026-06-28T00:00:00.000Z",
            },
            trustClass: "user_verified_web",
            recordedAt: "2026-06-28T00:00:00.000Z",
            publicPages: {
              agent: "/epoch/agent/agent_1",
              explorer: "/epoch/explorer/explorer_1",
              audit: "/epoch/audit/event_lore_1",
            },
          },
          latestAdjudication: {
            adjudicationId: "lore_adjudication_1",
            eventId: "event_adjudication_1",
            targetId: "claim:gray-harbor",
            status: "confirmed",
            summary: "服务器裁决：灰港航标已证实。",
            sourceContributionEventIds: ["event_lore_1"],
            provenance: {
              receiptType: "lore_target_adjudication_provenance",
              adjudicationEventId: "event_adjudication_1",
              targetId: "claim:gray-harbor",
              sourceContributionEventIds: ["event_lore_1"],
              sourceContributionEventCount: 1,
              sourceAgentIds: ["agent_1"],
              sourceTrustClasses: ["user_verified_web"],
              sourceContributions: [{
                eventId: "event_lore_1",
                contributionId: "lore_1",
                category: "confirmation",
                agentId: "agent_1",
                targetId: "claim:gray-harbor",
                trustClass: "user_verified_web",
                recordedAt: "2026-06-28T00:00:00.000Z",
                evidenceHash: "sha256:lore_1_evidence",
                publicPages: { audit: "/epoch/audit/event_lore_1" },
              }],
              evidenceHash: "sha256:adjudication_1_evidence",
              adjudicatedAt: "2026-06-28T00:02:00.000Z",
            },
            operatorId: "operator",
            trustClass: "system_worker",
            adjudicatedAt: "2026-06-28T00:02:00.000Z",
            publicPages: {
              audit: "/epoch/audit/event_adjudication_1",
            },
          },
          publicPages: {
            audit: "/epoch/audit/event_adjudication_1",
          },
        }],
        activeSeasons: [],
        regionHighlights: [{
          regionId: "region_gray_harbor",
          newsCount: 1,
          messageCount: 2,
          leaderAgentId: "agent_1",
          leaderExplorerId: "explorer_1",
          publicPages: { region: "/epoch/region/region_gray_harbor" },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const overview = await getEpochWorldOverview({ limit: 4 });
    assert.equal(overview.contextPackVersion, "obsidian-epoch-context-pack-2026-07-01");
    assert.equal(overview.sharedLoreSnapshotVersion, "shared-lore:2:def");
    assert.equal(overview.publicPages.world, "/epoch/world");
    assert.equal(overview.totals.activeIdentities, 2);
    assert.equal(overview.news[0]?.headline, "灰港上新闻");
    assert.equal(overview.recentResults[0]?.urlPath, "/epoch/result/page_1");
    assert.equal(overview.recentLoreContributions[0]?.summary, "灰港航标已被服务器事件证实。");
    assert.equal(overview.loreTargetStatuses[0]?.status, "confirmed");
    assert.equal(overview.loreTargetStatuses[0]?.latestAdjudication?.summary, "服务器裁决：灰港航标已证实。");
    assert.equal(overview.regionHighlights[0]?.publicPages.region, "/epoch/region/region_gray_harbor");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/world-overview?limit=4");
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch lore adjudication API wraps operator target adjudication route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/lore/adjudicate")) {
      return new Response(JSON.stringify({
        value: {
          adjudicationId: "lore_adjudication_1",
          targetId: "claim:gray-harbor",
          status: "confirmed",
          summary: "服务器裁决：灰港航标已证实。",
          sourceContributionEventIds: ["event_lore_1"],
          provenance: {
            receiptType: "lore_target_adjudication_provenance",
            adjudicationEventId: "event_adjudication_1",
            targetId: "claim:gray-harbor",
            sourceContributionEventIds: ["event_lore_1"],
            sourceContributionEventCount: 1,
            sourceAgentIds: ["agent_lore_1"],
            sourceTrustClasses: ["user_verified_web"],
            sourceContributions: [{
              eventId: "event_lore_1",
              contributionId: "lore_1",
              category: "confirmation",
              agentId: "agent_lore_1",
              targetId: "claim:gray-harbor",
              trustClass: "user_verified_web",
              recordedAt: "2026-06-28T00:00:00.000Z",
              evidenceHash: "sha256:lore_1_evidence",
              publicPages: { audit: "/epoch/audit/event_lore_1" },
            }],
            evidenceHash: "sha256:adjudication_1_evidence",
            adjudicatedAt: "2026-06-28T00:02:00.000Z",
          },
          operatorId: "operator",
          adjudicatedAt: "2026-06-28T00:02:00.000Z",
        },
        events: [{ eventType: "lore_target_adjudicated" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const result = await adjudicateEpochLoreTarget({
      operatorKey: "operator_key",
      targetId: "claim:gray-harbor",
      status: "confirmed",
      summary: "服务器裁决：灰港航标已证实。",
      sourceContributionEventIds: ["event_lore_1"],
      idempotencyKey: "adjudicate-lore-1",
    });
    assert.equal(result.value.status, "confirmed");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/lore/adjudicate");
    assert.equal(call.init?.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch lore targets API wraps filtered target status query route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/lore/targets?")) {
      return new Response(JSON.stringify({
        targetId: "claim:gray-harbor",
        status: "revised",
        total: 1,
        targets: [{
          targetId: "claim:gray-harbor",
          status: "revised",
          counts: {
            confirmation: 1,
            refutation: 0,
            revision: 1,
            total: 2,
          },
          contributingAgentIds: ["agent_lore_1"],
          sourceEventIds: ["event_source_1"],
          latestContribution: {
            contributionId: "lore_2",
            claimId: "lore_2",
            claimType: "revision",
            claimText: "灰港航标修订为三短一长信号。",
            claimHash: "sha256:lore_2_claim",
            eventId: "event_lore_2",
            category: "revision",
            agentId: "agent_lore_1",
            explorerId: "explorer_lore_1",
            targetId: "claim:gray-harbor",
            summary: "灰港航标修订为三短一长信号。",
            sourceEventIds: ["event_source_1"],
            provenance: {
              receiptType: "lore_contribution_provenance",
              contributionEventId: "event_lore_2",
              targetId: "claim:gray-harbor",
              sourceEventIds: ["event_source_1"],
              sourceEventCount: 1,
              sourceEventTypes: ["region_news_generated"],
              sourceAgentIds: ["agent_lore_1"],
              sourceAggregateIds: ["region_gray_harbor"],
              sourceTrustClasses: ["system_worker"],
              sourceEvents: [{
                eventId: "event_source_1",
                eventType: "region_news_generated",
                aggregateType: "region",
                aggregateId: "region_gray_harbor",
                agentId: "agent_lore_1",
                actorExplorerId: "system",
                trustClass: "system_worker",
                createdAt: "2026-06-28T00:00:00.000Z",
                publicPages: { audit: "/epoch/audit/event_source_1" },
              }],
              evidenceHash: "sha256:lore_2_evidence",
              recordedAt: "2026-06-28T00:01:00.000Z",
            },
            trustClass: "user_verified_web",
            recordedAt: "2026-06-28T00:01:00.000Z",
            publicPages: {
              agent: "/epoch/agent/agent_lore_1",
              explorer: "/epoch/explorer/explorer_lore_1",
              audit: "/epoch/audit/event_lore_2",
            },
          },
          publicPages: {
            audit: "/epoch/audit/event_lore_2",
          },
        }],
        publicPages: {
          world: "/epoch/world",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const targets = await getEpochLoreTargets({
      targetId: "claim:gray-harbor",
      status: "revised",
      limit: 5,
    });
    assert.equal(targets.total, 1);
    assert.equal(targets.targets[0]?.status, "revised");
    assert.equal(targets.targets[0]?.latestContribution.summary, "灰港航标修订为三短一长信号。");
    assert.equal(targets.targets[0]?.latestContribution.claimHash, "sha256:lore_2_claim");
    assert.equal(targets.targets[0]?.latestContribution.provenance.sourceEvents[0]?.publicPages.audit, "/epoch/audit/event_source_1");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/lore/targets?targetId=claim%3Agray-harbor&status=revised&limit=5");
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch lore contributions API wraps filtered contribution query route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/lore/contributions?")) {
      return new Response(JSON.stringify({
        agentId: "agent_lore_1",
        category: "refutation",
        targetId: "claim:gray-harbor",
        total: 1,
        contributions: [{
          contributionId: "lore_1",
          claimId: "lore_1",
          claimType: "refutation",
          claimText: "灰港航标不能控制帝国军团。",
          claimHash: "sha256:lore_1_claim",
          eventId: "event_lore_1",
          category: "refutation",
          agentId: "agent_lore_1",
          explorerId: "explorer_lore_1",
          targetId: "claim:gray-harbor",
          summary: "灰港航标不能控制帝国军团。",
          sourceEventIds: ["event_source_1"],
          provenance: {
            receiptType: "lore_contribution_provenance",
            contributionEventId: "event_lore_1",
            targetId: "claim:gray-harbor",
            sourceEventIds: ["event_source_1"],
            sourceEventCount: 1,
            sourceEventTypes: ["region_news_generated"],
            sourceAgentIds: ["agent_lore_1"],
            sourceAggregateIds: ["region_gray_harbor"],
            sourceTrustClasses: ["system_worker"],
            sourceEvents: [{
              eventId: "event_source_1",
              eventType: "region_news_generated",
              aggregateType: "region",
              aggregateId: "region_gray_harbor",
              agentId: "agent_lore_1",
              actorExplorerId: "system",
              trustClass: "system_worker",
              createdAt: "2026-06-28T00:00:00.000Z",
              publicPages: { audit: "/epoch/audit/event_source_1" },
            }],
            evidenceHash: "sha256:lore_1_evidence",
            recordedAt: "2026-06-28T00:00:00.000Z",
          },
          trustClass: "user_verified_web",
          recordedAt: "2026-06-28T00:00:00.000Z",
          publicPages: {
            agent: "/epoch/agent/agent_lore_1",
            explorer: "/epoch/explorer/explorer_lore_1",
            audit: "/epoch/audit/event_lore_1",
          },
        }],
        publicPages: {
          world: "/epoch/world",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const contributions = await getEpochLoreContributions({
      agentId: "agent_lore_1",
      category: "refutation",
      targetId: "claim:gray-harbor",
      limit: 3,
    });
    assert.equal(contributions.total, 1);
    assert.equal(contributions.contributions[0]?.summary, "灰港航标不能控制帝国军团。");
    assert.equal(contributions.contributions[0]?.claimId, "lore_1");
    assert.equal(contributions.contributions[0]?.claimHash, "sha256:lore_1_claim");
    assert.equal(contributions.contributions[0]?.provenance.sourceEvents[0]?.publicPages.audit, "/epoch/audit/event_source_1");
    assert.equal(contributions.contributions[0]?.publicPages.audit, "/epoch/audit/event_lore_1");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/lore/contributions?agentId=agent_lore_1&category=refutation&targetId=claim%3Agray-harbor&limit=3");
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch result page API wraps owner-authorized revoke route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/result-page/revoke")) {
      return new Response(JSON.stringify({
        page: {
          pageId: "page_revoke_1",
          createdAt: "2026-06-28T00:00:00.000Z",
          urlPath: "/epoch/result/page_revoke_1?shareToken=epoch_result_share_token",
          payload: {
            pageType: "agent_result",
            generatedAt: "2026-06-28T00:00:00.000Z",
            progress: { latestEvents: [] },
            receipt: {
              receiptType: "server_result_receipt",
              payloadHash: "sha256:abc",
              focus: { kind: "agent_snapshot", id: "agent_1" },
              trustClasses: [],
              canonicalEvents: [],
              generatedAt: "2026-06-28T00:00:00.000Z",
            },
          },
          createdBy: "agent_1",
          idempotencyKey: "publish-1",
          status: "revoked",
          revokedAt: "2026-06-28T00:01:00.000Z",
          revokedBy: "explorer_1",
          revokeReason: "owner_hidden_from_console",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const result = await revokeEpochResultPage({
      pageId: "page_revoke_1",
      recoveryCode: "recovery-code",
      reason: "owner_hidden_from_console",
      idempotencyKey: "revoke-page-1",
    });
    assert.equal(result.page.status, "revoked");
    assert.equal(result.page.revokedBy, "explorer_1");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/result-page/revoke");
    assert.equal(call.init?.method, "POST");
    assert.equal(call.init?.body, JSON.stringify({
      pageId: "page_revoke_1",
      recoveryCode: "recovery-code",
      reason: "owner_hidden_from_console",
      idempotencyKey: "revoke-page-1",
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch personality drift API wraps owner confirmation route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/personality/confirm")) {
      return new Response(JSON.stringify({
        value: {
          driftId: "drift_1",
          agentId: "agent_1",
          suggestedTrait: "裂隙后仍会先确认退路",
          status: "confirmed",
        },
        events: [{ eventType: "personality_drift_confirmed" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const result = await confirmEpochPersonalityDrift({
      driftId: "drift_1",
      recoveryCode: "local-secret",
      idempotencyKey: "confirm-drift-1",
    });
    assert.equal(result.value.status, "confirmed");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/personality/confirm");
    assert.equal(call.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(call.init?.body)), {
      driftId: "drift_1",
      recoveryCode: "local-secret",
      idempotencyKey: "confirm-drift-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch recovery rotation API wraps owner credential rotation route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/recovery/rotate")) {
      return new Response(JSON.stringify({
        value: {
          explorerId: "explorer_api_rotate",
          rotated: true,
          newRecoveryRegistered: true,
          rotatedAt: "2026-06-25T00:00:00.000Z",
        },
        events: [{ eventType: "explorer_recovery_rotated" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const rotated = await rotateEpochRecovery({
      explorerId: "explorer_api_rotate",
      recoveryCode: "old-code",
      newRecoveryCode: "new-code",
      idempotencyKey: "rotate-api-1",
    });
    assert.equal(rotated.value.rotated, true);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/recovery/rotate");
    assert.equal(call.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(call.init?.body)), {
      explorerId: "explorer_api_rotate",
      recoveryCode: "old-code",
      newRecoveryCode: "new-code",
      idempotencyKey: "rotate-api-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch abuse release API wraps operator route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/abuse/release")) {
      return new Response(JSON.stringify({
        value: {
          releaseId: "release_1",
          actorKey: "agent_1",
          previousScore: 10,
          scoreAfter: 0,
          sourceEventId: "epoch_event_abuse_score_1",
          releasedBy: "operator",
          releasedAt: "2026-06-25T00:02:00.000Z",
          note: "reviewed",
        },
        events: [{ eventType: "abuse_score_released" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const released = await releaseEpochAbuseRestriction({
      operatorKey: "operator-key",
      actorKey: "agent_1",
      note: "reviewed",
      idempotencyKey: "release-abuse-1",
    });
    assert.equal(released.value.actorKey, "agent_1");
    assert.equal(released.value.previousScore, 10);
    assert.equal(released.value.scoreAfter, 0);
    assert.equal(released.events[0]?.eventType, "abuse_score_released");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/abuse/release");
    assert.equal(call.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(call.init?.body)), {
      operatorKey: "operator-key",
      actorKey: "agent_1",
      note: "reviewed",
      idempotencyKey: "release-abuse-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch abuse profiles API wraps operator query route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/abuse/profiles?")) {
      return new Response(JSON.stringify({
        total: 1,
        restricted: 1,
        profiles: [{
          actorKey: "agent_1",
          agentId: "agent_1",
          score: 10,
          abuseLevel: "restricted",
          updatedAt: "2026-06-25T00:01:00.000Z",
          latestEventId: "epoch_event_abuse_score_1",
          sourceEventIds: ["epoch_event_rejected_1"],
          reasons: { missing_auth: 10 },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const profiles = await getEpochAbuseProfiles({
      operatorKey: "operator-key",
      level: "restricted",
      limit: 8,
    });
    assert.equal(profiles.total, 1);
    assert.equal(profiles.restricted, 1);
    assert.equal(profiles.profiles[0]?.actorKey, "agent_1");
    assert.equal(profiles.profiles[0]?.abuseLevel, "restricted");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/abuse/profiles?level=restricted&limit=8");
    assert.deepEqual(call.init?.headers, { "x-epoch-operator-key": "operator-key" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch explorer profile API wraps player dashboard route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/explorer/explorer_api_profile")) {
      return new Response(JSON.stringify({
        explorerId: "explorer_api_profile",
        summary: { totalIdentities: 2, activeIdentities: 1, archivedIdentities: 1, totalLegend: 3 },
        totalResources: { coin: 7, legend: 3 },
        identitySlots: { explorerId: "explorer_api_profile", active: 1, max: 2, available: 1, legend: 3, legendPerSlot: 3, nextUnlockLegend: 6, legendToNextSlot: 3, capped: false },
        identities: [],
        activeIdentities: [],
        archivedIdentities: [],
        latestEvents: [],
        publicPages: { explorer: "/epoch/explorer/explorer_api_profile", agents: [], archives: [] },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const profile = await getEpochExplorerProfile("explorer_api_profile");
    assert.equal(profile.explorerId, "explorer_api_profile");
    assert.equal(profile.summary.totalIdentities, 2);
    assert.equal(profile.identitySlots.available, 1);
    assert.equal(profile.totalResources.coin, 7);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/explorer/explorer_api_profile");
    assert.equal(call.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch operator overview API wraps operator overview route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/operator/overview?")) {
      return new Response(JSON.stringify({
        summary: {
          openModeration: 1,
          restrictedAbuseProfiles: 1,
          watchAbuseProfiles: 0,
          marketRiskRestrictions: 1,
          attestedRunnersConfigured: 0,
          attestedRunnerRecentAttestations: 0,
          npcCandidateWatch: 0,
          npcCandidateBlocked: 0,
          serverHostedJobsQueued: 0,
          riskEvents: 2,
          recentAbuseReleases: 0,
          maintenanceEvents: 3,
          loreTargetsPendingAdjudication: 1,
        },
        health: {
          checkedAt: "2026-06-25T00:15:00.000Z",
          status: "attention",
          attentionReasons: ["lore_adjudication_pending"],
          maintenance: {
            checkedAt: "2026-06-25T00:15:00.000Z",
            status: "ok",
            stale: false,
            staleAfterHours: 6,
            attentionReasons: [],
            workers: {},
          },
          queues: {
            openModeration: 1,
            restrictedAbuseProfiles: 1,
            marketRiskRestrictions: 1,
            npcCandidateWatch: 0,
            npcCandidateBlocked: 0,
            serverHostedJobsQueued: 0,
            riskEvents: 2,
            loreTargetsPendingAdjudication: 1,
          },
        },
        moderation: { open: [{ moderationId: "mod_1", subjectType: "message" }], resolved: [], total: 1 },
        abuse: { total: 1, restricted: 1, watch: 0, clear: 0, profiles: [{ actorKey: "agent_1", score: 10, abuseLevel: "restricted", reasons: { missing_auth: 10 }, latestEventId: "event_1", sourceEventIds: [], updatedAt: "2026-06-25T00:00:00.000Z" }] },
        marketRiskRestrictions: [{ agentId: "agent_market_1", reason: "risk_review_escalated" }],
        attestedRunners: { total: 0, configured: 0, recentAttestations: 0, runners: [] },
        npcCandidateReview: { watch: 0, blocked: 0, recent: [] },
        loreAdjudication: {
          pending: 1,
          adjudicated: 0,
          pendingTargets: [{
            targetId: "claim:api-operator-overview-pending",
            status: "confirmed",
            statusSource: "contribution_evidence",
            counts: { confirmation: 1, refutation: 0, revision: 0, total: 1 },
            contributingAgentIds: ["agent_1"],
            sourceEventIds: ["event_source_1"],
            latestContribution: {
              contributionId: "lore_contribution_1",
              eventId: "event_lore_contribution_1",
              trustClass: "system_signed",
              category: "confirmation",
              agentId: "agent_1",
              explorerId: "explorer_1",
              targetId: "claim:api-operator-overview-pending",
              summary: "API pending lore target.",
              sourceEventIds: ["event_source_1"],
              recordedAt: "2026-06-25T00:10:00.000Z",
              publicPages: { agent: "/epoch/agent/agent_1", audit: "/epoch/audit/event_lore_contribution_1" },
            },
            publicPages: { audit: "/epoch/audit/event_lore_contribution_1" },
          }],
        },
        maintenance: {
          total: 3,
          latestRanAt: "2026-06-25T00:12:00.000Z",
          counts: { npcLifecycle: 1, resourceNodeSpawned: 1, marketExpired: 1, serverHostedJobsSkipped: 1 },
          recentEvents: [
            { eventId: "event_npc", eventType: "npc_lifecycle_recorded", aggregateId: "npc_1", createdAt: "2026-06-25T00:12:00.000Z" },
            { eventId: "event_node", eventType: "resource_node_spawned", aggregateId: "node_1", regionId: "region_gray_harbor", createdAt: "2026-06-25T00:10:00.000Z" },
            { eventId: "event_job_skip", eventType: "server_hosted_job_skipped", aggregateId: "job_1", agentId: "agent_server_1", subjectId: "job_1", createdAt: "2026-06-25T00:09:00.000Z" },
            { eventId: "event_market", eventType: "market_order_expired", aggregateId: "order_1", agentId: "agent_market_1", createdAt: "2026-06-25T00:11:00.000Z" },
          ],
        },
        riskAudit: { total: 2, events: [], riskProfile: { eventCount: 2, reviewScore: 2, flags: {}, agents: [] }, replay: { eventIds: [], aggregateIds: [], trustClasses: [], highImpactEventTypes: [] }, publicPages: { index: "/epoch/audit" } },
        releaseAudit: { total: 0, events: [], riskProfile: { eventCount: 0, reviewScore: 0, flags: {}, agents: [] }, replay: { eventIds: [], aggregateIds: [], trustClasses: [], highImpactEventTypes: [] }, publicPages: { index: "/epoch/audit" } },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const overview = await getEpochOperatorOverview({
      operatorKey: "operator-key",
      limit: 8,
    });
    assert.equal(overview.summary.openModeration, 1);
    assert.equal(overview.summary.restrictedAbuseProfiles, 1);
    assert.equal(overview.summary.maintenanceEvents, 3);
    assert.equal(overview.summary.loreTargetsPendingAdjudication, 1);
    assert.equal(overview.health.queues.loreTargetsPendingAdjudication, 1);
    assert.equal(overview.loreAdjudication.pending, 1);
    assert.equal(overview.loreAdjudication.pendingTargets[0]?.latestContribution.eventId, "event_lore_contribution_1");
    assert.equal(overview.maintenance.counts.marketExpired, 1);
    assert.equal(overview.maintenance.counts.serverHostedJobsSkipped, 1);
    assert.equal(overview.maintenance.recentEvents[2]?.eventType, "server_hosted_job_skipped");
    assert.equal(overview.marketRiskRestrictions[0]?.agentId, "agent_market_1");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/operator/overview?limit=8");
    assert.deepEqual(call.init?.headers, { "x-epoch-operator-key": "operator-key" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch server-hosted action API wraps operator-gated hosted action route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/hosted/server-action")) {
      return new Response(JSON.stringify({
        value: {
          session: {
            sessionId: "hosted_server_1",
            agentId: "agent_server_1",
            explorerId: "server_hosted_agent",
            regionId: "region_gray_harbor",
            mandate: "巡查灰港边缘",
            channelClass: "server_hosted",
            deliveryTrust: "server_hosted_agent",
            status: "completed",
            actionOptions: [],
            actions: [],
            startedAt: "2026-06-25T00:00:00.000Z",
            completedAt: "2026-06-25T00:00:01.000Z",
          },
          action: {
            actionId: "action_server_1",
            sessionId: "hosted_server_1",
            agentId: "agent_server_1",
            actionOptionId: "option_server_observe",
            optionLabel: "观察",
            outcomeSummary: "服务器完成一次权威观察。",
            recordedAt: "2026-06-25T00:00:01.000Z",
          },
        },
        events: [{ trustClass: "server_hosted_agent" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const result = await runEpochServerHostedAction({
      operatorKey: "operator-key",
      agentId: "agent_server_1",
      regionId: "region_gray_harbor",
      mandate: "巡查灰港边缘",
      optionKey: "observe",
      idempotencyKey: "server-hosted-action-1",
    });
    assert.equal(result.value.session.deliveryTrust, "server_hosted_agent");
    assert.equal(result.value.action.sessionId, "hosted_server_1");
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/hosted/server-action");
    assert.equal(call.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(call.init?.body)), {
      operatorKey: "operator-key",
      agentId: "agent_server_1",
      regionId: "region_gray_harbor",
      mandate: "巡查灰港边缘",
      optionKey: "observe",
      idempotencyKey: "server-hosted-action-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch hosted spectator APIs use public redacted routes", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/hosted/sessions?")) {
      return new Response(JSON.stringify({
        agentId: "agent_watch_1",
        sessions: [{
          sessionId: "hosted_watch_1",
          agentId: "agent_watch_1",
          explorerId: "explorer_watch_1",
          regionId: "region_gray_harbor",
          mandate: "公开观战",
          status: "active",
          actionOptions: [],
          actions: [],
          startedAt: "2026-06-25T00:00:00.000Z",
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/api/epoch/hosted/watch?")) {
      return new Response(JSON.stringify({
        generatedAt: "2026-06-25T00:00:00.000Z",
        sessionId: "hosted_watch_1",
        agentId: "agent_watch_1",
        session: {
          sessionId: "hosted_watch_1",
          agentId: "agent_watch_1",
          explorerId: "explorer_watch_1",
          regionId: "region_gray_harbor",
          mandate: "公开观战",
          status: "active",
          actionOptions: [],
          actions: [],
          startedAt: "2026-06-25T00:00:00.000Z",
        },
        publicPages: {
          world: "/epoch/world",
          console: "/epoch/web-play",
          watch: "/epoch/hosted/hosted_watch_1",
          api: "/api/epoch/hosted/watch?sessionId=hosted_watch_1",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/api/epoch/result-page?")) {
      return new Response(JSON.stringify({
        pageType: "agent_result",
        generatedAt: "2026-06-25T00:00:00.000Z",
        progress: {},
        publishToken: "epoch_result_publish_token",
        receipt: {
          receiptType: "server_result_receipt",
          payloadHash: "sha256:abc",
          generatedAt: "2026-06-25T00:00:00.000Z",
          focus: { kind: "hosted_session", id: "hosted_watch_1" },
          trustClasses: [],
          canonicalEvents: [],
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const sessions = await getEpochHostedSessions("agent_watch_1");
    assert.equal(sessions.sessions[0]?.actionOptions.length, 0);
    const watch = await getEpochHostedSessionWatch("hosted_watch_1");
    assert.equal(watch.publicPages.watch, "/epoch/hosted/hosted_watch_1");
    const preview = await getEpochResultPage({
      agentId: "agent_watch_1",
      hostedSessionId: "hosted_watch_1",
      limit: 30,
    });
    assert.equal(preview.publishToken, "epoch_result_publish_token");
    assert.equal(calls[0]?.url, "http://127.0.0.1:8787/api/epoch/hosted/sessions?agentId=agent_watch_1");
    assert.equal(calls[1]?.url, "http://127.0.0.1:8787/api/epoch/hosted/watch?sessionId=hosted_watch_1");
    assert.equal(calls[2]?.url, "http://127.0.0.1:8787/api/epoch/result-page?agentId=agent_watch_1&hostedSessionId=hosted_watch_1&limit=30");
    assert.equal(calls[0]?.init, undefined);
    assert.equal(calls[1]?.init, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch server-hosted job API wraps queue, list and run routes", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/hosted/server-jobs?")) {
      return new Response(JSON.stringify({
        agentId: "agent_server_1",
        status: "queued",
        jobs: [{
          jobId: "job_server_1",
          agentId: "agent_server_1",
          explorerId: "explorer_server_1",
          regionId: "region_gray_harbor",
          mandate: "巡查灰港边缘",
          optionKey: "observe",
          deliveryTrust: "server_hosted_agent",
          status: "queued",
          queuedBy: "server_hosted_agent",
          queuedAt: "2026-06-25T00:00:00.000Z",
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/hosted/server-jobs/run")) {
      return new Response(JSON.stringify({
        value: {
          job: {
            jobId: "job_server_1",
            agentId: "agent_server_1",
            explorerId: "explorer_server_1",
            regionId: "region_gray_harbor",
            mandate: "巡查灰港边缘",
            optionKey: "anomaly",
            deliveryTrust: "server_hosted_agent",
            status: "skipped",
            queuedBy: "server_hosted_agent",
            queuedAt: "2026-06-25T00:00:00.000Z",
            skipReason: "action_option_unavailable",
            skippedAt: "2026-06-25T00:00:01.000Z",
          },
        },
        events: [{ eventType: "server_hosted_job_skipped" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/hosted/server-jobs")) {
      return new Response(JSON.stringify({
        value: {
          jobId: "job_server_1",
          agentId: "agent_server_1",
          explorerId: "explorer_server_1",
          regionId: "region_gray_harbor",
          mandate: "巡查灰港边缘",
          optionKey: "observe",
          deliveryTrust: "server_hosted_agent",
          status: "queued",
          queuedBy: "server_hosted_agent",
          queuedAt: "2026-06-25T00:00:00.000Z",
        },
        events: [{ eventType: "server_hosted_job_queued" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const queued = await queueEpochServerHostedAction({
      operatorKey: "operator-key",
      agentId: "agent_server_1",
      regionId: "region_gray_harbor",
      optionKey: "observe",
      idempotencyKey: "queue-server-hosted-1",
    });
    assert.equal(queued.value.status, "queued");
    const queueCall = calls[0];
    assert.ok(queueCall);
    assert.equal(queueCall.url, "http://127.0.0.1:8787/api/epoch/hosted/server-jobs");
    assert.equal(queueCall.init?.method, "POST");

    const jobs = await getEpochServerHostedJobs({
      operatorKey: "operator-key",
      agentId: "agent_server_1",
      status: "queued",
    });
    assert.equal(jobs.jobs[0]?.jobId, "job_server_1");
    const listCall = calls[1];
    assert.ok(listCall);
    assert.equal(listCall.url, "http://127.0.0.1:8787/api/epoch/hosted/server-jobs?agentId=agent_server_1&status=queued");
    assert.deepEqual(listCall.init?.headers, { "x-epoch-operator-key": "operator-key" });

    const run = await runEpochServerHostedJob({
      operatorKey: "operator-key",
      jobId: "job_server_1",
      idempotencyKey: "run-server-hosted-job-1",
    });
    assert.equal(run.value.job.status, "skipped");
    assert.equal(run.value.job.skipReason, "action_option_unavailable");
    assert.equal(run.value.run, undefined);
    const runCall = calls[2];
    assert.ok(runCall);
    assert.equal(runCall.url, "http://127.0.0.1:8787/api/epoch/hosted/server-jobs/run");
    assert.deepEqual(JSON.parse(String(runCall.init?.body)), {
      operatorKey: "operator-key",
      jobId: "job_server_1",
      idempotencyKey: "run-server-hosted-job-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch inventory API wraps read, create, craft and bind routes", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.includes("/api/epoch/inventory?")) {
      return new Response(JSON.stringify({
        agentId: "agent_1",
        explorerId: "explorer_1",
        bound: true,
        items: [{
          itemId: "item_1",
          agentId: "agent_1",
          itemKey: "gray-harbor-medal",
          displayName: "灰港纪念章",
          rarity: "rare",
          sourceEventIds: ["epoch_event_1"],
          createdAt: "2026-06-25T04:00:00.000Z",
          bound: true,
          boundAt: "2026-06-25T04:01:00.000Z",
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/inventory/create")) {
      return new Response(JSON.stringify({
        value: {
          itemId: "item_1",
          agentId: "agent_1",
          itemKey: "gray-harbor-medal",
          displayName: "灰港纪念章",
          rarity: "rare",
          sourceEventIds: ["epoch_event_1"],
          createdAt: "2026-06-25T04:00:00.000Z",
          bound: false,
        },
        events: [{ eventType: "item_created" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/inventory/craft")) {
      return new Response(JSON.stringify({
        value: {
          itemId: "item_crafted_1",
          agentId: "agent_1",
          itemKey: "crafted:field-kit",
          displayName: "灰行者工具包",
          rarity: "common",
          sourceEventIds: ["event_spent_coin", "event_spent_aether"],
          createdAt: "2026-06-25T04:02:00.000Z",
          bound: false,
        },
        events: [
          { eventType: "resource_spent" },
          { eventType: "resource_spent" },
          { eventType: "item_created" },
        ],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/api/epoch/shop?")) {
      return new Response(JSON.stringify({
        regionId: "region_ash_outpost",
        offers: [{
          offerId: "gray-ration-pack",
          regionId: "region_gray_harbor",
          priceRegionId: "region_ash_outpost",
          itemKey: "shop:gray-ration-pack",
          displayName: "灰市补给包",
          rarity: "common",
          costs: [{ resourceId: "coin", amount: 4 }],
          baseCosts: [{ resourceId: "coin", amount: 3 }],
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/shop/purchase")) {
      return new Response(JSON.stringify({
        value: {
          itemId: "item_shop_1",
          agentId: "agent_1",
          itemKey: "shop:gray-ration-pack",
          displayName: "灰市补给包",
          rarity: "common",
          sourceEventIds: ["event_spent_coin"],
          createdAt: "2026-06-25T04:03:00.000Z",
          bound: false,
        },
        events: [
          { eventType: "resource_spent", payload: { amount: 4 } },
          { eventType: "item_created" },
        ],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/epoch/inventory/bind")) {
      return new Response(JSON.stringify({
        value: {
          itemId: "item_1",
          agentId: "agent_1",
          itemKey: "gray-harbor-medal",
          displayName: "灰港纪念章",
          rarity: "rare",
          sourceEventIds: ["epoch_event_1"],
          createdAt: "2026-06-25T04:00:00.000Z",
          bound: true,
          boundAt: "2026-06-25T04:01:00.000Z",
        },
        events: [{ eventType: "item_bound" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const inventory = await getEpochInventory({
      agentId: "agent_1",
      explorerId: "explorer_1",
      bound: true,
      tradable: true,
    });
    assert.equal(inventory.items[0]?.displayName, "灰港纪念章");
    const inventoryCall = calls[0];
    assert.ok(inventoryCall);
    assert.equal(inventoryCall.url, "http://127.0.0.1:8787/api/epoch/inventory?agentId=agent_1&explorerId=explorer_1&bound=true&tradable=true");
    assert.equal(inventoryCall.init, undefined);

    const created = await createEpochInventoryItem({
      operatorKey: "operator-key",
      agentId: "agent_1",
      itemKey: "gray-harbor-medal",
      displayName: "灰港纪念章",
      rarity: "rare",
      sourceEventIds: ["epoch_event_1"],
      idempotencyKey: "create-item-1",
    });
    assert.equal(created.value.bound, false);
    assert.equal(created.events[0]?.eventType, "item_created");
    const createCall = calls[1];
    assert.ok(createCall);
    assert.equal(createCall.url, "http://127.0.0.1:8787/api/epoch/inventory/create");
    assert.equal(createCall.init?.method, "POST");
    assert.equal(createCall.init?.body, JSON.stringify({
      operatorKey: "operator-key",
      agentId: "agent_1",
      itemKey: "gray-harbor-medal",
      displayName: "灰港纪念章",
      rarity: "rare",
      sourceEventIds: ["epoch_event_1"],
      idempotencyKey: "create-item-1",
    }));

    const crafted = await craftEpochInventoryItem({
      agentId: "agent_1",
      recipeId: "field-kit",
      recoveryCode: "recovery-code",
      idempotencyKey: "craft-item-1",
    });
    assert.equal(crafted.value.itemKey, "crafted:field-kit");
    assert.equal(crafted.events[2]?.eventType, "item_created");
    const craftCall = calls[2];
    assert.ok(craftCall);
    assert.equal(craftCall.url, "http://127.0.0.1:8787/api/epoch/inventory/craft");
    assert.equal(craftCall.init?.method, "POST");
    assert.equal(craftCall.init?.body, JSON.stringify({
      agentId: "agent_1",
      recipeId: "field-kit",
      recoveryCode: "recovery-code",
      idempotencyKey: "craft-item-1",
    }));

    const shop = await getEpochShop("region_ash_outpost");
    assert.equal(shop.offers[0]?.costs[0]?.amount, 4);
    const shopCall = calls[3];
    assert.ok(shopCall);
    assert.equal(shopCall.url, "http://127.0.0.1:8787/api/epoch/shop?regionId=region_ash_outpost");
    assert.equal(shopCall.init, undefined);

    const purchased = await purchaseEpochShopOffer({
      agentId: "agent_1",
      offerId: "gray-ration-pack",
      regionId: "region_ash_outpost",
      recoveryCode: "recovery-code",
      idempotencyKey: "shop-purchase-1",
    });
    assert.equal(purchased.value.itemKey, "shop:gray-ration-pack");
    assert.equal(purchased.events[0]?.payload.amount, 4);
    const purchaseCall = calls[4];
    assert.ok(purchaseCall);
    assert.equal(purchaseCall.url, "http://127.0.0.1:8787/api/epoch/shop/purchase");
    assert.equal(purchaseCall.init?.method, "POST");
    assert.equal(purchaseCall.init?.body, JSON.stringify({
      agentId: "agent_1",
      offerId: "gray-ration-pack",
      regionId: "region_ash_outpost",
      recoveryCode: "recovery-code",
      idempotencyKey: "shop-purchase-1",
    }));

    const bound = await bindEpochInventoryItem({
      agentId: "agent_1",
      itemId: "item_1",
      recoveryCode: "recovery-code",
      idempotencyKey: "bind-item-1",
    });
    assert.equal(bound.value.bound, true);
    assert.equal(bound.events[0]?.eventType, "item_bound");
    const bindCall = calls[5];
    assert.ok(bindCall);
    assert.equal(bindCall.url, "http://127.0.0.1:8787/api/epoch/inventory/bind");
    assert.equal(bindCall.init?.method, "POST");
    assert.equal(bindCall.init?.body, JSON.stringify({
      agentId: "agent_1",
      itemId: "item_1",
      recoveryCode: "recovery-code",
      idempotencyKey: "bind-item-1",
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch region revolt API wraps owner-authorized control revolt route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/region-control/revolt")) {
      return new Response(JSON.stringify({
        value: {
          revoltId: "region_revolt_1",
          regionId: "region_gray_harbor",
          sourceReleaseId: "region_control_release_1",
          previousControllingFactionId: "gray_watch",
          previousControlSourceSeasonId: "season_previous",
          rebelAgentId: "agent_1",
          rebelExplorerId: "explorer_1",
          rebelFactionId: "cinder_archive",
          sourceSeasonId: "season_1",
          factionScore: 2,
          staminaSpent: 3,
          rebelPower: 8,
          defenderPower: 5,
          outcome: "revolt_succeeded",
          resolvedAt: "2026-06-27T00:00:00.000Z",
        },
        events: [{ eventType: "region_revolt_resolved" }],
        projection: {},
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  };

  try {
    await resolveEpochRegionRevolt({
      regionId: "region_gray_harbor",
      seasonId: "season_1",
      factionId: "cinder_archive",
      agentId: "agent_1",
      staminaSpent: 3,
      recoveryCode: "recovery-code",
      idempotencyKey: "resolve-region-revolt-1",
    });
    const call = calls.find((entry) => entry.url.endsWith("/api/epoch/region-control/revolt"));
    assert.ok(call);
    assert.deepEqual(JSON.parse(String(call.init?.body)), {
      regionId: "region_gray_harbor",
      seasonId: "season_1",
      factionId: "cinder_archive",
      agentId: "agent_1",
      staminaSpent: 3,
      recoveryCode: "recovery-code",
      idempotencyKey: "resolve-region-revolt-1",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Epoch maintenance API wraps operator maintenance run route", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.endsWith("/api/epoch/maintenance/run")) {
      return new Response(JSON.stringify({
        value: {
          tickId: "maintenance_run_1",
          ranAt: "2026-06-25T04:00:00.000Z",
          npc: { events: 1 },
          market: { events: 1 },
          resourceNodes: { events: 1, spawned: 1, settled: 0, skipped: 0 },
          persistedEvents: 0,
        },
        events: [
          { eventId: "event_npc", eventType: "npc_lifecycle_recorded", aggregateId: "npc_1", createdAt: "2026-06-25T04:00:00.000Z" },
          { eventId: "event_market", eventType: "market_order_expired", aggregateId: "order_1", createdAt: "2026-06-25T04:00:00.000Z" },
          { eventId: "event_node", eventType: "resource_node_spawned", aggregateId: "node_1", createdAt: "2026-06-25T04:00:00.000Z" },
        ],
        projection: { events: [] },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
  };

  try {
    const result = await runEpochMaintenance({
      operatorKey: "operator-key",
      npcRegionId: "region_gray_harbor",
      npcLimit: 4,
      marketMaxAgeSeconds: 86400,
      marketLimit: 25,
      resourceNodeRegionIds: ["region_gray_harbor"],
      resourceNodeLimit: 1,
      idempotencyKey: "web-maintenance-run",
    });
    assert.equal(result.value.npc.events, 1);
    assert.equal(result.value.market.events, 1);
    assert.equal(result.value.resourceNodes.spawned, 1);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, "http://127.0.0.1:8787/api/epoch/maintenance/run");
    assert.equal(call.init?.method, "POST");
    assert.equal(call.init?.body, JSON.stringify({
      operatorKey: "operator-key",
      npcRegionId: "region_gray_harbor",
      npcLimit: 4,
      marketMaxAgeSeconds: 86400,
      marketLimit: 25,
      resourceNodeRegionIds: ["region_gray_harbor"],
      resourceNodeLimit: 1,
      idempotencyKey: "web-maintenance-run",
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
