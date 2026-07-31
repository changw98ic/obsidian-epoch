# Spec: Agent 工程复核 — 黑曜纪元 Agent Server

> 本规范定义对 `tools/agent-server/` 的架构健康度、测试覆盖、类型安全和可维护性的系统性复核标准。
> 复核范围：所有 `lib/` 源码 + `test/` 测试 + HTTP 路由 + MCP 协议层。
>
> **版本**: v2 (Codex 独立复核后修正)
> **复核修正**: 删除 R-04（事实错误），升级 R-05（103 处），新增 R-01b/R-01c/R-12–R-17

---

## 1. 复核目标

- 评估当前代码库是否满足 Agent 工程的可组合、可测试、可调试、可扩展标准
- 识别架构风险、测试盲区、类型安全漏洞
- 产出优先级排序的改进清单

---

## 2. 范围边界

| 范围 | 路径 |
|---|---|
| 核心引擎 | `lib/epoch/*.ts` (230 文件, 114K 行) |
| HTTP 层 | `lib/http/*.ts` (25 文件) |
| MCP 适配 | `lib/mcp*.ts`, `lib/mcpTools.ts`, `lib/mcpHttpTransport.ts` |
| 顶层模块 | `lib/*.ts` (74 文件) |
| 测试 | `test/*.test.ts` (238 文件) |
| 入口 | `server.ts`, `mcp.ts` |

---

## 3. 复核维度与标准

### 3.1 文件规模守卫

- [ ] **单文件不超过 3,000 行**
  - `gameCore.ts:10,969` 行 🔴
  - `mcpTools.ts:10,546` 行 🔴
  - `runtime.ts:3,411` 行 🟡
- [ ] **单函数不超过 80 行**
- [ ] **模块扇入/扇出合理**：单模块被引用不超过 20 个其他模块

**验证方法**：
```bash
# 找超过 3000 行的文件
find tools/agent-server/lib -name "*.ts" -exec sh -c 'lines=$(wc -l < "$1"); [ "$lines" -gt 3000 ] && echo "$lines $1"' _ {} \;

# 找超过 80 行的函数
grep -rn "^function \|^  function " tools/agent-server/lib/epoch/gameCore.ts | head -20
```

### 3.2 测试覆盖

**量化现状**：230 个 epoch 模块中 **122 个（53%）无对应测试文件**。

- [ ] **每个 `lib/epoch/*.ts` 模块在 `test/` 下有对应 `*.test.ts`**
- [ ] **核心路径必测**：
  - `gameCore.ts` → identity lifecycle (issue, reincarnate, archive, lifetime adjust) — 有 `gameCore-boundaries.test.ts`（2,308 行）但覆盖薄（测试/源码比 21%）
  - `causalInvariantRules.ts` → cycle detection, parent missing, stream version conflict — **无测试** 🔴
  - `normalizeTrustClass()` → invalid input, boundary values — **无独立测试**
  - `sourceAuthorityForTrustClass()` → trust class → authority 映射 — **无独立测试**
  - `mcpHttpTransport.ts` → session lifecycle, TTL expiry, sampling limit
- [ ] **已确认有测试的模块**（Codex 复核验证）：
  - `identityAuthorizationRules.ts` — `test/identityAuthorizationRules.test.ts` 存在（77 行，4 用例覆盖全部函数）✅

**验证方法**：
```bash
# 找无测试的 epoch 模块
comm -23 \
  <(find tools/agent-server/lib/epoch -name "*.ts" -exec basename {} .ts \; | sort) \
  <(find tools/agent-server/test -name "*.test.ts" -exec basename {} .test.ts \; | sort)
```

### 3.3 类型安全

- [ ] **`as unknown as` 断言**：全 `lib/` 共 **103 处**（非个别遗漏，是系统性问题）
  - `lib/epoch/` 内 69 处
  - `mcpTools.ts` 内 18+ 处（最严重）
  - `gameCore.ts` 内 3 处（lines 6463, 6651, 6659）
- [ ] **无显式 `any`**（CI 已强制，但需确认无绕过）
- [ ] **`EpochCommandContext.trustClass` 处理**：
  - 要么改为必填字段（推荐），要么所有消费方都有 `normalizeTrustClass` 默认值
  - 当前 37 处 `normalizeTrustClass` 调用是合理的防御模式，但根因是字段可选
- [ ] **影子函数风险**：`knowledgeStateRules.ts:260` 定义了本地 `normalizeTrustClass`，返回 `EpochKnowledgeTrustClass`（非 `EpochTrustClass`），命名冲突
- [ ] **MCP 工具输入校验**：所有 `callTool` 入口有 schema 验证，不依赖 `as` 断言

**验证方法**：
```bash
# 统计 as unknown as 断言（全库）
grep -rn "as unknown as" tools/agent-server/lib/ --include="*.ts" | grep -v test | grep -v node_modules | wc -l

# 按文件分布
grep -rn "as unknown as" tools/agent-server/lib/ --include="*.ts" | grep -v test | grep -v node_modules | cut -d: -f1 | sort | uniq -c | sort -rn | head -10

# 找影子 normalizeTrustClass
grep -rn "function normalizeTrustClass" tools/agent-server/lib/ --include="*.ts"

# 找显式 any（CI 应已拦截）
grep -rn ": any" tools/agent-server/lib/ --include="*.ts" | grep -v test
```

### 3.4 模块耦合

- [ ] **巨石文件拆分计划**：
  - `gameCore.ts`（10,969 行）拆为：
    - `identityCore.ts` — issue, reincarnate, archive, lifetime
    - `resourceCore.ts` — grant, spend, attribute
    - `loreCore.ts` — contribution, adjudication, authority review
    - `relationshipCore.ts` — combat, relationship, personality drift
    - `traceConflictCore.ts` — conflict state, owner/region views
    - `gameCore.ts` — composition root, 聚合子模块
  - `mcpTools.ts`（10,546 行）拆为：
    - 按 MCP tool domain 分组（player_panel, journey, experiment, world 等）
    - 共享 runtime 初始化逻辑提取到 `mcpRuntimeCore.ts`
- [ ] **无循环依赖**：`lib/epoch/` 内部不应有 A→B→A 的 import 链
- [ ] **`protocol.ts` 不应 import 具体业务模块**（它是纯类型/常量定义）✅ 已确认
- [ ] **`causal*` 子系统**（17 模块 ~7,000 行）需独立架构评估：
  - `causalContracts.ts` — 合约定义
  - `causalInvariantRules.ts` — 不变量验证
  - `causalWriteCoordinator.ts` — 写协调
  - `causalWorldSnapshot.ts` — 快照
  - `causalSnapshotMigration.ts` — 快照迁移
  - `causalSchemaRegistry.ts` / `causalSchemaCatalog.ts` — schema 管理
  - `causalIdempotencyRules.ts` / `causalIdempotencyPersistence.ts` — 幂等性
  - `causalObservability.ts` — 可观测性

**验证方法**：
```bash
# 检查 gameCore.ts 的 import 数量
head -70 tools/agent-server/lib/epoch/gameCore.ts | grep "^import"

# 检查循环依赖
npx madge --circular tools/agent-server/lib/epoch/ --extensions ts

# 列出 causal* 模块
find tools/agent-server/lib/epoch -name "causal*.ts" | sort
```

### 3.5 MCP 协议层

- [ ] **stdio 和 HTTP 两种传输共享同一 `callTool` 路径**
- [ ] **HTTP session 有 TTL（默认 12 小时）+ 最大数限制 + 每 binding 限流**
- [ ] **`mcp-proxy.ts` 有 SSE 断线重连 + recovery code 注入**
- [ ] **`applyMcpToolAllowlist()` 白名单校验覆盖所有 Phase 6 工具**
- [ ] **Bearer token 验证在所有 `/mcp` 路由上生效**

### 3.6 安全模型

- [ ] **Trust class 降级路径有测试守护**
  - `untrusted_client` 不能执行 owner-only 命令
  - `user_verified_web` 必须匹配 `explorerId`
  - `server_hosted_agent` 可 bypass owner check
  - ✅ `identityAuthorizationRules.test.ts` 已覆盖全部 4 个 assert 函数
- [ ] **Lore 来源权威性**：`sourceAuthorityForTrustClass()` 映射正确（**实际 3 处调用，2 个文件**）
  - `system_worker` → `core`
  - `untrusted_client` → `low-confidence`
  - 其余 → `official`
- [ ] **Idempotency key** 在所有写命令上被尊重

### 3.7 事件溯源完整性

- [ ] **事件不可变**：`freezeProjection()` 通过 `WeakSet` 防 mutation ✅
- [ ] **因果链无环**：`causalParentGraphHasCycle()` 用 DFS 检测 ✅
- [ ] **流版本冲突检测**：`STREAM_VERSION_CONFLICT` 在 stream version 不匹配时抛出 ✅
- [ ] **Event ID 冲突检测**：`epochEventsHaveEquivalentContent()` 用于去重 ✅
- [ ] **Event store 设计**：`eventStore.ts` 提供内存 + JSONL 两种实现，需评估持久化保证和回放语义

---

## 4. 当前已知问题清单

| ID | 严重度 | 维度 | 问题 | 位置 | Codex 验证 |
|---|---|---|---|---|---|
| R-01 | 🔴 高 | 规模 | `gameCore.ts` 10,969 行，承载所有领域命令 | `lib/epoch/gameCore.ts` | ✅ 精确 |
| R-01b | 🔴 高 | 规模 | `mcpTools.ts` 10,546 行，18+ 处类型断言 | `lib/mcpTools.ts` | ✅ Codex 发现 |
| R-01c | 🟡 中 | 规模 | `runtime.ts` 3,411 行，超 3,000 阈值 | `lib/epoch/runtime.ts` | ✅ Codex 发现 |
| R-02 | 🟡 中 | 测试 | `gameCore.ts` 有边界测试（2,308 行）但覆盖薄（21% 比率） | `test/gameCore-boundaries.test.ts` | ✅ 修正原声明 |
| R-03 | 🔴 高 | 测试 | `causalInvariantRules.ts` 无测试（环检测、版本冲突） | `test/` | ✅ 确认 |
| ~~R-04~~ | ~~—~~ | ~~—~~ | ~~已删除：`identityAuthorizationRules.ts` 有测试（77 行，4 用例）~~ | — | ❌ 原声明错误 |
| R-05 | 🟡 中 | 类型 | 全 `lib/` **103 处** `as unknown as` 断言（`mcpTools.ts` 18+, `epoch/` 69, `gameCore.ts` 3） | `lib/` 全库 | ✅ 从 1 处升级 |
| R-06 | 🟡 中 | 类型 | `EpochCommandContext.trustClass` 可选，37 处 `normalizeTrustClass` 调用是合理防御 | `protocol.ts` | ✅ 修正评价 |
| R-07 | 🟡 中 | 测试 | `normalizeTrustClass()` 无独立测试（37 个调用者） | `protocol.ts` | ✅ 确认 |
| R-08 | 🟡 中 | 测试 | `sourceAuthorityForTrustClass()` 无独立测试（**3 处调用**，非 5） | `protocol.ts` | ✅ 修正数字 |
| R-09 | 🟡 中 | 安全 | HTTP 路由层无测试：`mcpRoutes`, `agentProfileRoutes` 等 | `lib/http/` | ✅ 确认 |
| R-10 | 🟢 低 | 规范 | `pr10-workflow.js` / `pr11-workflow.js` 违反 TS-only 规则 | 根目录 | ✅ 确认 |
| R-11 | 🟢 低 | 卫生 | 残留 `.claude/worktrees/` 目录 | `.claude/` | ✅ 确认 |
| R-12 | 🔴 高 | 类型 | `mcpTools.ts` 有 18+ 处 `as unknown as`，比 `gameCore` 更严重 | `lib/mcpTools.ts` | ✅ Codex 发现 |
| R-13 | 🔴 高 | 测试 | **122/230（53%）epoch 模块无对应测试文件** — 系统性债务 | `lib/epoch/` → `test/` | ✅ Codex 量化 |
| R-14 | 🟡 中 | 维护 | `knowledgeStateRules.ts` 有影子 `normalizeTrustClass`，返回不同类型 | `lib/epoch/knowledgeStateRules.ts:260` | ✅ Codex 发现 |
| R-15 | 🟡 中 | 架构 | `causal*` 子系统（17 模块 ~7,000 行）未独立架构评估 | `lib/epoch/causal*.ts` | ✅ Codex 发现 |

---

## 5. 优先级排序

### P0 — 立即处理

| ID | 动作 |
|---|---|
| R-01 | 拆分 `gameCore.ts` 为 5 个子模块 + composition root |
| R-01b | 拆分 `mcpTools.ts` 按 MCP tool domain 分组 |
| R-13 | 制定测试补全计划，优先覆盖 `causal*` 子系统和 `protocol.ts` |

### P1 — 本迭代内

| ID | 动作 |
|---|---|
| R-03 | 为 `causalInvariantRules.ts` 补测试：环检测、父事件缺失、流版本冲突 |
| R-05/R-12 | 系统性清理 `as unknown as` 断言，用类型守卫/Zod 替代 |
| R-07/R-08 | 为 `normalizeTrustClass` / `sourceAuthorityForTrustClass` 补独立单测 |
| R-14 | 重命名影子函数或合并到 `protocol.ts` |
| R-15 | 对 `causal*` 子系统做独立架构评审 |

### P2 — 下迭代

| ID | 动作 |
|---|---|
| R-01c | 评估 `runtime.ts` 拆分可行性 |
| R-02 | 提升 `gameCore-boundaries.test.ts` 覆盖率（目标 50%+） |
| R-06 | 评估 `trustClass` 改为必填字段的迁移成本 |
| R-09 | 补 HTTP 路由层集成测试 |
| R-10 | 删除或转换 `.js` 文件为 TypeScript |
| R-11 | 清理 worktree 目录 |

---

## 6. 验收标准

复核完成的标志：

1. **每个复核维度（3.1–3.7）都有明确的 PASS/FAIL 判定**
2. **每个 FAIL 项关联到上述问题清单中的 ID**
3. **改进优先级排序（P0/P1/P2）已确认**
4. **如发现新问题，追加到问题清单**

---

## 7. 复核执行方式

```
1. 静态分析：grep/find 统计文件规模、断言、any
2. CodeGraph 探索：符号依赖、调用链、blast radius
3. 测试运行：npm test 确认当前测试状态
4. 独立复核：Codex agent 独立验证每个声明
5. 人工审查：聚焦 gameCore/mcpTools 拆分可行性和类型安全边界
```

---

## 8. 参考架构

```
tools/agent-server/
├── server.ts                    # HTTP 入口
├── mcp.ts                       # MCP stdio 入口
├── lib/
│   ├── epoch/
│   │   ├── gameCore.ts          # ⚠️ 10,969 行，需拆分
│   │   │   ├── identityCore.ts  # [待拆] issue, reincarnate, archive
│   │   │   ├── resourceCore.ts  # [待拆] grant, spend, attribute
│   │   │   ├── loreCore.ts      # [待拆] contribution, adjudication
│   │   │   └── relationshipCore.ts # [待拆] combat, drift, conflict
│   │   ├── runtime.ts           # ⚠️ 3,411 行，超阈值
│   │   ├── protocol.ts          # 类型/常量定义
│   │   ├── causalInvariantRules.ts  # 因果链验证（无测试）
│   │   ├── causalContracts.ts       # 因果合约
│   │   ├── causalWriteCoordinator.ts # 写协调
│   │   ├── causalWorldSnapshot.ts   # 快照
│   │   ├── causalSnapshotMigration.ts # 快照迁移
│   │   ├── identityAuthorizationRules.ts  # 授权规则（有测试 ✅）
│   │   ├── knowledgeStateRules.ts   # ⚠️ 影子 normalizeTrustClass
│   │   └── ... (230 files, 122 无测试)
│   ├── http/
│   │   ├── mcpRoutes.ts
│   │   ├── gameplayRoutes.ts
│   │   └── ... (25 files)
│   ├── mcpTools.ts              # ⚠️ 10,546 行，18+ 类型断言
│   ├── mcpHttpTransport.ts      # HTTP+SSE 传输
│   └── ... (74 files)
└── test/
    ├── gameCore-boundaries.test.ts  # 2,308 行（覆盖薄）
    ├── identityAuthorizationRules.test.ts  # 77 行（全覆盖 ✅）
    └── ... (238 test files)
```

---

## 9. Codex 复核记录

本 spec 经 Codex agent 独立复核，修正如下：

- **删除** R-04（`identityAuthorizationRules.ts` 有测试，原声明错误）
- **修正** R-02（`gameCore.ts` 有边界测试，非"无测试"）
- **修正** R-08（`sourceAuthorityForTrustClass` 3 处调用，非 5）
- **升级** R-05（103 处 `as unknown as`，非 1 处）
- **新增** R-01b、R-01c、R-12、R-13、R-14、R-15
- **新增** 3.7 中的 event store 设计评估项
- **新增** 3.4 中的 `causal*` 子系统架构评估
- **新增** 3.3 中的影子函数检测
- **新增** 第 8 节参考架构中 `mcpTools.ts` 和 `causal*` 标注
