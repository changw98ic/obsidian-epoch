# Agent Strategy Game Loop Spec — 审阅报告

**审阅对象**:`claudedocs/agent-strategy-game-loop-spec.md`
**审阅日期**:2026-07-25
**方法**:spec 内部逻辑分析 + 代码现状核实(6 个只读 Explore agent,覆盖 scenario 绑定 / settlement / decision policy / identity 与任务来源 / Codex 引用核验两组)
**对照基准**:Codex 同题审阅报告(引用核验 15/18 完全属实,0 幻觉,已采纳)

---

## TL;DR

方向对(agent 自主选任务、策略驱动行为),但当前这份 spec 是**设计意图稿,不可直接进入实现**。三层问题叠加:

1. **spec 内部自相矛盾** —— §2.1 与 §5.3 数据打架;"避免千篇一律"的目标被确定性策略规则反向实现;实现优先级表漏掉正文最大的一块。
2. **§6 改动范围表系统性失准** —— 12 行"当前 vs 改为"里 10 行对现状判断失误或漏关键耦合。
3. **§3.2 任务生成方案违背架构现实** —— server 根本没有 LLM,整个"启动预热池"设想不成立。

采纳 Codex 审阅报告作 v2 基线(其引用经核验无幻觉),与本报告合体后给出 **9 条 v2 骨架**。落地前需 owner 拍板 **8 个决策点**(见第七节)。

---

## 一、Spec 内部硬伤(不依赖代码即可证)

### 1.1 §2.1 与 §5.3 自相矛盾 —— 数据基石是裂的

§2.1"偏好任务类型"列与 §5.3 亲和度矩阵 cross-check 出两处直接冲突:

| 策略 | §2.1 声称偏好 | §5.3 矩阵实际 bonus | 冲突 |
|---|---|---|---|
| logistics | resource_acquisition, cultivation_material, crafting_material | 还多了 **resource_preservation** | §2.1 漏 |
| exploration | information_acquisition, **resource_preservation**, repeated_route_audit | information_acquisition, repeated_route_audit | **resource_preservation 在 exploration 列是 neutral,不是 bonus** |

整张矩阵是 affinity 系统的数据基石,基石自相矛盾,后面所有计算都站不住。

### 1.2 "避免千篇一律"目标 vs 确定性规则手段 —— 目标和手段互斥

- §1 目标:"不一味靠 LLM,避免千篇一律"。
- §4.1 手段:`bonus → 优先选 → neutral → 次选 → penalty → 最后`,**全确定性**。
- §4.2 手段:`combat 向 → 永远优先 high-risk combat action`。

同策略的两个 agent 在相同任务市场前会做出**完全相同**的选择。spec 没消除千篇一律,只是把"LLM 的千篇一律"换成"规则的千篇一律"——后者更硬、更难破。真正的多样性全压在 §4.1 第 4 条"同亲和度内 LLM 辅助"和 §4.2 第 2 条"候选内 LLM 角色化",但候选只有 1-2 个,LLM 发挥空间接近零。

### 1.3 实现优先级 §7 漏掉了 §3.2 —— 正文与优先级脱节

§3.2 花最大篇幅讲"任务改 LLM 生成,启动 10 个,每领 1 补 2",但 §7 的 10 步优先级里**没有任何一步是实现 LLM 任务生成**。第 3 步只说"available_quests API 返回列表"。任务从哪来?落地时若退回用现有 catalog,§3.2 吹的 NPC 动机/分支可能/猎杀潜入解密全没了——而那才是 spec 真正想卖的东西。

### 1.4 核心语义被塞进 §8 当 TODO

§8 列了 5 个"待确认",其中至少 3 个是**核心契约,不是边角**:

- **主副策略 affinity 合并规则**:主 bonus × 副 penalty 同时命中怎么算?这是 §4 整个决策逻辑的地基,不定就写不出一行 if。
- **strategyScoreModifier 的应用方式**:§5.1 拍了 `+0.15 / 0 / -0.10` 三个数,但**加到哪**?评分?概率?reward 金额?三种语义天差地别。拍了系数没拍应用点 = 没设计。
- **策略切换**:允许会破坏 identity 一致性,不允许又把用户锁死在可能没 bonus 任务的市场里(见 1.6 + 三)。

### 1.5 策略向严重不平衡

数 §5.3 每个策略向拿到的 bonus 任务数:

| combat | cunning | support | exploration | logistics |
|---|---|---|---|---|
| 2 | 2 | 2 | 2 | **4** |

logistics agent 永远泡在 bonus 池里,其它四个经常被迫选 neutral/penalty。spec 没做任何平衡性自检。

### 1.6 affinity 透明给 agent → 取舍机制自杀

§3.1 把 `strategyAffinity` 直接放进任务展示 JSON 给 agent。agent 若能看见 bonus 标记,按 §4.1 **必然永远选 bonus**,gameplay 没有任何取舍——affinity 系统退化成"给每个策略指定固定任务"。真正的 game design 要让玩家**看不见精确 affinity、只见模糊提示**,才有"该不该冒 penalty 接这个"的张力。spec 把核心信息直接透明给决策者,等于自己废掉自己设计的取舍机制。

---

## 二、§6 "当前 vs 改为" 表系统性失准(代码核实)

| 系统 | spec 说的"当前" | 代码实情 | spec 漏掉的真实改动量 |
|---|---|---|---|
| scenario matrix | runIndex 固定 taskType | ✅ 属实 | 还要解 **runIndex 自动递推**(`mcpTools.ts:3855`)——这才是 agent 选 taskType 的真正拦路虎 |
| identity 发放 | 随机不关联策略 | ✅ 属实 | 字段加 3 处(`IssueIdentityInput`/`registerExplorer`/`EpochAgentIdentity`) |
| prepare_journey | 指定 regionId + taskType | ⚠️ taskType 本来就 agent 选 | 不用改 prepare_journey;要改 `scenarioMapId=destinationRegionId` 耦合(`journeyRuntime.ts:404`)+ `installJourneyTaskPlan` 一致性锁(`journeyRules.ts:517`) |
| begin_phase6_run | assertPhase6ScenarioBinding 强制 | ✅ 属实 | 要松绑 binding + runIndex 推断链 + taskPlan 锁,**三层不是一层** |
| settlement scoring | 纯 taskAdjudication | ⚠️ 下游分散三处,无 modifier 机制 | strategyScoreModifier 要插 3-4 处,不是 1 个函数 |
| tier 升降 | (暗示存在) | ❌ **不存在** | 要**新建**整个升降机制 |
| worldCommit 强弱 | bonus 更强 / penalty discarded | ❌ **二值**,目标分支是**死代码** | 要新建分级 + 先修 `quality_below_canon_threshold` 死代码(`mcpTools.ts:2563`) |
| episode decisions | 纯 LLM createMessage | ✅ 生产路径是 | 但 `journey-soak.ts:270` 已有 `chooseAction` 可复用;sampling-client 不是模块是 capability 名 |
| actionOptions 排序 | (假设可排序) | ❌ 缺 `actionType`/combat 字段 | 要改数据模型 + `buildSignedAction` 签名逻辑 |
| catalog route | catalogFallbackRoute miss | ✅ 属实 | — |
| 任务来源 | 从 catalog/模板取 | ⚠️ **model_sampling LLM 路径已存在** | spec 在重新发明轮子;真要建的池化层撞"server 无 LLM"墙 |
| available_quests | 新增 tool | ✅ 不存在 | 但与现有 `bounty`/`claim_bounty` 语义重叠未去重;注册要改 4 处 |

**12 行里 2 行完全准确,5 行部分属实但漏关键耦合,5 行现状描述错误或凭空假设。**

---

## 三、架构级阻断:server 没有 LLM

这是最致命的一条,直接推翻 §3.2 的核心设想。

- `package.json` 无 openai/anthropic 依赖。全代码库文本生成的唯一通道是 MCP `sampling/createMessage`——**server 反向请求"连接进来的 agent 客户端"代为采样**(`mcpSampling.ts:109/196`)。
- 唯一的服务端直连模型是 `qwenEmbeddingClient`,只做 embedding,不生成。
- 限流:`McpSamplingLimiter` 默认 **2 并发 / 30 req-min / 12k tokens-min**,per-session,无缓存。

后果:
1. spec"server 启动时 LLM 生成 10 个任务"——server 启动时**可能根本没有 client 连接**,sampling 请求无处可发。
2. 任务池生成时机被绑死到"有 client 在线且声明了 sampling capability"。无 sampling 客户端的环境(纯 MCP 工具调用、CI)直接没有任务池。
3. 与 CI strict-serial 可重现性冲突:不仅不可重现,**生成本身取决于 client 在线状态**。
4. 而且 §3.2 在重新发明已有的轮子:`JourneyTaskPlanSource = "model_sampling" | "server_fallback"` 早就存在(`journeyGeneratedTaskRules.ts:30`),`generationRequested=true` 时已通过 Host Sampling 让 client LLM 生成 task plan。当前是"每次 journey 按需即时生成"的懒模式。spec 真正新增的只有"启动预热 + 每领 1 补 2"的池化层——而这一层恰好撞上"server 无 LLM"的墙。

---

## 四、Codex 审阅报告核验

对 Codex 报告的 18 条 `file:line` 引用逐条打开核实(防幻觉):

| 结果 | 计数 |
|---|---|
| 完全属实 | 15 |
| 方向属实,措辞/字段名待修 | 3 |
| 幔觉(字段/函数名编造) | **0** |

三处修正:
- **policy 字段严重省略**:`JourneyAutonomyPolicy` 实际 **14+ 字段**(`maxRisk`/`allowPvP`/`allowPermanentRelationshipChange`/`maxSingleSpend`...),Codex 只列了 2 个。落地"Codex P1.3 策略不凌驾 maxRisk"时,要把全部字段当 hard filter。
- **storyReport 防护是 grounding gate 不是显式禁令**:代码里无 "forbidden-claim" 命名的 guard,是靠 `storyReady` 强制 `serverFacts + sourceEventIds>0 + settled`。Codex P1.8 方向对,落地要在 gate 上加固。
- **identity.traits 三路径并存**(代码债):`personalityTraits` / `identity.personality.traits` / `identity.traits`。strategy 字段加时要避免制造第四种。

**评级:A-。引用真实、判断系统、方案落地,采纳作 v2 基线。**

---

## 五、Codex 与本审阅互补

**共识(双证):** prepare_journey 无任务绑定、worldCommit 二值主线固化、+15% 作用对象不明、server 无 LLM、model_sampling 路径已存在、actionOptions 缺 approach 字段、identity 无 strategy 字段、catalogFallbackRoute miss。

**Codex 补我的(5 条,我承认漏):**
- **P0.1** `questOfferId + marketSnapshotVersion + offerHash` 绑定 —— 指出 prepare_journey 是个**安全漏洞**(agent 可读任务 A、领任务 B、改 taskType 文本绕过亲和度),并给了具体修复。我只说"让 agent 选",没看出这是漏洞。
- **P0.2** `strategyProfile`(长期) vs `identityStrategyDisposition`(本局冻结)二分 —— 防刷分架构。
- **P1.4** main 3-9 / side 2-4 / 每 objective 2 action 约束(`journeyGeneratedTaskRules.ts:20-28`)—— 直接推翻 spec §3.1 的单 objective 示例(spec 示例不符合现有任务图 schema)。
- **P1.5** rewardPreview 不能 LLM 决定 —— spec 示例 `"items":["相位实验舱便携记录器"]` 违反现有奖励账本(`JOURNEY_TIER_REWARDS[tier]`,LLM 不参与)。
- **P1.8** storyReport 禁止本地重写 —— spec §7 第 10 步违反现有 grounded story 协议。

**我补 Codex 的(2 条):**
- **§2.1 vs §5.3 矩阵自相矛盾**(1.1)—— Codex 未提。
- **logistics 4 vs 其它 2 的策略不平衡**(1.5)—— Codex 未做平衡自检。

**关键纠正(我认错):** Phase 6 binding 方向。我最初建议"松绑 assertPhase6ScenarioBinding 三层耦合"是顺着 spec 走;Codex P0.4 直接否了——**不该松绑,应新建独立 `gameMode/rulesetVersion/experimentId`**,保护现有 10 次固定实验的可比性、收据、回放语义。Codex 对。

---

## 六、Spec v2 骨架(9 条,合体结论)

1. **策略是适配层,不是权威层。** 只做:任务排序、候选过滤、适配评分、一致性统计。绝不碰主线完成判定、动作成功、奖励账本、worldCommit。
2. **新建 `gameMode/rulesetVersion/experimentId`,不动 Phase 6 matrix assertion。**
3. **任务市场用 `QuestOffer(offerId + snapshotVersion + offerHash)` 绑定 prepare_journey**,防偷换 region/taskType。
4. **`taskFamilyId`(枚举,矩阵主键) vs `taskTypeText`(自由文本)二分。**
5. **`approachTags/mechanicId/strategyFitBps` 下沉到 actionOption,服务端签名。**
6. **`strategyProfile`(长期) vs `identityStrategyDisposition`(本局冻结)二分防刷分。**
7. **+15% 第一版只作用于 `performance.scoreBps`(评价分)**,不建 tier 升降、不建 worldCommit 分级、不碰死代码 `quality_below_canon_threshold`。
8. **§2.1 与 §5.3 矩阵先对齐**(logistics 的 resource_preservation、exploration 的 resource_preservation)。
9. **`available_quests` 与现有 `bounty/claim_bounty` 去重**,先定关系再建。

---

## 七、落地前必须由 owner 拍板的关键决策点

以下 8 点**不是技术细节,是产品/架构决策**,实现前必须定死。

### D1. 策略循环与 Phase 6 的关系
- **A.** 新建独立 `gameMode/rulesetVersion`,策略循环另起炉灶(推荐)
- **B.** 在现有 Phase 6 matrix 上加 strategy bypass
- **推荐 A。** 保护现有 10 次固定实验序列的可比性、收据、回放语义;B 会让同一协议在不同上下文有不同含义。

### D2. +15%/-10% 的作用范围
- **A.** 第一版只作用于 `performance.scoreBps`(评价分)(推荐)
- **B.** 同时影响 tier 升降 / 奖励 / worldCommit
- **推荐 A。** tier 升降和 worldCommit 分级当前不存在(见第二节),新建成本高;且策略不应成第二套世界权威。

### D3. 任务市场 vs 现有 bounty 系统
- **A.** `available_quests` 是 bounty 的超集/统一入口
- **B.** 替代 bounty
- **C.** 并行第二套(不推荐)
- **需 owner 定方向。** 现有 `create_bounty/claim_bounty` 已有 contract market,不答会造出两个任务市场。

### D4. 任务生成架构(server 无 LLM)
- **A.** 放弃"启动预热池",保留现有每次 journey 按需懒生成(推荐,最小改动)
- **B.** 首个 sampling client 连入时异步预热池
- **C.** 引入服务端 LLM 依赖(违反现有架构,不推荐)
- **推荐 A 起步,B 作为演进。** C 与后端无 SDK 现状冲突。

### D5. agent 能否看见精确 affinity/fit 分
- **A.** 完全透明(spec 当前设计)→ 取舍自杀
- **B.** 模糊提示(只给"擅长/一般/不利")(推荐)
- **C.** 完全隐藏(agent 只感知后果)
- **推荐 B。** 保留 gameplay 张力,避免每策略锁定固定任务。

### D6. §2.1 vs §5.3 矩阵矛盾(数据纠正)
- 需 owner 确认设计意图:
  - logistics 的 **resource_preservation** 是 bonus 吗?(§2.1 漏了)
  - exploration 的 **resource_preservation** 是 bonus 还是 neutral?(§2.1 与 §5.3 打架)
- 这是数据层纠正,需设计意图拍板。

### D7. 副策略合并语义
- 主副 affinity 冲突时:主优先?加权?取最坏?
- **推荐:主 0.7 / 副 0.3 加权**(Codex 的 `fitBps = primaryFitBps*0.7 + secondaryFitBps*0.3`)。
- 这是 §4 决策逻辑的地基,不定写不出代码。

### D8. strategyProfile vs identityStrategyDisposition 二分是否采纳
- **A.** 采纳二分(本局冻结防刷分)(推荐)
- **B.** 单一 strategy,允许随时改
- **推荐 A。** 否则策略退化为刷分开关(每次领任务前切到最优策略)。

---

## 八、被严重低估的实现块

spec §7 把这几块当轻量改动,实际工作量可能超过前 8 步之和:

1. **gameplay resolver(§7 第 9 步)**:把 LLM 生成的戏剧化行动("潜入敌营解密文件")翻译成 server-authoritative 可验证 event。一行带过,实际是整个 spec 技术上最难的部分。
2. **grounded 校验是 LLM 判 LLM 的死循环(§3.2)**:"不矛盾世界设定"是模糊判断,只能再调 LLM,无终止条件。需拆成结构/世界/语义/内容四层校验(Codex P1.6)。
3. **available_quests → prepare_journey 的并发(§3.3)**:任务是消耗品,两次调用间可能被别的 agent 领走。spec 没说有无 reservation/CAS。
4. **identity.traits 三路径代码债**:strategy 字段落地前要先统一层级,否则重蹈覆辙。

---

## 附:建议的落地顺序(替代 spec §7)

1. 冻结领域模型:`taskFamilyId`/`taskTypeText`/strategy scope/策略版本。
2. 定义 `StrategyProfile`/`QuestOffer`/`MarketSnapshot`/`StrategyEffectPolicy` schema。
3. 加 JSONL/SQLite 持久化与迁移。
4. 实现带 `offerId + snapshotVersion + offerHash` 的 `available_quests` 与 `prepare_journey` 绑定。
5. 保留现有 catalog 作 fallback seed(不移除)。
6. 为 objective/action 加机器可读的 `approachTags/mechanicId/strategyFit`。
7. 实现策略候选排序 + hard-policy 过滤(复用 `journey-soak.ts:270` 的 `chooseAction`)。
8. 只在 `taskAdjudication` 层加策略适配分,先不动 worldCommit 和奖励。
9. 做 balance simulation(1000 次),再决定是否加额外奖励。
10. 单独设计 strategy ladder,不动现有 Phase 6 ladder。
