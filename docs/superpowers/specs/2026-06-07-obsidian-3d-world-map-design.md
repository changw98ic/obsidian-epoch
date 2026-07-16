# 黑曜纪元 3D 多层世界地图设计

## 目标

将现有“星图 / 知识图谱”升级为《黑曜纪元》的 3D 多层世界地图。地图不再以节点宇宙为主视觉，而以世界空间为底座：高空轨道、地表城市、地表生态、地下矿区、深海尸骸、异维梦境和未归档边界共同构成世界本体。生态、势力和冲突事件不是独立世界结构，而是可切换叠加读法。

第一版必须可落地运行：自动读取 Obsidian Markdown，生成结构化 `world-map-data.json`，在 React + Three + Vite 应用里显示可交互 3D 分层地图，并导出可直接打开的 `00_总览/黑曜纪元3D世界地图.html`。

## 非目标

- 不做真实地球 GIS，不绑定经纬度、WGS84、OpenStreetMap 或在线地图瓦片。
- 不把 Cesium、deck.gl、iTowns、MapLibre 作为第一版主底座。
- 不做完整地图编辑器；第一版只提供稳定自动落点、可视化浏览、搜索、筛选和详情查看。
- 不把所有自动推断都伪装成精确设定；低置信度落点必须显式暴露。

## GitHub 调研结论

- [supershaneski/react-three-terrain](https://github.com/supershaneski/react-three-terrain)：适合参考 height map 生成 3D 地形的方式，轻量，MIT。第一版借鉴参数化地形思路，不直接迁移项目。
- [RodrigoHamuy/react-three-map](https://github.com/RodrigoHamuy/react-three-map)：证明“地图坐标 + 3D 对象 + 可点击标记”可行，但它围绕真实 MapLibre/Mapbox，和虚构多层世界不匹配。
- [tentone/geo-three](https://github.com/tentone/geo-three)：LOD、tile provider 思路可参考，但真实地理依赖较重。
- CesiumJS、deck.gl、iTowns：能力强但偏真实 GIS 和大规模地理数据，对当前虚构世界过重。

推荐技术路线：继续使用 `tools/graph-react-app` 的 React + Three + Vite 工程，新建 3D 世界地图数据和场景组件。第一版不新增重型 GIS 依赖，不引入 React Three Fiber，先用 Three.js 原生 API 控制性能和交互。

## 权威数据源

地图数据从 Markdown 派生，不替代 Obsidian 双链。数据源优先级如下：

| 优先级 | 来源 | 用途 |
| --- | --- | --- |
| 1 | `04_生物单位/*.md` | 主体生物库。当前规模约 1000+，字段最完整，是地图第一数据源。 |
| 2 | `05_地点生态/*.md` | 世界区域锚点。用于固定地名、区域描述和旧生态入口。 |
| 3 | `02_种族/*.md` | 种族节点。用于势力、生态母题和冲突轴端点。 |
| 4 | `03_势力组织/*.md` | 势力节点。用于势力模式下的控制、使用、制造和冲突归属。 |
| 5 | `01_世界底层/*.md` | 文明体系和世界底层。用于地图总层级、势力/生态来源和冲突轴端点。 |
| 6 | `08_关系网络/*.md` | 冲突轴、弱点、污染链和剧情路线。每条冲突路线必须至少解析出 2 个结构化端点。 |
| 7 | `04_异化生物/*.md` | 旧生物档案。作为补充来源，缺字段时低置信度显示。 |

`00_总览/生物创作规范.md` 是生物字段约束的权威规范。`04_生物单位` 的生物必须保留 `serial`、`seed_id`、`type`、`base`、`habitat`、`threat`、`rank_role`、`alignment`、`visual_tendency`、`visual_style`、`weakness`、`status`、`image_ready`、`node_image`、`panel_image`、`card_image` 等字段。

## 世界空间模型

地图本体由固定层级组成，每层可以显示、隐藏、半透明叠加或单独聚焦。层级是结构，不是视图模式。

| 层级 ID | 层级 | 作用 | 自动落点关键词 |
| --- | --- | --- | --- |
| `sky_orbit` | 高空轨道层 | 低轨残骸、云端墓园、星外坠落、轨道污染 | 高空、低轨、轨道、云端、星历、坠落 |
| `surface_city` | 地表城市层 | 城市管网、赛博工业、实验室、数据巷、全息剧场、废弃地铁 | 城市、管道、工业、数据、全息、地铁、实验室、黑诊所、服务器 |
| `surface_ecology` | 地表生态层 | 腐林、湿谷、山海森林、荒原、墓园、野外异化生态 | 腐林、湿谷、森林、山海、荒原、巢群、墓园、草场 |
| `underground_mine` | 地下矿区层 | 废弃矿区、神尸矿脉、地下根系、采掘污染 | 矿、地下、神尸、根下、洞穴、骨脉 |
| `deep_sea` | 深海层 | 深海尸骸、盐化、溺湾、旧神低语 | 深海、海、湾、盐、渊、尸骸 |
| `alien_dimension` | 异维梦境层 | 梦境、量子实验、非三维空间、裂隙、时间线异常 | 梦、量子、裂隙、非三维、高维、时间、旧神、克苏鲁 |
| `archive_frontier` | 未归档边界 | 缺少明确栖息地或只可弱推断的条目 | 无明确 `habitat` 或无法匹配 |

层之间通过裂隙、管道、矿脉、梦境渗漏、星外坠落和污染扩散路线连接，不再使用漂浮星图边线作为主视觉。

## 叠加图层

地图必须支持三种视图切换。三者共享同一世界底座和同一实体索引。

### 生态模式

显示生态区、栖息地、生物分布、威胁等级、生态位和资源采集点。适合回答：

- 某个生物出现在哪一层、哪个栖息地。
- 哪些低级生物提示附近有更高等级污染源。
- 哪些生态区共享基底气质、弱点或资源。

### 势力模式

显示势力控制、制造、驯养、封锁、采掘、实验和使用关系。适合回答：

- 哪些势力或种族在某个区域拥有生物单位。
- 某个势力造物为什么出现在这个栖息地。
- 财团、宗门、审判庭、女巫环等势力如何跨层行动。

### 冲突事件模式

显示跨层污染、剧情路径、冲突轴、危险前兆和事件触发点。适合回答：

- 神尸矿区如何污染腐林、湿谷或工业区。
- 星外裂隙如何影响高空、梦境和地表生态。
- 玩家沿一条剧情路径会依次经过哪些层和节点。

### 辅助过滤

三种主视图之外，还必须支持不会改变世界结构的过滤器：

- 威胁等级：`E`、`D`、`C`、`B`、`A`、`S`、未知。
- 层级职能：普通、精英、头目、首领、世界级、未知。
- 图像状态：`image_ready`、有图、无图。
- 数据置信度：高、中、低。
- 文本搜索：名称、栖息地、势力、基底、视觉风格、状态、弱点。

## 结构化数据模型

新增导出数据文件为 `00_总览/world-map-data.json`。核心结构必须稳定，供 React 应用和后续地图编辑能力复用。

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-14T00:00:00+08:00",
  "sourceStats": {
    "creatureUnits": 1014,
    "legacyCreatures": 25,
    "places": 11,
    "factions": 26
  },
  "layers": [
    {
      "id": "surface_ecology",
      "label": "地表生态层",
      "elevation": 0,
      "order": 3,
      "color": "#4fc37a",
      "summary": "腐林、湿谷、山海森林和野外异化生态。"
    }
  ],
  "regions": [
    {
      "id": "region:腐林",
      "label": "腐林",
      "layer": "surface_ecology",
      "position": [80, 0, 40],
      "radius": 42,
      "terrain": "fungal_forest",
      "confidence": "high",
      "sourcePath": "05_地点生态/腐林.md"
    }
  ],
  "habitats": [
    {
      "id": "habitat:云端墓园",
      "label": "云端墓园",
      "layer": "sky_orbit",
      "region": "region:云端墓园",
      "position": [-120, 160, 30],
      "entityCount": 18,
      "dominantThreat": "E",
      "dominantRankRole": "普通",
      "confidence": "medium",
      "placementReason": "habitat keyword: 云端"
    }
  ],
  "entities": [
    {
      "id": "B0001_云墓低语螺",
      "label": "云墓低语螺",
      "kind": "creature",
      "sourceKind": "creature_unit",
      "layer": "sky_orbit",
      "region": "region:云端墓园",
      "habitat": "云端墓园",
      "position": [-118, 163, 36],
      "overlayRoles": ["ecology", "faction"],
      "confidence": "medium",
      "placementReason": "habitat keyword: 云端",
      "sourcePath": "04_生物单位/B0001_云墓低语螺.md",
      "details": {
        "serial": "B0001",
        "seed_id": "0001",
        "type": "势力造物",
        "base": ["[[云脑族]]", "高科技与轨道文明", "缓存虫"],
        "threat": "E",
        "rank_role": "普通",
        "alignment": "秩序善良",
        "visual_tendency": "透明电子 / 腐生",
        "visual_style": "HUB全息冷白",
        "weakness": "被准确叫出真名或种族来源后会停止攻击数息",
        "status": "图像设定草案",
        "image_ready": true
      }
    }
  ],
  "routes": [
    {
      "id": "route:神尸矿脉污染扩散",
      "label": "神尸矿脉污染扩散",
      "mode": "conflict",
      "kind": "pollution",
      "points": ["region:神尸矿区", "region:废弃矿区", "region:腐林", "region:湿谷"],
      "confidence": "high"
    }
  ],
  "hierarchy": [
    {
      "id": "surface_ecology",
      "children": [
        {
          "id": "region:腐林",
          "children": ["habitat:腐林"]
        }
      ]
    }
  ]
}
```

## 数据派生规则

- `04_生物单位` 是主生物来源；文件名序号与 frontmatter `serial` 都要保留。
- `habitat` 优先决定落点；没有 `habitat` 时才使用正文生态位置、`base`、wikilink 和摘要推断。
- `visual_style`、`visual_tendency`、`alignment`、`rank_role` 不得丢失；这些字段用于右侧面板、筛选和后续生图队列联动。
- `05_地点生态` 中已有同名地点时，地点页作为高置信度区域锚点；没有地点页的栖息地由脚本自动生成中置信度 habitat/region。
- `03_势力组织` 和 `02_种族` 通过 frontmatter `base`、正文“所属势力”与 wikilink 建立势力模式关联。
- `08_关系网络` 中 `type: 冲突轴` 的条目转换为冲突路线；弱点、污染、生态类关系条目可作为低置信度影响带。
- 冲突轴的 `sides` 必须优先解析为 `01_世界底层`、`02_种族`、`03_势力组织` 或地点/自动区域端点；若少于 2 个端点，构建失败。
- 旧 `04_异化生物` 作为补充实体进入地图，但必须标记 `sourceKind: legacy_creature`，字段缺失时 `confidence: low`。
- 现有图片资产继续用于实体图标和右侧详情面板；场景内第一版只使用轻量点标记，避免 1000+ 图片纹理拖垮首屏。

## 视觉与交互

- 主视图是倾斜 3D 多层沙盘，不再是球形、星云或力导向图。
- 左侧面板控制层级显隐、层级状态、叠加模式和过滤器。
- 顶部搜索可搜索生物、地点、势力、栖息地、基底、视觉风格和弱点。
- 右侧详情面板保留档案结构：摘要、图片、外观、能力、弱点、关系、来源路径和结构化字段。
- 点击区域聚焦到该层；点击栖息地或实体标记打开详情。
- 世界层级状态包括：全部展开、半透明叠层、单层聚焦。
- 生态模式使用地貌颜色和威胁热度；势力模式使用势力色和关联高亮；冲突事件模式使用路径、裂隙、扩散带和高威胁节点。
- 1000+ 生物默认以轻量点云显示；搜索、过滤或聚焦时显示更明确标签，避免文本遮挡。

## 技术设计

### 第一版实现路径

1. 新增 `tools/build_world_map_data.py`，从 Markdown 生成 `00_总览/world-map-data.json`。
2. 在 `tools/graph-react-app` 中新增 `WorldMapScene.jsx` 和 `worldMapUtils.js`，不要把旧 `GraphScene` 强行改成地图。
3. 更新 `App.jsx` 和 `styles.css`，让应用读取 `world-map-data.json` 并提供三视图切换、层级控制、过滤、搜索和详情面板。
4. 更新 `tools/graph-react-app/scripts/copy-data.mjs` 或替换为导出脚本，构建时复制数据、静态资源和 `黑曜纪元3D世界地图.html`。
5. 保留旧星图生成脚本和旧 HTML，不在本阶段删除历史入口。

### 地形生成

第一版不需要真实 height map 文件。每层使用参数化平台和区域块：

- 高空轨道层：漂浮残骸环、冷白星霜粒子、云端锚点。
- 地表城市层：工业格栅、数据巷、管网线、废液池。
- 地表生态层：腐林、湿谷、山海森林、荒原和墓园色块。
- 地下矿区层：断裂台地、矿脉沟壑、锈黑与暗金线。
- 深海层：深蓝黑平面、骨白尸骸轮廓、盐化粒子。
- 异维梦境层：错位半透明板块、裂隙线和异常旋转标记。
- 未归档边界：灰色薄层，用来暴露缺数据实体，不隐藏问题。

## 验证标准

- `python3 tools/build_world_map_data.py` 成功生成 `00_总览/world-map-data.json`。
- JSON 包含 7 个世界层级，并包含 `04_生物单位` 的 1000+ 生物实体。
- `B0001_云墓低语螺` 至少保留 `serial`、`habitat`、`threat`、`rank_role`、`alignment`、`visual_tendency`、`visual_style`、`image_ready`。
- JSON 中每个实体都有 `layer`、`position`、`sourcePath`、`confidence` 和 `overlayRoles`。
- 运行 `npm run build` 能生成 Vite 静态站点并导出 `00_总览/黑曜纪元3D世界地图.html`。
- 新 HTML 在本地浏览器中能打开，首屏显示非空 3D 多层地图。
- 可以切换生态、势力、冲突事件模式。
- 可以切换世界层级的全部展开、半透明叠层、单层聚焦状态。
- 点击至少 1 个地点、1 个生物、1 个势力、1 条事件路径时，右侧面板显示正确来源资料。
- 威胁等级、层级职能、图像状态、数据置信度和文本搜索能改变可见实体集合。
- 移动端不出现主要 UI 文字重叠；按钮和面板可点击。
- 独立子代理必须在实现后做只读对抗性验证；只要发现阻断项，继续修复。

## 风险与边界

- 1014 个生物单位会让文本和图片密度暴涨；第一版必须使用点云、聚合和筛选，不在场景内加载全部图片纹理。
- 大量自动生成栖息地没有独立地点页；这些区域只能中置信度显示，后续应补地点生态档案。
- 旧 `04_异化生物` 和新 `04_生物单位` 可能存在概念重叠；第一版不合并实体，只通过 `sourceKind` 区分来源。
- 自动坐标不能覆盖未来人工坐标。若后续加入地图编辑能力，应把人工调整写入单独配置。
- 如果过早接入真实 GIS，会把虚构世界问题变成投影、瓦片和外部服务问题。

## 分阶段范围

### 第一阶段：可用沙盘

生成结构化世界地图数据、构建多层 3D 沙盘、三种叠加模式、基础交互、详情面板、搜索、过滤、静态 HTML 导出和验证钩子。

### 第二阶段：设定补全

扩写地点生态节点、冲突路线和低置信度栖息地，提升自动落点准确性。

### 第三阶段：地图编辑能力

允许手工调整区域形状、实体坐标和冲突路径，并把调整写入独立配置。

## 自检

- 世界分层是地图本体，不是与生态/势力/冲突并列的第三种视图。
- 生态、势力、冲突事件是叠加图层，可以在同一空间结构上切换。
- `04_生物单位` 已作为主数据源，旧 `04_异化生物` 只作为补充。
- `visual_style`、`visual_tendency`、`alignment`、`rank_role`、`image_ready` 等新字段已进入 schema。
- 第一版避免重型 GIS 依赖，符合虚构世界和现有工程约束。
- 没有未决的 TBD/TODO；不确定项以风险和阶段边界记录。
