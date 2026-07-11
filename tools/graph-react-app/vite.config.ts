import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import type { Plugin, ProxyOptions } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vaultRoot = path.resolve(__dirname, "../..");
const dataDir = path.resolve(vaultRoot, "00_总览");
const DEFAULT_AGENT_SERVER_PROXY_TARGET = "http://127.0.0.1:8787";

type AssetManifestItem = {
  sourcePath: string;
  targetPath: string;
};

function requestPathFrom(url: string | undefined): string {
  const pathname = (url ?? "").split("?")[0] ?? "";
  return decodeURIComponent(pathname).replace(/^\/+/, "");
}

function obsidianDataPlugin(): Plugin {
  return {
    name: "obsidian-world-map-data",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const requestPath = requestPathFrom(req.url);
        const filePath = path.resolve(dataDir, requestPath);
        if (!filePath.startsWith(dataDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        fs.createReadStream(filePath).pipe(res);
      });
      server.middlewares.use("/assets/media", (req, res, next) => {
        const requestPath = requestPathFrom(req.url);
        const dataPath = path.resolve(dataDir, "world-map-data.json");
        if (!fs.existsSync(dataPath)) {
          next();
          return;
        }
        const data = JSON.parse(fs.readFileSync(dataPath, "utf8")) as { assetManifest?: AssetManifestItem[] };
        const manifest = new Map((data.assetManifest || []).map((item) => [path.basename(item.targetPath), item.sourcePath]));
        const sourcePath = manifest.get(path.basename(requestPath));
        if (!sourcePath) {
          next();
          return;
        }
        const filePath = path.resolve(vaultRoot, sourcePath);
        if (!filePath.startsWith(vaultRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export function resolveAgentServerProxyTarget(configuredTarget?: string): string {
  const target = configuredTarget?.trim() || DEFAULT_AGENT_SERVER_PROXY_TARGET;
  return target.replace(/\/+$/, "");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const agentServerTarget = resolveAgentServerProxyTarget(
    env.AGENT_SERVER_PROXY_TARGET || env.VITE_AGENT_SERVER_BASE,
  );
  const agentServerProxy: ProxyOptions = {
    target: agentServerTarget,
    changeOrigin: true,
  };

  return {
    base: "./",
    plugins: [react(), obsidianDataPlugin()],
    build: {
      chunkSizeWarningLimit: 1000,
      sourcemap: false,
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: false,
      proxy: {
        "/api": agentServerProxy,
        "/epoch": agentServerProxy,
        "/mcp": agentServerProxy,
      },
    },
  };
});
