import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpJsonRpcMessage } from "../lib/mcpJsonRpc.ts";
import { createMcpSamplingClient } from "../lib/mcpSampling.ts";
import { createMcpServerRequestManager } from "../lib/mcpServerRequestManager.ts";
import { createMcpSession } from "../lib/mcpSession.ts";
import { createAgentWorldMcpRuntime, createAgentWorldRuntime } from "../lib/mcpTools.ts";
import { createSequentialEpochIdFactory } from "../lib/epoch/protocol.ts";
import { epochEventsForPersistence } from "../lib/epoch/runtimePublicProjectionRules.ts";
import { journeyEventsForPersistence } from "../lib/epoch/journeyPersistence.ts";
import type { EpochEvent } from "../lib/epoch/events.ts";

function payload(result: { readonly content: readonly { readonly text: string }[] }) {
  return JSON.parse(result.content[0]?.text ?? "null");
}

function recoveryCode(explorerId: string, localSecret: string) {
  return Buffer.from(JSON.stringify({ explorerId, localSecret }), "utf8").toString("base64");
}

async function fixture() {
  let realNow = "2026-07-12T00:00:00.000Z";
  let worldNow = "2026-01-01T08:00:00.000Z";
  let epochNow = "2026-07-12T00:00:00.000Z";
  const mcp = createAgentWorldMcpRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("companion"),
      clock: () => new Date(epochNow),
    },
    journey: {
      now: () => realNow,
      worldNow: () => worldNow,
      defaultRealDurationMs: 30 * 60 * 1_000,
      defaultWorldDurationMs: 60 * 60 * 1_000,
    },
  });
  const explorerId = "explorer_companion";
  const ownerRecovery = recoveryCode(explorerId, "local-secret");
  const identity = payload(await mcp.callTool("obsidian_epoch.identity", {
    explorerId,
    recoveryCode: ownerRecovery,
    identityName: "灯蛾",
    idempotencyKey: "identity-1",
  }));
  return {
    mcp,
    explorerId,
    ownerRecovery,
    agentId: identity.value.agentId as string,
    advance: (real: string, world: string) => {
      realNow = real;
      worldNow = world;
    },
    advanceEpoch: (iso: string) => {
      epochNow = iso;
    },
  };
}

async function preparedAgentNativeJourney(suffix: string, epochNow?: string) {
  const context = await fixture();
  if (epochNow) context.advanceEpoch(epochNow);
  const prepared = payload(await context.mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId: context.agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
    recoveryCode: context.ownerRecovery,
    idempotencyKey: `prepare-${suffix}`,
  }));
  const started = payload(await context.mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: `start-${suffix}`,
  }));
  const proposed = payload(await context.mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: `propose-${suffix}`,
  }));
  return { ...context, prepared, started, proposed };
}

test("MCP exposes an Agent-native start, propose, and commit journey flow", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const names = mcp.listTools().map((tool) => tool.name);
  for (const name of [
    "prepare_journey",
    "start_journey",
    "propose_journey_step",
    "commit_journey_action",
    "journey_status",
    "recall_journey",
    "journey_album",
  ]) {
    assert.ok(names.includes(`obsidian_epoch.${name}`), name);
  }

  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"], avoid: ["conflict"] },
    presetId: "cautious",
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-1",
  }));
  assert.equal(prepared.journey.status, "prepared");
  assert.equal(prepared.policySelection.presetId, "cautious");
  assert.match(prepared.preview.text, /计划：/);
  await assert.rejects(
    () => mcp.callTool("obsidian_epoch.prepare_journey", {
      agentId,
      destinationRegionId: "灰港",
      mandate: { objective: "找稳定工作", priorities: ["work"], avoid: ["conflict"] },
      presetId: "cautious",
      recoveryCode: "invalid-owner-credential",
      idempotencyKey: "prepare-1",
    }),
    /explorer_auth_invalid|recovery_code_invalid|explorer_auth_required/,
  );

  const started = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-1",
  }));
  assert.equal(started.journey.status, "awaiting_agent");
  assert.deepEqual(started.scenePlan.episodes.map((episode: { phase: string }) => episode.phase),
    ["arrival", "main", "return"]);
  assert.equal(started.sampling.fallback, "agent_native");
  assert.equal(started.episodes.length, 1);
  assert.equal(started.episodes[0].phase, "arrival");
  assert.equal(started.episodes[0].serverFacts.journeyId, started.journey.journeyId);
  assert.equal(started.episodes[0].narrative.kind, "grounded_narrative");
  assert.deepEqual(started.episodes[0].narrative.sourceEventIds, started.episodes[0].serverFacts.sourceEventIds);
  assert.equal(started.nextAction, "obsidian_epoch.propose_journey_step");

  const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "propose-main-1",
  }));
  assert.equal(proposed.proposal.episode.phase, "main");
  assert.equal(proposed.proposal.sceneContract.sceneType, "livelihood");
  assert.deepEqual(proposed.proposal.actionOptions.map((option: { optionKey: string }) => option.optionKey), [
    "ask_for_shift",
    "verify_salt_ledger",
    "carry_manifest",
    "ask_about_recent_travelers",
    "report_discrepancy",
    "leave_without_commitment",
  ]);
  assert.equal(proposed.proposal.actionOptions.some((option: { optionKey: string }) =>
    ["observe", "assist", "anomaly"].includes(option.optionKey)), false);
  const selected = proposed.proposal.sceneContract.actionOptions[0];
  const committed = payload(await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "commit-main-1",
  }));
  assert.equal(committed.journey.status, "returning");
  assert.equal(committed.mainEpisode.phase, "main");
  assert.equal(committed.returnEpisode.phase, "return");
  assert.equal(committed.mainEpisode.narrative.kind, "grounded_narrative");
  assert.equal(committed.returnEpisode.narrative.kind, "grounded_narrative");
  assert.equal(committed.settledAction.actionOptionId, selected.actionOptionId);

  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");

  const status = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: prepared.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.deepEqual(status.episodes.map((episode: { phase: string }) => episode.phase),
    ["arrival", "main", "return"]);
  assert.ok(status.episodes.every((episode: { serverFacts?: unknown; narrative?: unknown }) =>
    episode.serverFacts && episode.narrative));
  const canonicalEvents = mcp.runtime.epochEvents({ limit: 1_000 }).events;
  for (const episode of status.episodes as { serverFacts: { sourceEventIds: string[] } }[]) {
    for (const sourceEventId of episode.serverFacts.sourceEventIds) {
      const event = canonicalEvents.find((candidate: { eventId: string }) => candidate.eventId === sourceEventId);
      assert.ok(event, sourceEventId);
      assert.equal(event.correlationId, status.journey.correlationId);
    }
  }

  const replay = payload(await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "commit-main-1",
  }));
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.journey.episodeIds, status.journey.episodeIds);

  const album = payload(await mcp.callTool("obsidian_epoch.journey_album", {
    agentId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(album.journeys.length, 1);
  assert.equal(album.postcards.length, 3);
  assert.deepEqual(album.postcards.map((postcard: { narrative: string }) => postcard.narrative),
    status.episodes.map((episode: { narrative: { postcard?: { text: string } } }) => episode.narrative.postcard?.text));

  const briefing = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId,
    recoveryCode: ownerRecovery,
    deferReturnDelivery: true,
  }));
  assert.deepEqual(briefing.recentEpisodes.map((episode: { narrative: unknown }) => episode.narrative),
    status.episodes.map((episode: { narrative: unknown }) => episode.narrative));
});

test("journey proposal and commit reject stale, forged, cross-scene, unauthorized, and expired inputs", async () => {
  const first = await preparedAgentNativeJourney("adversarial-a");
  const contract = first.proposed.proposal.sceneContract;
  const selected = contract.actionOptions[0];
  const replay = payload(await first.mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: first.started.journey.journeyId,
    expectedVersion: first.started.journey.version,
    recoveryCode: first.ownerRecovery,
    idempotencyKey: "propose-adversarial-a",
  }));
  assert.equal(replay.proposal.sceneContract.sceneId, contract.sceneId);
  assert.deepEqual(replay.proposal.sceneContract.actionOptions, contract.actionOptions);
  const alternateProposalKey = payload(await first.mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: first.started.journey.journeyId,
    expectedVersion: first.started.journey.version,
    recoveryCode: first.ownerRecovery,
    idempotencyKey: "propose-adversarial-a-second-key",
  }));
  assert.equal(alternateProposalKey.proposal.sceneContract.sceneId, contract.sceneId);

  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: first.started.journey.journeyId,
    expectedVersion: first.started.journey.version - 1,
    recoveryCode: first.ownerRecovery,
    idempotencyKey: "propose-stale",
  }), /journey_version_conflict/);
  const baseCommit = {
    journeyId: first.started.journey.journeyId,
    sceneId: contract.sceneId,
    episodeId: contract.episodeId,
    expectedVersion: contract.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: first.ownerRecovery,
  };
  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...baseCommit,
    recoveryCode: "invalid-owner-credential",
    idempotencyKey: "commit-wrong-owner",
  }), /explorer_auth_invalid|recovery_code_invalid|explorer_auth_required/);
  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...baseCommit,
    actionOptionId: "action_not_issued",
    idempotencyKey: "commit-unknown-action",
  }), /journey_scene_action_not_found/);
  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...baseCommit,
    signature: `${selected.signature.slice(0, -2)}AA`,
    idempotencyKey: "commit-forged-signature",
  }), /journey_scene_action_signature_invalid/);

  const second = await preparedAgentNativeJourney("adversarial-b", "2026-07-12T00:01:00.000Z");
  await assert.rejects(() => second.mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: second.started.journey.journeyId,
    sceneId: second.proposed.proposal.sceneContract.sceneId,
    episodeId: second.proposed.proposal.episode.episodeId,
    expectedVersion: second.proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: second.ownerRecovery,
    idempotencyKey: "commit-cross-scene",
  }), /journey_scene_action_not_found|journey_scene_action_signature_invalid/);

  first.advanceEpoch("2026-07-12T00:16:00.000Z");
  await assert.rejects(() => first.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...baseCommit,
    idempotencyKey: "commit-expired",
  }), /journey_scene_contract_expired/);
  const refreshed = payload(await first.mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: first.started.journey.journeyId,
    expectedVersion: first.started.journey.version,
    recoveryCode: first.ownerRecovery,
    idempotencyKey: "propose-after-expiry",
  }));
  assert.notEqual(refreshed.proposal.sceneContract.sceneId, contract.sceneId);
});

test("journey commit is idempotent and conflicting or concurrent choices settle at most once", async () => {
  const replayCase = await preparedAgentNativeJourney("commit-replay");
  const contract = replayCase.proposed.proposal.sceneContract;
  const selected = contract.actionOptions[0];
  const commitInput = {
    journeyId: replayCase.started.journey.journeyId,
    sceneId: contract.sceneId,
    episodeId: contract.episodeId,
    expectedVersion: contract.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: replayCase.ownerRecovery,
    idempotencyKey: "commit-replay",
  };
  const committed = payload(await replayCase.mcp.callTool("obsidian_epoch.commit_journey_action", commitInput));
  const replay = payload(await replayCase.mcp.callTool("obsidian_epoch.commit_journey_action", commitInput));
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.journey.episodeIds, committed.journey.episodeIds);
  const alternate = contract.actionOptions[1];
  await assert.rejects(() => replayCase.mcp.callTool("obsidian_epoch.commit_journey_action", {
    ...commitInput,
    actionOptionId: alternate.actionOptionId,
    signature: alternate.signature,
  }), /idempotency_key_conflict/);

  const race = await preparedAgentNativeJourney("commit-race");
  const left = race.proposed.proposal.sceneContract.actionOptions[0];
  const right = race.proposed.proposal.sceneContract.actionOptions[1];
  const base = {
    journeyId: race.started.journey.journeyId,
    sceneId: race.proposed.proposal.sceneContract.sceneId,
    episodeId: race.proposed.proposal.episode.episodeId,
    expectedVersion: race.proposed.proposal.expectedVersion,
    recoveryCode: race.ownerRecovery,
  };
  const results = await Promise.allSettled([
    race.mcp.callTool("obsidian_epoch.commit_journey_action", {
      ...base,
      actionOptionId: left.actionOptionId,
      signature: left.signature,
      idempotencyKey: "commit-race-left",
    }),
    race.mcp.callTool("obsidian_epoch.commit_journey_action", {
      ...base,
      actionOptionId: right.actionOptionId,
      signature: right.signature,
      idempotencyKey: "commit-race-right",
    }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const status = payload(await race.mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: race.started.journey.journeyId,
    recoveryCode: race.ownerRecovery,
  }));
  assert.deepEqual(status.episodes.map((episode: { phase: string }) => episode.phase),
    ["arrival", "main", "return"]);
});

test("a proposed signed scene survives epoch and journey event replay before commit", () => {
  const explorerId = "explorer_restart_proposal";
  const ownerRecovery = recoveryCode(explorerId, "restart-secret");
  const options = {
    epoch: {
      idFactory: createSequentialEpochIdFactory("restart_proposal"),
      clock: () => new Date("2026-07-12T00:00:00.000Z"),
    },
    journey: {
      now: () => "2026-07-12T00:00:00.000Z",
      worldNow: () => "2026-01-01T08:00:00.000Z",
    },
  };
  const runtime = createAgentWorldRuntime(options);
  const identity = runtime.epochIdentity({
    explorerId,
    recoveryCode: ownerRecovery,
    identityName: "重启提案校验者",
    idempotencyKey: "restart-identity",
  });
  if (!("value" in identity)) throw new Error("expected issued identity");
  const prepared = runtime.epochPrepareJourney({
    agentId: identity.value.agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "restart-prepare",
  });
  const started = runtime.epochStartJourneyAgentNative({
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "restart-start",
  });
  const proposalInput = {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "restart-propose",
  };
  const proposed = runtime.epochProposeJourneyStep(proposalInput);
  const epochEvents = [identity, started, proposed].flatMap(epochEventsForPersistence);
  const journeyEvents = [prepared, started, proposed].flatMap(journeyEventsForPersistence);
  assert.doesNotMatch(JSON.stringify({ epochEvents, journeyEvents }), /restart-secret|recoveryCode|localSecret/);

  const restarted = createAgentWorldRuntime({ ...options, epochEvents, journeyEvents });
  const replayed = restarted.epochProposeJourneyStep(proposalInput);
  assert.equal(replayed.proposal.sceneContract?.sceneId, proposed.proposal.sceneContract?.sceneId);
  assert.deepEqual(replayed.proposal.sceneContract?.actionOptions, proposed.proposal.sceneContract?.actionOptions);
  const selected = replayed.proposal.sceneContract?.actionOptions[0];
  assert.ok(selected);
  const committed = restarted.epochCommitJourneyAction({
    journeyId: started.journey.journeyId,
    sceneId: replayed.proposal.sceneContract?.sceneId,
    episodeId: replayed.proposal.episode.episodeId,
    expectedVersion: replayed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "restart-commit",
  });
  assert.deepEqual(committed.journey.episodeIds.length, 3);
});

test("an archived identity keeps its grounded album inside the reincarnated lineage chronicle", async () => {
  const context = await preparedAgentNativeJourney("lineage-album");
  const selected = context.proposed.proposal.sceneContract.actionOptions[0];
  await context.mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: context.started.journey.journeyId,
    sceneId: context.proposed.proposal.sceneContract.sceneId,
    episodeId: context.proposed.proposal.episode.episodeId,
    expectedVersion: context.proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: "lineage-album-commit",
  });
  context.advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");
  const settled = payload(await context.mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: context.started.journey.journeyId,
    recoveryCode: context.ownerRecovery,
  }));
  assert.equal(settled.journey.status, "settled");
  await context.mcp.callTool("obsidian_epoch.archive_identity", {
    agentId: context.agentId,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: "lineage-album-archive",
  });
  const reincarnated = payload(await context.mcp.callTool("obsidian_epoch.reincarnate", {
    previousAgentId: context.agentId,
    recoveryCode: context.ownerRecovery,
    idempotencyKey: "lineage-album-reincarnate",
  }));
  assert.equal(reincarnated.value.generation, 2);

  const album = payload(await context.mcp.callTool("obsidian_epoch.journey_album", {
    agentId: context.agentId,
    recoveryCode: context.ownerRecovery,
    year: 2025,
  }));
  assert.equal(album.postcards.length, 3);
  assert.equal(album.lineageChronicle.generations.length, 2);
  assert.equal(album.lineageChronicle.generations[0].agentId, context.agentId);
  assert.equal(album.lineageChronicle.generations[0].postcardIds.length, 3);
  assert.equal(album.lineageChronicle.generations[1].agentId, reincarnated.value.agentId);
  const transition = album.lineageChronicle.transitions[0];
  assert.equal(transition.fromAgentId, context.agentId);
  assert.equal(transition.toAgentId, reincarnated.value.agentId);
  assert.ok(transition.sourceEventIds.length >= 2);
});

test("start_journey performs nested Sampling and settles only a server-issued option", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-sampling",
  }));

  const session = createMcpSession({ sessionId: "companion_sampling", transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "test-host", version: "1" },
  });
  session.acceptInitializedNotification();
  const sent: Record<string, unknown>[] = [];
  const manager = createMcpServerRequestManager({
    send: (message) => { sent.push(message); },
    requestIdFactory: () => "server-sampling-journey",
  });
  const sampling = createMcpSamplingClient({ session, requestManager: manager });
  const responsePromise = handleMcpJsonRpcMessage(mcp, {
    jsonrpc: "2.0",
    id: 77,
    method: "tools/call",
    params: {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        decisionMode: "host_sampling",
        recoveryCode: ownerRecovery,
        idempotencyKey: "start-sampling",
      },
    },
  }, { session, sampling });
  await new Promise<void>((resolve) => setImmediate(resolve));

  const request = JSON.parse(JSON.stringify(sent[0]));
  assert.equal(request.method, "sampling/createMessage");
  const prompt = JSON.parse(request.params.messages[0].content.text);
  assert.equal(prompt.scene.location.label, "灰港民务账房");
  assert.ok(prompt.scene.participants.some((participant: { label: string }) => participant.label === "夜班书记珂岚"));
  assert.ok(prompt.scene.confirmedFactIds.every((factId: string) => factId.startsWith("world:")));
  assert.equal(prompt.actionOptions.some((option: { label: string }) =>
    /观察区域势态|协助区域事务|接触低阶异常/u.test(option.label)), false);
  const selectedId = prompt.actionOptions[0].actionOptionId;
  manager.handleResponse({
    jsonrpc: "2.0",
    id: request.id,
    result: {
      role: "assistant",
      content: {
        type: "text",
        text: JSON.stringify({
          actionOptionId: selectedId,
          rationale: "低风险且符合委托",
          confidence: 0.9,
          userFacingMessage: "我先做这件稳妥的事。",
        }),
      },
      model: "host-model",
      stopReason: "endTurn",
    },
  });
  const response = await responsePromise;
  assert.ok(response && "result" in response);
  const result = payload(response.result as { readonly content: readonly { readonly text: string }[] });
  assert.equal(result.sampling.ok, true);
  assert.equal(result.sampling.trust, "untrusted_client");
  assert.equal(result.settledAction.actionOptionId, selectedId);
  assert.equal(result.proposal.episode.phase, "main");
  assert.equal(result.mainEpisode.phase, "main");
  assert.equal(result.returnEpisode.phase, "return");
  assert.equal(result.journey.status, "returning");
  const replay = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    decisionMode: "host_sampling",
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-sampling",
  }));
  assert.equal(replay.sampling.fallback, "capability_absent");
  assert.deepEqual(replay.journey.episodeIds, result.journey.episodeIds);
  assert.equal(sent.length, 1);
  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");
  const settled = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: prepared.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(settled.finalVerification.page.payload.journey.status, "settled");
  assert.deepEqual(settled.episodes.map((episode: { phase: string }) => episode.phase),
    ["arrival", "main", "return"]);
  assert.ok(settled.finalVerification.page.payload.journey.canonicalEventIds.length >= 3);
  assert.ok(settled.finalVerification.page.payload.journey.stateDelta.outcomeSummary);
  assert.equal(settled.finalVerification.page.expiresAt, undefined);
  manager.close();
});

test("invalid Sampling advice leaves the signed proposal open for Agent-native commit", async () => {
  const { mcp, agentId, ownerRecovery } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    mandate: { objective: "找稳定工作", priorities: ["work"] },
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-invalid-sampling",
  }));
  const session = createMcpSession({ sessionId: "invalid_sampling", transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "invalid-sampling-host", version: "1" },
  });
  session.acceptInitializedNotification();
  const sent: Record<string, unknown>[] = [];
  const manager = createMcpServerRequestManager({ send: (message) => { sent.push(message); } });
  const responsePromise = handleMcpJsonRpcMessage(mcp, {
    jsonrpc: "2.0",
    id: 91,
    method: "tools/call",
    params: {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        decisionMode: "host_sampling",
        recoveryCode: ownerRecovery,
        idempotencyKey: "start-invalid-sampling",
      },
    },
  }, { session, sampling: createMcpSamplingClient({ session, requestManager: manager }) });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const request = sent[0] as { id: string };
  manager.handleResponse({
    jsonrpc: "2.0",
    id: request.id,
    result: {
      role: "assistant",
      content: { type: "text", text: JSON.stringify({
        actionOptionId: "action_not_issued_by_server",
        rationale: "尝试伪造选择",
        confidence: 1,
      }) },
    },
  });
  const response = await responsePromise;
  assert.ok(response && "result" in response);
  const result = payload(response.result as { readonly content: readonly { readonly text: string }[] });
  assert.equal(result.sampling.fallback, "invalid_action_option");
  assert.equal(result.nextAction, "obsidian_epoch.commit_journey_action");
  assert.equal(result.proposal.episode.phase, "main");
  const status = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: prepared.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(status.journey.status, "awaiting_agent");
  assert.deepEqual(status.episodes.map((episode: { phase: string }) => episode.phase), ["arrival"]);
  manager.close();
});

test("public start_hosted_session ignores client-injected scene contracts and rewards", async () => {
  const { mcp, agentId, ownerRecovery } = await fixture();
  const forged = payload(await mcp.callTool("obsidian_epoch.start_hosted_session", {
    agentId,
    regionId: "灰港",
    mandate: "普通托管行动",
    recoveryCode: ownerRecovery,
    idempotencyKey: "forged-scene-contract",
    journeyScene: {
      sceneType: "livelihood",
      actionOptions: [{ optionKey: "claim_reward", reward: { resourceId: "coin", amount: 999 } }],
    },
    reward: { resourceId: "coin", amount: 999 },
  }));

  assert.equal(forged.value.sceneContract, undefined);
  assert.deepEqual(forged.value.actionOptions.map((option: { optionKey: string }) => option.optionKey), [
    "observe", "assist", "anomaly",
  ]);
  assert.equal(forged.value.actionOptions.some((option: { optionKey: string }) => option.optionKey === "claim_reward"), false);
  assert.equal(forged.value.actionOptions.some((option: { reward?: { amount?: number } }) => option.reward?.amount === 999), false);
});

test("an overdue journey waits for the Agent main decision, then returns exactly once", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-return",
  }));
  const started = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-return",
  }));
  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");

  const waiting = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId,
    regionId: "灰港",
    recoveryCode: ownerRecovery,
  }));
  assert.equal(waiting.returnedJourneys.length, 0);
  assert.equal(waiting.currentJourney.status, "awaiting_agent");

  const proposed = payload(await mcp.callTool("obsidian_epoch.propose_journey_step", {
    journeyId: started.journey.journeyId,
    expectedVersion: waiting.currentJourney.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "propose-overdue-main",
  }));
  const selected = proposed.proposal.sceneContract.actionOptions[0];
  await mcp.callTool("obsidian_epoch.commit_journey_action", {
    journeyId: started.journey.journeyId,
    sceneId: proposed.proposal.sceneContract.sceneId,
    episodeId: proposed.proposal.episode.episodeId,
    expectedVersion: proposed.proposal.expectedVersion,
    actionOptionId: selected.actionOptionId,
    signature: selected.signature,
    recoveryCode: ownerRecovery,
    idempotencyKey: "commit-overdue-main",
  });

  const first = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId,
    regionId: "灰港",
    recoveryCode: ownerRecovery,
  }));
  assert.equal(first.returnedJourneys.length, 1);
  assert.equal(first.returnedJourneys[0].status, "settled");
  assert.equal(first.returnedJourneyVerifications.length, 1);
  const second = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId,
    regionId: "灰港",
    recoveryCode: ownerRecovery,
    acknowledgeReturnedJourneyIds: [first.returnedJourneys[0].journeyId],
  }));
  assert.equal(second.returnedJourneys.length, 0);
});

test("recall records a safe grounded main decision and return before settlement", async () => {
  const { mcp, agentId, ownerRecovery, advance } = await fixture();
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId,
    destinationRegionId: "灰港",
    recoveryCode: ownerRecovery,
    idempotencyKey: "prepare-recall-grounded",
  }));
  const started = payload(await mcp.callTool("obsidian_epoch.start_journey", {
    journeyId: prepared.journey.journeyId,
    expectedVersion: prepared.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "start-recall-grounded",
  }));
  const recalled = payload(await mcp.callTool("obsidian_epoch.recall_journey", {
    journeyId: started.journey.journeyId,
    expectedVersion: started.journey.version,
    recoveryCode: ownerRecovery,
    idempotencyKey: "recall-grounded",
  }));
  assert.deepEqual(recalled.episodes.map((episode: { phase: string }) => episode.phase), ["arrival", "main", "return"]);
  assert.equal(recalled.mainEpisode.settlement.outcomeSummary.includes("安全离开"), true);
  assert.equal(recalled.returnEpisode.serverFacts.sourceEventIds.length > 0, true);
  assert.equal(recalled.journey.status, "returning");

  advance("2026-07-12T00:45:00.000Z", "2026-01-01T09:30:00.000Z");
  const status = payload(await mcp.callTool("obsidian_epoch.journey_status", {
    journeyId: started.journey.journeyId,
    recoveryCode: ownerRecovery,
  }));
  assert.equal(status.journey.status, "settled");
});

test("Journey idempotency keys are isolated between explorers", async () => {
  const mcp = createAgentWorldMcpRuntime({ epoch: { idFactory: createSequentialEpochIdFactory("journey_owner_scope") } });
  const issue = async (explorerId: string) => {
    const recovery = recoveryCode(explorerId, `secret-${explorerId}`);
    const identity = payload(await mcp.callTool("obsidian_epoch.identity", {
      explorerId,
      recoveryCode: recovery,
      idempotencyKey: `identity-${explorerId}`,
    }));
    return { recovery, agentId: identity.value.agentId as string };
  };
  const ownerA = await issue("explorer_scope_a");
  const ownerB = await issue("explorer_scope_b");
  const prepare = async (owner: { recovery: string; agentId: string }) => payload(await mcp.callTool(
    "obsidian_epoch.prepare_journey",
    {
      agentId: owner.agentId,
      destinationRegionId: "region_gray_harbor",
      recoveryCode: owner.recovery,
      idempotencyKey: "same-client-key",
    },
  ));
  const preparedA = await prepare(ownerA);
  const preparedB = await prepare(ownerB);
  assert.notEqual(preparedA.journey.journeyId, preparedB.journey.journeyId);
});

test("Agent A journey encounter appears in Agent B briefing without direct model contact", async () => {
  let realNow = "2026-07-12T00:00:00.000Z";
  let worldNow = "2026-01-01T08:00:00.000Z";
  let epochNow = "2026-07-12T00:00:00.000Z";
  const mcp = createAgentWorldMcpRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("two_agent_journey"),
      clock: () => new Date(epochNow),
    },
    journey: {
      now: () => realNow,
      worldNow: () => worldNow,
    },
  });
  const recoveryA = recoveryCode("explorer_two_agent_a", "local-secret-a");
  const recoveryB = recoveryCode("explorer_two_agent_b", "local-secret-b");
  const identityA = payload(await mcp.callTool("obsidian_epoch.identity", {
    explorerId: "explorer_two_agent_a",
    recoveryCode: recoveryA,
    identityName: "远行者 A",
    idempotencyKey: "identity-two-agent-a",
  }));
  const identityB = payload(await mcp.callTool("obsidian_epoch.identity", {
    explorerId: "explorer_two_agent_b",
    recoveryCode: recoveryB,
    identityName: "留守者 B",
    idempotencyKey: "identity-two-agent-b",
  }));
  await mcp.callTool("obsidian_epoch.set_downtime", {
    agentId: identityB.value.agentId,
    mode: "meditation",
    recoveryCode: recoveryB,
    idempotencyKey: "downtime-two-agent-b",
  });
  const prepared = payload(await mcp.callTool("obsidian_epoch.prepare_journey", {
    agentId: identityA.value.agentId,
    destinationRegionId: "region_gray_harbor",
    mandate: {
      objective: "拜访同住灰港的其他探索者",
      priorities: ["social", "agent"],
      preferredActivities: ["social", "visit"],
    },
    recoveryCode: recoveryA,
    idempotencyKey: "prepare-two-agent-a",
  }));
  const session = createMcpSession({ sessionId: "two_agent_sampling", transport: "stdio" });
  session.acceptInitialize({
    protocolVersion: "2025-06-18",
    capabilities: { sampling: {} },
    clientInfo: { name: "two-agent-test-host", version: "1" },
  });
  session.acceptInitializedNotification();
  const sent: Record<string, unknown>[] = [];
  const manager = createMcpServerRequestManager({ send: (message) => { sent.push(message); } });
  const responsePromise = handleMcpJsonRpcMessage(mcp, {
    jsonrpc: "2.0",
    id: 88,
    method: "tools/call",
    params: {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        decisionMode: "host_sampling",
        recoveryCode: recoveryA,
        idempotencyKey: "start-two-agent-a",
      },
    },
  }, { session, sampling: createMcpSamplingClient({ session, requestManager: manager }) });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const samplingRequest = sent[0] as { id: string; params: { messages: { content: { text: string } }[] } };
  const samplingPrompt = JSON.parse(samplingRequest.params.messages[0].content.text);
  manager.handleResponse({
    jsonrpc: "2.0",
    id: samplingRequest.id,
    result: {
      role: "assistant",
      content: { type: "text", text: JSON.stringify({
        actionOptionId: samplingPrompt.actionOptions[0].actionOptionId,
        rationale: "执行服务器签发的社交行动",
        confidence: 0.9,
      }) },
    },
  });
  const response = await responsePromise;
  assert.ok(response && "result" in response);
  const started = payload(response.result as { readonly content: readonly { readonly text: string }[] });
  assert.ok(started.scenePlan.episodes.some((episode: { fingerprint: { participantIds: string[] } }) =>
    episode.fingerprint.participantIds.includes(identityB.value.agentId)));
  realNow = "2026-07-12T00:45:00.000Z";
  worldNow = "2026-01-01T09:30:00.000Z";

  const briefingA = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityA.value.agentId,
    recoveryCode: recoveryA,
    deferReturnDelivery: true,
  }));

  const briefingB = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
    regionId: "region_gray_harbor",
    recoveryCode: recoveryB,
  }));
  assert.equal(briefingB.interactionInboxTotal, 1);
  assert.equal(briefingB.interactionInbox[0].kind, "encounter");
  assert.equal(briefingB.interactionInbox[0].proposerAgentId, identityA.value.agentId);
  assert.match(briefingB.interactionInboxFeatured.whyRelevant, /真实旅程/);
  const shared = briefingB.interactionInbox[0].sharedEpisode;
  assert.ok(shared);
  assert.deepEqual(shared.sourceEventIds, started.mainEpisode.serverFacts.sourceEventIds);
  assert.equal(shared.narrative, started.mainEpisode.narrative.postcard.text);
  assert.match(shared.verificationUrl, /\/epoch\/result\/.+#episode-/);
  assert.ok(Date.parse(briefingB.interactionInbox[0].expiresAtWorldTime) > Date.parse(worldNow));
  assert.doesNotMatch(JSON.stringify(briefingB.interactionInbox), /local-secret|recoveryCode|signature|actionOptions/);

  const aEpisode = briefingA.recentEpisodes.find((episode: { episodeId: string }) => episode.episodeId === shared.episodeId);
  assert.ok(aEpisode);
  assert.deepEqual(aEpisode.serverFacts.sourceEventIds, shared.sourceEventIds);
  assert.equal(aEpisode.narrative.postcard.text, shared.narrative);

  const replayB = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
    recoveryCode: recoveryB,
  }));
  assert.equal(replayB.interactionInboxTotal, briefingB.interactionInboxTotal);
  assert.equal(replayB.interactionInbox[0].interactionId, briefingB.interactionInbox[0].interactionId);
  await mcp.callTool("obsidian_epoch.set_downtime", {
    agentId: identityA.value.agentId,
    mode: "meditation",
    recoveryCode: recoveryA,
    idempotencyKey: "two-agent-a-focus-downtime",
  });
  epochNow = "2026-07-12T00:10:00.000Z";
  await mcp.callTool("obsidian_epoch.claim_downtime", {
    agentId: identityA.value.agentId,
    recoveryCode: recoveryA,
    idempotencyKey: "two-agent-a-focus-claim",
  });
  await mcp.callTool("obsidian_epoch.propose_diplomacy", {
    regionId: "region_gray_harbor",
    sourceAgentId: identityA.value.agentId,
    targetAgentId: identityB.value.agentId,
    kind: "alliance",
    focusSpent: 1,
    terms: "share_gray_harbor_routes",
    recoveryCode: recoveryA,
    idempotencyKey: "two-agent-diplomacy-before-noise",
  });
  const withDiplomacy = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
    recoveryCode: recoveryB,
  }));
  const diplomacyInteraction = withDiplomacy.interactionInbox.find((entry: { kind: string }) => entry.kind === "commission");
  assert.ok(diplomacyInteraction);
  for (let index = 0; index < 250; index += 1) {
    mcp.runtime.epochRecordRejectedCommand({
      surface: "test",
      command: `unrelated-noise-${index}`,
      errorCode: "unrelated_noise",
      statusCode: 400,
      input: { redacted: true },
    });
  }
  const afterUnrelatedTraffic = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
    recoveryCode: recoveryB,
  }));
  assert.ok(afterUnrelatedTraffic.interactionInboxTotal >= 2);
  assert.ok(afterUnrelatedTraffic.interactionInbox.some((entry: { interactionId: string }) =>
    entry.interactionId === diplomacyInteraction.interactionId));
  const publicB = payload(await mcp.callTool("obsidian_epoch.agent_briefing", {
    agentId: identityB.value.agentId,
  }));
  assert.equal(publicB.interactionInboxTotal, 0);
  assert.deepEqual(publicB.interactionInboxSummaries, []);
  assert.deepEqual(publicB.interactionInbox, []);
  manager.close();
});

test("MCP briefing keeps the oldest evicted terminal closed across canonical replay and runtime restart", async () => {
  const createdAt = "2026-07-12T00:00:00.000Z";
  const worldNow = "2026-07-12T00:05:00.000Z";
  const base = createAgentWorldMcpRuntime({
    epoch: { clock: () => new Date(createdAt) },
    journey: { now: () => createdAt, worldNow: () => worldNow },
  });
  const explorerA = "explorer_terminal_e2e_a";
  const explorerB = "explorer_terminal_e2e_b";
  const recoveryA = recoveryCode(explorerA, "terminal-e2e-a-secret");
  const recoveryB = recoveryCode(explorerB, "terminal-e2e-b-secret");
  const identityA = payload(await base.callTool("obsidian_epoch.identity", {
    explorerId: explorerA,
    recoveryCode: recoveryA,
    identityName: "终局提案者",
    idempotencyKey: "terminal-e2e-identity-a",
  }));
  const identityB = payload(await base.callTool("obsidian_epoch.identity", {
    explorerId: explorerB,
    recoveryCode: recoveryB,
    identityName: "终局接收者",
    idempotencyKey: "terminal-e2e-identity-b",
  }));
  const sourceAgentId = identityA.value.agentId as string;
  const targetAgentId = identityB.value.agentId as string;
  const lifecycleEvents = Array.from({ length: 201 }, (_, index) => {
    const suffix = String(200 - index).padStart(3, "0");
    const diplomacyId = `diplomacy_terminal_e2e_${suffix}`;
    const commonPayload = {
      diplomacyId,
      regionId: "region_gray_harbor",
      sourceAgentId,
      sourceExplorerId: explorerA,
      targetAgentId,
      targetExplorerId: explorerB,
      kind: "alliance",
      focusSpent: 1,
      terms: `terminal_e2e_${suffix}`,
    };
    const proposal = {
      eventId: `epoch_terminal_e2e_proposal_${suffix}`,
      eventType: "diplomacy_proposed",
      aggregateType: "diplomacy",
      aggregateId: diplomacyId,
      actorExplorerId: explorerA,
      agentId: sourceAgentId,
      trustClass: "user_verified_web",
      causationId: `terminal_e2e_proposal_${suffix}`,
      correlationId: `terminal_e2e_${suffix}`,
      createdAt,
      payload: { ...commonPayload, status: "pending", proposedAt: createdAt },
    } as unknown as EpochEvent;
    const response = {
      ...proposal,
      eventId: `epoch_terminal_e2e_response_${suffix}`,
      eventType: "diplomacy_responded",
      actorExplorerId: explorerB,
      agentId: targetAgentId,
      causationId: proposal.eventId,
      payload: {
        ...commonPayload,
        status: "accepted",
        response: "accepted",
        respondedAt: createdAt,
      },
    } as unknown as EpochEvent;
    return [proposal, response] as const;
  }).flat();
  const baseEvents = base.runtime.epochEvents({ limit: 1_000 }).events as EpochEvent[];
  const recoveredEvents = [...baseEvents, ...lifecycleEvents];
  const evictedInteractionId = `interaction:${lifecycleEvents[0]!.aggregateId}:${targetAgentId}`;

  const briefingAfterRecovery = async () => {
    const restarted = createAgentWorldMcpRuntime({
      epochEvents: recoveredEvents,
      epoch: { clock: () => new Date(createdAt) },
      journey: { now: () => createdAt, worldNow: () => worldNow },
    });
    const first = payload(await restarted.callTool("obsidian_epoch.agent_briefing", {
      agentId: targetAgentId,
      recoveryCode: recoveryB,
    }));
    const incrementalReplay = payload(await restarted.callTool("obsidian_epoch.agent_briefing", {
      agentId: targetAgentId,
      recoveryCode: recoveryB,
    }));
    assert.equal(first.interactionInboxFeatured?.envelope?.status, "accepted");
    assert.equal(incrementalReplay.interactionInboxFeatured?.envelope?.status, "accepted");
    assert.notEqual(first.interactionInboxFeatured?.envelope?.interactionId, evictedInteractionId);
    assert.notEqual(incrementalReplay.interactionInboxFeatured?.envelope?.interactionId, evictedInteractionId);
    assert.equal(incrementalReplay.interactionInboxTotal, first.interactionInboxTotal);
    return first;
  };

  const firstRestart = await briefingAfterRecovery();
  const secondRestart = await briefingAfterRecovery();
  assert.equal(secondRestart.interactionInboxTotal, firstRestart.interactionInboxTotal);
  assert.equal(secondRestart.interactionInboxFeatured?.envelope?.status, "accepted");
  assert.notEqual(secondRestart.interactionInboxFeatured?.envelope?.interactionId, evictedInteractionId);
});
