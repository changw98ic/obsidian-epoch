FROM node:24-bookworm-slim@sha256:cb4e8f7c443347358b7875e717c29e27bf9befc8f5a26cf18af3c3dec80e58c5 AS web-build

ARG SOURCE_DATE_EPOCH
ARG OCI_IMAGE_VERSION
ARG OCI_IMAGE_REVISION
ARG OCI_IMAGE_SOURCE

RUN case "$SOURCE_DATE_EPOCH" in ''|*[!0-9]*) exit 1 ;; esac \
  && test -n "$OCI_IMAGE_VERSION" \
  && test "${#OCI_IMAGE_REVISION}" -eq 40 \
  && case "$OCI_IMAGE_REVISION" in *[!0-9a-f]*) exit 1 ;; esac \
  && case "$OCI_IMAGE_SOURCE" in https://*|http://*) ;; *) exit 1 ;; esac

WORKDIR /build

# The source-side map freshness gate is Python; install it only in this
# disposable build stage so the non-root runtime image stays distroless.
RUN apt-get update \
  && apt-get install --no-install-recommends --yes python3 \
  && rm -rf /var/lib/apt/lists/*

COPY tools/graph-react-app/package*.json ./tools/graph-react-app/
RUN cd tools/graph-react-app && npm ci

COPY tools/graph-react-app ./tools/graph-react-app
COPY 00_总览/world-map-data.json ./00_总览/world-map-data.json
# Keep the source inputs available only in the build stage so the container
# build itself verifies that the tracked map JSON is fresh.  The runtime stage
# copies only the generated export and does not retain the vault corpus.
COPY tools/build_world_map_data.py ./tools/build_world_map_data.py
COPY 01_世界底层 ./01_世界底层
COPY 02_种族 ./02_种族
COPY 03_势力组织 ./03_势力组织
COPY 04_生物单位 ./04_生物单位
COPY 04_异化生物 ./04_异化生物
COPY 05_地点生态 ./05_地点生态
COPY 08_关系网络 ./08_关系网络
COPY 09_素材与图片/ChatGPT批量生成/object-storage-manifest.json ./09_素材与图片/ChatGPT批量生成/object-storage-manifest.json
RUN cd tools/graph-react-app && npm run build:container
RUN mkdir -p /runtime-dirs/data /runtime-dirs/backups /runtime-dirs/restore

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:70a2c12a0d76018b54d7bd01c5e3677632eeed9f890ba318d6db55fc54cf3baa AS runtime

ARG SOURCE_DATE_EPOCH
ARG OCI_IMAGE_VERSION
ARG OCI_IMAGE_REVISION
ARG OCI_IMAGE_SOURCE

LABEL org.opencontainers.image.title="Obsidian Epoch Agent Server" \
  org.opencontainers.image.description="Authoritative MCP game server and install package endpoint" \
  org.opencontainers.image.version="${OCI_IMAGE_VERSION}" \
  org.opencontainers.image.revision="${OCI_IMAGE_REVISION}" \
  org.opencontainers.image.source="${OCI_IMAGE_SOURCE}" \
  org.opencontainers.image.base.name="gcr.io/distroless/nodejs24-debian13:nonroot" \
  org.opencontainers.image.base.digest="sha256:70a2c12a0d76018b54d7bd01c5e3677632eeed9f890ba318d6db55fc54cf3baa"

WORKDIR /app

ENV NODE_ENV=production
ENV AGENT_SERVER_HOST=0.0.0.0
ENV AGENT_SERVER_PORT=8787
ENV AGENT_SERVER_STORE=sqlite
ENV AGENT_SERVER_SQLITE_PATH=/data/agent-world.sqlite
ENV AGENT_SERVER_DATA_DIR=/data
ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}

COPY --from=web-build --chown=65532:65532 /runtime-dirs/data /data
COPY --from=web-build --chown=65532:65532 /runtime-dirs/backups /backups
COPY --from=web-build --chown=65532:65532 /runtime-dirs/restore /restore

COPY --chown=65532:65532 tools/agent-server/server.ts ./tools/agent-server/server.ts
COPY --chown=65532:65532 tools/agent-server/world-memory-semantic-preflight.ts ./tools/agent-server/world-memory-semantic-preflight.ts
COPY --chown=65532:65532 tools/agent-server/backup.ts ./tools/agent-server/backup.ts
COPY --chown=65532:65532 tools/agent-server/restore-backup.ts ./tools/agent-server/restore-backup.ts
COPY --chown=65532:65532 tools/agent-server/lib ./tools/agent-server/lib
COPY --chown=65532:65532 tools/agent-server/package ./tools/agent-server/package
COPY --from=web-build --chown=65532:65532 /build/00_总览/黑曜纪元3D世界地图.html ./00_总览/黑曜纪元3D世界地图.html
COPY --from=web-build --chown=65532:65532 /build/00_总览/assets ./00_总览/assets
COPY --from=web-build --chown=65532:65532 /build/00_总览/data ./00_总览/data
COPY --from=web-build --chown=65532:65532 /build/00_总览/world-map-data.json ./00_总览/world-map-data.json

VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["/nodejs/bin/node", "--input-type=module", "-e", "const response = await fetch('http://127.0.0.1:8787/api/health'); process.exit(response.ok ? 0 : 1)"]

WORKDIR /app
USER 65532:65532

ENTRYPOINT ["/nodejs/bin/node"]
CMD ["tools/agent-server/server.ts"]
