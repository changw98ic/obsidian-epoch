# Source Control and Asset Boundary

## Versioned source of truth

The Git source set must contain the Obsidian Markdown corpus, TypeScript and
Python source, tests, package manifests and lockfiles, deployment definitions,
plugin package sources, CI workflow, and `00_总览/world-map-data.json` used by
the self-contained container build.

The production Dockerfile builds the web console from those source inputs. It
must not depend on a developer workstation's generated HTML, hashed Vite
assets, copied media tree, local runtime ledgers, browser profiles, or batch
generation diagnostics.

## Generated files

The following paths are reproducible outputs or local execution state and stay
outside Git:

- `00_总览/黑曜纪元3D世界地图.html`
- `00_总览/黑曜纪元3D世界地图.http.html`
- `00_总览/assets/`
- `00_总览/data/`
- generated graph JSON/HTML/SVG exports under `00_总览/` (the canonical
  `world-map-data.json` container input is the exception)

`npm run build` regenerates the local full export. `npm run build:container`
regenerates only the console HTML, JavaScript, CSS, and data required by the
runtime image while intentionally skipping the large media copy. Production
serves media from the configured HTTPS CDN/object-storage base.

## Original media

Original art under `09_素材与图片/` is not a generated runtime cache. Do not
bulk-add the multi-gigabyte corpus to ordinary Git history. Before publishing
the repository, choose and enforce one reviewed asset authority:

1. Git LFS with repository-level quota, retention, and backup controls; or
2. immutable object storage with a versioned checksum manifest in Git.

The current environment does not have Git LFS installed, so this repository
does not declare an LFS filter that local contributors cannot execute. The
multi-gigabyte `09_素材与图片/` tree remains outside ordinary Git, while small
`*-jobs.json` generation inputs and
`09_素材与图片/ChatGPT批量生成/object-storage-manifest.json` stay versioned.
The manifest defines 698 curated objects outside the batch-runtime directory,
records exact byte sizes and SHA-256 digests, and deliberately excludes browser
profiles, diagnostics, logs, caches, and duplicated batch outputs. Run
`npm run asset:manifest:verify-local` before uploading the curated bytes and
`npm run asset:manifest:write` after an intentional asset change. CI runs
`npm run check:asset-manifest`, which validates the versioned evidence without
requiring multi-gigabyte source assets in the checkout. After publication, set
`OBSIDIAN_EPOCH_ASSET_BASE_URL` to the public HTTPS prefix and run
`npm run asset:manifest:verify-remote`; the provider-neutral verifier downloads
every object and checks its response, byte count, and SHA-256 against Git.

## Release provenance gate

A release revision is valid only when every Docker build input is tracked by
that revision and the working tree is clean. CI rebuilds the web console and
the production image from source, then verifies that the HTML-referenced script
exists in the final non-root runtime image and that media and frontend build
dependencies are absent.
