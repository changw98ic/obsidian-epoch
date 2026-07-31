# 落地计划：持久化正确性、事件迁移与 MCP 输入完整性加固

## 总览

分 7 个 Phase 执行，每 Phase 完成后验证再进入下一 Phase。

---

## Phase 1: 共享常量提取（R-05, R-12）— Day 1 上午

### 目标
将 MCP 共享常量移到中性模块，消除循环导入的第一步。

### 步骤

**1.1 创建 `lib/mcpConstants.ts`**
```typescript
export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_INFO = { name: "obsidian-epoch-agent-world", version: "..." };
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [MCP_PROTOCOL_VERSION] as const;
```

**1.2 更新所有导入**
- `lib/mcpSession.ts` → 从 `mcpConstants.ts` 导入
- `lib/mcpTools.ts` → 从 `mcpConstants.ts` 导入
- `lib/mcpToolsMcpRuntime.ts` → 从 `mcpConstants.ts` 导入
- `lib/http/mcpRoutes.ts` → 从 `mcpConstants.ts` 导入
- `mcp.ts` → 从 `mcpConstants.ts` 导入

**1.3 验证**
```bash
npm run typecheck
npm run agent:test
```

---

## Phase 2: 运行时入口规范化（R-05, R-12）— Day 1 下午

### 目标
消除双重 `createAgentWorldRuntime`，建立唯一入口。

### 步骤

**2.1 确认 `mcpRuntimeCore.ts` 为唯一运行时**
- 检查 `mcpRuntimeCore.ts` 中的 `createAgentWorldRuntime` 是否完整
- 如果不完整，将 `mcpTools.ts` 中的构造逻辑移到 `mcpRuntimeCore.ts`

**2.2 修改 `mcpTools.ts`**
- 移除 `createAgentWorldRuntime` 定义
- 只保留工具定义和处理器注册
- 从 `mcpRuntimeCore.ts` 导入运行时类型（如需要）

**2.3 修改 `mcpToolsMcpRuntime.ts`**
- 从 `mcpRuntimeCore.ts` 导入 `createAgentWorldRuntime`
- 从 `mcpConstants.ts` 导入常量

**2.4 更新入口文件**
- `mcp.ts` → 使用 `mcpRuntimeCore.ts` 的运行时
- `lib/httpServer.ts` → 使用 `mcpRuntimeCore.ts` 的运行时

**2.5 编写导入图断言测试**
- `test/moduleDependencyIntegrity.test.ts`
  - 使用 `madge` 或手写 AST 检查
  - 验证 `mcpTools.ts` 不导入 `mcpRuntimeCore.ts` 的运行时符号
  - 验证 `mcpRuntimeCore.ts` 不导入 `mcpTools.ts`
  - 验证 `mcpConstants.ts` 不导入运行时模块
  - clean-process import test

**2.6 验证**
```bash
node --import tsx --test ../agent-server/test/moduleDependencyIntegrity.test.ts
npm run typecheck
npm run agent:test
```

---

## Phase 3: 游戏核心依赖反转（R-06, R-13）— Day 2

### 目标
打破 `gameCoreComposition.ts` → `gameCore.ts` 的循环依赖。

### 步骤

**3.1 分析当前依赖图**
```bash
npx madge --circular tools/agent-server/lib/epoch/gameCore.ts
```

**3.2 移动纯函数到 `gameCoreReducers.ts`**
- 从 `gameCore.ts` 移出：
  - `applyEvent()`
  - `projectEpochEvents()`
  - `freezeProjection()`
  - `uniqueValues()`
  - `uniqueSortedValues()`
  - 所有 `assert*` 辅助函数
- `gameCoreReducers.ts` 应该无依赖（纯函数）

**3.3 创建 `gameCoreProjection.ts`**（如需要）
- 依赖 `gameCoreReducers.ts`
- 包含投影相关的组合函数

**3.4 修改 `gameCoreComposition.ts`**
- 从 `gameCoreReducers.ts` 和 `gameCoreProjection.ts` 导入
- 不从 `gameCore.ts` 导入运行时符号

**3.5 修改 `gameCore.ts`**
- 保留为 facade，通过 re-export 暴露公共 API
- 从 `gameCoreComposition.ts` 导入核心工厂

**3.6 运行 AST 循环检查**
```bash
npx madge --circular tools/agent-server/lib/epoch/
```

**3.7 验证**
```bash
npm run typecheck
npm run agent:test
```

---

## Phase 4: 事件 Schema 版本化与上转型（R-02, R-08）— Day 2-3

### 目标
解决 `journey_world_solidified` 事件升级崩溃问题。

### 步骤

**4.1 创建 `lib/epoch/eventUpcasters.ts`**
```typescript
interface EventUpcaster {
  eventType: string;
  fromVersion: number;
  toVersion: number;
  upcast: (payload: Record<string, unknown>) => Record<string, unknown>;
}

const UPCASTERS: EventUpcaster[] = [];

export function registerUpcaster(upcaster: EventUpcaster): void { ... }
export function applyUpcasters(eventType: string, payload: Record<string, unknown>, schemaVersion: number): Record<string, unknown> { ... }
```

**4.2 实现 `journey_world_solidified` 上转型（v1 → v2）**
```typescript
registerUpcaster({
  eventType: "journey_world_solidified",
  fromVersion: 1,
  toVersion: 2,
  upcast: (payload) => {
    const entryIds = payload.mirrorLedgerPromotedEntryIds as string[] | undefined;
    const effectIds = payload.effectEventIds as string[] | undefined;
    if (!Array.isArray(entryIds)) return payload;
    const promotions = entryIds.map((entryId, i) => ({
      entryId,
      canonicalEventId: effectIds?.[i] ?? `legacy:${entryId}`,
    }));
    return {
      ...payload,
      schemaVersion: 2,
      mirrorLedgerPromotions: promotions,
    };
  },
});
```

**4.3 在 `applyEvent()` 中注入上转型**
- 检查 `schemaVersion`，缺省视为 1
- 调用 `applyUpcasters()` 应用上转型链

**4.4 编写测试**
- `test/eventUpcasters.test.ts`
  - v1 → v2 正确转换
  - v2 不触发上转型
  - 混合版本事件流
  - 缺少 `effectEventIds` 时使用 fallback
  - 未来版本抛出错误
  - 畸形事件跳过

**4.5 验证**
```bash
node --import tsx --test ../agent-server/test/eventUpcasters.test.ts
npm run typecheck
npm run agent:test
```

---

## Phase 5: JSONL 事务日志（R-01, R-07, R-15）— Day 3

### 目标
解决崩溃后事件重复问题。

### 步骤

**5.1 修改 `causalIdempotencyPersistence.ts`**
- 引入 `TransactionRecord` 格式
- 写入协议：prepare → fsync → commit → fsync
- 使用临时文件 + rename 原子替换

**5.2 修改恢复协议**
- 解析所有 JSONL 行
- 只应用有对应 commit 的 prepare 记录
- 丢弃不完整/损坏的行

**5.3 添加并发控制**
- JSONL 使用 `flock` 文件锁
- SQLite 保持现有事务语义

**5.4 编写崩溃注入测试**
- `test/causalIdempotencyAtomicity.test.ts`
  - 正常提交
  - prepare 后崩溃
  - commit 后崩溃
  - 截断文件
  - 损坏 JSON
  - 并发写入
  - 空文件

**5.5 验证**
```bash
node --import tsx --test ../agent-server/test/causalIdempotencyAtomicity.test.ts
npm run typecheck
npm run agent:test
```

---

## Phase 6: MCP 输入验证与公开出口脱敏（R-03, R-04, R-09, R-10）— Day 4

### 目标
解决结果页注入和内部事件泄露问题。

### 步骤

**6.1 创建 `lib/mcpInputValidation.ts`**
- 定义 `TOOL_INPUT_SCHEMAS` 注册表
- 每个工具的 JSON Schema
- `validateToolInput()` 函数
- 使用 `ajv`，配置 `coerceTypes: false`

**6.2 在 `callTool` 分发边界注入验证**
- `mcpToolsMcpRuntime.ts` 中，调用 handler 前验证
- 验证失败返回 `-32602 Invalid params`

**6.3 `result_page` 服务端派生**
- `roleplay`、`viability`、`strategyConsistency` 从规范事件派生
- 客户端提供的值被忽略（不拒绝）

**6.4 创建 `lib/epoch/publicDTOConstructors.ts`**
- `toPublicEventDTO()`
- `toPublicResultPageDTO()`
- `toPublicProgressDTO()`
- `INTERNAL_ONLY_EVENT_TYPES` 注册表
- `redactInternalEvent()` 函数

**6.5 修改 `runtimePublicProjectionRules.ts`**
- 使用 `toPublicEventDTO()` 构造公开事件

**6.6 编写测试**
- `test/mcpInputValidation.test.ts`
- `test/publicEventRedaction.test.ts`

**6.7 验证**
```bash
node --import tsx --test ../agent-server/test/mcpInputValidation.test.ts
node --import tsx --test ../agent-server/test/publicEventRedaction.test.ts
npm run typecheck
npm run agent:test
```

---

## Phase 7: CI 注册表校验与全量回归（R-14）— Day 4-5

### 目标
建立事件类型新增的强制保障，全量回归验证。

### 步骤

**7.1 创建事件注册表生成脚本**
- `scripts/event-registry-check.ts`
- 从 `eventTypes.ts` 提取所有事件类型
- 校验每个类型都有：publicInternal 分类、reducer、测试

**7.2 添加 npm script**
```json
"event-registry:check": "tsx scripts/event-registry-check.ts"
```

**7.3 全量回归**
```bash
npm run typecheck
npm run agent:test
npm run event-registry:check
npx madge --circular tools/agent-server/lib/epoch/
node --import tsx --test --test-concurrency=1 ../agent-server/test/*.test.ts
```

**7.4 提交 Codex 对抗性审查**
- 审查所有修改的文件 + 新增的测试
- 目标评分 ≥ 95/100
- 如果 < 95，根据反馈修复后重跑

---

## 文件变更清单

### 新增文件
| 文件 | 用途 |
|------|------|
| `lib/mcpConstants.ts` | MCP 共享常量 |
| `lib/epoch/eventUpcasters.ts` | 事件 schema 上转型 |
| `lib/epoch/publicDTOConstructors.ts` | 公开出口 DTO 白名单构造 |
| `lib/mcpInputValidation.ts` | MCP 工具输入验证 |
| `scripts/event-registry-check.ts` | CI 事件注册表校验 |
| `test/eventUpcasters.test.ts` | 上转型测试 |
| `test/causalIdempotencyAtomicity.test.ts` | 原子提交崩溃注入测试 |
| `test/mcpInputValidation.test.ts` | 输入验证测试 |
| `test/publicEventRedaction.test.ts` | 公开出口脱敏测试 |
| `test/moduleDependencyIntegrity.test.ts` | 模块依赖完整性测试 |

### 修改文件
| 文件 | 变更 |
|------|------|
| `lib/epoch/causalIdempotencyPersistence.ts` | 事务日志协议 |
| `lib/epoch/gameCoreReducers.ts` | 接收从 gameCore.ts 移出的纯函数 |
| `lib/epoch/gameCore.ts` | 移出纯函数，变为 facade |
| `lib/epoch/gameCoreComposition.ts` | 从新位置导入 |
| `lib/epoch/runtimePublicProjectionRules.ts` | 使用 DTO 构造函数 |
| `lib/mcpTools.ts` | 移除运行时构造，移出常量 |
| `lib/mcpToolsMcpRuntime.ts` | 从新位置导入，添加输入验证 |
| `lib/mcpSession.ts` | 从 mcpConstants.ts 导入 |
| `lib/http/mcpRoutes.ts` | 从 mcpConstants.ts 导入 |
| `mcp.ts` | 从 mcpRuntimeCore.ts 导入运行时 |

---

## 里程碑

| 里程碑 | 验收条件 | 预计时间 |
|--------|----------|----------|
| M1: 常量提取 + 运行时规范化 | 模块依赖测试通过 | Day 1 |
| M2: 依赖反转 | AST 循环检查通过 | Day 2 |
| M3: 上转型 | 上转型测试通过 | Day 2-3 |
| M4: 事务日志 | 崩溃注入测试通过 | Day 3 |
| M5: 输入验证 + 脱敏 | 验证和脱敏测试通过 | Day 4 |
| M6: CI 注册表 + 全量回归 | 所有测试通过 | Day 4-5 |
| M7: Codex ≥ 95 | 对抗性审查通过 | Day 5 |
