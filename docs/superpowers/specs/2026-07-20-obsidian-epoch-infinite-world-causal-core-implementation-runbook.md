# 《黑曜纪元》无限世界因果核心实施/运营手册

状态：Implementation runbook  
日期：2026-07-20  
适用范围：本手册只记录当前代码与 catalog/spec 中已经实现或登记的事实。

## 1. 事实来源

本手册依据以下文件编写：

- 规范与目录：`2026-07-20-obsidian-epoch-infinite-world-causal-core-spec.md`、`2026-07-20-obsidian-epoch-infinite-world-phase-0-event-foundation-spec.md`、`2026-07-20-obsidian-epoch-causal-schema-registry-v1.json`、`2026-07-20-obsidian-epoch-balance-catalog-v1.json`、`2026-07-20-obsidian-epoch-materials-crafting-catalog-v1.json`。
- 因果基础：`causalContracts.ts`、`causalCanonicalJson.ts`、`causalSchemaRegistry.ts`、`causalIdempotencyRules.ts`、`causalInvariantRules.ts`、`causalResourceRules.ts`、`causalWriteCoordinator.ts`。
- 领域规则：`worldPressureRules.ts`、`actorMindRules.ts`、`knowledgeStateRules.ts`、`knowledgeViewRules.ts`、`economyRuntimeReadModel.ts`、`unifiedEconomyRules.ts`、`progressionRules.ts`、`missionConsequenceRules.ts`、`governanceEcologyRules.ts`、`causalNarrativeRules.ts`、`supernaturalLegacyRules.ts`、`causalSimulationLodRules.ts`。
- 快照、观测和适配：`causalWorldSnapshot.ts`、`causalSnapshotMigration.ts`、`causalObservability.ts`、`causalEpochAdapter.ts`。
- runtime 暴露面：`runtime.ts`、`infiniteWorldRuntime.ts`、`mcpTools.ts`。

不要把上位 spec 中尚未落到代码的设计项当成 runtime 能力。当前不少领域模块返回 `CausalEffectV1` proposal 或 read model；`infiniteWorldRuntime.ts` 已把其中一部分接入 causal write coordinator，但不等同于已经有完整 MCP 直接工具。

## 2. 架构与数据流

已实现的因果写入边界是：

1. 外部命令或后台调度先标准化为 `CommandIntentV1`。
2. `createCausalWriteCoordinator().execute()` 计算稳定输入哈希，按幂等 scope 串行处理同一 `worldId + commandType + actorRef + idempotencyKey`。
3. runtime 提供 `loadSnapshot`，构建器返回 `CausalWorldEventCandidateV1`。
4. coordinator 注入 `schemaVersion`、`registryVersion`、`registryHash`、`recordedAt`、`command`、`causality` 和 `authorizationRefs`。
5. `assertCausalWorldEventV1`、Schema Registry、因果不变量和资源不变量共同校验。
6. `block` 或 `retired` 模式下存在违规会拒绝写入；`warn` 模式返回 warning；`observe` 模式不发 warning。
7. 成功后提交一个原子 `CausalCommitBundle`，写入幂等 manifest，再执行可选投影。
8. 返回 `CommandResultManifestV1`，包含 `eventIds`、`eventHashes`、`projectionStatus` 和 `warnings`。

所有投影、RAG、面板、叙事、快照都是派生视图。快照可加速 replay，但不能替代事件链证据。

## 3. Canonical 事件与 Schema Registry

`CausalWorldEventV1` 的已实现必备字段包括：

- `eventId`、`eventType`、`schemaVersion: "1.0.0"`、`registryVersion`、`registryHash`。
- `worldId`、`namespace`，namespace 只允许 `world`、`lineage`、`identity`、`run`。
- `stream.streamType`、`stream.streamId`、`stream.streamVersion`。
- `occurredAtWorldMinute` 和 `recordedAt`。
- `actorRefs`、`subjectRefs`、`regionRefs`。
- `command.commandId`、`command.commandType`、`command.idempotencyKey`、`command.inputHash`。
- `causality.causalParentEventIds`、`causality.rootPressureIds`、可选 `rootReason`。
- `authorizationRefs`、`evidenceRefs`、`visibilityPolicyRef`。
- `versions`、`determinism`、`payload`、`effects`、`proof`。

Schema Registry JSON 当前登记的 canonical event 类型包括：

- `system_world_created`
- `system_clock_advanced`
- `content_migration_applied`
- `admin_correction_committed`
- `world_pressure_opened`
- `observation_acquired`
- `market_order_placed`
- `world_opportunity_opened`
- `journey_consequence_committed`
- `case_opened`
- `lineage_project_advanced`

`causalSchemaRegistry.ts` 还登记了更宽的 `ACTIVE_EVENT_TYPES` 与 `CAUSAL_DOMAIN_EVENT_TYPES`，用于解析事件策略。新增写入必须先确认 event type 在 registry policy 中可解析，不能只在业务代码里拼字符串。

已实现 effect 类型：

| effectType | 用途 |
|---|---|
| `resource_ledger` | 资源账户增减，数量用十进制整数字符串 |
| `unique_item_lifecycle` | 唯一物品生命周期 |
| `ownership_interest` | title、possession、custody、lease、lien、mortgage、seizure、carry_permission |
| `state_transition` | 状态机跃迁 |
| `relationship_delta` | 关系变化 |
| `knowledge_delta` | 知识、记忆、信念类变化 |
| `pressure_delta` | 压力变化 |
| `legal_delta` | 法律/治理变化 |
| `world_predicate` | 可观察世界谓词 |

Canonical JSON 实现会按对象 key 排序，数组保序，拒绝 `undefined`、函数、symbol、bigint、循环引用和非有限 number。事件 proof 使用 `payloadHash`、`effectsHash`、`eventHash`。

## 4. 数值单位与守恒

资源数量使用 `quantityMinor: string`，且必须是十进制整数。`causalResourceRules.ts` 使用 `BigInt` 校验：

- 普通转移必须在 entries 总和为 0 时不声明 `creationSourceRef` 或 `destructionSinkRef`。
- 总和为正时必须提供允许的 `creationSourceRef`。
- 总和为负时必须提供允许的 `destructionSinkRef`。
- 默认 creation source：`harvest`、`production`、`authorized_currency_issuance`、`ecological_regeneration`、`recovery_compensation`、`content_migration`。
- 默认 destruction sink：`consumption`、`crafting_waste`、`durability_loss`、`tax_sink`、`authorized_currency_retirement`、`ecological_decay`、`content_migration`。
- 账户余额不能低于信用额度。
- 同一时间有效的唯一物 title 不能有多个 holder。

balance catalog 中明确：`coin`、`aether` 和世界商品中的 `food`、`water`、`medicine`、`materials`、`fuel`、`aether` 是守恒资源；`stamina`、`focus`、`legend` 不是可转移货币。

## 5. 各领域命令与效果

### 5.0 资源生产与生活画像闭环

当前两个曾经的缺口已经闭环：

- 资源节点生产不再停留在纯规则模块。`infiniteWorldRuntime.ts` 暴露 `resource_node_register`、`resource_production_assign`、`resource_produce`、`resource_node_replenish`，并登记 canonical events：`resource_node_registered`、`resource_production_assigned`、`resource_production_committed`、`resource_node_replenished`。
- 生活画像不再停留在纯规则模块。runtime 暴露 `life_profile_create`、`life_profile_advance`，并登记 `life_profile_created`、`life_profile_advanced`；`world_tick` 会从快照中读取 life profiles 并确定性推进到目标世界分钟。

实现映射：

- Schema Registry 的 TS 源是 `causalSchemaCatalog.ts`；JSON mirror 是 `2026-07-20-obsidian-epoch-causal-schema-registry-v1.json`，当前 registry hash 为 `sha256:099f78077c649ee7eecda4ad1deedbef360387ee114c1372a7345924a0c66b05`。
- 快照强类型状态在 `causalWorldSnapshot.ts` 的 `domains.resourceProductionNodes`、`domains.resourceProductionAssignments`、`domains.lifeProfiles`。`createCausalWorldSnapshot` 会为旧快照默认空集合并确定性排序，`applyCausalEventToSnapshot` 根据 canonical event payload 投影节点、分配和生活画像。
- 资源生产注册/补充使用显式 creation source：`source:resource_node_registration`、`source:resource_node_replenish`；生活画像初始余额使用 `source:life_profile_initial_balance`。实际生产和日常推进中的转移必须是零和 `resource_ledger` entries，并由 `causalWriteCoordinator` 统一校验余额、source/sink 与因果不变量。
- `resource_produce` 在一个事件中同时记录生产 proposal payload、节点剩余量、耗竭时间和目标账户余额变更。非法耗尽后继续生产会被规则拒绝；缺失账本余额的生活推进会被统一资源校验拒绝。
- `life_profile_advance` payload 的 `audit` 包含新 resource deltas、新 consequences、工作分钟、学习分钟、缺资源计数和 body/mind 快照，便于审计工作、学习、缺资源与身心后果。

验收命令：

```bash
node --test --experimental-strip-types tools/agent-server/test/infinite-world-runtime.test.ts tools/agent-server/test/resource-production-rules.test.ts tools/agent-server/test/life-profile-rules.test.ts tools/agent-server/test/infinite-world-lifecycle-e2e.test.ts
npx --yes --package typescript tsc -p tools/graph-react-app/tsconfig.agent-server.json --noEmit
npx --yes --package typescript tsc -p tools/graph-react-app/tsconfig.agent-tests.json --noEmit
```

截至本次接入，相关 node:test 覆盖 51 个测试并全部通过。两个 typecheck 当前都会停在同一个既存错误：`tools/agent-server/lib/mcpSampling.ts:207` 将 `ok` 推断为 `boolean`，不满足 `McpTaskSamplingOutcome` 的 literal `true` 分支；该文件不在本次授权修改范围内。

### 5.1 世界压力

`worldPressureRules.ts` 实现以下规则：

- 压力类型：`survival`、`economic`、`social`、`political`、`legal`、`ecological`、`military`、`informational`、`supernatural`。
- 状态：`latent`、`detected`、`contested`、`mobilized`、`resolving`、`resolved`、`transformed`、`dormant`、`catastrophic`。
- 阈值：机会阈值 25，自动制度响应阈值 45，critical escalation 阈值 75，critical 未处理 4320 世界分钟后可灾变。
- review 间隔：background 10080、local 1440、serious 360、critical 60、catastrophic 5 世界分钟。
- `deriveEpochWorldPressuresFromFactSignals` 从事实信号派生/合并压力。
- `advanceEpochWorldPressures` 按世界分钟推进压力漂移、衰减、灾变或转化。
- `deriveEpochWorldOpportunitySeeds` 只为满足机会阈值的非终止压力产出 seed。
- `projectEpochWorldPressureEvent` 生成压力投影事件，不是 `CausalWorldEventV1` envelope。

运营时先查压力的 `sourceFactEventIds`。没有事实来源的压力不能用于任务、叙事或验收。

### 5.2 主体心智

`actorMindRules.ts` 实现有限心智，不实现全知 NPC：

- need tier：survival、safety、belonging、dignity、achievement、transcendence。
- active goal 默认 3 个，queued goal 默认 5 个。
- goal adoption threshold 默认 52，replacement margin 默认 12。
- active commitment 权重达到 65 时可阻断候选目标。
- `scoreActorGoalCandidate` 只使用主体已知 `beliefs`，评分由需求、价值、角色义务、关系义务、预期收益、身份适配、紧急度、可行性、风险、资源成本、法律成本、承诺冲突组成。
- `actionProposal` 要求所有 basis belief 都存在于 actor mind 的 `beliefs` 中，并要求行动占用至少 1 世界分钟。

心智模块只产出 goal/proposal，不直接 commit 世界事实。

### 5.3 知识与 RAG 可见性

`knowledgeStateRules.ts` 区分：

- kind：`fact`、`observation`、`claim`、`belief`、`rumor`、`deception`、`refutation`、`memory`。
- trust class：`untrusted_client`、`user_verified_web`、`server_hosted_agent`、`host_attested`、`remote_attested_runner`、`system_worker`。
- channel：`canonical`、`memory`、`direct`、`hearsay`、`public`、`private`、`adversarial`、`unknown`。
- visibility scope：`public`、`region`、`organization`、`agent`、`explorer`、`evidence`。
- legal access：`public`、`owner`、`member`、`operator`、`source-bound`。

`buildKnowledgeState` 会规范化来源链、置信度和可见性。`refutation` 会把目标标为 `contested` 或 `refuted`，但 belief 不会自动消失。`canAccessKnowledgeRecord` 是权限边界。

`knowledgeView` 合并 caller 可见的 typed records、world memory hits 和 world knowledge hits；输出 guidance 明确：retrieval hit 不会把 memory 提升成 global fact。

### 5.4 经济、商店与制作材料

当前经济分为 read model 和 unified economy proposal 两部分。

经济 runtime read model 已实现：

- `inventoryInfoView(projection, input)`：从投影读取背包条目，可按 `agentId`、`explorerId`、`bound`、`tradable` 过滤。
- `shopInfoView(input)`：按 region 读取 shop offers。
- `marketInfoView(projection, input)`：读取 market orders 和 risk restrictions。
- `directTradesInfoView(projection, input)`：读取 direct trades。

`mcpTools.ts` 暴露了既有工具名：`obsidian_epoch.inventory`、`obsidian_epoch.shop`、`obsidian_epoch.create_item`、`obsidian_epoch.craft_item`、`obsidian_epoch.purchase_shop_offer`、`obsidian_epoch.bind_item`、`obsidian_epoch.market`、`obsidian_epoch.direct_trades`、`obsidian_epoch.create_market_order`、`obsidian_epoch.fill_market_order`、`obsidian_epoch.cancel_market_order`、`obsidian_epoch.create_direct_trade`、`obsidian_epoch.accept_direct_trade`、`obsidian_epoch.cancel_direct_trade` 等。

`unifiedEconomyRules.ts` 已实现 `proposeEconomyPurchase`、`proposeEconomySale`、`proposeEconomyCraft`、`proposeEconomyRepair`，版本为 `obsidian-epoch-unified-economy-v0.1.0` / `2026.07.20-materials-v1`。统一经济规则使用 `minor` 整数字符串、动态价格、费用和材料 provenance：

- 默认手续费 500 bps，默认修理费 1000 bps。
- 价格倍率硬下限 3000 bps，硬上限 25000 bps。
- 默认买入 spread 1200 bps，卖出 spread 1500 bps。
- 质量范围 1..100，制作 waste 800 bps，硬范围 100..4500 bps。
- inventory bucket：available、reserved、in_transit、held_in_custody、equipped、leased、seized、damaged、consumed、destroyed。
- 默认资源包括 coin 以及 iron_alloy、carbon_flux、hardwood、fuel_coke、leather、woven_cloth、standard_thread、reinforced_thread、resonant_alloy、domain_alloy、aether_fiber、resonant_thread、domain_silk、spirit_grain、meridian_salve、foundation_dew、formation_core、domain_jade、tribulation_conductor。
- 默认配方包括 `forge_field_blade`、`forge_resonant_guard`、`sew_travel_cloak`、`sew_aether_sash`、`repair_metalwork`、`repair_textile`。

`proposeEconomyCraft` 会校验 recipe、材料 provenance、技能、workstationQuality、processControl；成功时消耗材料，失败时可产出 byproduct，制作唯一物时生成 `unique_item_lifecycle` 和 title/possession 相关 effects。`proposeEconomyRepair` 只接受 repair recipe 和 repairable item，按修理质量与确定性失败规则更新耐久。

materials crafting catalog 已实现为机器可读目录，状态是 `draft_for_simulation`，核心不变量包括：

- 不掉落通用 skill shard。
- 材料必须有世界 provenance。
- 非唯一材料至少三条获取路径。
- 敌人掉落必须来自库存或解剖来源。
- 技能点和资格不能作为物品购买。
- NPC 和玩家制作使用同一材料守恒规则。
- 配方解锁需要 event evidence。
- 制作不能绕过力量体系资格。
- 所有材料和物品转移必须原子、可重放。

材料 model 要求字段包含 `materialId`、`tier`、`quality`、`quantity`、`unit`、`traits`、`condition`、`contamination`、`ownership`、`legalClass`、`sourceEventIds`、`contentVersion`。材料 tier 已定义 0 至 5：凡材、感应材、精炼材、共鸣材、领域材、极点材。已读到的样例材料包括 `iron_alloy`、`carbon_flux`、`hardwood`、`fuel_coke`。

### 5.5 修行、天赋、技能与携带格

`progressionRules.ts` 的版本常量：

- `PROGRESSION_RULESET_VERSION = "progression-roguelite-v1"`
- `PROGRESSION_BALANCE_VERSION = "2026.07.20-v1"`
- `PROGRESSION_CONTENT_VERSION = "2026.07.20-materials-v1"`

基础属性：strength、agility、physique、intellect、willpower、spirituality。创建校验要求六项各 20 至 40，总和 180。

功能阶段 1 至 6：

| 阶段 | 名称 | functional xp | 主技熟练度 | 洞见 | 软上限 | skill points |
|---:|---|---:|---:|---:|---:|---:|
| 1 | 感应 | 0 | 0 | 0 | 40 | 3 |
| 2 | 周天 | 120 | 100 | 20 | 50 | 5 |
| 3 | 立基 | 360 | 250 | 20 | 60 | 7 |
| 4 | 凝相 | 780 | 500 | 40 | 70 | 9 |
| 5 | 开域 | 1500 | 700 | 60 | 80 | 11 |
| 6 | 渡劫/合道 | 2700 | 900 | 80 | 90 | 13 |

已实现命令提案：

- `proposeAttributeEvidence`：`commandType = progression.attribute_evidence_recorded`，namespace `identity`，只给 `attribute_evidence.<attribute>` 的 xp，不直接加属性点。
- `proposeBreakthrough`：`progression.functional_stage_advanced`，消耗突破材料并生成 `state_transition`。
- `proposeTalentAllocation`：`progression.talent_manifested`，生成 `knowledge_delta`，天赋是 mechanic-first 图，不是文本标签。
- `proposeSkillUnlock`：`progression.skill_node_unlocked`，消耗 skill points 和材料，生成 unlock knowledge effect。
- `proposeRespec`：`progression.skill_node_respecced`，同节点/同分支/跨传承分别消耗 insight，跨传承还消耗 lineage mark；primary power system 同身份内禁止重置。
- `proposeExpandCarry`：`lineage.loadout_capacity_expanded`，namespace `lineage`，生成 `carry_permission`。
- `convertRunReward`：`progression.run_reward_converted`，按结局保留 functional xp、insight 和材料，不保留临时 build，不直接加属性点。

硬上限：

- talent capacity 初始 5，最大 9；active talent slots 初始 2，最大 5。
- carry slots 基础 3，硬上限 5。
- deployment capacity 基础 6，硬上限 10。
- quick-use slots 基础 2，硬上限 3。
- echo slots 基础 1，硬上限 6。
- insurance layers 硬上限 2。

携带校验还要求：主核心 `mainCore` 最多 1 个；同类非主核心最多 2 个；quest item 不能带入。

### 5.6 强度、评分与战斗力关系

当前代码不提供全局战斗力。

`combatReadinessVector` 输出 10 维准备向量：offense、protection、mobility、control、perception、sustain、reserve、corruptionResistance、synergy、adaptation。向量由有效属性、method、equipment、preparation、状态倍率、环境倍率和 matchup 倍率混合。

`estimateEncounterSuitability` 要求 encounter weights 总和为 10000 bps。它计算：

- `pressure = 100 * threatPoints / (threatPoints + 120)`。
- `suitability` 为 10 维向量加权。
- 胜率用 logistic 函数从 suitability 与 pressure 差值估算。
- band：critical、disadvantaged、contested、favored、dominant。

`missionConsequenceRules.ts` 的 `calculateMissionIntensity` 区分客观 `worldIntensity` 和对局显示 `encounterIntensity`。`scoreMission` 的说明明确：战斗力只进入执行适配，直接评分权重为 0；反刷衰减最高按 35% 计入。

### 5.7 任务与后果

正式任务由 `MissionContract` 表示。已实现校验要求：

- `contractId`、`worldId` 必填。
- `rootPressureIds` 至少一个。
- `objectivePredicates` 至少一个，目标必须有 `targetRef` 和正权重。
- 有奖励时必须有 `rewardFundingRef`。
- 风险值必须在 0..100。

状态机：

- `offered -> accepted | expired | abandoned`
- `accepted -> active | abandoned | expired`
- `active -> resolved | failed | abandoned | expired`
- terminal：resolved、failed、abandoned、expired

结局：

- clean_success、costly_success、partial_success -> resolved
- withdrawal -> abandoned
- timeout -> expired
- failure、catastrophe、stalemate -> failed

`proposeMissionConsequences` 会生成 state transition、资源、声誉、伤势、压力、知识等 `CausalEffectV1` proposal。撤退、失败、灾难、超时仍会保留后果。

### 5.8 治理、生态与叙事

`applyGovernanceAction` 支持治理 action：appoint_office、enact_law、amend_law、repeal_law、adopt_policy、levy_tax、impose_sanction、resolve_succession、split_faction、merge_factions。

治理 action 必须有：

- `sourceRef`
- `oppositionRefs`
- 满足 `requiredAuthorityRefs` 的 `authorizationRefs`
- 足够财政容量
- succession 解析时 claim 必须存在且为 asserted

成功会返回排序后的 `GovernanceState`、`CausalEffectV1[]` 和压力信号。失败不会改 state/effects，但会返回 policy backlash 压力信号。

`advanceEcologyTick` 推进区域资源 stock、物种 population 和跨区域 flow。它会校验容量、库存、不可逆阈值和物种/资源流端点，返回 ecology effects 和污染/承载力损失压力信号。资源 stock effect 使用 `resource_ledger`；物种 population effect 使用 `world_predicate`。

`deriveGovernancePressures` 从低合法性、高腐败、低凝聚和逾期义务派生压力信号。

`causalNarrativeRules.ts` 明确叙事是视图/提案层：

- `deriveCausalNarrative` 从事件、压力、actor mind、caller 可见知识派生 threads、opportunities、cases、promises、debts、relationship beats。
- 默认 pacing budget：threads 8、opportunities 8、cases 5、promises 8、debts 8、relationship beats 12，anti-repeat 10080 世界分钟。
- thread transition 有状态机约束。
- opportunity 必须来自可见压力、可见知识和 active goal。
- `settleNarrativeCandidate` 输出 effects、pressure seeds、knowledge seeds；它不直接写 canonical ledger。

### 5.9 超凡、死亡、轮回与事业

`evaluateSupernaturalCast` 已实现超凡能力校验：

- actor 只能是 active 或 injured。
- capability 必须注册 source、operation、target type、permission、prerequisite、knowledge、cost、cooldown、counter window。
- 禁止 rewrite past fact。
- 想创建 new fact 时，capability 必须允许 `mayCreateWorldFact`。
- 非 observe/forecast 的动作必须有 counter window，且窗口长度满足 capability 最小要求。
- resource cost 必须可支付，数量为整数字符串。

成功会返回 cost_paid、cooldown_set、risk_applied、counter_window_opened，以及 knowledge_delta 或 bounded_state_delta proposal。

`settleMortalityAndLegacy` 的死亡/轮回状态机：

- healthy/injured -> injure -> injured
- injured/critical/dying -> mark_dying -> dying
- dying/critical 且有 lethal injury、medical evidence、witness -> confirm_death -> dead
- dead -> settle_legacy -> legacy_settled
- legacy_settled -> issue_reincarnation -> reincarnated

遗产和轮回要求：

- legacy settlement 和 reincarnation 必须先确认死亡。
- inheritance 必须有 `inheritance:<lineageRef>:<heirRef>` 或 `system_authorized`。
- carry_in_slot、insurance_policy 资产还要求 `authorized:<assetId>`。
- 回响不能完整复制前世数值；继承 echo strength 上限 3500，达到 8000 会被拒绝。

`advanceLegacyProject` 推进 lineage project。active 项目必须有当前 stage、所需 input、人员和维护费。维护费不足会进入 `blocked`，记录 maintenance effect 和 state effect；风险达到 10000 会失败；阶段完成后进入下一阶段或 completed。

## 6. 世界 Tick 与 LOD

`causalSimulationLodRules.ts` 已实现四级 LOD：

| LOD | 标签 | tick 间隔 | 模型 |
|---:|---|---:|---|
| 0 | aggregate | 1440 | population、ecology、regional supply/demand、background faction pressure |
| 1 | named_background | 360 | needs、commitments、goal selection、coarse action |
| 2 | important_active | 60 | belief updates、plans、resource reservations、institutional actions |
| 3 | present_or_journey | 5 | fine actions、dialogue、combat、immediate observations |

提升条件：玩家接近、active pressure severity >= 75、不可逆事件、承诺在 1440 世界分钟内到期。降级条件：安静至少 10080 世界分钟、active pressure <= 29、玩家不接近；降级时保留 commitments、debts、injuries、ownership、relationships、key_beliefs、open_cases。

`shouldRunCausalSimulationLodTick` 只判断是否达到当前 LOD 间隔，不负责执行领域 tick。

## 7. 快照、迁移与旧账本适配

`createCausalWorldSnapshot` 创建 schema version 1 快照，内容包括：

- replay cursor、event references、event hashes。
- balances、ownership。
- active pressures 与 backlog。
- knowledge records 与 counts。
- actor mind、LOD 分布。
- domain extensions。
- checkpoint metadata 和 snapshot hash。

`applyCausalEventToSnapshot` 会先检查 continuity：

- worldId 必须一致。
- event hash 不能冲突。
- stream version 必须连续。
- 同 stream 世界时间不能倒退。
- 重复 event hash 默认报 duplicate；允许 duplicate 时返回原 snapshot。

它只直接应用 balances 和 ownership effects。压力、知识、心智等域状态需要通过投影或 snapshot 输入提供。

`migrateCausalSnapshot` 支持：

- 空 snapshot -> empty v1。
- v1 snapshot -> 校验后 unchanged。
- future snapshot version -> rejected。
- legacy snapshot -> 尝试把 `events` 或 `legacyEvents` 转为 event references；没有 canonical hash 的 legacy event 标记 warning。

`causalEpochAdapter.ts` 将 `CausalWorldEventV1` 包成 legacy `EpochEvent` 的 `causal_world_event_recorded`，并能从旧 `EpochEvent` 生成 `LegacyCausalViewV1`。旧 view 是只读兼容视图，不是新 canonical event。

## 8. 指标与 SLO

`createCausalObservabilityCollector` 支持记录：

- `causal_commit_total`
- `causal_reject_total`
- `causal_replay_total`
- `causal_projection_degraded_total`
- `causal_conservation_error_total`
- `causal_schema_error_total`
- `causal_pressure_backlog_total`
- `causal_knowledge_leakage_reject_total`
- `causal_lod_subject_total`
- `causal_migration_total`
- `causal_migration_duration_ms`

低基数 label 只保留 outcome、code、kind、status、dryRun、lod。SLO 阈值可配置：

- `maxRejectRate`
- `maxProjectionDegradedTotal`
- `maxSchemaErrors`
- `maxConservationErrors`
- `maxPressureBacklogDue`
- `maxCriticalPressureBacklog`
- `maxKnowledgeLeakageRejects`
- `maxMigrationDurationMs`

health 规则：

- 有 SLO violation -> `unready`。
- 无 SLO violation 但出现 projection degraded trace -> `degraded`。
- 其他情况 -> `ok`。

## 9. Runtime 暴露面

`createEpochRuntime` 当前主要挂接既有 runtime：auth、abuse、result page、public read model、high value confirmation、idempotency、attestation、server hosted、exploration、region news、maintenance、downtime、NPC、market、journey 等。

`mcpTools.ts` 暴露的玩家/运营工具包括身份、旅程、世界读模型、世界时钟、world content/knowledge/memory、maintenance、downtime、region info、经济/商店/市场、组织、外交、回合卡、server hosted 等。

`runtime.ts` 已提供 `causalWorldEvents(input)` 读取入口，用 `causalWorldEventsFromEpochEvents` 从既有 `EpochEvent` 中筛出 `causal_world_event_recorded`。

`infiniteWorldRuntime.ts` 已实现独立的 `createInfiniteWorldRuntime(options)`，内部使用 causal write coordinator、in-memory idempotency store、snapshot、observability、migration 和 `causalWorldEventToEpochEvent`。它支持的 `InfiniteWorldCommandType` 是：

- `world_tick`
- `mission_settle`
- `economy_buy`
- `economy_sell`
- `economy_craft`
- `economy_repair`
- `progression_reward`
- `progression_breakthrough`
- `progression_talent`
- `progression_skill`
- `progression_carry`
- `governance_action`
- `supernatural_cast`
- `legacy_transition`
- `project_tick`

执行结果是 `InfiniteWorldRuntimeResult`，包含 causal write result 和转换后的 `epochEvents`。runtime 会记录 commit/replay/reject/projection degraded/validation errors/pressure backlog/LOD distribution，支持 `snapshot()`、`checkpoint()`、`migrate()`、`health()`、`events()`、`resultForIdempotencyKey()` 和 `drain()`。

注意：`infiniteWorldRuntime.ts` 是已实现 runtime 模块，但本次核对未发现它作为独立 `obsidian_epoch.*` MCP 工具直接暴露。MCP 直接可调用面仍以 `mcpTools.ts` 的 tool registry 为准。`deriveCausalNarrative` 当前仍是库级派生/settlement proposal，不在 `InfiniteWorldCommandType` 中。

## 10. 兼容与回滚

兼容原则：

1. 不改旧事件字节，不重分配旧 event id。
2. 新事件可引用旧 event id 作为 parent/evidence，但旧事件不需要反向引用新事件。
3. 旧事件通过 `LegacyCausalViewV1` 只读展示 causal status。
4. snapshot 迁移失败时不得写入迁移后 snapshot。
5. schema registry hash mismatch 时应拒绝使用该 snapshot，重新从 ledger replay 或执行显式迁移。

回滚步骤：

1. 停止新 writer 或将 writer enforcement 切到 `retired`，允许 replay，禁止新写。
2. 保留已提交事件，不删除、不原地改写。
3. 对错误业务结果追加补偿事件、撤销事件或 admin correction event。
4. 废弃有问题的投影/snapshot，从最后可信 checkpoint 或 ledger replay 重建。
5. 对 legacy adapter 只调整读取解释，不把 legacy view 写回 canonical ledger。

## 11. 十局验收步骤

以下是人工/自动化验收流程描述，不要求在本手册生成时运行测试。

1. 建立一个 v1 empty snapshot，确认 schema registry hash、checkpoint、replay cursor 存在。
2. 提交一次 root event 写入，确认 `CommandResultManifestV1.status = committed`，event proof 三个 hash 存在。
3. 用相同 command/idempotency/input 重放，确认返回 replayed，不追加第二条事件。
4. 用相同 idempotencyKey 但不同稳定输入提交，确认 idempotency conflict。
5. 生成 survival/economic/legal/supernatural 等事实信号，派生压力，确认压力 id 稳定、reviewAt 按严重度 band 计算。
6. 让至少一个压力达到机会阈值，确认 opportunity seed 或 narrative opportunity 引用 root pressure 和可见 evidence。
7. 为一个 actor mind 只提供部分 beliefs，确认目标评分不会引用未知 belief，proposal 缺 belief 时被拒绝。
8. 结算一局 clean success、一局 withdrawal、一局 failure、一局 catastrophe，确认任务状态、压力 delta、伤势/压力/知识后果均按结局保留。
9. 结算至少一局 progression reward，确认只产生 functional xp、insight、材料保留，不直接增加属性点；另验一局 carry loadout 超上限会失败。
10. 建立一次 legacy project 和一次死亡/轮回链，确认维护费不足会 blocked，死亡未确认不能 settle legacy，授权继承只产生有限 echo。

通过标准：十局后 snapshot replay continuity 无 stream gap/world time regression，资源守恒无 `RESOURCE_UNBALANCED`，唯一 title 无 `OWNERSHIP_CONFLICT`，knowledge view 无越权记录，SLO health 不为 `unready`。

## 12. 故障排查

| 症状 | 先查 | 处理 |
|---|---|---|
| 写入被拒绝 `CAUSAL_SCHEMA_UNKNOWN` | event type 是否在 registry policy 中 | 登记 schema/policy，或改用已登记 event type |
| `CAUSAL_SCHEMA_INVALID` | envelope 字段、canonical JSON、retired writer | 修正候选事件，不回写旧事件 |
| `CAUSAL_PARENT_MISSING` | parent 是否存在、同 world、不是未来事件 | 补充 parent/evidence；root 事件必须使用允许 root reason |
| `ROOT_PRESSURE_REQUIRED` | command/event 是否缺 rootPressureIds | 从 fact signal 派生压力后再生成任务/机会 |
| `ORPHAN_EFFECT` | effect.sourceEventIds 是否为空或不在允许直接来源 | 使用 parent/evidence/command/event id 作为 source |
| `STREAM_VERSION_CONFLICT` | snapshot replay cursor 和 expected version | 从最新 checkpoint 重建 write snapshot |
| `RESOURCE_UNBALANCED` | entries 总和与 source/sink | 普通转移总和归零；铸造/销毁必须声明 source/sink |
| `NEGATIVE_BALANCE` | balances 和 credit limit | 先 reservation/escrow/补足资金，再提交 |
| `OWNERSHIP_CONFLICT` | active title owner | 先 release/expire/dispute 旧 title，再 grant 新 title |
| projection degraded | `project` 回调异常 | 保留 committed event，重放投影，不重提 command |
| knowledge 泄漏 | caller、legalAccess、scope、evidenceIds | 调整 visibility，不在 RAG 层提升权限 |
| snapshot registry mismatch | snapshot.schemaRegistryHash | 使用当前 registry replay，或执行显式迁移 |
| LOD 不 tick | lastTickWorldMinute 与 LOD interval | 用 `shouldRunCausalSimulationLodTick` 判断，再调领域 tick |

## 13. 明确未支持边界

当前实现不支持或不能宣称支持：

- 不支持 LLM 直接写入权威世界；只能提交 proposal。
- 不支持删除或原地改写 canonical event。
- 不支持用 snapshot 替代 ledger 证据链。
- 不支持旧事件批量重写为新 causal event。
- 不支持用全局战斗力决定胜负或任务评分。
- 不支持按任务强度直接给属性点。
- 不支持无 source account、库存、reservoir、escrow 或 audited mint 的奖励。
- 不支持 RAG、memory hit、UI panel 修改余额、产权、死亡或任务状态。
- 不支持超凡能力 rewrite past fact。
- 不支持未确认死亡时结算遗产或签发轮回。
- 不支持完整复制前世数值到 lineage echo。
- 不支持把 narrative thread/opportunity/case 的派生视图当作已提交事实。
- 不支持假设所有 causal domain rule 已经暴露为 MCP 工具；已接入 `InfiniteWorldRuntime` 的命令类型和 `mcpTools.ts` 的工具注册要分别核对。
