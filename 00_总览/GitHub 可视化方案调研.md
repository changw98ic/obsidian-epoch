---
type: "调研"
status: "可用"
tags:
  - 黑曜纪元
  - 可视化
  - GitHub
---

# GitHub 可视化方案调研

## 推荐组合

当前目标是：3D 效果、节点信息展示、节点图片。单个 Obsidian 插件很难同时完美满足三项，因此建议采用两层方案：

- Obsidian 内部探索：优先试 `Apoo711/obsidian-3d-graph`，获得原生 3D 图谱体验。
- 项目展示 / 世界观看板：使用本 vault 生成的 `黑曜纪元3D知识图谱.html`，可控地实现图片节点、信息面板、筛选和搜索。

## 候选仓库

| 仓库 | 适合点 | 局限 |
| --- | --- | --- |
| [Apoo711/obsidian-3d-graph](https://github.com/Apoo711/obsidian-3d-graph) | 3D force-directed Obsidian 图谱，交互、筛选、物理参数可调 | 节点图片和定制信息面板未必满足世界观展示需求 |
| [ElsaTam/obsidian-extended-graph](https://github.com/ElsaTam/obsidian-extended-graph) | 增强 Obsidian 原生 Graph，可给节点加图片、形状、过滤、导出 SVG | 不是 3D |
| [HEmile/juggl](https://github.com/HEmile/juggl) | 可样式化、可扩展、支持图片、工作区、边类型和图谱代码块 | 偏 2D / Cytoscape，不是 3D |
| [kctekn/obsidian-TagsRoutes](https://github.com/kctekn/obsidian-TagsRoutes) | 文件、标签、文件-标签关系的 3D 图谱，交互和查询结果展示不错 | 更偏标签网络，不是为世界观图片节点定制 |
| [vasturiano/3d-force-graph](https://github.com/vasturiano/3d-force-graph) | Three.js/WebGL 3D force graph，适合做独立展示页，支持自定义 nodeThreeObject 图片节点 | 不是 Obsidian 插件，需要我们自己把 vault 数据导出进去 |

## 当前采用

已基于 `3d-force-graph` 生成独立展示页：

- [[黑曜纪元3D知识图谱.html]]
- [[3d-graph-data.json]]

它从 Obsidian 双链生成节点和边，并读取笔记中的图片嵌入作为节点贴图。当前已有真实图片节点：[[孢雾巡猎者]]。
