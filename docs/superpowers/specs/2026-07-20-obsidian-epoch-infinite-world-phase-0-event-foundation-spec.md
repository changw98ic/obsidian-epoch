# 《黑曜纪元》无限世界 Phase 0：事件基础实现规范 v0.1

状态：Draft

日期：2026-07-20

上位规范：`2026-07-20-obsidian-epoch-infinite-world-causal-core-spec.md`

配套文件：

- `2026-07-20-obsidian-epoch-infinite-world-phase-0-event-foundation-test-spec.md`
- `2026-07-20-obsidian-epoch-causal-schema-registry-v1.json`

## 0. 实施结论

Phase 0 不实现 NPC 心智、动态经济或任务生成。它只建立后续系统必须共同使用的写入边界：

```text
Command / Scheduled Intent
-> Normalize
-> Schema Validate
-> Authorization Validate
-> Causality Validate
-> Invariant Validate
-> Idempotency Resolve
-> Append One Atomic Event Bundle
-> Project
-> Return Durable Result Manifest
```

核心决定：

1. 不重写既有 canonical history。
2. 旧事件通过只读兼容适配器形成 `LegacyCausalView`。
3. 新因果事件必须使用 `CausalWorldEventV1`。
4. 一个命令的全部 canonical effects 放入一个原子事件 bundle。
5. 任何已提交错误通过补偿事件修正，不做历史回滚。
6. 校验按 `observe -> warn -> block` 分阶段启用。
7. Phase 0 不引入新第三方依赖。

## 1. 范围

Phase 0 交付：

- `CausalWorldEventV1` 事件契约。
- `CausalEffectV1` effect 契约。
- `CommandIntentV1` 与 `CommandResultManifestV1`。
- Schema Registry 和版本哈希。
- 事件类型注册、未知事件治理和 enforcement mode。
- 幂等键、输入哈希和重复结果复用。
- 父因果、根事件和孤儿 effect 校验。
- 可替代资源守恒和唯一物产权属校验。
- 授权引用与可见性策略引用。
- 确定性证明字段和 replay 约束。
- 旧账本只读适配。
- 错误码、指标、灰度上线和回滚规则。

Phase 0 不交付：

- 新任务玩法。
- 新 NPC 决策算法。
- 完整买卖盘、信贷、案件或谣言系统。
- 全历史存储分区和高可用切换。
- 对现有每一种 legacy event 的语义补全。
- 任何旧事件的批量覆盖或重写。

## 2. 兼容策略

### 2.1 旧事件不迁移

既有事件保持字节级不变。禁止为了满足新 schema：

- 修改旧 JSONL 行。
- 重新分配旧 event ID。
- 猜测旧事件不存在的 causal parent。
- 根据当前规则重新计算旧结果。
- 生成伪造的 root pressure。

### 2.2 LegacyCausalView

旧事件在读取时可以转换为非权威视图：

```ts
type LegacyCausalView = {
  originalEventId: string;
  originalEventType: string;
  sourceLedger: string;
  sourcePosition: string;
  inferredWorldId?: string;
  inferredActorRefs: string[];
  inferredSubjectRefs: string[];
  inferredWorldMinute?: number;
  knownParentEventIds: string[];
  causalStatus:
    | "legacy_attributed"
    | "legacy_partially_attributed"
    | "legacy_unattributed";
  adapterVersion: string;
  warnings: string[];
};
```

该视图只能用于：

- 投影补充。
- RAG 来源说明。
- 迁移分析。
- 可观测性统计。
- 新事件引用旧事实。

它不能作为一条新 canonical event 再次写入。

### 2.3 新旧边界

- 新事件可以把旧 event ID 作为 causal parent 或 evidence ref。
- 旧事件不能被要求反向引用未来的新事件。
- 新事件引用 `legacy_unattributed` 事件时，必须增加至少一个直接 evidence ref 或授权 root reason。
- 新系统不得因为旧数据不完整而阻止旧世界只读启动。
- 新写入是否阻断由事件类型和 writer route 的 enforcement mode 决定。

## 3. CommandIntentV1

所有需要改变世界的外部命令、后台调度和管理动作先标准化为：

```ts
type CommandIntentV1 = {
  commandId: string;
  commandType: string;
  commandSchemaVersion: "1.0.0";
  worldId: string;
  namespace: "world" | "lineage" | "identity" | "run";
  actor: ActorRef;
  submittedAt: string;
  requestedWorldMinute?: number;
  idempotencyKey: string;
  expectedStreamVersions: StreamVersionExpectation[];
  authorizationRefs: string[];
  causalParentEventIds: string[];
  rootPressureIds: string[];
  rootReason?: RootReason;
  payload: Record<string, unknown>;
};
```

标准化后计算：

```text
inputHash = sha256(canonicalJson(command intent 中除 submittedAt 外的稳定业务字段))
```

`submittedAt` 不参与业务输入哈希，防止同一重试产生不同结果。

## 4. CausalWorldEventV1

```ts
type CausalWorldEventV1 = {
  eventId: string;
  eventType: string;
  schemaVersion: "1.0.0";
  registryVersion: string;
  registryHash: string;

  worldId: string;
  namespace: "world" | "lineage" | "identity" | "run";
  stream: {
    streamType: string;
    streamId: string;
    streamVersion: number;
  };

  occurredAtWorldMinute: number;
  recordedAt: string;
  actorRefs: ActorRef[];
  subjectRefs: EntityRef[];
  regionRefs: string[];

  command: {
    commandId: string;
    commandType: string;
    idempotencyKey: string;
    inputHash: string;
  };

  causality: {
    causalParentEventIds: string[];
    rootPressureIds: string[];
    rootReason?: RootReason;
  };

  authorizationRefs: string[];
  evidenceRefs: string[];
  visibilityPolicyRef: string;

  versions: {
    rulesetVersion: string;
    contentVersion: string;
    adjudicatorVersion: string;
    adapterVersion?: string;
  };

  determinism: {
    seed?: string;
    algorithmId: string;
    algorithmVersion: string;
  };

  payload: Record<string, unknown>;
  effects: CausalEffectV1[];

  proof: {
    payloadHash: string;
    effectsHash: string;
    eventHash: string;
  };
};
```

### 4.1 字段要求

- `eventType` 必须存在于 Schema Registry。
- `streamVersion` 从 1 开始连续增加。
- `occurredAtWorldMinute` 必须大于等于该 stream 上一事件的世界时间。
- `recordedAt` 只表示真实写入时间，不参与游戏世界因果排序。
- `commandId + inputHash` 必须能定位本次命令的稳定输入。
- `effects` 可以为空，但事件类型必须在 registry 中声明允许空 effect。
- `payload` 解释发生了什么，`effects` 描述权威状态如何改变。
- effect 顺序是事件语义的一部分，重放不得重新排序。

### 4.2 canonical JSON

哈希前使用统一序列化：

- 对象 key 按 Unicode code point 升序。
- 数组保持原顺序。
- 忽略 `undefined`，拒绝函数、symbol、`NaN` 和无穷值。
- 世界数值使用整数或十进制字符串，不使用浮点近似表示货币和资源。
- 字符串保持 UTF-8，不做环境相关格式化。
- 时间戳统一 ISO 8601 UTC。
- `eventHash` 计算时排除 `proof.eventHash` 自身。

## 5. 引用类型

```ts
type ActorRef = {
  actorType: "player_identity" | "npc" | "household" | "organization" | "system";
  actorId: string;
};

type EntityRef = {
  entityType: string;
  entityId: string;
};

type RootReason =
  | "world_genesis"
  | "external_clock"
  | "deterministic_schedule"
  | "content_migration"
  | "authorized_admin_correction"
  | "external_verified_input";
```

`system` actor 必须携带可识别的 scheduler、migration、maintenance 或 adjudicator ID，禁止使用无身份的通用 `system`。

## 6. CausalEffectV1

```ts
type CausalEffectV1 = {
  effectId: string;
  effectType:
    | "resource_ledger"
    | "unique_item_lifecycle"
    | "ownership_interest"
    | "state_transition"
    | "relationship_delta"
    | "knowledge_delta"
    | "pressure_delta"
    | "legal_delta"
    | "world_predicate";
  targetRef: EntityRef;
  operation: string;
  beforeRef?: string;
  after: Record<string, unknown>;
  sourceEventIds: string[];
  authorizationRefs: string[];
};
```

### 6.1 原子 effect bundle

一个 `CausalWorldEventV1` 是最小 canonical commit 单元：

- 事件内所有 effects 全部可应用，事件才允许 append。
- 任一 effect 校验失败，整条事件拒绝。
- append 成功后，不允许只回滚其中部分 effect。
- 投影应用中途崩溃时，通过同一 event ID 幂等重放整个 bundle。
- 需要逆转时追加 compensation event，引用原事件和被补偿 effect。

### 6.2 state transition

状态迁移 effect 必须包含：

```ts
type StateTransitionAfter = {
  stateMachineId: string;
  fromState: string;
  toState: string;
  transitionId: string;
  reasonCode: string;
};
```

`fromState` 必须与写入时权威投影一致，否则返回 stream/version conflict。

### 6.3 world predicate

任务目标不得只写自然语言。`world_predicate` 至少包含：

```ts
type WorldPredicateAfter = {
  predicateId: string;
  subjectRef: EntityRef;
  operator: "eq" | "neq" | "gte" | "lte" | "contains" | "exists" | "state_is";
  expectedValue: unknown;
  evaluationStatus: "true" | "false" | "unknown";
  evaluatedAtWorldMinute: number;
};
```

## 7. 可替代资源守恒

### 7.1 ResourceLedgerEffect

```ts
type ResourceLedgerEffect = {
  effectType: "resource_ledger";
  resourceKey: string;
  unit: string;
  entries: Array<{
    accountRef: string;
    quantityMinor: string;
  }>;
  creationSourceRef?: string;
  destructionSinkRef?: string;
};
```

规则：

- `quantityMinor` 是十进制整数字符串。
- 正数表示账户增加，负数表示账户减少。
- 普通转移要求所有 entries 总和为 0。
- 总和大于 0 时必须存在 registry 允许的 `creationSourceRef`。
- 总和小于 0 时必须存在 registry 允许的 `destructionSinkRef`。
- 同一 effect 只能处理一个 `resourceKey + unit`。
- 账户余额不得低于 0，除非账户 schema 明确声明信用额度。
- 冻结不是资源销毁，而是同一 owner 的 available 到 reserved 转移。

### 7.2 允许的来源与去向

首版来源：

- `harvest`
- `production`
- `authorized_currency_issuance`
- `ecological_regeneration`
- `recovery_compensation`
- `content_migration`

首版去向：

- `consumption`
- `crafting_waste`
- `durability_loss`
- `tax_sink`
- `authorized_currency_retirement`
- `ecological_decay`
- `content_migration`

每个 source/sink 必须在 registry 中声明允许的资源类别和所需 evidence。

## 8. 唯一物品与产权

### 8.1 UniqueItemLifecycleEffect

唯一物品状态：

```text
planned -> created -> active -> damaged -> repaired
active | damaged -> consumed | destroyed | archived
```

规则：

- `created` 必须引用配方、生产事件、迁移或授权生成来源。
- 一个 active item 同时只能有一个 title owner。
- possession、custody、lease、lien 和 seizure 可与 title owner 不同。
- 转移 title 不会自动清除有效 lien、lease 或 seizure。
- destroyed item 不得再次转移；恢复必须创建新的 lifecycle event 和合法机制。
- 堆叠资源与唯一物品禁止在同一字段中混用。

### 8.2 OwnershipInterestEffect

产权 effect 必须声明：

- `interestType`
- `holderRef`
- `itemRef`
- `validFromWorldMinute`
- `validUntilWorldMinute`
- `basisEventIds`
- `priority`
- `transferable`

产权冲突由 validator 拒绝或进入显式 dispute，不得以最后写入覆盖。

## 9. 因果与孤儿校验

### 9.1 普通事件

普通事件必须满足：

- 至少一个 causal parent。
- 如果属于任务、行动或制度后果，至少一个 root pressure。
- 每个 effect 的 `sourceEventIds` 非空，且是父事件、同事件命令来源或 registry 允许的直接依据。
- 父事件必须属于同一 world，跨 world 只能作为 evidence，不能作为直接因果父项。

### 9.2 根事件

仅 registry 明确允许的事件可无父事件，并且必须携带：

- 允许的 `rootReason`。
- 对应 authorization 或 scheduler identity。
- 外部输入、迁移包或时钟证据。
- 确定性算法版本。

`world_pressure_opened` 默认不是根事件，它必须引用产生压力的事实。

### 9.3 环与时间旅行

- 因果图必须无环。
- event 不得引用尚不存在的未来 event ID。
- 时间能力产生 forecast、branch observation 或新状态，不得把未来预测伪装成已发生父事件。
- 补偿事件引用原事件，但不会让原事件失效；投影根据补偿语义计算当前状态。

## 10. 幂等契约

### 10.1 Scope

```text
idempotencyScope = worldId + commandType + actorRef + idempotencyKey
```

### 10.2 行为

| 情况 | 结果 |
|---|---|
| scope 不存在 | 正常校验和执行 |
| scope 存在且 inputHash 相同 | 返回原 result manifest，不追加事件 |
| scope 存在但 inputHash 不同 | 拒绝 `IDEMPOTENCY_CONFLICT` |
| 首次执行未 append | 可安全重试 |
| 已 append 但响应丢失 | 重试返回原 event IDs |
| 投影尚未追上 | 返回 durable success，并标记 projection lag |

幂等索引与 canonical history 同寿命。历史分区后至少保留 scope、inputHash、result manifest hash 和 event IDs。

### 10.3 后台调度键

后台任务禁止使用当前时间随机生成幂等键。使用：

```text
scheduleId + dueWorldMinute + targetStreamId + algorithmVersion
```

## 11. Schema Registry

Registry 是代码与数据共同遵守的版本化契约，不是世界事实本身。

每个 event type 注册：

- event family。
- 当前 schema version。
- payload validator ID。
- 允许的 namespaces。
- 是否允许 empty effects。
- 允许的 effect types。
- 是否要求 root pressure。
- 是否允许成为 root event。
- 允许的 root reasons。
- 需要的 authorization policy。
- enforcement mode。
- successor event type 或 migration policy。

Registry 文件计算 canonical hash，并写入每条新事件。运行时只允许加载启动时已验证的 registry 版本。

### 11.1 enforcement mode

| 模式 | 行为 |
|---|---|
| `observe` | 写入不阻断，记录所有违反项 |
| `warn` | 非 correctness 问题允许写入，响应附 warning |
| `block` | 任一 registry hard validator 失败即拒绝 |
| `retired` | 禁止新写入，只允许 replay |

以下错误在所有模式下都不得写入新的 `CausalWorldEventV1`：

- 无法序列化。
- event ID 或 command ID 缺失。
- event hash 不一致。
- 同幂等键不同 input hash。
- stream version 已被占用。

## 12. 授权与可见性

Phase 0 不重新设计授权系统，只建立引用边界：

- 产生人物、组织、产权、隐私或法律 effect 时必须携带 authorization ref。
- root admin correction 必须引用具名管理员身份、原因和 evidence。
- authorization validator 在写入时读取权威授权投影。
- authorization 过期后不能用于新事件，但不影响过去事件合法性。
- `visibilityPolicyRef` 决定投影和 RAG 暴露范围，不影响 canonical event 是否存在。
- 权限不足的读取不得通过错误信息泄露目标是否存在。

## 13. 确定性与 replay

### 13.1 确定性输入

裁定结果只能依赖：

- CommandIntentV1 稳定字段。
- 被引用的 canonical state version。
- 注册的 ruleset/content/adjudicator 版本。
- 显式 deterministic seed。
- 服务端固定排序规则。

不得依赖：

- 本地时区。
- 对象遍历偶然顺序。
- 未写入事件的外部 API 响应。
- 当前进程随机数。
- LLM 再次调用结果。
- 浮点平台差异。

LLM proposal 如果被采用，其原始 proposal hash、模型上下文版本和最终服务端裁定必须写入 evidence 或 payload；replay 使用已提交结果，不重新调用 LLM。

### 13.2 projection contract

- 投影器按 event ID 和 stream version 幂等应用。
- 同一 event 重复投影不得重复增减资源。
- 未识别 event type 时停止对应 hard projection，并暴露 lag；不得静默跳过后声称 ready。
- 非关键展示投影可以降级，但必须暴露 freshness。

## 14. 写入协议

```text
1. normalize command
2. compute input hash
3. resolve idempotency
4. load expected stream versions
5. authorize
6. build event candidate
7. validate schema and registry
8. validate causality and invariants
9. compute proof hashes
10. atomically append event and idempotency result
11. enqueue projection/outbox work
12. return durable result manifest
```

### 14.1 成功定义

只有步骤 10 完成后才能返回 canonical success。

```ts
type CommandResultManifestV1 = {
  commandId: string;
  idempotencyKey: string;
  inputHash: string;
  status: "committed" | "rejected";
  eventIds: string[];
  eventHashes: string[];
  committedAt: string;
  projectionStatus: "current" | "pending" | "degraded";
  warnings: string[];
};
```

### 14.2 外部副作用

邮件、通知、embedding、文件导出等外部副作用必须使用 outbox：

- 先提交 canonical event 和 outbox intent。
- worker 按 outbox ID 幂等执行。
- 失败可重试。
- 外部成功或永久失败追加结果事件或更新可重建投影。
- 禁止在 canonical append 之前把外部成功当作世界事实。

## 15. 错误契约

| 错误码 | 是否可重试 | 含义 |
|---|---|---|
| `CAUSAL_SCHEMA_UNKNOWN` | 否 | event type 未注册 |
| `CAUSAL_SCHEMA_INVALID` | 否 | envelope 或 payload 不合法 |
| `CAUSAL_PARENT_MISSING` | 条件性 | 父事件不存在或不可用 |
| `CAUSAL_CYCLE_DETECTED` | 否 | 因果环 |
| `ROOT_REASON_DENIED` | 否 | 非法根事件 |
| `ROOT_PRESSURE_REQUIRED` | 否 | 任务/行动缺少根压力 |
| `ORPHAN_EFFECT` | 否 | effect 无合法来源 |
| `RESOURCE_UNBALANCED` | 否 | 资源总账不平 |
| `RESOURCE_SOURCE_DENIED` | 否 | 未授权生成来源 |
| `RESOURCE_SINK_DENIED` | 否 | 未授权销毁去向 |
| `NEGATIVE_BALANCE` | 条件性 | 余额或信用不足 |
| `OWNERSHIP_CONFLICT` | 条件性 | 唯一产权冲突 |
| `AUTHORIZATION_DENIED` | 否 | 无权执行 |
| `STREAM_VERSION_CONFLICT` | 是 | 状态已变化，需重新规划 |
| `IDEMPOTENCY_CONFLICT` | 否 | 相同 key 使用不同输入 |
| `DETERMINISM_PROOF_FAILED` | 否 | 哈希或版本不一致 |
| `REGISTRY_VERSION_UNAVAILABLE` | 是 | registry 未加载 |
| `CANONICAL_APPEND_FAILED` | 是 | 未确认持久化成功 |
| `PROJECTION_LAGGING` | 是 | 事件已提交但投影未追上 |
| `LEGACY_ADAPTER_FAILED` | 否 | 旧事件无法形成只读视图 |

错误响应不得伪造 canonical success。重试前必须根据 `retryable` 和幂等键判断。

## 16. 指标与审计

Phase 0 新增：

- `causal_write_total{event_type,result}`
- `causal_validation_failure_total{validator,error_code,event_type}`
- `causal_enforcement_observation_total{event_type,violation}`
- `causal_orphan_effect_total{event_type}`
- `causal_missing_parent_total{event_type}`
- `causal_idempotency_replay_total{command_type}`
- `causal_idempotency_conflict_total{command_type}`
- `causal_resource_violation_total{resource_key}`
- `causal_ownership_conflict_total{item_type}`
- `causal_projection_lag_events{projection}`
- `causal_legacy_unattributed_total{legacy_type}`
- `causal_registry_hash_mismatch_total`

审计读取模型至少支持按 command ID、event ID、stream、root pressure、actor、resource account 和 enforcement violation 查询。

## 17. 建议模块边界

实现阶段建议新增：

```text
tools/agent-server/lib/epoch/causalContracts.ts
tools/agent-server/lib/epoch/causalCanonicalJson.ts
tools/agent-server/lib/epoch/causalSchemaRegistry.ts
tools/agent-server/lib/epoch/causalInvariantRules.ts
tools/agent-server/lib/epoch/causalResourceRules.ts
tools/agent-server/lib/epoch/causalIdempotencyRules.ts
tools/agent-server/lib/epoch/causalWriteCoordinator.ts
tools/agent-server/lib/epoch/legacyCausalAdapter.ts
```

边界要求：

- contracts 不依赖 gameCore。
- registry 不读取 mutable gameplay state。
- invariant rules 是纯函数，输入 candidate event 和权威快照。
- write coordinator 负责执行顺序，不包含领域评分公式。
- legacy adapter 只读，禁止调用 append。
- gameCore 通过 adapter 调用 coordinator，不自行复制校验逻辑。

## 18. 上线阶段

### R0：合同冻结

- 合并 schema、registry、错误码和测试规范。
- 不接入生产写入。

### R1：Shadow observe

- 对选定 legacy writer 构造 candidate event，但不替代原写入。
- 比较新旧结果，记录违反项。
- 不产生双份 canonical event。

### R2：新事件 observe

- 新 Phase 1 event type 使用 CausalWorldEventV1。
- 非底层格式错误只观测，不阻断业务。

### R3：按事件族 block

- 先阻断 system test event。
- 再阻断 pressure、belief、order 等全新事件族。
- legacy event type 保持原路径，直到专门迁移。

### R4：legacy writer adapter

- 一次迁移一个 writer route。
- 同一路由禁止长期双写两个权威事件。
- 指标稳定且 replay 一致后再进入下一个路由。

### R5：全新写入默认 block

- 未注册 event type 禁止进入 canonical ledger。
- legacy 只允许 replay 或明确白名单维护。

## 19. 回滚策略

- registry enforcement 可从 `block` 降回 `warn`，但不能让格式损坏、幂等冲突或哈希错误通过。
- 新 writer 可切回 legacy writer，但禁止删除已经写入的新事件。
- 新 projection 可丢弃并从 canonical events 重建。
- registry 版本不得原地修改；修复时发布新版本。
- 因错误规则写入的合法事件使用 compensation event，不篡改历史。

## 20. Definition of Done

Phase 0 完成必须满足：

1. 三个核心契约拥有运行时 validator。
2. Registry hash 可重现，并写入所有新事件。
3. 同幂等键同输入永远返回同一 result manifest。
4. 同幂等键不同输入永远拒绝。
5. 普通转移资源总和必须为零。
6. 资源生成和销毁必须由 registry 授权。
7. 唯一物品不能出现两个 title owner。
8. effect 无来源、父事件缺失和因果环能够被阻断。
9. append 前失败不产生 canonical effect。
10. append 后进程崩溃可以通过 replay 恢复投影。
11. 旧事件不被改写，旧世界仍可启动和读取。
12. 新事件 replay 不调用 LLM 或外部 API。
13. 所有错误使用稳定错误码并标明 retryable。
14. 测试规范中的 P0 阻断项全部通过。
15. 观测期不存在未解释的资源守恒和幂等冲突。

## 21. Phase 0 后才能开始的工作

以下功能必须依赖本阶段合同，不得提前创建独立写入通道：

- WorldPressure 状态机。
- ActorGoal 与 Commitment。
- Observation、Claim、Belief 和 Rumor。
- 统一库存、买单、工单、运输和信用。
- 案件、政策和 consent。
- pressure-derived opportunity。
- lineage project。

这些领域可以增加自己的 payload 和 validator，但必须复用 envelope、effects、幂等、因果与写入协调器。
