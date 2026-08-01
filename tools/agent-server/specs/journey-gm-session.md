# 黑曜纪元 Journey GM Session Spec

> 版本: draft-4
> 日期: 2026-08-01
> 状态: 设计中

### 变更记录

- draft-4: 对齐现有代码接口（审查修订）
  - 修正 EpochMutationCoordinator 方法名（coordinate → run，epochPersistence.ts:14-18）
  - GM 行动事件复用现有 journey_episode_recorded 与 commitEpisodes 机制，不再自定义事件类型/投影器
  - episode/serverFacts/storyBeat 形状对齐真实类型，补齐全部必填字段
  - 统一 §10.1/§14.1 为单一权威流程；事实入库统一为 confirmed → confirmedFacts / discovered → rumors
  - 补状态机守卫扩展清单（LEGAL_JOURNEY_TRANSITIONS/recordJourneyEpisode/结算触发）
  - 补 GM 结算方案（无 taskPlan 时用 buildFallbackJourneyTaskPlan 合成）
  - 补时间流逝推进世界时钟、一致性复查上限、LLM 调用失败处理（§10.4）、MCP 工具授权
  - 修复章节编号与重复定义
- draft-3: 补充 Codex 审查发现的缺口
  - 核心状态对齐（WorldState/NPC状态/已知事实必须从现有系统读取）
  - 提交原子性（使用 MutationCoordinator 保证一次行动的所有变更原子提交）
  - 并发处理（单 Journey 串行 + 跨 Journey 走 MutationCoordinator + NPC 合并策略）
  - 与现有 Journey 状态机衔接（GM 状态机、事件兼容、结算兼容）
- draft-2: 基于反馈修正
  - 三层架构（硬规则层 + LLM裁决层 + 世界状态层）
  - 一致性保障（事实/NPC/判例一致性检查）
  - 硬规则预检（代码层先拦截明显的不可能）
- draft-1: 初始版本

---

## 0. 定位

黑曜纪元从"任务驱动 RPG"转向"AI GM 驱动的无限叙事 RPG 引擎"。

不是给现有任务系统加一个聊天壳。是重新定义 Journey Runtime：

```
旧: 服务端出题 → 客户端选按钮 → 签名验证 → 模板文本
新: 服务端描述处境 → Agent自由行动 → 服务端判定+事件 → 叙事生成 → 世界更新
```

这不是替代现有系统，是新增一条路径。两条路径写入同一个 event store。

---

## 1. 设计目标

### 要解决的问题

当前 journey 系统的核心问题：**服务端出题，客户端选按钮，叙事是模板拼接。**

现有流程:
```
服务端生成 taskPlan (7个objective, 每个2-3个预设action)
  → 客户端选一个 actionOptionId
  → 服务端签名验证
  → 叙事由模板拼接 (outcomeSummary 字符串替换)
```

结果：故事读起来像工作报告，没有感官细节，没有意外，没有角色内心。

### 目标体验

```
服务端描述处境 → Agent 自由行动 → 服务端判定后果+引入新事件 → 循环
```

宏大叙事是背景，不是任务清单。细小任务是日常生活的切片。叙事从日常行动中涌现。

黑曜纪元最大的卖点不是"我有很多任务"，而是"我生活在一个世界里，我可以尝试任何合理的事情"。

---

## 2. 核心原则

### 2.1 三层架构

```
┌─────────────────────────────────────────┐
│  硬规则层 (代码)                          │
│  不可违反的现实: 资源边界、物理约束、状态锁  │
│  例: 钢门不能被徒手打碎、钱不能变成负数      │
├─────────────────────────────────────────┤
│  LLM 裁决层                              │
│  理解意图、创造可能性、判定社会后果          │
│  例: 威胁守卫是否有效取决于守卫性格和情境     │
├─────────────────────────────────────────┤
│  世界状态层 (代码)                        │
│  存储和检索: 角色状态、NPC状态、已知事实     │
│  例: 角色没有枪 → 告诉裁决者"不能用枪"      │
└─────────────────────────────────────────┘
```

**核心分工**: LLM 负责理解和创造可能性，代码负责保存不可违反的现实。

玩家不是进入黑曜纪元和一个很会聊天的幻觉机器玩文字冒险。玩家进入的是一个有规则约束的世界，LLM 在规则范围内创造叙事。

### 2.2 两层 LLM 分离

| 层 | 职责 | 输入 | 输出 |
|---|---|---|---|
| 裁决者 (Adjudicator) | 判定行动后果、计算状态变更、决定新事件 | 世界状态 + 硬规则约束 + 玩家行动 | 结构化 JSON |
| 叙事者 (Narrator) | 把裁决结果转化为有质感的故事 | 裁决结果 + 角色信息 + 环境 | 叙事文本 JSON |

### 2.3 硬规则层

代码写死的规则，LLM 不可覆盖：

```typescript
interface HardRules {
  // 物理约束
  physicalConstraints: {
    // 角色没有枪 → 不能用枪
    requireEquipment: Map<string, string[]>;
    // 徒手不能破坏钢门
    materialStrength: Map<string, number>;
    // 角色力量 + 工具 vs 材料强度
    strengthCheck: (agent: AgentState, target: string) => boolean;
  };

  // 资源边界（维度与 §4.2 AgentResources 一致）
  resourceBoundaries: {
    money: { min: 0 };
    stamina: { min: 0, max: 100 };
    health: { min: 0, max: 100 };
    reputation: { min: -100, max: 100 };
    socialCapital: { min: 0, max: 100 };
    npcAttitude: { min: -100, max: 100 };   // NPC 态度（GM 侧，§13.2）
  };

  // 时间约束
  timeConstraints: {
    // 同时只能在一个地方
    singleLocation: true;
    // 行动需要时间
    actionRequiresTime: true;
    // NPC有自己的时间表
    npcSchedule: Map<string, string[]>;
  };

  // 信息约束
  informationConstraints: {
    // 角色只能使用已确认的事实
    onlyConfirmedFacts: true;
    // NPC可能撒谎
    npcMayLie: true;
    // 道听途说不可靠
    rumorUnreliable: true;
  };
}
```

硬规则层在 LLM 调用之前注入 prompt：

```
# 不可违反的规则（由代码注入，LLM不可覆盖）

- 角色没有枪。只有: 手电筒、旧手机、半包烟
- 钢门不能被徒手破坏。角色力量不足以破坏。
- 角色当前金钱: 1850元。不能花费超过这个数。
- 角色当前体力: 70/100。不能消耗超过70。
- 角色同时只能在一个地方。
- 角色不知道仓库里有什么。
```

### 2.4 一致性保障

防止 LLM 一致性漂移的机制：

```typescript
interface ConsistencyGuard {
  // 事实一致性：新事实不能与已确认事实矛盾
  factConsistency: {
    check(newFact: string, confirmedFacts: string[]): "consistent" | "contradicts" | "unknown";
    onContradict: "reject" | "flag_for_review";
  };

  // NPC一致性：NPC行为必须符合已建立的性格
  npcConsistency: {
    check(npcId: string, action: string, profile: NPCProfile): "consistent" | "out_of_character";
    onOutOfCharacter: "reject" | "allow_with_penalty";
  };

  // 规则一致性：同样的情况应该有同样的结果
  ruleConsistency: {
    precedent: Map<string, AdjudicatorOutput>;
    check(situation: string): AdjudicatorOutput | null;
  };
}
```
- 信息是否可靠 → LLM 判断（根据信息来源）

代码不写死规则。代码只维护硬数据。

### 2.5 服务端不信任客户端叙事

客户端的 `playerNarrative` 是"角色试图做什么"的描述，不是"世界应该变成什么样"的声明。裁决者根据角色的实际状态判断行动是否有效。

---

## 3. 会话生命周期

### Phase 1: 建立对局

```
输入: { playerConcept, preferredTone, difficulty }
输出: { agent, worldState, openingNarrative }
```

服务端创建角色身份、初始资源、装备、所在位置、已知地点。

### Phase 2: 日常循环

```
┌→ 服务端描述当前处境
│   ↓
│  Agent 自由行动（自然语言）
│   ↓
│  裁决者判定后果
│   ↓
│  叙事者生成故事
│   ↓
│  服务端更新世界状态
│   ↓
│  是否触发主线事件？
│   ├→ 是 → 转入 Phase 3
│   └→ 否 → 继续日常循环
```

### Phase 3: 主线触发

主线不是显式发放的。从日常行动中涌现：

```
玩家在夜市买烟 → 摊主提到码头有动静 → 三天后在码头遇到摊主的朋友
→ 那个人请你帮忙 → 主线开始
```

触发器基于条件组合：发现特定信息 + 与 NPC 建立关系 + 去过特定地点。

### Phase 4: 结局

- 主线完成
- 角色死亡
- 时间耗尽
- 主动结束

---

## 4. 角色创建

### 4.1 输入

```typescript
interface CharacterCreationInput {
  playerConcept: string;      // "一个在码头区做夜班保安的退伍军人"
  preferredTone?: string;     // "现实主义" | "荒诞" | "黑色幽默" | "硬核"
  difficulty?: string;        // "简单" | "普通" | "困难" | "写实"
}
```

### 4.2 裁决者生成角色

```typescript
interface AgentIdentity {
  name: string;
  age: number;
  background: string;         // 2-3句背景故事
  personality: string;        // 性格描述
  appearance: string;         // 外貌特征
  speechPattern: string;      // 说话方式
}

interface AgentResources {
  money: number;
  stamina: number;            // 0-100
  health: number;             // 0-100
  reputation: number;         // -100 到 100
  socialCapital: number;      // 0-100
}

interface AgentInventory {
  items: string[];            // ["工牌", "旧手机", "半包红塔山", "打火机", "手电筒"]
}

interface AgentRelationships {
  [npcId: string]: {
    status: string;           // "冷淡" | "一般" | "友好" | "亲密"
    lastContact?: string;
    oweFavor?: boolean;
    notes?: string;
  };
}

interface AgentState {
  identity: AgentIdentity;
  resources: AgentResources;
  inventory: AgentInventory;
  relationships: AgentRelationships;
  knownLocations: string[];
  knownFacts: string[];       // 角色已确认的信息
}
```

### 4.3 叙事者写开场

根据角色身份和所在位置，生成 2-3 段开场叙事。要求：
- 感官细节（至少2种感官）
- 建立氛围
- 暗示当前处境
- 不提及任何数值

### 4.4 与现有身份系统的衔接

GM 模式复用现有身份系统，不另立一套：

- 身份记录、成长（progression）、终结（identity_ended）等生命周期仍由现有 identity/progression 域负责；
- 开局阶段服务端通过现有身份创建流程生成 `AgentIdentity`，初始资源/装备/位置/已知地点写入与普通 Journey 相同的结构（`status().progress` 与 journey 记录），GM 模式只负责补充叙事层（开场白）；
- GM 身份可以参与普通 Journey，反之亦然——两条路径共享同一个身份与资源账本。

> 待确认：GM 开局的资源/装备注入方式（是否复用现有任务奖励渠道，还是新增初始化事件），实现前需与身份域对齐。

---

## 5. 日常任务系统

### 5.1 任务设计原则

任务是日常生活中的小事，不是宏大叙事的步骤：

```
不真实: "调查帮派的码头活动"
真实:   "值夜班，巡逻码头区"
真实:   "去楼下小卖部买包烟"
真实:   "给前妻转这个月的抚养费"
真实:   "去街角面馆吃碗面"
```

### 5.2 任务结构

```typescript
interface DailyTask {
  taskId: string;
  description: string;        // "去楼下小卖部买包烟"
  expectedDuration: string;   // "10分钟"
  context: string;            // "烟抽完了，小卖部老板是个话多的中年人"
  optional: boolean;          // true = 可以不做
}
```

### 5.3 任务不是必须完成的

Agent 可以做任何合理的事，不限于任务列表。任务只是"角色可能会做的事"的建议。

---

## 6. 裁决者规范

### 6.1 输入格式

```typescript
interface AdjudicatorInput {
  worldLore: string;          // 世界观设定（角色知道的部分）
  agentState: AgentState;     // 角色当前状态
  currentSituation: string;   // 服务端描述的当前环境
  playerNarrative: string;    // 玩家的行动描述
  knownFacts: string[];       // 角色已确认的信息
  npcStates: NPCState[];      // 附近NPC状态
  recentHistory: string[];    // 最近2-3轮的裁决结果摘要
}
```

### 6.2 系统 Prompt

裁决者 prompt 由三部分拼接：

**Part 1: 硬规则（代码注入，不可覆盖）**

```
# 不可违反的规则

${hardRules}

角色当前状态:
  装备: ${agent.inventory.join(', ')}
  金钱: ${agent.resources.money}
  体力: ${agent.resources.stamina}/100
  生命: ${agent.resources.health}/100
  位置: ${agent.location}

已确认的事实:
${agent.knownFacts.map(f => `- ${f}`).join('\n')}
```

**Part 2: 裁决者系统指令**

```
你是黑曜纪元的裁决者。

你的工作是判定玩家行动的后果。你不是故事作者，你是世界模拟器。

# 你的职责

1. 判断玩家的行动在当前世界设定中是否合理
2. 计算状态变更（资源消耗、NPC态度变化）
3. 决定是否触发新事件
4. 决定玩家获得了什么信息

# 判定原则

## 社会约束
- 陌生人不会无缘无故信任你
- 问敏感问题会引起警觉
- 威胁别人有后果
- 帮忙会增加好感，但不是无限的
- NPC有自己的性格和动机，不会完全配合玩家

## 信息约束
- 角色只知道他已经确认的信息
- NPC可能撒谎、夸大、隐瞒
- 道听途说的可靠性低于亲眼所见
- 角色不知道其他玩家的信息

## 时间约束
- 行动需要时间
- 错过的事情不会等你
- NPC有自己的时间表

## 资源约束
- 钱花完就没了
- 体力会消耗
- 受伤会影响后续行动
- 社会关系是有限资源

# 你不能做的事

- 你不能让角色使用他没有的装备
- 你不能让角色花费超过他拥有的金钱
- 你不能让角色消耗超过他当前的体力
- 你不能改变硬规则中列出的约束
- 你不能凭空创造角色不知道的信息

# 关于NPC

NPC不是配合玩家的工具。他们:
- 有自己的情绪和当前状态
- 可能拒绝配合
- 可能撒谎
- 可能误解玩家的意图
- 会记住玩家之前的行为
```

# 输出格式

严格输出以下JSON结构，不要输出任何其他内容。

{
  "actionValid": true | false,
  "invalidReason": "string | null",

  "physicalConsequences": {
    "staminaCost": number,
    "healthChange": number,
    "timeElapsedMinutes": number,   // 分钟数，代码据此推进世界时钟（§15.4）；0 = 本回合不耗时
    "moneySpent": number
  },

  "socialConsequences": {
    "npcChanges": {
      "[npcId]": {
        "attitudeChange": number,
        "newImpression": "string | null",
        "willRemember": ["string"]
      }
    }
  },

  "informationConsequences": {
    "discovered": [
      {
        "content": "string",
        "source": "string",
        "reliability": number (0-1),
        "reason": "string"
      }
    ],
    "confirmed": ["string"],
    "contradicted": ["string"]
  },

  "worldConsequences": {
    "newEvents": [
      {
        "type": "string",
        "description": "string",
        "visible": boolean,
        "agentAware": boolean,
        "timeTrigger": "string | null"
      }
    ],
    "environmentChanges": [
      {
        "property": "string",
        "newValue": "string"
      }
    ]
  },

  "npcAutonomousActions": {
    "[npcId]": {
      "action": "string",
      "mood": "string",
      "mightInitiateConversation": boolean,
      "conversationTopics": ["string"]
    }
  },

  "availableReactions": ["string"]   // 建议的后续行动（可选；§10.1 返回、§11 MCP 结果使用）
}
```

### 6.3 处理无效行动

当玩家声称不可能的事情时：

```json
{
  "actionValid": false,
  "invalidReason": "你没有枪。你只有手电筒和半包烟。",
  "physicalConsequences": { "staminaCost": 0, "healthChange": 0, "timeElapsedMinutes": 0, "moneySpent": 0 },
  "socialConsequences": { "npcChanges": {} },
  "informationConsequences": { "discovered": [], "confirmed": [], "contradicted": [] },
  "worldConsequences": { "newEvents": [], "environmentChanges": [] },
  "npcAutonomousActions": {}
}
```

### 6.4 可靠性评分标准

```
1.0 = 角色亲眼确认的事实
0.8 = 可信NPC直接告知
0.6 = NPC告知但可能有偏见
0.4 = 道听途说
0.2 = 猜测/传言
0.0 = 完全不确定
```

> 入账规则（与 §13.3 一致）：只有 reliability 达到 1.0（亲眼确认或经验证升级）的事实进入"已确认事实"（confirmedFacts）；0 < reliability < 1.0 一律作为传闻（rumors）记录。传闻可以被后续行动验证并升级为已确认事实。

---

## 7. 叙事者规范

### 7.1 输入格式

```typescript
interface NarratorInput {
  adjudicatorOutput: AdjudicatorOutput;
  agentIdentity: AgentIdentity;
  environment: EnvironmentDescription;
  npcProfiles: NPCProfile[];      // 附近NPC的外貌、性格、说话方式
  playerNarrative: string;        // 玩家行动原文
  previousNarrative: string[];    // 最近2-3轮的故事文本
}
```

### 7.2 系统 Prompt

```
你是黑曜纪元的叙事者。

你的工作是把裁决结果转化为有质感的故事文本。

# 写作原则

## 1. 感官优先
先写看到/听到/闻到/触到的，再写发生的事。

不好: "你走进仓库。"
好:   "仓库的铁门推开时发出刺耳的声响。里面比外面冷，
      空气里有股发霉的味道，混着淡淡的机油味。"

## 2. 细节具体化
不要写"一个男人"，写"一个穿灰色夹克、头发油腻的男人"。

不好: "酒保和你说了话。"
好:   "酒保把杯子放下，用围裙擦了擦手。
      \"你不是这附近的吧？\"他的声音沙哑，像抽了太多烟。"

## 3. NPC 是活人
NPC有自己的情绪、习惯、当前在做的事。
他们不会等玩家来才开始存在。

不好: "摊主告诉你帮派的事。"
好:   "摊主在翻锅铲，油星溅到了围裙上。
      你买了烟，他找钱的时候低声说：
      \"最近晚上少来这边，九号仓库那边不太平。\"
      说完他看了看你身后，然后继续炒他的粉。
      像是后悔说了什么。"

## 4. 角色有内心
角色不是机器人。他会犹豫、会担心、会想起过去。

不好: "你决定去九号仓库看看。"
好:   "你站在保安室门口，犹豫了一下。
      九号仓库那边确实不对劲，但这不是你的事。
      你想起前妻说的：'别多管闲事。'
      但你还是往那边走了。"

## 5. 对话要像人说话
不要书面语，不要解释性对话。

不好: "帮派成员说道：'我们的组织最近在码头进行走私活动。'"
好:   "\"别多管闲事。\"那人没看你，继续往面包车里搬箱子。
      他的声音不大，但你听得很清楚。"

## 6. 时间在流动
行动不是瞬间完成的。吃饭需要时间，走路需要时间，等待需要时间。

不好: "你在酒吧待了一会儿。"
好:   "你在吧台坐了大概四十分钟。啤酒喝到第三杯的时候，
      你开始觉得酒吧没那么暗了。
      角落唱歌的人换了首慢歌，这次没走调。"

## 7. 失败比成功更有故事
失败不是"未完成"。失败是角色尝试了但世界没有配合。

不好: "你没能打探到消息。"
好:   "你试着和酒保聊帮派的事，但他只是摇了摇头。
      \"我什么都不知道。\"
      你知道他在撒谎。他擦杯子的手在发抖。
      你没再追问。有些事，不是问了就有答案的。"

## 8. 不要总结，要展示
不要告诉玩家发生了什么，让玩家自己感受到。

不好: "你获得了关于帮派的情报。"
好:   "摊主压低声音：'前天晚上，我看到三辆卡车开进九号仓库。
      没开灯。'
      他顿了顿，'以前也有过这种事。
      上次是三个月前，后来仓库那边就死过人。'"

## 9. 处理无效行动
如果裁决结果是行动无效，用角色视角解释为什么失败。
角色不知道自己"无效"了，他只是发现事情没按预想发展。

裁决: { actionValid: false, invalidReason: "你没有枪" }
叙事: "你的手伸进外套内袋，摸了个空。
      你这才想起来，你从来没有过枪。
      手电筒还在，打火机还在，但这些不是能指着人说话的东西。"

## 10. 不要提及任何数值
不要说"你消耗了15元"、"你的体力下降了"。
用叙事暗示资源变化：

数值: "你花了15元买烟，体力-2"
叙事: "你掏出十五块钱，接过烟。站了这么久，腿有点酸。"

# 输出格式

严格输出以下JSON结构，不要输出任何其他内容。

{
  "narrative": "完整的叙事文本...",
  "summary": "一句话概括本回合结果（写入 storyBeat.outcomeSummary）",
  "npcDialogue": {
    "[npcId]": "NPC说的话，用引号包裹"
  },
  "atmosphere": "一句话描述当前氛围",
  "innerThoughts": "角色的内心活动，如果有的话",
  "sensoryDetails": {
    "visual": "视觉细节",
    "auditory": "听觉细节",
    "olfactory": "嗅觉细节",
    "tactile": "触觉细节"
  }
}
```

### 7.3 真实感检查清单

叙事者生成的文本应满足：

- [ ] 有感官细节（至少2种感官）
- [ ] NPC在做自己的事（不是站着等玩家）
- [ ] 角色有内心活动（犹豫、担心、回忆）
- [ ] 对话像人话（不是书面语）
- [ ] 时间在流动（不是瞬间完成所有事）
- [ ] 有意外（不是一切按计划）
- [ ] 细节够具体（不是"一个男人"而是"穿灰色夹克的男人"）
- [ ] 没有提及数值
- [ ] 读起来像小说（不是游戏提示文本）

---

## 8. 世界观注入

### 8.1 分层结构

| 层 | 内容 | 注入方式 |
|---|---|---|
| 角色知道的 | 地理、本地帮派名字、日常生活规律 | 直接注入裁决者和叙事者 |
| 角色可能知道的 | 帮派具体活动、NPC背景、地点历史 | 通过NPC对话或观察获得 |
| 角色不知道的 | 帮派首领真实身份、仓库里的东西 | 只有服务端知道，用于生成事件 |

### 8.2 注入格式

```
# 裁决者 prompt 中的世界观部分

## 角色知道的事实
- 码头区有十几个仓库，九号仓库最近晚上有灯
- 本地帮派叫"蛇帮"，老大外号"蛇头"
- 小卖部老板刘叔在这开了二十年店

## 当前区域信息
地点: 码头区，晚上10点，小雨
附近: 小卖部、保安室、九号仓库（200米外）
人员: 刘叔（小卖部老板）、几个路人

## 世界观规则（用于判断合理性）
- 这个城市没有超自然元素
- 普通人不会武术
- 枪支管控严格，普通人没有枪
- 帮派不会在公共场合明目张胆行动
```

---

## 9. 主线涌现机制

### 9.1 触发器定义

```typescript
interface NarrativeTrigger {
  conditions: {
    all?: TriggerCondition[];   // 全部满足
    any?: TriggerCondition[];   // 任一满足
  };
  consequence: {
    newEvent?: WorldEvent;
    unlockClue?: string;
    npcInitiates?: {
      npcId: string;
      approach: string;
      dialogue: string;
    };
  };
  cooldown?: string;            // "24小时" | "3天" | null
  priority: number;             // 高优先级的触发器先执行
}

type TriggerCondition =
  | { type: "factDiscovered"; fact: string }
  | { type: "npcRelationship"; npcId: string; threshold: number }
  | { type: "locationVisited"; location: string }
  | { type: "itemAcquired"; item: string }
  | { type: "timeElapsed"; since: string; duration: string }
  | { type: "worldState"; property: string; value: unknown };
```

### 9.2 示例触发器

```typescript
const triggers: NarrativeTrigger[] = [
  // 知道仓库有动静 + 和刘叔关系好 → 刘叔介绍人脉
  {
    conditions: {
      all: [
        { type: "factDiscovered", fact: "九号仓库有批货要到" },
        { type: "npcRelationship", npcId: "shopkeeper_liu", threshold: 20 }
      ]
    },
    consequence: {
      npcInitiates: {
        npcId: "shopkeeper_liu",
        approach: "在你下班时拦住你",
        dialogue: "兄弟，我跟你说个事。九号仓库那帮人，我认识一个。他想找个靠得住的人。"
      }
    },
    cooldown: "3天",
    priority: 10
  },

  // 去酒吧喝酒 → 遇到帮派底层成员
  {
    conditions: {
      all: [
        { type: "locationVisited", location: "bar" },
        { type: "timeElapsed", since: "first_visit_bar", duration: "1小时" }
      ]
    },
    consequence: {
      newEvent: {
        type: "encounter",
        description: "一个手臂有蛇形纹身的人坐到你旁边",
        npcId: "thug_chen",
        requiresReaction: true
      }
    },
    cooldown: "24小时",
    priority: 5
  }
];
```

### 9.3 主线不是任务清单

主线是叙事线，不是目标列表：

```
不是: "1. 调查帮派 2. 找到证据 3. 消灭首领"
而是: 角色在日常生活中逐渐卷入帮派事务
     → 某天帮派找上门来
     → 角色不得不做出选择
     → 选择导致后果
     → 故事走向结局
```

---

## 10. 代码层接口

### 10.1 完整处理流程

```typescript
interface GameSession {
  sessionId: string;
  companion: AgentCompanionRuntime;   // 现有运行时（§13 状态对齐）
  journeyId: string;
  hardRules: HardRules;
  narrativeLedger: NarrativeLedger;
  triggerEngine: TriggerEngine;
  consistencyGuard: ConsistencyGuard;
  mutationCoordinator: EpochMutationCoordinator;  // 真实接口：run()/drain()（epochPersistence.ts:14-18）
  modelAdapter: ModelAdapter;
}

// 唯一权威流程：一次 GM 行动 = 快照 → 预检 → 裁决 → 一致性复查 → 数据边界 → 叙事
// → 组装 episode → 原子提交 → 世界状态 → 时间流逝 → 持久化 → 触发器。
// §14 的提交细节与 §15 的并发细节都是本流程的展开，实现时以本流程为准。
async function processPlayerAction(
  session: GameSession,
  playerNarrative: string,
): Promise<ActionResult> {

  // 整个回合在 mutation coordinator 内串行执行（§14.1）
  return session.mutationCoordinator.run(async () => {

    // 1. 读取当前状态快照（从现有系统构建，§13）
    const snapshot = buildWorldState(session.companion, session.journeyId);

    // 2. 硬规则预检（代码层，不用 LLM）
    const preCheck = hardRulePreCheck(playerNarrative, snapshot, session.hardRules);
    if (preCheck.blocked) {
      return {
        actionValid: false,
        invalidReason: preCheck.reason,
        narrative: generateBlockedNarrative(preCheck, snapshot),
        newWorldState: snapshot,
      };
    }

    // 3. 裁决（注入硬规则约束）
    let judgment = await adjudicate(
      snapshot,
      session.hardRules,
      playerNarrative,
      session.modelAdapter,
    );

    // 4. 一致性检查（代码层）——最多复查 1 次，防止无限 LLM 调用
    const consistencyResult = session.consistencyGuard.check(judgment, snapshot);
    if (consistencyResult.hasContradiction) {
      judgment = await adjudicate(
        snapshot,
        session.hardRules,
        playerNarrative,
        session.modelAdapter,
        { contradictions: consistencyResult.contradictions },
      );
      // 复查后仍矛盾：应用变更但标记 flagged，不再循环
      if (session.consistencyGuard.check(judgment, snapshot).hasContradiction) {
        judgment = { ...judgment, flagged: true };
      }
    }

    // 5. 数据边界检查（代码层）
    const validatedChanges = applyDataBoundaries(
      judgment.stateChanges,
      snapshot,
      session.hardRules,
    );

    // 6. 叙事
    const narration = await narrate(
      judgment,
      snapshot,
      playerNarrative,
      session.narrativeLedger,
      session.modelAdapter,
    );

    // 7. 组装 GM episode（形状对齐 §14.2 / §16.3，满足真实类型全部必填字段；
    //    sourceEventIds 在提交时由服务端生成 eventId 后回填，§14.2 commitGMEpisode 第 4 步）
    const episode = buildGMEpisode({
      journeyId: session.journeyId,
      index: snapshot.journey.episodeIds.length + 1,
      playerNarrative,
      snapshot,
      judgment,
      narration,
      validatedChanges,
    });

    // 8. 原子提交：复用 journey_episode_recorded（§14.2）
    //    版本冲突在此抛 journey_version_conflict
    const committed = session.companion.commitGMEpisode({
      journeyId: session.journeyId,
      expectedVersion: snapshot.journey.version,
      episode,
    });

    // 9. 世界状态变更（跨 journey 并发由 coordinator 串行化，§15.2）
    if (judgment.worldConsequences.environmentChanges.length > 0) {
      session.companion.updateWorldState({            // 新增接口（§15.2）
        regionId: snapshot.journey.destinationRegionId,
        expectedVersion: snapshot.worldState.version,
        changes: judgment.worldConsequences.environmentChanges,
      });
    }

    // 10. 时间流逝（§15.4）：裁决耗时推进世界时钟
    if (judgment.physicalConsequences.timeElapsedMinutes > 0) {
      session.companion.advanceWorldClock({           // 新增接口（§15.4）
        elapsedWorldMinutes: judgment.physicalConsequences.timeElapsedMinutes,
        reason: "gm_action",
        processedDomains: ["world_clock"],
        idempotencyKey: `${session.journeyId}:gm:${committed.journey.version}`,
      });
    }

    // 11. 持久化（事务边界内，§14.1）：失败则整个 run 块回滚
    persistGMEvents(session, committed, judgment, narration, validatedChanges);

    // 12. 检查触发器（主线涌现，§9）
    const after = buildWorldState(session.companion, session.journeyId);
    const triggeredEvents = session.triggerEngine.evaluate(
      after,
      judgment.informationConsequences.discovered,
    );

    return {
      narrative: narration.narrative,
      npcDialogue: narration.npcDialogue,
      atmosphere: narration.atmosphere,
      innerThoughts: narration.innerThoughts,
      sensoryDetails: narration.sensoryDetails,
      newWorldState: after,
      discoveredInfo: judgment.informationConsequences.discovered,
      triggeredEvents,
      availableReactions: judgment.availableReactions,
    };
  });
}
```

### 10.2 硬规则预检

在调用 LLM 之前，代码先检查一些明显的硬约束：

```typescript
function hardRulePreCheck(
  playerNarrative: string,
  worldState: GMWorldState,   // §10.1 传入的状态快照
  hardRules: HardRules,
): { blocked: boolean; reason?: string } {

  // 检测明显的物理不可能
  // 例: "我用枪射击" 但角色没有枪
  for (const [action, requiredEquipment] of hardRules.physicalConstraints.requireEquipment) {
    if (playerNarrative.includes(action)) {
      const hasAll = requiredEquipment.every(
        eq => worldState.agent.inventory.some(i => i.includes(eq))
      );
      if (!hasAll) {
        return {
          blocked: true,
          reason: `你没有${requiredEquipment.join('和')}。你只有: ${worldState.agent.inventory.join(', ')}`,
        };
      }
    }
  }

  // 检测资源不足
  // 例: "我花5000块买酒" 但角色只有1850
  const spendingMatch = playerNarrative.match(/花[了]?(\d+)/);
  if (spendingMatch) {
    const amount = parseInt(spendingMatch[1]);
    if (amount > worldState.agent.resources.money) {
      return {
        blocked: true,
        reason: `你只有${worldState.agent.resources.money}元，不够花${amount}元。`,
      };
    }
  }

  return { blocked: false };
}
```

### 10.3 数据边界检查

```typescript
function applyDataBoundaries(
  changes: StateChanges,
  current: GMWorldState,
  hardRules: HardRules,
): ValidatedStateChanges {
  return {
    agent: {
      money: Math.max(
        hardRules.resourceBoundaries.money.min,
        current.agent.resources.money + (changes.agent.money ?? 0),
      ),
      stamina: clamp(
        current.agent.resources.stamina + (changes.agent.stamina ?? 0),
        hardRules.resourceBoundaries.stamina.min,
        hardRules.resourceBoundaries.stamina.max,
      ),
      health: clamp(
        current.agent.resources.health + (changes.agent.health ?? 0),
        hardRules.resourceBoundaries.health.min,
        hardRules.resourceBoundaries.health.max,
      ),
      reputation: clamp(
        current.agent.resources.reputation + (changes.agent.reputation ?? 0),
        hardRules.resourceBoundaries.reputation.min,
        hardRules.resourceBoundaries.reputation.max,
      ),
      socialCapital: clamp(
        current.agent.resources.socialCapital + (changes.agent.socialCapital ?? 0),
        hardRules.resourceBoundaries.socialCapital.min,
        hardRules.resourceBoundaries.socialCapital.max,
      ),
      location: changes.agent.location ?? current.agent.location,
    },
    npcs: Object.fromEntries(
      Object.entries(changes.npcs ?? {}).map(([id, npc]) => [
        id,
        {
          attitude: clamp(
            (current.npcs[id]?.attitude ?? 0) + (npc.attitudeChange ?? 0),
            hardRules.resourceBoundaries.npcAttitude.min,
            hardRules.resourceBoundaries.npcAttitude.max,
          ),
          newFacts: npc.willRemember ?? [],
        },
      ]),
    ),
    world: {
      // 环境变更以属性-值对透传（§6.2 worldConsequences.environmentChanges），
      // 数值边界由对应领域规则负责（如世界模拟快照的 version 乐观锁）
      environmentChanges: changes.world?.environmentChanges ?? [],
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

### 10.4 LLM 调用失败处理

每回合固定 2 次 LLM 调用（裁决 + 叙事），一致性复查至多追加 1 次：

- 超时/失败：单次调用失败重试 1 次；仍失败则该回合降级为"服务器拒收"——不产生 episode、快照不变，返回错误码（如 `gm_llm_unavailable`）；
- 输出格式非法（裁决/叙事 JSON 解析失败）：按 LLM 调用失败同样处理，不写任何状态；
- 一致性复查超限：应用变更但标记 flagged（§10.1 步骤 4），不进入无限循环。

---

## 11. MCP 工具定义

### 新增工具

```typescript
// obsidian_epoch.journey_gm_act
{
  name: "obsidian_epoch.journey_gm_act",
  description: "在 GM 模式的 journey 中自由行动。用自然语言描述角色做什么。",
  inputSchema: {
    required: ["journeyId", "narrative"],
    properties: {
      journeyId: { type: "string" },
      narrative: { type: "string", maxLength: 2000 },
      recoveryCode: { type: "string" },
      idempotencyKey: { type: "string" },
    }
  }
}
```

> 授权与幂等：journeyId 必须属于当前调用者（服务端经 verifyExplorerAuth 绑定 explorer/agent，同现有工具）；仅 `server_hosted_agent` 及以上信任类可用；`recoveryCode`/`idempotencyKey` 语义与现有工具一致（服务端按 idempotencyKey 去重，接入 #idempotently 幂等模式）。工具注册名（含前缀）以实现时对照 mcpToolDefinitions.ts 现有命名确认。

### 返回结构

```typescript
interface JourneyGmActResult {
  narrative: string;            // 叙事文本
  npcDialogue: Record<string, string>;  // NPC对话
  atmosphere: string;           // 氛围描述
  innerThoughts?: string;       // 角色内心
  sensoryDetails: {             // 感官细节
    visual?: string;
    auditory?: string;
    olfactory?: string;
    tactile?: string;
  };
  discoveredInfo: {             // 发现的信息
    content: string;
    source: string;
    reliability: number;
  }[];
  agentState: {                 // 角色状态（数值）
    money: number;
    stamina: number;
    health: number;
    location: string;
  };
  availableReactions?: string[]; // 建议的后续行动
  triggeredEvents?: WorldEvent[]; // 触发的新事件
}
```

---

## 12. 与现有系统的关系

### 不替代，而是新增

```
现有: propose_journey_step → commit_journey_action (选按钮模式)
新增: journey_gm_act (自由行动模式)
```

两条路径最终写入同一个 journey event store，走同一个评分系统。

### 复用的组件

| 组件 | 复用方式 |
|---|---|
| `ModelAdapter` | 直接复用，用于调用 LLM |
| `JourneyRuntime` | 直接复用，管理 journey 生命周期 |
| `WorldSimulation` | 直接复用，管理世界状态 |
| `AgentCompanionRuntime` | 直接复用，管理角色状态 |
| `NarrativeAgent` | 改造，从"生成模板文本"变为"调用叙事者 LLM" |
| `EpochMutationCoordinator` | 直接复用，保证并发修改的原子性 |
| `EpochPersistenceGuard` | 直接复用，持久化失败时的安全关闭 |

### 不复用的组件

| 组件 | 原因 |
|---|---|
| `JourneySceneContract` | GM 模式不需要预设 action option |
| `IntentAgent` | GM 模式不需要映射回预设选项 |
| `journeyGeneratedTaskRules` | GM 运行期不预生成 taskPlan；仅在结算时按需合成最小计划（§16.5） |
| `turnHostedActionRules` | GM 模式不需要签名验证 |

---

## 13. 核心状态对齐

GM 模式的数据结构必须与现有系统的真实结构对齐，不能用伪代码。

### 13.1 世界状态

GM 模式的 `WorldState` 必须从现有 `AgentCompanionRuntime` 的 `status()` 输出构建：

```typescript
// 从现有系统读取，不自己维护
function buildWorldState(companion: AgentCompanionRuntime, journeyId: string): GMWorldState {
  const status = companion.status({ journeyId });
  const projection = companion.journeyRuntime().projection();

  return {
    agent: {
      id: status.progress.agentId,      // progress.agentId（已确认字段，publicResultViewModel.ts）
      name: status.progress.identity.identityName,
      resources: status.progress.resources,
      inventory: status.progress.inventoryItems.map(i => i.itemKey),
      location: status.journey.destinationRegionId,
      status: status.progress.identity.status,
    },
    journey: {
      id: journeyId,
      status: status.journey.status,
      version: status.journey.version,
      destinationRegionId: status.journey.destinationRegionId,
      worldMode: status.journey.worldMode,
      episodeIds: status.journey.episodeIds,
    },
    episodes: status.journey.episodeIds.map(
      id => projection.episodes[id]
    ).filter(Boolean),
    worldClock: companion.epochWorldClock(),      // 新增接口：返回 EpochWorldClockState（§15.4）
    worldState: companion.epochWorldState({       // 新增接口：返回 EpochWorldSimulationSnapshot（含 version）
      regionId: status.journey.destinationRegionId,
    }),
  };
}
```

### 13.2 NPC 状态

NPC 状态从现有 `WorldSimulation` 读取，不自己维护：

```typescript
// 从现有系统读取
function buildNPCState(
  worldState: ReturnType<AgentCompanionRuntime["epochWorldState"]>,
  regionId: string,
): Map<string, GMNPCState> {
  const npcs = new Map<string, GMNPCState>();

  // NPC 定义从世界内容注册表 / npcStateReadModel 读取（EpochNpcAssetStateView），
  // 世界模拟快照（EpochWorldSimulationSnapshot）没有 npcs 字段
  for (const npc of readNPCsForRegion(worldState, regionId)) {   // 新增读接口：注册表 NPC 定义 + NPC 状态读模型组装
    npcs.set(npc.id, {
      id: npc.id,
      name: npc.name,
      location: npc.location ?? regionId,
      attitude: npc.attitude ?? 0,
      knownFacts: npc.knownFacts ?? [],
      personality: npc.personality ?? "",
      currentAction: npc.currentAction ?? "idle",
    });
  }

  return npcs;
}
```

### 13.3 已知事实

角色的已知事实从现有 `JourneyProjection` 的 episodes 中提取。注意真实类型 `ServerJourneyEpisodeFacts` 没有 `discoveredInfo` 字段——事实只存在 `confirmedFacts`（已确认）与 `rumors`（传闻）两个数组里（journeyNarrativeRules.ts:60-70）：

```typescript
function buildKnownFacts(
  episodes: JourneyEpisode[],    // projection.episodes（JourneySceneEpisode）
): string[] {
  const facts: string[] = [];

  for (const episode of episodes) {
    // 已确认事实（裁决 confirmed 落账，§6.4 入账规则）
    for (const fact of episode.serverFacts?.confirmedFacts ?? []) {
      facts.push(fact.text);
    }
    // 服务器判定摘要
    if (episode.serverFacts?.storyBeat) {
      facts.push(episode.serverFacts.storyBeat.outcomeSummary);
    }
  }

  return [...new Set(facts)];
}
```

落账规则（裁决输出 → episode.serverFacts，§16.3 实现）：
- `informationConsequences.confirmed` → `confirmedFacts`（可进入已知事实）；
- `informationConsequences.discovered`（0 < reliability < 1）→ `rumors`（不进已知事实；可被后续行动验证升级为 confirmed）。

---

## 14. 提交原子性

GM 模式的一次行动必须原子性地更新所有状态。不能出现"角色状态更新了但 NPC 状态没更新"的中间态。

### 14.1 事务边界

一次 GM 回合的全部步骤（§10.1 步骤 1-12）在 `EpochMutationCoordinator.run()` 内串行执行。真实接口只有 `run()`/`drain()`，**没有 `coordinate()`**（epochPersistence.ts:14-18）：

- 同一 Journey 内：GM 行动由 `expectedVersion` 乐观锁保证串行（冲突抛 `journey_version_conflict`）；
- 跨 Journey：世界状态变更经 coordinator 串行化（§15.2）。

持久化沿用现有模式：journey 事件经 `attachJourneyEventsForPersistence` 携带、`persistEpochEventBatchWithGuard(persist, guard, events)` 落库（epochPersistence.ts:89-102）；`EpochPersistenceGuard` 失败抛 `epoch_persistence_unavailable`，整个 run 块失败，不产生部分状态。

### 14.2 事件结构

GM 模式**不新增事件类型、不改投影器**。每次行动提交复用现有 `journey_episode_recorded`：

- `JourneyRuntime.commitEpisodes`（扩展允许 `gm_active` 状态）内部走 `recordJourneyEpisode` + `#snapshotEvent("journey_episode_recorded", ...)`（journeyRuntime.ts:984-1009），事件自动携带完整 journey 快照、`policySelection`、`preview`——天然满足 `applyJourneyRuntimeEvent` 的全部不变量（版本连续 :126、身份一致 :119、episodeId 已入 episodeIds :132）；
- `projectJourneyRuntimeEvents` 与 `applyJourneyRuntimeEvent` 无需任何改动。

新增的 companion 方法 `commitGMEpisode` 是 `commitEpisodes` 的 GM 变体：

```typescript
// AgentCompanionRuntime 新增方法（实现时接入 #idempotently 幂等模式）
commitGMEpisode(input: {
  journeyId: string;
  expectedVersion: number;
  episode: JourneySceneEpisode;   // §16.3 buildGMEpisode 产出
}) {
  // 1. authorizeExplorer（同现有工具）
  // 2. 状态校验：journey.status 必须为 gm_active（否则 journey_gm_status_invalid）
  // 3. 校验 episode 形状（§16.3）
  // 4. 生成 eventId（idFactory）→ 回填 episode.serverFacts.sourceEventIds → 提交
  // 5. journeyRuntime.commitEpisodes(journeyId, expectedVersion, [episode])
  //    —— recordJourneyEpisode 状态白名单需加入 gm_active（§16.1）
}
```

GM episode 必须满足 `JourneySceneEpisode` 形状（必填字段见 journeySceneRules.ts:106-125），构造方式见 §16.3。

---

## 15. 并发处理

### 15.1 单 Journey 内的并发

同一个 Journey 内，GM 行动是串行的。一次 `journey_gm_act` 调用完成后，才能发起下一次。通过 `expectedVersion` 乐观锁保证（与现有 commitEpisodes 相同的 `assertExpectedVersion` 语义，journeyRules.ts:436-439）：

```typescript
// 提交时检查版本
if (currentJourney.version !== expectedVersion) {
  throw new Error("journey_version_conflict");
}
```

### 15.2 跨 Journey 的并发

多个 agent 可能同时在同一区域行动。世界状态的并发修改通过 `EpochMutationCoordinator` 串行化（真实接口是 `run()`，不是 `coordinate()`）：

```typescript
// 世界状态修改走 mutation coordinator
mutationCoordinator.run(async () => {
  // 读取世界状态快照（新增接口，返回 EpochWorldSimulationSnapshot，含 version/stateHash）
  const worldSnapshot = companion.epochWorldState({ regionId });

  // 判定 + 叙事（§10.1 步骤 3/6）
  const judgment = await adjudicate(...);
  const narration = await narrate(...);

  // 写入世界状态变更（新增接口，见下）
  companion.updateWorldState({
    regionId,
    expectedVersion: worldSnapshot.version,
    changes: judgment.worldConsequences.environmentChanges,
  });
});
```

> `updateWorldState` 是新增接口（现有 AgentCompanionRuntime 未提供），需按世界模拟快照的版本化语义实现（expectedVersion 校验 + 变更事件落地，对齐 worldSimulationRules.ts 的 EpochWorldSimulationSnapshot）。

### 15.3 NPC 状态的并发

NPC 状态修改需要合并策略（GM 侧 ledger，不对现有世界模拟快照字段造成破坏）：

```typescript
interface NPCStateMergeStrategy {
  // 态度变更：取增量，不覆盖
  attitude: "additive";
  // 已知事实：追加，不覆盖
  knownFacts: "append_only";
  // 位置：最后一次写入生效
  location: "last_write_wins";
  // 当前行动：最后一次写入生效
  currentAction: "last_write_wins";
}
```

### 15.4 时间流逝

裁决输出的 `timeElapsedMinutes` 必须推进世界时钟（§2.3 时间约束的落地路径）。复用现有世界时钟运行时的 `advance` 语义（worldClockRules.ts:495-537，要求 elapsedWorldMinutes ≥ 1）：

```typescript
// 新增 companion 接口，内部走 clock.advance({
//   elapsedWorldMinutes, reason, processedDomains, sourceEventIds, idempotencyKey })
companion.advanceWorldClock({
  elapsedWorldMinutes: judgment.physicalConsequences.timeElapsedMinutes,
  reason: "gm_action",
  processedDomains: ["world_clock"],
  idempotencyKey: `${journeyId}:gm:${journeyVersion}`,
});
```

> GM 回合的耗时以裁决输出为准；世界时钟与 mirror window 互不替代，GM 模式不走 traveling/returning 的时间预算流程（§16.2）。

---

## 16. 与现有 Journey 状态机的衔接

### 16.1 状态机扩展

GM 模式需要在现有 Journey 状态机中增加新状态：

```typescript
// 现有状态
type JourneyStatus =
  | "draft"
  | "prepared"
  | "traveling"
  | "awaiting_agent"
  | "awaiting_user"
  | "returning"
  | "settling"
  | "settled"
  | "cancelled"
  | "identity_ended";

// GM 模式新增状态
type GMJourneyStatus =
  | "gm_active"       // GM 模式进行中
  | "gm_paused";      // GM 模式暂停（agent 离线）
```

新增状态需要同步扩展以下现有守卫（不改会导致 GM 状态被拒绝或转换非法）：

| 位置 | 需要改动 |
|---|---|
| `LEGAL_JOURNEY_TRANSITIONS`（journeyRules.ts:352-363） | 新增 `gm_active: ["gm_paused", "settling", "cancelled", "identity_ended"]`、`gm_paused: ["gm_active", "cancelled", "identity_ended"]` |
| `ACTIVE_JOURNEY_STATUSES`（journeyRules.ts:343-350） | 加入 `gm_active`、`gm_paused` |
| `recordJourneyEpisode`（journeyRules.ts:748-751） | 状态白名单加入 `gm_active` |
| `proposeStep` 状态守卫（agentCompanionRuntime.ts:591） | 保持原样——GM 模式走独立入口 `commitGMEpisode`（§14.2），不经 proposeStep |
| 结算触发（`#hasGroundedThreePhase`，journeyRuntime.ts:948-982） | GM 结算跳过三段校验（GM 没有 arrival/return 段），走 GM 专属结算入口（§16.5） |

### 16.2 状态转换

```
draft → prepared → gm_active → gm_paused → gm_active
                            → settling → settled
                            → cancelled
                            → identity_ended
```

- `settled` 仍只能从 `settling` 进入，保持现有 `LEGAL_JOURNEY_TRANSITIONS` 语义；
- GM 模式不走 `traveling → awaiting_agent → returning → settling` 的现有流程。`traveling` 的时间预算/返程逻辑（dueAtWorldTime、return condition）在 GM 模式下由 GM 循环的时间流逝（§15.4）取代；"时间耗尽"结局由 GM 侧判断触发结算（§16.5）；
- 结算触发：GM 结算跳过 `#hasGroundedThreePhase` 三段校验，由 GM 专属入口直接进入 settling。

### 16.3 GM episode 构造（对齐真实类型）

GM 模式的事件由 §14.2 的现有 `journey_episode_recorded` 机制处理，投影无需改动；这里只定义 GM episode 的构造。episode 必须满足 `JourneySceneEpisode` 形状（必填字段见 journeySceneRules.ts:106-125），其中 `serverFacts` 必须包含 `journeyId`、`episodeId`、`allowedEntities`、`confirmedFacts`、`rumors`、`stateChanges`、`sourceEventIds`、`verification` 全部必填字段（journeyNarrativeRules.ts:60-70），`storyBeat` 必须包含 `phase`、`sceneTitle`、`selectedAction`、`outcomeSummary`（journeyNarrativeRules.ts:40-58）：

```typescript
function buildGMEpisode(input: {
  journeyId: string;
  index: number;                  // 本 journey 第几轮 GM 行动（episodeIds.length + 1）
  playerNarrative: string;
  snapshot: GMWorldState;
  judgment: AdjudicatorOutput;
  narration: NarratorOutput;
  validatedChanges: ValidatedStateChanges;
  sourceEventId?: string;         // 提交时由服务端生成 eventId 后回填（§14.2 commitGMEpisode 第 4 步）
}): JourneySceneEpisode {
  const valid = input.judgment.actionValid;
  const sourceEventId = input.sourceEventId ?? "";   // 提交时回填本次事件 eventId（§14.2）
  const episodeId = `${input.journeyId}:gm:${input.index}`;
  // fingerprint.locationId 必须是字符串（用 destinationRegionId 兜底）
  const locationId = input.validatedChanges.agent.location
    ?? input.snapshot.agent.location
    ?? input.snapshot.journey.destinationRegionId;

  const storyBeat: JourneyEpisodeStoryBeat = {
    phase: "main",
    sceneTitle: input.narration.atmosphere || "自由行动",
    selectedAction: {
      optionKey: "gm_free_action",
      label: input.playerNarrative,          // 角色试图做什么
      completionKind: valid ? "complete" : "failed",
    },
    outcomeSummary: input.narration.summary || input.narration.narrative.slice(0, 200),
  };

  // 事实落账（§6.4 入账规则）：confirmed → confirmedFacts；discovered(0<r<1) → rumors
  const confirmedFacts: JourneyNarrativeFact[] = input.judgment.informationConsequences.confirmed.map(
    (text, i) => ({
      factId: `fact:${episodeId}:${i}`,
      text,
      entityIds: [],
      sourceEventIds: [sourceEventId],
    }),
  );
  const rumors: JourneyNarrativeRumorFact[] = input.judgment.informationConsequences.discovered
    .filter((f) => f.reliability > 0 && f.reliability < 1)
    .map((f, i) => ({
      factId: `rumor:${episodeId}:${i}`,
      status: "unconfirmed",
      text: f.content,
      entityIds: [],
      sourceEventIds: [sourceEventId],
    }));

  return {
    episodeId,
    candidateId: "scene:gm:free_action",
    type: "travel",
    phase: "main",
    title: input.narration.atmosphere || "自由行动",
    worldObjectRefs: [],                      // 可扩展：judgment 命中的 world object
    sourceFactIds: [],
    optionIds: ["gm_free_action"],
    outcomeKey: valid ? "gm_action_success" : "gm_action_failed",
    fingerprint: {
      locationId,
      participantIds: [],
      optionIds: ["gm_free_action"],
      outcomeKey: valid ? "gm_action_success" : "gm_action_failed",
    },
    routine: false,
    serverFacts: {
      journeyId: input.journeyId,
      episodeId,
      allowedEntities: [],                    // 可扩展：judgment 涉及的 NPC/地点
      confirmedFacts,
      rumors,
      stateChanges: stateChangesFrom(input.validatedChanges),   // JourneyNarrativeStateChange[]
      sourceEventIds: [sourceEventId],
      verification: {
        url: "公开结算页 URL（由服务器构造，与现有模式一致）",
        journeyId: input.journeyId,
        episodeId,
        fragment: "gm-episode",
      },
      storyBeat,
    },
    narrative: buildGMPersistedNarrative(input),   // 映射见下表
  };
}
```

### 16.4 叙事持久化映射

`narrative` 必须是 `PersistedJourneyNarrative`（`GroundedJourneyNarrative | JourneyNarrativeFactTemplate`，journeyNarrativeRules.ts:144），没有自由文本字段。NarratorOutput 到持久化格式的映射：

| NarratorOutput 字段 | 持久化位置 |
|---|---|
| narrative（完整文本） | `postcard.text`（grounded_narrative 变体） |
| atmosphere | `episode.title` / `storyBeat.sceneTitle` |
| summary | `storyBeat.outcomeSummary` |
| npcDialogue / innerThoughts / sensoryDetails | 现有类型无对应字段——需扩展 `PersistedJourneyNarrative` 增加可选 `gmNarrative` 字段（唯一需要新增的类型变更，实现时评审） |

### 16.5 结算兼容

GM 模式的结算必须能被现有的 `buildGroundedJourneyStoryReport` 处理。该报告函数依赖 taskPlan 计算完成档位与奖励（内部调用 `nextJourneyTaskObjective`、`buildJourneyMission`），因此 GM 模式无 taskPlan 时必须先合成最小计划（复用现有 `buildFallbackJourneyTaskPlan`，agentCompanionRuntime.ts:527-533 已在使用）：

```typescript
// GM 模式的结算
function settleGMJourney(
  companion: AgentCompanionRuntime,
  journeyId: string,
): JourneySettlement {
  const status = companion.journeyRuntime().status(journeyId);
  const episodes = status.journey.episodeIds.map(
    id => companion.journeyRuntime().projection().episodes[id]
  ).filter(Boolean);

  // GM 无 taskPlan：合成最小计划（taskType/scenarioMapId/availableWorldObjects
  // 复用现有 #taskGenerationContext 输出）
  const generation = companion.taskGenerationContext({ journeyId });   // 现有方法（agentCompanionRuntime.ts:583）
  const taskPlan = status.journey.taskPlan
    ?? buildFallbackJourneyTaskPlan({
        taskType: generation.taskType,
        scenarioMapId: generation.scenarioMapId,
        availableWorldObjects: generation.availableWorldObjects,
        riskProfile: phase6FallbackRiskProfile(undefined),
      });

  // 用现有的故事报告生成器（字段名以实现时对照
  // BuildGroundedJourneyStoryReportInput，journeyStoryReport.ts:176）
  const storyReport = buildGroundedJourneyStoryReport({
    journeyId,
    objective: status.journey.mandate.objective,   // JourneyMandate.objective（journeyPolicyRules.ts:31）
    regionId: status.journey.destinationRegionId,
    startedAtWorldTime: status.journey.startedAtWorldTime,
    dueAtWorldTime: status.journey.dueAtWorldTime,
    worldCommit: status.journey.worldCommit,
    episodes,
    taskPlan,                    // 合成计划
    hiddenTaskSeal: undefined,   // GM 模式没有 hidden task
    hiddenPrerequisiteLinks: [],
  });

  return {
    journeyId,
    storyReport,
    episodes,
    settledAt: new Date().toISOString(),
  };
}
```

> 完成档位（待实现确认，二选一）：
> - (a) 推荐——扩展任务判定：合成计划的 objective 数 = GM 轮次数，每个 GM episode 的 `storyBeat.selectedAction.completionKind` 作为完成证据，让现有结算管线统计档位；
> - (b) 退路——GM 结算不判定档位，直接按统一档位结算并发放固定奖励。

---

## 17. 一致性保障详细设计

### 17.1 事实一致性

```typescript
interface ConsistencyGuard {
  factLedger: FactLedger;
  npcLedger: NPCLedger;
  precedentLedger: PrecedentLedger;
}

interface FactLedger {
  confirmed: Map<string, { fact: string; source: string; timestamp: number }>;
  rumored: Map<string, { fact: string; confidence: number; source: string }>;
}

function checkFactConsistency(
  newFact: string,
  ledger: FactLedger,
): "consistent" | "contradicts" | "unknown" {
  for (const [key, existing] of ledger.confirmed) {
    if (contradicts(newFact, existing.fact)) {
      return "contradicts";
    }
  }
  return "unknown";
}

function contradicts(factA: string, factB: string): boolean {
  // 简单的矛盾检测
  // 例: "仓库是空的" vs "仓库里有货物"
  // 实际实现需要更复杂的语义比较
  return false; // 简化实现
}
```

### 17.2 NPC一致性

```typescript
interface NPCLedger {
  profiles: Map<string, NPCProfile>;
  interactionHistory: Map<string, InteractionRecord[]>;
}

function checkNPCConsistency(
  npcId: string,
  proposedAction: string,
  ledger: NPCLedger,
): "consistent" | "out_of_character" {
  const profile = ledger.profiles.get(npcId);
  if (!profile) return "consistent"; // 新NPC，没有历史

  const history = ledger.interactionHistory.get(npcId) ?? [];
  const recentInteractions = history.slice(-5); // 最近5次互动

  // 检查是否与已建立的性格矛盾
  // 例: 一个害羞的NPC突然主动搭话
  // 例: 一个敌对的NPC突然友善

  return "consistent"; // 简化实现
}
```

### 17.3 判例一致性

```typescript
interface PrecedentLedger {
  precedents: Map<string, AdjudicatorOutput>;
}

function checkPrecedentConsistency(
  situation: string,
  proposedOutcome: AdjudicatorOutput,
  ledger: PrecedentLedger,
): "consistent" | "conflicts_with_precedent" {
  const precedent = ledger.precedents.get(hashSituation(situation));
  if (!precedent) return "consistent"; // 没有先例

  // 检查是否与先例矛盾
  // 例: 上次威胁守卫成功了，这次同样的情况却失败了

  return "consistent"; // 简化实现
}
```

---

## 18. 附录: 一轮完整示例

### 输入

```
角色: 陈卫，34岁，退伍军人，码头夜班保安
位置: 楼下小卖部
时间: 晚上10:15
天气: 小雨
资源: 金钱1850, 体力70, 健康90
装备: 工牌、旧手机、半包红塔山、打火机、手电筒

NPC: 小卖部老板刘叔，50多岁，话多，正在看手机

已知事实:
- 九号仓库昨晚有灯亮着
- 前妻需要女儿钢琴课的钱

玩家行动: "我去小卖部买包烟，顺便和刘叔聊聊最近码头的情况。"
```

### 裁决者输出

```json
{
  "actionValid": true,
  "invalidReason": null,
  "physicalConsequences": {
    "staminaCost": 2,
    "healthChange": 0,
    "timeElapsedMinutes": 20,   // 20 分钟，代码据此推进世界时钟（§15.4）
    "moneySpent": 16
  },
  "socialConsequences": {
    "npcChanges": {
      "shopkeeper_liu": {
        "attitudeChange": 5,
        "newImpression": "这个年轻人懂礼貌，买东西不讲价",
        "willRemember": ["他买了红塔山", "他问起码头的事"]
      }
    }
  },
  "informationConsequences": {
    "discovered": [
      {
        "content": "最近码头晚上经常有陌生车来",
        "source": "shopkeeper_liu",
        "reliability": 0.6,
        "reason": "刘叔说他看到过，但没细问"
      },
      {
        "content": "九号仓库以前出过事",
        "source": "shopkeeper_liu",
        "reliability": 0.4,
        "reason": "刘叔是听别人说的，具体不清楚"
      }
    ],
    "confirmed": [],
    "contradicted": []
  },
  "worldConsequences": {
    "newEvents": [],
    "environmentChanges": []
  },
  "npcAutonomousActions": {
    "shopkeeper_liu": {
      "action": "放下手机，开始整理货架",
      "mood": "闲着也是闲着",
      "mightInitiateConversation": true,
      "conversationTopics": ["天气", "码头最近的生意", "他女儿的学习成绩"]
    }
  }
}
```

### 叙事者输出

```json
{
  "narrative": "小卖部的灯管嗡嗡响，有一根在闪。刘叔坐在柜台后面，手机屏幕的光打在他脸上，他正在看短视频。\n\n你推门进去，他头也没抬。\"自己拿。\"\n\n你从货架上拿了包红塔山，放到柜台上。他这才看了你一眼。\"哟，小陈。\"他把手机扣在桌上，给你找钱。\n\n\"刘叔，最近码头那边怎么样？\"\n\n他找钱的手顿了一下。\"你问这个干嘛？\"\n\n\"没干嘛，随便问问。我是保安，了解一下情况。\"\n\n他把零钱推给你，压低了声音：\"最近晚上不太平，你别乱跑。前两天我收摊的时候，看到有车往九号仓库那边开，没开车灯。\"\n\n\"什么车？\"\n\n\"面包车，黑色的。以前也见过。\"他顿了顿，\"上次是几个月前，后来听说仓库那边出过事。具体什么事我也不清楚，你别去打听。\"\n\n他说完又拿起手机，像是后悔说了什么。",
  "npcDialogue": {
    "shopkeeper_liu": "\"最近晚上不太平，你别乱跑。前两天我收摊的时候，看到有车往九号仓库那边开，没开车灯。\""
  },
  "atmosphere": "灯管的嗡嗡声，手机短视频的背景音乐，窗外的雨声",
  "innerThoughts": "他说'别去打听'的时候，你知道他在说真话。他确实看到了什么，但他不想惹麻烦。",
  "sensoryDetails": {
    "visual": "灯管在闪，手机屏幕的光",
    "auditory": "灯管嗡嗡声，短视频的背景音乐",
    "olfactory": "小卖部里方便面和洗衣粉混合的味道",
    "tactile": "找零的硬币还是温的"
  }
}
```
