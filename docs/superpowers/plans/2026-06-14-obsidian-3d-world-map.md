# Obsidian 3D World Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a running 3D multilayer world map for 黑曜纪元 with structured hierarchy, ecology/faction/conflict view switching, and data sourced from the current Obsidian vault.

**Architecture:** Generate `00_总览/world-map-data.json` from Markdown, then render it in the existing React + Vite app using a new Three.js world-map scene. Keep old graph files available but move the active app onto world-map data and controls.

**Tech Stack:** Python 3 standard library, React 19, Vite 7, Three.js 0.184, existing CSS and static export flow.

---

## File Structure

- Create `tools/build_world_map_data.py`: parse Markdown frontmatter/sections, classify habitats into world layers, generate regions/habitats/entities/routes/hierarchy, validate required fields, write JSON.
- Create `tools/graph-react-app/src/worldMapUtils.js`: filter/index world-map data, derive visible entities, summarize layers, format fields.
- Create `tools/graph-react-app/src/WorldMapScene.jsx`: Three.js scene for layered platforms, habitat regions, entity point cloud, routes, click/hover/focus, QA bridge.
- Replace active UI in `tools/graph-react-app/src/App.jsx`: load `world-map-data.json`, render map controls and detail panel.
- Modify `tools/graph-react-app/src/styles.css`: restyle app shell for map controls, responsive layout, non-overlapping mobile panels.
- Replace `tools/graph-react-app/scripts/copy-data.mjs`: copy world-map data, Vite assets, and `黑曜纪元3D世界地图.html` into `00_总览`.
- Modify `tools/graph-react-app/vite.config.js`: use relative build base so exported HTML works from the vault.
- Modify `tools/graph-react-app/package.json`: run the Python data builder before Vite build.

## Task 1: Data Generator

- [ ] **Step 1: Create `tools/build_world_map_data.py`**

Implement a script with these public functions: `build_world_map()`, `validate_world_map(data)`, and `main()`. It must read `04_生物单位`, `04_异化生物`, `05_地点生态`, `02_种族`, `03_势力组织`, `01_世界底层`, and `08_关系网络`; emit `schemaVersion`, `sourceStats`, `layers`, `regions`, `habitats`, `entities`, `routes`, and `hierarchy`.

- [ ] **Step 2: Generate and validate data**

Run:

```bash
python3 tools/build_world_map_data.py
```

Expected: exit 0 and output including `creatureUnits >= 1000`, `layers = 7`, every conflict route has at least 2 points, and path `00_总览/world-map-data.json`.

- [ ] **Step 3: Inspect representative records**

Run:

```bash
python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path('00_总览/world-map-data.json').read_text(encoding='utf-8'))
entity = next(item for item in data['entities'] if item['id'] == 'B0001_云墓低语螺')
print(len(data['layers']), data['sourceStats']['creatureUnits'], entity['layer'], entity['details']['visual_style'], entity['details']['image_ready'])
PY
```

Expected: prints `7`, at least `1000`, a non-archive layer, a non-empty visual style, and `True`.

## Task 2: Frontend Data Utilities

- [ ] **Step 1: Create `tools/graph-react-app/src/worldMapUtils.js`**

Implement index builders, filtering, display formatters, and stable CSS/color helpers for world-map data. It must support overlay modes `ecology`, `faction`, `conflict`; layer modes `expanded`, `stacked`, `single`; threat/rank/image/confidence filters; and text search.

- [ ] **Step 2: Smoke test utilities through build**

Run:

```bash
cd tools/graph-react-app && npm run build
```

Expected before Task 3 may fail because `App.jsx` has not switched data yet. After Task 4 it must pass.

## Task 3: Three.js World Map Scene

- [ ] **Step 1: Create `tools/graph-react-app/src/WorldMapScene.jsx`**

Render layer platforms, region discs, habitat count markers, entity point cloud, conflict routes, selected marker, hover marker, and labels. Expose `window.__WORLD_MAP_QA__` with `stats()`, `camera()`, `visibleEntities()`, `visibleLayers()`, and `selected()`.

- [ ] **Step 2: Verify scene lifecycle**

Run:

```bash
cd tools/graph-react-app && npm run build
```

Expected after Task 4: build exits 0 without React or Three import errors.

## Task 4: React App UI

- [ ] **Step 1: Replace active app UI in `tools/graph-react-app/src/App.jsx`**

Load `./data/world-map-data.json`, render `WorldMapScene`, top search, overlay mode buttons, layer mode buttons, layer list, threat/rank/image/confidence filters, route ribbon, and right detail panel.

- [ ] **Step 2: Preserve archive detail behavior**

The detail panel must show image gallery when available and always show source path, layer, habitat, confidence, status, threat, rank role, alignment, visual tendency, visual style, weakness, relation, appearance, ability, and routes/nearby links when present.

## Task 5: Styling and Static Export

- [ ] **Step 1: Update `styles.css`**

Make the map full-viewport, keep controls readable, avoid text overlap on mobile, and avoid UI cards nested inside other cards.

- [ ] **Step 2: Update Vite and export scripts**

Set Vite `base: "./"`. Export `dist/index.html` to `00_总览/黑曜纪元3D世界地图.html`, copy `dist/assets` to `00_总览/assets`, and copy JSON to `00_总览/data/world-map-data.json`.

- [ ] **Step 3: Update package build script**

Run data builder before Vite:

```json
"build": "python3 ../build_world_map_data.py && vite build && node scripts/copy-data.mjs"
```

## Task 6: Verification and Adversarial Review

- [ ] **Step 1: Run data build**

Run:

```bash
python3 tools/build_world_map_data.py
```

Expected: exit 0, 7 layers, 1000+ creature-unit entities.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd tools/graph-react-app && npm run build
```

Expected: exit 0 and exported HTML exists at `00_总览/黑曜纪元3D世界地图.html`.

- [ ] **Step 3: Run browser QA**

Start dev server and inspect with the in-app browser. Expected: nonblank WebGL map, QA bridge present, mode/layer controls clickable, at least one creature/place/faction/route opens detail panel.

- [ ] **Step 4: Independent adversarial subagent review**

Dispatch a separate read-only verifier or critic subagent to inspect current files and verification evidence. If it finds any blocking gap, repair and rerun Task 6.
