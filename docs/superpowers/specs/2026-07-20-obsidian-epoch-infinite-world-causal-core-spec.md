# 《黑曜纪元》无限世界因果核心规范 v0.1

状态：Draft

日期：2026-07-20

配套数据：`2026-07-20-obsidian-epoch-infinite-world-causal-core-catalog-v1.json`

关联规范：

- `2026-07-20-obsidian-epoch-progression-roguelite-balance-spec.md`
- `2026-07-20-obsidian-epoch-balance-catalog-v1.json`
- `2026-07-20-obsidian-epoch-materials-crafting-catalog-v1.json`

## 0. 规范结论

《黑曜纪元》的“无限”不得依赖无限地图、无限材料、无限境界或无限随机任务。

本项目把无限世界定义为：

> 一组有限、稳定、可验证的世界规则，在持续变化的主体、资源、信息、制度和历史条件下，能够组合出不可穷举但仍然保持因果一致的新局面。

世界的最小闭环为：

```text
事实变化
-> 形成世界压力
-> 被有限认知的主体感知
-> 主体形成目标与承诺
-> 主体提交行动计划
-> 服务端校验权限、资源、时间和能力
-> 行动产生直接结果与副作用
-> 结果进入经济、关系、法律、生态和信息系统
-> 其他主体作出反应
-> 形成新的事实变化
```

只有走完这条链的内容，才是世界内容。单独生成的文本、事件标题、NPC 台词和奖励描述不构成世界事实。

## 1. 目标

本规范负责建立以下能力：

1. 玩家离线时，世界仍能在服务端调度下产生有根因的新历史。
2. NPC、家庭、组织和地区能根据需求、认知、关系、预算与风险采取行动。
3. 任务由真实世界压力和行动机会派生，而不是先生成任务再补写理由。
4. 事实、观察、说法、信念、谣言、谎言和记忆具有不同状态。
5. 玩家经济与区域经济使用同一套库存、订单、产权和结算语义。
6. 法律、组织治理、公共服务和权利争议可以自行进入状态机。
7. 成功、部分成功、失败、撤退和放弃都继续生成世界后果。
8. 修行和超凡能力不能绕开权威账本、资源守恒、权限和因果链。
9. 世界历史增长后仍可快照、重放、迁移、追赶、检索和恢复。
10. 轮回提供跨人生事业与历史关系，而不是单纯重置角色数值。

## 2. 非目标

v0.1 明确不追求：

1. 对所有 NPC 进行逐分钟完整模拟。
2. 使用 LLM 直接裁定资源变化、战斗结果、法律结果或历史事实。
3. 根据玩家等级动态缩放整个世界的客观危险度。
4. 让所有信息自动对所有角色可见。
5. 让所有失败都永久毁灭世界，或让所有损失自动复原。
6. 用单一“战斗力”替代能力结构、准备程度和环境适配。
7. 用无限垂直数值增长维持长期动力。
8. 在没有迁移计划时自动改写旧事件含义。

## 3. 最高级不变量

以下规则优先级高于具体玩法：

### 3.1 权威事实不变量

- 只有 canonical event ledger 可以改变权威世界。
- 所有投影、RAG、面板、新闻和叙事均为事件账本的派生视图。
- LLM 只能提交 proposal，不得直接写入权威状态。
- 每个结果事件必须引用命令、父因果事件或系统推导来源。
- 已发生事件不得删除或原地改写，只能追加更正、撤销、补偿或迁移事件。

### 3.2 资源与产权不变量

- 物品、货币、能源、劳动力时段和设施产能不得无来源生成。
- 每次资源增加必须声明来源类型：生产、采集、转移、系统铸币、恢复或迁移。
- 每次资源减少必须声明去向类型：消费、损耗、转移、销毁、征收、冻结或沉没。
- 所有权、占有、保管、租赁、抵押、扣押和携带权必须分别记录。
- 商店出售的物品必须来自商户库存、生产订单或明确的系统补货源。

实现映射：

- 资源节点生产已经接入 `infiniteWorldRuntime.ts` 的正式命令：`resource_node_register`、`resource_production_assign`、`resource_produce`、`resource_node_replenish`。对应 canonical events 为 `resource_node_registered`、`resource_production_assigned`、`resource_production_committed`、`resource_node_replenished`。
- `resource_produce` 必须使用 `resourceProductionRules.ts` 生成的零和 `resource_ledger` effect，在同一因果事务中扣减 `resource_node_inventory:<nodeId>` 并增加目标账户；节点 `remainingUnits` 与 `depletedAtWorldTime` 由事件 payload 投影进快照，不允许由调用方直接改账。
- 生活画像已经接入 `life_profile_create`、`life_profile_advance`，对应 `life_profile_created`、`life_profile_advanced`。吃、喝、工资、学费和学习材料支出都映射为统一 `resource_ledger` effect；缺资源、工作、学习、身体与心理后果保存在事件 audit payload 和 `domains.lifeProfiles` 快照状态。
- `world_tick` 会确定性推进快照中到期的 `domains.lifeProfiles`，因此生活 schedule 不再只是未接入纯函数。资源生产仍由明确命令驱动，但节点耗竭状态会随快照重放恢复。
- 快照新增强类型 `domains.resourceProductionNodes`、`domains.resourceProductionAssignments`、`domains.lifeProfiles`，均按 id 稳定排序；旧快照缺失 `domains` 时规范化为空集合，仍保留 `worldId` 防串库检查。

### 3.3 主体行动不变量

- NPC 行动必须能追溯到需求、价值、关系义务、命令、承诺或已知威胁。
- 行动必须占用时间，并在需要时占用预算、物品、设施、路线或人力。
- 主体只能基于自身可获得的信息制定计划。
- 角色不得因为引擎拥有全局事实而获得全知能力。
- 违反角色边界、法律权限或玩家授权的行动必须被拒绝、转为争议，或产生明确违法事实。

### 3.4 任务不变量

- 每个正式任务必须至少引用一个 `rootPressureId`。
- 每个任务目标必须对应可观察的世界状态变化。
- 每项任务奖励必须有支付主体、库存来源或系统授权来源。
- 任务过期、失败和被他人完成后，世界状态仍然继续推进。
- 纯教学或沙盒任务必须显式标记，不得伪装为共享世界事实。

### 3.5 信息不变量

- “真实”与“某人相信它真实”必须分开存储。
- 每条观察、说法、信念和记忆必须有来源与获得时间。
- 角色知识查询必须经过身份、关系、地域、媒介和权限过滤。
- 更正事实不得自动删除旧信念，只能触发信念更新机会。
- 谣言可以错误，但它的传播行为和造成的后果是真实世界事件。

### 3.6 历史兼容不变量

- 同一规则版本、内容版本、随机种子和输入事件必须产生同一裁定结果。
- 新版本不得用新算法重新解释已经结算的旧事件。
- 内容升级必须提供兼容、继承、冻结或迁移策略。
- 快照只能加速重放，不能替代其前置事件的证据链。

## 4. 世界分层

### 4.1 四个持久化命名空间

| 命名空间 | 保存内容 | 生命周期 |
|---|---|---|
| `world` | 地理、组织、经济、法律、生态、公共历史 | 世界永久 |
| `lineage` | 家系事业、遗产、长期契约、学派与设施权益 | 多次轮回 |
| `identity` | 当前身份属性、关系、技能、债务、声誉与身体状态 | 单个人生 |
| `run` | 本局临时资源、临时祝福、局内路线与未固化记忆 | 单次 Journey |

跨命名空间转移只能由明确事件完成，禁止通过读取投影直接复制。

### 4.2 七层运行结构

| 层 | 职责 | 是否权威 |
|---|---|---|
| 事实层 | canonical event ledger | 是 |
| 世界状态层 | 库存、人口、设施、区域、组织、生态投影 | 否，可重建 |
| 主体认知层 | 观察、信念、记忆、信任与未知项 | 否，可重建 |
| 决策层 | 需求、目标、承诺、计划和行动 proposal | proposal 非权威 |
| 制度层 | 市场、合同、法律、政治、公共服务状态机 | 结果由事件权威化 |
| 叙事层 | 线程、前线、章节、焦点和摘要 | 否，不得创造事实 |
| 体验层 | Journey、面板、RAG、新闻和 UI | 否 |

## 5. 通用事件契约

所有新增领域事件至少包含：

```ts
type CausalWorldEvent = {
  eventId: string;
  eventType: string;
  schemaVersion: string;
  worldId: string;
  occurredAtWorldMinute: number;
  recordedAt: string;
  actorRefs: string[];
  subjectRefs: string[];
  regionRefs: string[];
  causalParentEventIds: string[];
  rootPressureIds: string[];
  commandId?: string;
  idempotencyKey: string;
  authorizationRef?: string;
  contentVersion: string;
  rulesetVersion: string;
  deterministicSeed?: string;
  payload: Record<string, unknown>;
  evidenceRefs: string[];
  visibilityPolicyRef: string;
};
```

额外约束：

- `causalParentEventIds` 必须在同一世界中存在，或标记为迁移根。
- 同一聚合体的世界时间不得倒退。
- 同一 `idempotencyKey` 只能产生一组等价结果。
- 跨聚合事务必须使用 reservation、commit、release 或 compensation，不得部分静默成功。
- 任何 effect 都必须记录 before、delta、after 或可重建的等价信息。

## 6. 世界压力系统

### 6.1 定义

世界压力不是故事标签，而是事实状态与目标状态之间可量化的差距。

```ts
type WorldPressure = {
  pressureId: string;
  type: PressureType;
  scopeRef: string;
  sourceFactEventIds: string[];
  affectedActorRefs: string[];
  affectedResourceRefs: string[];
  severity: number;
  urgency: number;
  growthRate: number;
  uncertainty: number;
  visibility: number;
  state: PressureState;
  counterPressureIds: string[];
  openedAtWorldMinute: number;
  reviewAtWorldMinute: number;
  expiresAtWorldMinute?: number;
};
```

压力类型：

- `survival`：饥饿、疾病、住房、照护。
- `economic`：短缺、失业、欠薪、债务、价格失衡。
- `social`：歧视、家庭冲突、阶层阻塞、信任崩塌。
- `political`：合法性、权力竞争、政策反弹、腐败。
- `legal`：案件积压、权利侵害、判决不执行。
- `ecological`：承载力下降、污染、物种失衡、灾害风险。
- `military`：边境威胁、战争准备、占领、治安失控。
- `informational`：谣言、保密泄露、知识缺口、宣传冲突。
- `supernatural`：异常、污染、规则裂隙、超凡失控。

### 6.2 生命周期

```text
latent
-> detected
-> contested
-> mobilized
-> resolving
-> resolved | transformed | dormant | catastrophic
```

规则：

- 压力必须由事实投影推导，不能由叙事层凭空创建。
- 压力可以被多个主体以互相冲突的方式解释。
- 解决一个压力可以制造其他类型压力。
- 已解决压力保留历史，不继续占用活跃调度预算。
- 长期无人处理的压力根据类型增长、衰减、扩散或转化。

### 6.3 压力派生示例

```text
粮食库存覆盖天数 < 安全线
-> survival pressure
-> 家庭削减消费
-> 商户提高报价并发起采购
-> 政府讨论限价或救济
-> 走私者发现套利机会
-> 谣言传播导致抢购
-> 治安、政治与信息压力同时上升
```

## 7. 主体心智与行动系统

### 7.1 主体类型

- 个人：玩家身份、NPC、历史人物。
- 家户：共享预算、照护义务、居住和继承关系。
- 组织：企业、宗门、军队、政府、协会、犯罪集团。
- 群体：阶层、职业群、信仰群体、难民群体。
- 地区代理：只用于低精度宏观决策，不得伪装成具体人物。

### 7.2 主体状态

```ts
type ActorMind = {
  actorRef: string;
  needs: NeedState[];
  values: ValueWeight[];
  roles: RoleObligation[];
  beliefs: BeliefRef[];
  relationships: RelationshipRef[];
  commitments: CommitmentRef[];
  activeGoals: GoalRef[];
  queuedGoals: GoalRef[];
  constraints: ConstraintRef[];
  riskTolerance: number;
  planningHorizonWorldMinutes: number;
  simulationLod: 0 | 1 | 2 | 3;
};
```

### 7.3 需求

需求分为：

| 层级 | 示例 | 未满足后果 |
|---|---|---|
| 生存 | 食物、睡眠、医疗、庇护 | 疾病、死亡、迁徙、犯罪 |
| 安全 | 收入、治安、稳定关系 | 储备、投靠、逃离、激进化 |
| 归属 | 家庭、同伴、组织、信仰 | 孤立、依附、寻找群体 |
| 尊严 | 公平、认可、自主、身份一致 | 抗争、退出、复仇、申诉 |
| 成就 | 技艺、财富、职位、创造 | 学习、创业、竞争、冒险 |
| 超越 | 真理、使命、传承、修行 | 长期事业、献身、立法、探索 |

需求不得直接生成动作。它先形成候选目标，再经过主体知识、能力、关系、预算和风险评估。

### 7.4 目标评分

候选目标使用配置化权重计算，不使用固定剧情优先级：

```text
goalScore =
  needRelief
  + valueFit
  + roleDuty
  + relationshipDuty
  + expectedGain
  + identityFit
  + urgency
  + feasibility
  - expectedRisk
  - resourceCost
  - legalCost
  - commitmentConflict
```

具体权重见配套 catalog。目标评分只决定行动候选顺序，不保证成功。

### 7.5 承诺

承诺是连接多日、多年和多次轮回历史的核心对象：

- 合同与债务。
- 家庭照护与抚养。
- 组织职责与军令。
- 誓言、师徒关系和修行戒律。
- 法律义务与判决。
- 对玩家作出的约定。
- 跨轮回事业中的 lineage commitment。

承诺必须包含主体、受益方、内容、期限、代价、违约条件、可转移性和证据。

### 7.6 行动 proposal

主体决策层输出：

```ts
type ActionProposal = {
  proposalId: string;
  actorRef: string;
  goalRef: string;
  beliefRefs: string[];
  intendedEffects: EffectIntent[];
  requiredResources: ReservationRequest[];
  requiredTimeWorldMinutes: number;
  requiredCapabilities: CapabilityRequirement[];
  targetRefs: string[];
  legalBasisRefs: string[];
  consentRefs: string[];
  fallbackPlanRefs: string[];
  expiresAtWorldMinute: number;
};
```

服务端必须在权威层完成权限、库存、占用、路线、时间、法律和能力校验。

## 8. 多尺度模拟

### 8.1 LOD 分层

| LOD | 对象 | 模拟方式 | 默认频率 |
|---|---|---|---|
| 0 | 遥远群体、普通生态、背景产业 | stock/flow 聚合 | 每世界日 |
| 1 | 命名但不在场的 NPC、家户、组织 | 目标与承诺级 | 每 6 世界小时 |
| 2 | 关键 NPC、当前地区组织、活跃冲突 | 计划与行动级 | 每世界小时 |
| 3 | 玩家附近、Journey 场景、即时对抗 | 精细动作级 | 每 5 世界分钟或按回合 |

### 8.2 升降级规则

- 与玩家、关键 NPC、活跃压力或不可逆事件发生关联时升级 LOD。
- 长期无交互且无高强度压力时降级 LOD。
- 升级必须基于聚合账本物化个体状态，不能凭空创建与历史冲突的细节。
- 降级必须保留债务、承诺、伤病、关系、产权、关键记忆和未决案件。
- 同一事实在不同 LOD 下只能有一种权威结果。

## 9. 信息、信念与记忆系统

### 9.1 信息对象

| 对象 | 含义 | 是否等于事实 |
|---|---|---|
| `Fact` | 权威账本确认的发生项 | 是 |
| `Observation` | 某主体通过感官或工具获得的信息 | 不一定完整 |
| `Claim` | 某主体对某命题的公开或私下表达 | 否 |
| `Belief` | 某主体当前接受的命题及置信度 | 否 |
| `Rumor` | 经传播链转述且来源衰减的 claim | 否 |
| `Deception` | 主体知道或怀疑其错误但仍传播的 claim | 否 |
| `Refutation` | 针对 claim 或 belief 的反证 | 可能仍被拒绝 |
| `Memory` | 主体对观察、关系与事件的主观保存 | 否 |

### 9.2 信念契约

```ts
type Belief = {
  beliefId: string;
  holderRef: string;
  proposition: StructuredProposition;
  confidence: number;
  stance: "accept" | "reject" | "uncertain";
  sourceObservationIds: string[];
  sourceClaimIds: string[];
  acquiredAtWorldMinute: number;
  lastReviewedAtWorldMinute: number;
  visibilityPolicyRef: string;
  decayModelRef: string;
  contradictionRefs: string[];
};
```

### 9.3 传播

一次传播至少考虑：

- 信源当前置信度。
- 接收者对信源的领域化信任。
- 媒介保真度。
- 时间和传播跳数衰减。
- 是否存在可验证证据。
- 命题是否符合接收者既有信念与利益。
- 是否受到审查、宣传、恐惧或群体压力影响。

传播只产生 observation、claim 和 belief 更新，不直接改写 fact。

### 9.4 权限

知识可见性至少支持：

- 本人私密。
- 明确授权对象。
- 家庭或组织角色授权。
- 地域公开。
- 世界公开。
- 法律调取。
- 仅持有证据者可见。
- 已封存但可通过调查解锁。

RAG 查询必须使用调用者身份生成 `knowledgeView`，禁止直接把全局索引当作角色知识。

## 10. 统一经济状态机

### 10.1 经济主链

```text
需求缺口
-> 购买/生产意图
-> 预算冻结或信用审批
-> 买单/工单
-> 撮合或承接
-> 采购原料
-> 运输与保管
-> 劳动和设施生产
-> 验收与产权交割
-> 现金结算
-> 完成 | 争议 | 违约 | 破产 | 执法
```

### 10.2 统一库存

所有库存使用同一套 bucket：

- `available`
- `reserved`
- `in_transit`
- `held_in_custody`
- `equipped`
- `leased`
- `seized`
- `damaged`
- `consumed`
- `destroyed`

区域库存、商户库存、组织仓库、家庭库存和玩家库存都是同一模型的不同 owner/scope 投影。

### 10.3 订单

订单至少支持：

- 买单和卖单。
- 限价与预算上限。
- 数量、质量和交付地点。
- 全部成交或部分成交。
- 货币冻结和库存冻结。
- 运输承担方。
- 税费、运费、保险和风险溢价。
- 取消、过期、违约与争议。

### 10.4 劳动与制造

生产工单必须包含：

- 配方和工艺版本。
- 原料及允许替代项。
- 工具、设施、能源与槽位。
- 技能门槛和熟练度影响。
- 工时、班次、工资与责任人。
- 半成品、废料、返工、设备损耗。
- 品质分布与失败分支。
- 所有权和委托加工关系。

铸造、缝纫、炼制、烹饪、建筑和研究必须复用工单语义，不能各自建立互不兼容的资源扣除逻辑。

### 10.5 信贷与破产

金融合约至少包含本金、利率、期限、还款计划、担保、抵押、优先级和违约条款。

破产按以下顺序处理：

```text
暂停非必要支付
-> 识别受保护资产与基本生存需求
-> 资产和债务登记
-> 债权排序
-> 重组或清算
-> 产权交割
-> 社会、法律和组织后果
```

不得把负余额直接归零。

## 11. 法律、治理与权利状态机

### 11.1 案件状态机

```text
incident_recorded
-> complaint_filed | authority_detected
-> jurisdiction_checked
-> investigation_opened
-> evidence_collected
-> charge_filed | dismissed
-> hearing_scheduled
-> verdict_issued
-> appeal_filed | enforcement_started
-> restitution_completed | sentence_completed | unresolved
-> case_closed | case_reopened
```

每个阶段必须有权限、期限、证据标准和可申诉路径。

### 11.2 组织治理状态机

```text
pressure_or_agenda
-> proposal
-> sponsor_and_budget
-> deliberation
-> coalition_or_vote
-> enacted | rejected
-> execution
-> audit
-> maintained | amended | repealed | failed
```

政策必须连接实际预算、岗位、采购、公共服务容量和受影响群体。

### 11.3 声誉向量

禁止使用单一 legend 替代全部社会评价。至少拆分：

- 世界知名度。
- 地区知名度。
- 组织信任。
- 专业信誉。
- 法律记录。
- 恐惧与威慑。
- 个体关系信任。
- 边界与授权信任。

一个角色可以同时“世界闻名、当地被憎恨、专业可信、法律通缉”。

### 11.4 同意与边界

亲密关系、雇佣、医疗、记忆读取、身份代理、长期追随和高风险命令必须使用统一 consent grant：

- 授权者和被授权者。
- 行为范围。
- 数据范围。
- 有效期限。
- 是否可撤销。
- 是否允许转授权。
- 紧急例外和事后审查。

## 12. 生态与人口闭环

生态系统至少跟踪：

- 栖息地容量。
- 物种或功能群数量。
- 食物、能源和水循环。
- 繁衍、死亡和迁徙。
- 捕食、疾病、污染和采集压力。
- 恢复速度和不可逆阈值。
- 人类产业与超凡活动的外部成本。

远方生态使用 LOD 0 stock/flow；玩家附近才物化具体生物。

人口系统至少跟踪出生、死亡、年龄结构、家庭、照护、教育、就业、迁徙和阶层流动。人口不得只是生产与消费倍率。

## 13. 任务与机会生成

### 13.1 Opportunity 契约

```ts
type WorldOpportunity = {
  opportunityId: string;
  rootPressureIds: string[];
  sponsorRef?: string;
  beneficiaryRefs: string[];
  oppositionRefs: string[];
  interventionType: string;
  objectivePredicates: WorldPredicate[];
  availableEvidenceRefs: string[];
  hiddenInformationRefs: string[];
  capabilityRequirements: CapabilityRequirement[];
  resourceRequirements: ReservationRequest[];
  legalConstraints: string[];
  rewardFundingRef?: string;
  worldIntensity: number;
  expiresAtWorldMinute: number;
};
```

### 13.2 生成顺序

```text
读取活跃压力
-> 找到受影响主体与可能干预者
-> 枚举合法、非法和中立干预方式
-> 检查是否有真实目标状态
-> 检查资源、时间、路线和奖励来源
-> 生成 opportunity
-> 根据玩家 knowledgeView 暴露其中一部分
-> Journey 只负责呈现和交互
```

### 13.3 对局强度

对局强度是世界客观属性，不随玩家战斗力自动缩放：

```text
worldIntensity =
  opposition
  + environmentalHazard
  + objectiveComplexity
  + informationUncertainty
  + logisticalBurden
  + legalPoliticalRisk
  + irreversibility
```

同一机会面对不同构筑，显示为不同的 readiness gap，但 `worldIntensity` 不变。

### 13.4 战斗力与评分

- 战斗能力只影响与战斗相关的 capability fit 和执行结果。
- 社交、侦查、制造、医疗、法律、物流和超凡控制可以独立完成任务。
- 高战斗力碾压低强度敌人不得自动获得高评分。
- 低战斗力通过情报、外交、环境和资源规划解决高强度压力，可以获得高评分。

首版评分维度：

| 维度 | 含义 |
|---|---|
| 目标完成 | 世界目标谓词的达成程度 |
| 因果影响 | 是否真正缓解根压力，是否制造更大副作用 |
| 方法质量 | 能力组合、调查、协作和策略质量 |
| 风险承担 | 客观风险与实际暴露，不奖励无意义自残 |
| 完整性 | 证据、授权、承诺和角色一致性 |
| 资源效率 | 时间、物资、伤亡和机会成本 |
| 发现价值 | 新事实、新路线和新解决方案 |

权重和评分档位由 catalog 管理。

## 14. 成败与后果

结果不是二元值：

| 结果 | 定义 |
|---|---|
| `clean_success` | 主目标完成，副作用受控 |
| `costly_success` | 主目标完成，但产生显著代价 |
| `partial_success` | 部分谓词完成，压力被转化或延后 |
| `stalemate` | 状态暂时稳定，核心压力仍存在 |
| `withdrawal` | 主动撤退，保留部分资源或人员 |
| `failure` | 目标未达成，产生明确后果 |
| `catastrophe` | 失败触发不可逆或跨区域后果 |

每次结束至少写入：

- 目标谓词变化。
- 根压力变化或转化。
- 资源、伤病、死亡和设施变化。
- 关系、声誉、承诺和法律变化。
- 新观察、说法、新闻和记忆。
- 新机会、追责、救援或复仇入口。

只有完全未向共享世界提交任何 canonical effect 的试演，才允许作为 private mirror 丢弃。

## 15. 叙事导演与内容生命周期

### 15.1 叙事导演职责

叙事导演是只读选择器，不是事实生成器。它负责：

- 识别高因果价值的活跃前线。
- 维护未解决承诺、宿敌、秘密和代价。
- 控制近期重复与主题疲劳。
- 选择应该向玩家展示的机会和角色。
- 形成章节摘要、时代转折和历史回顾。
- 给内容生成器提供事实边界和允许空白。

它不得凭空制造死亡、奖励、关系、组织决策或世界状态。

### 15.2 叙事线程

每条线程包含：

- 根压力与起源事件。
- 相关主体和互相冲突的目标。
- 已知事实、秘密和错误信念。
- 未兑现承诺和未偿代价。
- 当前阶段与可能的转化方向。
- 最近使用的场景、主题和解决方式。

### 15.3 内容生命周期

```text
draft
-> test
-> active
-> cooldown
-> active | deprecated
-> superseded | retired
-> archived
```

“无限内容”必须同时拥有生成、冷却、合并、继承、失传、复兴和退役机制。

## 16. 修行与超凡能力的世界接口

每个技能、天赋、功法、仪式和超凡物品必须声明：

```ts
type WorldCapability = {
  capabilityId: string;
  verbs: string[];
  domains: string[];
  validTargetTypes: string[];
  rangeModelRef: string;
  durationModelRef: string;
  resourceCosts: ResourceCost[];
  timeCostWorldMinutes: number;
  prerequisites: string[];
  resistanceModelRef: string;
  cooldownModelRef?: string;
  sideEffectModelRefs: string[];
  evidenceSignatureRefs: string[];
  legalClassRefs: string[];
  informationAccessPolicyRef?: string;
  temporalSemanticsRef?: string;
};
```

硬约束：

- 时间能力不能删除已经发生的事件。
- 预知只能产生带不确定度的 observation 或 branch forecast。
- 复活追加新的生命状态，不删除死亡事实及其期间后果。
- 记忆修改改变 belief/memory，不改变 fact。
- 读心必须经过能力范围、抵抗、证据签名和授权/违法判定。
- 传送必须处理路径绕过带来的边境、物流、税收和安全影响。
- 召唤物和复制物必须有来源、持续时间、所有权和消散去向。

## 17. 轮回与长期事业

### 17.1 跨人生保留规则

| 内容 | 默认归属 |
|---|---|
| 世界事件、制度、城市和公共历史 | `world` |
| 家系设施、学派、长期事业与可继承权益 | `lineage` |
| 当前身体、职位、私密关系、债务和技能熟练 | `identity` |
| 临时祝福、局内消耗、未固化路线 | `run` |

### 17.2 长期事业类型

- 建立或改造组织。
- 创立学派、技艺或修行传统。
- 建造跨时代设施和交通网络。
- 解决持续数代的世界压力。
- 保存、封印、公开或篡改知识。
- 培养继承者和建立传承规则。
- 与跨世宿敌、盟友或制度持续互动。

### 17.3 社会连续性

轮回不会自动继承全部私人关系，但可以通过以下桥梁重新连接：

- 血缘和家系档案。
- 遗嘱、信物和契约。
- 学派或组织身份。
- 他人保存的记忆与传说。
- 可验证的灵魂或超凡证据。
- 对前世承诺的主动认领。

## 18. 世界调度流水线

每个 canonical world tick 按固定阶段运行：

```text
1. 接收并排序已提交事件
2. 更新事实投影
3. 更新库存、人口、设施、生态和组织状态
4. 派生、增长、衰减或转化世界压力
5. 更新主体 observations、beliefs、needs 和 commitments
6. 选择到期主体并生成 action proposals
7. 校验授权、资源、时间、路线、能力与法律
8. 预留资源并裁定行动
9. 追加结果、补偿与副作用事件
10. 推进订单、物流、制造、案件与政策状态机
11. 传播 claim、rumor、refutation 和 news
12. 派生 opportunities 与 narrative threads
13. 更新 RAG、面板和世界健康指标
14. 在满足条件时生成可验证快照
```

同一 tick 中产生的二阶结果默认进入下一阶段或下一 tick，避免无界递归。

## 19. 长期运行与历史治理

### 19.1 快照与重放

- 快照必须绑定最后事件 ID、事件哈希、规则版本和内容版本。
- 恢复时从最近兼容快照开始，仅重放其后的事件。
- 定期执行从创世事件重放的离线审计，但不得作为每次启动路径。
- 热历史、温历史和冷历史可以分区，证据链不得断裂。

### 19.2 内容和算法版本

每次变更必须归类：

| 类型 | 处理方式 |
|---|---|
| 纯展示变化 | 不迁移事件 |
| 新增内容 | 旧世界可选择启用时间 |
| 可兼容规则变化 | 新事件使用新版本，旧事件保持旧语义 |
| 不兼容规则变化 | 显式迁移事件与 successor map |
| 删除内容 | 冻结、继承、退役或替换，不直接消失 |

### 19.3 可用性

- 权威写入失败时进入只读保护，而不是继续接受可能丢失的成功响应。
- 世界时钟积压必须自动分批追赶，并暴露 lag。
- 关键投影和 RAG 可以降级，但必须标记 freshness 和 semantic availability。
- 新 ledger、投影和 namespace 必须自动进入备份清单或由 schema registry 发现。

## 20. 世界健康指标

必须持续观测：

- `world_clock_lag_minutes`
- `canonical_append_failure_total`
- `replay_events_per_second`
- `snapshot_age_events`
- `projection_lag_events`
- `rag_index_lag_events`
- `orphan_effect_total`
- `resource_conservation_violation_total`
- `active_pressure_count_by_type`
- `unhandled_critical_pressure_age`
- `actor_goal_starvation_rate`
- `order_fill_rate`
- `wage_default_rate`
- `shipment_failure_rate`
- `case_backlog_age`
- `public_service_queue_age`
- `rumor_correction_rate`
- `opportunity_without_root_pressure_total`
- `content_repetition_rate`
- `world_irreversible_loss_rate`
- `world_recovery_capacity`

任何违反资源守恒、孤儿 effect、任务无根因或版本不匹配都属于 correctness failure，不是普通健康告警。

## 21. 首版事件族

v0.1 应至少新增或统一以下事件族：

### 21.1 压力与主体

- `world_pressure_opened`
- `world_pressure_updated`
- `world_pressure_transformed`
- `world_pressure_closed`
- `actor_need_changed`
- `actor_goal_adopted`
- `actor_goal_abandoned`
- `actor_commitment_created`
- `actor_commitment_breached`
- `actor_action_proposed`
- `actor_action_rejected`
- `actor_action_resolved`

### 21.2 信息

- `observation_acquired`
- `claim_communicated`
- `belief_updated`
- `rumor_propagated`
- `deception_detected`
- `claim_refuted`
- `memory_corrected`
- `knowledge_access_granted`
- `knowledge_access_revoked`

### 21.3 经济

- `purchase_intent_created`
- `budget_reserved`
- `budget_released`
- `market_order_placed`
- `market_order_matched`
- `work_order_created`
- `labor_contract_signed`
- `shipment_dispatched`
- `shipment_delivered`
- `goods_accepted`
- `ownership_interest_changed`
- `payment_settled`
- `payment_defaulted`
- `bankruptcy_opened`

### 21.4 制度

- `case_opened`
- `evidence_submitted`
- `verdict_issued`
- `appeal_filed`
- `restitution_ordered`
- `restitution_completed`
- `policy_proposed`
- `policy_enacted`
- `policy_audited`
- `consent_granted`
- `consent_revoked`

### 21.5 任务与历史

- `world_opportunity_opened`
- `world_opportunity_expired`
- `journey_committed`
- `journey_objective_updated`
- `journey_consequence_committed`
- `narrative_thread_opened`
- `narrative_thread_transformed`
- `era_closed`
- `lineage_project_advanced`

## 22. 验收场景

以下场景全部通过，才能声称因果核心形成最小闭环：

### 22.1 粮食危机

歉收必须导致库存下降、需求压力、采购订单、价格变化、运输机会、家庭应对和政府议题。玩家失败后，危机继续发展而不是复位。

### 22.2 工匠死亡

关键工匠死亡必须降低真实产能、影响未完成工单、触发继承和赔付，并可能产生培训、招募或走私成品机会。

### 22.3 错误谣言

一个错误但可信的谣言必须能改变 NPC 信念和行为；官方辟谣不得自动清除所有旧信念。

### 22.4 非战斗高分

低战斗能力角色通过调查、谈判和物流解决高强度危机时，可以获得高评分；纯武力造成更大副作用时评分下降。

### 22.5 法律追责

玩家或 NPC 的违法行为必须产生证据、案件、管辖、裁决和可申诉后果，而不是只扣声望。

### 22.6 离线世界

玩家离线 30 世界日后，经济、关系、组织、案件、压力和新闻均有可追溯变化，并能解释每项变化的根因。

### 22.7 超凡边界

时间、记忆、传送和复活能力不能删除历史事件或无来源生成资产，其影响必须通过标准事件写入。

### 22.8 长历史恢复

世界存在百万级事件后，必须能从兼容快照恢复、验证后续哈希并继续推进，而不是从创世逐条重放作为唯一启动方式。

### 22.9 NPC 拒绝

NPC 面对违反价值、承诺、法律或风险容忍度的命令时，能够拒绝、谈判、欺骗、举报或退出。

### 22.10 任务根因

随机抽查所有正式任务，每项都能追溯到压力、受益者、目标谓词、奖励来源和到期后的世界走向。

## 23. 实施顺序

### Phase 0：事件与投影边界

- 建立通用 causal event envelope。
- 建立 schema registry、版本策略和幂等契约。
- 补齐资源守恒、孤儿 effect 和任务根因校验。
- 不改变现有玩法表现。

### Phase 1：压力、心智与信息

- 实现 WorldPressure 状态机。
- 实现 ActorMind、goal、commitment 和 proposal。
- 实现 Fact/Observation/Claim/Belief 分离。
- 使用现有任务与 NPC 系统作为适配器。

### Phase 2：统一经济与任务

- 合并区域、商户、组织、家庭和玩家库存语义。
- 实现买单、预算预留、工单、运输和交割。
- 让 Opportunity 从压力和主体需求派生。
- 让失败结果反向更新压力与经济。

### Phase 3：治理、生态与叙事

- 实现案件、政策、公共服务和 consent 状态机。
- 建立生态与人口 stock/flow。
- 将叙事导演限制为事实只读选择器。
- 加入内容冷却、退役、继承和时代闭幕。

### Phase 4：轮回与长期运行

- 建立 lineage project 和跨世承诺。
- 实现可跳跃快照、历史分区和增量恢复。
- 建立内容迁移矩阵和自动积压追赶。
- 补齐世界健康指标、故障保护和长期压测。

## 24. v0.1 冻结决定

以下决定在进入 Phase 1 前冻结：

1. canonical event ledger 继续作为唯一权威事实源。
2. LLM 仅负责 proposal、语言表达和候选计划，不负责最终裁定。
3. 任务必须从 WorldPressure 派生。
4. NPC 必须基于有限知识行动。
5. 玩家经济与世界经济必须统一库存和产权语义。
6. 对局强度是世界客观值，不按玩家战斗力自动缩放。
7. 对局评分衡量解决质量，不等同于战斗力。
8. 超凡能力不得删除 canonical history。
9. 失败必须生成共享世界后果或明确标记为 private mirror。
10. 新系统优先复用事件、订单、承诺、案件和能力契约，禁止继续建设互不连接的孤岛状态机。

## 25. 暂缓项

在 Phase 2 闭环完成前，暂缓大规模扩充：

- 新境界和新属性。
- 新材料大类。
- 新商店和独立货币。
- 新装备词条池。
- 新随机任务模板。
- 新地图数量。
- 与统一工单无关的独立制造系统。

新增内容必须优先用于验证因果链，而不是扩大目录规模。
