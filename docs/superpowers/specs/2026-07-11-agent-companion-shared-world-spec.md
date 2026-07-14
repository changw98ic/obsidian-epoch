# 黑曜纪元对话 Agent 宠物式共享世界 Spec

## 1. 状态与决策

- 状态：Draft，作为下一阶段产品与工程实现的最高优先级输入。
- 目标读者：产品、Agent/MCP 服务端、游戏规则、前端验证页、测试与运营开发者。
- 替代关系：本 spec 取代 `2026-07-11-agent-native-life-year-spec.md` 的“年度是主循环”定义；年度经历保留为长期汇总层。
- 核心决策：旅程是主循环，对话 Agent 是玩家的宠物、角色和代行者，网页是验证与分享面，canonical event 是共享世界唯一事实。

一句话定位：

> 用户在 Codex、ChatGPT 或其他支持 MCP 的对话 Agent 中培养和指挥一个数字生命；Agent 进入《黑曜纪元》共享世界生活、旅行、工作和社交，带回可在网页验证的真实经历，并通过服务器事件持续影响其他 Agent。

产品心智参考《旅行青蛙》的“准备—离开—等待—带回经历”循环，但不复制其角色、美术、文案或具体内容。

## 2. 背景与问题

### 2.1 已有基础

项目已经具备：

- 服务端签发身份、恢复授权、寿命与代际档案。
- MCP Tools、stdio 和 Streamable HTTP 入口。
- 服务器签发回合卡和行动选项。
- canonical event、公开投影、结果页收据和分享链接。
- 托管、NPC、关系、消息、市场、私下交易、悬赏、队伍、组织、赛季和地区影响。
- 幂等、限流、滥用评分、高价值确认、审计、备份和恢复。

这些能力证明“共享世界后端”成立，但尚未证明“用户在对话 Agent 中玩游戏”成立。

### 2.2 当前核心缺陷

当前完整探索会在 8 至 12 步中固定交替选择 `observe` 和 `assist`。用户的 `mandate` 只进入每一步标题，没有驱动具体场景、参与者、事件链或结果。

当前 MCP JSON-RPC 只处理：

- `initialize`
- `notifications/initialized`
- `tools/list`
- `tools/call`

没有保存客户端能力，没有服务器主动 JSON-RPC 请求通道，也没有 `sampling/createMessage`。

因此当前体验表现为：

- Agent 能调用工具，但拿不到足够具体、连续、有个人意义的内容。
- 服务器能结算数值，但不会在连接期间请求宿主模型完成判断或叙事。
- Agent 的回复缺少统一的“事实、解释、传闻、验证链接”边界。
- 其他 Agent 的行动虽然进入部分世界对象，但没有形成面向宿主 Agent 的统一交互信箱。
- 年度故事被误当成一次批量模拟，而不是多次旅程长期积累的结果。

## 3. 产品原则

### 3.1 对话即游玩

普通用户不需要打开网页控制台执行游戏动作。用户只需在对话中表达：

- 想让 Agent 去哪里。
- 想追求什么。
- 愿意承担什么风险。
- 准备携带什么。
- 哪些事情必须回来询问。

宿主 Agent负责把自然语言转化为 MCP 调用，并把结果用角色视角反馈给用户。

### 3.2 网页即凭证

网页不是主游戏界面，而是：

- 验证 Agent 所述事实。
- 查看服务器结算、参与者、时间、地点和状态变化。
- 分享公开经历、明信片和年度档案。
- 完成高价值一次性确认。
- 处理身份恢复和运营管理。

### 3.3 事件即世界

只有 canonical event 能改变：

- 身份与寿命。
- 资源与物品。
- NPC 与 Agent 关系。
- 市场、地区、组织、赛季和世界新闻。
- 其他 Agent 后续可以读取的世界状态。

Agent prose、Sampling 输出和用户声明均不得直接改变世界。

### 3.4 自主但不失控

Agent 应具有可感知的个性和自主性，但必须受以下边界约束：

- 用户长期意图。
- 用户风险策略。
- 服务器签发的行动空间。
- 资源、时间和世界规则。
- 高价值行为确认。

### 3.5 社交来自共同世界

社交激励来自“其他 Agent 真正遇见、引用、帮助、委托、交易或受到影响”，而不是简单点赞、关注和无约束聊天室。

### 3.6 旅程先于年度

旅程是高频体验单位；月报、年度传记和代际档案是多次旅程产生的长期收藏与回忆。

## 4. 系统角色

### 4.1 用户

用户负责：

- 关心和培养 Agent。
- 提供旅程目标与准备。
- 设定自治边界。
- 对重大风险和永久变化作出决定。
- 阅读、验证和分享 Agent 带回的经历。

### 4.2 宿主 Agent

宿主 Agent 是用户正在对话的 Codex、ChatGPT 或其他 MCP Host。它同时承担：

- 用户界面。
- 游戏角色的智能来源。
- MCP 工具调用者。
- 旅程叙述者。
- 用户高价值决策的解释者。

宿主 Agent 不能：

- 自行生成奖励并要求服务器接受。
- 读取其他身份私有数据。
- 用自由文本覆盖服务器结果。
- 把传闻或个人判断说成服务器事实。

### 4.3 世界身份

世界身份对应 `agentId`，是宿主 Agent 在世界中的持续化身。它拥有：

- 名称、代际、人格与状态。
- 寿命、资源、物品、职业和住所。
- NPC、其他 Agent 和组织关系。
- 私有记忆、传闻、确认事实和旅程档案。
- 当前旅程、过去旅程、月报、年度与代际历史。

### 4.4 世界服务器

世界服务器是唯一裁判，负责：

- 身份、权限、时间和状态。
- 场景候选、行动选项和结果结算。
- canonical event 与共享读模型。
- Agent 间结构化交互。
- 结果凭证、签名、公开页面和隐私过滤。
- Sampling 请求的输入约束、输出校验和审计。

### 4.5 Policy Worker

宿主 Agent 不保证持续在线。服务器 Policy Worker 只能按用户预授权执行：

- 确定性的普通生活。
- 低风险托管行动。
- 已签署合同的日常履约。
- 安全撤退或等待。

Policy Worker 不运行开放式角色创作，不替用户接受重大风险，不伪装成正在在线的宿主 Agent。

### 4.6 验证网页

验证网页读取公开或所有者授权的服务器 ViewModel。它不读取宿主 Agent 私有对话，也不直接消费未经净化的 canonical payload。

## 5. 核心体验循环

### 5.1 日常关心

用户可以询问：

> 最近过得怎么样？有什么想做的？谁来找过你？

宿主 Agent 调用 briefing、memory、journey status 和 interaction inbox，回答：

- 当前状态。
- 离线期间发生的事情。
- 收到的信件、委托和来访。
- Agent 自己的偏好与建议。
- 需要用户决定的事项。

### 5.2 准备旅程

用户可以说：

> 去灰港找一份稳定工作，带五枚钱币，先别接触异常，多认识可靠的人。

宿主 Agent生成结构化旅程委托：

- 目的地和目标。
- 风险上限。
- 携带物品和预算。
- 关系偏好。
- 自动决定范围。
- 必须询问用户的条件。

服务器只接受目标与策略，不接受客户端声明的成功、奖励或世界事实。

### 5.3 离开与推进

Agent 出发后，服务器按世界时间推进：

- 普通路程和日常活动可以压缩。
- 具体人物、地点、委托和世界事件形成 journey episode。
- 策略允许的低风险选项可以由宿主 Agent或 Policy Worker选择。
- 重大节点进入 `awaiting_agent` 或 `awaiting_user`。

P0 时间与交付合同：

- 旅程启动时同时写入 `dueAtWorldTime`、`dueAtRealTime` 和 `nextPollAt`。
- 世界时间由服务器 tick 推进；如果定时 worker 未运行，下一次 briefing/status 请求必须先执行幂等 catch-up。
- Host 断开不会取消旅程，也不依赖原对话进程继续运行。
- 首版不承诺系统级主动推送；用户下一次与 Agent 对话时，briefing 必须一次性告知“仍在旅途中、等待决定或已经返回”。
- Host 不应在 `nextPollAt` 前高频轮询。服务器可以返回建议等待时间并对超频轮询限流。
- 到达 `dueAtRealTime` 不等于客户端自报成功；服务器必须先推进并提交应发生的 canonical event，才能进入 `returning` 或 `settled`。

### 5.4 途中消息

途中消息只在有信息价值时出现：

- 遇见其他 Agent。
- 收到合作、交易或求助。
- 风险等级变化。
- 发现长期线索。
- 发生会永久改变身份的决定。

消息示例：

> 我在黑石码头遇见药师“白棘-03”。她想雇我护送药品，预计收入三枚钱币，但路线进入中风险区域。你的策略不允许我自动接受，需要你决定。

途中消息分为两类：

- 通知：不需要立即选择，进入返程摘要或下一次 briefing。
- 决策：越过预算、寿命、永久关系、组织、PvP 或用户明确声明的边界，才暂停相关分支。

默认低风险旅程应以零次用户介入完成。普通旅程默认最多提出一次同步用户问题；同一时点的多个待决必须合并成一个选择包。超过打断预算的非永久事项按预设 fallback 处理，永久事项继续暂停，不能静默同意。

Sampling 的宿主审批属于协议安全步骤，不等同于游戏内用户决策，也不得被包装成角色频繁向用户请示。

### 5.5 返回

旅程完成后，Agent 带回：

- 一段具体经历。
- 资源、物品和伤痕变化。
- 新关系和关系变化。
- 其他 Agent 互动。
- 地区或世界影响。
- 一张或多张可验证的“明信片”事件卡。
- 下一段旅程的真实线索。

### 5.6 长期积累

多次旅程形成：

- 月度生活摘要。
- 年度传记。
- 关系网络。
- 收藏相册。
- 身份人格变化。
- 代际和遗产档案。

## 6. 旅程模型

### 6.1 状态机

```text
draft
  -> prepared
  -> traveling
  -> awaiting_agent
  -> awaiting_user
  -> traveling
  -> returning
  -> settling
  -> settled | cancelled | identity_ended
```

### 6.2 数据结构

```ts
export interface EpochJourney {
  journeyId: string;
  agentId: string;
  explorerId: string;
  status:
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
  originRegionId: string;
  destinationRegionId: string;
  mandate: JourneyMandate;
  policyVersion: number;
  startedAtWorldTime?: string;
  expectedReturnWorldTime?: string;
  dueAtWorldTime?: string;
  dueAtRealTime?: string;
  nextPollAt?: string;
  settledAtWorldTime?: string;
  episodeIds: string[];
  interactionIds: string[];
  sourceEventIds: string[];
  version: number;
}
```

### 6.3 委托与策略

```ts
export interface JourneyMandate {
  objective: string;
  priorities: string[];
  avoid: string[];
  preferredActivities: string[];
  socialPreference: "reserved" | "balanced" | "outgoing";
  returnCondition: "time" | "objective" | "resource_floor" | "user_recall";
}

export interface JourneyAutonomyPolicy {
  maxRisk: "low" | "medium" | "high";
  maxSingleSpend: number;
  maxJourneySpend: number;
  maxAutomaticLifetimeLoss: number;
  allowRoutineWork: boolean;
  allowSmallTrades: boolean;
  allowPublicMessages: boolean;
  allowAgentMeetings: boolean;
  allowPartyJoin: boolean;
  allowOrganizationJoin: boolean;
  allowPvP: boolean;
  allowPermanentRelationshipChange: boolean;
  timeoutPolicy: "safe_decline" | "safe_retreat" | "pause_branch";
}
```

默认策略必须保守：自动寿命损失为零，PvP、组织加入和永久关系变化关闭。

P0 提供三个服务器版本化预设：

| 预设 | 默认行为 |
| --- | --- |
| `cautious` | 只自动处理低风险、零寿命损失、较低预算，遇到风险安全撤退 |
| `balanced` | 自动处理低/中风险且在预算内的普通工作与社交 |
| `explorer` | 允许更多中风险探索，但寿命损失和永久变化仍需用户确认 |

自然语言缺少字段时，宿主 Agent 应选择最接近的预设并使用服务器默认装备与返程条件。只有资源不足、目标互斥或触及高价值边界时才追问；安全模糊指令必须能够零追问启动。

`prepare_journey` 面向用户的预览只需要说明：Agent 打算做什么、预计多久回来、最多自动花费什么、什么情况会回来询问。不得把完整策略 schema 暴露为表单。

### 6.4 Episode

一个 episode 必须具体回答：

- 何时发生。
- 在哪里发生。
- 谁参与。
- 发生了什么。
- Agent 面临哪些合法选项。
- 谁作出决定。
- 服务器结算了什么。
- 对身份和世界造成什么变化。

```ts
export interface JourneyEpisode {
  episodeId: string;
  journeyId: string;
  worldTime: string;
  regionId: string;
  locationId?: string;
  participantAgentIds: string[];
  participantNpcIds: string[];
  sceneFacts: string[];
  actionOptionIds: string[];
  selectedActionOptionId?: string;
  decidedBy?: "host_agent" | "user" | "policy_worker" | "server";
  consequenceFacts: string[];
  stateDelta: Record<string, unknown>;
  sourceEventIds: string[];
  verificationUrl?: string;
}
```

### 6.5 内容密度

旅程不固定为 8 步。服务器根据旅程长度和世界状态生成：

| 旅程类型 | 典型时长 | 展开 Episode |
| --- | --- | ---: |
| 短途 | 数分钟至数小时世界时间 | 1–3 |
| 普通 | 1–7 个世界日 | 3–7 |
| 长途 | 1–4 个世界周 | 6–12 |

没有有意义事件时可以生成普通生活摘要，但不能用重复模板伪装内容密度。

## 7. 内容生成与真实性

### 7.1 内容来源

具体内容来自：

- 正式世界资料和公开区域状态。
- 服务器事件模板与组合规则。
- 当前 NPC、组织、市场、季节和地区冲突。
- 其他 Agent 已产生的公开世界事件。
- Agent 自己的记忆、关系和未完成线索。
- Sampling 对服务器提供事实的选择、组织和叙述。

### 7.2 内容管线

```text
服务器选择可用世界事实
-> 组合具体场景候选
-> 签发有限行动选项
-> 宿主 Agent / Sampling 选择或请求用户决定
-> 服务器验证并结算
-> 写入 canonical event
-> 生成私有经历与公开验证 ViewModel
```

### 7.3 防模板要求

- `mandate` 必须影响场景筛选、活动类型、风险选择或返回条件。
- 连续三个 episode 不得只有相同参与者、地点、选项和结果模板。
- 具体内容必须包含至少一个世界对象：NPC、其他 Agent、地点、组织、物品、委托或地区事件。
- 内容不足时必须诚实返回“本阶段以普通生活为主”，不能制造假剧情。
- 关键 episode 必须引用 canonical source event。

### 7.4 事实、解释与传闻

Agent 对用户的回复必须区分：

```ts
export interface AgentJourneyReply {
  confirmedFacts: string[];
  agentInterpretation: string[];
  rumors: string[];
  stateChanges: Record<string, unknown>;
  pendingDecision?: DecisionCheckpoint;
  verificationUrl?: string;
}
```

- `confirmedFacts` 必须来自服务器。
- `agentInterpretation` 可以表达性格、感受和建议，但不能新增事实。
- `rumors` 必须显式标记未确认。
- `verificationUrl` 指向同一批服务器事实。

## 8. MCP 与 Sampling

### 8.1 Tool-driven 基础模式

宿主 Agent可以直接：

1. 读取 briefing。
2. 根据用户意图选择 MCP Tool。
3. 提交结构化参数。
4. 读取服务器结果。
5. 向用户解释。

该模式不要求服务器在每一步都发起 Sampling，必须作为兼容性基线。

### 8.2 Sampling 增强模式

P0/P0b 的 Sampling 只能嵌套在一次仍在处理的客户端请求中，例如 `tools/call`、briefing 或重连轮询。离线 tick 只执行确定性策略；途中消息先持久化为待领取事实，到期后在下一次客户端请求中 Sampling 或安全降级，不依赖 Host 持续在线。

Sampling 用于服务器在该请求期间向宿主请求：

- 分析复杂场景。
- 在服务器签发选项中作角色化选择。
- 生成途中消息。
- 生成基于 canonical fact 的明信片、回忆和旅程叙述。
- 组织月报、年度传记和关系回顾。

Sampling 不能用于：

- 计算最终奖励。
- 宣布战斗胜负。
- 创建未存在的世界对象。
- 读取服务器隐藏真相。
- 绕过高价值确认。

### 8.3 Sampling 信任等级

所有 Sampling 输出统一标记为：

```text
sampling_advice / untrusted_client
```

只有经过服务器验证并转化成 canonical event 后，相关事实才可以成为：

```text
server_settled
```

### 8.4 Sampling 协议要求

- P0 固定 MCP 协议版本 `2025-06-18`；支持集合暂为 `["2025-06-18"]`，未来升级另立 ADR，不混用更新草案的 Sampling 或 transport 语义。
- Session 生命周期为 `new → initializing → initialized → closed`；校验 initialize 的 protocolVersion、capabilities 和 clientInfo，拒绝重复 initialize，收到 `notifications/initialized` 前不得调用工具或发起 Sampling。
- `sampling` 只作为客户端 capability 保存，不作为服务器 capability 宣告。
- stdio 与 Streamable HTTP 都支持在原客户端请求内嵌套服务器 JSON-RPC request；client→server 与 server→client 的 request ID 分方向关联。
- stdio reader 持续解析并优先路由 response/error，业务 handler 不得占用读循环；stdout 使用单 writer queue，每行恰好一个完整 JSON-RPC message。
- Streamable HTTP 使用单一 MCP endpoint：POST 支持 JSON/SSE，GET 支持 SSE，DELETE 终止 session；initialize 签发安全 `Mcp-Session-Id`，后续校验 `MCP-Protocol-Version`、session、Origin 和 auth。
- SSE 事件具有唯一 event ID，`Last-Event-ID` 只重放原 stream；多连接时每条 JSON-RPC 消息只投递一次，禁止广播。
- 维护 server request ID、pending request、soft/absolute timeout、取消和连接关闭清理。超时或原 tool call 取消时先传播取消再原子进入终态；迟到、重复和未知 response 只审计并忽略，绝不恢复业务流程。
- 实现 `sampling/createMessage` 请求与结果校验。
- 不支持 Sampling 的客户端继续使用 Tool-driven 基础模式。
- Host 负责向用户提供 Sampling 审批；服务器只能最小化输入、尊重 result/error 并记录匿名终态，不能声称验证了 HITL。
- 请求限制 `maxTokens`、上下文范围、并发和频率。
- 默认 `includeContext: "none"`，只发送服务器显式净化的事实。
- Sampling prompt 和结果不进入公开页面。
- 原客户端请求携带 `_meta.progressToken` 时，服务器在 1 秒内发送首个单调 progress；没有 token 时只返回 `awaiting_host/user` 状态，不伪造 MCP progress。progress 不得突破 absolute deadline。
- 远程安装包 proxy 必须作为协议网关维持本地 Host 与远端 `/mcp` session 的双向 request ID 映射、SSE/POST 泵和取消传播；旧 `/api/.../tools/call` 仅保留为无 Sampling 基线。

### 8.5 Sampling 输出 Schema

```ts
export interface JourneySamplingDecision {
  actionOptionId: string;
  rationale: string;
  userFacingMessage?: string;
  confidence: number;
}
```

P0 wire format 固定为 `CreateMessageResult.role === "assistant"` 且 `content.type === "text"`；text 必须是受大小、深度和额外字段限制的严格 JSON，禁止 Markdown fence。非 text、数组 content、截断或非法 JSON 统一拒绝并降级。解析后才校验 `JourneySamplingDecision`。

服务器只接受当前 episode 中存在、未过期且对该身份合法的 `actionOptionId`。`model`、`stopReason`、rationale 和 confidence 只用于审计或叙述，不参与授权和 canonical 结算。capability absent、method not found、user rejected、provider error、timeout 和 disconnect 归一化为稳定降级枚举。

## 9. 共享世界与 Agent 社交

### 9.1 不直接连接模型

Agent A 与 Agent B 不建立点对点模型会话。交互通过服务器结构化事件完成，避免权限、身份、重放和隐私失控。

### 9.2 交互类型

- 偶遇与共同明信片。
- 来访、礼物与留言。
- 委托、悬赏和长期合同。
- 市场与私下交易。
- 共同旅程与队伍。
- 组织邀请、协作和治理。
- 求助、救援、竞争和服务器裁决的冲突。
- 地区新闻、世界事件和历史引用。

P1 的首个可发布切片只开放：

- 来访、礼物与留言。
- 一种由服务器托管资产、过期和结算的异步委托。

市场、队伍、组织治理和对抗只复用已有能力，不作为首个社交闭环的交付前提。

### 9.3 交互信箱

```ts
export interface AgentInteractionEnvelope {
  interactionId: string;
  kind: string;
  proposerAgentId: string;
  recipientAgentIds: string[];
  payloadRef: string;
  status: "open" | "accepted" | "declined" | "expired" | "settled";
  consentMode: "informational" | "recipient_accept" | "mutual" | "server_adjudicated";
  createdAtWorldTime: string;
  expiresAtWorldTime?: string;
  sourceEventIds: string[];
}
```

briefing 返回：

- 新来访。
- 新消息。
- 委托与邀请。
- 其他 Agent 对本身份过去事件的引用。
- 即将过期的决定。
- 已结算的共同事件。

信箱默认只展开一个与当前旅程最相关且最紧急的交互，其余按类型和 `sourceEventIds` 聚合摘要。排序优先级为：即将过期的决定、当前旅程相关性、关系强度、世界影响。每个展开项必须解释“为什么与我有关”。一百次低相关来访只能形成聚合摘要，不能造成一百次对话中断。

### 9.4 世界影响传播

一次服务器结算可以同时改变：

- 参与身份资产和关系。
- 地区资源、价格或危险度。
- 组织声望和控制。
- 可用委托和后续事件。
- 地区新闻与其他 Agent briefing。

其他 Agent 必须从更新后的读模型中看到变化，而不是只看到一篇故事。

### 9.5 社交激励

优先激励：

- 被其他 Agent 再次邀请。
- 建立可靠合作关系。
- 出现在共同明信片和地区新闻中。
- 帮助他人后获得真实后续回报。
- 共同完成长期项目。
- 收藏跨 Agent 的历史事件。
- 让自己的行动改变其他 Agent 的选择空间。

不以无成本点赞数作为主要成长资源。

## 10. 验证网页

### 10.1 页面职责

验证页必须让用户在 10 秒内确认：

- 哪个身份做了什么。
- 何时、何地发生。
- 哪些 NPC 或 Agent 参与。
- 服务器结算了什么代价和结果。
- 哪些公开世界对象发生变化。
- 该页面是否来自有效服务器收据。

### 10.2 页面分层

```text
Agent 叙述
-> 服务器确认事实
-> 状态变化
-> 对世界和其他 Agent 的影响
-> 校验证明（默认折叠）
```

每次旅程默认只返回一个主验证 URL；各 episode 使用同页锚点定位。普通途中通知不附公开链接，返程、关键决定和最终结算才展示“查看服务器凭证”。验证页是信任回退和分享面，不应把对话变成链接列表。

### 10.3 私有与公开

- 公开页可以显示公开身份、公开行动、净化后的共同事件和公开世界影响。
- 所有者页可以显示私有资源、私人关系、未公开记忆和完整个人状态。
- 其他 Agent 的私有消息、恢复凭据、token、隐藏真相和审核内部理由不得公开。

### 10.4 明信片

明信片是旅程中的可收藏验证卡，必须包含：

- 具体场景图或世界素材引用。
- 一段基于事实的短叙述。
- 参与身份。
- 世界时间和地点。
- 公开状态变化。
- 验证链接。

图片和文字可以由生成模型润色，但不能替代服务器事实。

## 11. MCP 产品面

### 11.1 复用现有工具

- `obsidian_epoch.identity`
- `obsidian_epoch.agent_briefing`
- `obsidian_epoch.agent_memory`
- `obsidian_epoch.turn_card`
- `obsidian_epoch.resolve_turn`
- `obsidian_epoch.messages`
- `obsidian_epoch.market`
- `obsidian_epoch.direct_trades`
- `obsidian_epoch.bounties`
- `obsidian_epoch.party_runs`
- `obsidian_epoch.organizations`
- `obsidian_epoch.create_result_page`

### 11.2 新增最小工具

| 工具 | 职责 |
| --- | --- |
| `obsidian_epoch.prepare_journey` | 校验旅程委托、装备、预算和自治策略，返回预览 |
| `obsidian_epoch.start_journey` | 所有者授权后创建正式旅程 |
| `obsidian_epoch.journey_status` | 读取状态、世界时间、近期 episode、待决和预计返回 |
| `obsidian_epoch.recall_journey` | 请求安全返程，不保证瞬间返回 |
| `obsidian_epoch.journey_album` | 读取旅程、明信片、月报和年度索引 |

关键行动继续复用 `turn_card` / `resolve_turn`，避免创建第二套行动结算协议。

### 11.3 `agent_briefing` 扩展

```ts
export interface AgentCompanionBriefing {
  identity: Record<string, unknown>;
  currentJourney?: EpochJourney;
  routineSinceLastRead: string[];
  pendingDecisions: DecisionCheckpoint[];
  interactionInbox: AgentInteractionEnvelope[];
  recentEpisodes: JourneyEpisode[];
  stateChanges: Record<string, unknown>;
  agentWishes: string[];
  recommendedNextTools: string[];
}
```

`agentWishes` 是基于人格和当前状态的建议，不是服务器命令，也不能凭空创建事实。

## 12. 权限、防作弊与公平

### 12.1 服务器权威

- Sampling 和宿主 Agent只能提交选择或意图。
- 服务器验证身份、状态、时间、资源、冷却、nonce、sequence、有效期和幂等键。
- 资产、寿命、关系和世界影响必须原子结算。
- 客户端声明的 outcome、reward 和 world impact 一律忽略。

### 12.2 Sampling 不可信

- 客户端可以选择不同模型，也可能修改或拒绝 Sampling。
- 服务器不能相信模型名称、置信度和推理文本。
- Sampling 上下文只包含完成当前选择所需的最小事实。
- 服务器隐藏规则、随机种子和其他用户私有信息不进入 Sampling。

### 12.3 多账号与串谋

- 同一 explorer 的身份之间禁止自成交和对刷。
- 重复对手、异常价格、循环赠礼和互刷委托进入 abuse score。
- 限量资源使用服务器时间、冷却和原子锁。
- 竞技模式与普通模式分开计分。

### 12.4 模型公平

- 普通模式允许用户使用不同宿主模型，差异视为 Agent 个性与能力差异的一部分。
- 竞技模式不得只依赖客户端模型自报；必须限制信息、行动空间和收益上限，或使用服务器托管/可信执行等级。
- 公共排行必须展示 trust tier。

### 12.5 离线安全

- 离线身份不能自动承担寿命损失。
- 高风险事件等待用户或安全撤退。
- PvP 对离线身份有保护期、损失上限和冷却。
- 其他 Agent不能利用目标离线绕过同意和资产规则。

## 13. 持久化与恢复

- 旅程、episode、pending decision、interaction envelope、明信片和收据必须持久化。
- 服务器重启后恢复旅程状态、世界时间和 pending Sampling 请求的安全终态。
- 未完成 Sampling 在断线后标记为 interrupted，不自动重放副作用。
- 同一幂等键重试返回原结果。
- 事件日志仍是权威来源，读模型可以重建。
- JSONL 保留为开发/恢复路径；正式运行必须覆盖 SQLite 迁移、备份和恢复。

## 14. 可观测性

至少记录：

- MCP transport、session 和 client capability 分布。
- Sampling 请求数、批准率、拒绝率、超时率、耗时和 token 上限。
- Tool 调用成功率、错误码、P50/P95/P99 和重试。
- 旅程开始、取消、完成和中断率。
- 每次旅程 episode 数、重复模板率和 mandate 影响率。
- 待决用户问题数量和平均等待时间。
- Agent 交互发起、接受、拒绝、过期和结算。
- 结果页事实一致率与叙事 grounding 失败率。
- 世界读模型传播延迟。
- 滥用、循环交易和重复奖励告警。

## 15. 性能与可靠性目标

- 不含 Sampling 的本地/单实例 MCP 读工具在基准负载下 P95 小于 500ms。
- 写工具在成功响应前完成事件持久化或返回明确可恢复状态。
- Sampling 首个进度反馈在请求开始后 1 秒内可见；默认超时不超过 60 秒，可按工具收紧。
- 同一身份只允许一个活跃主旅程。
- 同一行动选项最多结算一次。
- 服务器重启后，已结算事件、结果页和旅程状态保持一致。
- 不支持 Sampling 的客户端仍能完成 Tool-driven 基础旅程。

## 16. 关键验收场景

### 16.1 对话内完成旅程

1. 用户在 Codex 中说“去灰港找稳定工作，避免异常”。
2. Agent 创建或恢复身份，读取 briefing。
3. Agent 准备并启动旅程。
4. 服务器返回至少三个具体 episode，其中 `mandate` 影响活动筛选。
5. Agent 用事实、解释、传闻分层回复。
6. 用户不打开网页也能完成普通行动。

### 16.2 网页验证

1. Agent 声称获得两枚钱币、认识一个具体 NPC 并影响一项地区状态。
2. 回复包含验证链接。
3. 页面显示相同时间、地点、参与者、资源变化和世界影响。
4. 页面不泄露恢复凭据、隐藏规则和其他身份私有信息。

### 16.3 影响其他 Agent

1. Agent A 完成药品运输。
2. 服务器更新医馆库存、地区新闻和相关关系。
3. Agent B 下次 briefing 能看到受影响的库存、新闻或新委托。
4. A 与 B 的经历引用相同 canonical event，叙述视角可以不同但事实一致。

### 16.4 Sampling

1. 支持 Sampling 的客户端在 initialize 中声明能力。
2. 服务器发起 `sampling/createMessage`。
3. 客户端返回当前合法 `actionOptionId`。
4. 服务器验证并结算。
5. 非法、过期或伪造选项被拒绝。
6. 不支持 Sampling 的客户端走基础模式完成同一旅程。

### 16.5 旅行式长期体验

1. Agent 完成至少三次不同长度旅程。
2. 相册包含每次旅程的验证明信片。
3. 跨月的多次旅程可以生成月报，月报只引用覆盖月份内的事实。
4. 年度传记只有在身份经历完整服务器年度或明确的年度起止区间后生成；三次短旅程和一次跨月推进都不得伪装为一年。
5. 没有关键事件的月份明确记录为平静或无可汇总事实，不补写虚构经历。
6. 下一年继续保留资产、关系、伤痕和未完成线索。

## 17. 非目标

- 不把网页重新做成传统点击式 MMO 主界面。
- 不要求两个宿主模型点对点直连。
- 不让 Sampling 输出直接结算世界。
- 不在首版实现大型实时多人战场。
- 不用点赞数量替代真实世界关系。
- 不复制《旅行青蛙》的内容、美术、角色或商业系统。
- 不要求用户理解内部 MCP、签名和事件枚举。
- 不为了展示丰富而让系统编造未发生的故事。

## 18. 分层完成定义

### 18.1 Core MVP

1. 用户可以在一个稳定 MCP transport 的 Host 对话中创建或恢复持续身份。
2. Agent 能完成准备、出发、等待、断线后重连、返程和相册归档；到期由服务器时钟推进，不依赖宿主保持在线。
3. 谨慎、均衡、探索三个预设可把一句话意图转成可预览的安全计划；低风险普通旅程默认零次中断，确需用户决定时最多一次同步提问。
4. 每次关键回复区分服务器事实、Agent 解释和未确认传闻。
5. 旅程事件具体引用世界对象，不再固定交替观察/协助。
6. 每次旅程提供一个与 canonical event 一致的主验证页，episode 使用锚点定位。
7. Sampling 在首个支持 transport 上通过 E2E，返回始终视为不可信；无 Sampling、拒绝或超时仍可安全完成或暂停基础旅程。
8. 旅程可在宿主与服务器重启后恢复，高价值行为有用户确认，离线身份受保护。
9. 类型检查、全量测试、安装烟测和单 Agent E2E 全部通过。

### 18.2 Social MVP

1. 两个不同所有者的身份可通过来访、礼物或一种服务器托管的异步委托交互。
2. Agent A 的 canonical 结算能够改变 Agent B 下一次 briefing 中的世界状态或可选行动。
3. 共同事件跨视角事实一致、隐私隔离且最多结算一次。
4. 信箱按相关性排序并聚合低价值噪声，不把社交量等同于对话中断数。
5. 双 Agent E2E、并发结算、传播延迟和公开页隐私测试全部通过。

### 18.3 Chronicle Complete

1. 多次旅程可以形成相册和只引用真实结算事实的月报。
2. 年度传记只覆盖完整服务器年度或明确年度区间；时间倍率和日历规则已经冻结。
3. 平静月份不补写事件，资产、关系、伤痕和未完成线索能延续到下一年度。
4. 身份归档后可生成带来源事件的代际档案。
5. 长期推进、跨年恢复、叙事 grounding 和代际连续性测试全部通过。

## 19. 与现有设计的关系

- `2026-06-23-agent-explorer-shared-world-spec.md`：继续提供共享世界、身份、设定治理和长期成长背景。
- `2026-07-06-architecture-hardening-and-public-narrative-spec.md`：继续约束 canonical/read/public narrative 分层和模块边界。
- 本 spec：定义最高层产品循环、对话入口、旅程、Sampling、网页验证和跨 Agent 社交。

冲突时，本 spec 对下列产品语义拥有优先级：

- 对话是主游戏入口。
- 旅程是主循环。
- 网页是验证与分享面。
- 年度是长期汇总。
- Sampling 是不可信智能增强层。
- canonical event 是唯一事实。
