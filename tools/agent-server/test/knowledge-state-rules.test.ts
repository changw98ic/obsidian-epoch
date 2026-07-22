import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKnowledgeState,
  canAccessKnowledgeRecord,
  type EpochKnowledgeInputItem,
  type EpochKnowledgeInputSource,
  type EpochKnowledgeKind,
} from "../lib/epoch/knowledgeStateRules.ts";
import {
  knowledgeView,
  type WorldKnowledgeLikeHit,
  type WorldMemoryLikeHit,
} from "../lib/epoch/knowledgeViewRules.ts";

const FIRST_OBSERVED_AT = "2026-07-18T01:00:00.000Z";
const LAST_OBSERVED_AT = "2026-07-18T03:00:00.000Z";

const KINDS: readonly EpochKnowledgeKind[] = [
  "fact",
  "observation",
  "claim",
  "belief",
  "rumor",
  "deception",
  "refutation",
  "memory",
];

const PUBLIC_EXTERNAL_SOURCE: EpochKnowledgeInputSource = {
  sourceId: "source_public_registry",
  trustClass: "system_worker",
  sourceAuthority: "core",
  channel: "public",
  hop: 0,
  confirmationBias: 0,
};

const PRIVATE_EXTERNAL_SOURCE: EpochKnowledgeInputSource = {
  sourceId: "source_private_registry",
  trustClass: "server_hosted_agent",
  sourceAuthority: "official",
  channel: "private",
  hop: 0,
  confirmationBias: 0,
};

function publicItem(overrides: Partial<EpochKnowledgeInputItem> & Pick<EpochKnowledgeInputItem, "id" | "kind" | "text">): EpochKnowledgeInputItem {
  return {
    createdAt: FIRST_OBSERVED_AT,
    observedAt: FIRST_OBSERVED_AT,
    source: {
      sourceId: `source_${overrides.id}`,
      trustClass: "system_worker",
      sourceAuthority: "core",
      channel: "canonical",
      hop: 0,
      observedAt: FIRST_OBSERVED_AT,
      evidenceIds: [`event_${overrides.id}`],
      confirmationBias: 0,
    },
    visibility: {
      scopes: ["public"],
      legalAccess: "public",
    },
    ...overrides,
  };
}

test("buildKnowledgeState indexes all eight knowledge kinds without promotion", () => {
  const records = KINDS.map((kind) => publicItem({
    id: `record_${kind}`,
    kind,
    text: `${kind} remains typed`,
  }));

  const state = buildKnowledgeState(records);

  assert.deepEqual(state.records.map((record) => record.id), [
    "record_belief",
    "record_claim",
    "record_deception",
    "record_fact",
    "record_memory",
    "record_observation",
    "record_refutation",
    "record_rumor",
  ]);
  for (const kind of KINDS) {
    assert.equal(state.byKind[kind].length, 1);
    assert.equal(state.byKind[kind][0]?.kind, kind);
  }
  assert.equal(state.refutations[0]?.id, "record_refutation");
});

test("source evidence preserves trust, channel, hop, time, evidence, and confirmation bias", () => {
  const state = buildKnowledgeState([{
    id: "fact_mixed_sources",
    kind: "fact",
    text: "两条来源链共同支撑同一事实。",
    evidenceIds: ["evidence_manual"],
    sources: [{
      sourceId: "source_core",
      sourceType: "registry",
      trustClass: "system_worker",
      sourceAuthority: "core",
      channel: "canonical",
      hop: 0,
      observedAt: FIRST_OBSERVED_AT,
      evidenceIds: ["event_core"],
      confirmationBias: 0,
    }, {
      sourceId: "source_rumor",
      sourceType: "npc_gossip",
      trustClass: "untrusted_client",
      sourceAuthority: "low-confidence",
      channel: "adversarial",
      hop: 3,
      observedAt: LAST_OBSERVED_AT,
      sourceEventIds: ["evt_rumor"],
      confirmationBias: 0.8,
    }],
  }]);

  const record = state.byId.fact_mixed_sources;

  assert.deepEqual(record.evidence.trustClasses, ["system_worker", "untrusted_client"]);
  assert.deepEqual(record.evidence.channels, ["adversarial", "canonical"]);
  assert.equal(record.evidence.hopCount, 3);
  assert.equal(record.evidence.firstObservedAt, FIRST_OBSERVED_AT);
  assert.equal(record.evidence.lastObservedAt, LAST_OBSERVED_AT);
  assert.deepEqual(record.evidence.evidenceIds, ["evidence_manual", "event_core", "evt_rumor"]);
  assert.deepEqual(record.evidence.sourceEventIds, ["event_core", "evt_rumor"]);
  assert.equal(record.evidence.confirmationBias, 0.4);
  assert.equal(Number(record.confidence.toFixed(6)), 0.748327);
});

test("low trust, indirect hops, adversarial channel, and bias lower derived confidence deterministically", () => {
  const state = buildKnowledgeState([{
    id: "claim_strong",
    kind: "claim",
    text: "高可信直接来源声明。",
    source: {
      sourceId: "source_strong",
      trustClass: "server_hosted_agent",
      sourceAuthority: "official",
      channel: "direct",
      hop: 0,
      observedAt: FIRST_OBSERVED_AT,
      confirmationBias: 0,
    },
  }, {
    id: "claim_weak",
    kind: "claim",
    text: "低可信多跳偏见声明。",
    source: {
      sourceId: "source_weak",
      trustClass: "untrusted_client",
      sourceAuthority: "low-confidence",
      channel: "adversarial",
      hop: 5,
      observedAt: FIRST_OBSERVED_AT,
      confirmationBias: 1,
    },
  }]);

  assert.ok(state.byId.claim_strong.confidence > state.byId.claim_weak.confidence);
  assert.equal(Number(state.byId.claim_strong.confidence.toFixed(6)), 0.599953);
  assert.equal(Number(state.byId.claim_weak.confidence.toFixed(6)), 0.309089);
});

test("refutation marks claims refuted and beliefs contested without deleting beliefs", () => {
  const state = buildKnowledgeState([
    publicItem({ id: "claim_target", kind: "claim", text: "目标声明。", confidence: 0.6 }),
    publicItem({ id: "belief_target", kind: "belief", text: "目标信念。", confidence: 0.6 }),
    publicItem({
      id: "refutation_hard",
      kind: "refutation",
      text: "反驳两个目标。",
      confidence: 0.95,
      refutes: ["belief_target", "claim_target"],
    }),
  ]);

  assert.equal(state.byId.claim_target.status, "refuted");
  assert.equal(state.byId.belief_target.status, "contested");
  assert.deepEqual(state.byId.belief_target.refutedBy, ["refutation_hard"]);
  assert.equal(state.byKind.belief.some((record) => record.id === "belief_target"), true);
});

test("caller visibility accepts only matching region, organization, agent, explorer, or evidence scopes", () => {
  const state = buildKnowledgeState([
    publicItem({
      id: "region_record",
      kind: "fact",
      text: "区域可见。",
      visibility: { scopes: ["region"], legalAccess: "source-bound", regionIds: ["region_north"] },
    }),
    publicItem({
      id: "organization_record",
      kind: "fact",
      text: "组织可见。",
      visibility: { scopes: ["organization"], legalAccess: "source-bound", organizationIds: ["org_cartographers"] },
    }),
    publicItem({
      id: "agent_record",
      kind: "fact",
      text: "代理可见。",
      visibility: { scopes: ["agent"], legalAccess: "source-bound", agentIds: ["agent_7"] },
    }),
    publicItem({
      id: "explorer_record",
      kind: "fact",
      text: "探索者可见。",
      visibility: { scopes: ["explorer"], legalAccess: "source-bound", explorerIds: ["explorer_7"] },
    }),
    publicItem({
      id: "evidence_record",
      kind: "fact",
      text: "证据绑定可见。",
      visibility: { scopes: ["evidence"], legalAccess: "source-bound", evidenceIds: ["event_secret"] },
    }),
  ]);

  assert.equal(canAccessKnowledgeRecord(state.byId.region_record, { regionId: "region_north" }), true);
  assert.equal(canAccessKnowledgeRecord(state.byId.region_record, { regionId: "region_south" }), false);
  assert.equal(canAccessKnowledgeRecord(state.byId.organization_record, { organizationIds: ["org_cartographers"] }), true);
  assert.equal(canAccessKnowledgeRecord(state.byId.agent_record, { agentId: "agent_7" }), true);
  assert.equal(canAccessKnowledgeRecord(state.byId.explorer_record, { explorerId: "explorer_7" }), true);
  assert.equal(canAccessKnowledgeRecord(state.byId.evidence_record, { evidenceIds: ["event_secret"] }), true);
  assert.equal(canAccessKnowledgeRecord(state.byId.evidence_record, { evidenceIds: ["event_other"] }), false);
});

test("knowledgeView filters records by caller, region, organization, evidence, and kind", () => {
  const view = knowledgeView({
    caller: {
      regionId: "region_north",
      organizationIds: ["org_cartographers"],
      evidenceIds: ["event_visible"],
    },
    organizationId: "org_cartographers",
    evidenceIds: ["event_visible"],
    kinds: ["fact"],
    records: [
      publicItem({
        id: "visible_fact",
        kind: "fact",
        text: "可见组织事实。",
        regionIds: ["region_north"],
        organizationIds: ["org_cartographers"],
        evidenceIds: ["event_visible"],
        visibility: {
          scopes: ["region", "organization", "evidence"],
          legalAccess: "source-bound",
          regionIds: ["region_north"],
          organizationIds: ["org_cartographers"],
          evidenceIds: ["event_visible"],
        },
      }),
      publicItem({
        id: "wrong_kind",
        kind: "rumor",
        text: "类型不匹配。",
        regionIds: ["region_north"],
        organizationIds: ["org_cartographers"],
        evidenceIds: ["event_visible"],
        visibility: {
          scopes: ["region", "organization", "evidence"],
          legalAccess: "source-bound",
          regionIds: ["region_north"],
          organizationIds: ["org_cartographers"],
          evidenceIds: ["event_visible"],
        },
      }),
      publicItem({
        id: "wrong_evidence",
        kind: "fact",
        text: "证据不匹配。",
        regionIds: ["region_north"],
        organizationIds: ["org_cartographers"],
        evidenceIds: ["event_hidden"],
        visibility: {
          scopes: ["region", "organization", "evidence"],
          legalAccess: "source-bound",
          regionIds: ["region_north"],
          organizationIds: ["org_cartographers"],
          evidenceIds: ["event_hidden"],
        },
      }),
    ],
  });

  assert.deepEqual(view.hits.map((hit) => hit.record?.id), ["visible_fact"]);
  assert.equal(view.totals.visibleRecords, 1);
});

test("external memory and knowledge hits fail closed for private organization, owner, and evidence scopes", () => {
  const memoryHits: readonly WorldMemoryLikeHit[] = [{
    chunkId: "memory_org_private",
    sourcePageId: "page_org_private",
    regionId: "region_north",
    title: "组织私有记忆",
    content: "组织秘密摘要绝不能泄漏。",
    sourceEventIds: ["event_org_private"],
    source: PRIVATE_EXTERNAL_SOURCE,
    visibility: {
      scopes: ["organization"],
      legalAccess: "member",
      organizationIds: ["org_cartographers"],
    },
    score: 0.9,
  }, {
    chunkId: "memory_agent_private",
    sourcePageId: "page_agent_private",
    regionId: "region_north",
    title: "代理私有记忆",
    content: "代理秘密摘要绝不能泄漏。",
    sourceEventIds: ["event_agent_private"],
    source: PRIVATE_EXTERNAL_SOURCE,
    visibility: {
      scopes: ["agent"],
      legalAccess: "owner",
      agentIds: ["agent_7"],
    },
    score: 0.8,
  }, {
    chunkId: "memory_explorer_private",
    sourcePageId: "page_explorer_private",
    regionId: "region_north",
    title: "探索者私有记忆",
    content: "探索者秘密摘要绝不能泄漏。",
    sourceEventIds: ["event_explorer_private"],
    source: PRIVATE_EXTERNAL_SOURCE,
    visibility: {
      scopes: ["explorer"],
      legalAccess: "owner",
      explorerIds: ["explorer_7"],
    },
    score: 0.7,
  }, {
    chunkId: "memory_evidence_private",
    sourcePageId: "page_evidence_private",
    regionId: "region_north",
    title: "证据私有记忆",
    content: "证据秘密摘要绝不能泄漏。",
    sourceEventIds: ["event_secret"],
    source: PRIVATE_EXTERNAL_SOURCE,
    visibility: {
      scopes: ["evidence"],
      legalAccess: "source-bound",
      evidenceIds: ["event_secret"],
    },
    score: 0.6,
  }];
  const knowledgeHits: readonly WorldKnowledgeLikeHit[] = [{
    chunkId: "knowledge_org_private",
    sourceId: "source_org_private",
    collection: "factions",
    label: "组织私有知识",
    regionIds: ["region_north"],
    content: "组织知识摘要绝不能泄漏。",
    source: PRIVATE_EXTERNAL_SOURCE,
    visibility: {
      scopes: ["organization"],
      legalAccess: "member",
      organizationIds: ["org_cartographers"],
    },
    score: 0.9,
  }, {
    chunkId: "knowledge_agent_private",
    sourceId: "source_agent_private",
    collection: "factions",
    label: "代理私有知识",
    regionIds: ["region_north"],
    content: "代理知识摘要绝不能泄漏。",
    source: PRIVATE_EXTERNAL_SOURCE,
    visibility: {
      scopes: ["agent"],
      legalAccess: "owner",
      agentIds: ["agent_7"],
    },
    score: 0.8,
  }, {
    chunkId: "knowledge_explorer_private",
    sourceId: "source_explorer_private",
    collection: "factions",
    label: "探索者私有知识",
    regionIds: ["region_north"],
    content: "探索者知识摘要绝不能泄漏。",
    source: PRIVATE_EXTERNAL_SOURCE,
    visibility: {
      scopes: ["explorer"],
      legalAccess: "owner",
      explorerIds: ["explorer_7"],
    },
    score: 0.7,
  }, {
    chunkId: "knowledge_evidence_private",
    sourceId: "source_evidence_private",
    collection: "factions",
    label: "证据私有知识",
    regionIds: ["region_north"],
    content: "证据知识摘要绝不能泄漏。",
    source: PRIVATE_EXTERNAL_SOURCE,
    visibility: {
      scopes: ["evidence"],
      legalAccess: "source-bound",
      evidenceIds: ["event_secret"],
    },
    score: 0.6,
  }];

  const unauthorized = knowledgeView({
    caller: { regionId: "region_north" },
    memoryHits,
    knowledgeHits,
  });

  assert.deepEqual(unauthorized.hits, []);
  assert.equal(unauthorized.totals.excludedHits, 8);
  assert.equal(JSON.stringify(unauthorized).includes("秘密摘要"), false);
  assert.equal(JSON.stringify(unauthorized).includes("知识摘要"), false);

  const organizationMember = knowledgeView({
    caller: { regionId: "region_north", organizationIds: ["org_cartographers"] },
    memoryHits,
    knowledgeHits,
  });
  assert.deepEqual(organizationMember.hits.map((hit) => hit.id), [
    "knowledge:knowledge_org_private",
    "memory:memory_org_private",
  ]);
  assert.equal(organizationMember.totals.excludedHits, 6);

  const agentOwner = knowledgeView({
    caller: { regionId: "region_north", agentId: "agent_7" },
    memoryHits,
    knowledgeHits,
  });
  assert.deepEqual(agentOwner.hits.map((hit) => hit.id), [
    "knowledge:knowledge_agent_private",
    "memory:memory_agent_private",
  ]);

  const explorerOwner = knowledgeView({
    caller: { regionId: "region_north", explorerId: "explorer_7" },
    memoryHits,
    knowledgeHits,
  });
  assert.deepEqual(explorerOwner.hits.map((hit) => hit.id), [
    "knowledge:knowledge_explorer_private",
    "memory:memory_explorer_private",
  ]);

  const evidenceAuthorized = knowledgeView({
    caller: { regionId: "region_north", evidenceIds: ["event_secret"] },
    memoryHits,
    knowledgeHits,
  });
  assert.deepEqual(evidenceAuthorized.hits.map((hit) => hit.id), [
    "knowledge:knowledge_evidence_private",
    "memory:memory_evidence_private",
  ]);
});

test("memory and knowledge hits with identical title and content merge without promoting memory into fact", () => {
  const view = knowledgeView({
    caller: { regionId: "region_gray_harbor" },
    memoryHits: [{
      chunkId: "memory_1",
      sourcePageId: "page_1",
      regionId: "region_gray_harbor",
      title: "灰港航标",
      content: "灰港航标只记录路线，不控制军团。",
      sourceEventIds: ["event_memory"],
      source: PRIVATE_EXTERNAL_SOURCE,
      visibility: {
        scopes: ["region"],
        legalAccess: "source-bound",
        regionIds: ["region_gray_harbor"],
      },
      score: 0.7,
    }],
    knowledgeHits: [{
      chunkId: "knowledge_1",
      sourceId: "source_registry",
      collection: "rules",
      label: "灰港航标",
      regionIds: ["region_gray_harbor"],
      content: "灰港航标只记录路线，不控制军团。",
      source: PRIVATE_EXTERNAL_SOURCE,
      visibility: {
        scopes: ["region"],
        legalAccess: "source-bound",
        regionIds: ["region_gray_harbor"],
      },
      score: 0.3,
    }],
  });

  assert.equal(view.hits.length, 1);
  assert.equal(view.hits[0]?.source, "merged");
  assert.equal(view.hits[0]?.kind, "memory");
  assert.equal(view.hits[0]?.memory?.chunkId, "memory_1");
  assert.equal(view.hits[0]?.knowledge?.chunkId, "knowledge_1");
  assert.deepEqual(view.hits[0]?.evidenceIds, ["event_memory", "source_registry"]);
  assert.equal(view.hits[0]?.sourceChain.length, 2);
  assert.deepEqual(view.totals, {
    visibleRecords: 0,
    memoryHits: 1,
    knowledgeHits: 1,
    mergedHits: 1,
    excludedHits: 0,
  });
});

test("regionless retrieval hits do not leak into a regional caller view by default", () => {
  const view = knowledgeView({
    caller: { regionId: "region_gray_harbor" },
    memoryHits: [{
      chunkId: "memory_regionless",
      title: "无区域记忆",
      content: "没有绑定区域的记忆。",
      sourceEventIds: ["event_memory"],
      score: 0.9,
    }],
    knowledgeHits: [{
      chunkId: "knowledge_regionless",
      sourceId: "source_regionless",
      collection: "rules",
      label: "无区域知识",
      content: "没有绑定区域的知识。",
      score: 0.9,
    }],
  });

  assert.deepEqual(view.hits, []);
  assert.equal(view.totals.memoryHits, 0);
  assert.equal(view.totals.knowledgeHits, 0);
  assert.equal(view.totals.excludedHits, 2);
});

test("regionless retrieval hits are not public without explicit public visibility and legal source", () => {
  const view = knowledgeView({
    memoryHits: [{
      chunkId: "memory_regionless",
      title: "无区域记忆",
      content: "没有绑定区域的记忆。",
      sourceEventIds: ["event_memory"],
      score: 0.9,
    }],
    knowledgeHits: [{
      chunkId: "knowledge_regionless",
      sourceId: "source_regionless",
      collection: "rules",
      label: "无区域知识",
      content: "没有绑定区域的知识。",
      score: 0.9,
    }],
  });

  assert.deepEqual(view.hits, []);
  assert.equal(view.totals.excludedHits, 2);
});

test("explicit public external hits with lawful sources remain visible without a region", () => {
  const view = knowledgeView({
    memoryHits: [{
      chunkId: "memory_public",
      title: "公开记忆",
      content: "显式公开的合法记忆。",
      sourceEventIds: ["event_memory_public"],
      source: PUBLIC_EXTERNAL_SOURCE,
      legalAccess: "public",
      score: 0.9,
    }],
    knowledgeHits: [{
      chunkId: "knowledge_public",
      sourceId: "source_public_registry",
      collection: "rules",
      label: "公开知识",
      content: "显式公开的合法知识。",
      source: PUBLIC_EXTERNAL_SOURCE,
      legalAccess: "public",
      score: 0.9,
    }],
  });

  assert.deepEqual(view.hits.map((hit) => hit.id), ["knowledge:knowledge_public", "memory:memory_public"]);
  assert.equal(view.totals.excludedHits, 0);
});

test("knowledgeView sorts deterministically by confidence, score, then id", () => {
  const view = knowledgeView({
    caller: { regionId: "region_sort" },
    knowledgeHits: [{
      chunkId: "b_same_confidence_lower_score",
      sourceId: "source_b",
      collection: "factions",
      regionIds: ["region_sort"],
      content: "同置信较低分。",
      source: PRIVATE_EXTERNAL_SOURCE,
      visibility: {
        scopes: ["region"],
        legalAccess: "source-bound",
        regionIds: ["region_sort"],
      },
      score: 0.4,
    }, {
      chunkId: "a_same_confidence_higher_score",
      sourceId: "source_a",
      collection: "factions",
      regionIds: ["region_sort"],
      content: "同置信较高分。",
      source: PRIVATE_EXTERNAL_SOURCE,
      visibility: {
        scopes: ["region"],
        legalAccess: "source-bound",
        regionIds: ["region_sort"],
      },
      score: 0.8,
    }, {
      chunkId: "c_fact_high_confidence",
      sourceId: "source_c",
      collection: "rules",
      regionIds: ["region_sort"],
      content: "事实最高置信。",
      source: PRIVATE_EXTERNAL_SOURCE,
      visibility: {
        scopes: ["region"],
        legalAccess: "source-bound",
        regionIds: ["region_sort"],
      },
      score: 0.1,
    }],
  });

  assert.deepEqual(view.hits.map((hit) => hit.id), [
    "knowledge:c_fact_high_confidence",
    "knowledge:a_same_confidence_higher_score",
    "knowledge:b_same_confidence_lower_score",
  ]);
});

test("buildKnowledgeState ignores invalid records and normalizes malformed source and visibility input", () => {
  const state = buildKnowledgeState([
    { id: "", kind: "fact", text: "missing id" },
    { id: "missing_text", kind: "fact", text: "   " },
    { id: "invalid_kind", kind: "not_a_kind", text: "bad kind" } as unknown as EpochKnowledgeInputItem,
    {
      id: "normalized",
      kind: "claim",
      text: "畸形输入会被稳定归一化。",
      source: {
        sourceId: "source_normalized",
        trustClass: "not_trusted" as never,
        sourceAuthority: "not_authority" as never,
        channel: "not_channel" as never,
        hop: 99,
        confirmationBias: 2,
      },
      visibility: {
        scopes: ["not_scope" as never],
        legalAccess: "not_access" as never,
      },
    },
  ]);

  assert.deepEqual(state.records.map((record) => record.id), ["normalized"]);
  assert.deepEqual(state.byId.normalized.evidence.sourceChain[0], {
    sourceId: "source_normalized",
    trustClass: "untrusted_client",
    sourceAuthority: "low-confidence",
    channel: "unknown",
    hop: 16,
    evidenceIds: [],
    confirmationBias: 1,
  });
  assert.deepEqual(state.byId.normalized.visibility, {
    scopes: ["public"],
    legalAccess: "source-bound",
    regionIds: [],
    organizationIds: [],
    agentIds: [],
    explorerIds: [],
    evidenceIds: [],
  });
});
