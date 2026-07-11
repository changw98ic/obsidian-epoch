# 黑曜纪元架构硬化与公开叙事边界 Spec

## 1. 背景

当前项目已经形成可运行的 server-authoritative agent MMO 雏形：React 控制台、Agent Server、MCP 入口、事件日志、结果页、安装页、测试和导出链路都已经存在。问题不在于“不能跑”，而在于核心能力增长过快，用户可见叙事、内部事件模型、HTTP 路由、游戏局语义和大型组件边界开始互相泄漏。

本 spec 针对当前暴露出的架构缺陷制定整改目标：

- 结果页曾向玩家暴露英文枚举、内部 ID、技术收据和难懂术语。
- “一局游戏”在用户体验上应是一段完整故事历程，而不是一个内部回合。
- 身份授权、恢复凭据、公开分享、结果页导航之间的语义不够清楚。
- 服务端、游戏核心、前端控制台存在巨型模块，后续改动风险高。
- JSONL 事件存储和页面渲染可以支撑原型，但缺少面向增长的读模型和公开视图边界。

## 2. 现状证据

当前关键模块规模：

| 模块 | 行数 | 风险 |
| --- | ---: | --- |
| `tools/agent-server/lib/epoch/gameCore.ts` | 8927 | 游戏规则、结算、事件生成仍集中；identity projection reads、identity owner authorization guards、身份签发/recovery/lifetime/archive/reincarnation/personality drift payload 与 identity issue/recovery rotation/lifetime adjustment/identity archive/reincarnation/personality drift proposal/confirmation event sequence/result projection 规划、source-event eligibility/open proposal/cooldown/trait selection 规划、identity lineage/legend/slot projection、communication moderation item projection reads、communication moderation/text normalization/assessment/content status update/risk payload/auto escalation、moderation resolved event sequence/result projection 和 risk review recorded event sequence/result projection 规划与 abuse release/decay event sequence/result projection、abuse decay 目标选择/limit/amount/min-score、停机 region 归一化、奖励、reward grant、set/claim/tick payload、set/claim/tick event sequence/result projection、日记 payload、日记 projection 与 tick target selection/limit、库存物品 projection reads、库存/商店目录、inventory item create/craft/shop/bind event sequence/result projection 和 item created/bound payload 规划、资源余额浅拷贝、grant/spend event sequence/result projection 与多成本 spend payload 规划、region news projection reads、region news generation event sequence/result projection、message posted event sequence/result projection、legend award payload/resource grant/ledger reason/claim event sequence/result projection 规划、组织创建/成员 event sequence 与 payload、金库贡献 event sequence、预算提案/投票/决议 event sequence、升级购买 event sequence 与金库/预算/升级 payload 与规则、成员状态/活跃成员查询/赛季升级查询、组织政治 tick 目标选择/limit/region filter、参与者/职业/来源证据规划、模板/类型/payload 规划和 tick result projection、party run/retaliation opportunity projection reads、party lifecycle 校验/invite token/payload/event sequence/result projection、party/raid/retaliation 纯结算、party member settlement/total-score/reward grant、party run settlement event sequence/influence/trace/news payload、raid pair history/heat lookup、raid/retaliation resolution event sequence/result projection、raid/retaliation stamina spend/reward grant payload、raid/retaliation influence/trace payload 和 raid/retaliation payload 规划、事件 envelope factory、通用资源 ledger event、通用区域 trace/influence event、region influence score/latest trace lookup、region activity 类型/写入 helper、通用库存物品 event 包装、turn/hosted action signed envelope 规则、turn/hosted action policy/reward grant/hosted runner attestation payload、turn-card 过期/序号/未过期开放卡唯一性校验、turn-card/turn-resolution/hosted-session/hosted-action payload 与 event sequence 规划、server-hosted job lifecycle payload 与 event sequence 规划、来源事件 ID 归一化/存在性校验与风险评审 source lookup/analysis 规则、lore provenance/evidence 规则、lore contribution validation/revision/source ids/source event lookup/non-evidence reuse/refutation quota/low-authority refutation gate/record payload/cost spend 和 target adjudication status/source ids/source contribution event lookup/history folding/stable key/payload/event sequence/id link/canon candidate 规则、NPC trait/review-resolution 归一化、canonicalized/candidate review/rumor/ability clustering、canonicalize/submit/review event sequence 规划、NPC lifecycle 目标选择/limit/region filter、changes normalization/summary/lifecycle event payload/sourceEventIds/household merge/organization membership/memory/relationship/household/career/location/asset/health payload、manual lifecycle/memory event sequence 与 tick result projection 规划、关系/托管社交互动规则和 diplomacy/relationship/agent-NPC bond focus spend、diplomacy proposal event sequence、diplomacy response event sequence、accepted diplomacy relationship/trace event sequence、relationship update event sequence、agent-NPC bond update event sequence、diplomacy trace、social hook lifecycle/hosted social hook side-effect event sequence 规划、command rejected / abuse score changed event sequence/result projection、server trust guard 复用、encounter objective/anomaly 归一化、objective/anomaly 投影读取、objective creation/contribution/settlement and anomaly spawn/contest/resolution event sequence/result projection、objective/anomaly spend/reward grant payload、objective 与 anomaly 生成/争夺/结算 payload 规划和 anomaly focus 计分规则、resource-node 投影读取/计分/冷却/装备加成、resource-node spawn/contest/settlement event sequence/result projection、resource-node stamina spend/reward grant payload 和 resource-node 生成/争夺/结算 payload 规划、season projection reads、season creation/contribution/settlement event sequence/result projection、season creation/start/objective payload、season contribution spend/score payload/trust breakdown/dominant/trusted score rules、区域控制加成/地区赛季 standing 查询、objective completion payload、season settlement reward/dividend/payload/控制权/纪念碑/组织分红规划、region control decay target selection/limit/amount/min-age/min-score、region control release lookup、region control decay/release/claim/revolt payload、region control decay/release/claim event sequence/result projection、region revolt resolution event sequence/result projection、revolt stamina spend/influence/trace payload 和 revolt 战力结算规划、market order projection reads、market risk restriction guard、market order region normalization、market order create/fill/cancel/expiry event sequence/result projection、fill payment-pair/goods asset、expiry tick 目标选择/limit/max-age、lifecycle/ledger/risk/refund payload 规划、direct trade projection reads、direct trade create/accept/cancel/expiry event sequence/result projection、accepted resource asset/payment-pair/goods asset、expiry tick 目标选择/limit/max-age、lifecycle/ledger/risk/refund payload 规划、bounty projection reads、bounty create/claim event sequence/result projection、bounty escrow/claim/fulfillment item transfer/influence/trace payload 规划已外移 |
| `tools/agent-server/lib/epoch/runtime.ts` | 2056 | runtime 编排、身份和流程仍耦合；多组纯读模型、公开世界/agent/hosted/lore 入口 read model、activity/progress/message runtime read wrapper、hosted-session runtime read wrapper、identity/profile runtime read wrapper、operator/audit runtime read wrapper、region/NPC info read model、organization/NPC subview wrapper read model、encounter runtime read wrapper、economy runtime read wrapper、season runtime read wrapper、combat runtime read wrapper、social runtime read wrapper、恢复凭据 helper、explorer auth secret-hash state/recovery rotation runtime、abuse rate-limit bucket/status runtime、idempotency replay/conflict runtime、command context builders、runtime input normalization/template choice/abuse actor key、公开文本 secret guard/拒绝命令审计摘要、公开事件/投影/command result 包装、高价值确认规则和状态机、attested runner challenge/signature 状态、结果页 runtime rules/payload/access/record helper、结果页 publish-token/idempotency/revoke/delete 生命周期状态、结果页 payload builder、one-shot exploration runtime、结果页 receipt/trust-tier rules、结果页导航/自述规则、结果页 focus 校验/区域选择/区域上下文投影规则、shop offer media projection、region media projection、region news media projection、region news draft rules、region news write flow、relationship/NPC bond/household media projection、NPC state/lifecycle projection、organization/diplomacy/influence projection、encounter objective/resource/anomaly projection、inventory/shop/market/direct-trade projection wrapper、bounty/party/raid projection wrapper、relationship/diplomacy projection wrapper、region monument projection、season campaign/contribution audit projection、Web Bridge prompt/view projection、region commission/location motif projection、anomaly event template/boss media/rotation/operator input rules、server-hosted job helper 和 server-hosted run/queue/job 执行流程、operator maintenance run 编排、downtime set/claim/tick runtime 写流程、NPC note/candidate submit/review runtime 写流程、NPC lifecycle record/tick runtime 写流程、来源事件权威/provenance helper、lore provenance fallback/evidence hash helper 和 lore target/worldview/honor board read model 已开始外移 |
| `tools/agent-server/lib/httpServer.ts` | 652 | 主要保留 server bootstrap、health、dispatcher 和持久化桥接；主体业务路由、HTTP 错误映射、请求解析和响应 helper 已拆出 route/helper module |
| `tools/graph-react-app/src/agent/AgentExplorer.tsx` | 5450 | 控制台 UI 状态和流程仍偏集中；结果页、世界总览主面板/最近结果、公共大世界摘要、资源余额、背包/商店、公共市场、私下交易、组织控制、遭遇行动、悬赏控件、小队控件、对抗/反击控件、赛季控件、关系/外交控件、大型区域摘要、回合/托管动作控件已开始拆出组件；玩家可见标签/工具目录、动作状态机、玩家主操作禁用原因、安装连接 readiness 投影、进度刷新请求聚合、过期请求防覆盖规则、完整区域快照提交和局部 slice 覆盖规则已开始外移到 helper/controller |
| `tools/graph-react-app/src/agent/api.ts` | 1011 | API DTO、请求封装、前端语义集中 |
| `tools/agent-server/lib/resultPageHtml.ts` | 1128 | 公开结果页已经走公开 ViewModel，但 HTML/CSS 仍偏大 |
| `tools/agent-server/lib/publicWorldPageHtml.ts` | 1557 | 安装页/公开页叙事与技术信息混合 |
| `tools/agent-server/test/server.test.ts` | 13207 | 覆盖强，但失败定位和演进成本高 |

当前验证链路集中在 `tools/graph-react-app/package.json`：

- `npm run typecheck`
- `npm run agent:test`
- `npm run agent:ui-test`
- `npm run build:export`

本轮 identity issue/recovery rotation/lifetime adjustment/archive/reincarnation/personality drift proposal/confirmation、NPC canonicalize/submit/review 与 manual lifecycle/memory、diplomacy proposal、diplomacy response、accepted diplomacy relationship/trace、relationship update、agent-NPC bond update、hosted social hook side-effect、turn-card/turn-resolution/hosted-session/hosted-action event sequence、server-hosted job lifecycle event sequence、lore contribution record/target adjudication event sequence、runtime input normalization/template choice、result page focus validation/regional context projection/payload builder、one-shot exploration runtime、organization creation/membership event sequence、organization treasury contribution event sequence、organization budget proposal/resolution event sequence、organization upgrade purchase event sequence、resource grant/spend、objective creation/contribution/settlement、anomaly spawn/contest/resolution、resource-node spawn/contest/settlement、season campaign create/contribute/settle、market order create/fill/cancel/expiry、direct trade create/accept/cancel/expiry、bounty create/claim、party run create/invite update/member join/join request/resolve、party run settlement、raid/retaliation resolution、region revolt resolution 与 inventory item create/craft/shop/bind event sequence/result projection 拆分后已额外验证：

后续补充：region news write flow 已拆入 `lib/epoch/regionNewsRuntime.ts`，并纳入本轮验证。
后续补充：lore target adjudication 和 NPC candidate review 的 server-only guard 已统一复用 `requireServerTrust`，并由 game-core 边界测试守住原错误码。
后续补充：explorer auth secret-hash state、initial-event hydration 和 recovery rotation/replay 已拆入 `lib/epoch/explorerAuthRuntime.ts`，runtime 只注入 projection、abuse guard、owner context 和 core adapter。
后续补充：abuse rate-limit bucket、restricted-score gate 和 abuse status projection 已拆入 `lib/epoch/runtimeAbuseRuntime.ts`，runtime 只保留 adapter 注入。
后续补充：idempotency result map、owner/subject conflict record、duplicate replay 和 auth-after-idempotency sequencing 已拆入 `lib/epoch/runtimeIdempotencyRuntime.ts`，runtime 只注入 public projection、abuse guard 和 explorer authorization hook。
后续补充：world overview、agent briefing、hosted watch、lore portal 和 world context version 聚合已拆入 `lib/epoch/publicWorldReadModel.ts`，runtime 只注入 projection、clock、result page store 和 downtime 配置。
后续补充：region info 与 NPC info 聚合已拆入 `lib/epoch/regionInfoReadModel.ts`，runtime 只注入 projection 快照和服务器时间。
后续补充：organization 与 NPC 子视图 runtime wrapper 已拆入 `lib/epoch/organizationNpcReadModel.ts`，runtime 不再直接消费 organization/NPC/relationship 底层子投影函数。
后续补充：objectives、resource nodes 和 anomalies 的 runtime read wrapper 已拆入 `lib/epoch/encounterRuntimeReadModel.ts`，runtime 不再直接消费 `encounterReadModel.ts` 底层查询函数。
后续补充：inventory、shop、market 和 direct trades 的 runtime read wrapper 已拆入 `lib/epoch/economyRuntimeReadModel.ts`，runtime 不再直接消费 `progressReadModel.ts`、`shopReadModel.ts`、`marketReadModel.ts` 的底层经济查询函数。
后续补充：season list、season archive 和 season command result wrapper 已拆入 `lib/epoch/seasonRuntimeReadModel.ts`，runtime 不再直接消费 `seasonReadModel.ts` 底层赛季投影函数。
后续补充：bounties、party runs 和 raids 的 runtime read wrapper 已拆入 `lib/epoch/combatRuntimeReadModel.ts`，runtime 不再直接消费 `bountyPartyReadModel.ts` 或 raid 底层投影函数。
后续补充：relationships 和 diplomacy 的 runtime read wrapper 已拆入 `lib/epoch/socialRuntimeReadModel.ts`，runtime 不再直接消费 `relationshipReadModel.ts` 或 `organizationReadModel.ts` 底层社交投影函数。
后续补充：events、progress 和 messages 的 runtime read wrapper 已拆入 `lib/epoch/activityRuntimeReadModel.ts`，runtime 不再直接消费 `progressReadModel.ts` 或 `regionActivityReadModel.ts` 底层查询函数。
后续补充：hosted session list 的 runtime read wrapper 已拆入 `lib/epoch/hostedSessionRuntimeReadModel.ts`，runtime 不再直接消费 `publicHostedSessionsView` 或 hosted-session status/limit 解析。
后续补充：agent memory、personal migration、identity archive 和 explorer profile 的 runtime read wrapper 已拆入 `lib/epoch/identityRuntimeReadModel.ts`，runtime 不再直接拼接身份/profile 读模型输入。
后续补充：audit、abuse profiles、moderation queue 和 operator overview 的 runtime read wrapper 已拆入 `lib/epoch/operatorRuntimeReadModel.ts`，runtime 保留 operator key 校验，但不再直接拼接 operator/audit 投影。
后续补充：downtime set/claim/tick 的 runtime 写流程已拆入 `lib/epoch/downtimeRuntime.ts`，runtime 只注入身份读取、owner context、idempotency 包装和 game-core adapter。
后续补充：NPC note、NPC candidate submit 和 operator review 的 runtime 写流程已拆入 `lib/epoch/npcCandidateRuntime.ts`，runtime 只注入 operator key、身份读取、untrusted/owner context、idempotency 和 game-core adapter。
后续补充：NPC lifecycle record/tick 的 runtime 写流程已拆入 `lib/epoch/npcLifecycleRuntime.ts`，runtime 只注入 command context、idempotency 和 game-core adapter。

- `node --import tsx --test ../agent-server/test/encounterRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `npm run typecheck:agent`
- `node --import tsx --test ../agent-server/test/explorerAuthRuntime.test.ts ../agent-server/test/runtimeAuth.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "HTTP rotates explorer recovery code and revokes the old credential|HTTP Web LLM bridge rejects recovery material in browser-copy text" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "MCP rotates explorer recovery code and revokes the old credential" ../agent-server/test/mcp.test.ts`
- `node --import tsx --test ../agent-server/test/runtimeAbuseRuntime.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "HTTP Epoch routes return 429 when public abuse limits are exceeded|HTTP abuse score restriction blocks new writes after cooldown recovery|HTTP operator can release an abuse score restriction without erasing audit history" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "MCP Epoch state changes enforce abuse limits without blocking reads or idempotent replay|MCP abuse score restriction blocks new writes after cooldown recovery|MCP operator can release an abuse score restriction without erasing audit history" ../agent-server/test/mcp.test.ts`
- `node --import tsx --test ../agent-server/test/runtimeIdempotencyRuntime.test.ts ../agent-server/test/idempotencyRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "idempotency replay|changed payload|idempotency|web-confirmed one-time|requires explorer recovery authorization" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "agent briefing|world overview|public world|hosted session|lore contribution|lore target|world lore|hosted watch" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts`
- `node --import tsx --test --test-name-pattern "region info|public region|public agent, region and NPC|NPC organizations careers and locations|NPC memories|NPC households|server-derived frontlines|canonical region leaderboards|regional economy orders|social hooks" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "NPC organizations careers and locations|NPC memories|NPC households|social hooks|public agent, region and NPC|region info" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/api.test.ts`
- `node --import tsx --test --test-name-pattern "resource nodes|anomaly chains|contested objectives|region info|server-spawned resource|server-spawned anomaly|HTTP exposes server-spawned" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/encounterReadModel.test.ts`
- `node --import tsx --test --test-name-pattern "inventory|shop|market|direct trade|direct trades|trade|economy|offer|purchase" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/inventoryRules.test.ts ../agent-server/test/shopReadModel.test.ts ../agent-server/test/marketTradeRules.test.ts`
- `node --import tsx --test --test-name-pattern "season|campaign|contribution audit|region control|revolt" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/seasonReadModel.test.ts ../agent-server/test/seasonCampaignRules.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test --test-name-pattern "bounty|party|party run|raid|retaliation|frontline|region info|direct trade expiry refunds|owner-authorized party" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/bountyPartyReadModel.test.ts ../agent-server/test/combatSettlementRules.test.ts ../agent-server/test/bountyRules.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test --test-name-pattern "relationship|diplomacy|agent NPC bond|NPC relationships|social hooks|frontlines|organization membership" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/agentInteractionRules.test.ts ../agent-server/test/relationshipReadModel.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test --test-name-pattern "messages|identity progress|progress|region alias|events|latest events|activity" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/regionActivityReadModel.test.ts ../agent-server/test/progressReadModel.test.ts`
- `node --import tsx --test --test-name-pattern "hosted session|hosted_sessions|hosted action|server-hosted|attested|public hosted|watch" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/hostedSessionReadModel.test.ts ../agent-server/test/serverHostedRuntime.test.ts ../agent-server/test/attestationRuntime.test.ts`
- `node --import tsx --test --test-name-pattern "agent memory|personal migration|migration|explorer profile|identity archive|archive identity|reincarnate|lineage|identity slot|NPC candidate" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/agentMemoryReadModel.test.ts ../agent-server/test/identityArchiveReadModel.test.ts ../agent-server/test/explorerProfileReadModel.test.ts ../agent-server/test/personalMigrationReadModel.test.ts ../agent-server/test/identityLifecycleRules.test.ts`
- `node --import tsx --test --test-name-pattern "operator|audit|abuse|moderation|risk review|growth quality|attested runner" ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/operatorOverviewReadModel.test.ts ../agent-server/test/auditReadModel.test.ts ../agent-server/test/moderationRiskRules.test.ts ../agent-server/test/runtimePublicProjectionRules.test.ts`
- `npm run agent:test`（1028/1028 pass after activity/hosted-session/identity-profile/operator-audit runtime read-wrapper extraction）
- `npm run agent:test`（1028/1028 pass）

这说明项目有较好的安全网，但现有安全网主要保护行为不坏，不足以强制架构边界自然成立。

## 3. 产品级目标

### 3.1 用户理解目标

玩家打开公开结果页时，必须能在 10 秒内理解：

1. 这是谁的一次历程。
2. 这一局从哪里开始，经历了哪些关键阶段，到哪里结束。
3. 角色付出了什么代价，得到了什么变化。
4. 当前结果是否已由服务器结算。
5. 接下来可以去哪里继续玩、查看档案或安装入口。

玩家不应该被要求理解：

- `T0_public`、`T2_local_secret`、`social_hook`、`resource_granted` 等内部事件枚举。
- `region_gray_harbor`、`epoch_event_000004`、`turn_card:*` 等内部 ID。
- `SERVER RECEIPT`、`trustClass`、`deliveryTrust`、`untrusted_client` 等审计字段。
- “控制位开放”“等待声明或起义”这类没有上下文的系统短语。

### 3.2 游戏局语义目标

“一局游戏”必须指一次完整故事历程，而不是一个技术回合。

默认完整局结构：

```text
开局契约
-> 3 到 5 个早期探索事件
-> 2 到 4 个中段冲突或发现
-> 1 到 3 个结局事件
-> 服务器结算
-> 公开结果页
```

内部可以继续使用 turn、turn card、hosted action、event 等推进单位，但公开页面必须把它们投影成“历程时间线”。

### 3.3 身份授权目标

身份授权只表示：

> 用本机恢复凭据或会话证明你是该探索者/agent 档案的拥有者。

它不表示玩家要理解密钥、签名、MCP 权限或技术 token。

公开分享页默认不要求身份授权。只有以下动作需要授权：

- 继续使用该 agent。
- 查看私有记忆、私有资源、未公开事件。
- 发布、撤回或重新生成属于该身份的公开结果。
- 进行会消耗寿命、资源、外物或身份状态的操作。

## 4. 非目标

- 不在本轮要求重写整个目录结构为 `apps/` 和 `packages/`。
- 不删除 JSONL 开发存储；JSONL 仍可作为本地、测试和恢复工具。
- 不引入新依赖来替代当前 HTTP server 或路由方式，除非后续计划单独批准。
- 不把所有大文件一次性拆完。拆分必须围绕明确边界和测试收益。
- 不把技术校验证明彻底删除；它可以存在，但必须默认隐藏在玩家叙事之后。
- 不把所有英文专有名词禁止。世界观正式英文名、玩家自定义名和第三方主机名可以保留。

## 5. 架构原则

### 5.1 公开页面只消费公开 ViewModel

公开 HTML 渲染器不得直接拼接原始 `EpochEvent`、内部 receipt、action option、runtime snapshot 或数据库记录。

必须引入明确的公开视图对象：

```ts
export interface PublicResultViewModel {
  pageTitle: string;
  agentName: string;
  runTitle: string;
  runSummary: string;
  statusLabel: string;
  timeline: PublicTimelineItem[];
  consequences: PublicConsequence[];
  rewards: PublicReward[];
  nextActions: PublicNextAction[];
  verification: PublicVerificationSummary;
}
```

页面渲染层只能读取已经净化、翻译、排序后的字段。内部 ID、枚举、审计字段只能进入 `verification` 的隐藏详情，不能进入默认可见文案。

### 5.2 内部事实和玩家叙事分层

服务端必须区分三类数据：

| 层级 | 用途 | 可见性 |
| --- | --- | --- |
| Canonical Event | 审计、回放、服务器结算 | 内部为主 |
| Read Model | 查询、控制台、列表页 | 按权限过滤 |
| Public Narrative ViewModel | 结果页、安装页、分享页 | 默认公开 |

禁止让公开页为了“方便”直接从 canonical event 里猜文案。

### 5.3 结果页是玩家产物，不是 debug 页面

结果页首屏优先级：

1. 标题：谁完成了什么历程。
2. 结局摘要：发生了什么。
3. 核心代价/奖励：寿命、资源、声望、关系、线索。
4. 历程时间线：关键事件按故事顺序展示。
5. 接下来去哪：继续游玩、查看档案、安装入口、世界首页。

技术校验证明只能在底部折叠区出现，标题使用中文“校验证明”，默认折叠。折叠区说明应面向玩家：

> 这些信息用于确认本页来自服务器结算，不影响阅读故事。

### 5.4 新功能默认进入小模块

任何新增功能不得继续向 `gameCore.ts`、`runtime.ts`、`httpServer.ts`、`AgentExplorer.tsx` 追加无边界代码。

允许在旧文件中保留兼容导出，但新逻辑必须优先进入聚焦模块，例如：

- `lib/epoch/runLifecycle.ts`
- `lib/epoch/publicResultPresenter.ts`
- `lib/epoch/publicVocabulary.ts`
- `lib/http/resultRoutes.ts`
- `lib/http/identityRoutes.ts`
- `src/agent/components/ResultNavigation.tsx`
- `src/agent/components/IdentityAuthorizationPanel.tsx`

## 6. 必须整改的系统边界

### 6.1 完整游戏局边界

必须新增或收敛以下概念：

```ts
export type GameRunStatus =
  | "draft"
  | "running"
  | "settling"
  | "settled"
  | "published"
  | "archived";

export interface GameRunReadModel {
  runId: string;
  agentId: string;
  explorerId: string;
  title: string;
  status: GameRunStatus;
  startedAt: string;
  settledAt?: string;
  publishedAt?: string;
  acts: GameRunAct[];
  finalOutcome?: GameRunOutcome;
}
```

`turn_card` 和 `hosted_action` 是 `GameRunAct` 的来源之一，不是公开页标题语义。

验收要求：

- 一次“跑一局”默认产出一个 `GameRunReadModel`。
- 公开结果页标题不得使用“回合”“turn card”作为主语。
- 结果页必须显示不少于 4 个故事阶段，除非该局因死亡、撤退或失败提前结束。
- 提前结束也必须显示清楚的“为什么结束”。

### 6.2 公开词汇表

必须建立集中词汇转换，不允许各页面散落硬编码翻译。

```ts
export interface PublicVocabulary {
  eventTypeLabel(type: string): string;
  resourceLabel(resourceId: string): string;
  trustLabel(receipt: PublicVerificationSummary): string;
  regionName(regionId: string): string;
  agentDisplayName(agentId: string): string;
}
```

验收要求：

- 用户可见文本不得出现 `resource_granted`、`turn_resolved`、`turn_card_created`、`identity_issued`。
- 用户可见文本不得出现 `T0_public`、`T1_`、`T2_`、`local_secret`、`social_hook`。
- 用户可见文本不得出现 `region_` 前缀，除非它在隐藏校验证明里。
- “专注”等资源必须显示为带上下文的中文名称，例如“专注点”或“可用于推进探索的专注点”，不能只显示孤立名词。

### 6.3 身份授权与导航

公开结果页必须有明确导航区，命名为“接下来去哪”。

默认动作：

- 继续这个 agent。
- 查看 agent 档案。
- 返回世界入口。
- 安装/连接到黑曜纪元。
- 复制分享链接。

需要授权的动作必须显示用户语言：

> 需要确认这是你的档案，才能继续消耗寿命或查看私有内容。

不得显示：

- “身份授权”孤立标题而无解释。
- recovery token、share token、publish token 等技术名词。
- “等待声明或起义”这类系统内部状态。

### 6.4 HTTP route 边界

`httpServer.ts` 应逐步收敛为 server bootstrap 和 dispatcher，不继续承载所有业务路由。

目标模块：

```text
tools/agent-server/lib/http/
  response.ts
  requestBody.ts
  auth.ts
  agentProfileRoutes.ts
  resultRoutes.ts
  identityRoutes.ts
  worldRoutes.ts
  mcpRoutes.ts
  assetRoutes.ts
  installRoutes.ts
  auditRoutes.ts
  operatorRoutes.ts
  economyRoutes.ts
  seasonRoutes.ts
  hostedRoutes.ts
  narrativeRoutes.ts
  encounterRoutes.ts
  societyRoutes.ts
  gameplayRoutes.ts
  legacyRoutes.ts
```

验收要求：

- 新增公开结果页接口必须在 `resultRoutes.ts`。
- 新增身份/恢复/授权接口必须在 `identityRoutes.ts`。
- 共享 JSON 响应、错误响应、body size 检查不得复制粘贴。
- 新 route module 的单文件目标上限为 800 行。

### 6.5 游戏核心拆分边界

不要求一次性拆完 `gameCore.ts`，但新增和迁移必须按领域进入小模块。

建议领域：

```text
lib/epoch/
  runLifecycle.ts
  actionOptions.ts
  identityLifecycle.ts
  resources.ts
  publicNarrative.ts
  publicResultPresenter.ts
  eventProjection.ts
  verificationReceipt.ts
```

验收要求：

- 新增“完整局”逻辑不得直接塞进 `gameCore.ts` 的长函数。
- `gameCore.ts` 可以作为兼容 facade，但核心算法应委托到小模块。
- 每个新领域模块必须有对应单元测试或 server 集成测试。

### 6.6 前端控制台拆分边界

`AgentExplorer.tsx` 继续作为容器可以接受，但新增 UI 必须进入组件模块。

目标模块：

```text
src/agent/components/
  ResultNavigation.tsx
  GameRunTimeline.tsx
  IdentityAuthorizationPanel.tsx
  PublicReceiptDisclosure.tsx
  AgentResourceSummary.tsx
  TurnHostedActionPanel.tsx
```

验收要求：

- 新增结果页/授权/导航 UI 不得继续扩大 `AgentExplorer.tsx` 的主 JSX。
- API DTO 和用户文案不得混在组件内部临时拼接。
- 前端展示内部枚举时必须通过 display helper。

### 6.7 持久化与读模型

JSONL 事件存储可以保留，但公开页和控制台列表不得依赖热路径全量 `readAll()` 后临时扫描。

目标：

- 开发环境继续支持 JSONL。
- 生产或长线运行使用 SQLite/projection 表承载常用读模型。
- 公开结果页从 `GameRunReadModel` / `PublicResultViewModel` 读取。
- canonical event log 仍是可回放真相，不承担所有查询职责。

验收要求：

- 新增公开查询优先读 projection/read model。
- `readAll()` 只能用于启动恢复、测试、导出、维护脚本或明确标记的低频审计路径。
- 新增 projection 必须可由事件日志重建。

## 7. 用户可见文案规则

### 7.1 禁止默认可见

以下内容不得出现在默认可见区域：

```text
SERVER RECEIPT
resource_granted
turn_resolved
turn_card_created
identity_issued
T0_public
T1_
T2_
local_secret
social_hook
region_
epoch_event_
sha256:
untrusted_client
user_verified_web
server_settled
```

例外：`sha256:`、内部 ID、trust fields 可以出现在默认折叠的“校验证明”详情中。

### 7.2 必须解释

以下概念如果出现，必须有玩家能理解的解释：

| 概念 | 推荐表达 |
| --- | --- |
| 身份授权 | 确认这是你的档案，才能继续使用或查看私有内容 |
| 专注 | 本局可用的行动注意力，用来推进探索或处理风险 |
| 服务器结算 | 本页结果已由黑曜纪元服务器记录 |
| 分享链接 | 任何拿到链接的人都能查看这份公开战报 |
| 校验证明 | 用来确认页面来源的技术信息，默认不影响阅读 |

### 7.3 页面空态

任何列表为空时，不得显示内部字段或空数组。必须显示玩家语言：

- “本局没有公开新闻。”
- “这名 agent 还没有可公开的档案变化。”
- “没有需要你处理的后续行动。”

## 8. 测试规格

### 8.1 公开文本泄漏测试

新增或扩展可见文本测试，提取 HTML 可见文本后断言：

```ts
const forbiddenVisibleText = [
  "SERVER RECEIPT",
  "resource_granted",
  "turn_resolved",
  "turn_card_created",
  "identity_issued",
  "T0_public",
  "T1_",
  "T2_",
  "local_secret",
  "social_hook",
  "region_",
  "epoch_event_",
  "untrusted_client",
  "user_verified_web",
  "server_settled",
];
```

每个公开页面测试必须使用可见文本提取，而不是只检查 raw HTML。隐藏 JSON、script payload 或折叠校验证明可以单独测试。

### 8.2 完整局测试

必须覆盖：

- 一次默认“跑一局”产出完整 `GameRunReadModel`。
- 完整结果页显示开局、中段、结局和结算。
- 提前死亡/撤退仍显示清楚结束原因。
- 公开结果页标题不使用 turn/card/internal id。

### 8.3 授权测试

必须覆盖：

- share token 可以打开公开结果页。
- 未授权用户不能继续消耗该 agent 的寿命或资源。
- 未授权用户不能查看私有事件、私有记忆或 owner-only 操作。
- 授权失败显示用户语言，不显示 token、签名或内部错误。

### 8.4 Route 边界测试

新增 route module 后，每组路由至少覆盖：

- 成功响应。
- 鉴权失败。
- body 过大或 JSON 无效。
- 方法不允许。
- 不存在资源。

### 8.5 验证命令

每轮架构整改必须至少运行：

```bash
cd tools/graph-react-app
npm run typecheck
node --import tsx --test ../agent-server/test/server.test.ts
node --import tsx --test src/agent/AgentExplorer.layout.test.ts
node --import tsx --test ../agent-server/test/attestationRuntime.test.ts ../agent-server/test/runtime-boundaries.test.ts
node --import tsx --test ../agent-server/test/resultPageRuntimeStore.test.ts ../agent-server/test/runtime-boundaries.test.ts
npm run build:export
```

涉及浏览器可见页面时，还必须运行本地 server 并人工或自动检查：

- 公开结果页首屏无内部字段。
- “接下来去哪”导航可用。
- 授权动作说明清楚。
- 校验证明默认折叠。

## 9. 分阶段交付

### Phase 1: 公开叙事止血

目标：防止内部字段继续出现在玩家页面。

交付：

- `publicVocabulary`。
- `PublicResultViewModel`。
- 结果页默认隐藏校验证明。
- 可见文本泄漏测试。
- “接下来去哪”导航。

完成标准：

- 现有公开结果页和安装页可见文本不含禁止词。
- 用户能从结果页跳到继续游玩、档案、世界入口和安装入口。

### Phase 2: 完整局语义

目标：让“一局游戏”变成完整故事历程。

交付：

- `GameRunReadModel`。
- run-level timeline presenter。
- 默认多事件局流程。
- 早退、死亡、失败结局的公开表达。

完成标准：

- “跑一局”不再只生成单回合结果页。
- 结果页展示完整时间线和结局。

### Phase 3: HTTP route 收敛

目标：停止 `httpServer.ts` 继续膨胀。

交付：

- `lib/http/response.ts`
- `lib/http/requestBody.ts`
- `lib/http/resultRoutes.ts`
- `lib/http/identityRoutes.ts`

完成标准：

- 新增结果页和身份授权相关接口不再直接写进 `httpServer.ts`。
- 共享错误响应和 body parsing 有单一实现。

### Phase 4: 前端控制台拆分

目标：降低 `AgentExplorer.tsx` 的继续增长风险。

交付：

- `ResultNavigation`
- `GameRunTimeline`
- `IdentityAuthorizationPanel`
- `PublicReceiptDisclosure`
- 对应 layout tests。

完成标准：

- 新结果/授权/导航 UI 不扩大主容器复杂度。
- 前端不直接展示内部枚举。

### Phase 5: 读模型和持久化硬化

目标：让公开查询和控制台查询不依赖热路径全量扫描。

交付：

- run projection。
- public result projection。
- projection rebuild 测试。
- JSONL/SQLite 兼容策略。

完成标准：

- 公开结果页读取 read model。
- event log 仍可重建 projection。
- 低频审计和热路径查询明确分离。

## 10. 完成定义

本 spec 完成时应满足：

1. 玩家可见页面没有内部枚举、技术 ID 和 debug receipt 泄漏。
2. “一局游戏”在代码和页面里都是 run-level 故事历程。
3. 身份授权只在真正需要 owner 权限时出现，并有清楚解释。
4. 结果页提供明确导航，不把用户困在死页。
5. 新结果页和身份接口进入 route module，不继续扩大 `httpServer.ts`。
6. 新公开叙事逻辑通过 ViewModel/presenter 层输出，不直接拼事件。
7. 新前端 UI 进入组件模块，不继续堆进 `AgentExplorer.tsx`。
8. 所有变更通过 typecheck、server tests、layout tests 和 build export。

## 11. 后续计划入口

本文件是规格，不是逐步 implementation plan。执行前应基于本 spec 生成实施计划，拆成可独立验证的任务：

1. 公开结果页 ViewModel 与泄漏测试。
2. 完整游戏局 run-level 模型。
3. 身份授权与导航。
4. HTTP route module 拆分。
5. 前端控制台组件拆分。
6. 读模型和持久化硬化。

## 12. 当前落地状态

截至 2026-07-06，本 spec 的首轮硬化已经落地：

- 公开结果页改为通过 `PublicResultViewModel` 和 `publicVocabulary` 输出玩家可读文案。
- 公开可见文本测试覆盖 `resource_granted`、`T0_public`、`region_`、`sha256`、`SERVER RECEIPT` 等内部词泄漏。
- 一次性探索结果页展示 run-level “完整探索历程”，包含 8 段历程时间线和后续导航。
- `GameRunReadModel` 已从结果页 payload 投影出来，并进入世界概览最近结果与控制台最近结果卡片。
- 单次 turn 结果页已锁定为 `single_turn` / 1 段，避免被大量 recent events 误判成完整一局。
- `httpServer.ts` 已将结果页 API 和公开结果页路由委托给 `lib/http/resultRoutes.ts`。
- `httpServer.ts` 已将身份签发、恢复码轮换、身份归档、转生和身份查询委托给 `lib/http/identityRoutes.ts`。
- `httpServer.ts` 已将 personality confirm、agent briefing、agent memory、personal migration summary 和 explorer profile API 委托给 `lib/http/agentProfileRoutes.ts`。
- `httpServer.ts` 已将控制台 HTML/static assets 与 Epoch media assets 委托给 `lib/http/assetRoutes.ts`。
- `httpServer.ts` 已将 Streamable MCP endpoint 和 MCP tools proxy 委托给 `lib/http/mcpRoutes.ts`。
- `httpServer.ts` 已将安装页、install manifest/status、host-config 和 package archive 委托给 `lib/http/installRoutes.ts`。
- `httpServer.ts` 已将 public world overview、public agent/profile/archive、hosted session、explorer、region 和 NPC 页面委托给 `lib/http/worldRoutes.ts`。
- `httpServer.ts` 已将 audit API、public audit replay pages、public season archive pages 和 season contribution audit export 委托给 `lib/http/auditRoutes.ts`。
- `httpServer.ts` 已将 moderation、abuse status/profiles/release、operator overview 和 maintenance run 委托给 `lib/http/operatorRoutes.ts`。
- `httpServer.ts` 已将 inventory、shop、market、market risk release 和 direct trade API 委托给 `lib/http/economyRoutes.ts`。
- `httpServer.ts` 已将 season campaign list、seed、contribute 和 settle API 委托给 `lib/http/seasonRoutes.ts`。
- `httpServer.ts` 已将 hosted session、server-hosted jobs、web bridge 和 attestation API 委托给 `lib/http/hostedRoutes.ts`。
- `httpServer.ts` 已将 messages、high-value confirmations、region news、lore contribution/adjudication、events 和 lore query API 委托给 `lib/http/narrativeRoutes.ts`。
- `httpServer.ts` 已将 objectives、resource nodes、anomalies 和 bounties API 委托给 `lib/http/encounterRoutes.ts`。
- `httpServer.ts` 已将 downtime、NPC、agent-NPC bonds、households、organizations、organization politics、social hooks 和 API region info 委托给 `lib/http/societyRoutes.ts`。
- `httpServer.ts` 已将 party runs、raids、region-control revolt、retaliations、diplomacy、relationships 和 turn-card API 委托给 `lib/http/gameplayRoutes.ts`。
- `httpServer.ts` 已将 legacy run submission/archive/heartbeat、context package、public world context、lore/progression/faction/feedback/outbox、world browser/detail、community、experience 和 transparency API 委托给 `lib/http/legacyRoutes.ts`。
- `httpServer.ts` 当前已从首轮记录的 3237 行降到 652 行；业务路由已经基本出清，HTTP 错误映射已委托给 `lib/http/errorResponse.ts`，请求解析/base-url helper 已委托给 `lib/http/request.ts`，响应/CORS helper 已委托给 `lib/http/response.ts`。剩余集中点主要是 server bootstrap、health 和持久化桥接。
- `runtime.ts` 已将 agent memory 三层读模型委托给 `lib/epoch/agentMemoryReadModel.ts`，并将 NPC candidate 筛选和来源事件收集委托给 `lib/epoch/npcCandidateReadModel.ts`。
- `runtime.ts` 已将 personal migration summary 分类/分桶委托给 `lib/epoch/personalMigrationReadModel.ts`，并将 explorer profile 聚合委托给 `lib/epoch/explorerProfileReadModel.ts`。
- `runtime.ts` 已将 audit replay、risk review flags/score、audit event summary 和 audit risk profile 委托给 `lib/epoch/auditReadModel.ts`。
- `runtime.ts` 已将 active/archived/missing 身份行动资格、主动玩法工具清单和推荐工具清单委托给 `lib/epoch/actionEligibilityReadModel.ts`。
- `runtime.ts` 已将 maintenance event summary、worker health、stale 判定和 maintenance overview 委托给 `lib/epoch/maintenanceReadModel.ts`。
- `runtime.ts` 已将 market orders、direct trades、region market summary 和 market risk restriction 列表委托给 `lib/epoch/marketReadModel.ts`。
- `runtime.ts` 已将 region influence leaderboard 评分、可信分层和排序委托给 `lib/epoch/regionLeaderboardReadModel.ts`。
- `runtime.ts` 已将 region activities、influence changes、visible messages 和 active agents 委托给 `lib/epoch/regionActivityReadModel.ts`。
- `runtime.ts` 已将 traces、raids、retaliations、raid heat、raid target recommendations、faction pressure 和 frontlines 委托给 `lib/epoch/regionConflictReadModel.ts`。
- `runtime.ts` 已将 agent relationship、NPC relationship、agent-NPC bond 和 household 的公开媒体绑定、过滤、排序、NPC 名称摘要委托给 `lib/epoch/relationshipReadModel.ts`。
- `runtime.ts` 已将 NPC memory、career、location、asset、health 和 social hook 的过滤、排序、显示名称和摘要投影委托给 `lib/epoch/npcStateReadModel.ts`。
- `runtime.ts` 已将 diplomacy、organization membership/list/politics、organization treasury ledger 和 influence score 投影委托给 `lib/epoch/organizationReadModel.ts`。
- `runtime.ts` 和 `regionCommissionReadModel.ts` 已将 objective、resource-node 和 anomaly 查询投影委托给 `lib/epoch/encounterReadModel.ts`，避免 runtime 与 commission 读模型各自维护一份排序/过滤逻辑。
- `runtime.ts` 和 `regionCommissionReadModel.ts` 已将 bounty/party run 查询投影和 party invite token 公开脱敏委托给 `lib/epoch/bountyPartyReadModel.ts`，避免公开小队列表和 commission 来源视图继续维护两份排序/过滤逻辑。
- `runtime.ts` 和 `regionCommissionReadModel.ts` 已将 region monument 查询投影委托给 `lib/epoch/regionMonumentReadModel.ts`，避免区域页与 commission motif quota 继续维护两份纪念碑排序/过滤逻辑。
- `runtime.ts` 已将 season campaign 查询、赛季媒体装饰、贡献审计 ratio、按日分组和日汇总委托给 `lib/epoch/seasonReadModel.ts`，并将 runtime 的 season list、season archive 和 season command result wrapper 委托给 `lib/epoch/seasonRuntimeReadModel.ts`；写流程只保留命令编排。
- `runtime.ts` 已将 hosted session 列表查询、公开脱敏和观战页 next-action 文案委托给 `lib/epoch/hostedSessionReadModel.ts`，托管动作写流程仍留在 runtime 现有边界。
- `runtime.ts` 已将 Web Bridge action option、prompt layers、copy prompt 和 turn view 投影委托给 `lib/epoch/webBridgeReadModel.ts`，runtime 只保留授权和 hosted session 写入编排。
- `runtime.ts` 已将 region commission、location motif quota、secret exposure tier、chapter reveal budget、prefile isolation 和 motif bias projection 委托给 `lib/epoch/regionCommissionReadModel.ts`。
- `runtime.ts` 已将 operator overview 的 moderation/abuse/growth guardrails/health/attested runner/NPC review/maintenance/audit 聚合委托给 `lib/epoch/operatorOverviewReadModel.ts`。
- `runtime.ts` 已将 identity progress、inventory item media、equipment effects、pending downtime、claimable legend news、personality drift 和 latest events 聚合委托给 `lib/epoch/progressReadModel.ts`。
- `runtime.ts` 已将 server-event region lookup 和 region news headline/body/legend draft projection 委托给 `lib/epoch/regionNewsDraftRules.ts`；该规则模块已开始复用公开词汇表清理 `region_`/`agent_`/`explorer_` 内部 ID。
- `runtime.ts` 已将区域新闻 source-event 查找、区域匹配、已有新闻查重、`core.generateRegionNews` adapter 调用和 append-to-result 写流程委托给 `lib/epoch/regionNewsRuntime.ts`；runtime 只保留命令表 idempotency 和 core adapter 注入。
- `publicWorldPageHtml.ts` 已移除本地第二套公开词表，统一复用 `lib/epoch/publicVocabulary.ts` 输出公开世界、公开身份、公开区域和安装页中的事件、资源、状态、信任、来源、委托公开程度等玩家可读标签；可见文本测试已覆盖 `预算剩余`、`章节锁`、`预档未来钩子` 等实现词泄漏。
- `runtime.ts` 已将 identity archive lineage、资源、归档/转生事件和公开跳转投影委托给 `lib/epoch/identityArchiveReadModel.ts`。
- `runtime.ts` 已将 explorer recovery code 解析、localSecret hash、constant-time signature/hash 比较和 auth credential extraction 委托给 `lib/epoch/runtimeAuth.ts`。
- `runtime.ts` 已将 owner idempotency key、stable subject normalization 和 subject hash 规则委托给 `lib/epoch/idempotencyRules.ts`；runtime 仍保留 idempotency map 状态和写流程调用。
- `runtime.ts` 已将 high-value confirmation subject hash、summary、turn-card response envelope 和 auth scope action 映射委托给 `lib/epoch/highValueConfirmationRules.ts`，并将 request/confirm/list/consume 状态机、事件生成和 initial event hydration 委托给 `lib/epoch/highValueConfirmationRuntime.ts`。
- `runtime.ts` 已将 attested runner 配置、challenge 签发、challenge idempotency/used/expired 状态、signature base/key id/trust class 计算、signature validation 和 submit context 构造委托给 `lib/epoch/attestationRuntime.ts`；runtime 仍只保留跨 owner idempotency 包装和命令编排入口。
- `runtime.ts` 已将 result page share token hash、URL path、share version、TTL、owner lookup、stable payload JSON、public safe summary/public pages、focused progress、publish request hash、create/revoke/delete idempotency key、active/revoked/deleted page record、public access/expiry status 判定和 deletion summary/minimal reference 委托给 `lib/epoch/resultPageRuntimeRules.ts`；runtime 仍保留结果页 payload 装配、发布/撤回/删除流程的 Map 写回和鉴权。
- `runtime.ts` 已将结果页 publish token、share token、页面 idempotency、revoke/delete idempotency、公开访问读取、最近结果读取、owner/operator revocation 授权和删除证明生命周期状态委托给 `lib/epoch/resultPageRuntimeStore.ts`；runtime 只生成 result payload 并调用该 store。
- `runtime.ts` 已将结果页 turn-card/hosted-session focus 校验、区域选择和区域上下文投影委托给 `lib/epoch/resultPageContextRules.ts`；runtime 只注入 payload builder 所需输入和发布入口。
- `runtime.ts` 已将结果页 progress/focus/context/next-action/run-summary/receipt payload 装配委托给 `lib/epoch/resultPagePayloadRules.ts`；runtime 只注入 projection、clock 和 max downtime 配置。
- `runtime.ts` 已将 one-shot 多段探索、托管 session/action 循环、focus event 收集和结果页发布写流程委托给 `lib/epoch/explorationRuntime.ts`；runtime 只注入授权、idempotency、core adapter、public projection 和 result page store。
- `runtime.ts` 已将 result page receipt focus、canonical event projection、trusted execution receipt、play mode 和 trust-tier 判定委托给 `lib/epoch/resultPageReceiptRules.ts`；runtime 仍只在 payload 装配时调用该规则模块。
- `runtime.ts` 已将 anomaly event template catalog、boss media 绑定、template rotation seed、narrative variant selection 和 operator spawn input mapping 委托给 `lib/epoch/anomalyEventTemplateRules.ts`；runtime 仍保留区域别名归一化、operator 鉴权、idempotency 和 core 调用编排。
- `runtime.ts` 已将 generic/user-verified/untrusted-client/maintenance command context 构造委托给 `lib/epoch/runtimeCommandContextRules.ts`；runtime 仍保留调用点选择和少量信任类归一化分支。
- `runtime.ts` 已将 region id 输入归一化、hosted session status 解析、objective/season 模板目录选择和 abuse actor key 选择委托给 `lib/epoch/runtimeInputRules.ts`；runtime 仍保留实际命令编排和状态写入。
- `runtime.ts` 已将公开文本 secret material guard、拒绝命令输入摘要和审计脱敏规则委托给 `lib/epoch/runtimeInputSafetyRules.ts`；runtime 仍只在命令入口和 rejection audit 事件生成点调用这些安全规则。
- `runtime.ts` 已将公开事件脱敏、公开 projection、command result 包装和内部 events 非枚举挂载委托给 `lib/epoch/runtimePublicProjectionRules.ts`；runtime 仍只在命令编排、维护流和子 runtime adapter 中调用这些公开输出边界。
- `runtime.ts` 和 `gameCore.ts` 已将 server-hosted option key 解析、server-hosted command context、job query/list filtering/sorting、queued-job selection 和 job lifecycle payload/event sequence planning 委托给 `lib/epoch/serverHostedRuntimeRules.ts`。
- `runtime.ts` 已将 server-hosted run action、queue action、operator job list、queued job preflight/skip/execute/complete 写流程委托给 `lib/epoch/serverHostedRuntime.ts`；runtime 仍只注入 operator 鉴权、密钥文本扫描、idempotency 和 game-core adapter。
- `runtime.ts` 已将 operator `run_maintenance` 默认值、worker 顺序、资源点/异常/赛季候选筛选、server-hosted job 队列处理、region-control/abuse decay 汇总和维护 summary 组装委托给 `lib/epoch/maintenanceRuntime.ts`；runtime 仍只注入 operator 鉴权、idempotency、clock、public projection 和 game-core adapter。
- `runtime.ts` 已将 downtime set/claim/tick 的 agent_id 解析、owner 授权上下文、region 输入归一化、幂等包装、系统 tick 上下文和受限分数通道委托给 `lib/epoch/downtimeRuntime.ts`；runtime 仍只注入身份读取、owner context、idempotency 和 game-core adapter。
- `runtime.ts` 已将 NPC note、NPC candidate submit 和 operator review 的区域归一化、owner/untrusted/operator context、idempotency、实验主规则复审输入和受限分数审核通道委托给 `lib/epoch/npcCandidateRuntime.ts`；runtime 仍只注入 operator key、身份读取、context builder、idempotency 和 game-core adapter。
- `runtime.ts` 已将 NPC lifecycle record/tick 的信任类校验、changes 输入规整、sourceEventIds 透传、区域/limit 解析、系统 worker tick 上下文和受限分数通道委托给 `lib/epoch/npcLifecycleRuntime.ts`；runtime 仍只注入 command context、idempotency 和 game-core adapter。
- React 控制台的高价值确认面板已经通过 `agentPlayerLabels.ts` 显示动作与状态，未知动作回退为通用玩家语言；turn-card 的 nonce、签名信封和结算签名明细已移入默认折叠的“校验证明/结算校验证明”，避免技术字段挤占玩家主流程。
- React 控制台的恢复码空态、运营总览、组织金库流水、世界设定贡献/状态卡、对抗/复仇摘要和结果页区域冲突上下文已经补齐玩家可读标签；`pending`、`no attestation`、`claim/evidence/sources`、`threat/rank/overlap/weight`、事件 ID 凭证和 `A -> B` 方向箭头不再作为默认可见文案。
- `agentPlayerLabels.ts` 已提供 `playerAgentLabel`、`playerExplorerLabel`、`playerRecordLabel` 和 `playerRelationshipKindLabel`，区域总览、关系/外交、小队、遭遇、组织、赛季、市场、私下交易和结果页上下文已经用短标签替代默认可见的 `agent_...` / `explorer_...` / `region_...` / `event_...` fallback。
- `runtime.ts` 和 `gameCore.ts` 共同复用 `lib/epoch/sourceEventRules.ts` 的 audit page URL、来源权威、低可信来源、lore source provenance、source explorer lookup、risk review source event lookup、source event ID 归一化/存在性校验和 flags/score/reviewable analysis，避免公开来源证据规则在写路径和读路径继续漂移。
- `runtime.ts` 和 `gameCore.ts` 共同复用 `lib/epoch/loreProvenanceRules.ts` 的 stable evidence JSON/hash、lore claim hash、contribution provenance、target adjudication provenance、authority review 和 runtime fallback provenance，避免证据哈希/出处回填规则在读写路径继续重复。
- `runtime.ts` 已将 lore contribution list、target status folding、争议档案 gate、S040 worldview gate、lore adjudication overview 和 world honor board 投影委托给 `lib/epoch/loreReadModel.ts`；`personalMigrationReadModel.ts` 和 `operatorOverviewReadModel.ts` 也改为直接消费该模块类型。
- `runtime.ts` 已将 world overview、agent briefing、hosted session watch、lore contribution/target portal、world context version 和公开入口 limit 聚合委托给 `lib/epoch/publicWorldReadModel.ts`，runtime 只保留公开 API 委托和 result page store 注入。
- `runtime.ts` 已将 region info 与 NPC info 的区域详情、区域媒体、近期新闻、活跃成员、市场/悬赏/小队/冲突、NPC 组织/职业/记忆/家庭/地点/健康/资产/social hook 汇总委托给 `lib/epoch/regionInfoReadModel.ts`，runtime 只保留公开 API 委托。
- `runtime.ts` 已将 organization/NPC 子视图 wrapper 委托给 `lib/epoch/organizationNpcReadModel.ts`，runtime 不再直接 import `npcStateReadModel.ts`，也不再直接调用 organization/NPC/relationship 底层子投影函数。
- `runtime.ts` 已将 objectives、resource nodes 和 anomalies 的 runtime read wrapper 委托给 `lib/epoch/encounterRuntimeReadModel.ts`，runtime 不再直接 import `encounterReadModel.ts` 的底层 query 函数。
- `runtime.ts` 已将 inventory、shop、market 和 direct trades 的 runtime read wrapper 委托给 `lib/epoch/economyRuntimeReadModel.ts`，runtime 不再直接 import `shopReadModel.ts`，也不再直接调用 progress/shop/market 底层经济投影函数。
- `runtime.ts` 已将 season list、season archive 和 season command result wrapper 委托给 `lib/epoch/seasonRuntimeReadModel.ts`，runtime 不再直接 import `seasonReadModel.ts`，也不再直接调用 season 底层投影函数。
- `runtime.ts` 已将 bounties、party runs 和 raids 的 runtime read wrapper 委托给 `lib/epoch/combatRuntimeReadModel.ts`，runtime 不再直接 import `bountyPartyReadModel.ts`，也不再直接调用 bounty/party/raid 底层投影函数。
- `runtime.ts` 已将 relationships 和 diplomacy 的 runtime read wrapper 委托给 `lib/epoch/socialRuntimeReadModel.ts`，runtime 不再直接 import `relationshipReadModel.ts` 或 `organizationReadModel.ts`，也不再直接调用社交底层投影函数。
- `runtime.ts` 已将 events、progress 和 messages 的 runtime read wrapper 委托给 `lib/epoch/activityRuntimeReadModel.ts`，runtime 不再直接 import `progressReadModel.ts` 或 `regionActivityReadModel.ts`，也不再直接调用 activity/progress 底层投影函数。
- `runtime.ts` 已将 hosted session list runtime read wrapper 委托给 `lib/epoch/hostedSessionRuntimeReadModel.ts`，runtime 不再直接调用 `publicHostedSessionsView(core.project())` 或在接口层拼 hosted-session status/limit。
- `runtime.ts` 已将 agent memory、personal migration、identity archive 和 explorer profile runtime read wrapper 委托给 `lib/epoch/identityRuntimeReadModel.ts`，runtime 不再直接 import `agentMemoryReadModel.ts`、`personalMigrationReadModel.ts`、`identityArchiveReadModel.ts` 或 `explorerProfileReadModel.ts`。
- `runtime.ts` 已将 audit、abuse profiles、moderation queue 和 operator overview runtime read wrapper 委托给 `lib/epoch/operatorRuntimeReadModel.ts`，runtime 仍保留 operator key 校验，但不再直接 import `auditReadModel.ts` 或 `operatorOverviewReadModel.ts`。
- `gameCore.ts` 已将 lore contribution category/revision gates、修订字段归一化、贡献 source IDs、来源事件解析/缺失校验、他人 non-evidence 复用拒绝、低权威反驳拒绝、反驳日配额、贡献记录 payload/event sequence、贡献成本和 focus spend payload、target adjudication status/source IDs/source contribution event lookup/history folding/stable key/id link/payload/event sequence、实验主规则复审、revision policy、生物行为范围审查、模糊年份区间、跨区机制支持校验和 canon candidate attribution/path 组装委托给 `lib/epoch/loreContributionRules.ts`；game core 仍保留身份/资源校验、hash/provenance 输入、事件 apply 和 commit 编排。
- `gameCore.ts` 已将 turn-card、turn-resolution 和 hosted-action signed envelope 的 protocol version、stable content hash 和 release signature 构造委托给 `lib/epoch/turnActionEnvelopeRules.ts`；`turnHostedActionRules.ts` 在 payload 规划时复用该模块，game core 不再直接拼签名 envelope。
- `gameCore.ts` 已将 hosted/turn trust guards、turn option templates、hosted action option assembly、高风险次数限制、首局保护、重复基础奖励限制、turn/hosted reward grant payload、turn-card 过期/序号/未过期开放卡唯一性校验，以及 turn-card/turn-resolution/hosted-session/hosted-action payload 与 event sequence、hosted runner attestation payload 规划委托给 `lib/epoch/turnHostedActionRules.ts`；game core 仍保留投影读取、资源余额读取、事件写入和状态推进。
- `gameCore.ts` 已将 identity issue、recovery rotation、lifetime adjustment、identity archive、reincarnation、personality drift proposal/confirmation 的 payload 与 event sequence/result projection 规划，以及 personality drift source-event eligibility、open proposal folding、cooldown folding 和 suggested trait selection 委托给 `lib/epoch/identityLifecycleRules.ts`；game core 仍保留身份归属、slot、转世状态、事件顺序和 commit 编排。
- `gameCore.ts` 已将 identity 节点读取/active 校验/slot 校验、explorer lineage、legend total 和 identity slot 计算委托给 `lib/epoch/identityProjectionRules.ts`，并保留 `identitySlotsForExplorer` / `EpochIdentitySlotState` 兼容导出；写路径身份归属、转世状态、事件顺序和 commit 编排仍留在 game core。
- `gameCore.ts` 已将直接 owner、user-verified owner、server actor owner-bypass、client owner 和 system-worker owner-bypass 校验委托给 `lib/epoch/identityAuthorizationRules.ts`；game core 仍保留各命令的错误码选择和写流程编排。
- `gameCore.ts` 已将 moderation item 节点读取、region news generation event sequence/result projection、message posted event sequence/result projection、text normalization/assessment、moderation queued payload、moderation resolved event sequence/result projection、content status 映射与 message/news moderation status 更新、risk review recorded event sequence/result projection、自动 risk review escalation context/payload、market risk restriction release event sequence/result projection、abuse score release/decay payload 规划、abuse score release/decay event sequence/result projection 和 abuse score decay 目标选择/limit/amount/min-score 委托给 `lib/epoch/moderationRiskRules.ts`，并复用 `sourceEventRules.ts` 的 risk review source lookup/analysis；region news/message 写路径的信任/身份/来源校验、事件 apply 和 commit 编排仍留在 game core。
- `gameCore.ts` 已将停机 region 归一化、停机奖励、reward grant payload、set/claim/tick payload、set/claim/tick event sequence/result projection、停机日记 payload、停机日记 projection、tick target selection/limit、待领取预览和相关风险提示委托给 `lib/epoch/downtimeRules.ts`，并保留兼容导出给既有调用方。
- `gameCore.ts` 已将 inventory item 节点读取、inventory craft recipe、shop offer、item rarity 归一化、区域价格解析、catalog require helper、装备加成规则和 item created/bound payload 规划委托给 `lib/epoch/inventoryRules.ts`，`progressReadModel.ts` 也改为直接消费该规则模块；game core 仍保留身份/来源事件校验、资源扣减、事件顺序和 commit 编排。
- `gameCore.ts` 已将 agent resource balance 读取、资源足额检查、grant/spend payload 生成、grant/spend event sequence/result projection 和多成本 spend payload 规划委托给 `lib/epoch/resourceRules.ts`，制作和商店购买不再在 `gameCore.ts` 内手写临时余额扣减循环。
- `gameCore.ts` 已将 region news 节点读取、region news 传奇领取 payload、legend 资源入账 grant payload/amount/reason 规则，以及 legend claim event sequence/result projection 委托给 `lib/epoch/legendAwardRules.ts`；claim path 仍保留身份归属、新闻来源校验、去重、事件 apply 和 commit 编排。
- `gameCore.ts` 已将组织创建/成员变更 event sequence、组织金库贡献 event sequence、预算提案/投票/决议 event sequence、升级购买 event sequence、组织创建 payload、agent membership payload、组织升级目录、组织金库余额读取、成员角色/状态校验、active agent/explorer 成员查询、agent season upgrade lookup、治理角色判断、成员金库贡献 spend payload、金库贡献 payload、升级金库扣款 payload、升级购买 payload、预算 approval/rejection 阈值、预算 resolution 校验、预算提案/投票/支出/决议 payload 规划、组织政治 tick 目标选择/limit/region filter、参与者/职业/来源证据规划、模板/类型/payload 规划、tick 事件序列规划、tick 结果投影折叠和多签 pending 判断委托给 `lib/epoch/organizationTreasuryRules.ts`；组织相关身份鉴权、余额读取、事件 apply 和 commit 编排仍留在 game core。
- `gameCore.ts` 已将 party run 节点读取/open 校验、retaliation opportunity 节点读取/open 校验、party lifecycle 校验、invite token hash/expiry/use-limit、party run created/invite updated/member joined/join requested/join request resolved event sequence/result projection 与 payload、party role score、party synergy、party member settlement result、party total score、party member reward grant payload、vanguard/scribe bonus、party run settlement event sequence、party run settled/influence/trace/news payload、raid 冷却/衰减窗口、raid pair history lookup、raid regional heat 阈值/分数/projection lookup、raid 胜负/奖励结算、retaliation 胜负/奖励结算、赛季战力加成、raid/retaliation stamina spend 和 reward grant payload、raid resolved payload、raid influence/trace payload、retaliation opportunity payload、retaliation resolved payload、raid/retaliation resolution event sequence/result projection 和 retaliation influence/trace payload 规划委托给 `lib/epoch/combatSettlementRules.ts`；game core 仍保留身份/资源校验、余额读取、事件 apply 和 commit 编排。
- `gameCore.ts` 已将事件 envelope factory 委托给 `lib/epoch/eventFactory.ts`，后续资源 ledger event helper 和战斗事件生成 helper 可以复用同一事件包装入口。
- `gameCore.ts` 已将所有 `resource_spent` / `resource_granted` ledger event 包装委托给 `lib/epoch/resourceLedgerEvents.ts`；`gameCore.ts` 不再直接调用 `makeEvent("resource_*")`。
- `gameCore.ts` 已将所有 `region_influence_changed` / `trace_created` 通用区域事件包装委托给 `lib/epoch/regionEventLedgerEvents.ts`；业务 payload 仍留在具体结算路径，固定 aggregate/agent envelope 逻辑不再散落在主文件。
- `gameCore.ts` 已将 region influence score 累计和 latest trace lookup 委托给 `lib/epoch/regionProjectionRules.ts`；各结算路径仍保留自己的 payload 语义、事件顺序和 commit 编排。
- `gameCore.ts` 已将所有 `item_created` / `item_bound` / `item_transferred` 通用库存物品事件包装委托给 `lib/epoch/inventoryItemLedgerEvents.ts`；制作、商店、市场和直连交易仍保留自己的 payload 语义，悬赏 payload 已进一步委托给 bounty 规则模块。
- `gameCore.ts` 已将 NPC trait/review-resolution 归一化、canonicalized payload、candidate rumor admission、review flag/score/publication policy、ability effect clustering、candidate submitted/reviewed payload 规划，以及 canonicalize/submit/review event sequence 规划委托给 `lib/epoch/npcCandidateRules.ts`；game core 仍保留 candidate 身份/来源校验、事件 apply 和 commit 编排。
- `gameCore.ts` 已将 NPC lifecycle tick limit/region filter/目标排序选择、changes normalization、lifecycle event payload/sourceEventIds、记忆摘要、组织名、迁移区域、household 成员合并/source-event 去重、organization membership 存在性/ID/payload 规划、memory/relationship/household/career/location/asset/health payload 规划、manual lifecycle/memory event sequence、单个 tick 的副作用事件序列规划，以及结果投影折叠委托给 `lib/epoch/npcLifecycleRules.ts`；game core 仍保留 projection 获取、目标选择调用、事件 apply 和 commit 编排。
- `gameCore.ts` 已将关系计分、diplomacy seed、diplomacy proposal/response focus spend payload、diplomacy proposed/responded payload、diplomacy proposal event sequence、diplomacy response event sequence、diplomacy trace payload、accepted diplomacy relationship/trace event sequence、relationship focus spend/updated payload/update event sequence、儿童 NPC 受保护关系、agent-NPC bond focus spend/计分/payload/update event sequence 规划、social hook lifecycle 草案和创建 payload、托管社交钩子计分、已消费社交钩子读取，以及 hosted social hook 触发的 bond/memory/influence payload 与 event sequence 规划委托给 `lib/epoch/agentInteractionRules.ts`；game core 仍保留关系、外交、NPC bond、social hook 去重、事件 apply 和 hosted session 的状态推进。
- `gameCore.ts` 已将命令拒绝错误码到 abuse score delta/reason 的分类策略，以及 command rejected / abuse score changed event sequence/result projection 委托给 `lib/epoch/commandAbuseRules.ts`；game core 仍保留 server trust、时间、事件 factory、apply/commit 编排。
- `gameCore.ts` 已将 objective 节点读取/active 节点校验、objective reward、objective resource score、objective creation/contribution/settlement event sequence/result projection、objective contribution spend payload、objective settlement reward grant payload、objective created/contribution/settlement payload、objective settlement influence/trace payload、anomaly 节点读取/open 节点选择、anomaly spawned payload、anomaly spawn event sequence/result projection、anomaly severity、anomaly reward、anomaly media 输入归一化、anomaly contest/resolution event sequence/result projection、anomaly contest focus spend payload、anomaly resolution reward grant payload、anomaly contest/resolution payload、anomaly resolution influence/trace payload 和 anomaly focus contest 计分委托给 `lib/epoch/encounterRules.ts`；具体 encounter 鉴权、余额/影响/父 trace 读取、去重、事件 apply/commit、寿命扣减和 personality drift 提案仍留在 game core 现有流程。
- `gameCore.ts` 已将 resource-node 节点读取/open 节点选择/最近结算时间投影、stamina 计分、spawn cooldown 剩余时间、装备加成投影、spawn/contest/settlement event sequence/result projection、stamina spend payload、reward grant payload、spawned payload、争夺 payload、结算 payload、结算影响 payload 和结算痕迹 payload 委托给 `lib/epoch/resourceNodeRules.ts`；resource node 的鉴权、余额/影响/父 trace 读取、去重和事件 apply/commit 仍留在 game core。
- `gameCore.ts` 已将 season campaign 节点读取/active 节点校验、season creation/start/objective payload、season contribution spend payload、season contribution 的训练馆/区域控制加分、贡献 payload、区域控制加成来源 region 选择、agent region season standing 查询、trust breakdown 归一化/dominant/trusted score 规则、objective completion payload、season settlement 胜方选择、winner reward grant payload、resolved phase payload、组织分红 grant payload、区域控制/纪念碑 payload、region control decay 目标选择/limit/amount/min-age/min-score、region control decay/release/claim/revolt payload、region control decay/release/claim event sequence/result projection、region revolt resolution event sequence/result projection、revolt stamina spend payload、revolt influence/trace payload、revolt 战力结算和组织分红/声望 payload 规划委托给 `lib/epoch/seasonCampaignRules.ts`；season campaign 的资源余额读取、组织成员筛选、ID 生成和 commit 编排仍留在 game core。
- `gameCore.ts` 已将 market order 节点读取/open 节点校验、market risk restriction guard、market trade fee、seller proceeds、repeat-counterparty 风险、价格异常风险、market expiry tick limit/max-age/目标选择、market-order create/fill/cancel/expiry event sequence/result projection、fill payment payload-pair、goods grant asset selector、锁定/支付/收款/货物发放 ledger payload、物品转移 payload 和资源退还 payload 规划委托给 `lib/epoch/marketTradeRules.ts`；market order 的鉴权、余额读取、库存归属校验、risk review 读取、事件 apply 和 commit 编排仍留在 game core。
- `gameCore.ts` 已将 direct trade 节点读取/open 节点校验、direct trade 资源/物品 asset 转换、asset label、repeat-counterparty 风险、expiry tick limit/max-age/目标选择、create/accept/cancel/expiry event sequence/result projection、created/accepted/cancelled/expired payload、托管锁定/请求资源支付/交付资源 ledger payload、accepted resource asset selector、requested payment payload-pair、双向物品转移 payload 和托管资源 refund payload 规划委托给 `lib/epoch/directTradeRules.ts`；direct trade 的鉴权、余额读取、库存归属校验、risk review 事件写入和 commit 编排仍留在 game core。
- `gameCore.ts` 已将 bounty 节点读取/open 节点校验、create/claim event sequence/result projection、bounty 资源托管 spend payload、created/claimed payload、claim reward payload、区域影响 payload 和 trace payload 规划委托给 `lib/epoch/bountyRules.ts`；bounty 的鉴权、物品归属校验、余额读取、影响/trace ID 输入和 commit 编排仍留在 game core。
- React 控制台结果页区域已拆出 `ResultNavigation`、`GameRunTimeline`、`PublicReceiptDisclosure`，世界总览主面板已拆出 `WorldOverviewPanel`，世界概览最近结果列表已拆出 `WorldOverviewRecentResults`，公共大世界摘要已拆出 `PublicWorldPanel`，资源余额面板已拆出 `ResourcePanel`，背包/装备效果/制作/商店面板已拆出 `InventoryPanel`，公共市场控件已拆出 `MarketPanel`，私下交易表单/列表/审计入口已拆出 `DirectTradePanel`，组织目录/成员/升级/金库/预算/政治显示已拆出 `OrganizationPanel`，区域目标/资源点/异常链行动控件已拆出 `EncounterPanel`，悬赏发布/领取控件已拆出 `BountyPanel`，小队创建/申请/邀请审计/结算控件已拆出 `PartyRunPanel`，袭击/区域起义/反击结算控件已拆出 `RaidRetaliationPanel`，赛季阵营战/贡献/档案/媒体/历史显示控件已拆出 `SeasonPanel`，关系图/外交链控件已拆出 `RelationshipDiplomacyPanel`，大型区域摘要/NPC/媒体/组织外壳已拆出 `RegionOverviewPanel`，低刺激预检、干预条、风险包、server-hosted action queue、turn card、hosted session action、web bridge 和 attestation 控件已拆出 `TurnHostedActionPanel`。
- React 控制台已将事件类型、secret tier、信任层、信道、交付信任、来源类型、常见状态、资源名和资源用途说明收敛到 `agentPlayerLabels.ts`，避免 `eventType`、`T2_local_secret`、`untrusted_client`、`server_hosted` 等内部枚举直接进入玩家/操作员可见 UI；资源面板也将 `focus` 显示为“专注点”，并附带“本局可用的行动注意力，用来推进探索或处理风险”的短说明。`AgentExplorer.layout.test.ts` 已加入源码级 regression guard，防止可见 JSX 重新裸插 `event.eventType`、`sourceEventType`、`trustClass`、Web Bridge trust/channel、`确认 token` / `邀请 token` 和旧 `秘密揭露预算` / `未来钩子` / `社交钩子` 文案，同时防止 `AgentExplorer.tsx` 重新定义本地资源词表。
- 服务端托管行动、NPC 记忆和 activity asset 中的玩家可见 `社交钩子` 文案已改为“人物事件”，内部 `social_hook` 类型名只保留在事件模型和 API 字段中。
- React 控制台已将玩家可见标签/工具目录/公开摘要清理外移到 `agentPlayerLabels.ts`，将动作执行 busy/error/request 状态机外移到 `agentActionController.ts`，将玩家主操作禁用原因投影外移到 `agentPlayerActionReadinessController.ts`，将安装连接 readiness 标签投影外移到 `agentInstallReadinessController.ts`，将进度刷新请求聚合/过期请求防覆盖外移到 `agentProgressController.ts`，并将区域快照提交、fetched messages、resource nodes、anomalies、seasons 和 diplomacy slice 覆盖外移到 `agentRegionController.ts`；资源点、异常、赛季、区域起义、外交和普通区域刷新路径不再各自手写半套区域 state 同步。
- 公开 explorer/profile/archive 页已补上玩家可点的 agent 档案、归档档案和世界入口导航，公开页不再只有 raw source/path 式信息块。
- React app 入口已对 Agent 控制台和 3D 世界场景做 `React.lazy` code-splitting；导出脚本已支持复制 Vite JS chunks，`build:export` 产物拆为 index 213.33 kB、AgentExplorer 245.92 kB、WorldMapScene 555.21 kB，当前不再触发 1000 kB 主 chunk 警告。
- `check:no-js` 已允许 `00_总览/assets/` 下的导出 Vite chunks，同时继续拦截源码目录中的 JS/MJS/CJS/JSX 文件。
- 结果页集合已从 runtime 裸 `Map` 收敛到 `resultPageReadModel`，公开分享页和 world overview 最近结果在重启后读取持久化结果页并保持 token/读模型校验。

已验证：

- `npm run typecheck`
- `node --import tsx --test ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test ../agent-server/test/server.test.ts`
- `node --import tsx --test ../agent-server/test/http-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/gameCore-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "party runs|role synergy|vanguard influence|scribe news|scout intelligence|raid resolution|raid rewards decay|raid repeat|retaliation|server-derived raid|multiplayer party|regional contest contributions|cross-faction season standings" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts`
- `node --import tsx --test --test-name-pattern "agent memory|personality drift|explorer profile dashboard|unified agent briefing" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "agent memory|stratified agent memory" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "explorer profile dashboard|personal migration|migration summary" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "personal migration summary|explorer profile API" src/agent/api.test.ts`
- `node --import tsx --test --test-name-pattern "redacted high-impact Epoch audit|audit can filter market trades|records operator risk review|risk review rejects|market view exposes restrictions|operator overview aggregates" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "progress action eligibility|archived identities|identity profile|personal version migration" src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "agent briefing" ../agent-server/test/server.test.ts src/agent/api.test.ts`
- `node --import tsx --test --test-name-pattern "operator overview aggregates|operator maintenance run|maintenance run processes queued server-hosted jobs" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "market view exposes restrictions|releases operator market risk restrictions|market risk release rejects|regional economy orders|server-calculated market fees|market orders transfer|direct trades escrow|direct trade expiry|same-explorer market self-dealing" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts`
- `node --import tsx --test --test-name-pattern "canonical region leaderboards|regional economy orders|server-derived frontlines|faction-scale pressure|region panel surfaces the server-derived region leaderboard|region panel surfaces regional market summary|region panel surfaces server-derived faction pressure" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "canonical region leaderboards|regional economy orders|server-derived frontlines|owner-authorized party runs through API, region info|requires web-confirmed one-time tokens|region panel surfaces the server-derived region leaderboard|region panel surfaces server-derived frontlines|region panel surfaces server downtime activities|player waiting mode" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "organization membership feeds region frontlines|server-derived frontlines|server-derived raid heat|server-derived raid target recommendations|server-derived faction pressure|faction-scale pressure" ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "static media assets|media assets|server-packaged|asset" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "Streamable MCP|MCP proxy persists|mcp/tools/list|install manifest" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "install page|install manifest|install-status|host-config|package/|host MCP configs" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "public agent, region and NPC|archives ended identities|explorer profile dashboard|public world overview" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "seasonal faction campaigns|redacted high-impact Epoch audit|audit can filter market trades|records operator risk review|risk review rejects" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "abuse score restriction|operator can release an abuse score restriction|operator can inspect global abuse profiles|operator GET routes|operator overview aggregates|operator maintenance run|maintenance run processes queued server-hosted jobs|operator-gated Epoch moderation" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "market view exposes restrictions|releases operator market risk restrictions|market risk release rejects|operator-created inventory items|crafts inventory items|shop purchases|same-explorer market self-dealing|market orders transfer|direct trades escrow|direct trade expiry" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "seasonal faction campaigns|runtime region info exposes faction-scale pressure|operator maintenance run" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "context package and legacy run ticket|archives local reports without runTicket|HTTP submit uses|HTTP submit requires|HTTP submit rejects|candidateClaims|item-use|expired run tickets|run settlement persists|run heartbeat refreshes|legacy run submissions|queues legacy review|outbox dead letters|JSONL records hydrate issued tickets|persistence records mutable ledger|JSONL records hydrate community|versioned public world context contract|renders public world overview" ../agent-server/test/server.test.ts`
- `node --import tsx --test src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "private direct trades|archived identities" src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "party runs" src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "retaliation|region control|archived identities" src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "season|赛季" src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "relationship media|diplomacy|archived identities" src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "region panel|claimable legend|NPC candidate|social relationship media|location motif|archived identities" src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test --test-name-pattern "archived identities|hosted and web bridge|server-hosted action|turn-card|authorship confirmation" src/agent/AgentExplorer.layout.test.ts`
- `node --import tsx --test src/agent/api.test.ts`
- `node --import tsx --test ../agent-server/test/http-boundaries.test.ts ../agent-server/test/runtime-boundaries.test.ts ../agent-server/test/gameCore-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/install-smoke-command.test.ts`
- `node --import tsx --test ../agent-server/test/release-rehearsal-command.test.ts`
- `node --import tsx --test ../agent-server/test/packageArchive.test.ts`
- `node --import tsx --test ../agent-server/test/httpErrorResponse.test.ts ../agent-server/test/no-js-gate.test.ts`
- `node --import tsx --test ../agent-server/test/httpRequestResponse.test.ts ../agent-server/test/httpErrorResponse.test.ts`
- `node --import tsx --test ../agent-server/test/runtimeAuth.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/explorerAuthRuntime.test.ts ../agent-server/test/runtimeAuth.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "HTTP rotates explorer recovery code and revokes the old credential|HTTP Web LLM bridge rejects recovery material in browser-copy text" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "MCP rotates explorer recovery code and revokes the old credential" ../agent-server/test/mcp.test.ts`
- `node --import tsx --test ../agent-server/test/runtimeAbuseRuntime.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "HTTP Epoch routes return 429 when public abuse limits are exceeded|HTTP abuse score restriction blocks new writes after cooldown recovery|HTTP operator can release an abuse score restriction without erasing audit history" ../agent-server/test/server.test.ts`
- `node --import tsx --test --test-name-pattern "MCP Epoch state changes enforce abuse limits without blocking reads or idempotent replay|MCP abuse score restriction blocks new writes after cooldown recovery|MCP operator can release an abuse score restriction without erasing audit history" ../agent-server/test/mcp.test.ts`
- `node --import tsx --test ../agent-server/test/runtimeIdempotencyRuntime.test.ts ../agent-server/test/idempotencyRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "idempotency replay|changed payload|idempotency|web-confirmed one-time|requires explorer recovery authorization" ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test ../agent-server/test/highValueConfirmationRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/highValueConfirmationRuntime.test.ts ../agent-server/test/highValueConfirmationRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/resultPageRuntimeRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/resultPageReceiptRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/runtimePublicProjectionRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/runtimeInputSafetyRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/regionNewsDraftRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/serverHostedRuntimeRules.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/serverHostedRuntime.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/maintenance.test.ts ../agent-server/test/runtime-boundaries.test.ts ../agent-server/test/mcp.test.ts --test-name-pattern "maintenance|server-hosted|operator maintenance run|runtime delegates maintenance"`
- `node --import tsx --test --test-name-pattern "server-hosted|serverHosted|maintenance run processes queued server-hosted|operator overview" ../agent-server/test/maintenance.test.ts ../agent-server/test/mcp.test.ts ../agent-server/test/server.test.ts src/agent/AgentExplorer.layout.test.ts src/agent/api.test.ts`
- `node --import tsx --test ../agent-server/test/turnActionEnvelopeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/turnHostedActionRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/sourceEventRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/loreContributionRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/mcp.test.ts --test-name-pattern "lore contribution|creature behavior|fuzzy time|cross-region|canon candidate|delegates lore contribution"`
- `node --import tsx --test ../agent-server/test/resourceNodeRules.test.ts ../agent-server/test/encounterRules.test.ts ../agent-server/test/commandAbuseRules.test.ts ../agent-server/test/agentInteractionRules.test.ts ../agent-server/test/npcCandidateRules.test.ts ../agent-server/test/loreReadModel.test.ts ../agent-server/test/loreProvenanceRules.test.ts ../agent-server/test/sourceEventRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/runtime-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "canonicalized NPC payloads|event sequences|delegates NPC candidate" ../agent-server/test/npcCandidateRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts`
- `node --import tsx --test ../agent-server/test/seasonCampaignRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test ../agent-server/test/marketTradeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test ../agent-server/test/directTradeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test ../agent-server/test/bountyRules.test.ts ../agent-server/test/directTradeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test ../agent-server/test/organizationTreasuryRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts ../agent-server/test/epoch-game-core.test.ts`
- `node --import tsx --test --test-name-pattern "downtime rules plan set payloads|game core delegates downtime" ../agent-server/test/downtimeRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "legend award rules|game core delegates legend" ../agent-server/test/legendAwardRules.test.ts ../agent-server/test/gameCore-boundaries.test.ts`
- `node --import tsx --test --test-name-pattern "region news mention lets the mentioned agent claim legend once|news legend claims reject|HTTP Epoch routes persist canonical events and hydrate progress|MCP Epoch tools expose server-issued identity, downtime, NPC and event progress|Agent console surfaces server-derived claimable legend news" ../agent-server/test/epoch-game-core.test.ts ../agent-server/test/server.test.ts ../agent-server/test/mcp.test.ts src/agent/AgentExplorer.layout.test.ts`
- `AGENT_INSTALL_SMOKE_SEED=test_install_smoke npm run agent:install-smoke -- --json`
- `npm test`
- `npm run build:export`
- 临时 server + in-app browser 桌面和 545px 窄屏检查：结果页可见、无内部英文枚举、无横向溢出。

仍未完成：

- `gameCore.ts` 和 `runtime.ts` 仍是最大风险模块；`runtime.ts` 已开始移出读模型 helper、身份归档读模型、恢复凭据 helper、command context builders、runtime input normalization/template choice/abuse actor key、公开文本 secret guard/拒绝命令审计摘要、公开事件/projection/command result 包装、idempotency subject/key 规则、高价值确认规则 helper 和状态机、attested runner challenge/signature 状态、结果页 runtime/payload helper rules、结果页 publish/revoke/delete 生命周期状态、结果页 payload builder、one-shot exploration runtime、结果页 receipt/trust-tier rules、结果页导航/focus 校验/区域选择/区域上下文投影 rules、shop/region/region news/region news draft/relationship/NPC state/organization/diplomacy/encounter/bounty/party/season/hosted session/Web Bridge/region commission media and summary projection、anomaly event template/boss media/rotation/operator input rules、server-hosted job helper rules、server-hosted run/queue/job 写流程、maintenance run orchestration、downtime set/claim/tick runtime 写流程、NPC candidate runtime 写流程和 NPC lifecycle runtime 写流程、来源事件权威/provenance helper、lore provenance fallback/evidence hash helper 和 lore target/worldview/honor board read model，`gameCore.ts` 已开始移出 identity projection reads、identity owner authorization guards、身份生命周期/recovery/lifetime/archive/reincarnation/personality drift payload、recovery rotation/identity archive event sequence/result projection、source-event eligibility/open proposal/cooldown/trait selection planning、communication moderation item projection reads、communication moderation/text normalization/assessment/content status update/risk payload/auto escalation planning, moderation resolved event sequence/result projection, risk review recorded event sequence/result projection, market risk release event sequence/result projection, abuse release/decay event sequence/result projection, and abuse decay target selection/limit/amount/min-score rules、停机 region 归一化、奖励/reward grant、set/claim/tick payload、日记 payload/日记 projection and tick target selection/limit、库存物品 projection reads、库存/商店目录、inventory item create/craft/shop/bind event sequence/result projection 和 item created/bound payload planning、资源余额浅拷贝和多成本 spend payload 规划、region news projection reads、region news generation event sequence/result projection、message posted event sequence/result projection、legend award payload/resource grant/ledger reason and claim event sequence/result projection rules、组织创建/成员 event sequence 与 payload、金库贡献 event sequence、预算提案/投票/决议 event sequence、升级购买 event sequence、金库/预算/升级 payload、成员金库贡献 spend payload、组织政治 target selection/limit/filter、参与者/职业/来源证据 planning、模板/payload planning、tick 事件序列/result projection 和多签规则、party run/retaliation opportunity projection reads、party lifecycle validation/invite/event sequence/result projection/payload planning、party/raid/retaliation 纯计算、party member settlement/total-score/reward grant planning、party settlement event sequence/influence/trace/news payload planning、raid/retaliation stamina spend/reward grant payload planning、raid/retaliation influence/trace payload planning 和 raid/retaliation payload planning、事件 envelope factory、资源 ledger event、区域 trace/influence event、region activity 类型/写入 helper、库存物品 event 包装、turn/hosted action signed envelope 规则、turn/hosted action policy/payload planning、turn/hosted reward grant payload planning、turn-card 过期/序号/未过期开放卡唯一性规则、turn-card/turn-resolution/hosted-session/hosted-action event sequence planning 和 hosted runner attestation payload planning、server-hosted job lifecycle payload and event sequence planning、来源事件 ID 归一化/存在性校验与风险评审 source lookup/analysis 规则、lore provenance/evidence 规则、lore contribution validation/revision/source IDs/source event lookup/non-evidence reuse/refutation quota/low-authority refutation gate/record payload/cost spend and target adjudication status/source ids/source contribution event lookup/history folding/stable key/payload/event sequence/id link/canon candidate rules、NPC trait/review-resolution 归一化、canonicalized/candidate review/rumor/ability clustering and submit/review payload rules、NPC lifecycle target selection/limit/filter、changes normalization/summary/payload/sourceEventIds/household/organization membership rules、agent interaction and diplomacy/relationship/agent-NPC focus spend/accepted diplomacy relationship/trace event sequence/diplomacy trace/social hook lifecycle/hosted social hook side-effect event sequence rules、command rejected / abuse score changed event sequence/result projection、server trust guard 复用、encounter objective/anomaly projection reads plus objective creation/contribution/settlement and anomaly spawn/contest/resolution event sequence/result projection and objective/anomaly spend/reward grant and created/scoring/payload planning rules、resource-node spawn/scoring/cooldown and spawn/contest/settlement event sequence/result projection plus stamina spend/reward grant/payload planning rules、season projection reads plus creation/contribution/settlement event sequence/result projection, creation/start/objective/contribution spend/reward grant/dividend grant payload planning、season contribution trust breakdown/dominant/trusted score rules、season settlement/control/revolt stamina spend/influence and trace payload planning rules, region control decay/release/claim event sequence/result projection rules, region revolt resolution event sequence/result projection rules plus region-control decay target selection/limit/amount/min-age/min-score rules、market order projection reads plus region normalization, create/fill/cancel/expiry event sequence/result projection, fill payment-pair/goods asset and expiry/lifecycle/ledger/risk/refund payload planning rules、direct trade create/accept/cancel/expiry event sequence/result projection plus accepted resource asset/payment-pair/goods asset and expiry/lifecycle/ledger/risk/refund payload planning rules，以及 bounty create/claim event sequence/result projection plus fulfillment item transfer/influence/trace payload planning rules、party run create/invite update/member join/join request/resolve event sequence/result projection rules、raid/retaliation resolution event sequence/result projection rules，但还需要继续按其他领域事件 payload 组装、剩余复杂资源结算 payload 规划和前端大组件等领域拆分。
- Region news write flow 已移出 `runtime.ts` 并由 `regionNewsRuntime.test.ts` 与 runtime 边界测试保护；剩余 runtime 风险继续集中在其他写流程/状态编排，而不是这条新闻生成链。
- Explorer auth secret-hash state、identity-issued/recovery-rotated hydration、recovery rotation replay 已移出 `runtime.ts` 并由 `explorerAuthRuntime.test.ts`、HTTP/MCP recovery rotation 用例和 runtime 边界测试保护；剩余 runtime 身份风险主要在更高层命令编排，而不是凭据状态本身。
- Abuse rate-limit bucket、restricted-score gate 和 abuse status projection 已移出 `runtime.ts` 并由 `runtimeAbuseRuntime.test.ts`、HTTP/MCP abuse 用例和 runtime 边界测试保护；剩余 runtime 风险继续集中在 idempotency 与业务写流程编排。
- Idempotency result map、owner/subject conflict record、duplicate replay 和 auth-after-idempotency sequencing 已移出 `runtime.ts` 并由 `runtimeIdempotencyRuntime.test.ts`、idempotency rules、HTTP/MCP replay/conflict/one-time-token 用例和 runtime 边界测试保护；剩余 runtime 风险继续集中在业务写流程编排。
- Downtime set/claim/tick runtime 包装已移出 `runtime.ts` 并由 downtime 规则/HTTP/MCP targeted 测试与 runtime 边界测试保护；剩余 runtime 风险继续集中在其他业务写流程和状态编排。
- NPC note/candidate submit/operator review runtime 包装已移出 `runtime.ts` 并由 NPC candidate 规则/HTTP/MCP targeted 测试与 runtime 边界测试保护；剩余 NPC runtime 风险主要在 lifecycle worker 和其他社交/组织写流程编排。
- NPC lifecycle 目标选择/limit/region filter、changes normalization、lifecycle payload/sourceEventIds 规划、household 合并规则、组织成员存在性/ID/payload 规划、tick 副作用事件序列和结果投影折叠已移出 `gameCore.ts`，runtime record/tick 包装已移出 `runtime.ts`，并由边界测试、targeted HTTP/MCP/core 测试与 planner/result projector 单测保护；剩余风险集中在 game core 的 projection 获取、事件 apply 和 commit 编排。
- `AgentExplorer.tsx` 仍然偏大，但结果页、世界总览、公共大世界摘要、资源余额、背包/商店、公共市场、私下交易、组织控制、遭遇行动、悬赏、小队、对抗/反击、赛季、关系/外交、大型区域摘要和回合/托管动作十六块已经移出主容器；玩家可见标签/工具目录、动作状态机、玩家主操作禁用原因、安装连接 readiness、进度刷新请求聚合、完整区域快照提交和局部区域 slice 覆盖也已移出到 helper/controller。剩余前端风险主要是跨域 action/form state/effect 仍集中在容器内，后续应继续抽出 controller hooks 或域级 state 模块。
- run projection 已覆盖结果页、世界概览和控制台最近结果，但还不是所有玩法查询的 canonical run projection。
- JSONL 的结果页/run read model 重启恢复已有测试；SQLite projection rebuild 仍需单独形成更细的恢复演练测试。
- 身份授权 UX 已在结果页导航中降噪，身份路由、agent profile/briefing 路由、资产路由、MCP 路由、安装发布路由、公开世界页路由、audit/season archive 路由、operator control-plane 路由、economy 路由、season campaign API 路由、hosted/narrative/encounter/society/gameplay 路由和 legacy runtime 路由也已拆出；HTTP 错误映射、请求解析/base-url helper 和响应/CORS helper 已移出中心 server，剩余 HTTP 风险主要是 health/bootstrap 和持久化桥接仍在中心 server 内。
