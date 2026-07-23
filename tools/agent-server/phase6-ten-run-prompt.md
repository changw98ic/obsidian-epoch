# Phase 6: 连续十局数值验收协议

本文件是《黑曜纪元》Phase 6 数值闭环验收的操作手册。你作为玩家代理，通过 `obsidian-epoch-agent-world` MCP 工具完成十局正式对局。所有数据由服务端权威生成，你只负责按流程调用工具。

## 基本规则

- 全程只注册一次探索者，十局复用同一 `explorerRef` 与同一实验。身份归档后通过 `reincarnate` 签发下一世。
- 实验只创建一次，目标局数 10，按 `runIndex` 1→10 顺序完成。
- `player_panel` 每局调用 2 次（开局前 + 结算后），共 20 次。
- 凡工具 schema 提供 `recoveryCode` 字段，按 schema 原样传入即可。
- 所有版本号、绑定、结算、RunReceipt、结果页均由服务端生成，直接接受。
- 游玩循环使用 `propose_journey_step_compact`、`commit_journey_action_compact`、`journey_status_compact`。
- 每回合只发一个工具调用，等返回后再发下一个。
- 版本冲突时先用 `journey_status_compact` 刷新，再重试。
- 资源不足时选择免费或低成本行动。
- 完成后只输出一句"十局 MCP 执行完成"。

## 初始化

1. 调用 `register_explorer`，保存返回的探索者、身份和凭据。
2. 调用 `begin_phase6_experiment`，目标局数 10，保存 `experimentId`。

## 场景矩阵

每局按下表传入对应的 `taskType` 和 `scenarioTag`：

| runIndex | scenarioTag | taskType |
| --- | --- | --- |
| 1 | `low-prepared-resource` | `resource_acquisition` |
| 2 | `low-underprepared-information` | `information_acquisition` |
| 3 | `medium-prepared-structured` | `structured_challenge` |
| 4 | `medium-borderline-companion` | `companion_support` |
| 5 | `medium-mismatched-preserve` | `resource_preservation` |
| 6 | `high-prepared-priority` | `priority_commission` |
| 7 | `high-underprepared-crisis` | `crisis_retreat` |
| 8 | `medium-prepared-cultivation` | `cultivation_material` |
| 9 | `medium-specialist-crafting` | `crafting_material` |
| 10 | `dynamic-mixed-repeat` | `repeated_route_audit` |

按工具 schema 中的实际名称调用，命名可能有等价变体。

## 每局流程

对 `runIndex = 1..10` 逐局执行：

1. `prepare_journey` — 传入当前行的 `taskType`。
2. `begin_phase6_run` — 传入 `experimentId`（服务端自动推断 runIndex、scenarioTag、journeyId）。
3. `player_panel` — 开局前面板。
4. `start_journey_compact` — 把 `begin_phase6_run` 返回的 `startJourneyBinding` 原样传入，`decisionMode = "agent_native"`，`taskGenerationMode = "server_fallback"`。
5. 游玩循环：
   - `journey_status_compact` → `propose_journey_step_compact` → `commit_journey_action_compact`
   - 版本冲突时先刷新状态再重试。
   - 重复直到服务端返回 settled/complete（通常 4-8 次行动）。
6. 结算后调用一次 `journey_status_compact` 确认 `phase6Settlement.ok = true`。
7. `phase6_experiment_status` — 确认 run 已记录。
8. `run_receipt_compact` — 读取本局权威回执。
9. `phase6_result_compact` — 读取本局结果页。
10. `player_panel` — 结算后面板。
11. 若身份已归档且有下一局：检查 `nextAgentId`，必要时调用 `reincarnate`。
12. 全部成功后进入下一 `runIndex`。

十局结束后调用 `phase6_experiment_status` 确认 1..10 全部完成。

现在开始执行：先调用 `register_explorer`，然后按流程完成十局。
