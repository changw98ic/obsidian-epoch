# 黑曜纪元

《黑曜纪元》是一个 Obsidian 世界观资料库，附带 3D 世界地图、知识图谱生成脚本和本地 Agent MCP 世界服务原型。

## 工程入口

- Obsidian 入口：`00_总览/黑曜纪元 Vault 入口.md`
- 前端应用：`tools/graph-react-app`
- 地图数据生成：`tools/build_world_map_data.py`
- Agent 世界服务：`tools/agent-server`

## 常用命令

```bash
cd tools/graph-react-app
npm run check:repository-import
npm run check:asset-manifest
npm run typecheck
npm test
npm run build
```

## 类型安全边界

前端、Agent server、MCP stdio 服务、测试和 Node 侧批处理入口只维护 TypeScript/TSX。`npm run typecheck` 会先执行 `check:no-js`，拒绝 `.js`、`.jsx`、`.mjs` 源文件，再分别检查前端和 Agent 服务端代码。外部 JSON 边界通过运行时校验进入类型系统：

- `src/validation.ts` 校验 `world-map-data.json`
- `src/validation.ts` 校验 Agent 公共世界响应

Python 工具脚本用于 Obsidian 资料库的数据生成、导入和渲染，例如 `tools/build_world_map_data.py`。这些脚本不属于 `check:no-js` 的 JavaScript 源码边界；浏览器打包产生的 `.js` / `.css` 属于 Vite 生成产物，不作为源码维护。

## 版本管理规则

首次导入仓库或发起 PR 前运行 `npm run check:repository-import`。它审计 Git 已跟踪文件和所有未忽略的候选文件，拒绝超过 10MiB 的单文件、超过 100MiB 的源代码集、运行时账本、生成物、原始媒体、符号链接以及高置信密钥特征。

对象存储策略使用 `09_素材与图片/ChatGPT批量生成/object-storage-manifest.json` 作为 Git 中的校验权威。`npm run check:asset-manifest` 在无原图的 CI 环境验证结构、排序、大小和 SHA-256；上传原图前运行 `npm run asset:manifest:verify-local`校验本地字节，策展素材变更后用 `npm run asset:manifest:write` 原子重建清单。上传后设置 `OBSIDIAN_EPOCH_ASSET_BASE_URL=https://...` 并运行 `npm run asset:manifest:verify-remote`，它会下载每个对象并核对状态、字节数和 SHA-256。

不要提交本地运行状态、依赖目录或构建产物：

- `tools/graph-react-app/node_modules/`
- `tools/graph-react-app/dist/`
- `.codegraph/`
- `tools/agent-server/data/`
- `00_总览/assets/*.js`
- `00_总览/assets/*.css`
- `.omc/`
- `.omx/logs/`
- `.omx/state/`
