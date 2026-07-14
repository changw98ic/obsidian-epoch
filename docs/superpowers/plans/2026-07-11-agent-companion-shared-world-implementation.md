# 黑曜纪元对话 Agent 宠物式共享世界实施 Plan

> 对应 Spec：`docs/superpowers/specs/2026-07-11-agent-companion-shared-world-spec.md`

## 1. 目标

把现有“服务端权威世界 + MCP Tools”升级为可在 Codex、ChatGPT 等宿主 Agent 对话中真实游玩的数字生命游戏：用户准备并指挥 Agent 旅程，Agent 带回具体且可验证的经历，canonical event 改变共享世界并影响其他 Agent。

本计划只描述实施顺序、文件边界、测试和完成门槛，不在规划阶段修改生产代码。

## 2. Requirements Summary

### 2.1 必须实现

- 对话是普通用户的主游戏入口。
- 旅程拥有准备、出发、途中事件、待决、返回和结算状态。
- `mandate` 实际影响事件筛选，不再固定交替 `observe` / `assist`。
- 每个关键回复区分 confirmed fact、Agent interpretation 和 rumor。
- 关键事件生成可验证结果页，事实与 Agent 回复一致。
- 支持 Tool-driven 基础模式。
- 支持 MCP Sampling 的能力协商与服务器主动 `sampling/createMessage`。
- Sampling 输出不可信，只能选择服务器签发的合法行动。
- Agent 间交互通过服务器信箱和 canonical event 完成。
- Agent A 的行动能够改变 Agent B 后续 briefing 读取的世界状态。
- 多次旅程形成相册、月报、年度和代际档案。
- 旅程、待决、交互和结果页在重启后恢复。

### 2.2 明确不做

- 不把网页改造成主点击式游戏。
- 不建立宿主模型之间的点对点通信。
- 不让 Sampling 结算奖励、胜负或世界影响。
- 不在 P0 实现大型实时 PvP。
- 不复制《旅行青蛙》的受保护内容。
- 不新增依赖；如确需官方 MCP SDK，必须单独审批依赖变更。

## 3. 现状基线与代码证据

| 现状 | 代码证据 | 实施含义 |
| --- | --- | --- |
| MCP JSON-RPC 仅支持 initialize/tools | `tools/agent-server/lib/mcpJsonRpc.ts:53-79` | 必须引入双向 session/request 层 |
| MCP runtime 只声明 tools capability | `tools/agent-server/lib/mcpTools.ts:183-195`, `:4287-4293` | 客户端 Sampling capability 尚未保存 |
| stdio 只读取请求并写响应 | `tools/agent-server/mcp.ts:14-32` | 必须处理客户端对 server request 的响应 |
| package proxy 同样只处理 tools | `tools/agent-server/package/obsidian-epoch/bin/mcp-proxy.ts:110-139` | 发布包必须同步升级 |
| 完整探索固定观察/协助 | `tools/agent-server/lib/epoch/explorationRuntime.ts:57-114` | 以 journey runtime 取代产品主路径 |
| 现有回合卡由服务器签发选项 | `tools/agent-server/lib/mcpTools.ts:3387-3414` | 继续复用，不创建第二套结算协议 |
| briefing 已有统一读入口 | `tools/agent-server/lib/epoch/publicWorldReadModel.ts:157-184`, `:293-333` | 扩展为 companion/journey/inbox 恢复入口 |
| 结果页已有 payload 与 receipt 分层 | `tools/agent-server/lib/epoch/resultPagePayloadRules.ts:21-79`, `resultPageReceiptRules.ts:211-235` | 扩展 journey/episode/world-effect 事实 |
| 关系与社交副作用已有规则 | `tools/agent-server/lib/epoch/agentInteractionRules.ts:239-418`, `:486-631` | 复用 canonical 关系和 social hook |
| server-hosted job 与 maintenance 已存在 | `tools/agent-server/lib/epoch/serverHostedRuntime.ts:82-204`, `maintenanceRuntime.ts:202-588` | 用于离线低风险推进，不承载开放式 LLM |
| 高价值确认与幂等已存在 | `tools/agent-server/lib/epoch/highValueConfirmationRuntime.ts:430-468`, `runtimeIdempotencyRuntime.ts:26-147` | Journey 写路径必须复用 |
| 标准验证脚本已存在 | `tools/graph-react-app/package.json:8-56` | 新测试进入现有门禁 |

## 4. Architecture Decision Record

### Decision

采用混合模式：

```text
Tool-driven baseline
+ Sampling-enhanced connected journey
+ deterministic server Policy Worker for offline safe progress
+ server-authoritative canonical settlement
```

### Drivers

1. 用户必须能在不同 MCP Host 中直接游玩。
2. Sampling 支持度和在线状态不能决定基础功能是否可用。
3. 所有共享世界变化必须可验证、防作弊并可恢复。

### Alternatives considered

#### A. 完全依赖 Sampling

- 优点：服务器可以主动请求模型，体验更像持续数字生命。
- 缺点：不支持 Sampling 的客户端无法玩；用户拒绝或离线会阻塞；客户端模型和返回不可信。
- 结论：不作为唯一主路径。

#### B. 只使用 Tools，由宿主主动轮询

- 优点：实现简单、兼容性强、权限边界清楚。
- 缺点：复杂旅程需要宿主反复编排，途中消息和递归判断体验较弱。
- 结论：保留为兼容基线，但不足以覆盖完整产品体验。

#### C. 混合模式

- 优点：基础可用、增强自然、离线安全、防作弊边界明确。
- 缺点：需要同时维护双向协议和降级路径。
- 结论：采用。

### Consequences

- Sampling 相关代码必须与游戏规则解耦。
- 所有旅程场景必须先有服务器事实和 action option，再请求模型。
- E2E 必须覆盖有 Sampling、无 Sampling、拒绝、超时和断线。
- 旅程不能依赖单个客户端会话持续存在。

### Follow-ups

- P0 完成后再评估是否引入官方 MCP SDK。
- 竞技模式需要单独的模型公平与可信执行 ADR。
- P0 冻结最小时间合同：服务器同时记录世界到期时间与现实到期时间，并负责 tick、幂等 catch-up 和重连交付；长期世界倍率仍可在可玩性测试后微调。
- P2 开始实现年度传记前，必须先冻结服务器日历、年度起止和长期时间倍率。

## 5. Acceptance Criteria

### 5.1 P0 可玩闭环

- [ ] MCP `2025-06-18` 的 initialize/initialized 生命周期、客户端 Sampling capability 方向和 HTTP protocol-version/session 校验符合协议。
- [ ] Codex 中一句自然语言指令可以创建/恢复身份、准备并启动旅程。
- [ ] 谨慎、均衡、探索三个版本化预设可生成可读预览；资源和高价值约束不冲突时，不追问也能按安全默认值出发。
- [ ] 一个普通旅程产生 3–7 个具体 episode，至少涉及一个具体地点及一个 NPC、Agent、组织、物品或委托。
- [ ] Journey 同时记录 `dueAtWorldTime`、`dueAtRealTime` 和 `nextPollAt`；宿主断线后服务器继续安全推进，到期后的第一次重连 briefing 必须交付返程或待决状态。
- [ ] 低风险普通旅程默认零次用户中断；必须由用户决定时，普通旅程最多发起一次同步游戏问题，其余待决聚合到 briefing。
- [ ] 改变 `mandate` 后，固定种子测试中的事件候选或排序发生可解释变化。
- [ ] 连续三个 episode 不允许拥有相同地点、参与者、选项和结果四元组。
- [ ] Agent 回复 DTO 同时包含 confirmed facts、interpretation、rumors、state changes 和一个 journey 主 verification URL；episode 使用同页锚点。
- [ ] 验证页的时间、地点、参与者、资源变化和世界影响与 canonical event 一致。
- [ ] Sampling capable client 在一次进行中的 client request 内完成嵌套 `sampling/createMessage`。
- [ ] Sampling 不可用、被拒绝或超时时，基础旅程仍能完成或安全暂停。
- [ ] Sampling 返回未签发或过期 `actionOptionId` 时，服务器拒绝且不产生状态变化。

### 5.2 P1 共享社交

- [ ] 两个不同 explorer 的身份可通过各自 Agent 完成来访/礼物，以及一种服务器托管的异步委托。
- [ ] 同一 interaction 只结算一次，并进入双方 briefing。
- [ ] Agent A 的结算在一次读模型刷新内影响 Agent B 可见的新闻、库存、委托、关系或地区状态。
- [ ] 双方叙事可以不同，但共享事件的时间、参与者、行动和结果完全一致。
- [ ] 其他身份无法读取私人消息、恢复凭据、私下交易详情和未公开记忆。
- [ ] briefing 默认最多展开一个最相关交互；同一来源事件和低相关来访按类型聚合，批量噪声不产生批量中断。

### 5.3 P2 长期体验

- [ ] 三次旅程可形成验证相册。
- [ ] 跨月旅程可形成只引用已结算事实的月报。
- [ ] 年度传记只覆盖完整服务器年度或明确年度起止区间，不把三次旅程或一次跨月推进标记为一年。
- [ ] 没有关键事件的月份如实显示为平静或无可汇总事实，不生成填充故事。
- [ ] 年度结束后资产、关系、伤痕和未完成线索进入下一年度。
- [ ] 身份归档后可生成代际历史，且不会复活已终止旅程。

### 5.4 非功能

- [ ] 非 Sampling MCP 读工具在基准负载下 P95 < 500ms。
- [ ] 原 client request 携带 progress token 时，Sampling 在 1 秒内产生首个单调进度；无 token 时返回可读取的等待状态。
- [ ] Sampling 默认超时 <= 60 秒，断线后 pending request 全部清理或标记 interrupted。
- [ ] 观测 `interruptionsPerJourney` 的 P50/P95、每次 briefing 展开项数量和建议轮询频率；默认旅程满足零中断/最多一次同步问题预算。
- [ ] 同一行动最多结算一次；同幂等键不同 payload 返回 conflict。
- [ ] 服务重启后旅程、interaction、结果页和 canonical projection 一致。
- [ ] `npm run typecheck`、`npm test`、安装烟测、双 Agent E2E 全部通过。

## 6. Implementation Steps

## Task 0：锁定当前行为与失败基线

**目的：** 在改协议和主循环前证明当前行为，防止后续通过修改假测试掩盖缺口。

**新增测试：**

- `tools/agent-server/test/mcpSamplingTransport.test.ts`
- `tools/agent-server/test/journeyCharacterization.test.ts`
- `tools/agent-server/test/agentCompanionE2E.test.ts`

**修改：**

- `tools/agent-server/test/mcp.test.ts:11292-11328`
- `tools/agent-server/test/install-smoke-command.test.ts`

**步骤：**

- [ ] 增加断言：initialize 当前只暴露 tools，客户端 sampling capability 当前未保存。
- [ ] 增加断言：server-originated JSON-RPC request 当前不可用。
- [ ] 记录 Codex/ChatGPT 实际 Host 版本、transport、声明的 Sampling capability、审批行为和 nested Sampling 支持；未知项不得用 fake capability 替代。
- [ ] 增加固定种子探索测试，记录 `observe/assist` 交替和 mandate 不参与内容生成的失败基线。
- [ ] 增加验证页事实一致性基线，确保后续扩展不破坏现有 receipt。
- [ ] 不修改 fake/mocks 让新行为“假通过”；Sampling E2E 使用真实双向 JSON-RPC test harness。

**完成证据：** 新测试在实现前按预期失败，既有测试保持通过。

## Task 1：建立双向 MCP Session 与请求管理器

**目的：** 允许服务器在已初始化连接上发出 JSON-RPC request，并接收 client result/error。

**新增：**

- `tools/agent-server/lib/mcpSession.ts`
- `tools/agent-server/lib/mcpServerRequestManager.ts`
- `tools/agent-server/test/mcpSession.test.ts`

**修改：**

- `tools/agent-server/lib/mcpJsonRpc.ts:3-9`, `:53-79`
- `tools/agent-server/mcp.ts:14-32`
- `tools/agent-server/lib/http/mcpRoutes.ts:39-171`
- `tools/agent-server/lib/httpServer.ts` 的 MCP session lifecycle 接线
- `tools/agent-server/package/obsidian-epoch/bin/mcp-proxy.ts:110-139`

**步骤：**

- [ ] P0 支持集合固定为 MCP `2025-06-18`；升级版本另立 ADR，不混入新草案的 Sampling/transport 语义。
- [ ] 定义 `McpSession`：sessionId、protocolVersion、clientInfo、clientCapabilities、transport、send、pendingRequests、state、closedAt；状态为 `new → initializing → initialized → closed`。
- [ ] 校验 initialize 的 protocolVersion/capabilities/clientInfo，拒绝重复 initialize；收到 `notifications/initialized` 前禁止工具调用和 Sampling。
- [ ] Sampling 只保存为 client capability，不在 server capabilities 中宣告。
- [ ] 请求管理器按方向生成安全 request ID，关联 resolve/reject、soft/absolute timeout、AbortSignal 和 terminal state；不能假设双向 ID 全局唯一。
- [ ] stdio reader 持续解析，不等待业务 handler；response/error 优先进入 pending map，client request/notification 再异步派发。
- [ ] stdout 使用单 writer queue，每行恰好一个完整 JSON-RPC message。
- [ ] Streamable HTTP 使用单一 MCP endpoint：POST 支持 JSON/SSE，notification/response POST 返回 202；GET 建立 SSE；DELETE 终止 session。
- [ ] initialize 签发加密安全 `Mcp-Session-Id`；后续缺失 session 返回 400、过期返回 404，并校验协商后的 `MCP-Protocol-Version`。
- [ ] SSE 分配唯一 event ID，`Last-Event-ID` 只重放原 stream；多 SSE 连接中每条消息只投递一次，禁止广播。
- [ ] GET/POST/DELETE 全部执行 Origin、auth、owner 和 session 绑定检查。
- [ ] package proxy 明确作为协议网关：本地是 MCP server、远端是 MCP client，维持远端 `/mcp` POST/SSE session 与双向 request ID 映射。
- [ ] proxy 只在下游 Host 声明 Sampling 时向远端传播能力；result/error/cancel 双向回传，任一侧断线清理两侧 pending。
- [ ] 旧 `/api/.../tools/call` 仅保留无 Sampling 基线，不作为双向 Sampling 路径。
- [ ] 连接关闭时拒绝全部 pending request，不重放任何副作用。
- [ ] 未初始化 session 调用 Sampling 返回 `mcp_session_not_initialized`。

**测试：**

- [ ] stdio 双向请求/响应。
- [ ] HTTP JSON/SSE、GET/POST/DELETE、session/version/Origin/auth 和 `Last-Event-ID` 重连。
- [ ] response ID 错配、重复/未知/迟到 response、timeout-vs-response、cancel-vs-response 和断线。
- [ ] 两个并发 tool call、两个嵌套 Sampling、乱序 response、双向同数值 ID 和两个客户端 session 不串线。
- [ ] 真实 proxy 子进程 + 真实远端 HTTP server + 本地 Host 三段式 E2E。

**完成证据：** transport 测试可由服务器发出一个通用 ping request 并收到正确客户端响应。

## Task 2：实现 MCP Sampling 能力

**目的：** 在支持 Sampling 的连接上完成受控 `sampling/createMessage`。

**新增：**

- `tools/agent-server/lib/mcpSampling.ts`
- `tools/agent-server/lib/mcpSamplingSchemas.ts`
- `tools/agent-server/test/mcpSampling.test.ts`

**修改：**

- `tools/agent-server/lib/mcpTools.ts:183-195`, `:4111-4342`
- `tools/agent-server/lib/mcpJsonRpc.ts`
- `tools/agent-server/package/obsidian-epoch/bin/mcp-proxy.ts`
- `tools/agent-server/install-smoke.ts:715-772`
- `tools/agent-server/test/packageArchive.test.ts:1568-1585`

**步骤：**

- [ ] 读取 `clientCapabilities.sampling`，无能力时返回结构化 unsupported 结果，不伪装成功。
- [ ] Sampling 只能嵌套在仍在处理的 client request 中；离线 tick 只持久化待领取事实，下一次 briefing/tool call 才 Sampling 或安全降级。
- [ ] 实现 createMessage request schema：messages、modelPreferences、systemPrompt、includeContext、temperature、maxTokens、stopSequences、metadata。
- [ ] 默认 `includeContext: "none"`，禁止自动附加其他 MCP server 上下文。
- [ ] 限制 maxTokens、message 数量、单消息字符数、并发数和每身份频率。
- [ ] P0 wire schema 要求 `role=assistant`、单个 `content.type=text`，text 为限制大小/深度/额外字段且无 Markdown fence 的严格 JSON；再解析 `JourneySamplingDecision`。
- [ ] model/stopReason/rationale/confidence 只作审计或叙述；非 text、数组 content、截断/非法 JSON 一律拒绝并降级。
- [ ] 记录批准/拒绝/超时/错误，不记录敏感 prompt 到公开日志。
- [ ] Sampling 返回统一标记 `sampling_advice` / `untrusted_client`。
- [ ] capability absent、method not found、user rejected、provider error、timeout、disconnect 归一化为稳定降级枚举。
- [ ] timeout 或原 tool call 取消时发送取消并原子终止 pending；迟到/重复/未知 response 只审计并忽略。
- [ ] 只有原 client request 提供 `_meta.progressToken` 时才在 1 秒内发首个单调 progress；区分原请求与 nested Sampling token，progress 不延长 absolute deadline。
- [ ] 用户审批由 Host 提供；服务端不声称验证 HITL，只最小化输入并尊重 result/error。

**测试：**

- [ ] capable client success。
- [ ] capability absent。
- [ ] user rejected。
- [ ] timeout/cancel/disconnect。
- [ ] timeout-vs-response、cancel-vs-response、late/duplicate/unknown response。
- [ ] invalid result schema。
- [ ] maxTokens 与上下文限制。
- [ ] 有/无 progress token、重复/乱序 progress 和 absolute deadline。
- [ ] Sampling 结果不产生 canonical event。

**完成证据：** 安装烟测在支持 Sampling 的 test client 上完成一次 createMessage，并在不支持客户端上完成原有工具流程。

## Task 3：建立 Journey 领域模型和状态机

**目的：** 以旅程替代固定批量探索作为产品主循环，同时复用现有 turn/hosted action 结算。

**新增：**

- `tools/agent-server/lib/epoch/journeyRules.ts`
- `tools/agent-server/lib/epoch/journeyReadModel.ts`
- `tools/agent-server/lib/epoch/journeyRuntime.ts`
- `tools/agent-server/lib/epoch/journeyPolicyRules.ts`
- `tools/agent-server/test/journeyRules.test.ts`
- `tools/agent-server/test/journeyRuntime.test.ts`

**修改：**

- `tools/agent-server/lib/epoch/events.ts`：journey prepared/started/episode/decision/return/settled/cancelled events。
- `tools/agent-server/lib/epoch/protocol.ts`：事件和 ID kind 白名单。
- `tools/agent-server/lib/epoch/runtime.ts`：只接线新 runtime，不在大文件内实现规则。
- `tools/agent-server/lib/epoch/gameCore.ts`：保持兼容导出，新增逻辑进入 focused modules。
- `tools/agent-server/lib/epoch/explorationRuntime.ts:57-151`：保留兼容入口，内部改为 journey adapter 或标记 legacy。
- `tools/agent-server/lib/epoch/turnHostedActionRules.ts`：为 turn/session 增加可选 journeyId/episodeId 绑定。

**步骤：**

- [ ] 定义 Journey 状态机和合法转换。
- [ ] 定义 mandate、autonomy policy、预算累计和默认安全策略。
- [ ] 持久化 `dueAtWorldTime`、`dueAtRealTime`、`nextPollAt`，由服务器 tick 和幂等 catch-up 推进到期 Journey。
- [ ] 一个身份最多一个活跃主旅程。
- [ ] Journey prepare 只预览，不锁资源；start 原子锁定携带资源/物品。
- [ ] Episode 创建后签发现有 action option，不接受客户端 outcome。
- [ ] `awaiting_user` 不阻塞其他身份和安全日常。
- [ ] recall 触发安全返程流程，不瞬移、不回滚已发生事件。
- [ ] settlement 汇总 sourceEventIds、state delta、interactions 和 result page focus。
- [ ] Host 断线不取消 Journey；重连 briefing 先交付到期返程、待决或 catch-up 结果。

**测试：**

- [ ] 所有合法/非法状态转换。
- [ ] 预算、寿命风险和高价值确认。
- [ ] 同一身份并发 start。
- [ ] recall、死亡、归档和服务重启。
- [ ] 断线 → 到期 → 服务端 catch-up → 重连交付，重复重连不重复结算。
- [ ] exploration legacy adapter 不产生双重奖励。

**完成证据：** 确定性测试时钟下可完成 prepared → settled 全流程，且每一步都有 canonical event。

## Task 4：构建具体内容与防模板 Scene Composer

**目的：** 让 mandate、世界状态、身份历史和其他 Agent 事件生成具体 episode，而不是抽象动作模板。

**新增：**

- `tools/agent-server/lib/epoch/journeySceneRules.ts`
- `tools/agent-server/lib/epoch/journeySceneCatalog.ts`
- `tools/agent-server/lib/epoch/journeySceneReadModel.ts`
- `tools/agent-server/lib/epoch/journeyNarrativeRules.ts`
- `tools/agent-server/test/journeySceneRules.test.ts`
- `tools/agent-server/test/journeyNarrativeRules.test.ts`

**复用：**

- `tools/agent-server/lib/epoch/regionInfoReadModel.ts`
- `tools/agent-server/lib/epoch/agentMemoryReadModel.ts`
- `tools/agent-server/lib/epoch/regionCommissionReadModel.ts`
- `tools/agent-server/lib/epoch/encounterReadModel.ts`
- `tools/agent-server/lib/epoch/organizationReadModel.ts`
- `tools/agent-server/lib/epoch/relationshipReadModel.ts`

**步骤：**

- [ ] 把 scene candidate 拆为 livelihood、travel、relationship、commission、world event、discovery、health、conflict。
- [ ] 用 mandate priority/avoid、人格、地点、季节、资源和未完成线索打分。
- [ ] 每个候选必须引用真实 world object ID 和 source facts。
- [ ] 增加最近 episode 指纹，防止连续重复地点/参与者/选项/结果。
- [ ] 信息不足时生成可验证 routine segment，不制造 NPC 或事故。
- [ ] Sampling 只负责从合法候选中选择和生成 narrative draft。
- [ ] narrative validator 拒绝新增人物、奖励、伤亡、关系和秘密。
- [ ] validator 失败时降级到结构化事实模板。

**测试：**

- [ ] 相同种子、相同世界状态可重现候选和结算。
- [ ] 不同 mandate 至少改变候选排序或活动类型。
- [ ] 空世界状态不会编造具体人物。
- [ ] Sampling 幻觉不会进入 confirmed facts。
- [ ] 连续模板重复率门禁。

**完成证据：** 原 MCP 烟测调查指令能生成有具体对象、行动和后果的旅程，不再只返回观察/协助。

## Task 5：暴露 Agent-native MCP 旅程工具

**目的：** 让宿主 Agent 通过最小工具面完成准备、出发、恢复、召回和相册读取。

**修改：**

- `tools/agent-server/lib/mcpTools.ts:2289-2310`：扩展 briefing 描述/schema。
- `tools/agent-server/lib/mcpTools.ts:3387-3414`：turn 绑定 journey/episode。
- `tools/agent-server/lib/mcpTools.ts:3922-3945`：结果页聚焦 journey/episode。
- `tools/agent-server/lib/mcpTools.ts:3985-4314`：新增 handler 映射。
- `tools/agent-server/lib/epoch/publicWorldReadModel.ts:157-184`, `:293-333`：briefing journey/inbox slice。
- `tools/agent-server/lib/http/resultRoutes.ts`：只添加必要的兼容 HTTP 路由。

**新增工具：**

- [ ] `obsidian_epoch.prepare_journey`
- [ ] `obsidian_epoch.start_journey`
- [ ] `obsidian_epoch.journey_status`
- [ ] `obsidian_epoch.recall_journey`
- [ ] `obsidian_epoch.journey_album`

**步骤：**

- [ ] 为每个工具提供清晰 title、description、required schema 和 annotations。
- [ ] `prepare_journey` 接受谨慎/均衡/探索预设并返回人类可读预览、风险、预算、预计现实/世界返程时间。
- [ ] 一句话意图在无资源或高价值冲突时采用安全默认值；确有冲突只问一个合并问题。
- [ ] quickstart 返回完整对话式旅程 playbook。
- [ ] `agent_briefing` 返回 currentJourney、nextPollAt、routine、聚合后的 pendingDecisions/interactionInbox、recentEpisodes、agentWishes。
- [ ] agentWishes 明确为建议，不作为服务器事实。
- [ ] 工具错误返回稳定业务错误码，不把所有错误折叠为 internal_error。
- [ ] 所有写工具要求 owner auth 和 idempotency key。

**测试：**

- [ ] tools/list 包含新增工具且 schema 合法。
- [ ] quickstart 可以被 Codex 风格宿主按顺序执行。
- [ ] briefing 在断线重连后恢复全部待决。
- [ ] 到期 Journey 在首次重连 briefing 中返回 return/awaiting_user 状态，不要求 Host 在途中保持会话。
- [ ] 无网页操作完成普通旅程。

**完成证据：** `agent:install-smoke` 增加 journey smoke 并通过远程 package proxy。

## Task 6：持久化旅程、交互和双向会话终态

**目的：** 避免重启、断线和并发导致旅程丢失或重复结算。

**修改：**

- `tools/agent-server/lib/store.ts`
- `tools/agent-server/lib/sqliteStore.ts:49-401`
- `tools/agent-server/lib/epoch/runtimePublicProjectionRules.ts:18-47`
- `tools/agent-server/lib/epoch/runtimeIdempotencyRuntime.ts:26-147`
- `tools/agent-server/backup.ts`
- `tools/agent-server/restore-backup.ts`
- `tools/agent-server/migrate-sqlite.ts`

**步骤：**

- [ ] canonical journey events 进入现有 event persistence。
- [ ] journey read model 可由事件重建，不单独成为真相源。
- [ ] pending Sampling 不持久化模型请求正文；断线后落 interrupted audit state。
- [ ] interaction envelope 持久化 payloadRef 和状态，不复制敏感领域 payload。
- [ ] 相册和结果页持久化 sourceEventIds、share lifecycle 和 narrative version。
- [ ] backup/restore 包含新记录并保持旧备份兼容错误提示。
- [ ] SQLite migration 可重复运行且有 rollback/恢复说明。

**测试：**

- [ ] JSONL 和 SQLite 双后端。
- [ ] restart hydration。
- [ ] backup → restore → projection equality。
- [ ] crash between event append and response。
- [ ] repeated idempotency after restart。

**完成证据：** 容器生命周期与恢复 drill 覆盖进行中和已结算旅程。

## Task 7：扩展网页验证和旅程明信片

**目的：** 用户能验证 Agent 回复，并看到行动如何影响世界和其他 Agent。

**新增：**

- `tools/agent-server/lib/epoch/journeyVerificationReadModel.ts`
- `tools/agent-server/lib/epoch/journeyPostcardReadModel.ts`
- `tools/agent-server/test/journeyVerificationReadModel.test.ts`

**修改：**

- `tools/agent-server/lib/epoch/resultPagePayloadRules.ts:21-79`
- `tools/agent-server/lib/epoch/resultPageReceiptRules.ts:21-235`
- `tools/agent-server/lib/epoch/publicResultViewModel.ts`
- `tools/agent-server/lib/resultPageHtml.ts`
- `tools/agent-server/lib/http/resultRoutes.ts`
- `tools/agent-server/test/server.test.ts` 的结果页事实/隐私测试

**步骤：**

- [ ] 结果 ViewModel 增加 journey、episode、participants、stateDelta、worldEffects、interaction refs。
- [ ] Agent reply 和 verification page 使用同一 read model，不分别推断事实。
- [ ] 每个 Journey 只生成一个主验证 URL；episode 和明信片使用同页锚点，普通途中通知不创建公开链接。
- [ ] 明信片包含短叙述、地点、时间、参与者、公开变化和主验证 URL。
- [ ] public/private 两套投影复用现有 secret redaction。
- [ ] 技术 receipt 默认折叠，但保留签名、hash 和 canonical event link。
- [ ] narrative 与 canonical 不一致时页面优先事实并标记叙事版本失效。

**测试：**

- [ ] Agent reply DTO 与页面核心事实逐字段一致。
- [ ] 公开页无 recovery/token/private trade/private message 泄漏。
- [ ] 分享链接 revoke/delete/version/expiry 回归。
- [ ] 两个参与 Agent 的公开页只展示允许的共同事实。

**完成证据：** E2E 从 Agent 回复中的 URL 打开页面并验证相同结算。

## Task 8：建立统一 Agent 交互信箱和共享事件传播

**目的：** 把现有消息、委托、交易、队伍和组织对象组织成宿主 Agent 可消费的异步社交体验。

**新增：**

- `tools/agent-server/lib/epoch/agentInteractionInboxReadModel.ts`
- `tools/agent-server/lib/epoch/agentInteractionEnvelopeRules.ts`
- `tools/agent-server/test/agentInteractionInboxReadModel.test.ts`
- `tools/agent-server/test/twoAgentJourneyE2E.test.ts`

**复用/修改：**

- `tools/agent-server/lib/epoch/agentInteractionRules.ts:239-418`, `:486-631`
- `tools/agent-server/lib/epoch/marketTradeRules.ts`
- `tools/agent-server/lib/epoch/directTradeRules.ts`
- `tools/agent-server/lib/epoch/bountyRules.ts`
- `tools/agent-server/lib/epoch/combatSettlementRules.ts`
- `tools/agent-server/lib/epoch/organizationReadModel.ts`
- `tools/agent-server/lib/epoch/regionActivityReadModel.ts`
- `tools/agent-server/lib/epoch/publicWorldReadModel.ts:293-333`

**步骤：**

- [ ] 定义 envelope kind、consent mode、payloadRef、expiry 和 sourceEventIds。
- [ ] 首个社交切片只开放来访、礼物和一种 escrow 异步委托；市场、队伍、组织治理和冲突不作为门槛。
- [ ] 现有领域对象产生 envelope，不复制资产状态。
- [ ] briefing 按“到期风险 > 当前旅程相关性 > 关系 > 世界影响”排序，默认展开一个并说明相关原因。
- [ ] 相同 source event 和低相关同类交互聚合摘要，避免社交量直接转化为对话中断。
- [ ] 自动接受必须经过 journey autonomy policy 和金额/风险门槛。
- [ ] Agent A 结算后刷新受影响地区和 Agent B briefing。
- [ ] 同一 shared event 为各参与者生成不同视角、相同事实的 episode projection。
- [ ] 加入屏蔽、频率限制、同 owner 自交和循环奖励检测。

**测试：**

- [ ] 两 explorer 委托/履约。
- [ ] 双方并发接受只结算一次。
- [ ] 过期和拒绝。
- [ ] Agent B 读模型传播。
- [ ] 私有字段隔离。
- [ ] 同 owner 刷行为拒绝/记分。
- [ ] 一百次低相关来访只形成聚合摘要，展开项和同步中断不随数量线性增长。

**完成证据：** 双 Agent E2E 产生共同明信片，并在双方 briefing 中一致出现。

## Task 9：实现相册、月报、年度和代际汇总

**目的：** 把多次旅程转化为长期情感与收藏价值，不把年度做成一次批量任务。

**新增：**

- `tools/agent-server/lib/epoch/journeyAlbumReadModel.ts`
- `tools/agent-server/lib/epoch/lifeChronicleReadModel.ts`
- `tools/agent-server/lib/epoch/lifeChronicleNarrativeRules.ts`
- `tools/agent-server/test/journeyAlbumReadModel.test.ts`
- `tools/agent-server/test/lifeChronicleReadModel.test.ts`

**修改：**

- `tools/agent-server/lib/epoch/identityArchiveReadModel.ts`
- `tools/agent-server/lib/epoch/explorerProfileReadModel.ts`
- `tools/agent-server/lib/epoch/personalMigrationReadModel.ts`
- `tools/agent-server/lib/mcpTools.ts`：journey_album 读入口

**步骤：**

- [ ] 相册按旅程和世界时间索引明信片。
- [ ] 月报按 canonical event 汇总日常、关键事件、关系和状态。
- [ ] 实现年度前先冻结服务器日历、年度起止和长期时间倍率，并写入版本化 ADR。
- [ ] 年度只在完整服务器年度或明确年度区间满足后生成，不接受客户端“完成一年”声明。
- [ ] 平静月份只记录“无可汇总事实”，不得由 Sampling 补写事件。
- [ ] Sampling 可润色叙事，但每段保留 sourceEventIds。
- [ ] grounding 失败时返回结构化事实，不生成虚构长文。
- [ ] identity archive 引用旅程、年度和未完成线索。

**测试：**

- [ ] 三旅程相册。
- [ ] 月报/年度时间覆盖。
- [ ] 状态 delta 与 progress 一致。
- [ ] 传闻与私有内容权限。
- [ ] 归档/转生连续性。

**完成证据：** 三次旅程和跨月推进可生成相册/月报；测试时钟覆盖完整服务器年度后才可生成可验证年度摘要。

## Task 10：更新宿主安装包和 Agent 使用说明

**目的：** 让宿主 Agent 明确如何扮演宠物/代行者，而不是把技术工具列表直接抛给用户。

**修改：**

- `tools/agent-server/package/obsidian-epoch/SKILL.md`
- `tools/agent-server/package/.mcp.json`
- `tools/agent-server/package/install-manifest.json`
- `tools/agent-server/lib/hostInstall.ts`
- `tools/agent-server/lib/packageArchive.ts`
- `tools/agent-server/install-smoke.ts`
- `tools/agent-server/sync-install-manifests.ts`

**步骤：**

- [ ] Skill 定义“对话即游玩、事实/解释/传闻分层、网页验证”行为。
- [ ] 明确何时自动行动、何时请求用户、何时安全撤退。
- [ ] 支持 Sampling host 时启用增强模式；不支持时不显示虚假能力。
- [ ] quickstart 给出准备旅程、出发、恢复、处理待决、验证结果的最短路径。
- [ ] 安装状态页显示 transport、tool、Sampling capability 和降级模式。
- [ ] 包代理通过本地 Host → proxy 子进程 → 远端 Streamable HTTP server 的三段式双向 Sampling E2E。

**测试：**

- [ ] package archive 内容和 manifest 同步。
- [ ] stdio local package。
- [ ] remote package proxy。
- [ ] Sampling/no-Sampling host fixtures。
- [ ] README/Skill 示例与真实 schema 一致。

**完成证据：** 干净环境安装后，宿主 Agent 可按 Skill 完成一段旅程并给出验证链接。

## Task 11：补齐观测、安全和运营门禁

**目的：** 让 Sampling、旅程和 Agent 社交具备企业级故障定位与滥用治理。

**新增：**

- `tools/agent-server/lib/epoch/journeyMetricsReadModel.ts`
- `tools/agent-server/lib/mcpTransportMetrics.ts`
- `tools/agent-server/test/journeyMetricsReadModel.test.ts`

**修改：**

- `tools/agent-server/lib/epoch/operatorOverviewReadModel.ts`
- `tools/agent-server/lib/epoch/runtimeAbuseRuntime.ts`
- `tools/agent-server/lib/epoch/commandAbuseRules.ts`
- `tools/agent-server/lib/epoch/moderationRiskRules.ts`
- `tools/agent-server/lib/epoch/maintenanceRuntime.ts:202-588`

**步骤：**

- [ ] 记录 transport/session/Sampling/tool/journey/inbox/grounding 指标，以及 `interruptionsPerJourney` P50/P95、briefing 展开项数量和 poll 间隔。
- [ ] 每次 server request 带 correlation ID，贯穿 Sampling、action、canonical event 和 result page。
- [ ] operator overview 展示超时、失败、重复模板、待决积压和传播延迟。
- [ ] 添加 Sampling 并发/频率/token budget 熔断。
- [ ] 把循环交易、重复对手、异常邀请和自交纳入 abuse score。
- [ ] 建立错误预算和告警阈值，不只记录总量。

**测试：**

- [ ] 指标计数与状态转换一致。
- [ ] 故障注入：Sampling超时、工具失败、持久化失败、读模型滞后。
- [ ] 敏感内容不进入公开日志和 metrics label。

**完成证据：** 一次失败旅程可以通过 correlation ID 定位到 transport、Sampling、行动和持久化层。

## Task 12：全链路 QA 与发布门禁

**目的：** 证明目标体验，而不是只证明单个工具能调用。

**新增：**

- `tools/agent-server/test/agentCompanionJourneyE2E.test.ts`
- `tools/agent-server/test/twoAgentSharedWorldE2E.test.ts`
- `tools/agent-server/test/mcpSamplingConformance.test.ts`
- `tools/agent-server/scripts/agent-companion-smoke.ts`（若现有 install-smoke 不适合承载完整场景）

**场景矩阵：**

- [ ] stdio + Sampling。
- [ ] Streamable HTTP + Sampling。
- [ ] stdio 无 Sampling。
- [ ] HTTP 无 Sampling。
- [ ] Sampling 拒绝、超时、非法选项、断线。
- [ ] 用户途中介入与安全撤退。
- [ ] 服务重启和宿主重连。
- [ ] Host 断线 → Journey 到期 → server catch-up → 重连返程，重复 catch-up 不重复结算。
- [ ] 双 Agent 委托、共同事件和读模型传播。
- [ ] Agent 回复与网页验证逐字段一致。
- [ ] 公开/私有权限与凭据泄漏。
- [ ] 三旅程相册与跨月月报；年度摘要必须使用覆盖完整服务器年度的测试时钟。
- [ ] 一百次低相关社交事件只生成聚合 briefing，不触发一百次中断。

**最终命令：**

```bash
cd tools/graph-react-app
npm run typecheck
npm test
npm run build:container
npm run agent:install-smoke -- --json
npm run agent:container-lifecycle-gate
npm run agent:recovery-drill
```

**完成证据：** 所有场景通过，发布包在真实 MCP Host 上完成一次有具体内容、可验证、能影响第二个 Agent 的旅程。

## 7. Delivery Phases

### P0a：技术垂直切片

包含 Task 0–7 的最小路径、Task 10 的 stdio 安装路径、Task 12 的单 Agent 场景。范围固定为：一个稳定 transport、Tool-driven 基线、该 transport 上的 Sampling、1–3 个具体 episode、等待/重连/返程和一个验证页。

发布门槛：

- stdio 对话内可完成一段短旅程。
- stdio Sampling 双向能力可用并可降级。
- Host 断线后服务器按到期时间推进，重连收到一次且仅一次返程。
- Agent 回复中的一个主 URL 可验证 canonical 事实。
- 服务重启后可恢复。

### P0b：Core MVP

包含 Streamable HTTP 双向 Sampling、3–7 episode 普通旅程、预设与中断预算、完整安装路径，以及一个“Agent A 结算改变 Agent B 下一次 briefing”的薄社交传播切片。

发布门槛：

- stdio 与 Streamable HTTP 都通过 Sampling/无 Sampling/拒绝/超时矩阵。
- 具体 episode 取代固定模板，普通旅程默认零中断且最多一次同步游戏问题。
- A 的 canonical event 在规定读模型刷新内改变 B 的 briefing。
- 单 Agent 核心 E2E、传播 smoke、安装烟测和恢复门禁通过。

P0b 未完成前，不新增大型经济、战斗或组织系统。

### P1：共享社交闭环

包含 Task 8 的来访/礼物/单一 escrow 委托、Task 11 社交治理、Task 12 双 Agent 场景。

发布门槛：

- 两个不同用户的 Agent 可异步互动。
- 共同事件跨视角事实一致。
- Agent A 能影响 Agent B 的后续世界。
- 信箱相关性排序与聚合可抑制低价值社交噪声。
- 社交滥用与隐私门禁通过。

### P2：长期情感闭环

包含 Task 9、完整相册/年度/代际体验和相关 QA。

发布门槛：

- 多次旅程形成长期档案。
- 用户能看到 Agent 的成长、关系和记忆连续性。
- 月报只汇总真实旅程事实；年度只在完整服务器年度或明确年度区间后生成。
- 时间倍率、服务器日历和年度边界已冻结并版本化。

## 8. Risks and Mitigations

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| MCP Host Sampling 支持不一致 | 部分用户无法使用增强体验 | Tool-driven 基线、capability negotiation、真实 host matrix |
| Streamable HTTP 双向实现复杂 | 会话串线、丢响应 | session/request manager、并发测试、断线清理 |
| Sampling 幻觉 | Agent 回复与世界事实冲突 | 事实 schema、sourceEventIds、narrative validator、结构化降级 |
| 内容仍然模板化 | 产品核心失败 | mandate ranking、scene fingerprint、重复率指标和 E2E 门禁 |
| 现有巨型模块继续增长 | 维护风险扩大 | 所有新逻辑进入 focused modules，boundary tests 守住 |
| 社交被刷量利用 | 经济和声望失真 | escrow、同 owner 禁止、重复对手评分、冷却与上限 |
| 离线推进伤害用户 | 信任损失 | 自动寿命损失为零、高风险暂停、安全撤退 |
| 结果页泄密 | 身份和用户风险 | public/private ViewModel、secret scanning、渗透测试 |
| 年度范围重新膨胀 | P0 长期无法交付 | 年度延后至 P2，P0 只交付旅程与验证闭环 |

## 9. Verification Strategy

### Unit

- 协议 schema、session/request manager、Sampling validator。
- Journey state machine、policy、scene ranking、anti-repeat。
- Interaction envelope、narrative grounding、verification ViewModel。

### Integration

- MCP transport ↔ Sampling client。
- Journey runtime ↔ existing turn settlement ↔ persistence。
- Shared event ↔ region/briefing read models。
- Agent reply DTO ↔ result page ViewModel。

### E2E

- 真实子进程 stdio。
- 真实 HTTP server/session。
- 发布包代理。
- 两个 explorer/Agent。
- restart/backup/restore。

### Observability

- correlation ID 完整。
- Sampling/tool/journey/propagation 指标。
- 故障注入后可定位。

## 10. Stop Conditions

- Sampling 输出能直接改变 canonical state：停止发布并修复信任边界。
- Agent 回复和验证页核心事实不一致：停止发布。
- 无 Sampling 客户端无法完成基础旅程：停止发布。
- 相同幂等键产生重复奖励或 interaction：停止发布。
- Agent A 事件不能在规定读模型刷新内影响 Agent B：P1 不得发布。
- P0 仍依赖固定观察/协助模板：不得宣称核心可玩。

## 11. Execution Order and Dependencies

```text
Task 0 baseline
  -> Task 1 bidirectional MCP
  -> Task 2 Sampling
  -> Task 3 Journey domain
  -> Task 4 concrete content
  -> Task 5 MCP journey surface
  -> Task 6 persistence
  -> Task 7 verification page
  -> P0 QA / Task 10 partial / Task 12 partial
  -> Task 8 social propagation
  -> Task 11 governance
  -> P1 QA
  -> Task 9 album/year/generation
  -> Task 10 final docs/package
  -> Task 12 final release gate
```

可以并行的工作仅限依赖已稳定后的独立切片：

- Task 7 验证页 ViewModel 与 Task 8 interaction read model 可在 Task 3/5 contract 稳定后并行。
- Task 10 文档/包更新可在每个 capability contract 稳定后增量进行。
- Task 11 指标定义可提前，但接线必须等待对应运行时存在。

## 12. Handoff Notes

- 实施时优先使用小模块，不继续扩张 `gameCore.ts`、`runtime.ts`、`mcpTools.ts` 和 `server.test.ts` 的业务逻辑。
- `mcpTools.ts` 只保留定义、映射和兼容 adapter；Sampling/session 实现放独立模块。
- 不修改用户已有的 `docs/superpowers/specs/2026-06-07-obsidian-3d-world-map-design.md` 未提交变更。
- 每个 Task 完成后更新本 plan 的 checkbox 和测试证据，再进入依赖任务。
