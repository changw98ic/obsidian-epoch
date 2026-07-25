# Agent Strategy Game Loop v2.2 实现 Plan

依据：claudedocs/agent-strategy-game-loop-spec-v2.md。本文把 v2.2 作为唯一产品、数据和运行时契约，供实现、评审和测试直接执行。

文中的 file:line 是当前工作树的代码锚点；实现后行号会移动，但文件、符号和职责必须可追踪。新增文件用 file:1 标注。所有策略影响必须走“提示上下文 → agent 行为 → server 物理裁决 → 后果 → ConsequenceScore → SettlementDecision”链路，评分和奖励函数不得直接增加 affinity bonus。

## 0. 已锁定的不变量

- Phase 6 matrix 直接改写，不新建 gameMode；历史数据复制为只读归档并保留原记录。
- 策略可以间接影响 tier、reward、worldCommit，但只能通过 agent 行为造成的物理后果。
- 评分由 consequence 驱动，不回到 affinity 加减。
- worldCommit 是二值阈值：主线完成且达到阈值才 solidify，否则 discarded。
- server 装 AI 是可选异步能力；无 AI、warmup、生成失败、限流或超时都必须能回退到 catalog/model_sampling。
- 任务和 action 的公开显示为零加成、零数值优化信息。
- 主策略正常权重 100%；本局完全违背 primary 时使用 primary 3、副策略 7 的冻结分类；本局内不改变。
- 任务市场与悬赏市场独立。
- 身份扮演评分来自 ExpectedLifePattern、生活策略和 NPC 质疑，不能退化成 affinity 加减。
- 数值结局只在 result page 一次性呈现；进行中、实时 console、action 选择、任务市场不暴露 score、tier、reward modifier、worldCommit threshold。
- mirror consequence ledger 是镜像阶段唯一的可晋升后果账本；discard 不产生 canonical world effect，solidify 一次性幂等晋升。
- ConsequenceScore 与 SettlementDecision 各只有一个派生入口；其他层只能读取。
- canonical world effects 跨身份连续；standing、wanted、exposed、NPC doubt 等身份状态按生命周期重置，明确的同阵营继承例外除外。
- agent feedback 必须闭环到下一次 prompt，但只以非数值世界信号呈现。

## 1. 当前代码基线

### 1.1 领域和生命周期

- 身份投影与事件应用：tools/agent-server/lib/epoch/gameCore.ts:598-618、3042-3068、6147-6172。
- 身份输入和 runtime 门面：tools/agent-server/lib/epoch/gameCore.ts:1838-1844；tools/agent-server/lib/epoch/runtime.ts:1482-1540、1617-1632。
- journey 状态、task plan 安装和 world commit：tools/agent-server/lib/epoch/journeyRules.ts:47-60、124-162、447-527；tools/agent-server/lib/epoch/journeyRuntime.ts:388-529、599-609。
- action 解析、scene contract、hosted submit：tools/agent-server/lib/epoch/journeyActionResolutionRules.ts:84-149、287-407；tools/agent-server/lib/epoch/journeySceneContractRules.ts:59-111、585-695、783-900；tools/agent-server/lib/epoch/gameCore.ts:9577-9806。

### 1.2 任务、Phase 6 和 receipt

- task plan、hidden seal、action 校验、catalog fallback：tools/agent-server/lib/epoch/journeyGeneratedTaskRules.ts:44-139、620-710、970-1050、1510-1645。
- Phase 6 matrix、实验状态、receipt、十轮 gate：tools/agent-server/lib/epoch/phase6ScenarioMatrixRules.ts:19-42；tools/agent-server/lib/epoch/phase6ExperimentRules.ts:1-7、122-124、308-345；tools/agent-server/lib/epoch/journeyRunReceiptRules.ts:7-15、151-217、300-496；tools/agent-server/phase6-ten-run-evidence.ts:75-86、258-308；tools/agent-server/phase6-ten-run.ts:2395-2403。

### 1.3 结算、结果页和持久化

- 当前 settlement 汇总和奖励调用：tools/agent-server/lib/mcpTools.ts:2512-2620、2622-2761。
- 当前 world effect planner：tools/agent-server/lib/epoch/journeyWorldImpactRules.ts:47-149。它只能作为物理效果规划器，不能充当 ledger、评分或 worldCommit 判定器。
- event payload：tools/agent-server/lib/epoch/events.ts:158-186、1109-1141、1849-1935。
- story/result page：tools/agent-server/lib/epoch/journeyStoryReport.ts:62-157、582-635、893-1106；tools/agent-server/lib/epoch/resultPagePayloadRules.ts:145-239、249-420、461-673；tools/agent-server/lib/epoch/runtime.ts:817-946。
- JSONL/event 持久化入口：tools/agent-server/lib/store.ts:501-514；启动和维护：tools/agent-server/server.ts:28-178。

### 1.4 边界和测试

- MCP sampling：tools/agent-server/lib/mcpSampling.ts:19-75、94-233；tools/agent-server/lib/mcpSamplingSchemas.ts:1-286；tools/agent-server/mcp.ts:51-71。
- public/compact/action：tools/agent-server/lib/mcpTools.ts:8387-8468、8933-8996；相关测试为 agentCompanionPublicBoundary.test.ts、mcpSamplingSchemas.test.ts、mcp.test.ts、journeySceneContractRules.test.ts。
- 重点回归：journeyRules.test.ts、journeyWorldImpactRules.test.ts、journeyGeneratedTaskRules.test.ts、journeyActionResolutionRules.test.ts、journeyStoryReport.test.ts、resultPagePayloadRules.test.ts、identityLifecycleRules.test.ts、runtimeExplorerRegistration.test.ts、agentCompanionMcp.test.ts，以及所有 phase6* 测试。

## 2. 依赖和并行策略

~~~text
Step 1 domain contracts
   ├── Step 2 mirror ledger ─────┐
   ├── Step 3 offer/claim/plan ──┼── Step 4 ConsequenceScore/SettlementDecision
   └── Step 9 strategy contract ─┘       └── Step 5 tier/reward/binary worldCommit
                                                ├── Step 6 viability
                                                ├── Step 7 roleplay/doubt
                                                └── Step 8 hidden prerequisite
Step 6 + Step 7 + Step 8 + Step 9 ── Step 10 feedback
Step 2 + Step 6 + Step 8 ─────────── Step 11 cross-identity continuity
Step 4..11 ───────────────────────── Step 12 result page
Step 1 + Step 4 + Step 9 + Step 10 ─ Step 13 public/internal/signed action
Step 3 + Step 4 + Step 5 + Step 9 + Step 12 ─ Step 14 matrix/archive
Step 3 + Step 9 + Step 10 + Step 14 ─ Step 15 optional server AI
All previous steps ───────────────── Step 16 balance simulation gate
~~~

- Step 1 必须先完成并合并，是所有后续 PR 的 domain contract gate。
- Step 2、Step 3 在 Step 1 后可并行；Step 2 不依赖 offer，Step 3 不依赖 ledger。
- Step 6、7、8、9 可在 Step 5 的 SettlementDecision 接口冻结后并行开发；规则测试可并行，但集成仍按 §12 的 6→7→8→9 合并。
- Step 10 等 Step 7、9 输入字段稳定后开始；Step 11 等 Step 2、6、8 的 world/identity 语义稳定后开始。
- Step 12、13 可并行实现，但必须共享相同的 public/internal/signed 契约，并在合入前完成交叉 leakage 回归。
- Step 14 的夹具可提前改，正式切换 matrix、receipt 和 archived state 必须在 Step 12/13 字段冻结后串行合入。
- Step 15 可选且可延后，必须先有可运行的 catalog fallback，不能使 AI 成为基础流程依赖。
- Step 16 是发布前串行 gate，不能和阈值、权重、matrix 或 AI provider 变更并行。

## 3. 按 v2.2 §12 的 16 步实施任务

## Step 1 — 冻结领域模型和版本契约

规范映射：v2.2 §12.1；v2.2 §2、§3、§4、§6、§9、§11。

执行性质：必须串行。

### 工程任务

1. 新建 tools/agent-server/lib/epoch/journeyStrategyRules.ts:1，定义 Strategy、StrategyProfile、IdentityStrategyDisposition、ApproachTag、StrategyConsistencyScore：

   - Strategy 为 combat、cunning、support、logistics、exploration。
   - StrategyProfile 包含 primary、secondary、settledAt、policyVersion。
   - IdentityStrategyDisposition 包含 primary、secondary、frozenAt、identityId、strategyPolicyVersion、affinityMatrixVersion。
   - ApproachTag 为 combat、stealth、diplomacy、support、logistics、scout、preservation；未知值 fail closed。
   - StrategyConsistencyScore 只记录 matchBps、snapshot、版本和本局分类，不包含 bonus。

2. 新建 tools/agent-server/lib/epoch/journeyOfferRules.ts:1，定义：

   - PublicQuestOffer：questOfferId、marketSnapshotVersion、taskTypeText、scenarioSummary、region、scenarioMapId、estimatedDifficulty、rewardPreview、expiresAt。
   - InternalQuestOffer：taskFamilyId、expectedApproach、offerHash、offerVersion、source、worldSliceHash、generationBatchId。
   - QuestOfferLifecycle：available、reserved、claimed、completed，并为 side offer 支持 expired、released。
   - OfferReservation、OfferClaim、MarketSnapshot、BountyListing；明确 task market 与 bounty market 不共享状态机。

3. 新建 tools/agent-server/lib/epoch/journeySettlementRules.ts:1，冻结：

   - MirrorConsequenceLedgerEntry：actionEventId、effectKind、targetEntityId、delta、consequenceType、sourceEventIds、effectBlueprint、recordedAt、dedupeKey。
   - ConsequenceBreakdown：resultScoreBps、selfLossScoreBps、collateralScoreBps、totalBps。
   - ConsequenceScore：breakdown、mainLineSucceeded、hiddenComplete、hiddenClamp、policyVersion。
   - SettlementDecision：score、tier、reward、worldCommit、hiddenClamp、policyVersion、settledAt。
   - WorldCommitDecision：canonEligible、thresholdBps、policyVersion、reason。

4. 新建 tools/agent-server/lib/epoch/journeyViabilityRules.ts:1 和 tools/agent-server/lib/epoch/journeyRoleplayRules.ts:1，冻结 IdentityViability、ExpectedLifePattern、RoleplayScore、HiddenPrerequisiteLink。HiddenPrerequisiteLink 的 status 只有 intact、destroyed、degraded，并可记录 destroyedAtActionEventId。

5. 扩展既有输入和 projection，不另起 identity：

   - tools/agent-server/lib/epoch/gameCore.ts:598-618 的 EpochAgentIdentity 加入 strategyDisposition、expectedLifePattern、identityViability。
   - tools/agent-server/lib/epoch/gameCore.ts:1838-1844 的 IssueIdentityInput 加入 StrategyProfile/identity policy 输入。
   - tools/agent-server/lib/epoch/journeyGeneratedTaskRules.ts:44-116 的 JourneyTaskRequest、JourneyGeneratedTaskAction、JourneyTaskPlanInstallation 加入 taskFamilyId、questOfferId、offerHash、approachTags、expectedApproach。
   - tools/agent-server/lib/epoch/journeyRules.ts:47-60、124-162 的 world commit/journey projection 加入 score、threshold、policyVersion、offer binding。
   - tools/agent-server/lib/epoch/events.ts:158-186、1109-1141、1849-1935 加入版本化 payload 和新 event kind，明确 required/optional 兼容策略。

6. 固定 STRATEGY_POLICY_VERSION、CONSEQUENCE_SCORE_POLICY_VERSION、SETTLEMENT_POLICY_VERSION、VIABILITY_POLICY_VERSION、ROLEPLAY_PATTERN_VERSION、OFFER_SCHEMA_VERSION。版本必须进入 receipt、world-solidified marker、identity payload 或 settlement record。

### 前置依赖

无。实现时不覆盖工作树中已有的 spec、review、AGENTS.md、CLAUDE.md 或其他用户改动。

### 验收

- 新增 journeyStrategyRules.test.ts、journeyOfferRules.test.ts、journeySettlementRules.test.ts、journeyViabilityRules.test.ts、journeyRoleplayRules.test.ts 的类型和纯函数基础测试。
- unknown Strategy、ApproachTag、offer status、hidden status 均拒绝或 fail closed。
- 新增规则测试和 npm run typecheck 通过。
- PublicQuestOffer 没有 taskFamilyId、strategyAffinity、fitBps、expectedApproach、bonus marker；SettlementDecision 没有 strategy bonus 字段。
- 事件、runtime input、public result 类型可以在不使用显式 any 的情况下完成窄化。

### 风险

- v2.2 §14：后果归因、阈值校准和 ExpectedLifePattern 质量会在后续放大；本步以版本化、单一数据形状和 fail closed 降低漂移。
- affinity 矩阵不得进入公开类型，也不得设计成评分输入。

## Step 2 — 建立 mirror consequence ledger

规范映射：v2.2 §12.2；v2.2 §6.1、§6.3、§7。

执行性质：依赖 Step 1；与 Step 3 可并行，必须先于 Step 4 集成。

### 工程任务

1. 新建 tools/agent-server/lib/epoch/journeyMirrorLedger.ts:1，实现 appendMirrorConsequence、listMirrorConsequences、discardMirrorConsequences、promoteMirrorConsequences、assertNoDuplicatePromotion。

   - append 按 dedupeKey/actionEventId 幂等。
   - promote 在单一事务内把 effectBlueprint 转为 canonical epoch events，并写 promotion marker。
   - canonical event ID 从 actionEventId/dedupeKey 稳定派生。

2. 区分两类记录：

   - resource_spent、lifetime_adjusted 等真实已发生的 self-loss 使用现有 event 作为唯一 canonical source，无论本局是否 solidify 都保留。
   - region influence、trace、faction/NPC relation、object mutation/destroy、npc_identity_doubt 等 collateral 在 mirror 中暂存，只有 solidify 才进入 world。

   不得把 resourceCost、resource_spent、HostedActionRecordedPayload.lifetimeDelta、lifetime_adjusted 重复计入 ledger 后再次计分。

3. 改 tools/agent-server/lib/epoch/gameCore.ts:9577-9806 的 submitHostedAction：

   - 保留签名验证和 resolveJourneyAction。
   - 每个 actionEventId 只调用一次物理效果规划器；把 tools/agent-server/lib/epoch/journeyWorldImpactRules.ts:47-149 的输出转成 ledger effectBlueprint，不直接写 canonical world event。
   - roleplay doubt、hidden object mutation 和普通 world impact 统一挂入 ledger，保留 effectKind/consequenceType。

4. 改 tools/agent-server/lib/epoch/journeyReadModel.ts:10-67、tools/agent-server/lib/epoch/journeyRuntime.ts:850-871：

   - ledger append、discard、promotion marker 纳入可重放 runtime event/snapshot。
   - 重启恢复未结算 ledger；同一个 actionEventId 重放不产生第二条 entry。
   - tools/agent-server/lib/epoch/journeyRuntime.ts:219-343 的 grounded episode 检查允许 ledger evidence，但 canonical effect 在 mirror 中仍不可见。

5. 改 tools/agent-server/lib/epoch/gameCore.ts:9809-10098 的 solidifyJourneyWorld：

   - 删除结算时重新按 objective/risk 推导世界效果的第二套路径。
   - 读取并验证 ledger，调用 promoteMirrorConsequences；promotion marker 与 canonical effects 原子提交。
   - discard 只记录 discarded marker，不调用 world effect event factory。

### 前置依赖

Step 1 的 ledger、world commit、event version 类型。

### 验收

- 新增 journeyMirrorLedger.test.ts：

  - 相同 actionEventId 重复 append 只有一条。
  - 相同 dedupeKey 不会重复晋升。
  - discard 后没有 canonical world effect。
  - solidify 重试只有一套 canonical event。
  - 重启恢复 ledger，promotion marker 阻止二次晋升。

- 扩展 agentCompanionMcp.test.ts、journeyPersistence.test.ts、journeyRuntime.test.ts，验证镜像有物理后果、discard 无 world effect、solidify 有 world effect。
- journeyWorldImpactRules.test.ts 继续验证 effect planner；ledger 测试验证 planner 不直接改变 canonical state。
- typecheck、定向 journey 测试和 npm test 通过。

### 风险

- v2.2 §14：后果归因是主要风险。每条 entry 必须带 actionEventId、sourceEventIds 和 effectKind。
- 不实现 delayed consequences；本步只保存当前 action 已产生的 immediate effect。

## Step 3 — 任务市场、offer 持久化、并发和 offer 到 plan 的绑定

规范映射：v2.2 §12.3；v2.2 §4.1-§4.6、§10.1。

执行性质：依赖 Step 1；与 Step 2 可并行，必须在 Step 4 结算前完成 source binding。

### 工程任务

1. 新建 tools/agent-server/lib/epoch/journeyOfferStore.ts:1：

   - 定义 JourneyOfferRepository/QuestOfferStore。
   - 按 tools/agent-server/lib/store.ts:501-514 的 JSONL/event persistence 约定持久化 offers、reservations、claims、generation batches。
   - 启动重放 available/reserved/claimed 状态，保留 offerHash、marketSnapshotVersion、worldSliceHash、policy version。
   - reservation 用 TTL、owner token、CAS；claim 用 idempotency key。

2. 新建或扩展 tools/agent-server/lib/epoch/journeyOfferRuntime.ts:1：

   - listAvailableQuestOffers、reserveQuestOffer、claimQuestOffer、completeQuestOffer、releaseOrExpireQuestOffer。
   - claim 一个 offer 后异步补两个；主 claim transaction 不等待生成，不做 rollback。
   - 默认 region pool 可用；生成失败从 catalog 取 grounded fallback。

3. 改 tools/agent-server/lib/mcpTools.ts:4794-4809、tools/agent-server/lib/epoch/journeyRuntime.ts:72-81、388-426：

   - prepare_journey 接收 questOfferId、offerHash、reservationToken、marketSnapshotVersion。
   - server 根据 offer 恢复 taskFamilyId、taskTypeText、scenarioMapId、expectedApproach，不接受 agent 伪造内部字段。
   - task request 同时保留内部 taskFamilyId 与公开 taskTypeText，公开结果不带内部字段。
   - 历史/归档 journey 只读兼容，不能用旧 taskType 绕过新 offer claim。

4. 改 tools/agent-server/lib/epoch/journeyRules.ts:509-527、:517-520：

   - 一致性锁从 taskType/scenarioMap 改为验证 questOfferId、offerHash、taskFamilyId、marketSnapshotVersion、worldSliceHash。
   - plan 生成后写 source binding；任何修改入口都先过 binding validator。
   - claim 后 main/side objective 数量固定，模型不能临时增加 numeric reward 或 hidden bonus。

5. 保留 tools/agent-server/lib/epoch/journeyGeneratedTaskRules.ts:970-1050 的 catalog lookup/buildFallbackJourneyTaskPlan 作为无 AI、AI degraded、生成校验失败的唯一安全 fallback。fallback 也生成 offerHash、taskFamilyId、worldSliceHash、expectedApproach 和 grounded checks。

6. 增加独立 BountyListing/BountyClaim handler。player exit tasks 进入 bounty market；agent entry journey 只读 quest market；两者 claim、reward、expiry 不互相推进。

### 前置依赖

Step 1 的 PublicQuestOffer、InternalQuestOffer、JourneyTaskRequest source binding 和版本字段。

### 验收

- 新增 journeyOfferRules.test.ts、journeyOfferStore.test.ts：

  - 并发 claim 只能成功一次。
  - reservation TTL 到期后可重新 reserve。
  - 同一 idempotency key 重试返回同一 claim。
  - claim 后异步 replenish 2，失败不回滚 claim。
  - 重启后 available/reserved/claimed 一致。
  - bounty 生命周期不改变 quest market。

- 扩展 journeyRuntime.test.ts、mcp.test.ts、agentCompanionMcp.test.ts：

  - 伪造 taskFamilyId/expectedApproach 被拒绝。
  - offerHash/worldSliceHash 不一致的 plan 被拒绝。
  - 无 AI 时 catalog fallback 完成 prepare_journey。

- public schema snapshot 确认 taskFamilyId、expectedApproach、affinity、fitBps 不出现在 market/prepare 公开返回。

### 风险

- v2.2 §14：叙事 grounding gate 是 offer 生成风险；四项 grounded checks 任一失败都走 fallback。
- 并发 claim 的重复奖励和重复 plan 必须以 CAS、TTL、幂等键解决。

## Step 4 — ConsequenceScore、SettlementDecision 和单点派生

规范映射：v2.2 §12.4；v2.2 §6.2-§6.4、§7。

执行性质：依赖 Step 1、Step 2；Step 3 的 offer binding 必须可读取；唯一派生入口必须串行建立。

### 工程任务

1. 在 tools/agent-server/lib/epoch/journeySettlementRules.ts:1 实现唯一入口 buildConsequenceScore、deriveSettlementDecision、settleJourney、replaySettlement。重放使用 persisted policy/version，不读当前默认值。

2. 定义 SettlementContext，包含：

   - main objective completion、requiredMainObjectiveIds、side/hidden objective state。
   - JourneyActionResolution 的实际 result/outcome/failure 和 physical completion evidence。
   - self-loss source events、mirror ledger entries、canonical action events。
   - ExpectedLifePattern、RoleplayScore、IdentityViability 当局快照。
   - strategyConsistency snapshot 作为审计字段，但不作为分数输入。

3. 固定三段 source of truth：

   - resultScoreBps：由 action resolution 和主/副目标物理结果派生。
   - selfLossScoreBps：对 resourceCost、resource_spent、HostedActionRecordedPayload.lifetimeDelta、lifetime_adjusted 按 event/action ID 去重。
   - collateralScoreBps：来自 ledger 的 object destruction、faction/NPC relation、hidden prerequisite destruction、identity viability、roleplay doubt/exposure。

4. 改 tools/agent-server/lib/mcpTools.ts:2512-2620 的 finalizeSettledMirrorWorld：

   - 删除直接读 performance.scoreBps 再计算 tier 的逻辑。
   - 先物理 adjudication，再调用 settleJourney。
   - 后续 runtime、MCP、story report 只读取 SettlementDecision，不再计算 score/tier/reward/worldCommit。
   - settlement record 绑定 journeyId、offerHash、policy versions、ledger digest，并幂等保存。

5. 改 tools/agent-server/lib/epoch/journeyGeneratedTaskRules.ts:1577-1645：adjudicateJourneyTask 只验证任务完成、hidden seal、物理证据和 objective 状态；旧 sideCount/hidden tier 逻辑移出最终决策。

### 前置依赖

Step 1 的 score/settlement 类型、Step 2 的 ledger digest/promotion marker。

### 验收

- 新增 journeyConsequenceRules.test.ts：

  - result/self-loss/collateral 各自可追溯。
  - 四种 self-loss 来源重复时只计一次。
  - 同一 settlement 重试结果相同。
  - 相同 policy version replay 得到相同 score/tier/reward/worldCommit。
  - 改 affinity matrix 或只改策略 prompt、但不改 physical consequence，结果不变。

- 扩展 agentCompanionMcp.test.ts、journeyActionResolutionRules.test.ts、journeyPersistence.test.ts，验证 source event ID 一致。
- 固定 fixture 检查 mcpTools、runtime、story report 都只读 SettlementDecision。
- typecheck 和 targeted tests 通过。

### 风险

- v2.2 §14：后果归因是最高优先级风险；所有 score component 必须有 source event/ledger entry 和 breakdown。
- 阈值和权重留给 Step 16 调平，本步先固定可审计接口。

## Step 5 — tier、reward modifier 和二值 worldCommit

规范映射：v2.2 §12.5；v2.2 §6.5-§6.7。

执行性质：依赖 Step 4，必须串行；Step 6-9 只能读取本步结果。

### 工程任务

1. 在 tools/agent-server/lib/epoch/journeySettlementRules.ts:1 完成 tier policy：

   - 未及格：totalBps 小于 4000 或主线未完成。
   - 及格：4000-5500。
   - 良好：5500-7000。
   - 优秀：7000-8500；hidden 未完成时最高优秀。
   - 惊世：至少 8500 且 hidden complete；只有 hidden complete 能触发惊世。
   - 主线未完成强制未及格；hidden incomplete 的 clamp 写入 hiddenClamp。
   - identity viability 在结算后投影，不回写当前分数。

2. 在同一 SettlementDecision 派生 reward：

   - 使用 tools/agent-server/lib/epoch/journeyGeneratedTaskRules.ts:207-232 的 JOURNEY_TIER_REWARDS 和 ITEM_REWARD_RARITY_BY_TIER 作为 base。
   - scoreRewardModifier 限制 0.5x-1.5x；不得低于 tier base，不得产生负奖励。
   - reward reason 可记录 strategy_score_modifier，但输入只能是 score，不得读取 affinity。
   - grantJourneyReward 以 journeyId/settlementId/tier 幂等。

3. 修改 worldCommit 六个落点：

   - tools/agent-server/lib/mcpTools.ts:2563-2606：canonEligible = mainLineSucceeded && score.totalBps >= CANON_THRESHOLD；失败只写 discarded。
   - tools/agent-server/lib/mcpTools.ts:2578-2593：solidifyJourneyWorld 传入 completionScoreBps、canonThreshold、policyVersion、settlement ID。
   - tools/agent-server/lib/epoch/journeyRules.ts:47-60、224-260：JourneyWorldCommit 必须包含 score、threshold、policyVersion、binary reason。
   - tools/agent-server/lib/epoch/gameCore.ts:9813-9858：authority 重验主线、score 范围、threshold/policyVersion。
   - tools/agent-server/lib/epoch/events.ts:1109-1141：JourneyWorldSolidifiedPayload 的 completionScoreBps、canonThreshold、policyVersion 在 solidify 时必填。
   - tools/agent-server/lib/epoch/resultPagePayloadRules.ts:145-225、tools/agent-server/lib/epoch/journeyRunReceiptRules.ts:151-217：结果和 receipt 只读取 server decision，discard 不携带 world effects。

4. 改 tools/agent-server/lib/epoch/runtime.ts:1700-1775：solidifyJourneyWorld 只接受 authority 生成的 decision/threshold；grantJourneyReward 只接受 SettlementDecision.reward bundle。

5. 更新 tools/agent-server/test/agentCompanionMcp.test.ts:635-648 的旧断言，从“主线完成即 solidify”改为“主线完成且达到 threshold 才 solidify”；所有 completionScoreBps/world commit receipt 断言增加 policyVersion/threshold。

### 前置依赖

Step 4 的唯一 settleJourney 和 Step 2 的 promote/discard。

### 验收

- 新增 journeySettlementTier.test.ts 或扩展 journeyConsequenceRules.test.ts，覆盖所有 tier 边界、主线失败、hidden clamp、惊世条件。
- reward 测试覆盖 0.5x、1.0x、1.5x、tier base floor、幂等 grant。
- worldCommit 测试覆盖低分 discard、达标 solidify、主线未完成 discard、伪造 threshold/policy/score 被拒绝。
- resultPagePayloadRules.test.ts、journeyRules.test.ts、agentCompanionMcp.test.ts、phase6ServerScoringRules.test.ts 通过。

### 风险

- v2.2 §14：canon/tier/viability threshold calibration 是主要风险，以版本化常量和边界 fixture 固定行为。
- logistics 4-bonus imbalance 和 primary fully-violates 3:7 classification 不得在本步变成额外 bonus；留给 Step 9/16。

## Step 6 — IdentityViability 与 NPC doubt 传播

规范映射：v2.2 §12.6；v2.2 §6.8、§8。

执行性质：依赖 Step 4/5；可与 Step 7/8/9 并行，必须在 Step 10/11 前合并。

### 工程任务

1. 在 tools/agent-server/lib/epoch/journeyViabilityRules.ts:1 实现 projectIdentityViability、applyFactionDoubtPropagation、viabilityStatus；首版 linear score，权重写入 VIABILITY_POLICY_VERSION，VIABILITY_DEATH_THRESHOLD 在 world state 更新后检查。

2. 改 tools/agent-server/lib/epoch/gameCore.ts:598-618、3042-3068：

   - EpochAgentIdentity 持久化 viability snapshot、doubtedBy、identityExposed、flaggedWanted。
   - 增加 apply event 分支，保证 replay 与实时 projection 相同。
   - faction standing、wanted、exposed、NPC doubt 按 identityId 隔离。

3. 改 tools/agent-server/lib/epoch/identityLifecycleRules.ts:205-320：

   - identityIssuedPayload 写入初始 viability。
   - lifetime delta/reason 增加 identity_viability_acceleration 等专用 reason。
   - 低于阈值触发 social death、加速 lifetime 或 terminate；不能由 MCP 直接指定。
   - score 结算完成后才投影 viability；viability 不反向影响当前 ConsequenceScore。

4. NPC doubt 传播规则：

   - 同 faction 全局传播。
   - cross faction 由 info sharing setting 控制。
   - 不共享信息的 cross-faction region 可重新开始，但 canonical world facts 连续。
   - doubt 写入 mirror ledger，达到 worldCommit 才进入 canonical faction/NPC state。

### 前置依赖

Step 4/5 的 SettlementDecision 和 Step 1 的 IdentityViability/event payload。

### 验收

- 新增 journeyViabilityRules.test.ts，覆盖 linear score、flagged/exposed/death 边界、settlement 后投影、same-faction/global、cross-faction sharing、identity reset。
- 扩展 identityLifecycleRules.test.ts、runtimeExplorerRegistration.test.ts、identityArchiveReadModel.test.ts、agentCompanionMcp.test.ts，覆盖 replay、lifetime reason、discard/solidify doubt 隔离。

### 风险

- v2.2 §14：NPC propagation balance、viability threshold calibration 是主要风险；最终分布由 Step 16 调整。

## Step 7 — ExpectedLifePattern、roleplay score 和 npc_identity_doubt

规范映射：v2.2 §12.7；v2.2 §6.9。

执行性质：依赖 Step 1/4；可与 Step 6 并行开发，必须在 Step 10/12 前集成。

### 工程任务

1. 在 tools/agent-server/lib/epoch/journeyRoleplayRules.ts:1 实现 buildExpectedLifePattern、compareApproachToLifePattern、classifyRoleplayDeviation、roleplayScoreFromLedger、buildNpcIdentityDoubtEvent。

2. pattern 输入必须来自 server 的 race、role、unit、faction、background、lifeGoal、needs、personalityTraits。首版使用 deterministic rules fallback；AI 只能 enrich 文本/标签，不能修改冻结 pattern。patternVersion 和输入 hash 写入 identity payload。

3. 改 tools/agent-server/lib/epoch/identityLifecycleRules.ts:205-216、tools/agent-server/lib/epoch/gameCore.ts:6147-6172、tools/agent-server/lib/epoch/runtime.ts:1482-1540：

   - identity issuance 生成并持久化 ExpectedLifePattern。
   - registerExplorer 传入策略和身份上下文。
   - reincarnation 只保留必要 lineage context，新身份得到新的 patternVersion 和 viability snapshot。

4. 改 tools/agent-server/lib/epoch/gameCore.ts:9577-9806：

   - action submit 由 server 用 internal approachTags 与 pattern 比对。
   - forbidden/significant deviation 写入 mirror ledger 的 npc_identity_doubt；LLM 不能决定是否发生 doubt。
   - roleplay deviation 进入 collateral/viability，但不是独立 reward bonus。
   - journeyStoryReport.ts:582-635 的 identityFidelity 保留为独立叙事字段，不能代替 RoleplayScore。

5. 在 tools/agent-server/lib/epoch/events.ts:1849-1935 加 npc_identity_doubt payload，并接入 apply/projection、ledger promotion、result page。

### 前置依赖

Step 1 的 ExpectedLifePattern/RoleplayScore、Step 2 的 ledger、Step 4 的 collateral sink、Step 6 的 viability projection。

### 验收

- 新增 journeyRoleplayRules.test.ts，覆盖 deterministic pattern、allowed/forbidden/unknown tag、doubt dedup、只读取 doubt/violation evidence。
- 扩展 identityLifecycleRules.test.ts、journeySceneContractRules.test.ts、agentCompanionMcp.test.ts，验证 pattern 冻结、mirror doubt 不改 canonical faction、solidify 后才进入 result/world summary、identityFidelity 与 RoleplayScore 来源独立。

### 风险

- v2.2 §14：ExpectedLifePattern quality 和 primary fully-violates 3:7 classification 是主要风险；pattern 要可审计、版本化、不可由 LLM 临时改写。
- NPC propagation 统一由 Step 6 处理，本步不复制传播逻辑。

## Step 8 — Hidden prerequisite chain 和对象状态

规范映射：v2.2 §12.8；v2.2 §6.10。

执行性质：依赖 Step 2/4；可与 Step 6/7 并行，必须在 Step 9/12 前完成 object-state contract。

### 工程任务

1. 新建 tools/agent-server/lib/epoch/hiddenPrerequisiteRules.ts:1，实现 buildHiddenPrerequisiteGraph、validateHiddenPrerequisiteDag、applyObjectMutation、hiddenStatusForFutureJourney；未知 target/object/effect degree fail closed。

2. 扩展 tools/agent-server/lib/epoch/journeyGeneratedTaskRules.ts:118-139、646-682：

   - JourneyHiddenTaskSeal 从 objectiveId/optionKey 扩展为带 object state digest、link status、source actionEventId 的版本化 seal。
   - action effect 增加 object_mutation、object_destroy，必须带 targetEntityId 和 degree。
   - 继续验证 objective DAG，禁止环和隐含前置依赖。
   - adjudicateJourneyTask 读取 canonical hidden object state，而不是只看本次 action 文本。

3. 扩展 tools/agent-server/lib/epoch/journeySceneContractRules.ts:36-42、59-111、783-900，定义对象变更 schema、internal effect blueprint、prerequisite impact；public serializer 不暴露 hidden object prerequisite 名称或可破坏性。

4. 改 tools/agent-server/lib/epoch/journeyWorldImpactRules.ts:12-149：规划 object mutation/destroy blueprint 并写入 ledger；只有 Step 5 solidify 才写 canonical object state；discard 清理本局 mutation。

5. tools/agent-server/lib/epoch/journeyGeneratedTaskRules.ts:1510-1567 的后续生成读取 canonical object digest，把 destroyed/degraded/intact 进入下一次 grounded context。不实现 delayed consequences。

### 前置依赖

Step 2 的 ledger effect blueprint、Step 4 的 collateral source、Step 5 的 binary promotion。

### 验收

- 新增 hiddenPrerequisiteRules.test.ts，覆盖 DAG、degree 校验、solidify/discard、future journey read、未知对象 fail closed。
- 扩展 journeyGeneratedTaskRules.test.ts、journeySceneContractRules.test.ts、journeyRuntime.test.ts，覆盖 hidden seal replay、object ledger dedup、task regeneration。
- result page/world commit 回归确认 discarded journey 不产生 hidden world mutation。

### 风险

- v2.2 §14：object mutation 的后果归因必须保存 source action 和 degree。
- 不把 degraded object 自动变成未来回合的 delayed event queue。

## Step 9 — strategyConsistency contract 和 affinity 仅作参考

规范映射：v2.2 §12.9；v2.2 §3、§5、§6.11、§6.12。

执行性质：依赖 Step 1/4；可与 Step 6-8 并行，必须在 Step 10/14 前冻结。

### 工程任务

1. 完成 tools/agent-server/lib/epoch/journeyStrategyRules.ts:1：

   - freezeIdentityStrategyDisposition、snapshotJourneyStrategy、expectedApproachForTask、scoreStrategyConsistency。
   - classifyPrimaryViolation：正常 primary 100%；只有完全违背 primary 时使用 primary 3、副 7。

2. 冻结边界：

   - tools/agent-server/lib/epoch/gameCore.ts:1838-1844 的 IssueIdentityInput 接收 profile；tools/agent-server/lib/epoch/identityLifecycleRules.ts:205-216 的 identityIssuedPayload 写入 disposition。
   - journey start/claim 将 disposition snapshot 复制到 journey；本局内不随 action、NPC feedback、prompt 改变。
   - affinityMatrixVersion 只供 server 生成 expected approach、prompt 和审计，禁止进入 PublicQuestOffer、PublicActionOption、ConsequenceScore、SettlementDecision 的加分输入。

3. 扩展 tools/agent-server/lib/epoch/journeyGeneratedTaskRules.ts:50-116 和 tools/agent-server/lib/epoch/journeySceneContractRules.ts:585-695 的 action/objective/plan/server-signed contract，加入 approachTags、expectedApproach；unknown tag fail closed。

4. 将 StrategyConsistencyScore 写入 storyReport、receipt、result page 审计字段，但不改变 ConsequenceScore、tier、reward modifier、worldCommit eligibility。

5. 复用 tools/agent-server/lib/epoch/journey-soak.ts:204-215、:270 的选择流程思想：action choice 可使用 identity、life pattern、expected approach、feedback；不得用 hard filter 强迫 agent 选高分 action，最终仍走 server adjudication。

### 前置依赖

Step 1 的 StrategyProfile/ApproachTag、Step 4 的 single-point settlement、Step 3 的 InternalQuestOffer expectedApproach。

### 验收

- strategy 规则测试覆盖 profile freeze、journey snapshot、primary 100%、完全违背时 3:7、action/prompt/affinity 变化不改 snapshot。
- 相同 physical consequence fixture 下替换 strategy/affinity 只改变 strategyConsistency，不改变 score/tier/reward/worldCommit。
- phase6ServerScoringRules.test.ts 确认 score 只消费 SettlementDecision/physical outcome，不消费 affinity。
- public schema scan 无 fitBps、strategyAffinity、bonus marker、expectedApproach 泄漏。

### 风险

- v2.2 §14：logistics 4-bonus imbalance 和 primary fully-violates 3:7 classification 留给 Step 16 验证，本步只实现冻结、可重放分类，不做额外 bonus。

## Step 10 — agent feedback 闭环和非数值 prompt 注入

规范映射：v2.2 §12.10；v2.2 §5.2、§7、§9。

执行性质：依赖 Step 6/7/9；可与 Step 11-13 的独立代码并行，prompt/schema 合入必须在 Step 12 前完成。

### 工程任务

1. 新建 tools/agent-server/lib/epoch/journeyFeedbackRules.ts:1：

   - WorldFeedbackSignal：kind、sourceEventId、audienceIdentityId、narrativeTextKey、worldFactRef、createdAt。
   - kinds 至少包括 npc_cold、shut_out、followed、questioned、relationship_deteriorated、standing_changed、identity_exposed。
   - toAgentFeedbackPromptContext 只输出非数值 narrative signals，不输出 score、bps、tier、reward、threshold、affinity。

2. server 规则从 NPC doubt、viability、world commit canonical events 生成 feedback。mirror 可生成当前场景的非数值反馈，但不能把未 solidify 的后果伪装成 canonical fact。signal 带 sourceEventId，重放不重复。

3. 改 tools/agent-server/lib/mcpTools.ts:8427-8468、tools/agent-server/lib/epoch/journey-soak.ts:204-215、:270：

   - action choice prompt 加入 identity、life goal、needs、ExpectedLifePattern、strategy snapshot、WorldFeedbackSignal。
   - 删除“更高分、更高 tier、更高 reward、更容易 solidify”的文字或字段。
   - narrative 可以体现 NPC 冷淡、被跟踪、被质疑、关系恶化，不展示数值强度。

4. 统一 prompt redline：

   - PublicQuestOffer、PublicActionOption、feedback、progress/status、实时 console 不读取 SettlementDecision 数值。
   - internal planner 可读取 affinity/expectedApproach，但只用于任务/叙事上下文和 roleplay comparison，不传给 agent。
   - identityFidelity、strategyConsistency 数值只在 result page。

### 前置依赖

Step 6 的 viability/doubt、Step 7 的 roleplay event、Step 9 的 strategy snapshot、Step 13 的 serializer boundary。

### 验收

- 新增 journeyFeedbackRules.test.ts。
- prompt snapshot/scan 覆盖 action choice、task offer、status、sampling input、compact result：不出现 score、bps、tier、reward modifier、canon threshold、affinity、fit、bonus。
- doubt/world signal 产生后下一次 prompt 可见；无 source 不凭空生成；重放不重复。
- 扩展 mcp.test.ts、mcpSamplingSchemas.test.ts、agentCompanionPublicBoundary.test.ts 和 journey-soak 测试。

### 风险

- v2.2 §14：narrative grounding gate 是主要风险；每个 signal 必须绑定 sourceEventId/worldFactRef，LLM 只渲染，不创作事实。

## Step 11 — 跨身份世界连续性

规范映射：v2.2 §12.11；v2.2 §6.8、§8。

执行性质：依赖 Step 2/6/8；必须在 Step 12/14 前完成。

### 工程任务

1. 改 tools/agent-server/lib/epoch/gameCore.ts:6191-6242 的 reincarnationEvents 和 identity transition：

   - previousAgentId、nextAgentId、inheritance 写入 transition payload。
   - canonical world effects 不绑定当前 identity 生存期；solidified region/object/faction/NPC effects 保留给下一个 identity。
   - 新 identity 的 strategyDisposition、ExpectedLifePattern、IdentityViability 重新初始化。

2. 改 tools/agent-server/lib/epoch/identityLifecycleRules.ts:292-320 和 identity archive/read model：

   - identity 终止时清除 standing、wanted、exposed、doubtedBy。
   - 同阵营 association inheritance 是显式、版本化 exception，不能隐式复制全部 viability。
   - identity_archive 只归档身份状态，不删除 canonical world event。

3. world/read model 的 solidified effect IDs 关联 world/region/object/faction/NPC entity，而不只关联 agentId。下一个 identity 读 canonical world state 和 lineage chronicle；当前 result page 仍显示发生时的 world summary。

4. 处理重启顺序：

   - identity termination、world promotion、next identity issuance 可重放。
   - solidify 后、reincarnation 前重启不能丢 canonical world effects。
   - discard 后换身份不能传递 mirror ledger。

### 前置依赖

Step 2 的 canonical promotion、Step 6 的 viability reset/inheritance、Step 8 的 hidden object canonical state。

### 验收

- 新增 crossIdentityContinuity.test.ts：

  - identity A solidify 的 world effect 可被 identity B 读取。
  - identity A discard 的 mirror effect identity B 不可见。
  - standing/wanted/exposed/doubt 按身份清除。
  - 同 faction 只继承明确字段。
  - previousAgentId/nextAgentId/inheritance replay 一致。

- 扩展 identityArchiveReadModel.test.ts、identityLifecycleRules.test.ts、journeyPersistence.test.ts、agentCompanionMcp.test.ts。
- result page 的 world effect summary 不因 identity transition 被重算或消失。

### 风险

- v2.2 §14：world event 与 identity-scoped projection 混淆会破坏连续性；使用 entity-scoped canonical effect，不通过复制身份状态解决。
- 不引入 delayed consequences 或 multi-agent interaction。

## Step 12 — result page payload 和一次性数值呈现

规范映射：v2.2 §12.12；v2.2 §9、§6.7。

执行性质：依赖 Step 4-11；可与 Step 13 并行，但共享 public/internal/signed contract。

### 工程任务

1. 扩展 tools/agent-server/lib/epoch/runtime.ts:885-946 的 EpochResultPageJourney：

   - settlement：三段 ConsequenceScore breakdown、SettlementDecision、policy versions。
   - tier/reward/worldCommit：threshold、canonEligible、solidified/discarded reason、effect summary。
   - roleplay：RoleplayScore、NPC doubt events、exposed。
   - viability：before/after/delta、status、lifetime consequence。
   - strategyConsistency：matchBps、frozen snapshot、primary violation classification。
   - hidden prerequisite：完成/破坏/降级的 object link summary。

2. 改 tools/agent-server/lib/epoch/resultPagePayloadRules.ts:145-239、249-420、461-607、610-673：

   - resultPageWorldCommit 校验 completionScoreBps、canonThreshold、policyVersion、binary worldCommit。
   - resultPageJourney 只接受 canonical effect IDs/settlement record，不能从 narrative 文本推断数值。
   - 新字段均要求 source event/policy version。
   - discard 页面可显示后果 breakdown 和未晋升 world 的事实，但不携带 discarded canonical effect。

3. 改 tools/agent-server/lib/epoch/journeyStoryReport.ts:62-157、582-635、893-1106：

   - facts/evaluation 读取 SettlementDecision、RoleplayScore、viability、world effect summary。
   - identityFidelity 继续是独立 narrative evaluation，不与 RoleplayScore 合并。
   - LLM narrative 只能引用验证过的 structured facts，数字由 server payload 直接渲染。

4. 保护 active boundary：

   - progress/status/real-time console/public companion 只给 current scene、non-numeric feedback、safe world facts。
   - settlement 数值只在 result page 完成事件后可读，且为只读结果快照。
   - tools/agent-server/lib/resultPageRuntimeRules.ts safe summary 排除 sourceContextHash、affinity、内部 offer、action internal fields。

5. 改 tools/agent-server/lib/epoch/journeyRunReceiptRules.ts:7-15、151-217、300-496，增加 settlement policy/threshold/decision reference；old receipt v1/v2 使用只读 adapter，不能当作新 ConsequenceScore 输入。

### 前置依赖

Step 4 的 single-point decision、Step 5 的 tier/reward/worldCommit、Step 6-11 的 roleplay/viability/hidden/continuity。

### 验收

- 扩展 resultPagePayloadRules.test.ts、resultPageRuntime.test.ts、resultPageRuntimeStore.test.ts、journeyStoryReport.test.ts：

  - result page 完整呈现 score 三段、tier、reward、worldCommit、roleplay、viability、world summary、strategyConsistency。
  - active payload、实时 console、action option、offer payload 不出现数值。
  - narrative 与 structured facts 不一致时 fail closed。
  - result page 重放/持久化读取一致。

- 增加 public leakage scan，扫描 score、bps、tier、reward modifier、canon threshold、affinity 在 active/public serializer 中的路径。
- 更新 agentCompanionMcp.test.ts 的旧 result payload 断言。

### 风险

- v2.2 §14：叙事 grounding gate 是主要风险；文字只能从 structured facts 生成，模型不能补事实或数字。

## Step 13 — PublicActionOption、InternalActionOption、SignedActionOption 和 serializer

规范映射：v2.2 §12.13；v2.2 §5.1、§9、§2.1。

执行性质：依赖 Step 1/4/9；可与 Step 12 并行，必须在 Step 14 evidence 运行前完成。

### 工程任务

1. 拆分 tools/agent-server/lib/epoch/journeySceneContractRules.ts:59-111 的混合 JourneySceneActionOption：

   - PublicActionOption：actionId、label、intent、riskLabel、available/disabled reason；不含 numeric bonus、resource cost、expected score、hidden target、expected approach。
   - InternalActionOption：actionId、approachTags、riskTerms、preconditionRefs、allowedEffectKinds、targetEntityIds、expectedApproach、effectBlueprint。
   - SignedActionOption：journeyId、sceneId、actionId、contractVersion、optionHash、signature、issuedAt、expiresAt；server 由 actionId 重新取 internal data。
   - PublicSceneContract、InternalSceneContract、SignedSceneContract 分开。

2. 改 tools/agent-server/lib/epoch/journeySceneContractRules.ts:421-458、585-695、783-900：

   - scene generation 在 server 保存 internal map。
   - public serializer 只返回 PublicActionOption。
   - signature 固定版本、journey/scene/action ID、optionHash、approved contract digest；submit 时 server 从内部快照重建 effect。
   - unknown action、过期 contract、hash mismatch、未知 approach/effect 全部拒绝。

3. 迁移所有出口：

   - tools/agent-server/lib/mcpTools.ts:8387-8396：choice prompt 只发送 public option 和非数值 feedback。
   - tools/agent-server/lib/mcpTools.ts:8933-8996：compact serializer 改为 public/signed serializer，不以删字段临时伪造安全边界。
   - tools/agent-server/lib/mcpTools.ts:4794-4809、8938 附近的 schemas 采用新类型。
   - tools/agent-server/lib/epoch/gameCore.ts:9588-9657：验签后从 server snapshot 重建 internal action。
   - hosted、session、agent companion、sampling、Web bridge 逐一迁移；用 rg 搜索 riskTerms、preconditionRefs、allowedEffectKinds、targetEntityIds、scoreBps 审计。

4. public action 移除成功奖励数字、资源成本数字、bonus marker、tier hint、worldCommit hint。riskLabel 只表达叙事风险等级，不能编码可反推 reward/score 的数字。

### 前置依赖

Step 1 的分层类型、Step 4 的 server authority、Step 9 的 approachTags、Step 10 的反馈 prompt。

### 验收

- journeySceneContractRules.test.ts 覆盖 public 字段白名单、signed replay、过期/篡改/未知 action fail closed、internal fields 不过 public/compact/session/hosted/sampling。
- 扩展 agentCompanionPublicBoundary.test.ts、mcpSamplingSchemas.test.ts、mcp.test.ts、serverHostedRuntimeRules.test.ts。
- 全仓 active journey schema/prompt 静态检查不出现 strategyAffinity、fitBps、expectedApproach、bonus marker、reward numeric hint。
- typecheck 和 journey scene/MCP tests 通过。

### 风险

- v2.2 §14：zero leakage 是硬验收，serializer 使用白名单而不是黑名单。
- fail closed 造成的旧 fixture 失败先补 contract version，不放宽 server 校验。

## Step 14 — Phase 6 matrix 直接改写、影响收敛和历史归档

规范映射：v2.2 §12.14；v2.2 §11、§6.7。

执行性质：依赖 Step 3/4/5/9；建议 Step 12/13 合并后正式切换；不创建新 gameMode。

### 工程任务

1. 直接改 tools/agent-server/lib/epoch/phase6ScenarioMatrixRules.ts:19-42：

   - 用 taskFamily、offer source、strategy snapshot、physical consequence、SettlementDecision 语义改写现有 10 个 run scenario。
   - 保持 matrix lookup/binding API 可迁移，但 scenario 不再代表旧 affinity/bonus 逻辑。
   - 升级 matrix version，写入 run、receipt、evidence。
   - 不新增 gameMode 字段或第二套 Phase 6 route。

2. 改 tools/agent-server/lib/epoch/phase6ExperimentRules.ts:1-7、122-124、308-345：

   - Phase6ExperimentState 增加 archived。
   - 增加 ArchivedPhase6Experiment、ArchiveReason、archivedAt、originalMatrixVersion、originalReceiptDigest 等只读字段。
   - 旧实验先写 archive record，再标 archived；所有 archive 写入口拒绝。
   - 新 run 仍使用同一实验域和同一 game loop。

3. 在 tools/agent-server/lib/store.ts:501-514 增加一次性幂等 archive migration event：

   - 原始 JSONL/receipt 不删除。
   - archive 保留原 IDs、matrix version、score/receipt digest、world commit 状态。
   - schema 不满足的旧记录进入显式 migration error，不静默改成新语义。

4. 统一 Phase 6 settlement/receipt：

   - tools/agent-server/lib/mcpTools.ts:3952-3983 的 start/finish 绑定新 offer/taskFamily/source。
   - tools/agent-server/lib/mcpTools.ts:519、tools/agent-server/lib/epoch/phase6McpSettlementRuntime.ts:649、tools/agent-server/lib/epoch/phase6ExperimentRuntime.ts:77、tools/agent-server/lib/epoch/journeyRunReceiptRules.ts:7 同步 receipt version。
   - Phase 6 score 只读取 SettlementDecision 与 physical result，不能重新按 affinity/matrix bonus 算 tier。
   - old receipt adapter 只读，不能作为新 settlement 输入。

5. 改 tools/agent-server/phase6-ten-run-evidence.ts:75-86、258-308 和 tools/agent-server/phase6-ten-run.ts:2395-2403：

   - expected scenario 从新 matrix/offer binding 读取。
   - 记录 settlement policy、threshold、ledger digest。
   - gate 检查 archived/active matrix、receipt version、binary worldCommit、zero leakage。

### 前置依赖

Step 3 的 offer binding、Step 4/5 的 settlement/threshold、Step 9 的 strategy snapshot；建议 Step 12/13 字段冻结。

### 验收

- phase6ScenarioMatrixRules.test.ts：新 matrix 10 个 scenario binding 正确，没有 gameMode。
- Phase6 rules/runtime 测试确认旧数据 archive 后仍可读 receipt/world marker、archived state 所有写入口拒绝、migration 幂等可重启且原数据未删除。
- phase6-ten-run-evidence.test.ts、phase6TenRunValidatorSynthetic.test.ts、phase6RestartRehydration.test.ts、phase6CompactResultPersistence.test.ts、phase6ResultPageChangeSetAdapter.test.ts 通过。
- 十轮 gate 确认策略只通过 physical consequence 影响结果、action 无数值加成、SettlementDecision 单点、discard 不 solidify、跨 identity 连续。

### 风险

- v2.2 §14：threshold calibration、后果归因和旧数据语义迁移是主要风险。旧 score 不能被解释成新 ConsequenceScore。
- 不引入 gameMode；matrix version 和 archived state 只是迁移/审计字段。

## Step 15 — 可选 server AI、生命周期、warmup、fallback 和 replay

规范映射：v2.2 §12.15；v2.2 §10。

执行性质：依赖 Step 3/9/10；可选，不能阻塞基础 loop。

### 工程任务

1. 新建 tools/agent-server/lib/epoch/serverQuestAi.ts:1：

   - QuestGenerationProvider：generate(input): Promise<Proposal>。
   - ServerAiState：warming、ready、degraded。
   - QuestGenerationProposal：task plan、source context、grounding evidence、modelVersion、promptHash、worldContentHash、seed。
   - startWarmup、generateWithFallback、persistGenerationBatch、replayGeneration。

2. provider 设计：

   - direct provider 可接 Anthropic SDK，但不成为基础 loop 硬依赖。
   - tools/agent-server/lib/mcpSampling.ts:168-233 的 task-plan sampling 作为 fallback provider。
   - tools/agent-server/lib/mcpSamplingSchemas.ts:245-285 的 unknown proposal 在 server boundary 窄化。
   - API key 从环境变量读取；有 limiter、cache、timeout、max token、region/taskFamily 并发上限。

3. 四项 proposal 检查：

   - structure：JSON/schema、objective/action 数量、action tags、hidden link 类型。
   - world：region/worldSliceHash、known entities、object state。
   - semantic：taskFamily、expectedApproach、strategy context。
   - content：roleplay/reputation redline，不生成 numeric bonus/score hint。

   任一失败立即 catalog fallback，不把 proposal 写入 available market。

4. 接入 Step 3 市场：

   - claim 1 后异步 replenish 2。
   - tools/agent-server/server.ts:28-77、103-178 启动后非阻塞 warmup；ready/degraded 只供 health/diagnostic。
   - 重启后 provider 可回到 warming，已落库 offer 不重生成。

5. replay 只有同一 modelVersion、seed、normalized input、worldContentHash、promptHash 才可声称一致。跨 model 不保证一致，历史 proposal 以 persisted artifact 为准。AI 不能直接写 world event、score、tier、reward 或 viability。

### 前置依赖

Step 3 的 offer store/lifecycle、Step 9 的 strategy/approach、Step 10 的 feedback redline；正式交付建议 Step 14 后。

### 验收

- 新增 serverQuestAi.test.ts、serverQuestAiReplay.test.ts，覆盖状态转换、API key 缺失/timeout/限流/schema failure fallback、四项 grounded check、claim 1/replenish 2、restart 不重复生成、同版本 replay digest。
- 扩展 mcpSampling.test.ts、mcpSamplingSchemas.test.ts、journeyOfferStore.test.ts、server startup/health tests。
- server 启动测试确认 warmup 不阻塞 listen，无 AI 时仍能启动。

### 风险

- v2.2 §14：narrative grounding gate、ExpectedLifePattern quality 是主要风险；AI proposal 必须可拒绝，fallback 始终可用。
- 不扩展跨模型 replay、multi-agent interaction 或 roleplay reward side。

## Step 16 — balance simulation 和发布前策略分布验证

规范映射：v2.2 §12.16；v2.2 §13；v2.2 §14。

执行性质：依赖 Step 1-15，最终串行 gate。

### 工程任务

1. 新建或扩展 tools/agent-server/phase6-balance-simulate.ts:1、tools/agent-server/phase6-balance-samples.ts:1：

   - 为 combat、cunning、support、logistics、exploration 准备固定、可 seed 的行为分布。
   - 每个策略至少模拟 1000 次；每次包含 offer/taskFamily、primary/secondary、approach、main/side/hidden 结果、self-loss、collateral、roleplay deviation、viability、worldCommit。
   - 可比较 AI provider、catalog fallback、region/world slice，但不能写真实 canonical world。

2. 采集 ConsequenceScore 三段、tier/hidden clamp/惊世、reward modifier/item rarity/resource/lifetime、binary worldCommit、roleplay deviation/NPC doubt/viability death、strategyConsistency、offer claim/expiry/replenish/concurrency failure、public leakage scan。

3. 新增 journeyBalanceSimulation.test.ts 和 package script agent:balance-simulate；固定 seed 和统计容差，输出到临时目录，不污染 tools/agent-server/data/，不调用真实外部 AI 或 canonical store。

4. 只根据模拟证据调整 canon/tier/viability thresholds、self-loss/collateral 权重、logistics distribution、primary fully-violates 3:7、ExpectedLifePattern redline、NPC propagation。每次调整升级 policy version 并更新 fixture；不通过 strategy bonus、roleplay reward side、affinity 加分修正。

5. 明确 out of scope：策略天梯/leaderboard、delayed consequences、roleplay reward side、multi-agent interaction、跨模型 replay。

### 前置依赖

全部前置步骤，尤其 Step 5 policy、Step 6/7/8 consequence source、Step 9 frozen strategy、Step 12 result payload、Step 14 matrix。

### 验收

- 每个策略 1000+ 固定 seed 模拟完成，统计可重放。
- 结果含 §13 的 tier、reward、worldCommit、roleplay、viability、hidden、strategyConsistency 指标。
- typecheck、npm test、world-map-data:check、agent:world-content:check、check:repository-import、build:container 全部通过。
- 同一 physical consequence fixture 下不同 strategy 不改变结果，只有行为导致的 consequence 改变结果。

### 风险

- v2.2 §14：threshold calibration、logistics imbalance、3:7、ExpectedLifePattern、NPC propagation、后果归因、grounding gate 都要在模拟报告中列出。
- 模拟只支持调参，不引入新方向或 out-of-scope 功能。

## 4. 建议的 PR 拆分

### PR 1 — Freeze journey strategy/offer/settlement domain contracts

范围：Step 1；新增 strategy、offer、settlement、viability、roleplay 类型和版本常量；扩展 events、identity、journey/task plan 类型。

依赖：无。

验收：domain rule tests、typecheck、初始 public leakage scan；不改变运行时行为。

### PR 2 — Add mirror consequence ledger and promotion boundary

范围：Step 2；ledger/store projection，改 submitHostedAction、solidifyJourneyWorld、journey read model，接入 world impact planner。

依赖：PR 1。

验收：append dedup、discard no-op、atomic promotion、restart rehydration；journeyPersistence/journeyRuntime/agentCompanion 回归通过。

### PR 3 — Add quest market and offer-to-plan binding

范围：Step 3；offer repository、reservation/claim/TTL、async replenish、bounty 独立生命周期、prepare_journey、source binding、catalog fallback。

依赖：PR 1；可与 PR 2 并行。

验收：并发 claim、幂等 retry、TTL、fallback、hash mismatch、public offer zero leakage。

### PR 4 — Introduce single-point settlement and binary world commit

范围：Step 4-5；ConsequenceScore、SettlementDecision、self-loss dedup、tier、reward modifier、binary threshold、six-place authority validation、receipt/result 基础字段。

依赖：PR 1、PR 2，建议 PR 3 已合并。

验收：consequence fixture、tier boundary、reward clamp/idempotency、discard/solidify；settlement 只剩一条派生路径。

### PR 5 — Add viability, roleplay and hidden prerequisite consequences

范围：Step 6-8；IdentityViability、NPC doubt、ExpectedLifePattern、RoleplayScore、npc_identity_doubt、hidden object mutation/destroy、future hidden state。

依赖：PR 4。

验收：viability-after-settlement、same/cross faction、pattern freeze、hidden DAG/object state、discard/solidify 隔离。

### PR 6 — Add frozen strategy consistency and non-numeric feedback

范围：Step 9-10；strategy snapshot、approach tags、100%/3:7、affinity reference-only、WorldFeedbackSignal、prompt redline。

依赖：PR 4、PR 5；规则测试完成后可与 PR 5 后半并行。

验收：相同 physical consequence 结果不变、策略只影响 prompt/行为、leakage scan、feedback source/replay。

### PR 7 — Preserve world across identities

范围：Step 11；world entity projection、identity reset/inheritance、lineage/reincarnation replay。

依赖：PR 2、PR 5。

验收：identity A solidify 后 identity B 可读 world；discard 不传播；identity status reset；restart consistency。

### PR 8 — Result page and public/internal/signed action boundary

范围：Step 12-13；result payload、story grounding、PublicActionOption/InternalActionOption/SignedActionOption、MCP/hosted/session/sampling/compact serializer。

依赖：PR 4、PR 5、PR 6、PR 7。

验收：result page 一次显示完整数值；active/public zero leakage；签名/过期/hash/fail-closed；public boundary tests 通过。

### PR 9 — Rewrite Phase 6 matrix in place and archive old data

范围：Step 14；matrix version/content、archived state、幂等 archive migration、receipt adapter、十轮 evidence/gate。

依赖：PR 3、PR 4、PR 6、PR 8。

验收：无 gameMode；旧数据原样只读；新十轮使用新 matrix/offer/settlement；Phase 6 全套测试和 restart rehydration 通过。

### PR 10 — Optional server AI provider and asynchronous market replenishment

范围：Step 15；provider、warming/ready/degraded、sampling/direct provider、四项 grounded check、persist/replay、nonblocking startup。

依赖：PR 3、PR 6，建议 PR 9 后合入。

验收：AI 缺失/失败 fallback；claim 1/replenish 2；重启不重复生成；版本/seed/input replay；warmup 不阻塞 listen。

### PR 11 — Balance simulation and release gate

范围：Step 16；固定 seed 的每策略 1000+ simulation、统计报告、CI script、policy version 更新。

依赖：PR 1-10。

验收：§13 全部 acceptance、分布可重放、zero leakage、worldCommit/viability/roleplay/hidden/strategy consistency 指标齐全；不加入策略天梯和其他 out-of-scope。

## 5. 每个 PR 的统一验证门槛

在 tools/graph-react-app 执行：

~~~text
npm run typecheck
npm test
npm run world-map-data:check
npm run agent:world-content:check
npm run check:repository-import
npm run build:container
~~~

规则文件或 server 测试迭代期间先跑：

~~~text
node --import tsx --test tools/agent-server/test/journeyRules.test.ts
node --import tsx --test tools/agent-server/test/journeyGeneratedTaskRules.test.ts
node --import tsx --test tools/agent-server/test/journeySceneContractRules.test.ts
node --import tsx --test tools/agent-server/test/resultPagePayloadRules.test.ts
node --import tsx --test tools/agent-server/test/identityLifecycleRules.test.ts
node --import tsx --test tools/agent-server/test/agentCompanionMcp.test.ts --test-concurrency=1
~~~

任何 PR 都必须：

- 不提交 node_modules、dist、tools/agent-server/data、.omc 或生成的总览 HTML/assets/data。
- 不把 raw media 放到 09_素材与图片/ChatGPT批量生成/object-storage-manifest.json 工作流之外。
- 不通过客户端输入决定 score、tier、reward、worldCommit、viability 或 canonical effect。
- 不在 active/public payload 暴露 affinity、fit、expected approach、bonus marker 或数值结局。
- 所有新增 event、receipt、offer、settlement、identity pattern、ledger entry 都有 version、source ID、replay/幂等策略。

## 6. 最终 Definition of Done

1. 16 步按 §12 顺序完成；可并行部分有独立规则测试，集成通过依赖闸门。
2. action → mirror ledger → ConsequenceScore → SettlementDecision → binary worldCommit/reward/result page 只有一套 server 派生路径。
3. main/self-loss/collateral、roleplay doubt、hidden object state、viability 都可通过 source event/ledger entry 追溯。
4. identity A solidify 的 world fact 在 identity B 连续，identity A 的个人 reputation/viability 按规则重置。
5. strategy、affinity、expected approach 只影响上下文与 agent 行为；同一物理后果不会因策略标签改变 settlement。
6. task market 与 bounty market 独立；offer claim 并发安全；无 AI 可用 catalog fallback。
7. active/public action/task/progress/console 全链路零数值加成泄漏；数字只在 result page。
8. Phase 6 matrix 原地改写、旧数据只读归档、无 gameMode；十轮 evidence 与新 settlement 语义一致。
9. server AI 可选异步，warming/degraded 不阻塞启动，grounding 失败 fail closed。
10. 每个策略至少 1000 次固定 seed simulation 完成，发布门槛命令通过；不包含策略天梯或其他 out-of-scope。
