# 黑曜纪元

《黑曜纪元》既是 Obsidian 世界观资料库，也是配套的 3D 世界地图、知识图谱和服务器权威 Agent MMO alpha 实现。仓库包含 React 地图与 Agent 控制台、公共 HTTP/MCP 世界服务、可安装的 MCP/Skill 包，以及部署、备份、恢复和发布验证工具。

仓库代码已经实现的能力与仍需真实环境证明的部署工作，请以[实现状态](tools/agent-server/package/obsidian-epoch/references/implemented-systems-status.md)为准；不要把仓库内的部署配置等同于已经完成公网 HTTPS、DNS、镜像发布或异机恢复演练。

## 工程入口

- Obsidian 入口：[00_总览/黑曜纪元 Vault 入口.md](00_总览/黑曜纪元%20Vault%20入口.md)
- React 地图与 Agent 控制台：[tools/graph-react-app](tools/graph-react-app/)
- 地图数据生成：[tools/build_world_map_data.py](tools/build_world_map_data.py)
- Agent 世界服务：[tools/agent-server](tools/agent-server/)
- 可安装 MCP/Skill 包：[tools/agent-server/package/obsidian-epoch](tools/agent-server/package/obsidian-epoch/)
- 架构与运维：[完整架构](docs/architecture/obsidian-epoch-full-architecture.md)、[部署说明](tools/agent-server/deploy/README.md)、[源码与素材规则](docs/architecture/source-control-and-assets.md)

## 本地运行

需要 Node.js 24 和 npm。只有生成静态地图导出时需要 Python 3。

先安装锁定依赖：

```bash
cd tools/graph-react-app
npm ci
```

在第一个终端启动本地世界服务（默认 `http://127.0.0.1:8787`）：

```bash
npm run agent:server
```

在第二个终端启动 Vite；它会把 `/api`、`/epoch` 和 `/mcp` 代理到本地世界服务：

```bash
cd tools/graph-react-app
npm run dev
```

- 默认地图地址：`http://127.0.0.1:5173/`
- 默认 Agent 控制台地址：`http://127.0.0.1:5173/?agent=1`

生成 Obsidian 静态导出时运行 `npm run build`；该命令会先调用 Python 地图数据生成器，再构建前端并复制数据。生成器读取版本化的 Markdown 和对象存储清单，以确定性方式建立地图素材索引；完整静态导出仅在复制原始媒体时需要本地素材字节。没有素材字节的 CI 与容器构建使用已跟踪的地图数据，并运行 `npm run build:container` 跳过媒体复制；容器构建阶段会再次执行 `world-map-data:check`，防止绕过 CI 时打包陈旧 JSON。

## 验证

在 `tools/graph-react-app` 中运行：

```bash
npm run typecheck
npm test
npm run agent:world-content:check
npm run world-map-data:check
npm run build:container
```

`npm run typecheck` 已依次包含仓库导入审计、对象存储清单检查、禁止 JavaScript 源码、禁止显式 `any`、严格串行验证，以及前端和 Agent 服务端 TypeScript 检查。完整 CI 还会执行依赖审计、串行测试、容器构建、SBOM/漏洞扫描、备份恢复和 Caddy 门禁，具体以 [`.github/workflows/ci.yml`](.github/workflows/ci.yml) 为准。

`npm run agent:world-content:check` 会重新编译世界规则、系统、种族、势力、地点和路线的 Registry，并与 Skill 包中已跟踪的 `world-content-registry.json` 比较；源文档变化但派生 Registry 未更新时会失败。`npm run world-map-data:check` 会从版本化 Markdown 和对象存储清单确定性重建 `00_总览/world-map-data.json`，但不写入文件；若地图数据陈旧会失败并提示运行 `npm run world-map-data:generate`。它不需要下载原始图片，因此 CI 在容器构建前运行此门禁，容器构建阶段也会复验。默认 `generatedAt` 固定为 `1970-01-01T00:00:00Z`，避免墙上时钟产生无意义差异；如需发布标记，生成与检查命令须传入相同的显式 `--generated-at` 值。`image_ready` 表示条目的图像生成设定已完整，可交给生图流程，并不表示对象存储中已经存在图片字节。

## 类型安全边界

前端、Agent server、MCP stdio 服务、测试和 Node 侧批处理入口只维护 TypeScript/TSX。`check:no-js` 会拒绝 `.js`、`.jsx`、`.mjs`、`.cjs` 源文件；Vite 生成的 `.js` / `.css` 浏览器产物不属于源码。

外部 JSON 先经运行时校验进入类型系统：

- [`tools/graph-react-app/src/validation.ts`](tools/graph-react-app/src/validation.ts) 校验 `world-map-data.json`
- 同一模块校验 Agent 公共世界响应

Python 工具用于 Obsidian 资料库的数据生成、导入和渲染，例如 `tools/build_world_map_data.py`，不属于上述 JavaScript 源码边界。

## 版本管理规则

首次导入仓库或发起 PR 前运行 `npm run check:repository-import`。它审计 Git 已跟踪文件和所有未忽略的候选文件，拒绝超过 10 MiB 的单文件、超过 100 MiB 的候选文件总量、运行时账本、生成物、原始媒体、符号链接以及高置信密钥特征。

对象存储策略使用 `09_素材与图片/ChatGPT批量生成/object-storage-manifest.json` 作为 Git 中的校验权威。`npm run check:asset-manifest` 可在没有原图的 CI 环境验证结构、排序、大小和 SHA-256；上传原图前运行 `npm run asset:manifest:verify-local` 校验本地字节，策展素材变更后用 `npm run asset:manifest:write` 原子重建清单。上传后设置 `OBSIDIAN_EPOCH_ASSET_BASE_URL=https://...` 并运行 `npm run asset:manifest:verify-remote`，下载并核对每个对象的状态、字节数和 SHA-256。

不要提交本地运行状态、依赖目录或构建产物；具体以 [`.gitignore`](.gitignore) 和仓库导入审计为准。重点包括：

- `tools/graph-react-app/node_modules/`、`tools/graph-react-app/dist/`
- `tools/agent-server/data/`
- `00_总览/assets/`、`00_总览/data/` 和生成的地图 HTML/图谱文件
- `.codegraph/`、`.omc/`
- `.omx/logs/`、`.omx/state/`、`.omx/artifacts/`、`.omx/metrics.json`
- 未经对象存储清单或审查过的 `09_素材与图片/` 原始媒体
