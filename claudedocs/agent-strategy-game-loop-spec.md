# Agent Strategy Game Loop Spec

## 1. 设计目标

- agent 根据用户设定的**策略偏好**自主选择任务,不被 server 强制 taskType。
- 避免"玩家想战斗,结果只能做调查"。
- episode decisions 由**策略规则驱动 + LLM 辅助**,不一味靠 LLM(避免千篇一律)。
- 策略-任务匹配产生 gameplay 后果(加成/减成)。

## 2. 策略偏好系统

### 2.1 五种策略向

| 策略向 | 代号 | 偏好任务类型 | 典型行为 |
|---|---|---|---|
| 战斗向 | `combat` | structured_challenge, priority_commission | 猎杀/清除/正面冲突/高风险战斗 |
| 智谋向 | `cunning` | information_acquisition, crisis_retreat | 欺骗/潜行/信息博弈/计谋/谈判 |
| 辅助向 | `support` | companion_support, crisis_retreat | 协助/治疗/保护/掩护撤离 |
| 后勤向 | `logistics` | resource_acquisition, cultivation_material, crafting_material | 资源采集/制作/运输/管理 |
| 探索向 | `exploration` | information_acquisition, resource_preservation, repeated_route_audit | 侦察/发现/测绘/未知区域 |

### 2.2 策略设定

- agent 创建时(或 register 后),用户设定**主策略**(5 选 1)。
- 可选**副策略**(5 选 1,与主不同),影响 episode decision 的次要偏好。
- 策略存储在 identity/explorer profile 中,持久化。

## 3. 任务市场

### 3.1 任务展示

server 向 agent 展示一组**可选区域任务**(3-5 个),每任务含:

```json
{
  "taskId": "forest_mutant_bounty_001",
  "region": { "regionId": "region_forest", "title": "腐林外缘猎区", "riskProfile": "high" },
  "taskType": "structured_challenge",
  "scenario": {
    "briefing": "腐林猎团按可核验猎获结算甲壳变异兽悬赏。",
    "primaryObjective": "清除或活捉一只甲壳变异兽,带回猎团认可的凭证。",
    "coverage": ["skill_and_consumable_use"]
  },
  "strategyAffinity": {
    "combat": "bonus",
    "cunning": "neutral",
    "support": "penalty",
    "logistics": "penalty",
    "exploration": "neutral"
  },
  "estimatedDifficulty": "medium",
  "rewardPreview": { "resources": [{"resourceId":"coin","amount":"7+"}], "items": ["相位实验舱便携记录器"] }
}
```

### 3.2 任务来源 —— LLM 生成(不用 catalog 模板)

任务不再从 catalog route 或 fallback 模板取。改为:

- **输入**:区域信息(region 世界设定/objects/NPC)+ 任务参考(scenario matrix 的 taskType/intensity)+ 世界观(race/faction/lore)。
- **LLM 生成**:基于输入,生成含剧情深度的任务,包含:
  - NPC 动机(种族间谍因善良放弃行动 / 因爱上某人改变选择 / 阵营背叛 / 道德困境)
  - 具体行动(不是"核对/核验",而是"猎杀/潜入/解密/欺骗/谈判/护送")
  - 冲突结构(对抗 NPC / 信息博弈 / 时间压力 / 资源短缺)
  - 分支可能(暴力解 vs 智谋解 vs 外交解,server 校验不矛盾)
- **server 校验**:生成后校验 grounded(object ids ∈ region map / NPC ∈ world lore / 不矛盾世界设定)。
- **初始 10 个**:server 启动/周期时 LLM 生成 10 个任务(不同 region/taskType)。
- **补充**:agent 每领 1 个任务,LLM 补 2 个不同类型(保持任务池 + 强制多样性)。

### 3.3 任务市场 API

- 新 MCP tool:`obsidian_epoch.available_quests`(返回当前可选任务列表 + 策略亲和度)。
- agent 调该 tool 看任务 → 按策略选 → `prepare_journey`(传选的 region + taskType)。

## 4. 选择逻辑

### 4.1 策略规则驱动(不纯 LLM)

agent 选任务的**优先级**(策略规则):

```
1. 策略匹配 taskType(strategyAffinity == "bonus")→ 优先选
2. 策略中性(strategyAffinity == "neutral")→ 次选
3. 策略减成(strategyAffinity == "penalty")→ 最后选(或不选)
4. 同亲和度内,LLM 辅助(角色化选择,如 identity 特质/需求/region 偏好)
```

### 4.2 episode decision policy

episode decisions(actionOptionId 选择)不再纯 LLM:

```
1. 策略规则:从 sceneContract.actionOptions 中,按策略偏好排序
   - combat 向:优先 high-risk combat action(猎杀/攻击/正面)
   - cunning 向:优先 medium-risk stealth/deception action(潜行/欺骗)
   - support 向:优先 low-risk assist/protect action
   - logistics 向:优先 resource/craft action
   - exploration 向:优先 scout/discover action
2. 策略规则选出候选(1-2 个)→ LLM 在候选内角色化(rationale/语气/微调)
3. LLM 不可超出策略候选(防千篇一律的"选最安全"或"选最高分")
```

## 5. 策略-任务匹配加成

### 5.1 加成公式

```ts
type StrategyAffinity = "bonus" | "neutral" | "penalty";

// settlement scoring 加成
function strategyScoreModifier(affinity: StrategyAffinity): number {
  switch (affinity) {
    case "bonus":   return +0.15;  // +15% 评分/完成率
    case "neutral": return  0.00;
    case "penalty": return -0.10;  // -10%
  }
}
```

### 5.2 加成影响

- **完成率**(tier 升降:bonus 可帮 良好→优秀;penalty 可能 良好→及格)。
- **奖励**(bonus → 额外 item/resource;penalty → 减少)。
- **身份还原度**(bonus → identity-fidelity 高;penalty → 低)。
- **世界固化**(bonus → worldCommit 更强;penalty → 可能 discarded)。

### 5.3 策略亲和度矩阵

| taskType \ strategy | combat | cunning | support | logistics | exploration |
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

## 6. 与现有系统集成

| 系统 | 当前 | 改为 | 改动范围 |
|---|---|---|---|
| scenario matrix | runIndex 固定 taskType(强制) | agent 选 taskType(从任务市场) | prepare_journey 不再需要 scenario matrix 强制匹配 |
| identity 发放 | 随机(不关联策略) | identity + 策略偏好字段 | register/pairing 加 strategy 字段 |
| prepare_journey | 指定 destinationRegionId + taskType | 从任务市场选(或仍指定,但 taskType 不强制 matrix) | 加 available_quests tool |
| begin_phase6_run | assertPhase6ScenarioBinding(runIndex → taskType) | 校验 agent 选的 taskType(不强制 runIndex) | 放宽 binding 或加 strategy bypass |
| settlement scoring | 纯 taskAdjudication(tier/quality) | 加 strategyScoreModifier | phase6ServerScoringRules 加策略项 |
| episode decisions | 纯 LLM sampling(createMessage) | 策略规则候选 + LLM 角色化 | journey-soak/sampling-client policy 改 |
| catalog route | catalogFallbackRoute(可能 miss) | 任务市场直接用 catalog route | catalogFallbackRoute 修或任务市场绕过 |

## 7. 实现优先级

1. **策略系统**(5 向定义 + identity strategy 字段 + register API)。
2. **策略亲和度矩阵**(taskType × strategy → affinity)。
3. **任务市场 API**(available_quests tool,展示可选 region/taskType + affinity)。
4. **agent 选择逻辑**(策略规则选 taskType,prepare_journey 用选的)。
5. **scenario matrix 放宽**(不再强制 runIndex→taskType,允许 agent 选)。
6. **策略加成**(settlement scoring 加 strategyScoreModifier)。
7. **episode decision policy**(策略规则候选 + LLM 角色化)。
8. **catalogFallbackRoute 修**(命中 catalog route,用原文戏剧行动)。
9. **gameplay resolver**(战斗/潜行/解密/欺骗 → 可验证 server event)。
10. **narrative server 集成**(LLM rewrite storyReport.narrative)。

## 8. 待确认

- 副策略的权重(与主策略冲突时谁优先)。
- 任务市场刷新频率(每 journey 后刷新?按 world time?)。
- 策略是否可中途切换(同一 identity 内)。
- 策略加成是否影响 worldCommit(而不仅 tier/reward)。
- catalog route 与任务市场的关系(任务市场直接用 catalog route,还是仍走 fallback?)。
