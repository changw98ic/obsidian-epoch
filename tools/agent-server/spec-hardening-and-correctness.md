# Obsidian Epoch — 持久化正确性、事件迁移与 MCP 输入完整性加固

## 不可逆决策

### D1: 存储策略 — SQLite 为唯一正式写入

**决策**：JSONL 不再作为正式写入目标。SQLite 为唯一权威存储。

**迁移状态机**：
```
[启动] → 检测 JSONL 状态
  ├─ JSONL 为空或已 archived → 直接进入正常模式
  ├─ JSONL 有未迁移事件 → 执行迁移
  │   ├─ 读取所有 JSONL 事件
  │   ├─ 写入 SQLite（同一事务）
  │   ├─ 写入迁移元数据（migration_version, migrated_at, event_count）
  │   ├─ 原子 rename JSONL → JSONL.archived
  │   └─ 进入正常模式
  └─ JSONL 迁移中途崩溃 → 重启时重新执行迁移（幂等）
```

**崩溃点表**：
| 崩溃点 | 恢复行为 |
|--------|----------|
| 读取 JSONL 后、写 SQLite 前 | 重启时重新读取+写入（幂等） |
| 写 SQLite 中途 | SQLite 事务回滚，重新迁移 |
| 写 SQLite 完成、rename 前 | 重启时检测到 JSONL 未 archived，重新迁移（SQLite 用 INSERT OR IGNORE） |
| rename 完成 | 正常模式 |

**所有 writer 清单**（需切断 JSONL 写入的路径）：
| 文件 | 函数 | 切断方式 |
|------|------|----------|
| `causalIdempotencyPersistence.ts:208` | `commitAtomically` | 改为 SQLite 事务 |
| `causalIdempotencyPersistence.ts:168` | `finalizeReservation` | 改为 SQLite upsert |
| `causalIdempotencyPersistence.ts:196` | `claimReservation` | 改为 SQLite upsert |
| `epochPersistence.ts` | `appendJsonl` | 改为 SQLite insert |
| `httpServer.ts:576` | `persistEpochResultPage` 中的 `persistJsonl` | 改为 SQLite insert |

**迁移元数据表**：
```sql
CREATE TABLE IF NOT EXISTS migration_state (
  migration_id TEXT PRIMARY KEY,
  migration_version INTEGER NOT NULL,
  migrated_at TEXT NOT NULL,
  source_file TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  checksum TEXT NOT NULL
);
```

### D2: 事件版本化 — 显式 schemaVersion + 无法恢复时 fail-closed

**决策**：事件 payload 新增 `schemaVersion?: number`。缺省视为 1。v1 映射无法确定性恢复时，**该事件标记为 `unresolved`，不伪造数据**。

**当前代码**：
- `events.ts:1266`：`mirrorLedgerPromotions: {entryId, canonicalEventId}[]`（v2）
- 旧格式：`mirrorLedgerPromotedEntryIds: string[]`（v1）
- 代码注释："A ledger entry may produce a canonical event with a different position"

**上转型链**：
```typescript
// lib/epoch/eventUpcasters.ts
interface EventUpcaster {
  eventType: string;
  fromVersion: number;
  toVersion: number;
  upcast: (payload: Record<string, unknown>) => Record<string, unknown>;
}

const UPCASTERS: EventUpcaster[] = [
  {
    eventType: "journey_world_solidified",
    fromVersion: 1,
    toVersion: 2,
    upcast: (p) => {
      if (p.schemaVersion === 2) return p;
      if (!Array.isArray(p.mirrorLedgerPromotedEntryIds)) return p;
      // 无法确定性重建映射 → 标记为 unresolved
      return {
        ...p,
        schemaVersion: 2,
        mirrorLedgerPromotions: [],
        _unresolvedV1Migration: true,
        _unresolvedReason: "v1 mirrorLedgerPromotedEntryIds cannot be deterministically mapped to canonicalEventId",
      };
    },
  },
];

export function applyUpcasters(eventType: string, payload: Record<string, unknown>): Record<string, unknown> {
  let current = payload;
  let version = (current.schemaVersion as number) ?? 1;
  for (const upcaster of UPCASTERS.filter(u => u.eventType === eventType)) {
    if (version === upcaster.fromVersion) {
      current = upcaster.upcast(current);
      version = (current.schemaVersion as number) ?? upcaster.toVersion;
    }
  }
  return current;
}
```

**上转型位置**：统一在 `epochEventsFromPersistenceRecord()` 入口，覆盖三条读取路径：
1. JSONL 恢复（`readAll()`）
2. command event 恢复
3. SQLite 读取

**下游处理 unresolved**：
```typescript
if (payload._unresolvedV1Migration) {
  // 记录审计日志，不使用 promotions
  audit("v1_migration_unresolved", { eventId: event.eventId, journeyId: payload.journeyId });
  // promotions 视为空数组
}
```

**正规化后的类型**：
```typescript
interface JourneyWorldSolidifiedPayload {
  schemaVersion: 2;
  journeyId: string;
  solidifiedAt: string;
  mirrorLedgerPromotions: ReadonlyArray<{ entryId: string; canonicalEventId: string }>;
  settlementId: string;
  consequenceScoreBreakdown: { resultScoreBps: number; selfLossScoreBps: number; collateralScoreBps: number };
  _unresolvedV1Migration?: boolean;
  _unresolvedReason?: string;
}
```

### D3: MCP 输入契约 — 严格拒绝 + 服务端派生

**决策**：所有未知字段严格拒绝。`result_page` 的 `roleplay`/`viability`/`strategyConsistency` **拒绝**客户端提供的值（返回错误），不忽略。

**消除矛盾**：统一为"拒绝"策略。

**当前代码**：
- `mcpToolDefinitions.ts:12`：`additionalProperties: true`
- `mcpToolsMcpRuntime.ts:2819`：`callTool` 不验证参数
- `mcpToolsMcpRuntime.ts:100`：从 `mcpTools.ts` 导入

**schema 来源**：`mcpToolDefinitions.ts` 中的 `inputSchema` 为唯一定义。`additionalProperties` 从 `true` 改为 `false`。

**validator 入口签名**：
```typescript
// lib/mcpInputValidation.ts
interface ValidationError {
  path: string;      // e.g. "roleplay" 或 "nested.field"
  rule: string;      // e.g. "additionalProperties" 或 "type"
  message: string;   // 人可读描述
}

function validateToolInput(
  toolName: string,
  args: Record<string, unknown>,
  schema: object,
): { valid: true } | { valid: false; errors: readonly ValidationError[] }
```

**错误类**：
```typescript
class McpInputValidationError extends Error {
  readonly code = -32602;
  readonly errors: readonly ValidationError[];
  constructor(errors: readonly ValidationError[]) {
    super(`Invalid params: ${errors.map(e => `${e.path}: ${e.message}`).join("; ")}`);
    this.errors = errors;
  }
}
```

**`result_page` 特殊处理**：
```typescript
// 在 handler 中
if ("roleplay" in args) throw new McpInputValidationError([{ path: "roleplay", rule: "serverDerived", message: "must not be provided; server derives from canonical events" }]);
if ("viability" in args) throw new McpInputValidationError([{ path: "viability", rule: "serverDerived", message: "must not be provided; server derives from canonical events" }]);
if ("strategyConsistency" in args) throw new McpInputValidationError([{ path: "strategyConsistency", rule: "serverDerived", message: "must not be provided; server derives from canonical events" }]);
```

**JSON-RPC 错误响应格式**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params: roleplay: must not be provided; server derives from canonical events",
    "data": {
      "errors": [
        { "path": "roleplay", "rule": "serverDerived", "message": "must not be provided; server derives from canonical events" }
      ]
    }
  }
}
```

**HTTP 响应**：HTTP 200 + 上述 JSON body（JSON-RPC over HTTP 规范）。

**schema 子集覆盖**：
- `type: "string"` / `"number"` / `"integer"` / `"boolean"` / `"object"` / `"array"`
- `required` / `additionalProperties: false`
- `enum` / `minimum` / `maximum` / `minLength` / `maxLength`
- `items`（数组元素类型）
- 不支持：`anyOf` / `oneOf` / `$ref`（简化实现）

### D4: 公开 DTO — default-deny + 全出口递归扫描

**决策**：未注册事件类型只暴露 `{ eventType, eventId, createdAt }`。已注册类型声明白名单字段。

**当前代码**：`runtimePublicProjectionRules.ts:87-116` 只过滤 4 种，其余透传。`protocol.ts:104` 有 125 种事件类型。

**`PublicEventDTO` 类型**：
```typescript
interface PublicEventDTO {
  eventType: string;
  eventId: string;
  createdAt: string;
  payload?: Record<string, unknown>; // 只有白名单字段
}
```

**注册表示法**：
```typescript
// publicEventAllowlists.ts
const PUBLIC_PAYLOAD_FIELDS: Record<string, readonly string[]> = {
  "identity_issued": ["agentId", "explorerId", "identityName", "generation", "startedAt", "maxLifetime", "strategyProfile"],
  "explorer_recovery_rotated": ["explorerId", "rotatedAt"],
  "direct_trade_created": ["tradeId", "status", "createdAt", "proposerAgentId", "offerResourceId", "offerAmount", "requestResourceId", "requestAmount"],
  "direct_trade_accepted": ["tradeId", "status", "acceptedAt"],
  "party_run_created": ["partyRunId", "title", "regionId", "objective", "createdAt"],
  "party_invite_updated": ["partyRunId", "status", "updatedAt"],
  "npc_identity_doubt": [], // 内部事件，只暴露信封
  // ... 其余 118 种事件类型都需要显式声明
  // 未在此表中的事件 → default-deny → 只暴露信封
};
```

**全出口清单**：
| 出口 | DTO 构造函数 | 受众 |
|------|-------------|------|
| 事件流 `/api/epoch/events` | `toPublicEventDTO()` | 公开 |
| 结果页 `/api/epoch/result-page` | `toPublicResultPageDTO()` | 公开 |
| 进度查询 `/api/epoch/progress` | `toPublicProgressDTO()` | 公开 |
| 探索者档案 `/api/epoch/explorer-profile` | `toPublicExplorerProfileDTO()` | owner |
| 操作员概览 `/api/epoch/operator-overview` | 不脱敏 | operator |
| MCP 工具响应 | `toPublicMcpResultDTO()` | 公开 |
| 审计视图 `/api/epoch/audit` | `toAuditDTO()` | operator |

**递归扫描**：公开 DTO 中嵌套的 `events`、`projection`、`journeys` 等子对象也需要递归脱敏。

### D5: 运行时合并 — 完整迁移表

**当前代码**：
- `mcpTools.ts:1318`：`createAgentWorldRuntime`（被使用）
- `mcpRuntimeCore.ts:1498`：`createAgentWorldRuntime`（未被使用）
- `mcpToolsMcpRuntime.ts:100`：从 `mcpTools.ts` 导入
- `httpServer.ts:2`：从 `mcpTools.ts` 导入
- `mcp.ts:11`：从 `mcpTools.ts` 导入

**实施前模块依赖图**：
```
mcpTools.ts ←── mcpToolsMcpRuntime.ts (import createAgentWorldRuntime, types)
mcpTools.ts ←── httpServer.ts (import createAgentWorldRuntime)
mcpTools.ts ←── mcp.ts (import createAgentWorldMcpRuntime, createAgentWorldRemoteMcpRuntime)
mcpRuntimeCore.ts ←── (无生产导入)
```

**实施后模块依赖图**：
```
mcpConstants.ts ←── mcpRuntimeCore.ts (import MCP_PROTOCOL_VERSION, MCP_SERVER_INFO)
mcpConstants.ts ←── mcpToolsMcpRuntime.ts (import MCP_PROTOCOL_VERSION)
mcpConstants.ts ←── httpServer.ts (import MCP_SERVER_INFO)
mcpRuntimeCore.ts ←── mcpToolsMcpRuntime.ts (import createAgentWorldRuntime)
mcpRuntimeCore.ts ←── httpServer.ts (import createAgentWorldRuntime)
mcpRuntimeCore.ts ←── mcp.ts (import createAgentWorldMcpRuntime)
mcpTools.ts ←── mcpToolsMcpRuntime.ts (import tool definitions, handlers)
```

**逐文件迁移表**：
| 文件 | 当前导入 | 改为导入 |
|------|----------|----------|
| `mcpToolsMcpRuntime.ts:100` | `from "./mcpTools.ts"` (createAgentWorldRuntime, types) | `from "./mcpRuntimeCore.ts"` (createAgentWorldRuntime) + `from "./mcpConstants.ts"` (常量) |
| `httpServer.ts:2` | `from "./mcpTools.ts"` (createAgentWorldRuntime) | `from "./mcpRuntimeCore.ts"` |
| `mcp.ts:11` | `from "./lib/mcpTools.ts"` (createAgentWorldMcpRuntime, createAgentWorldRemoteMcpRuntime) | `from "./lib/mcpRuntimeCore.ts"` (createAgentWorldMcpRuntime) + `from "./lib/mcpTools.ts"` (createAgentWorldRemoteMcpRuntime) |
| `mcpTools.ts` | 定义 createAgentWorldRuntime | 删除此定义，保留工具定义和 handlers |

### D6: 游戏核心依赖反转 — 完整迁移表

**当前代码**：
- `gameCoreReducers.ts:39`：`import { uniqueValues } from "./gameCore.ts"`
- `gameCoreComposition.ts:614`：`import { applyEvent, projectEpochEvents, uniqueValues, sourceEventsMentionAgent, requireServerTrust } from "./gameCore.ts"`

**实施前模块依赖图**：
```
gameCore.ts ←── gameCoreReducers.ts (import uniqueValues)
gameCore.ts ←── gameCoreComposition.ts (import applyEvent, projectEpochEvents, uniqueValues, sourceEventsMentionAgent, requireServerTrust)
gameCoreComposition.ts ←── gameCore.ts (import createEpochGameCore) → 循环
```

**实施后模块依赖图**：
```
gameCoreHelpers.ts (新) ←── gameCoreReducers.ts (import uniqueValues, uniqueSortedValues, assertNonEmptyString, ...)
gameCoreHelpers.ts (新) ←── gameCoreComposition.ts (import applyEvent, projectEpochEvents, requireServerTrust, ...)
gameCoreComposition.ts ←── gameCore.ts (re-export facade) → 无循环
```

**逐文件迁移表**：
| 文件 | 当前从 `gameCore.ts` 导入 | 改为从何处导入 |
|------|--------------------------|---------------|
| `gameCoreReducers.ts:39` | `uniqueValues` | `gameCoreHelpers.ts`（新） |
| `gameCoreComposition.ts:614` | `applyEvent, projectEpochEvents, uniqueValues, sourceEventsMentionAgent, requireServerTrust` | `gameCoreHelpers.ts`（新） |

**移入 `gameCoreHelpers.ts` 的函数**：
- `applyEvent()`
- `projectEpochEvents()`
- `freezeProjection()`
- `uniqueValues()`
- `uniqueSortedValues()`
- `sourceEventsMentionAgent()`
- `requireServerTrust()`
- 所有 `assert*` 辅助函数

---

## 前置条件：签名密钥生成

Phase 6 evidence-pack 命令需要 Ed25519 签名密钥。在运行 `phase6-evidence-pack.ts` 或依赖它的命令之前，必须先生成签名密钥：

```bash
node --import tsx ../agent-server/generate-signing-key.ts
```

该命令会在仓库外部生成一个 Ed25519 密钥对，用于 evidence manifest 的签名和验证。密钥文件必须满足以下条件：
- 位于仓库目录外部（防止意外提交）
- 文件权限为 0600（仅所有者可读写）
- 包含至少 32 字节的密钥材料

将密钥路径设置为环境变量 `PHASE6_SIGNING_KEY_PATH`，evidence-pack 命令会自动读取。

---

## 测试契约

### P1 测试：SQLite 唯一写入（5 个）

| 测试 | 断言 |
|------|------|
| 迁移：JSONL 事件 → SQLite | SQLite 中 event_count 正确，JSONL 被 rename 为 `.archived` |
| 迁移幂等：重复启动 | 第二次迁移不产生重复事件（INSERT OR IGNORE） |
| 迁移中途崩溃：SQLite 事务回滚 | 重启后重新迁移成功 |
| writer 切断：所有路径 | `rg "appendFile.*jsonl" lib/` 无匹配（除 readAll） |
| 迁移元数据 | `migration_state` 表有正确记录 |

### P2 测试：事件版本化（7 个）

| 测试 | 断言 |
|------|------|
| v2 事件重放 | 不触发上转型 |
| v1 事件重放 | `_unresolvedV1Migration: true`，`mirrorLedgerPromotions: []` |
| 下游 unresolved 处理 | 审计日志记录，promotions 视为空 |
| 混合 v1/v2 批次 | 各自正确处理 |
| 上转型幂等 | 同一事件上转型两次结果相同 |
| 非法 schemaVersion（如 99） | 抛出错误 |
| JSONL 和 SQLite 读取等价 | 同一事件在两种路径得到相同规范对象 |

### P3 测试：运行时合并（3 个）

| 测试 | 断言 |
|------|------|
| `mcpTools.ts` 不导出 `createAgentWorldRuntime` | `rg` 无匹配 |
| 所有入口使用 `mcpRuntimeCore.ts` | clean-process import 通过 |
| 旧/新 runtime 行为等价 | 代表性命令结果相同 |

### P4 测试：依赖反转（3 个）

| 测试 | 断言 |
|------|------|
| `madge --circular` 输出为空 | 无循环（需安装 madge 到 lockfile） |
| game-core 全套行为测试 | 现有测试通过 |
| clean-process import 测试 | 无初始化错误 |

### P5 测试：MCP 验证（10 个）

| 测试 | 断言 |
|------|------|
| 未知字段 | `-32602` + 正确 JSON |
| 缺必填字段 | `-32602` |
| 顶层非 object | `-32602` |
| 嵌套未知字段 | `-32602` |
| 数组 item 类型错误 | `-32602` |
| enum 值错误 | `-32602` |
| integer 范围越界 | `-32602` |
| `result_page` 提供 `roleplay` | `-32602`（拒绝，不忽略） |
| HTTP vs stdio 响应格式一致 | code/message/data 相同 |
| schema 与 `tools/list` 一致 | 运行时行为与声明的 schema 匹配 |

### P6 测试：公开 DTO（4 个 + 表驱动）

| 测试 | 断言 |
|------|------|
| 125 种事件表驱动测试 | 每种事件的公开 DTO 不含秘密字段 |
| 递归扫描嵌套 events/projection | 内部字段不泄露 |
| 未注册事件类型 | 只有信封 |
| 公开/owner/operator 受众区分 | operator 数据不被误删 |

### P7 测试：CI 注册表（2 个）

| 测试 | 断言 |
|------|------|
| 所有事件类型有白名单声明 | CI 通过 |
| 新增事件类型缺声明 | CI 失败 |

---

## Codex 发现追溯表

| ID | 发现 | 决策 | 验收 |
|----|------|------|------|
| R-01 | JSONL 非原子 | D1: SQLite 唯一写入 | P1 测试 |
| R-02 | 无 v1→v2 上转型 | D2: 显式 schemaVersion + fail-closed | P2 测试 |
| R-03 | callTool 无验证 | D3: 严格拒绝 | P5 测试 |
| R-04 | result_page 接受伪造字段 | D3: 拒绝（不忽略） | P5 测试 |
| R-05 | 双重 runtime | D5: 完整迁移表 | P3 测试 |
| R-06 | 循环依赖 | D6: 完整迁移表 | P4 测试 |
| R-07 | 公开事件透传 | D4: default-deny + 125 种事件 | P6 测试 |
| R-08 | 上转型位置 | D2: 统一读取边界 | P2 测试 |
| R-09 | CI 注册表源 | 从 `protocol.ts:EPOCH_EVENT_TYPES` 提取 | P7 测试 |
| R-10 | 导入清单不完整 | D5/D6: 完整迁移表 | P3/P4 测试 |

## 实施顺序

P1 → P2 → P5 → P6 → P3 → P4 → P7

每个 Phase 可独立合并。P3/P4 中途可能出现缺失导出，需在 Phase 内解决。
