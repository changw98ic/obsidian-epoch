# Agent Strategy Game Loop Spec v2.2

**替代**:`agent-strategy-game-loop-spec.md`(v1,已归档)
**审阅依据**:`agent-strategy-game-loop-spec-review.md` + Codex 三轮审阅(引用已核验)
**状态**:架构基线。**评分语义、后果账本、扮演模型、跨身份连续性、结局页契约已闭合;P0 实现阻断已逐条给出落地点,可进入领域模型冻结与跨模块实现。**

## 修订记录

- **v2.0**:v1 → 可实施骨架(offer 绑定、taskFamily 枚举、身份策略冻结、replay)。
- **v2.1**:评分改后果驱动;worldCommit 二值阈值;offer/action 零加成;Phase 6 作废重跑;server AI。
- **v2.2**(本次):基于 Codex 第三轮审阅 + owner 决策修订 ——
  - **新增 mirror consequence ledger**(action 副作用可重放账本,解决"评分时读不到真实后果"的时序环)。
  - **新增 ConsequenceScore + SettlementDecision 单点派生**(score→tier/reward/worldCommit 一处算,hidden/mainline 硬约束 clamp)。
  - **worldCommit 阈值落地 6 处**(authority/event/receipt/result page/read model/测试)。
  - **身份存续度补完整语义**(公式/阈值/delta/lifetime 触发/防循环计分)+ **NPC 质疑累积与跨 faction 传播**。
  - **新增身份扮演评分**(身份预设生活策略 + agent 偏离触发 NPC 质疑 + 扮演分)。
  - **隐藏前置链路闭合**(object mutation/destroy → hidden prerequisite 持久作用域)。
  - **agent 反馈闭环**(世界信号喂回 prompt,非数值)。
  - **跨身份世界连续性**(世界影响持久,社会恶名不继承)。
  - **结局页呈现**(数值对 agent 与实时玩家均不可见,结局页一次性交代)。
  - **action Public/Internal/Signed 三拆 + 每出口 serializer**。
  - **P0.4 策略影响路径消解**(纯后果驱动,评分多维度自然分叉,不设独立策略加成)。
  - **out-of-scope 明确清单**(延迟后果 / 扮演奖励侧 / 多 agent 交互 / 跨 model replay)。

---

## 1. 设计目标

1. agent 凭**自身角色设定**自主判断选任务、选解法,**看不见任何加成数值**。
2. 评分**后果驱动**:任务成不成看结果;评分看行动对自身和世界的**实际影响**。
3. **身份扮演**:每个身份有预设生活策略,agent 偏离 → NPC 质疑 → 扮演分掉;严重时身份社会性死亡。
4. 策略与后果**不绕过物理裁定**:动作成败、主线/hidden 完成由 server 权威判定。
5. server 自带可选 AI,驱动任务生成与世界推进;AI 不可用时走 catalog/model_sampling fallback。
6. **进行中靠猜,结局页看结果**:数值不实时暴露;一局结束时,结局页一次性交代扮演/存续/世界影响。

---

## 2. 核心设计原则

- **P1 信息不对称**:任务、action、评分对 agent 与实时玩家均零数值暴露;agent 凭角色+剧情+世界反馈推测。
- **P2 评分后果驱动**:评分 = 任务结果 + 自身损耗 + 附带影响。策略向不直接进评分。
- **P3 单点派生**:ConsequenceScore 只算一次,SettlementDecision 统一派生 tier/reward/worldCommit,各处不得重新解释。
- **P4 主策略主导角色化**:主策略 100% 影响身份角色倾向;主完全违背任务时角色化切主 3 : 副 7。本局冻结。
- **P5 物理裁定不可绕过**:评分不能把失败变成功、未完成变完成、无 hidden 变惊世。
- **P6 世界连续性**:世界影响(对象破坏/关系/前置)跨身份持久;社会恶名随身份终结不继承。

---

## 3. 策略偏好系统

### 3.1 五种策略向

| 策略向 | 代号 | 职责定义 | 偏好 taskFamily |
|---|---|---|---|
| 战斗向 | `combat` | 正面冲突、猎杀、清除 | structured_challenge, priority_commission |
| 智谋向 | `cunning` | 欺骗、潜行、信息博弈、计谋、谈判 | information_acquisition, crisis_retreat |
| 辅助向 | `support` | 协助、治疗、保护、掩护撤离 | companion_support, crisis_retreat |
| 后勤向 | `logistics` | 资源调度:押运、守点、采集、制作 | resource_acquisition, resource_preservation, cultivation_material, crafting_material |
| 探索向 | `exploration` | 侦察、测绘、发现未知、路线审计 | information_acquisition, repeated_route_audit |

### 3.2 主副策略 + 本局冻结 + 数据模型

register 时设主策略(5 选 1)与可选副策略,写入 identity 本局冻结。

```ts
interface StrategyProfile { primary: Strategy; secondary?: Strategy; settledAt: string; }
interface IdentityStrategyDisposition {
  primary: Strategy; secondary?: Strategy;
  frozenAt: string; identityId: string;
  strategyPolicyVersion: string; affinityMatrixVersion: string;
}
```

落点:`IssueIdentityInput` + `registerExplorer` + `EpochAgentIdentity` + `identityIssuedPayload`。strategy 字段加在签发层(与 `personalityTraits` 同层)。

---

## 4. 任务市场

### 4.1 零加成公开 offer(PublicQuestOffer)

```json
{
  "questOfferId": "...", "marketSnapshotVersion": 17,
  "taskTypeText": "清除或活捉一只甲壳变异兽",
  "scenarioSummary": "...", "region": {...}, "scenarioMapId": "region_forest",
  "estimatedDifficulty": "medium",
  "rewardPreview": { "authority": "preview_only", "tierRange": ["及格","优秀"], "resourceRange": {...} }
}
```

公开 offer 禁含:`taskFamilyId`/`strategyAffinity`/`fitBps`/`expectedApproach`/任何 bonus 标记。拆 `PublicQuestOffer`(公开) / `InternalQuestOffer`(server 内部,含 taskFamilyId/expectedApproach/offerHash/版本)。

### 4.2 来源:预热 + 领1补2 + 可选 server AI

开服前异步预热一批;领 1 补 2(异步,失败不回滚已领,catalog seed 兜底);server AI 可选。grounded 四层校验(结构/世界/语义/内容),输入冻结完整 world slice。失败 → fail closed。

### 4.3 offer → task plan

QuestOffer 是预览;start_journey 生成完整 JourneyTaskPlan(多目标图 main 3-9 / side 2-4 / 每 objective 2 action)。plan 携 `questOfferId + offerHash + taskFamilyId`。一致性锁(`journeyRules.ts:517`)改"允许从 offer 派生,绑定来源"。

### 4.4 API + 并发状态机

offer lifecycle:`available → reserved → claimed → completed`,旁路 `expired/released`。reservation TTL、prepare_journey CAS、idempotency、过期释放。池范围:默认区域池。

### 4.5 与悬赏系统边界

两套独立。悬赏 = 玩家挂的出口任务;任务市场 = agent 入场任务。

---

## 5. Agent 选择逻辑 + 反馈闭环

### 5.1 纯 LLM 角色化选择

agent 调 `available_quests`(零加成) → 凭 identity(personality/needs/lifeGoal/主副策略角色倾向)+ 剧情推测选任务;scene 内 actionOptions 也是零加成(§12.3),凭角色+场景推测选解法。server 后端算后果。

### 5.2 反馈闭环(非数值世界信号)

agent 不看数值,但**能从世界反馈感知"我演崩了/被怀疑了"**:
- NPC 态度变冷、拒之门外、被跟踪、被盘问、关系信号恶化。
- 这些作为**环境信号**注入 agent 的 scene prompt(不是数值,是叙事态描述)。
- agent 据此自我收紧或加倍放纵 —— 扮演的拉扯乐趣来自这里。
- 复用 `journey-soak.ts:270` 的 `chooseAction` 思路做角色化 prompting(不做硬过滤)。

---

## 6. 评分模型(后果驱动,★ 核心)

### 6.1 概览:三层评分 + 单点派生

```
评分(ConsequenceScore) = 任务结果 + 自身损耗 + 附带影响
                              ↓ (hidden/mainline 硬约束 clamp)
                       SettlementDecision
                       ↙      ↓       ↘
                    tier    reward   worldCommit
```

策略向不进评分公式(§6.12)。评分多维度累积,不同策略 agent 因行为与后果自然分叉,相同评分概率极小。

### 6.2 mirror consequence ledger(★ 新,P0.1)

**问题**:当前镜像 action 提交时不产生世界影响事件(`gameCore.ts:9717-9764`),真实影响在 `solidifyJourneyWorld`(`gameCore.ts:9942-9971`)后才生成。评分在决定固化前读不到真实后果。

**方案**:定义可重放的 **mirror consequence ledger** —— 每个 action 提交时,其世界副作用(对象 mutation、关系 delta、前置破坏、资源/寿命 delta)即时写入 journey 内的 mirror ledger(非 canonical)。

- ledger 条目:`{ actionEventId, effectKind, targetEntityId, delta, consequenceType }`,按 canonical event ID 去重(P1.2)。
- discard:`solidify` 不发生 → ledger 丢弃(本局影响不进 canonical 世界)。
- solidify:ledger **原子提升**为 canonical events(`solidifyJourneyWorld` 批量提交)。
- 现有 `journeyWorldImpactRules.ts:47-69` 只是按 risk 推导,不替代 ledger —— ledger 是真实 effect 流。

### 6.3 ConsequenceScore 构成

```ts
interface ConsequenceScore {
  resultScoreBps: number;       // 任务结果(主线/支线/目标达成度,物理裁定)
  selfLossScoreBps: number;     // 自身损耗(资源/生命/身份磨损,按 §6.7 去重)
  collateralScoreBps: number;   // 附带影响(对象破坏/关系崩塌/前置毁坏/身份存续/扮演)
  totalBps: number;             // 加权合计
  breakdown: ConsequenceBreakdown;  // 明细,receipt/结局页用
}
```

- **自身损耗去重**(P1.2):同一损耗只在 4 处(`JourneyActionResolution.resourceCost` / `resource_spent` event / `HostedActionRecordedPayload.lifetimeDelta` / `lifetime_adjusted` event)取**单一 canonical source**,按 event ID 去重。
- **附带影响**累积自 mirror ledger:object 破坏、faction/NPC 关系 delta、hidden 前置毁坏、身份存续度变化、扮演分变化。

### 6.4 SettlementDecision 单点派生(★ 新,P0.5)

```ts
interface SettlementDecision {
  score: ConsequenceScore;
  tier: Tier;                    // §6.5
  reward: RewardGrant;           // §6.6
  worldCommit: WorldCommitDecision;  // §6.7
  hiddenClamp: HiddenClamp;      // hidden/mainline 硬约束施加的 clamp 记录
}
```

**唯一派生点**:score → tier/reward/worldCommit 全部在此算一次。其它处(receipt/result page/read model)只读 SettlementDecision,不得重新解释。

现有 `phase6_score.v2`(`journeyRunReceiptRules.ts:7-13`)是独立合约,本 spec 的 SettlementDecision 是 Journey 层,Phase 6 层在其上叠加(见 §12)。

### 6.5 tier 硬约束 + 完整映射(P0.1 惊世 + P0.5)

tier ∈ {未及格, 及格, 良好, 优秀, 惊世}。

| 条件 | tier 上限 |
|---|---|
| 主线未完成 | 未及格(不可救回) |
| hidden 未完成 | 封顶**优秀** |
| hidden 完成 | 可达**惊世**(惊世**只能**由 hidden 完成触发,`journeyGeneratedTaskRules.ts:1616`) |

score→tier 映射(阈值,可 balance 校准):
- 未及格:< 4000 bps 或主线未完成
- 及格:4000-5500
- 良好:5500-7000
- 优秀:7000-8500(hidden 未完成封顶)
- 惊世:≥ 8500 且 hidden 完成

penalty 降级链:惊世→优秀→良好→及格(保底未及格仍按失败)。tier 降到及格及以下 **且** 身份存续度跌破阈值 → identity lifetime 加速损耗或终结(§6.8)。

### 6.6 reward modifier(P1.1)

按 tier 派发(现有 `JOURNEY_TIER_REWARDS`),加 `scoreRewardModifier`:
- 资源倍率:score 高 → 上浮(舍入规则:向下取整到整数资源单位);score 低 → 下浮。
- **负奖励禁止**:reward ≥ tier 基础保底。
- 倍率上下限:0.5x – 1.5x。
- item 数量/稀有度:按 tier 表(`ITEM_REWARD_RARITY_BY_TIER`),score 高 → 稀有度档位 +1(封顶 tier 允许档)。
- 账本 reason:`strategy_score_modifier`(与现有 `journey_grade` reason 并列,不混)。
- 幂等:同 journey 重复结算只发一次(`grantJourneyReward`)。

### 6.7 worldCommit 二值阈值 + 6 处落地(P0.6)

```ts
canonEligible = mainLineSucceeded && score.totalBps >= CANON_THRESHOLD
worldCommit = canonEligible ? solidifyJourneyWorld(ledger) : { status: "discarded", ... }
```

修死代码 `quality_below_canon_threshold`(`mcpTools.ts:2563`)。**6 处统一落地**:
1. server authority `gameCore.ts:9813-9858`:校验 canon threshold(当前只校验 0-10000)。
2. event payload `events.ts:1109-1123`:`completionScoreBps` 改 required,加 `canonThreshold/policyVersion`。
3. `JourneyWorldCommit`(`journeyRules.ts:47-60`):加 `score/threshold/policyVersion` 字段。
4. receipt:versioned,带 score + threshold。
5. result page(`resultPagePayloadRules.ts:145-225`):校验 score/threshold/effects。
6. 测试:现有 `agentCompanionMcp.test.ts:635-648` 断言"主线完成、支线全跳过也 solidified"需更新为新阈值语义。

### 6.8 身份存续度(P0.2)+ NPC 质疑累积与传播

```ts
interface IdentityViability {
  factionStanding: Record<FactionId, number>;  // 各 faction 关系
  flaggedWanted: Set<RegionId>;                 // 被 region 通缉
  identityExposed: boolean;                     // 身份暴露
  doubtedBy: Record<NpcId, DoubtStrength>;      // NPC 质疑强度(扮演分输入)
  viabilityScoreBps: number;                    // 综合存续度
}
```

**完整语义**(P0.2):
- `viabilityScoreBps` = f(faction 关系总和, 通缉 spread, 暴露, 质疑累积) —— 具体权重 balance 校准,首版用线性加权。
- 阈值 `VIABILITY_DEATH_THRESHOLD`:跌破 → identity 社会性死亡 → lifetime 加速损耗(线性倍率)或直接终结。
- **防循环计分**:viability 在评分**之后**投影(用 SettlementDecision 完成后的 world state),其触发的 lifetime delta 不回灌本轮 ConsequenceScore(下轮才生效)。
- **NPC 质疑累积与传播**(点1):
  - 同 faction 内:一 NPC 质疑 → faction 内传播(影响全局 faction standing),传播强度随质疑次数递增。
  - 跨 faction:按设定分"信息共享 / 不共享"——共享则跨 region 通缉,不共享则本地。
  - 换 region 不能躲掉同 faction 的恶名(全局 standing 已扣);跨 faction 不共享区可重新开始(信息不通)。
- 落点:`EpochAgentIdentity` lifetime(`gameCore.ts:598`)+ 新 viability 投影;`identityLifecycleRules.ts:292-320` 的 lifetime delta 加 reason 分类。

### 6.9 身份扮演评分(★ 新,owner 需求)

```ts
interface ExpectedLifePattern {
  identityId: string;
  patternVersion: string;        // 版本,replay 用
  expectedApproaches: ApproachTag[];   // 该身份应有的行为向
  forbiddenApproaches: ApproachTag[];  // 该身份不应有的行为
  factionRoleNorms: Record<FactionId, RoleNorm>;  // faction 内行为规范
}

interface RoleplayScore {
  deviationBps: number;          // 行为偏离度(高=偏离大=扮演差)
  npcDoubtEvents: NpcDoubtEvent[];  // 触发的质疑事件
  exposed: boolean;
}
```

- **身份生活策略**:server 在 identity 签发时,基于 race/role/unit/faction/background 预设 `ExpectedLifePattern`(规则模板兜底 + server AI 丰富,版本冻结)。
- **偏离判定**:每个 action 提交时,server 比对 action approachTags vs ExpectedLifePattern → 命中 `forbiddenApproaches` 或显著偏离 → 产生 `npc_identity_doubt` 事件写入 mirror ledger。
- **NPC 质疑**:server 按规则判(不靠 LLM 随意),可重放;LLM 只做叙事渲染(NPC 对话/态度)。
- **扮演分**:`RoleplayScore.deviationBps` 由质疑事件累积 + 偏离幅度算 → 进 ConsequenceScore 的 `collateralScoreBps`,并喂身份存续度(§6.8 `doubtedBy`)。
- **与 strategyConsistency 分开**:strategyConsistency 看"玩家选的策略向"吻合度;扮演分看"身份生活策略"吻合度。两者可冲突(商人身份 + combat 策略向 → strategyConsistency 高、扮演分低),这是扮演张力来源。

### 6.10 隐藏前置链路(P0.3)

```ts
interface HiddenPrerequisiteLink {
  objectiveId: string;           // 受影响的 hidden objective
  prerequisiteObjectId: string;  // 前置 object
  status: "intact" | "destroyed" | "degraded";
  destroyedAtActionEventId?: string;
}
```

- **object mutation/destroy 语义**:action effect 增加 `object_mutation`/`object_destroy` kind,带 `targetEntityId` + 破坏程度。
- **链路**:action 破坏 object → server 查该 object 是否为某 hidden objective 的 prerequisite(`journeyGeneratedTaskRules.ts:646-682` DAG)→ 是则记 `HiddenPrerequisiteLink.status = destroyed`。
- **持久作用域**:链接入 canonical world(solidify 时),后续 journey 的 hidden adjudication 读取 → 该 hidden objective 标记不可达或降级。
- **修复/恢复**:首版不支持(破坏不可逆);后续可加修复 action。
- 当前 prerequisite 只支持 objective-to-objective DAG + hidden seal 只封存 `{objectiveId, optionKey}`(`journeyGeneratedTaskRules.ts:118-133`),需扩展为含 object 状态。

### 6.11 strategyConsistency + affinity 矩阵角色(P1.3 + P0.4 降级)

```ts
type ApproachTag = "combat" | "stealth" | "diplomacy" | "support" | "logistics" | "scout" | "preservation";
// tag 枚举冻结,unknown tag → fail closed

interface StrategyConsistencyScore {
  matchBps: number;              // 实际 approachTags 累积 vs 主副策略角色倾向的吻合度
  snapshot: ApproachSnapshot;    // approach 快照链(offer→plan→action)
}
```

- affinity 矩阵(taskFamily × strategy,完整表,server 内部参考):

| taskFamily \ strategy | combat | cunning | support | logistics | exploration |
|---|---|---|---|---|---|
| resource_acquisition | penalty | neutral | neutral | **bonus** | neutral |
| information_acquisition | penalty | **bonus** | neutral | penalty | **bonus** |
| structured_challenge | **bonus** | neutral | penalty | penalty | neutral |
| companion_support | penalty | neutral | **bonus** | neutral | neutral |
| resource_preservation | penalty | neutral | neutral | **bonus** | neutral |
| priority_commission | **bonus** | neutral | neutral | penalty | penalty |
| crisis_retreat | neutral | **bonus** | **bonus** | penalty | penalty |
| cultivation_material | penalty | penalty | neutral | **bonus** | neutral |
| crafting_material | penalty | penalty | neutral | **bonus** | neutral |
| repeated_route_audit | penalty | neutral | neutral | neutral | **bonus** |

  矩阵与 §3.1 偏好列全对齐。**不进评分**,仅用于:
  - 标注 taskFamily 预期解法(server 内部)。
  - agent 角色化 prompt 注入(主 100% / 违背主 3 副 7)。
- strategyConsistency 是统计指标,进 storyReport/receipt,**不直接影响 tier/reward/worldCommit**(避免三重奖励)。
- 数据契约:approachTags 是 action 内部字段(§12.3),InternalQuestOffer.expectedApproach 类型冻结;offer→plan→action 快照链全程绑定;缺失/unknown → fail closed。

### 6.12 策略影响路径(★ P0.4 消解)

**owner 决策**:策略影响 tier/reward/worldCommit 全套。**但不设独立策略加成路径**(那会滑回 affinity 加减)。

**实际路径**(间接链路):
```
策略向 →(角色化 prompt)→ agent 行为倾向 →(server 物理裁定)→ 真实后果 → ConsequenceScore → SettlementDecision → tier/reward/worldCommit 全套
```

- 策略不直接加分;它通过角色化导致 agent 选不同 action → 不同后果 → 不同评分。
- 评分多维度累积(结果/损耗/对象/关系/前置/存续/扮演),不同策略 agent 的行为与后果自然分叉;相同 action + 相同后果的概率极小,不为该理论边角设独立机制(YAGNI)。
- **可重放**:identity strategy → 角色化 prompt → agent 行为倾向,固定 LLM seed + modelVersion 可重放。

### 6.13 硬边界

评分**绝不**:把失败 action 变成功;把主线未完成变完成;把无 hidden 变惊世;绕过 `JourneyAutonomyPolicy` 14 字段;绕过资源硬门槛/隐藏条件/prerequisite。

优先级:**安全红线/autonomy policy → mandate → 资源/寿命/needs → 物理裁定 → 评分修饰**。

---

## 7. 结算管线

```
冻结 identity strategy + offer snapshot + ExpectedLifePattern(版本化)
        ↓
mirror action events(物理裁定 + consequence ledger 即时写入)
        ↓
base task adjudication(主线/hidden 完成判定)
        ↓
ConsequenceScore(结果 + 损耗[去重] + 附带影响 + 扮演 + 存续投影)
        ↓
SettlementDecision(tier clamp[hidden/mainline 硬约束] → reward → worldCommit 二值阈值)
        ↓
solidify? ledger 原子提升为 canonical : ledger 丢弃
        ↓
versioned settlement receipt + 结局页 payload + viability/扮演投影回写 identity
```

后果评分只算一次,SettlementDecision 统一派生。

---

## 8. 跨身份世界连续性(点3)

身份终结/archive/reincarnation 时:
- **世界影响持久**:旧身份 solidified 的 canonical events(对象破坏、前置毁坏、关系变化、region 状态)→ 新身份必须面对。世界是连续的。
- **社会恶名不继承**:旧身份的 faction standing / 通缉 / 暴露状态 / NPC 质疑 → 随身份终结清零(新 identityId 是新社会身份)。
- **Exception**:若新身份与旧身份同 faction 且设定上"有关联"(inheritance 字段表明),可部分继承 faction 内恶名(按 inheritance 类型定)。
- 落点:`previousAgentId/nextAgentId/inheritance`(`gameCore.ts:598`)链路上,worldCommit 投影跨身份保留,viability 投影按 identity 重置。

---

## 9. 结局页呈现(点4)

- **数值不实时暴露**:进行中,agent 与实时玩家 console 均看不到加成数值(沉浸感 + 防刷分)。
- **结局页一次性交代**:一局 journey 结束,result page 输出:
  - ConsequenceScore breakdown(结果/损耗/附带影响)
  - tier + reward + worldCommit 决策
  - 身份扮演分(deviation + 关键质疑事件)
  - 身份存续度变化(viability delta)
  - 世界影响摘要(破坏的 object、崩的关系、毁的前置)
  - strategyConsistency 统计
- 落点:`resultPagePayloadRules.ts:145` 扩展 payload schema;现有 grounded result page 协议保留(禁止本地重写,LLM 仅叙事渲染)。

---

## 10. Server AI 基础设施

### 10.1 Provider + 生命周期(P1.4)

```ts
interface QuestGenerationProvider { generate(input): Promise<Proposal>; }
type ServerAiState = "warming" | "ready" | "degraded";
```

- **方案 A**(推荐):Anthropic SDK 直连;**方案 B**:内置 host agent 自举 sampling(B 受限于 sampling client 连接级创建,`mcp.ts:51-71`,不保证开服前预热)。
- **状态机**:`warming`(预热中,available_quests 返回 catalog seed 或 empty+retryAfter)→ `ready`(池就绪)→ `degraded`(AI 不可用,fallback catalog/model_sampling)。
- **server AI 不阻塞 server 启动,不阻塞基础 Journey**。
- **领 1 补 2 原子性**:领成功即入账;补充异步,失败保留旧池,不回滚已领。
- **proposal 准入**:server AI proposal 必须经 §4.2 四层 grounded 校验 + 角色/恶名 red-line 才能产生权威 offer 事件。
- **停机恢复**:重启后从持久化 JSONL 恢复池状态 + warming 重跑未完成批次。

### 10.2 可重现性

AI 输出全持久化(JSONL,带 `generationBatchId/modelVersion/promptHash/worldContentHash/sourceContextHash`)。CI replay 存档,不重调。纯规则路径 strict-serial。**replay 只在"同 modelVersion + 同 seed + 同输入"成立,跨 model 版本不保证**(out-of-scope)。

### 10.3 密钥/成本/限流

密钥环境变量,不入库。`McpSamplingLimiter` 思路给 server AI 单独限流。批量生成监控成本,加缓存。

---

## 11. 与现有系统集成(真实改动表)

| 系统 | 现状 | v2.2 改动 | 关键位置 |
|---|---|---|---|
| Phase 6 matrix | runIndex→taskType 锁死 | **改写 matrix**(不新建 gameMode);同步:evidence 脚本(`phase6-ten-run-evidence.ts:75-86/280-307`)、ten-run gate(`phase6-ten-run.ts:2395-2403`)、receipt 多套版本(`mcpTools.ts:519`/`phase6McpSettlementRuntime.ts:649`/`phase6ExperimentRuntime.ts:77`/`journeyRunReceiptRules.ts:7`)、`Phase6ExperimentState` 加 archived 只读状态;老实验数据归档保留记录 | `phase6ScenarioMatrixRules.ts:19-42`、`mcpTools.ts:3952`、`phase6ExperimentRules.ts:1-7/122/345` |
| taskPlan 一致性锁 | taskType 严格一致 | 改"允许从 offer 派生,绑定来源" | `journeyRules.ts:517` |
| scenarioMapId | = destinationRegionId | 从 offer 取 | `journeyRuntime.ts:404` |
| prepare_journey | 无 offer 绑定 | questOfferId + snapshotVersion + offerHash + CAS + reservation | `mcpTools.ts:4794`、`journeyRuntime.ts:402` |
| identity | 无 strategy/viability/lifePattern | StrategyProfile + Disposition + IdentityViability + ExpectedLifePattern | `gameCore.ts:598/1838`、`runtime.ts:1482`、`identityLifecycleRules.ts:205/292` |
| taskType | 自由 string | taskFamilyId(内部) + taskTypeText(公开) | `journeyGeneratedTaskRules.ts:44` |
| actionOptions | 混合公开 | **三拆**:PublicActionOption(id/label/risk/intent) / InternalActionOption(approachTags/mechanicId/fitBps) / SignedActionOption;为 compact/hosted/session/sampling 每出口定义 serializer;server 按 journeyId+sceneId+actionOptionId+contractVersion 重建内部字段 | `journeySceneContractRules.ts:59/585`、`mcpTools.ts:8938`、`gameCore.ts:9588` |
| mirror consequence | 不存在(影响在 solidify 后产生) | **新建**:action 提交即时写 mirror ledger;solidify 原子提升,discard 丢弃 | `gameCore.ts:9717-9764/9942-9971`、`journeyWorldImpactRules.ts:47` |
| settlement | 分散三处,无 modifier | **ConsequenceScore + SettlementDecision 单点派生** | `mcpTools.ts:2526/2578/2711`、`journeyStoryReport.ts:582` |
| tier 升降 | 不存在 | 新建,score→tier 映射 + hidden/mainline clamp | `mcpTools.ts:2526`、`journeyGeneratedTaskRules.ts:1610` |
| worldCommit | 二值,死代码 | 二值阈值,**6 处统一落地**(§6.7),修死代码 | `mcpTools.ts:2563/2578`、`journeyRules.ts:47`、`gameCore.ts:9813`、`events.ts:1109`、`resultPagePayloadRules.ts:145` |
| reward | 固定 bundle | scoreRewardModifier(倍率/上下限/负奖励禁止/幂等/reason) | `journeyGeneratedTaskRules.ts:207/232`、`mcpTools.ts:2711`、`runtime.ts:1733` |
| 隐藏前置 | 只 objective DAG + hidden seal | object mutation/destroy + HiddenPrerequisiteLink 持久作用域 | `journeyGeneratedTaskRules.ts:118/646/1530` |
| 任务来源 | model_sampling 懒生成 | 预热池 + 领1补2 + 可选 server AI | `journeyGeneratedTaskRules.ts:30/970/1037`、`agentCompanionRuntime.ts:345` |
| catalog fallback | 会 miss | **保留作 seed** | `journeyGeneratedTaskRules.ts:970` |
| episode decision | 纯 LLM createMessage | 保持纯 LLM,角色化注入 + 世界反馈信号(§5.2) | `mcpTools.ts:8427`、`journey-soak.ts:270` |
| storyReport | grounded | LLM 仅草稿,grounding gate 校验;新增 strategyConsistency + 扮演分;不动 identityFidelity 计算 | `journeyStoryReport.ts:582` |
| result page | status/reason/effects | 扩展结局页 payload(§9) | `resultPagePayloadRules.ts:145` |
| identity lifetime | 固定 + 任意 delta | viability 触发加速损耗/终结;delta 加 reason 分类;跨身份世界影响保留、恶名清零 | `gameCore.ts:598`、`identityLifecycleRules.ts:292` |
| bounty | 独立体系 | 不动 | — |

---

## 12. 落地顺序

1. **领域模型冻结**:StrategyDispositionSnapshot / QuestOffer(Public+Internal)/ MarketSnapshot / JourneyTaskRequest(taskFamilyId+taskTypeText)/ IdentityViability / ExpectedLifePattern / ConsequenceScore / SettlementDecision / HiddenPrerequisiteLink / 三拆 ActionOption。
2. **mirror consequence ledger**(§6.2):action 副作用即时写入,solidify 原子提升 / discard 丢弃。
3. **offer 持久化 + 并发 + offer→plan 强绑定**(保留 catalog fallback)。
4. **ConsequenceScore + SettlementDecision 单点派生**(§6.3/6.4):含损耗去重。
5. **tier 硬约束 + reward modifier + worldCommit 二值阈值 6 处落地**(§6.5/6.6/6.7)。
6. **身份存续度 + NPC 质疑累积传播**(§6.8)。
7. **身份扮演评分 + ExpectedLifePattern + npc_identity_doubt**(§6.9)。
8. **隐藏前置链路**(§6.10)。
9. **strategyConsistency 数据契约 + affinity 降级为参考**(§6.11)。
10. **agent 反馈闭环**(§5.2):世界信号注入 prompt。
11. **跨身份世界连续性**(§8)。
12. **结局页 payload**(§9)。
13. **action Public/Internal/Signed 三拆 + 每出口 serializer**(§11)。
14. **Phase 6 matrix 改写 + 影响面同步 + 老数据归档**(§11)。
15. **可选 server AI + 生命周期 + 预热 + replay**(§10)。
16. **balance simulation**(§13)+ 策略天梯(out-of-scope)。

---

## 13. 验收标准

**零加成(防泄露)**:PublicQuestOffer 不含 taskFamilyId/affinity/fitBps/expectedApproach;PublicActionOption 不含 approachTags/mechanicId/fitBps;进行中 agent 与玩家 console 均看不到评分数值。自动化 schema 断言 + prompt 泄露扫描。

**后果评分**:
- 潜行任务开无双完成:结果分满,综合评分低 → tier 低/worldCommit discarded。
- hidden 未完成:封顶优秀;主线未完成:未及格。
- 主线完成 + score ≥ threshold:solidified;否则 discarded。
- mirror ledger:discard 时丢弃不进 canonical,solidify 时原子提升。

**身份扮演**:
- agent 偏离 ExpectedLifePattern → 产生 npc_identity_doubt → 扮演分掉。
- 同 faction 内质疑传播影响 faction standing;跨 faction 不共享区不传播。
- 换 region 不能躲同 faction 恶名。
- viability 跌破阈值 → lifetime 加速;viability 不回灌本轮评分(防循环)。

**隐藏前置**:action 破坏 object 且为 hidden 前置 → 后续 journey 该 hidden 不可达。

**跨身份**:旧身份世界影响(solidified)新身份面对;旧身份恶名清零(inheritance 关联除外)。

**单点派生**:同 canonical events + strategy/affinity/lifePattern 版本 → 相同 SettlementDecision(replay);receipt/result page/read model 不重新解释。

**并发**:offer lifecycle + CAS + TTL + idempotency;领1补2 失败不回滚,catalog seed 兜底。

**Phase 6**:老实验归档只读可查;新规则重跑通过;evidence/ten-run gate/receipt 语义统一。

**Action 序列化**:compact/hosted/session/sampling 每出口 PublicActionOption 不泄露内部字段;commit 按 id 重建验签。

**结局页**:journey 结束 result page 输出完整 breakdown(评分/tier/reward/worldCommit/扮演/存续/世界影响)。

**fail closed**:未知 taskFamily/approachTag、虚构 NPC/object/reward/completion → 不入池/不结算。

**balance simulation**:固定 offer 分布/agent 选择策略/LLM fixture/seed;1000 次比较五策略的任务分布、tier、资源消耗、reward、身份终结率、worldCommit 固化率、扮演分分布。

---

## 14. 已知风险与 out-of-scope

### out-of-scope(v2.2 不做,显式声明)
- **延迟后果**:跨 journey 的因果延迟(毁前置 N 局后暴露、跨 region 报复)。v2.2 只做即时 + 同 region 传播。
- **扮演奖励侧**:v2.2 只做"演崩掉分",不做"演好升声望解锁特权"。
- **多 agent 相互影响**:A 毁的前置坑 B。v2.2 只做单 agent 后果链;mirror ledger 设计预留未来提升为共享 canonical。
- **跨 model 版本 replay**:replay 只在同 modelVersion + seed + 输入成立,LLM 升级后老 replay 不保证。
- **策略天梯**:本版不做,留待独立设计(需 score/trust class/mode/season/verified 定义)。

### 待校准风险
- **固化阈值 / tier 阈值 / viability 阈值**:靠 §13 simulation 校准。
- **logistics 4-bonus 不平衡**:simulation 后可能调矩阵。
- **"完全违背"判定**(角色化主 3 副 7 触发):可能需按 penalty 程度分档。
- **ExpectedLifePattern 生成质量**:规则模板兜底 + server AI 丰富,需校准避免过于刻板。
- **NPC 质疑传播平衡**:同 faction 传播速率、跨 faction 共享设定,需 simulation 调。
- **附带影响归因**:action→object→hidden 前置链路完整性,需落地时验证。
- **narrative grounding gate**:LLM 草稿需补显式 forbidden-claim guard。
