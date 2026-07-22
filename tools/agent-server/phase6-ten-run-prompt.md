# Phase 6: cde-glm 真实连续十局任务

以上标题以下的全部内容就是当前用户要求你立即执行的实际任务，不是背景资料、参考协议或待确认方案。你必须马上调用 MCP 开始，不要询问用户，不要运行本地 harness，不要解释计划。

你是《黑曜纪元》Phase 6 的真实玩家代理。只使用 `obsidian-epoch-agent-world` MCP 工具完成正式对局；禁止使用 Shell、文件工具、浏览器、旧版接口、模拟数据或自行编造结果。

## 不可违反的约束

- 全程只注册一次探索者，并在十局中复用同一个 `explorerRef` 与同一个实验。`identityRef` 表示当前在世身份；若服务端正式归档身份，只能通过 `reincarnate` 签发同一探索者谱系的下一世并更新当前 `identityRef`，禁止重新注册探索者或创建第二个实验。
- 实验开始工具只调用一次，目标局数必须是 10；随后严格完成 `runIndex` 1 到 10，不能跳号、重复或提前结束。
- `player_panel` 必须恰好调用 20 次：每局服务端签发 `begin_phase6_run` 后读一次前面板，正式结果页返回后读一次后面板。不得跨局复用一次读取，不得少读或多读。
- 注册返回的恢复凭据只可在需要认证的 MCP 入参中使用；禁止在对话、总结或其他字段中输出、复述或解释任何密钥、恢复码、令牌、Cookie、环境变量。
- 将恢复凭据作为 MCP 认证入参不属于“输出凭据”。凡工具 schema 提供 `recoveryCode` 或等价认证字段，都必须原样传入；尤其 `player_panel` 不得省略该字段，也不得添加 schema 未声明的 `explorerId`、`regionId` 等字段。
- 在发起每一次 `prepare_journey`、`start_journey_compact`、`journey_status_compact`、`propose_journey_step_compact`、`commit_journey_action_compact`、`player_panel` 与 `progress` 前，都先检查并携带注册时得到的同一份 `recoveryCode`（以各工具实际 schema 为准）；禁止先试探性省略再重试。任何 `explorer_auth_required` 都会使整份十局候选无效。
- 只接受服务端生成的版本号、绑定、结算、RunReceipt、结果页、RAG 与世界演进数据。不得传入自定义结算、评分、结果页、RAG、收据、奖励或元数据覆盖。
- 游玩循环必须使用外部代理专用的 `propose_journey_step_compact`、`commit_journey_action_compact`、`journey_status_compact`；禁止调用对应的非 compact 大响应工具。
- 全程严格串行调用 MCP：每个 assistant 回合只能发出一个 `tool_use`，必须等到该工具的 `tool_result` 返回并完成检查后，下一回合才能调用下一个工具。禁止在同一回合批量或并行调用读取、提案、提交、状态、receipt、结果页中的任意两个工具。
- 每个改变旅程状态的调用只能提交一次；不得根据尚未返回的结果预测新版本，不得提前发出下一次提交。若工具返回错误，先停止当前动作链并按下述恢复规则刷新状态，禁止盲重试同一 mutation。
- 不调用旧版世界知识/RAG 注入接口。无检索命中时接受服务端合法的 `no_retrieval` 路径。
- 不调用 `world_knowledge` 或 `world_memory` 来伪造 RAG 面板；RAG 证据只从正式结算、RunReceipt 与 Phase 6 结果页读取。
- 版本冲突时必须重新读取带认证的 compact 状态后修正；除此之外不要制造任何工具错误。若意外报错仍应修正继续，但不得把带错误的执行宣称为有效十局候选。
- 资源不足时选择合法的免费或低成本行动，不得绕过资源约束。
- 最终只输出一句“十局 MCP 执行完成”，不得输出任何业务详情或凭据。证据由流式工具记录自动采集。

## 初始化一次

1. 调用注册探索者工具，保存返回的探索者、身份和恢复凭据。
2. 调用 Phase 6 实验开始工具创建同一身份下的十局实验，令目标局数为 10，保存服务端返回的 `experimentId`。
3. 初始化完成后不得再次注册、不得创建第二个实验。合法轮回不属于再次注册。

## 服务端权威场景矩阵

每局的 `prepare_journey.taskType` 与 `begin_phase6_run.scenarioTag` 必须严格使用下表，不得自行改名、交换或复用：

| runIndex | scenarioTag | taskType | 预期强度/准备度 |
| --- | --- | --- | --- |
| 1 | `low-prepared-resource` | `resource_acquisition` | 低/充足 |
| 2 | `low-underprepared-information` | `information_acquisition` | 低/不足 |
| 3 | `medium-prepared-tactical` | `tactical_objective` | 中/充足 |
| 4 | `medium-borderline-escort` | `escort_and_protection` | 中/临界 |
| 5 | `medium-mismatched-preserve` | `resource_preservation` | 中/错配 |
| 6 | `high-prepared-high-value` | `high_value_objective` | 高/充足 |
| 7 | `high-underprepared-evacuation` | `survival_evacuation` | 高/不足 |
| 8 | `medium-prepared-cultivation` | `cultivation_material` | 中/修行材料 |
| 9 | `medium-specialist-crafting` | `crafting_material` | 中/制造材料 |
| 10 | `dynamic-mixed-repeat` | `repeated_route_audit` | 动态/重复路线审计 |

使用 MCP 实际广告的工具名和 schema。当前服务可能把下列概念暴露为等价命名，例如 `begin_phase6_experiment` 而不是 `phase6_experiment_begin`、`begin_phase6_run` 而不是 `phase6_run_begin`；必须按工具 schema 选择真实名称，不要因为命名差异停下。

## 每局固定流程

对 `runIndex = 1..10` 逐局执行以下完整流程，上一局全部完成后才能开始下一局：

1. 调用 `prepare_journey`，传入当前行的精确 `taskType`，复用相同探索者与当前在世身份。
2. 调用 `begin_phase6_run`，传入同一 `experimentId`、当前 `runIndex` 和当前行的精确 `scenarioTag`。保存服务端返回的绑定。
3. 只调用一次 `player_panel` 获取本局开始前五类完整面板：角色/战力、资源/仓库、成长/修行、技能/天赋、RAG/世界演进。必须按 schema 传入注册返回的准确 `agentId` 和恢复凭据；不得用 `progress` 或其他读取代替。
4. 调用 `start_journey_compact`。把 `begin_phase6_run` 返回值顶层的整个 `startJourneyBinding` 对象原样赋给同名入参，不得手工挑选、展开、删除、补写或重建字段；该对象必须保留其中的 `identity`、`explorer`、`scenarioMatrix`、`versions`、`runReceipt` 五个嵌套对象。严格使用该返回值的 `expectedVersion`，并明确传入 `decisionMode = "agent_native"`、`taskGenerationMode = "server_fallback"`；不得调用大载荷 `start_journey`，不要添加自定义 metadata 或任何权威字段覆盖。
5. 循环真实游玩：
   - 用 `journey_status_compact` 读取当前版本、合法状态与候选信息。
   - 用 `propose_journey_step_compact` 提出符合当前状态和资源的服务器签名行动。
   - 用 `commit_journey_action_compact` 按最新服务端版本提交。
   - 若出现版本冲突，下一回合只调用一次 `journey_status_compact` 刷新状态与版本；收到结果后才可重新提案或提交，禁止立即重复提交。
   - 直到服务端明确返回 settled/complete。通常需 4 到 8 次行动，最多允许 20 次；未结算不得进入下一步。
6. 结算后在一个独立 assistant 回合只调用一次 `journey_status_compact`，然后停止调用并等待它的 `tool_result`，以确保服务端完成最终结算与持久化。绝对禁止在这个状态调用所在回合同时调用 `phase6_experiment_status`、`run_receipt_compact` 或 `phase6_result_compact`。只有收到状态结果且同时满足 `phase6Settlement.ok = true`、`phase6Settlement.status = "settled"`、返回非空 `receiptId` 与非空 `pageId` 时，后续回合才可逐个读取结果；若任一条件不满足，不得使用 begin-run 中的预分配引用冒充结算产物，也不得进入下一局。
7. 调用 `phase6_experiment_status`，确认当前 run 已记录。
8. 在新的独立回合只调用 `run_receipt_compact` 获取当前局唯一服务端权威 `journey_run_receipt.v2` 的已验证有界投影；收到并验证结果前不得发出下一工具调用，不得调用大载荷 `run_receipt`。
9. 在再下一个独立回合只调用 `phase6_result_compact` 获取当前局正式结果页的已验证有界投影；收到并验证结果前不得发出下一工具调用，不得调用大载荷 `phase6_result`。
10. 只再调用一次 `player_panel` 获取本局结束后的同样五类完整面板。真实数值可以变化，也可以不变；禁止为了过验收强制增加属性、技能、天赋或修行经验。无变化时必须接受并保留服务端给出的稳定原因。
11. 检查本局后置面板的 `panel.identity`。若 `status = active` 且 `canStartJourney = true`，不得调用轮回工具；若 `status = archived` 且尚有下一局，先检查 `nextAgentId`：已有非空 `nextAgentId` 时直接把它设为下一局当前身份，不得重复签发；仅当 `reincarnationRequired = true` 且没有 `nextAgentId` 时，在独立回合调用一次 `reincarnate`，传入当前身份作为 `previousAgentId`、同一份 `recoveryCode`、唯一幂等键 `phase6-reincarnate-after-run-{runIndex}`，保存服务端返回的新 `agentId`。禁止调用 `identity` 或 `register_explorer` 代替轮回，禁止继续使用已归档身份发起下一局。
12. 只有当当前局状态、RunReceipt、结果页、后置面板以及必要时的轮回签发都成功后，才进入下一 `runIndex`。身份永久损失是合法 Roguelike 结果，必须保留在本局评分、面板差异和世界事件中，不得回滚、隐藏或把原身份复活。

十局结束后再调用一次 `phase6_experiment_status`，确认实验包含 1..10 全部已完成 run，随后结束。

现在立即执行。你的下一步必须是调用注册探索者 MCP 工具，然后持续调用 MCP，直到十局全部完成。
