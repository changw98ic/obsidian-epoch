# 《黑曜纪元》无限世界 Phase 0：事件基础测试规范 v0.1

状态：Draft

日期：2026-07-20

目标：证明 Phase 0 的事件写入边界在重复请求、并发、进程崩溃、旧数据、非法资源变化和版本漂移下仍保持唯一、可追溯、可重放。

## 1. 测试原则

1. 测试证明 canonical facts，不以 UI 文案或临时投影作为唯一断言。
2. 不修改旧 fixture 或 fake responder 来掩盖 production 行为差异。
3. 同一确定性输入必须比较完整 event hash，而不只比较部分字段。
4. fault injection 必须覆盖 append 前、append 中、append 后和 projection 中四个断点。
5. legacy 测试只验证兼容读取，不要求凭空补齐历史因果。
6. 所有随机化测试使用固定 seed，失败样本必须可复现。
7. Phase 0 不以 LLM 在线响应作为测试前提。

## 2. 测试层级

| 层级 | 目标 |
|---|---|
| Unit | canonical JSON、hash、schema、validator、资源和产权纯函数 |
| Contract | CommandIntent、Event、Effect、Result Manifest 的稳定输入输出 |
| Integration | coordinator、persistence、idempotency、projection 与 legacy adapter |
| Replay | 从相同事件恢复相同投影和 hash |
| Fault injection | 写入和投影各阶段崩溃时不产生双重事实 |
| Property | 大量合法/非法资源账本、因果图和重试序列 |
| Performance | validator 和 replay 不成为明显瓶颈 |

## 3. 阻断级别

| 级别 | 含义 |
|---|---|
| P0 | 失败即禁止启用任何 `block` writer |
| P1 | 失败即禁止迁移对应事件族 |
| P2 | 可进入 observe，但必须登记风险 |

## 4. Schema 与序列化

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `SCHEMA-001` | P0 | 合法最小事件 | validator 通过，hash 可生成 |
| `SCHEMA-002` | P0 | event type 未注册 | `CAUSAL_SCHEMA_UNKNOWN` |
| `SCHEMA-003` | P0 | 缺 command ID | `CAUSAL_SCHEMA_INVALID` |
| `SCHEMA-004` | P0 | stream version 为 0 或负数 | 拒绝 |
| `SCHEMA-005` | P0 | effect type 不在事件允许列表 | 拒绝 |
| `SCHEMA-006` | P0 | payload 含 `NaN`、无穷值或函数 | 拒绝 |
| `SCHEMA-007` | P0 | 同对象不同 key 插入顺序 | canonical JSON 与 hash 相同 |
| `SCHEMA-008` | P0 | 数组顺序变化 | hash 不同 |
| `SCHEMA-009` | P0 | 修改 payload 后复用旧 event hash | `DETERMINISM_PROOF_FAILED` |
| `SCHEMA-010` | P1 | registry hash 不存在 | `REGISTRY_VERSION_UNAVAILABLE` |
| `SCHEMA-011` | P1 | event 使用 retired schema 写新事件 | 拒绝，旧事件仍可 replay |
| `SCHEMA-012` | P1 | UTF-8 中文字段跨平台序列化 | hash 相同 |

## 5. 因果图

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `CAUSE-001` | P0 | 普通事件引用存在父事件 | 通过 |
| `CAUSE-002` | P0 | 普通事件无父事件 | `CAUSAL_PARENT_MISSING` |
| `CAUSE-003` | P0 | effect 无 source event | `ORPHAN_EFFECT` |
| `CAUSE-004` | P0 | event 引用自身 | `CAUSAL_CYCLE_DETECTED` |
| `CAUSE-005` | P0 | A 引用 B，B 已间接引用 A | `CAUSAL_CYCLE_DETECTED` |
| `CAUSE-006` | P0 | 引用尚不存在的未来 event ID | 拒绝 |
| `CAUSE-007` | P0 | 非白名单事件声明 root reason | `ROOT_REASON_DENIED` |
| `CAUSE-008` | P0 | 合法 world genesis 无父事件 | 通过 |
| `CAUSE-009` | P0 | pressure-derived event 无 root pressure | `ROOT_PRESSURE_REQUIRED` |
| `CAUSE-010` | P1 | 跨 world event 作为直接父项 | 拒绝，但可作为 evidence |
| `CAUSE-011` | P1 | 新事件引用 legacy attributed event | 通过 |
| `CAUSE-012` | P1 | 新事件只引用 legacy unattributed event 且无补充 evidence | 拒绝或 warning，取决于 registry |
| `CAUSE-013` | P1 | compensation 引用原事件 | 原事件保留，当前投影应用补偿 |
| `CAUSE-014` | P1 | 时间 forecast 被作为已发生父事实 | 拒绝 |

## 6. 幂等

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `IDEMP-001` | P0 | 首次合法命令 | 追加一次事件并返回 manifest |
| `IDEMP-002` | P0 | 同 key、同 input hash 重试 | 不追加事件，返回原 manifest |
| `IDEMP-003` | P0 | 同 key、不同 input hash | `IDEMPOTENCY_CONFLICT` |
| `IDEMP-004` | P0 | append 成功后响应丢失再重试 | 只存在一条事件 |
| `IDEMP-005` | P0 | append 前崩溃再重试 | 成功追加一次 |
| `IDEMP-006` | P0 | projection 前崩溃再重试 | 不追加，返回 committed + pending |
| `IDEMP-007` | P0 | 两个并发请求使用同 key 和输入 | 一个执行，两个返回同 manifest |
| `IDEMP-008` | P0 | 两个并发请求使用同 key 不同输入 | 一个可提交，另一个冲突 |
| `IDEMP-009` | P1 | 不同 actor 使用相同 key | scope 不冲突 |
| `IDEMP-010` | P1 | 不同 world 使用相同 key | scope 不冲突 |
| `IDEMP-011` | P1 | 后台同 due minute 重复调度 | 只提交一次 |
| `IDEMP-012` | P1 | 历史分区后重试旧 key | 仍返回原 manifest 摘要 |

## 7. Stream 并发

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `STREAM-001` | P0 | expected version 等于当前版本 | 通过并递增 1 |
| `STREAM-002` | P0 | expected version 落后 | `STREAM_VERSION_CONFLICT` |
| `STREAM-003` | P0 | 两命令同时写同 stream version | 仅一个成功 |
| `STREAM-004` | P0 | 事件世界时间早于 stream 上一事件 | 拒绝 |
| `STREAM-005` | P1 | 不同 stream 并发写入 | 均可成功，顺序可确定 |
| `STREAM-006` | P1 | 冲突后使用相同 key 原样重试 | 不得偷偷换状态执行 |

## 8. 可替代资源

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `RESOURCE-001` | P0 | A -100，B +100 | 守恒通过 |
| `RESOURCE-002` | P0 | A -100，B +99，无 sink | `RESOURCE_UNBALANCED` |
| `RESOURCE-003` | P0 | 无 source 凭空 +1 | `RESOURCE_SOURCE_DENIED` |
| `RESOURCE-004` | P0 | 授权生产来源 +10 | 通过并保留 source evidence |
| `RESOURCE-005` | P0 | 未授权资源使用铸币 source | 拒绝 |
| `RESOURCE-006` | P0 | 消费 -5 且合法 sink | 通过 |
| `RESOURCE-007` | P0 | 扣减后余额为负 | `NEGATIVE_BALANCE` |
| `RESOURCE-008` | P0 | 有信用额度账户在额度内为负 | 通过 |
| `RESOURCE-009` | P0 | available 转 reserved | owner 总量不变 |
| `RESOURCE-010` | P0 | reserved release 重试两次 | 只释放一次 |
| `RESOURCE-011` | P1 | 同 effect 混合两种 unit | 拒绝 |
| `RESOURCE-012` | P1 | 极大十进制整数字符串 | 精确计算，无浮点误差 |
| `RESOURCE-013` | P1 | quantity 使用小数或科学计数法 | 拒绝 |
| `RESOURCE-014` | P1 | migration source 无迁移授权 | 拒绝 |
| `RESOURCE-015` | P1 | compensation 恢复原转移 | 两事件共同守恒，原事件保留 |

## 9. 唯一物品与产权

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `ITEM-001` | P0 | 合法生产创建 item | 单一 title owner |
| `ITEM-002` | P0 | 无来源创建 item | 拒绝 |
| `ITEM-003` | P0 | 同一 item 同时授予两个 title owner | `OWNERSHIP_CONFLICT` |
| `ITEM-004` | P0 | title 转移但保留 lien | title 更新，lien 不丢失 |
| `ITEM-005` | P0 | 非 owner 无授权转移 title | `AUTHORIZATION_DENIED` |
| `ITEM-006` | P0 | destroyed item 再转移 | 拒绝 |
| `ITEM-007` | P1 | owner 与 custodian 不同 | 合法并分别可查询 |
| `ITEM-008` | P1 | lease 到期 | possession 根据规则返还，title 不变 |
| `ITEM-009` | P1 | seizure 与普通 transfer 冲突 | 阻断或进入 dispute，不 last-write-wins |
| `ITEM-010` | P1 | item lifecycle event 重放两次 | 不重复创建 item |

## 10. 授权与可见性

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `AUTH-001` | P0 | 有效授权改变目标状态 | 通过 |
| `AUTH-002` | P0 | 授权过期后新写入 | `AUTHORIZATION_DENIED` |
| `AUTH-003` | P0 | 授权在事件发生时有效、之后撤销 | 历史事件仍合法 |
| `AUTH-004` | P0 | 匿名 system 提交 root correction | 拒绝 |
| `AUTH-005` | P1 | 可见性不足查询私密事件 | 不返回内容且不泄露存在性 |
| `AUTH-006` | P1 | 法律调取有合法 case ref | 返回受限 knowledge view |
| `AUTH-007` | P1 | visibility policy 不存在 | 新写入拒绝 |

## 11. 确定性与 replay

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `REPLAY-001` | P0 | 相同输入、版本和 seed 执行两次纯裁定 | payload/effects hash 相同 |
| `REPLAY-002` | P0 | 从空投影重放事件 | 与在线投影 hash 相同 |
| `REPLAY-003` | P0 | 同一事件重复投影 | 状态不重复变化 |
| `REPLAY-004` | P0 | replay 期间禁用网络和 LLM | 仍能完整恢复 |
| `REPLAY-005` | P0 | 未识别 hard event type | 投影停止并暴露 lag |
| `REPLAY-006` | P0 | algorithm version 改变但旧 event 重放 | 使用已提交 effects，不重新裁定 |
| `REPLAY-007` | P1 | 本地时区不同 | event hash 和投影相同 |
| `REPLAY-008` | P1 | 对象构造顺序不同 | canonical hash 相同 |
| `REPLAY-009` | P1 | registry 文件原地变化 | hash mismatch，拒绝启动 writer |
| `REPLAY-010` | P1 | compensation chain 重放 | 当前状态与在线状态一致 |

## 12. 原子写入与故障注入

| ID | 级别 | 故障点 | 预期 |
|---|---|---|---|
| `FAULT-001` | P0 | schema validate 前崩溃 | 无事件、无幂等成功记录 |
| `FAULT-002` | P0 | invariant validate 后、append 前崩溃 | 无事件，可重试 |
| `FAULT-003` | P0 | append 操作返回失败 | 不返回 success，guard 进入保护 |
| `FAULT-004` | P0 | append 成功、manifest 响应前崩溃 | 重试返回原 manifest |
| `FAULT-005` | P0 | append 成功、projection 前崩溃 | 重放后投影恢复 |
| `FAULT-006` | P0 | effect bundle 第三个投影步骤崩溃 | 重建时整个 event 幂等应用 |
| `FAULT-007` | P0 | outbox 外部调用失败 | canonical event 保留，outbox 可重试 |
| `FAULT-008` | P0 | 外部调用成功但确认丢失 | outbox key 防止重复副作用 |
| `FAULT-009` | P1 | registry 加载失败 | writer 不启动，reader 可使用已知兼容版本 |
| `FAULT-010` | P1 | idempotency index 暂时不可用 | 拒绝写入，不绕开幂等 |

## 13. Legacy 兼容

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `LEGACY-001` | P0 | 读取完整旧事件 | 生成 attributed view，不写新事件 |
| `LEGACY-002` | P0 | 旧事件缺少父因果 | 标记 unattributed，不伪造 parent |
| `LEGACY-003` | P0 | adapter 无法解析事件 | 原事件仍可原生读取，记录 adapter failure |
| `LEGACY-004` | P0 | 启用新 registry 后加载旧世界 | 只读和原有兼容路径正常 |
| `LEGACY-005` | P0 | shadow observe | 不产生第二条 canonical event |
| `LEGACY-006` | P1 | 新事件引用 attributed legacy event | 可追溯到原 ledger position |
| `LEGACY-007` | P1 | adapter version 升级 | 旧 canonical bytes 不变，view 可重建 |
| `LEGACY-008` | P1 | legacy writer 回滚 | 已写新事件保留，无历史删除 |

## 14. Registry 与 rollout

| ID | 级别 | 场景 | 预期 |
|---|---|---|---|
| `REGISTRY-001` | P0 | observe 模式违反 soft validator | 写入并记录 observation |
| `REGISTRY-002` | P0 | warn 模式违反 soft validator | 写入并返回 warning |
| `REGISTRY-003` | P0 | block 模式违反 hard validator | 拒绝 |
| `REGISTRY-004` | P0 | retired event type 新写入 | 拒绝，replay 允许 |
| `REGISTRY-005` | P0 | 格式损坏在 observe 模式 | 仍拒绝 |
| `REGISTRY-006` | P1 | 单事件族从 warn 升 block | 其他事件族不受影响 |
| `REGISTRY-007` | P1 | block 降回 warn | 已提交事件不变 |
| `REGISTRY-008` | P1 | 发布新 registry version | 旧版本仍可 replay |

## 15. Property tests

### `PROP-RESOURCE-001`

生成 10,000 组随机合法转移，断言每个 `resourceKey + unit` 的净变化为 0。

### `PROP-RESOURCE-002`

对合法转移随机删除或修改一个 entry，除非补充合法 source/sink，否则必须被拒绝。

### `PROP-IDEMP-001`

对同一命令生成随机重试、超时和并发顺序，最终 canonical event 数始终为 1。

### `PROP-CAUSE-001`

生成随机 DAG 后逐条加入合法事件，全部通过；随机添加回边时必须检测出环。

### `PROP-REPLAY-001`

对固定事件序列随机切断 projection 并恢复，最终 projection hash 始终相同。

### `PROP-ITEM-001`

生成随机 title、lease、lien、custody 与 seizure 变化，任意世界分钟最多存在一个有效 title owner。

## 16. 性能基线

首版目标不是最终容量承诺，而是防止 Phase 0 引入数量级退化：

| 指标 | 最低目标 |
|---|---|
| 纯 envelope + registry 校验 | 单核每秒 20,000 次 |
| 10-entry resource ledger 校验 | 单核每秒 10,000 次 |
| 幂等命中查询 | p95 小于 10 ms |
| 单 stream parent/version 查询 | p95 小于 10 ms |
| 10,000 event replay | 不调用网络，结果 hash 稳定 |
| legacy adapter | 不得让旧世界启动耗时增加超过 20% |

性能失败是 P2，除非导致 maintenance tick 长期落后或 writer 超时，此时升级为 P1。

## 17. 验收运行

进入 `block` 前必须完成：

1. 全部 P0 测试通过。
2. 对目标 writer route 至少运行 7 天或 100,000 次 shadow validation，取先达到者。
3. 未出现无法解释的 resource violation。
4. 未出现同幂等键双写。
5. legacy canonical bytes 无变化。
6. replay 不访问 LLM、embedding 或外部网络。
7. fault injection 后所有 durable event 均可恢复。
8. 所有 rejection 可通过稳定 error code 定位。

## 18. 明确未验证项

Phase 0 测试不证明：

- NPC 目标选择是否有趣。
- 世界经济是否平衡。
- Journey 难度和评分是否好玩。
- RAG 召回质量是否达到叙事目标。
- 百万级历史恢复是否满足最终 SLO。
- 多 writer 高可用是否完成。

这些由后续 Phase 和长期运行测试负责。
