import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import readline from "node:readline";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import {
  OBSIDIAN_EPOCH_PUBLIC_PAGES,
  OBSIDIAN_EPOCH_RELEASE_EPOCH_SECONDS,
  createObsidianEpochPackageArchive,
  obsidianEpochInstallSurface,
  resolveObsidianEpochSourceDateEpoch,
  verifyObsidianEpochPackageIntegrity,
  verifyObsidianEpochPackageSignature,
} from "../lib/packageArchive.ts";
import {
  epochHostConfigManifestEntries,
  epochHostInstallEntries,
} from "../lib/hostInstall.ts";
import { createEpochInstallPackageArchiveCache } from "../lib/http/installRoutes.ts";
import { epochAgentWorldToolNames } from "../lib/mcpTools.ts";

const JSON_RPC_REQUEST_TIMEOUT_MS = 30_000;

test("raw package install manifests stay synchronized with host config generators", () => {
  const packageDir = join(import.meta.dirname, "../package");
  const rawManifestPaths = [
    join(packageDir, "install-manifest.json"),
    join(packageDir, "obsidian-epoch/assets/install-manifest.json"),
  ];
  const codexPlugin = JSON.parse(readFileSync(
    join(packageDir, "obsidian-epoch/host-config/codex-plugin.json"),
    "utf8",
  ));
  const codexMcp = JSON.parse(readFileSync(join(packageDir, ".mcp.json"), "utf8"));

  for (const manifestPath of rawManifestPaths) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const serverBase = String(manifest.serverBase);
    const generatedHostInstall = epochHostInstallEntries(serverBase);
    const expectedSurface = obsidianEpochInstallSurface(serverBase, "local-template");
    assert.deepEqual(manifest.hosts, generatedHostInstall.map((entry) => entry.host));
    assert.deepEqual(manifest.tools, epochAgentWorldToolNames());
    assert.deepEqual(manifest.hostInstall, generatedHostInstall);
    assert.deepEqual(manifest.hostConfigFiles, epochHostConfigManifestEntries(serverBase));
    assert.equal(manifest.transport.streamableHttp.endpoint, `${serverBase}/mcp`);
    assert.deepEqual(manifest.health, expectedSurface.health);
    assert.deepEqual(manifest.pairing, expectedSurface.pairing);
    assert.deepEqual(manifest.publicPages, expectedSurface.publicPages);
    assert.deepEqual(manifest.playbooks, expectedSurface.playbooks);
    assert.deepEqual(manifest.hostSupport, expectedSurface.hostSupport);
    assert.deepEqual(manifest.distribution, {
      mode: "local-template",
      productionDistribution: "forbidden",
      productionSource: "live-rewritten-package-endpoint",
      liveManifestUrl: `${serverBase}/api/epoch/install-manifest`,
      livePackageUrl: `${serverBase}/api/epoch/package/obsidian-epoch-agent-world-0.1.0-alpha.tar.gz`,
    });
    assert.deepEqual(
      Object.keys(manifest.publicPages).sort(),
      Object.keys(OBSIDIAN_EPOCH_PUBLIC_PAGES).sort(),
    );
    for (const page of ["pairing", "webPlay", "directTrade", "partyRun"]) {
      assert.equal(typeof manifest.publicPages[page], "string", `missing public page ${page}`);
    }
    assert.ok(manifest.hostSupport.hosts.every(
      (entry: { readonly status?: string }) => entry.status === "config_provided",
    ));
    assert.equal(manifest.hostSupport.transportSmoke.status, "verified");
    assert.deepEqual(manifest.hostSupport.transportSmoke.hostNativeClients, {
      status: "not_run",
      startedHosts: [],
    });

    const codexEntry = manifest.hostInstall.find((entry: { host?: string }) => entry.host === "Codex");
    const codexSnippet = codexEntry.configSnippets.find(
      (snippet: { label?: string }) => snippet.label === "Codex plugin manifest",
    );
    const codexMcpSnippet = codexEntry.configSnippets.find(
      (snippet: { label?: string }) => snippet.label === "Codex MCP JSON",
    );
    assert.deepEqual(codexSnippet.body, codexPlugin);
    assert.deepEqual(codexMcpSnippet.body, codexMcp);
  }
});

test("install package artifact cache deduplicates concurrent builds and isolates public origins", async () => {
  let buildCount = 0;
  let releaseFirstBuild!: () => void;
  const firstBuildGate = new Promise<void>((resolve) => {
    releaseFirstBuild = resolve;
  });
  const cache = createEpochInstallPackageArchiveCache({
    maxEntries: 2,
    build: async (serverBase) => {
      buildCount += 1;
      if (buildCount === 1) await firstBuildGate;
      const archive = Buffer.from(`archive:${serverBase}`);
      return {
        archive,
        packageInfo: {
          fileName: "obsidian-epoch-agent-world-0.1.0-alpha.tar.gz",
          contentType: "application/gzip",
          bytes: archive.byteLength,
          sha256: createHash("sha256").update(archive).digest("hex"),
        },
      };
    },
  });

  const first = cache.get("https://epoch.example");
  const concurrent = cache.get("https://epoch.example");
  assert.equal(buildCount, 1);
  releaseFirstBuild();
  const [firstArtifact, concurrentArtifact] = await Promise.all([first, concurrent]);
  assert.strictEqual(firstArtifact, concurrentArtifact);
  assert.strictEqual(await cache.get("https://epoch.example"), firstArtifact);
  assert.equal(buildCount, 1);

  const otherOrigin = await cache.get("https://mirror.example");
  assert.equal(buildCount, 2);
  assert.notEqual(otherOrigin.packageInfo.sha256, firstArtifact.packageInfo.sha256);
});

test("install package artifact cache does not reuse bytes across signing keys", async () => {
  const previousPrivateKey = process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM;
  let buildCount = 0;
  const cache = createEpochInstallPackageArchiveCache({
    build: async () => {
      buildCount += 1;
      const archive = Buffer.from(`signed-archive:${buildCount}`);
      return {
        archive,
        packageInfo: {
          fileName: "obsidian-epoch-agent-world-0.1.0-alpha.tar.gz",
          contentType: "application/gzip",
          bytes: archive.byteLength,
          sha256: createHash("sha256").update(archive).digest("hex"),
        },
      };
    },
  });
  try {
    delete process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM;
    const fallbackSigned = await cache.get("https://epoch.example");
    const operatorKey = generateKeyPairSync("ed25519").privateKey.export({
      type: "pkcs8",
      format: "pem",
    }).toString();
    process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM = operatorKey;
    const operatorSigned = await cache.get("https://epoch.example");
    assert.equal(buildCount, 2);
    assert.notEqual(operatorSigned.packageInfo.sha256, fallbackSigned.packageInfo.sha256);
  } finally {
    if (previousPrivateKey === undefined) delete process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM;
    else process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM = previousPrivateKey;
  }
});

function tarEntries(archive: Buffer): Map<string, Buffer> {
  const raw = gunzipSync(archive);
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 512 <= raw.length) {
    const header = raw.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    if (!name) break;
    const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeText || "0", 8);
    const contentStart = offset + 512;
    entries.set(name, raw.subarray(contentStart, contentStart + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function tarFileNames(archive: Buffer): string[] {
  return [...tarEntries(archive).keys()];
}

function firstTarEntryMtime(archive: Buffer) {
  const header = gunzipSync(archive).subarray(0, 512);
  const value = header.subarray(136, 148).toString("ascii").replace(/\0.*$/, "").trim();
  return Number.parseInt(value || "0", 8);
}

test("Obsidian Epoch package archive is byte-for-byte reproducible across filesystem mtime changes", async () => {
  const packageRoot = await mkdtemp(join(tmpdir(), "obsidian-epoch-reproducible-package-"));
  const skillRoot = join(packageRoot, "obsidian-epoch");
  const assetRoot = join(skillRoot, "assets");
  const previousSourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  process.env.SOURCE_DATE_EPOCH = "1780806923";
  try {
    await mkdir(assetRoot, { recursive: true });
    const localManifest = {
      name: "obsidian-epoch-agent-world",
      version: "0.1.0-alpha",
      serverBase: "http://127.0.0.1:8787",
    };
    await Promise.all([
      writeFile(join(skillRoot, "SKILL.md"), "# Obsidian Epoch\n", "utf8"),
      writeFile(join(packageRoot, "install-manifest.json"), `${JSON.stringify(localManifest)}\n`, "utf8"),
      writeFile(join(assetRoot, "install-manifest.json"), `${JSON.stringify(localManifest)}\n`, "utf8"),
    ]);

    const first = await createObsidianEpochPackageArchive({ packageRoot });
    await utimes(packageRoot, new Date(946_684_800_000), new Date(946_684_800_000));
    const second = await createObsidianEpochPackageArchive({ packageRoot });
    const firstSha256 = createHash("sha256").update(first).digest("hex");
    const secondSha256 = createHash("sha256").update(second).digest("hex");

    assert.equal(firstSha256, secondSha256);
    assert.deepEqual(first, second);
    assert.equal(firstTarEntryMtime(first), 1_780_806_923);
    const manifest = JSON.parse(tarEntries(first).get("install-manifest.json")?.toString("utf8") || "{}");
    assert.equal(manifest.distribution.mode, "local-template");
    assert.equal(manifest.distribution.productionDistribution, "forbidden");
    assert.deepEqual(manifest.verification.reproducibleArchive, {
      sourceDateEpoch: 1_780_806_923,
      sourceDateEpochSource: "SOURCE_DATE_EPOCH",
      fallbackReleaseRevision: "e3b228dc3feba56bb02edd2ddbc46de685276278",
      tarMtimeSeconds: 1_780_806_923,
      gzipLevel: 9,
      digestAlgorithm: "sha256",
    });
  } finally {
    if (previousSourceDateEpoch === undefined) delete process.env.SOURCE_DATE_EPOCH;
    else process.env.SOURCE_DATE_EPOCH = previousSourceDateEpoch;
    await rm(packageRoot, { recursive: true, force: true });
  }
});

test("Obsidian Epoch source date epoch fails closed and uses stable release metadata when unset", () => {
  const previousSourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  try {
    delete process.env.SOURCE_DATE_EPOCH;
    assert.equal(resolveObsidianEpochSourceDateEpoch(), OBSIDIAN_EPOCH_RELEASE_EPOCH_SECONDS);
    assert.equal(resolveObsidianEpochSourceDateEpoch("1780806923"), 1_780_806_923);
    assert.throws(() => resolveObsidianEpochSourceDateEpoch(""), /source_date_epoch_invalid/);
    assert.throws(() => resolveObsidianEpochSourceDateEpoch("not-an-epoch"), /source_date_epoch_invalid/);
    assert.throws(() => resolveObsidianEpochSourceDateEpoch(-1), /source_date_epoch_invalid/);
  } finally {
    if (previousSourceDateEpoch === undefined) delete process.env.SOURCE_DATE_EPOCH;
    else process.env.SOURCE_DATE_EPOCH = previousSourceDateEpoch;
  }
});

function agentServerModule(pathName: string) {
  return `../lib/${pathName}.ts`;
}

async function loadRuntimeHelpers() {
  const protocol = await import(agentServerModule("epoch/protocol")) as {
    createSequentialEpochIdFactory: (seed: string) => unknown;
  };
  const httpServer = await import(agentServerModule("httpServer")) as {
    createAgentHttpServer: (options: { readonly runtime: unknown; readonly mcpBearerToken?: string }) => {
      listen: (port: number, host: string, callback: () => void) => void;
      address: () => { readonly port: number } | null;
      close: (callback: (error?: Error) => void) => void;
    };
  };
  const mcpTools = await import(agentServerModule("mcpTools")) as {
    createAgentWorldMcpRuntime: (options?: Record<string, unknown>) => {
      runtime: unknown;
      listTools: () => Array<{ readonly name: string }>;
    };
  };
  return {
    createSequentialEpochIdFactory: protocol.createSequentialEpochIdFactory,
    createAgentHttpServer: httpServer.createAgentHttpServer,
    createAgentWorldMcpRuntime: mcpTools.createAgentWorldMcpRuntime,
  };
}

function assertPngDimensions(content: Buffer, width: number, height: number) {
  assert.deepEqual([...content.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(content.subarray(12, 16).toString("ascii"), "IHDR");
  assert.equal(content.readUInt32BE(16), width);
  assert.equal(content.readUInt32BE(20), height);
}

async function extractArchiveToTemp(entries: Map<string, Buffer>) {
  const root = await mkdtemp(join(tmpdir(), "obsidian-epoch-package-"));
  for (const [name, content] of entries) {
    const target = join(root, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

async function requestJsonRpc(
  lines: readline.Interface,
  child: ChildProcessWithoutNullStreams,
  id: number,
  method: string,
  params?: Record<string, any>,
  childOutput: () => string = () => "",
) {
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new Error(`json_rpc_exit:${method}:${child.exitCode ?? ""}:${child.signalCode ?? ""}:${childOutput()}`);
  }
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  const [line] = await Promise.race([
    once(lines, "line"),
    once(child, "exit").then(([code, signal]) => {
      throw new Error(`json_rpc_exit:${method}:${code ?? ""}:${signal ?? ""}:${childOutput()}`);
    }),
    new Promise<never>((_, reject) => setTimeout(
      () => reject(new Error(`json_rpc_timeout:${method}:${childOutput()}`)),
      JSON_RPC_REQUEST_TIMEOUT_MS,
    )),
  ]);
  return JSON.parse(String(line));
}

test("Obsidian Epoch asset generators have npm production scripts", () => {
  const generatorFiles = readdirSync(new URL("../", import.meta.url))
    .filter((name) => /^generate-.+-assets\.ts$/.test(name))
    .sort();
  const packageJson = JSON.parse(readFileSync(new URL("../../graph-react-app/package.json", import.meta.url), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const missingOrMismatched = generatorFiles
    .map((fileName) => {
      const scriptName = `agent:${fileName.replace(/\.ts$/, "")}`;
      const expectedCommand = `node --import tsx ../agent-server/${fileName}`;
      const actualCommand = packageJson.scripts?.[scriptName];
      return actualCommand === expectedCommand ? null : `${scriptName}=${expectedCommand}`;
    })
    .filter((entry): entry is string => entry !== null);

  assert.deepEqual(missingOrMismatched, []);
});

test("Obsidian Epoch downloadable package contains skill and plugin manifests", async () => {
  const archive = await createObsidianEpochPackageArchive();
  const entries = tarEntries(archive);
  const names = [...entries.keys()];

  assert.ok(archive.length > 1_000);
  assert.ok(names.includes("obsidian-epoch/SKILL.md"));
  assert.ok(names.includes("obsidian-epoch/references/protocol.md"));
  assert.ok(names.includes("obsidian-epoch/references/host-install.md"));
  assert.ok(names.includes("obsidian-epoch/references/one-turn-playbook.md"));
  assert.ok(names.includes("obsidian-epoch/references/smoke-playbook.md"));
  assert.ok(names.includes("obsidian-epoch/references/web-llm-bridge-playbook.md"));
  assert.ok(names.includes("obsidian-epoch/bin/mcp-proxy.ts"));
  assert.ok(names.includes("obsidian-epoch/assets/package-integrity.json"));
  assert.ok(names.includes("package.json"));
  assert.ok(names.includes("obsidian-epoch/assets/install-manifest.json"));
  assert.ok(names.includes("obsidian-epoch/assets/boss/obsidian-wyrm-boss.png"));
  assert.ok(names.includes("obsidian-epoch/assets/boss/salt-mirror-leviathan-boss.png"));
  assert.ok(names.includes("obsidian-epoch/assets/boss/glass-archive-seraph-boss.png"));
  assert.ok(names.includes("obsidian-epoch/assets/boss/ash-crown-titan-boss.png"));
  assert.ok(names.includes("obsidian-epoch/assets/boss/moonwell-hollow-queen-boss.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-gray-harbor.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-ash-outpost.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-salt-mirror-coast.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-glass-archive.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-moonwell-hollow.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-black-harbor.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-forest.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-salt-gate.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-ash-waste.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-city-pipes.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-abandoned-mine.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-holographic-theater.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-quantum-laboratory.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-reflective-city.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-data-alley.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-prism-waters.png"));
  assert.ok(names.includes("obsidian-epoch/assets/location/region-probability-greenhouse.png"));
  assert.ok(names.includes("obsidian-epoch/assets/npc/harbor-ledger-keeper.png"));
  assert.ok(names.includes("obsidian-epoch/assets/npc/ash-forge-runner.png"));
  assert.ok(names.includes("obsidian-epoch/assets/npc/salt-mirror-witness.png"));
  assert.ok(names.includes("obsidian-epoch/assets/npc/glass-archive-scribe.png"));
  assert.ok(names.includes("obsidian-epoch/assets/npc/moonwell-field-mender.png"));
  assert.ok(names.includes("obsidian-epoch/assets/item/field-kit.png"));
  assert.ok(names.includes("obsidian-epoch/assets/item/focus-charm.png"));
  assert.ok(names.includes("obsidian-epoch/assets/item/training-band.png"));
  assert.ok(names.includes("obsidian-epoch/assets/item/gray-ration-pack.png"));
  assert.ok(names.includes("obsidian-epoch/assets/item/aether-survey-lantern.png"));
  assert.ok(names.includes("obsidian-epoch/assets/item/ashen-oath-relic.png"));
  assert.ok(names.includes("obsidian-epoch/assets/activity/objective-activity.png"));
  assert.ok(names.includes("obsidian-epoch/assets/activity/resource-node-activity.png"));
  assert.ok(names.includes("obsidian-epoch/assets/activity/anomaly-activity.png"));
  assert.ok(names.includes("obsidian-epoch/assets/activity/bounty-activity.png"));
  assert.ok(names.includes("obsidian-epoch/assets/activity/social-hook-activity.png"));
  assert.ok(names.includes("obsidian-epoch/assets/activity/retaliation-activity.png"));
  assert.ok(names.includes("obsidian-epoch/assets/activity/turn-card-activity.png"));
  assert.ok(names.includes("obsidian-epoch/assets/activity/downtime-activity.png"));
  assert.ok(names.includes("obsidian-epoch/assets/activity/reincarnation-activity.png"));
  assert.ok(names.includes("obsidian-epoch/assets/relationship/spouse-relationship.png"));
  assert.ok(names.includes("obsidian-epoch/assets/relationship/friend-relationship.png"));
  assert.ok(names.includes("obsidian-epoch/assets/relationship/enemy-relationship.png"));
  assert.ok(names.includes("obsidian-epoch/assets/relationship/superior-relationship.png"));
  assert.ok(names.includes("obsidian-epoch/assets/relationship/mentor-relationship.png"));
  assert.ok(names.includes("obsidian-epoch/assets/relationship/creditor-relationship.png"));
  assert.ok(names.includes("obsidian-epoch/assets/relationship/alliance-relationship.png"));
  assert.ok(names.includes("obsidian-epoch/assets/relationship/household-relationship.png"));
  assert.ok(names.includes("obsidian-epoch/assets/surface/world-news-surface.png"));
  assert.ok(names.includes("obsidian-epoch/assets/surface/audit-replay-surface.png"));
  assert.ok(names.includes("obsidian-epoch/assets/surface/operator-watch-surface.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/black-harbor-night-ledger-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/forest-whispering-hollow-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/salt-gate-customs-dawn-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/ash-waste-cinder-camp-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/city-pipes-drip-market-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/abandoned-mine-echo-shaft-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/holographic-theater-spectrum-stage-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/quantum-laboratory-probability-glass-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/reflective-city-mirror-boulevard-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/data-alley-cache-signs-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/prism-waters-spectrum-tide-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/ambience/probability-greenhouse-branch-lab-ambience.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/gray-harbor-gate-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/gray-harbor-lantern-market-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/ash-outpost-wall-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/ash-outpost-drill-yard-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/salt-mirror-causeway-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/salt-mirror-tide-market-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/glass-archive-index-bridge-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/moonwell-hollow-meditation-ring-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/black-harbor-toll-quay-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/black-harbor-signal-roof-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/forest-oath-crossing-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/forest-moss-shrine-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/salt-gate-customs-yard-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/salt-gate-bell-bridge-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/ash-waste-caravan-line-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/ash-waste-cinder-well-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/city-pipes-valve-market-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/city-pipes-maintenance-crawl-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/abandoned-mine-lift-yard-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/abandoned-mine-echo-shaft-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/holographic-theater-false-applause-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/holographic-theater-spectrum-backstage-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/quantum-laboratory-entangled-chamber-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/quantum-laboratory-collapse-bridge-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/reflective-city-mirror-boulevard-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/reflective-city-screen-waterfront-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/data-alley-cache-signs-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/data-alley-packet-market-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/prism-waters-spectrum-tide-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/prism-waters-lens-dock-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/probability-greenhouse-branch-lab-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/world-scene/probability-greenhouse-seed-market-world-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/gray-harbor-dawn-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/gray-harbor-rain-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/gray-harbor-market-evening-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/gray-harbor-quiet-midnight-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/ash-outpost-noon-watch-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/ash-outpost-night-forge-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/salt-mirror-dawn-trade-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/salt-mirror-twilight-brine-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/glass-archive-noon-index-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/glass-archive-twilight-vigil-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/moonwell-hollow-dawn-training-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/moonwell-hollow-noon-grove-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/moonwell-hollow-night-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/black-harbor-fog-dawn-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/black-harbor-low-tide-night-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/city-pipes-sodium-dawn-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/city-pipes-overflow-night-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/abandoned-mine-dust-noon-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/abandoned-mine-blue-night-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/forest-green-dawn-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/forest-rain-glade-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/salt-gate-wind-dawn-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/salt-gate-market-noon-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/ash-waste-red-dusk-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/ash-waste-cold-night-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/holographic-theater-neon-dusk-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/holographic-theater-rain-rehearsal-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/quantum-laboratory-probability-morning-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/quantum-laboratory-eclipse-trial-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/reflective-city-glare-noon-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/reflective-city-neon-rain-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/data-alley-static-dawn-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/data-alley-blackout-night-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/prism-waters-rainbow-dawn-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/prism-waters-fog-night-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/probability-greenhouse-morning-bloom-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/scene-variant/probability-greenhouse-eclipse-harvest-scene-variant.png"));
  assert.ok(names.includes("obsidian-epoch/assets/event-state/resource-node-open-event-state.png"));
  assert.ok(names.includes("obsidian-epoch/assets/event-state/resource-node-contested-event-state.png"));
  assert.ok(names.includes("obsidian-epoch/assets/event-state/anomaly-containment-event-state.png"));
  assert.ok(names.includes("obsidian-epoch/assets/event-state/bounty-contract-event-state.png"));
  assert.ok(names.includes("obsidian-epoch/assets/event-state/market-convoy-event-state.png"));
  assert.ok(names.includes("obsidian-epoch/assets/event-state/season-resolution-event-state.png"));
  assert.ok(names.includes("obsidian-epoch/assets/surface/web-bridge-surface.png"));
  assert.ok(names.includes("obsidian-epoch/assets/page-scene/install-portal-page-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/page-scene/region-state-page-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/page-scene/result-page-page-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/page-scene/audit-replay-page-scene.png"));
  assert.ok(names.includes("obsidian-epoch/assets/campaign/gray-harbor-faction-war-campaign.png"));
  assert.ok(names.includes("obsidian-epoch/assets/campaign/cinder-archive-expedition-campaign.png"));
  assert.ok(names.includes("obsidian-epoch/assets/campaign/white-tower-compact-campaign.png"));
  assert.ok(names.includes("obsidian-epoch/assets/campaign/anomaly-containment-campaign.png"));
  assert.ok(names.includes("obsidian-epoch/assets/faction/gray-watch-emblem.png"));
  assert.ok(names.includes("obsidian-epoch/assets/faction/cinder-archive-emblem.png"));
  assert.ok(names.includes("obsidian-epoch/assets/faction/white-tower-compact-emblem.png"));
  assert.ok(names.includes("obsidian-epoch/assets/season/gray-harbor-faction-season-banner.png"));
  assert.ok(names.includes("obsidian-epoch/assets/season/cinder-archive-season-banner.png"));
  assert.ok(names.includes("obsidian-epoch/assets/season/white-tower-compact-season-banner.png"));
  assert.ok(names.includes(".codex-plugin/plugin.json"));
  assert.ok(names.includes(".mcp.json"));
  assert.ok(names.includes("install-manifest.json"));
  const expectedHostConfigFiles = [
    "obsidian-epoch/host-config/claude-code.mcp.json",
    "obsidian-epoch/host-config/codex.mcp.json",
    "obsidian-epoch/host-config/codex-plugin.json",
    "obsidian-epoch/host-config/cursor.mcp.json",
    "obsidian-epoch/host-config/hermes.mcp.json",
    "obsidian-epoch/host-config/openclaw.mcp.json",
    "obsidian-epoch/host-config/web-llm-bridge-sequence.json",
  ];
  for (const file of expectedHostConfigFiles) assert.ok(names.includes(file), `missing host config file ${file}`);

  const rootManifest = JSON.parse(entries.get("install-manifest.json")?.toString("utf8") || "{}");
  const skillManifest = JSON.parse(entries.get("obsidian-epoch/assets/install-manifest.json")?.toString("utf8") || "{}");
  assert.equal(rootManifest.distribution.mode, "local-template");
  assert.equal(rootManifest.distribution.productionDistribution, "forbidden");
  assert.equal(skillManifest.distribution.mode, "local-template");
  assert.ok(Number.isSafeInteger(rootManifest.verification.reproducibleArchive.sourceDateEpoch));
  assert.match(rootManifest.verification.reproducibleArchive.sourceDateEpochSource, /^(SOURCE_DATE_EPOCH|release_revision)$/);
  const packageJson = JSON.parse(entries.get("package.json")?.toString("utf8") || "{}");
  const pluginManifest = JSON.parse(entries.get(".codex-plugin/plugin.json")?.toString("utf8") || "{}");
  const codexMcpManifest = JSON.parse(entries.get(".mcp.json")?.toString("utf8") || "{}");
  const { createAgentWorldMcpRuntime } = await loadRuntimeHelpers();
  const expectedEpochTools = createAgentWorldMcpRuntime().listTools()
    .map((tool) => tool.name)
    .filter((name) => name.startsWith("obsidian_epoch."));
  const hostInstall = rootManifest.hostInstall as Array<{
    host: string;
    type: string;
    mcp?: { transport: "streamable-http"; url: string; protocolVersion: string; headers: Record<string, string> };
    quickstart?: { tool: string; firstTurnPlaybook: string };
    bridge?: { entryTool: string; submitTool: string; playbook: string; publicPages?: Record<string, string> };
    configSnippets?: Array<{ label: string; format: string; pathHint: string; body: any }>;
  }>;
  const hostConfigFiles = rootManifest.hostConfigFiles as Array<{
    path: string;
    url: string;
    contentType: string;
    bytes: number;
    sha256: string;
  }>;
  assert.equal(hostConfigFiles.length, expectedHostConfigFiles.length);
  assert.deepEqual(skillManifest.hostConfigFiles, rootManifest.hostConfigFiles);
  const hostConfigManifestByPath = new Map(hostConfigFiles.map((file) => [file.path, file]));
  for (const file of expectedHostConfigFiles) {
    const listed = hostConfigManifestByPath.get(file);
    assert.ok(listed, `install manifest missing host config file ${file}`);
    assert.equal(listed.contentType, "application/json");
    assert.equal(listed.url, `/api/epoch/host-config/${file.split("/").pop()}`);
    const content = entries.get(file) || Buffer.alloc(0);
    assert.equal(listed.bytes, content.byteLength);
    assert.equal(listed.sha256, createHash("sha256").update(content).digest("hex"));
  }
  assert.equal(packageJson.scripts?.["agent:mcp"], "node obsidian-epoch/bin/mcp-proxy.ts");
  assert.equal(pluginManifest.mcpServers, "./.mcp.json");
  assert.equal(codexMcpManifest.mcpServers?.["obsidian-epoch-agent-world"]?.type, "http");
  assert.equal(codexMcpManifest.mcpServers?.["obsidian-epoch-agent-world"]?.url, "http://127.0.0.1:8787/mcp");
  assert.equal(codexMcpManifest.mcpServers?.["obsidian-epoch-agent-world"]?.bearer_token_env_var, "AGENT_WORLD_MCP_TOKEN");
  assert.equal(pluginManifest.skills, "./skills/");
  assert.equal(pluginManifest.interface?.displayName, "黑曜纪元");
  assert.equal(rootManifest.mcpCommand, "node obsidian-epoch/bin/mcp-proxy.ts");
  assert.equal(skillManifest.mcpCommand, "node obsidian-epoch/bin/mcp-proxy.ts");
  assert.deepEqual(rootManifest.tools, expectedEpochTools);
  assert.deepEqual(skillManifest.tools, expectedEpochTools);
  assert.deepEqual(skillManifest.publicPages, rootManifest.publicPages);
  assert.deepEqual(rootManifest.health, {
    readiness: "/api/health",
    epochReadiness: "/api/epoch/health",
  });
  assert.deepEqual(skillManifest.health, rootManifest.health);
  assert.equal(rootManifest.publicPages.console, "/epoch/console");
  assert.equal(skillManifest.publicPages.console, "/epoch/console");
  assert.equal(rootManifest.publicPages.webPlay, "/epoch/web-play");
  assert.equal(skillManifest.publicPages.webPlay, "/epoch/web-play");
  assert.equal(rootManifest.publicPages.install, "/epoch/install");
  assert.equal(skillManifest.publicPages.install, "/epoch/install");
  assert.equal(rootManifest.publicPages.pairing, "/epoch/pair");
  assert.equal(skillManifest.publicPages.pairing, "/epoch/pair");
  assert.equal(rootManifest.publicPages.world, "/epoch/world");
  assert.equal(skillManifest.publicPages.world, "/epoch/world");
  assert.equal(rootManifest.publicPages.hosted, "/epoch/hosted/{sessionId}");
  assert.equal(skillManifest.publicPages.hosted, "/epoch/hosted/{sessionId}");
  assert.equal(rootManifest.publicPages.auditIndex, "/epoch/audit");
  assert.equal(skillManifest.publicPages.auditIndex, "/epoch/audit");
  assert.equal(rootManifest.publicPages.audit, "/epoch/audit/{eventId}");
  assert.equal(skillManifest.publicPages.audit, "/epoch/audit/{eventId}");
  assert.equal(rootManifest.publicPages.season, "/epoch/season/{seasonId}");
  assert.equal(skillManifest.publicPages.season, "/epoch/season/{seasonId}");
  assert.equal(rootManifest.publicPages.directTrade, "/epoch/direct-trade/{tradeId}");
  assert.equal(skillManifest.publicPages.directTrade, "/epoch/direct-trade/{tradeId}");
  assert.equal(rootManifest.publicPages.partyRun, "/epoch/party-run/{partyRunId}");
  assert.equal(skillManifest.publicPages.partyRun, "/epoch/party-run/{partyRunId}");
  assert.deepEqual(rootManifest.hostSupport, skillManifest.hostSupport);
  assert.equal(rootManifest.hostSupport.hosts[0].status, "config_provided");
  assert.equal(rootManifest.hostSupport.transportSmoke.status, "verified");
  assert.equal(rootManifest.hostSupport.transportSmoke.hostNativeClients.status, "not_run");
  assert.deepEqual(rootManifest.hostSupport.transportSmoke.hostNativeClients.startedHosts, []);
  assert.equal(rootManifest.assets.bosses.length, 5);
  assert.equal(skillManifest.assets.bosses.length, 5);
  assert.equal(rootManifest.assets.bosses[0].templateKey, "obsidian_wyrm_boss");
  assert.equal(rootManifest.assets.bosses[0].path, "obsidian-epoch/assets/boss/obsidian-wyrm-boss.png");
  assert.equal(rootManifest.assets.bosses[0].contentType, "image/png");
  assert.match(rootManifest.assets.bosses[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(skillManifest.assets.bosses, rootManifest.assets.bosses);
  assertPngDimensions(entries.get("obsidian-epoch/assets/boss/obsidian-wyrm-boss.png") || Buffer.alloc(0), 960, 540);
  assert.equal(rootManifest.assets.locations.length, 27);
  assert.equal(skillManifest.assets.locations.length, 27);
  assert.equal(rootManifest.assets.locations[0].regionId, "region_gray_harbor");
  assert.equal(rootManifest.assets.locations[0].path, "obsidian-epoch/assets/location/region-gray-harbor.png");
  assert.equal(rootManifest.assets.locations[0].url, "/api/epoch/assets/location/region-gray-harbor.png");
  assert.equal(rootManifest.assets.locations[0].contentType, "image/png");
  assert.match(rootManifest.assets.locations[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.locations[5].regionId, "region_blackharbor");
  assert.equal(rootManifest.assets.locations[5].path, "obsidian-epoch/assets/location/region-black-harbor.png");
  assert.equal(rootManifest.assets.locations[8].regionId, "region_ash");
  assert.equal(rootManifest.assets.locations[8].path, "obsidian-epoch/assets/location/region-ash-waste.png");
  assert.equal(rootManifest.assets.locations[9].regionId, "region_city_pipes");
  assert.equal(rootManifest.assets.locations[9].path, "obsidian-epoch/assets/location/region-city-pipes.png");
  assert.equal(rootManifest.assets.locations[10].regionId, "region_abandoned_mine");
  assert.equal(rootManifest.assets.locations[10].path, "obsidian-epoch/assets/location/region-abandoned-mine.png");
  assert.equal(rootManifest.assets.locations[11].regionId, "region_data_tower");
  assert.equal(rootManifest.assets.locations[11].path, "obsidian-epoch/assets/location/region-data-tower.png");
  assert.equal(rootManifest.assets.locations[12].regionId, "region_orbit_city");
  assert.equal(rootManifest.assets.locations[12].path, "obsidian-epoch/assets/location/region-orbit-city.png");
  assert.equal(rootManifest.assets.locations[13].regionId, "region_trench");
  assert.equal(rootManifest.assets.locations[13].path, "obsidian-epoch/assets/location/region-trench.png");
  assert.equal(rootManifest.assets.locations[14].regionId, "region_collective_dream_pool");
  assert.equal(rootManifest.assets.locations[14].path, "obsidian-epoch/assets/location/region-collective-dream-pool.png");
  assert.equal(rootManifest.assets.locations[15].regionId, "region_space_rift");
  assert.equal(rootManifest.assets.locations[15].path, "obsidian-epoch/assets/location/region-space-rift.png");
  assert.equal(rootManifest.assets.locations[16].regionId, "region_non_euclidean_cave");
  assert.equal(rootManifest.assets.locations[16].path, "obsidian-epoch/assets/location/region-non-euclidean-cave.png");
  assert.equal(rootManifest.assets.locations[17].regionId, "region_starship_graveyard");
  assert.equal(rootManifest.assets.locations[17].path, "obsidian-epoch/assets/location/region-starship-graveyard.png");
  assert.equal(rootManifest.assets.locations[18].regionId, "region_abandoned_subway");
  assert.equal(rootManifest.assets.locations[18].path, "obsidian-epoch/assets/location/region-abandoned-subway.png");
  assert.equal(rootManifest.assets.locations[19].regionId, "region_holographic_theater");
  assert.equal(rootManifest.assets.locations[19].path, "obsidian-epoch/assets/location/region-holographic-theater.png");
  assert.equal(rootManifest.assets.locations[20].regionId, "region_quantum_laboratory");
  assert.equal(rootManifest.assets.locations[20].path, "obsidian-epoch/assets/location/region-quantum-laboratory.png");
  assert.equal(rootManifest.assets.locations[21].regionId, "region_reflective_city");
  assert.equal(rootManifest.assets.locations[21].path, "obsidian-epoch/assets/location/region-reflective-city.png");
  assert.equal(rootManifest.assets.locations[22].regionId, "region_data_alley");
  assert.equal(rootManifest.assets.locations[22].path, "obsidian-epoch/assets/location/region-data-alley.png");
  assert.equal(rootManifest.assets.locations[23].regionId, "region_prism_waters");
  assert.equal(rootManifest.assets.locations[23].path, "obsidian-epoch/assets/location/region-prism-waters.png");
  assert.equal(rootManifest.assets.locations[24].regionId, "region_probability_greenhouse");
  assert.equal(rootManifest.assets.locations[24].path, "obsidian-epoch/assets/location/region-probability-greenhouse.png");
  assert.equal(rootManifest.assets.locations[25].regionId, "region_prophecy_server");
  assert.equal(rootManifest.assets.locations[25].path, "obsidian-epoch/assets/location/region-prophecy-server.png");
  assert.equal(rootManifest.assets.locations[26].regionId, "region_orbital_cathedral");
  assert.equal(rootManifest.assets.locations[26].path, "obsidian-epoch/assets/location/region-orbital-cathedral.png");
  assert.deepEqual(skillManifest.assets.locations, rootManifest.assets.locations);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-gray-harbor.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-black-harbor.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-ash-waste.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-city-pipes.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-abandoned-mine.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-data-tower.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-orbit-city.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-trench.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-collective-dream-pool.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-space-rift.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-non-euclidean-cave.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-starship-graveyard.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-abandoned-subway.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-holographic-theater.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-quantum-laboratory.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-reflective-city.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-data-alley.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-prism-waters.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-probability-greenhouse.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-prophecy-server.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/location/region-orbital-cathedral.png") || Buffer.alloc(0), 960, 540);
  assert.equal(rootManifest.assets.npcs.length, 5);
  assert.equal(skillManifest.assets.npcs.length, 5);
  assert.equal(rootManifest.assets.npcs[0].archetypeKey, "harbor_ledger_keeper");
  assert.equal(rootManifest.assets.npcs[0].path, "obsidian-epoch/assets/npc/harbor-ledger-keeper.png");
  assert.equal(rootManifest.assets.npcs[0].url, "/api/epoch/assets/npc/harbor-ledger-keeper.png");
  assert.equal(rootManifest.assets.npcs[0].contentType, "image/png");
  assert.match(rootManifest.assets.npcs[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(skillManifest.assets.npcs, rootManifest.assets.npcs);
  assertPngDimensions(entries.get("obsidian-epoch/assets/npc/harbor-ledger-keeper.png") || Buffer.alloc(0), 640, 640);
  assert.equal(rootManifest.assets.items.length, 8);
  assert.equal(skillManifest.assets.items.length, 8);
  assert.equal(rootManifest.assets.items[0].itemKey, "crafted:field-kit");
  assert.equal(rootManifest.assets.items[0].path, "obsidian-epoch/assets/item/field-kit.png");
  assert.equal(rootManifest.assets.items[0].url, "/api/epoch/assets/item/field-kit.png");
  assert.equal(rootManifest.assets.items[0].contentType, "image/png");
  assert.match(rootManifest.assets.items[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.items[6].itemKey, "shop:pipewarden-valve-kit");
  assert.equal(rootManifest.assets.items[6].path, "obsidian-epoch/assets/item/pipewarden-valve-kit.png");
  assert.equal(rootManifest.assets.items[7].itemKey, "shop:mine-echo-relic");
  assert.equal(rootManifest.assets.items[7].path, "obsidian-epoch/assets/item/mine-echo-relic.png");
  assert.deepEqual(skillManifest.assets.items, rootManifest.assets.items);
  assertPngDimensions(entries.get("obsidian-epoch/assets/item/field-kit.png") || Buffer.alloc(0), 512, 512);
  assertPngDimensions(entries.get("obsidian-epoch/assets/item/pipewarden-valve-kit.png") || Buffer.alloc(0), 512, 512);
  assertPngDimensions(entries.get("obsidian-epoch/assets/item/mine-echo-relic.png") || Buffer.alloc(0), 512, 512);
  assert.equal(rootManifest.assets.resources.length, 5);
  assert.equal(skillManifest.assets.resources.length, 5);
  assert.equal(rootManifest.assets.resources[0].resourceId, "coin");
  assert.equal(rootManifest.assets.resources[0].path, "obsidian-epoch/assets/resource/coin-resource.png");
  assert.equal(rootManifest.assets.resources[0].url, "/api/epoch/assets/resource/coin-resource.png");
  assert.equal(rootManifest.assets.resources[0].contentType, "image/png");
  assert.match(rootManifest.assets.resources[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(skillManifest.assets.resources, rootManifest.assets.resources);
  assertPngDimensions(entries.get("obsidian-epoch/assets/resource/coin-resource.png") || Buffer.alloc(0), 512, 512);
  assert.equal(rootManifest.assets.downtimeModes.length, 8);
  assert.equal(skillManifest.assets.downtimeModes.length, 8);
  assert.equal(rootManifest.assets.downtimeModes[0].mode, "meditation");
  assert.equal(rootManifest.assets.downtimeModes[0].path, "obsidian-epoch/assets/downtime/meditation-downtime.png");
  assert.equal(rootManifest.assets.downtimeModes[0].url, "/api/epoch/assets/downtime/meditation-downtime.png");
  assert.equal(rootManifest.assets.downtimeModes[0].contentType, "image/png");
  assert.match(rootManifest.assets.downtimeModes[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.downtimeModes[6].mode, "steward");
  assert.equal(rootManifest.assets.downtimeModes[6].path, "obsidian-epoch/assets/downtime/steward-downtime.png");
  assert.equal(rootManifest.assets.downtimeModes[7].mode, "socialize");
  assert.equal(rootManifest.assets.downtimeModes[7].path, "obsidian-epoch/assets/downtime/socialize-downtime.png");
  assert.deepEqual(skillManifest.assets.downtimeModes, rootManifest.assets.downtimeModes);
  assertPngDimensions(entries.get("obsidian-epoch/assets/downtime/meditation-downtime.png") || Buffer.alloc(0), 512, 512);
  assertPngDimensions(entries.get("obsidian-epoch/assets/downtime/steward-downtime.png") || Buffer.alloc(0), 512, 512);
  assertPngDimensions(entries.get("obsidian-epoch/assets/downtime/socialize-downtime.png") || Buffer.alloc(0), 512, 512);
  assert.deepEqual(rootManifest.assets.activities.map((asset: { activityKey: string }) => asset.activityKey), [
    "objective",
    "resource_node",
    "anomaly",
    "bounty",
    "party_run",
    "social_hook",
    "retaliation",
    "turn_card",
    "downtime",
    "reincarnation",
  ]);
  assert.deepEqual(skillManifest.assets.activities.map((asset: { activityKey: string }) => asset.activityKey), [
    "objective",
    "resource_node",
    "anomaly",
    "bounty",
    "party_run",
    "social_hook",
    "retaliation",
    "turn_card",
    "downtime",
    "reincarnation",
  ]);
  assert.equal(rootManifest.assets.activities[0].activityKey, "objective");
  assert.equal(rootManifest.assets.activities[0].path, "obsidian-epoch/assets/activity/objective-activity.png");
  assert.equal(rootManifest.assets.activities[0].url, "/api/epoch/assets/activity/objective-activity.png");
  assert.equal(rootManifest.assets.activities[0].contentType, "image/png");
  assert.match(rootManifest.assets.activities[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(skillManifest.assets.activities, rootManifest.assets.activities);
  assertPngDimensions(entries.get("obsidian-epoch/assets/activity/objective-activity.png") || Buffer.alloc(0), 512, 512);
  assert.deepEqual(rootManifest.assets.relationships.map((asset: { relationshipKey: string }) => asset.relationshipKey), [
    "spouse",
    "parent",
    "child",
    "relative",
    "friend",
    "enemy",
    "superior",
    "subordinate",
    "mentor",
    "apprentice",
    "creditor",
    "debtor",
    "alliance",
    "hostility",
    "reputation",
    "household",
  ]);
  assert.equal(skillManifest.assets.relationships.length, rootManifest.assets.relationships.length);
  assert.equal(rootManifest.assets.relationships[0].relationshipKey, "spouse");
  assert.equal(rootManifest.assets.relationships[0].path, "obsidian-epoch/assets/relationship/spouse-relationship.png");
  assert.equal(rootManifest.assets.relationships[0].url, "/api/epoch/assets/relationship/spouse-relationship.png");
  assert.equal(rootManifest.assets.relationships[0].contentType, "image/png");
  assert.match(rootManifest.assets.relationships[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(skillManifest.assets.relationships, rootManifest.assets.relationships);
  assertPngDimensions(entries.get("obsidian-epoch/assets/relationship/spouse-relationship.png") || Buffer.alloc(0), 512, 512);
  assert.equal(rootManifest.assets.worldSurfaces.length, 8);
  assert.equal(skillManifest.assets.worldSurfaces.length, 8);
  assert.equal(rootManifest.assets.worldSurfaces[0].surfaceKey, "world_news");
  assert.equal(rootManifest.assets.worldSurfaces[0].path, "obsidian-epoch/assets/surface/world-news-surface.png");
  assert.equal(rootManifest.assets.worldSurfaces[0].url, "/api/epoch/assets/surface/world-news-surface.png");
  assert.equal(rootManifest.assets.worldSurfaces[0].contentType, "image/png");
  assert.match(rootManifest.assets.worldSurfaces[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(skillManifest.assets.worldSurfaces, rootManifest.assets.worldSurfaces);
  assertPngDimensions(entries.get("obsidian-epoch/assets/surface/world-news-surface.png") || Buffer.alloc(0), 512, 512);
  assert.equal(rootManifest.assets.pageScenes.length, 12);
  assert.equal(skillManifest.assets.pageScenes.length, 12);
  assert.equal(rootManifest.assets.pageScenes[0].sceneKey, "install_portal");
  assert.equal(rootManifest.assets.pageScenes[0].path, "obsidian-epoch/assets/page-scene/install-portal-page-scene.png");
  assert.equal(rootManifest.assets.pageScenes[0].url, "/api/epoch/assets/page-scene/install-portal-page-scene.png");
  assert.equal(rootManifest.assets.pageScenes[0].contentType, "image/png");
  assert.match(rootManifest.assets.pageScenes[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(skillManifest.assets.pageScenes, rootManifest.assets.pageScenes);
  assertPngDimensions(entries.get("obsidian-epoch/assets/page-scene/install-portal-page-scene.png") || Buffer.alloc(0), 960, 540);
  assert.equal(rootManifest.assets.campaignKeyArt.length, 6);
  assert.equal(skillManifest.assets.campaignKeyArt.length, 6);
  assert.equal(rootManifest.assets.campaignKeyArt[0].campaignKey, "gray_harbor_faction_war");
  assert.equal(rootManifest.assets.campaignKeyArt[0].path, "obsidian-epoch/assets/campaign/gray-harbor-faction-war-campaign.png");
  assert.equal(rootManifest.assets.campaignKeyArt[0].url, "/api/epoch/assets/campaign/gray-harbor-faction-war-campaign.png");
  assert.equal(rootManifest.assets.campaignKeyArt[0].contentType, "image/png");
  assert.match(rootManifest.assets.campaignKeyArt[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.campaignKeyArt[3].campaignKey, "anomaly_containment");
  assert.equal(rootManifest.assets.campaignKeyArt[3].path, "obsidian-epoch/assets/campaign/anomaly-containment-campaign.png");
  assert.deepEqual(skillManifest.assets.campaignKeyArt, rootManifest.assets.campaignKeyArt);
  assertPngDimensions(entries.get("obsidian-epoch/assets/campaign/gray-harbor-faction-war-campaign.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/campaign/anomaly-containment-campaign.png") || Buffer.alloc(0), 1280, 720);
  assert.equal(rootManifest.assets.ambienceScenes.length, 28);
  assert.equal(skillManifest.assets.ambienceScenes.length, 28);
  assert.equal(rootManifest.assets.ambienceScenes[0].sceneKey, "gray_harbor_night_watch");
  assert.equal(rootManifest.assets.ambienceScenes[0].path, "obsidian-epoch/assets/ambience/gray-harbor-night-watch-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[0].url, "/api/epoch/assets/ambience/gray-harbor-night-watch-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[0].contentType, "image/png");
  assert.match(rootManifest.assets.ambienceScenes[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.ambienceScenes[4].sceneKey, "moonwell_hollow_meditation_grove");
  assert.equal(rootManifest.assets.ambienceScenes[4].path, "obsidian-epoch/assets/ambience/moonwell-hollow-meditation-grove-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[6].sceneKey, "black_harbor_night_ledger");
  assert.equal(rootManifest.assets.ambienceScenes[6].path, "obsidian-epoch/assets/ambience/black-harbor-night-ledger-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[9].sceneKey, "ash_waste_cinder_camp");
  assert.equal(rootManifest.assets.ambienceScenes[9].path, "obsidian-epoch/assets/ambience/ash-waste-cinder-camp-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[10].sceneKey, "city_pipes_drip_market");
  assert.equal(rootManifest.assets.ambienceScenes[10].path, "obsidian-epoch/assets/ambience/city-pipes-drip-market-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[11].sceneKey, "abandoned_mine_echo_shaft");
  assert.equal(rootManifest.assets.ambienceScenes[11].path, "obsidian-epoch/assets/ambience/abandoned-mine-echo-shaft-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[12].sceneKey, "data_tower_cache_rain");
  assert.equal(rootManifest.assets.ambienceScenes[12].path, "obsidian-epoch/assets/ambience/data-tower-cache-rain-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[13].sceneKey, "orbit_city_docking_ring");
  assert.equal(rootManifest.assets.ambienceScenes[13].path, "obsidian-epoch/assets/ambience/orbit-city-docking-ring-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[14].sceneKey, "trench_dream_current");
  assert.equal(rootManifest.assets.ambienceScenes[14].path, "obsidian-epoch/assets/ambience/trench-dream-current-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[15].sceneKey, "collective_dream_pool_lanterns");
  assert.equal(rootManifest.assets.ambienceScenes[15].path, "obsidian-epoch/assets/ambience/collective-dream-pool-lanterns-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[16].sceneKey, "space_rift_edge_lights");
  assert.equal(rootManifest.assets.ambienceScenes[16].path, "obsidian-epoch/assets/ambience/space-rift-edge-lights-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[17].sceneKey, "non_euclidean_cave_gravity_fold");
  assert.equal(rootManifest.assets.ambienceScenes[17].path, "obsidian-epoch/assets/ambience/non-euclidean-cave-gravity-fold-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[18].sceneKey, "starship_graveyard_drift_lights");
  assert.equal(rootManifest.assets.ambienceScenes[18].path, "obsidian-epoch/assets/ambience/starship-graveyard-drift-lights-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[19].sceneKey, "abandoned_subway_signal_fog");
  assert.equal(rootManifest.assets.ambienceScenes[19].path, "obsidian-epoch/assets/ambience/abandoned-subway-signal-fog-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[20].sceneKey, "holographic_theater_spectrum_stage");
  assert.equal(rootManifest.assets.ambienceScenes[20].path, "obsidian-epoch/assets/ambience/holographic-theater-spectrum-stage-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[21].sceneKey, "quantum_laboratory_probability_glass");
  assert.equal(rootManifest.assets.ambienceScenes[21].path, "obsidian-epoch/assets/ambience/quantum-laboratory-probability-glass-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[22].sceneKey, "reflective_city_mirror_boulevard");
  assert.equal(rootManifest.assets.ambienceScenes[22].path, "obsidian-epoch/assets/ambience/reflective-city-mirror-boulevard-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[23].sceneKey, "data_alley_cache_signs");
  assert.equal(rootManifest.assets.ambienceScenes[23].path, "obsidian-epoch/assets/ambience/data-alley-cache-signs-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[24].sceneKey, "prism_waters_spectrum_tide");
  assert.equal(rootManifest.assets.ambienceScenes[24].path, "obsidian-epoch/assets/ambience/prism-waters-spectrum-tide-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[25].sceneKey, "probability_greenhouse_branch_lab");
  assert.equal(rootManifest.assets.ambienceScenes[25].path, "obsidian-epoch/assets/ambience/probability-greenhouse-branch-lab-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[26].sceneKey, "prophecy_server_cold_oracle");
  assert.equal(rootManifest.assets.ambienceScenes[26].path, "obsidian-epoch/assets/ambience/prophecy-server-cold-oracle-ambience.png");
  assert.equal(rootManifest.assets.ambienceScenes[27].sceneKey, "orbital_cathedral_bell_halo");
  assert.equal(rootManifest.assets.ambienceScenes[27].path, "obsidian-epoch/assets/ambience/orbital-cathedral-bell-halo-ambience.png");
  assert.deepEqual(skillManifest.assets.ambienceScenes, rootManifest.assets.ambienceScenes);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/gray-harbor-night-watch-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/moonwell-hollow-meditation-grove-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/black-harbor-night-ledger-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/ash-waste-cinder-camp-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/city-pipes-drip-market-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/abandoned-mine-echo-shaft-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/data-tower-cache-rain-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/orbit-city-docking-ring-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/trench-dream-current-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/collective-dream-pool-lanterns-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/space-rift-edge-lights-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/non-euclidean-cave-gravity-fold-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/starship-graveyard-drift-lights-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/abandoned-subway-signal-fog-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/holographic-theater-spectrum-stage-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/quantum-laboratory-probability-glass-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/reflective-city-mirror-boulevard-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/data-alley-cache-signs-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/prism-waters-spectrum-tide-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/probability-greenhouse-branch-lab-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/prophecy-server-cold-oracle-ambience.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/ambience/orbital-cathedral-bell-halo-ambience.png") || Buffer.alloc(0), 1280, 720);
  assert.equal(rootManifest.assets.worldScenes.length, 54);
  assert.equal(skillManifest.assets.worldScenes.length, 54);
  for (const regionId of ["region_gray_harbor", "region_ash_outpost", "region_salt_mirror_coast", "region_glass_archive", "region_moonwell_hollow"]) {
    assert.equal(rootManifest.assets.worldScenes.filter((asset: { regionId: string }) => asset.regionId === regionId).length, 2);
  }
  for (const regionId of ["region_blackharbor", "region_forest", "region_salt_gate", "region_ash", "region_city_pipes", "region_abandoned_mine", "region_data_tower", "region_orbit_city", "region_trench", "region_collective_dream_pool", "region_space_rift", "region_non_euclidean_cave", "region_starship_graveyard", "region_abandoned_subway", "region_holographic_theater", "region_quantum_laboratory", "region_reflective_city", "region_data_alley", "region_prism_waters", "region_probability_greenhouse", "region_prophecy_server", "region_orbital_cathedral"]) {
    assert.equal(rootManifest.assets.worldScenes.filter((asset: { regionId: string }) => asset.regionId === regionId).length, 2);
  }
  assert.equal(rootManifest.assets.worldScenes[0].sceneKey, "gray_harbor_gate");
  assert.equal(rootManifest.assets.worldScenes[0].regionId, "region_gray_harbor");
  assert.equal(rootManifest.assets.worldScenes[0].path, "obsidian-epoch/assets/world-scene/gray-harbor-gate-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[0].url, "/api/epoch/assets/world-scene/gray-harbor-gate-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[0].contentType, "image/png");
  assert.match(rootManifest.assets.worldScenes[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.worldScenes[1].sceneKey, "gray_harbor_lantern_market");
  assert.equal(rootManifest.assets.worldScenes[1].regionId, "region_gray_harbor");
  assert.equal(rootManifest.assets.worldScenes[1].path, "obsidian-epoch/assets/world-scene/gray-harbor-lantern-market-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[1].url, "/api/epoch/assets/world-scene/gray-harbor-lantern-market-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[1].contentType, "image/png");
  assert.match(rootManifest.assets.worldScenes[1].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.worldScenes[3].sceneKey, "ash_outpost_drill_yard");
  assert.equal(rootManifest.assets.worldScenes[3].regionId, "region_ash_outpost");
  assert.equal(rootManifest.assets.worldScenes[3].path, "obsidian-epoch/assets/world-scene/ash-outpost-drill-yard-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[3].url, "/api/epoch/assets/world-scene/ash-outpost-drill-yard-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[7].sceneKey, "glass_archive_index_bridge");
  assert.equal(rootManifest.assets.worldScenes[9].sceneKey, "moonwell_hollow_meditation_ring");
  assert.equal(rootManifest.assets.worldScenes[10].sceneKey, "black_harbor_toll_quay");
  assert.equal(rootManifest.assets.worldScenes[10].regionId, "region_blackharbor");
  assert.equal(rootManifest.assets.worldScenes[10].path, "obsidian-epoch/assets/world-scene/black-harbor-toll-quay-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[10].url, "/api/epoch/assets/world-scene/black-harbor-toll-quay-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[13].sceneKey, "forest_moss_shrine");
  assert.equal(rootManifest.assets.worldScenes[13].regionId, "region_forest");
  assert.equal(rootManifest.assets.worldScenes[13].path, "obsidian-epoch/assets/world-scene/forest-moss-shrine-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[14].sceneKey, "salt_gate_customs_yard");
  assert.equal(rootManifest.assets.worldScenes[14].regionId, "region_salt_gate");
  assert.equal(rootManifest.assets.worldScenes[14].path, "obsidian-epoch/assets/world-scene/salt-gate-customs-yard-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[17].sceneKey, "ash_waste_cinder_well");
  assert.equal(rootManifest.assets.worldScenes[17].regionId, "region_ash");
  assert.equal(rootManifest.assets.worldScenes[17].path, "obsidian-epoch/assets/world-scene/ash-waste-cinder-well-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[18].sceneKey, "city_pipes_valve_market");
  assert.equal(rootManifest.assets.worldScenes[18].regionId, "region_city_pipes");
  assert.equal(rootManifest.assets.worldScenes[18].path, "obsidian-epoch/assets/world-scene/city-pipes-valve-market-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[21].sceneKey, "abandoned_mine_echo_shaft");
  assert.equal(rootManifest.assets.worldScenes[21].regionId, "region_abandoned_mine");
  assert.equal(rootManifest.assets.worldScenes[21].path, "obsidian-epoch/assets/world-scene/abandoned-mine-echo-shaft-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[22].sceneKey, "data_tower_cache_spire");
  assert.equal(rootManifest.assets.worldScenes[22].regionId, "region_data_tower");
  assert.equal(rootManifest.assets.worldScenes[22].path, "obsidian-epoch/assets/world-scene/data-tower-cache-spire-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[25].sceneKey, "orbit_city_beacon_bazaar");
  assert.equal(rootManifest.assets.worldScenes[25].regionId, "region_orbit_city");
  assert.equal(rootManifest.assets.worldScenes[25].path, "obsidian-epoch/assets/world-scene/orbit-city-beacon-bazaar-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[26].sceneKey, "trench_cold_lantern_shelf");
  assert.equal(rootManifest.assets.worldScenes[26].regionId, "region_trench");
  assert.equal(rootManifest.assets.worldScenes[26].path, "obsidian-epoch/assets/world-scene/trench-cold-lantern-shelf-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[29].sceneKey, "collective_dream_pool_memory_isles");
  assert.equal(rootManifest.assets.worldScenes[29].regionId, "region_collective_dream_pool");
  assert.equal(rootManifest.assets.worldScenes[29].path, "obsidian-epoch/assets/world-scene/collective-dream-pool-memory-isles-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[30].sceneKey, "space_rift_fracture_gate");
  assert.equal(rootManifest.assets.worldScenes[30].regionId, "region_space_rift");
  assert.equal(rootManifest.assets.worldScenes[30].path, "obsidian-epoch/assets/world-scene/space-rift-fracture-gate-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[33].sceneKey, "non_euclidean_cave_gravity_well");
  assert.equal(rootManifest.assets.worldScenes[33].regionId, "region_non_euclidean_cave");
  assert.equal(rootManifest.assets.worldScenes[33].path, "obsidian-epoch/assets/world-scene/non-euclidean-cave-gravity-well-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[34].sceneKey, "starship_graveyard_broken_hulls");
  assert.equal(rootManifest.assets.worldScenes[34].regionId, "region_starship_graveyard");
  assert.equal(rootManifest.assets.worldScenes[34].path, "obsidian-epoch/assets/world-scene/starship-graveyard-broken-hulls-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[37].sceneKey, "abandoned_subway_flooded_turnstile");
  assert.equal(rootManifest.assets.worldScenes[37].regionId, "region_abandoned_subway");
  assert.equal(rootManifest.assets.worldScenes[37].path, "obsidian-epoch/assets/world-scene/abandoned-subway-flooded-turnstile-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[38].sceneKey, "holographic_theater_false_applause");
  assert.equal(rootManifest.assets.worldScenes[38].regionId, "region_holographic_theater");
  assert.equal(rootManifest.assets.worldScenes[38].path, "obsidian-epoch/assets/world-scene/holographic-theater-false-applause-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[41].sceneKey, "quantum_laboratory_collapse_bridge");
  assert.equal(rootManifest.assets.worldScenes[41].regionId, "region_quantum_laboratory");
  assert.equal(rootManifest.assets.worldScenes[41].path, "obsidian-epoch/assets/world-scene/quantum-laboratory-collapse-bridge-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[42].sceneKey, "reflective_city_mirror_boulevard");
  assert.equal(rootManifest.assets.worldScenes[42].regionId, "region_reflective_city");
  assert.equal(rootManifest.assets.worldScenes[42].path, "obsidian-epoch/assets/world-scene/reflective-city-mirror-boulevard-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[45].sceneKey, "data_alley_packet_market");
  assert.equal(rootManifest.assets.worldScenes[45].regionId, "region_data_alley");
  assert.equal(rootManifest.assets.worldScenes[45].path, "obsidian-epoch/assets/world-scene/data-alley-packet-market-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[46].sceneKey, "prism_waters_spectrum_tide");
  assert.equal(rootManifest.assets.worldScenes[46].regionId, "region_prism_waters");
  assert.equal(rootManifest.assets.worldScenes[46].path, "obsidian-epoch/assets/world-scene/prism-waters-spectrum-tide-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[49].sceneKey, "probability_greenhouse_seed_market");
  assert.equal(rootManifest.assets.worldScenes[49].regionId, "region_probability_greenhouse");
  assert.equal(rootManifest.assets.worldScenes[49].path, "obsidian-epoch/assets/world-scene/probability-greenhouse-seed-market-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[50].sceneKey, "prophecy_server_cold_oracle");
  assert.equal(rootManifest.assets.worldScenes[50].regionId, "region_prophecy_server");
  assert.equal(rootManifest.assets.worldScenes[50].path, "obsidian-epoch/assets/world-scene/prophecy-server-cold-oracle-world-scene.png");
  assert.equal(rootManifest.assets.worldScenes[53].sceneKey, "orbital_cathedral_nave_ring");
  assert.equal(rootManifest.assets.worldScenes[53].regionId, "region_orbital_cathedral");
  assert.equal(rootManifest.assets.worldScenes[53].path, "obsidian-epoch/assets/world-scene/orbital-cathedral-nave-ring-world-scene.png");
  assert.deepEqual(skillManifest.assets.worldScenes, rootManifest.assets.worldScenes);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/gray-harbor-gate-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/gray-harbor-lantern-market-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/ash-outpost-drill-yard-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/salt-mirror-causeway-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/glass-archive-index-bridge-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/moonwell-hollow-meditation-ring-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/black-harbor-toll-quay-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/forest-moss-shrine-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/salt-gate-customs-yard-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/ash-waste-cinder-well-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/city-pipes-valve-market-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/abandoned-mine-echo-shaft-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/data-tower-cache-spire-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/orbit-city-beacon-bazaar-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/trench-cold-lantern-shelf-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/collective-dream-pool-memory-isles-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/space-rift-fracture-gate-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/non-euclidean-cave-gravity-well-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/starship-graveyard-broken-hulls-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/abandoned-subway-flooded-turnstile-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/holographic-theater-false-applause-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/quantum-laboratory-collapse-bridge-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/reflective-city-mirror-boulevard-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/data-alley-packet-market-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/prism-waters-spectrum-tide-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/probability-greenhouse-seed-market-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/prophecy-server-cold-oracle-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/world-scene/orbital-cathedral-nave-ring-world-scene.png") || Buffer.alloc(0), 1280, 720);
  assert.equal(rootManifest.assets.sceneVariants.length, 64);
  assert.equal(skillManifest.assets.sceneVariants.length, 64);
  for (const regionId of ["region_gray_harbor", "region_ash_outpost", "region_salt_mirror_coast", "region_glass_archive", "region_moonwell_hollow"]) {
    assert.equal(rootManifest.assets.sceneVariants.filter((asset: { regionId: string }) => asset.regionId === regionId).length, 4);
  }
  for (const regionId of ["region_blackharbor", "region_forest", "region_salt_gate", "region_ash", "region_city_pipes", "region_abandoned_mine", "region_data_tower", "region_orbit_city", "region_trench", "region_collective_dream_pool", "region_space_rift", "region_non_euclidean_cave", "region_starship_graveyard", "region_abandoned_subway", "region_holographic_theater", "region_quantum_laboratory", "region_reflective_city", "region_data_alley", "region_prism_waters", "region_probability_greenhouse", "region_prophecy_server", "region_orbital_cathedral"]) {
    assert.equal(rootManifest.assets.sceneVariants.filter((asset: { regionId: string }) => asset.regionId === regionId).length, 2);
  }
  assert.equal(rootManifest.assets.sceneVariants[0].variantKey, "gray_harbor_dawn");
  assert.equal(rootManifest.assets.sceneVariants[0].regionId, "region_gray_harbor");
  assert.equal(rootManifest.assets.sceneVariants[0].timeOfDay, "dawn");
  assert.equal(rootManifest.assets.sceneVariants[0].weather, "mist");
  assert.equal(rootManifest.assets.sceneVariants[0].path, "obsidian-epoch/assets/scene-variant/gray-harbor-dawn-scene-variant.png");
  assert.equal(rootManifest.assets.sceneVariants[0].url, "/api/epoch/assets/scene-variant/gray-harbor-dawn-scene-variant.png");
  assert.equal(rootManifest.assets.sceneVariants[0].contentType, "image/png");
  assert.match(rootManifest.assets.sceneVariants[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.sceneVariants[2].variantKey, "gray_harbor_market_evening");
  assert.equal(rootManifest.assets.sceneVariants[2].regionId, "region_gray_harbor");
  assert.equal(rootManifest.assets.sceneVariants[2].timeOfDay, "dusk");
  assert.equal(rootManifest.assets.sceneVariants[2].weather, "clear");
  assert.equal(rootManifest.assets.sceneVariants[2].path, "obsidian-epoch/assets/scene-variant/gray-harbor-market-evening-scene-variant.png");
  assert.equal(rootManifest.assets.sceneVariants[2].url, "/api/epoch/assets/scene-variant/gray-harbor-market-evening-scene-variant.png");
  assert.equal(rootManifest.assets.sceneVariants[2].contentType, "image/png");
  assert.match(rootManifest.assets.sceneVariants[2].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.sceneVariants[3].variantKey, "gray_harbor_quiet_midnight");
  assert.equal(rootManifest.assets.sceneVariants[3].regionId, "region_gray_harbor");
  assert.equal(rootManifest.assets.sceneVariants[3].timeOfDay, "night");
  assert.equal(rootManifest.assets.sceneVariants[3].weather, "mist");
  assert.equal(rootManifest.assets.sceneVariants[3].path, "obsidian-epoch/assets/scene-variant/gray-harbor-quiet-midnight-scene-variant.png");
  assert.equal(rootManifest.assets.sceneVariants[3].url, "/api/epoch/assets/scene-variant/gray-harbor-quiet-midnight-scene-variant.png");
  assert.equal(rootManifest.assets.sceneVariants[3].contentType, "image/png");
  assert.match(rootManifest.assets.sceneVariants[3].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.sceneVariants[6].variantKey, "ash_outpost_noon_watch");
  assert.equal(rootManifest.assets.sceneVariants[6].regionId, "region_ash_outpost");
  assert.equal(rootManifest.assets.sceneVariants[6].timeOfDay, "noon");
  assert.equal(rootManifest.assets.sceneVariants[6].weather, "clear");
  assert.equal(rootManifest.assets.sceneVariants[6].path, "obsidian-epoch/assets/scene-variant/ash-outpost-noon-watch-scene-variant.png");
  assert.equal(rootManifest.assets.sceneVariants[7].variantKey, "ash_outpost_night_forge");
  assert.equal(rootManifest.assets.sceneVariants[11].variantKey, "salt_mirror_twilight_brine");
  assert.equal(rootManifest.assets.sceneVariants[15].variantKey, "glass_archive_twilight_vigil");
  assert.equal(rootManifest.assets.sceneVariants[19].variantKey, "moonwell_hollow_noon_grove");
  assert.equal(rootManifest.assets.sceneVariants[18].variantKey, "moonwell_hollow_dawn_training");
  assert.equal(rootManifest.assets.sceneVariants[20].variantKey, "black_harbor_fog_dawn");
  assert.equal(rootManifest.assets.sceneVariants[20].regionId, "region_blackharbor");
  assert.equal(rootManifest.assets.sceneVariants[20].timeOfDay, "dawn");
  assert.equal(rootManifest.assets.sceneVariants[20].weather, "brine_fog");
  assert.equal(rootManifest.assets.sceneVariants[20].path, "obsidian-epoch/assets/scene-variant/black-harbor-fog-dawn-scene-variant.png");
  assert.equal(rootManifest.assets.sceneVariants[23].variantKey, "forest_rain_glade");
  assert.equal(rootManifest.assets.sceneVariants[23].regionId, "region_forest");
  assert.equal(rootManifest.assets.sceneVariants[23].weather, "rain");
  assert.equal(rootManifest.assets.sceneVariants[24].variantKey, "salt_gate_wind_dawn");
  assert.equal(rootManifest.assets.sceneVariants[24].regionId, "region_salt_gate");
  assert.equal(rootManifest.assets.sceneVariants[24].weather, "brine_fog");
  assert.equal(rootManifest.assets.sceneVariants[27].variantKey, "ash_waste_cold_night");
  assert.equal(rootManifest.assets.sceneVariants[27].regionId, "region_ash");
  assert.equal(rootManifest.assets.sceneVariants[27].weather, "ashfall");
  assert.equal(rootManifest.assets.sceneVariants[28].variantKey, "city_pipes_sodium_dawn");
  assert.equal(rootManifest.assets.sceneVariants[28].regionId, "region_city_pipes");
  assert.equal(rootManifest.assets.sceneVariants[28].weather, "mist");
  assert.equal(rootManifest.assets.sceneVariants[31].variantKey, "abandoned_mine_blue_night");
  assert.equal(rootManifest.assets.sceneVariants[31].regionId, "region_abandoned_mine");
  assert.equal(rootManifest.assets.sceneVariants[31].weather, "silver_dust");
  assert.equal(rootManifest.assets.sceneVariants[32].variantKey, "data_tower_static_dawn");
  assert.equal(rootManifest.assets.sceneVariants[32].regionId, "region_data_tower");
  assert.equal(rootManifest.assets.sceneVariants[32].weather, "mist");
  assert.equal(rootManifest.assets.sceneVariants[35].variantKey, "orbit_city_eclipse_watch");
  assert.equal(rootManifest.assets.sceneVariants[35].regionId, "region_orbit_city");
  assert.equal(rootManifest.assets.sceneVariants[35].weather, "eclipse");
  assert.equal(rootManifest.assets.sceneVariants[36].variantKey, "trench_blue_midnight");
  assert.equal(rootManifest.assets.sceneVariants[36].regionId, "region_trench");
  assert.equal(rootManifest.assets.sceneVariants[36].weather, "moonlit");
  assert.equal(rootManifest.assets.sceneVariants[39].variantKey, "collective_dream_pool_eclipse");
  assert.equal(rootManifest.assets.sceneVariants[39].regionId, "region_collective_dream_pool");
  assert.equal(rootManifest.assets.sceneVariants[39].weather, "eclipse");
  assert.equal(rootManifest.assets.sceneVariants[40].variantKey, "space_rift_violet_dawn");
  assert.equal(rootManifest.assets.sceneVariants[40].regionId, "region_space_rift");
  assert.equal(rootManifest.assets.sceneVariants[40].weather, "silver_dust");
  assert.equal(rootManifest.assets.sceneVariants[43].variantKey, "non_euclidean_cave_eclipse_fold");
  assert.equal(rootManifest.assets.sceneVariants[43].regionId, "region_non_euclidean_cave");
  assert.equal(rootManifest.assets.sceneVariants[43].weather, "eclipse");
  assert.equal(rootManifest.assets.sceneVariants[44].variantKey, "starship_graveyard_cold_dawn");
  assert.equal(rootManifest.assets.sceneVariants[44].regionId, "region_starship_graveyard");
  assert.equal(rootManifest.assets.sceneVariants[44].weather, "silver_dust");
  assert.equal(rootManifest.assets.sceneVariants[47].variantKey, "abandoned_subway_moonlit_tunnel");
  assert.equal(rootManifest.assets.sceneVariants[47].regionId, "region_abandoned_subway");
  assert.equal(rootManifest.assets.sceneVariants[47].weather, "moonlit");
  assert.equal(rootManifest.assets.sceneVariants[48].variantKey, "holographic_theater_neon_dusk");
  assert.equal(rootManifest.assets.sceneVariants[48].regionId, "region_holographic_theater");
  assert.equal(rootManifest.assets.sceneVariants[48].weather, "clear");
  assert.equal(rootManifest.assets.sceneVariants[51].variantKey, "quantum_laboratory_eclipse_trial");
  assert.equal(rootManifest.assets.sceneVariants[51].regionId, "region_quantum_laboratory");
  assert.equal(rootManifest.assets.sceneVariants[51].weather, "eclipse");
  assert.equal(rootManifest.assets.sceneVariants[52].variantKey, "reflective_city_glare_noon");
  assert.equal(rootManifest.assets.sceneVariants[52].regionId, "region_reflective_city");
  assert.equal(rootManifest.assets.sceneVariants[52].weather, "clear");
  assert.equal(rootManifest.assets.sceneVariants[55].variantKey, "data_alley_blackout_night");
  assert.equal(rootManifest.assets.sceneVariants[55].regionId, "region_data_alley");
  assert.equal(rootManifest.assets.sceneVariants[55].weather, "moonlit");
  assert.equal(rootManifest.assets.sceneVariants[56].variantKey, "prism_waters_rainbow_dawn");
  assert.equal(rootManifest.assets.sceneVariants[56].regionId, "region_prism_waters");
  assert.equal(rootManifest.assets.sceneVariants[56].weather, "mist");
  assert.equal(rootManifest.assets.sceneVariants[59].variantKey, "probability_greenhouse_eclipse_harvest");
  assert.equal(rootManifest.assets.sceneVariants[59].regionId, "region_probability_greenhouse");
  assert.equal(rootManifest.assets.sceneVariants[59].weather, "eclipse");
  assert.deepEqual(skillManifest.assets.sceneVariants, rootManifest.assets.sceneVariants);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/gray-harbor-dawn-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/gray-harbor-market-evening-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/gray-harbor-quiet-midnight-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/ash-outpost-noon-watch-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/salt-mirror-twilight-brine-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/glass-archive-twilight-vigil-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/moonwell-hollow-noon-grove-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/moonwell-hollow-night-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/black-harbor-fog-dawn-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/forest-rain-glade-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/salt-gate-market-noon-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/ash-waste-cold-night-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/data-tower-static-dawn-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/orbit-city-eclipse-watch-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/city-pipes-sodium-dawn-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/abandoned-mine-blue-night-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/trench-blue-midnight-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/collective-dream-pool-eclipse-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/space-rift-violet-dawn-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/non-euclidean-cave-eclipse-fold-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/reflective-city-glare-noon-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/data-alley-blackout-night-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/prism-waters-rainbow-dawn-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assertPngDimensions(entries.get("obsidian-epoch/assets/scene-variant/probability-greenhouse-eclipse-harvest-scene-variant.png") || Buffer.alloc(0), 1280, 720);
  assert.equal(rootManifest.assets.eventStates.length, 6);
  assert.equal(skillManifest.assets.eventStates.length, 6);
  assert.equal(rootManifest.assets.eventStates[0].stateKey, "resource_node_open");
  assert.equal(rootManifest.assets.eventStates[0].path, "obsidian-epoch/assets/event-state/resource-node-open-event-state.png");
  assert.equal(rootManifest.assets.eventStates[0].url, "/api/epoch/assets/event-state/resource-node-open-event-state.png");
  assert.equal(rootManifest.assets.eventStates[0].contentType, "image/png");
  assert.match(rootManifest.assets.eventStates[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.eventStates[5].stateKey, "season_resolution");
  assert.equal(rootManifest.assets.eventStates[5].path, "obsidian-epoch/assets/event-state/season-resolution-event-state.png");
  assert.deepEqual(skillManifest.assets.eventStates, rootManifest.assets.eventStates);
  assertPngDimensions(entries.get("obsidian-epoch/assets/event-state/resource-node-open-event-state.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/event-state/season-resolution-event-state.png") || Buffer.alloc(0), 960, 540);
  assert.equal(rootManifest.assets.factions.length, 3);
  assert.equal(skillManifest.assets.factions.length, 3);
  assert.equal(rootManifest.assets.factions[0].factionId, "gray_watch");
  assert.equal(rootManifest.assets.factions[0].path, "obsidian-epoch/assets/faction/gray-watch-emblem.png");
  assert.equal(rootManifest.assets.factions[0].url, "/api/epoch/assets/faction/gray-watch-emblem.png");
  assert.equal(rootManifest.assets.factions[0].contentType, "image/png");
  assert.match(rootManifest.assets.factions[0].sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(skillManifest.assets.factions, rootManifest.assets.factions);
  assertPngDimensions(entries.get("obsidian-epoch/assets/faction/gray-watch-emblem.png") || Buffer.alloc(0), 512, 512);
  assert.equal(rootManifest.assets.seasonBanners.length, 3);
  assert.equal(skillManifest.assets.seasonBanners.length, 3);
  assert.equal(rootManifest.assets.seasonBanners[0].seasonKey, "gray_harbor_faction_season");
  assert.equal(rootManifest.assets.seasonBanners[0].path, "obsidian-epoch/assets/season/gray-harbor-faction-season-banner.png");
  assert.equal(rootManifest.assets.seasonBanners[0].url, "/api/epoch/assets/season/gray-harbor-faction-season-banner.png");
  assert.equal(rootManifest.assets.seasonBanners[0].contentType, "image/png");
  assert.match(rootManifest.assets.seasonBanners[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(rootManifest.assets.seasonBanners[1].seasonKey, "cinder_archive_season");
  assert.equal(rootManifest.assets.seasonBanners[1].path, "obsidian-epoch/assets/season/cinder-archive-season-banner.png");
  assert.equal(rootManifest.assets.seasonBanners[2].seasonKey, "white_tower_compact_season");
  assert.equal(rootManifest.assets.seasonBanners[2].path, "obsidian-epoch/assets/season/white-tower-compact-season-banner.png");
  assert.deepEqual(skillManifest.assets.seasonBanners, rootManifest.assets.seasonBanners);
  assertPngDimensions(entries.get("obsidian-epoch/assets/season/gray-harbor-faction-season-banner.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/season/cinder-archive-season-banner.png") || Buffer.alloc(0), 960, 540);
  assertPngDimensions(entries.get("obsidian-epoch/assets/season/white-tower-compact-season-banner.png") || Buffer.alloc(0), 960, 540);
  assert.equal(rootManifest.playbooks.oneTurn, "obsidian-epoch/references/one-turn-playbook.md");
  assert.equal(skillManifest.playbooks.oneTurn, "obsidian-epoch/references/one-turn-playbook.md");
  assert.equal(rootManifest.playbooks.smokeE2E, "obsidian-epoch/references/smoke-playbook.md");
  assert.equal(skillManifest.playbooks.smokeE2E, "obsidian-epoch/references/smoke-playbook.md");
  assert.equal(rootManifest.playbooks.webBridge, "obsidian-epoch/references/web-llm-bridge-playbook.md");
  assert.equal(skillManifest.playbooks.webBridge, "obsidian-epoch/references/web-llm-bridge-playbook.md");
  assert.equal(rootManifest.playbooks.attestedRunner, "obsidian-epoch/references/attested-runner-playbook.md");
  assert.equal(skillManifest.playbooks.attestedRunner, "obsidian-epoch/references/attested-runner-playbook.md");
  assert.ok(entries.has("obsidian-epoch/references/attested-runner-playbook.md"));
  const attestedRunnerPlaybook = entries.get("obsidian-epoch/references/attested-runner-playbook.md")?.toString("utf8") || "";
  assert.match(attestedRunnerPlaybook, /agent:sign-attestation/);
  assert.match(attestedRunnerPlaybook, /agent:verify-attested-receipt/);
  assert.match(attestedRunnerPlaybook, /--result-url/);
  assert.match(attestedRunnerPlaybook, /--result-json/);
  assert.match(attestedRunnerPlaybook, /--all-trusted-executions/);
  assert.match(attestedRunnerPlaybook, /receipt\.trustedExecution\[\]/);
  assert.match(attestedRunnerPlaybook, /trustedExecution\.signatureBase/);
  assert.match(attestedRunnerPlaybook, /trustedExecution\.signatureHash/);
  assert.match(attestedRunnerPlaybook, /trustedExecution\.signatureBaseHash/);
  assert.match(attestedRunnerPlaybook, /--secret-file[\s\S]*OBSIDIAN_EPOCH_ATTESTED_SIGNATURE_BASE/);
  assert.match(attestedRunnerPlaybook, /createHmac\("sha256", runnerSecret\)\.update\(signatureBase\)\.digest\("hex"\)/);
  assert.match(attestedRunnerPlaybook, /sha256:\$\{createHash\("sha256"\)\.update\(rawSignature\)\.digest\("hex"\)\}/);
  assert.match(attestedRunnerPlaybook, /raw runner secret[\s\S]*raw HMAC signature[\s\S]*not public/);
  assert.equal(rootManifest.verification.installSmokeCommand, "npm run agent:install-smoke -- --json");
  assert.equal(skillManifest.verification.installSmokeCommand, "npm run agent:install-smoke -- --json");
  assert.equal(rootManifest.verification.remoteInstallSmokeCommand, "npm run agent:install-smoke -- --server <serverBase> --json");
  assert.equal(skillManifest.verification.remoteInstallSmokeCommand, "npm run agent:install-smoke -- --server <serverBase> --json");
  assert.equal(rootManifest.verification.recoveryDrillCommand, "npm run agent:recovery-drill -- --json");
  assert.equal(skillManifest.verification.recoveryDrillCommand, "npm run agent:recovery-drill -- --json");
  assert.equal(rootManifest.verification.backupCommand, "npm run agent:backup -- --json");
  assert.equal(skillManifest.verification.backupCommand, "npm run agent:backup -- --json");
  assert.equal(rootManifest.verification.restoreBackupCommand, "npm run agent:restore-backup -- --json");
  assert.equal(skillManifest.verification.restoreBackupCommand, "npm run agent:restore-backup -- --json");
  assert.equal(rootManifest.verification.releaseRehearsalCommand, "npm run agent:release-rehearsal -- --server <serverBase> --operator-key <operatorKey> --json");
  assert.equal(skillManifest.verification.releaseRehearsalCommand, "npm run agent:release-rehearsal -- --server <serverBase> --operator-key <operatorKey> --json");
  assert.equal(rootManifest.verification.productionReleaseRehearsalCommand, "npm run agent:release-rehearsal -- --server <publicHttpsOrigin> --operator-key <operatorKey> --expected-release-key-id <releaseKeyId> --production --json");
  assert.equal(skillManifest.verification.productionReleaseRehearsalCommand, "npm run agent:release-rehearsal -- --server <publicHttpsOrigin> --operator-key <operatorKey> --expected-release-key-id <releaseKeyId> --production --json");
  assert.equal(rootManifest.verification.packageIntegrityManifest, "obsidian-epoch/assets/package-integrity.json");
  assert.equal(skillManifest.verification.packageIntegrityManifest, "obsidian-epoch/assets/package-integrity.json");
  assert.equal(rootManifest.verification.packageSignatureAlgorithm, "Ed25519");
  assert.equal(skillManifest.verification.packageSignatureAlgorithm, "Ed25519");
  assert.match(rootManifest.verification.packageReleasePublicKey, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.equal(skillManifest.verification.packageReleasePublicKey, rootManifest.verification.packageReleasePublicKey);
  assert.match(rootManifest.verification.packageReleaseKeyId, /^[a-f0-9]{64}$/);
  assert.equal(skillManifest.verification.packageReleaseKeyId, rootManifest.verification.packageReleaseKeyId);
  assert.equal(rootManifest.verification.packageSigningTrust, "local_alpha_fallback");
  assert.equal(skillManifest.verification.packageSigningTrust, "local_alpha_fallback");
  assert.equal(rootManifest.verification.packageSigningKeySource, "ephemeral_local_alpha_fallback");
  assert.equal(verifyObsidianEpochPackageSignature([...entries].map(([name, content]) => ({ name, content })), {
    publicKey: rootManifest.verification.packageReleasePublicKey,
  }).verified, true);
  for (const host of ["Claude Code", "Codex", "Cursor", "Hermes", "OpenClaw"]) {
    const entry = hostInstall.find((item) => item.host === host);
    assert.ok(entry, `missing host install entry for ${host}`);
    assert.ok(entry.mcp, `missing MCP config for ${host}`);
    assert.equal(entry.quickstart?.tool, "obsidian_epoch.quickstart");
    assert.equal(entry.quickstart?.firstTurnPlaybook, "obsidian-epoch/references/one-turn-playbook.md");
    assert.equal(entry.mcp.transport, "streamable-http");
    assert.equal(entry.mcp.url, "http://127.0.0.1:8787/mcp");
    assert.equal(entry.mcp.protocolVersion, "2025-06-18");
    assert.equal(entry.mcp.headers.Authorization, "Bearer ${AGENT_WORLD_MCP_TOKEN}");
    assert.match(JSON.stringify(entry), /obsidian-epoch-agent-world/);
    const mcpSnippet = entry.configSnippets?.find((snippet) => snippet.label === `${host} MCP JSON`);
    assert.ok(mcpSnippet, `missing machine-readable MCP JSON snippet for ${host}`);
    assert.equal(mcpSnippet.format, "json");
    assert.match(mcpSnippet.pathHint, /mcp/i);
    assert.match(mcpSnippet.pathHint, /obsidian-epoch\/host-config\/.*\.json/);
    const hostConfig = JSON.parse(entries.get(mcpSnippet.pathHint)?.toString("utf8") || "{}");
    assert.deepEqual(hostConfig, mcpSnippet.body);
    const remoteConfig = host === "Hermes"
      ? mcpSnippet.body?.mcp_servers?.["obsidian-epoch-agent-world"]
      : host === "OpenClaw"
        ? mcpSnippet.body?.mcp?.servers?.["obsidian-epoch-agent-world"]
        : mcpSnippet.body?.mcpServers?.["obsidian-epoch-agent-world"];
    assert.equal(remoteConfig?.url, "http://127.0.0.1:8787/mcp");
    if (host === "Codex") assert.equal(remoteConfig?.bearer_token_env_var, "AGENT_WORLD_MCP_TOKEN");
    else assert.equal(remoteConfig?.headers?.Authorization, "Bearer ${AGENT_WORLD_MCP_TOKEN}");
    if (host === "OpenClaw") assert.equal(remoteConfig?.transport, "streamable-http");
    else if (host === "Hermes") assert.equal(remoteConfig?.enabled, true);
    else assert.equal(remoteConfig?.type, "http");
    assert.equal("command" in (remoteConfig || {}), false);
    assert.equal("cwd" in (remoteConfig || {}), false);
    assert.doesNotMatch(JSON.stringify(mcpSnippet.body), /tools\/graph-react-app/);
    if (host === "Codex") {
      const codexSnippet = entry.configSnippets?.find((snippet) => snippet.label === "Codex plugin manifest");
      assert.ok(codexSnippet, "missing Codex plugin manifest snippet");
      assert.equal(codexSnippet.format, "json");
      assert.equal(codexSnippet.pathHint, "obsidian-epoch/host-config/codex-plugin.json");
      const codexConfig = JSON.parse(entries.get(codexSnippet.pathHint)?.toString("utf8") || "{}");
      assert.deepEqual(codexConfig, codexSnippet.body);
      assert.equal(codexSnippet.body?.mcpServers, "./.mcp.json");
      assert.equal(codexSnippet.body?.skills, "./skills/");
      assert.equal(codexSnippet.body?.interface?.displayName, "黑曜纪元");
    }
  }
  const webBridgeEntry = hostInstall.find((item) => item.host === "Web LLM bridge");
  assert.ok(webBridgeEntry, "missing Web LLM bridge install entry");
  assert.equal(webBridgeEntry.type, "web-bridge");
  assert.equal(webBridgeEntry.bridge?.entryTool, "obsidian_epoch.web_bridge_turn");
  assert.equal(webBridgeEntry.bridge?.submitTool, "obsidian_epoch.submit_web_bridge_action");
  assert.equal(webBridgeEntry.bridge?.playbook, "obsidian-epoch/references/web-llm-bridge-playbook.md");
  assert.equal(webBridgeEntry.bridge?.publicPages?.console, "/epoch/console");
  assert.equal(webBridgeEntry.bridge?.publicPages?.install, "/epoch/install");
  assert.equal(webBridgeEntry.bridge?.publicPages?.world, "/epoch/world");
  assert.equal(webBridgeEntry.bridge?.publicPages?.auditIndex, "/epoch/audit");
  assert.equal(webBridgeEntry.bridge?.publicPages?.audit, "/epoch/audit/{eventId}");
  assert.equal(webBridgeEntry.bridge?.publicPages?.hosted, "/epoch/hosted/{sessionId}");
  assert.equal(webBridgeEntry.bridge?.publicPages?.result, "/epoch/result/{pageId}");
  const bridgeSnippet = webBridgeEntry.configSnippets?.find((snippet) => snippet.label === "Browser bridge sequence");
  assert.ok(bridgeSnippet, "missing Browser bridge sequence snippet");
  assert.equal(bridgeSnippet.format, "json");
  assert.equal(bridgeSnippet.pathHint, "obsidian-epoch/host-config/web-llm-bridge-sequence.json");
  const bridgeConfig = JSON.parse(entries.get(bridgeSnippet.pathHint)?.toString("utf8") || "{}");
  assert.deepEqual(bridgeConfig, bridgeSnippet.body);
  assert.equal(bridgeSnippet.body?.publicPages?.console, "/epoch/console");
  assert.equal(bridgeSnippet.body?.publicPages?.install, "/epoch/install");
  assert.equal(bridgeSnippet.body?.publicPages?.world, "/epoch/world");
  assert.equal(bridgeSnippet.body?.publicPages?.auditIndex, "/epoch/audit");
  assert.equal(bridgeSnippet.body?.publicPages?.audit, "/epoch/audit/{eventId}");
  assert.equal(bridgeSnippet.body?.publicPages?.hosted, "/epoch/hosted/{sessionId}");
  assert.equal(bridgeSnippet.body?.publicPages?.result, "/epoch/result/{pageId}");
  assert.deepEqual(bridgeSnippet.body?.steps?.map((step: { tool: string }) => step.tool), [
    "obsidian_epoch.web_bridge_turn",
    "obsidian_epoch.submit_web_bridge_action",
    "obsidian_epoch.create_result_page",
  ]);
  const integrity = JSON.parse(entries.get("obsidian-epoch/assets/package-integrity.json")?.toString("utf8") || "{}");
  for (const file of expectedHostConfigFiles) {
    const listed = integrity.files.find((entry: { path: string }) => entry.path === file);
    assert.ok(listed, `integrity manifest missing ${file}`);
    const content = entries.get(file) || Buffer.alloc(0);
    assert.equal(listed.bytes, content.byteLength);
    assert.equal(listed.sha256, createHash("sha256").update(content).digest("hex"));
  }
  assert.deepEqual(skillManifest.hostInstall, rootManifest.hostInstall);
  const packagedSkill = entries.get("obsidian-epoch/SKILL.md")?.toString("utf8") || "";
  assert.match(packagedSkill, /references\/host-install\.md/);
  assert.match(packagedSkill, /payload\.receipt\.channelClass[\s\S]*payload\.receipt\.deliveryTrust[\s\S]*payload\.receipt\.playMode[\s\S]*payload\.receipt\.trustTier/);
  assert.match(packagedSkill, /idempotencyKey[\s\S]*exact same command payload/);
  assert.match(packagedSkill, /aggregateId[\s\S]*direct trade[\s\S]*tradeId/);
  assert.match(packagedSkill, /adjudicate_lore_target[\s\S]*newAdjudicationId[\s\S]*previousAdjudicationId[\s\S]*never overwrites/);
  assert.match(packagedSkill, /record_lore_contribution[\s\S]*revisionMode[\s\S]*suggestion[\s\S]*derived[\s\S]*merge[\s\S]*downgrade[\s\S]*direct_edit[\s\S]*lore_revision_direct_edit_forbidden[\s\S]*non-original explorers[\s\S]*proposal-only[\s\S]*derived version/);
  assert.match(packagedSkill, /lore_targets[\s\S]*lineageDisplay[\s\S]*originAgentId[\s\S]*currentStatus[\s\S]*foldedContributionCounts[\s\S]*expandedTool[\s\S]*obsidian_epoch\.lore_contributions/);
  assert.match(packagedSkill, /faction[\s\S]*character\/NPC[\s\S]*location[\s\S]*real IP\/work[\s\S]*moderation_hold[\s\S]*real_ip_similarity[\s\S]*ipSimilarity/);
  assert.match(packagedSkill, /agent_world\.start_run[\s\S]*contextVersion[\s\S]*signedEnvelope[\s\S]*contentHash[\s\S]*signature[\s\S]*regionId[\s\S]*actionBudget[\s\S]*sequenceWindow[\s\S]*issued[\s\S]*active[\s\S]*submitted[\s\S]*settled[\s\S]*expired[\s\S]*void[\s\S]*agent_world\.run_heartbeat[\s\S]*heartbeatAt[\s\S]*agent_world\.archive_local_report[\s\S]*local_trial_archive[\s\S]*does not require runTicket[\s\S]*agent_world\.submit_battle_report[\s\S]*ticket_context_version_required[\s\S]*ticket_context_version_mismatch[\s\S]*ticket_context_envelope_required[\s\S]*ticket_context_envelope_mismatch[\s\S]*ticket_high_risk_confirmation_required[\s\S]*ticket_cooldown_rule_unverified[\s\S]*ticket_canonical_action_unverified[\s\S]*ticket_outcome_state_unverified[\s\S]*candidateClaims[\s\S]*does not raise score[\s\S]*server-capped claimSlots[\s\S]*sourceRewards[\s\S]*pending[\s\S]*released[\s\S]*claim status migration table[\s\S]*rumor[\s\S]*inscribed[\s\S]*manualApprovalId[\s\S]*canonAdoptionEventId[\s\S]*agent_world\.community_react[\s\S]*reactionPolicy\.claimStatusEffect[\s\S]*none[\s\S]*sorting[\s\S]*attention[\s\S]*truth adjudication[\s\S]*hidden_pending_review[\s\S]*disputeAbuseFlags[\s\S]*dispute_abuse[\s\S]*outbox\.summary[\s\S]*status[\s\S]*retryCount[\s\S]*deadLetter[\s\S]*agent_world\.outbox[\s\S]*dead-letter queue[\s\S]*agent_world\.replay_outbox[\s\S]*ticket_identity_archived[\s\S]*ticket_event_schema_invalid[\s\S]*ticket_event_sequence_invalid[\s\S]*ticket_item_use_unverified[\s\S]*ticket_region_mismatch[\s\S]*ticket_action_budget_exceeded[\s\S]*ticket_sequence_mismatch[\s\S]*legacy_run_submission_rate_limited/);
  assert.match(packagedSkill, /failurePublication[\s\S]*failurePublicationMode[\s\S]*anonymous_public[\s\S]*claim_only[\s\S]*personal_sealed[\s\S]*explorerId[\s\S]*agentId[\s\S]*claimPreview[\s\S]*agent_world\.public_world[\s\S]*失败回流信用 \+2[\s\S]*失败回流信用 \+1/);
  assert.match(packagedSkill, /review budget[\s\S]*identity reputation[\s\S]*runTicket[\s\S]*length[\s\S]*similarity[\s\S]*system load[\s\S]*delayed review queue[\s\S]*agent_world\.review_queue/);
  assert.match(packagedSkill, /reviewStatus[\s\S]*排队中[\s\S]*规则校验[\s\S]*轻审[\s\S]*重审[\s\S]*人工[\s\S]*完成[\s\S]*estimatedWait/);
  assert.match(packagedSkill, /contextSnapshot[\s\S]*settingCards[\s\S]*selectionReason[\s\S]*exposureLevel[\s\S]*retrievalParams[\s\S]*diversityPolicy[\s\S]*filteringReasons[\s\S]*low-exposure[\s\S]*agent_world\.context_snapshots/);
  assert.match(packagedSkill, /obsidian_epoch\.delete_result_page[\s\S]*deleted[\s\S]*deletionSummary\.minimalReference[\s\S]*anonymousSourceHash[\s\S]*fullPayloadHash[\s\S]*receiptPayloadHash/);
  assert.match(packagedSkill, /deletionSummary\.deletionRequest[\s\S]*hide_body[\s\S]*anonymize_source[\s\S]*withdraw_unadmitted_candidate[\s\S]*request_de_admission_review[\s\S]*退档复审/);
  assert.match(packagedSkill, /shareToken[\s\S]*shareVersion[\s\S]*result_page_share_version_required[\s\S]*result_page_share_version_mismatch/);
  assert.match(packagedSkill, /create_result_page[\s\S]*故事署名归你；入档发现会成为共享世界资料，可被他人引用。/);
  assert.match(packagedSkill, /agentSelfStatement[\s\S]*identity[\s\S]*region[\s\S]*recorded event facts[\s\S]*prompt[\s\S]*system[\s\S]*rules[\s\S]*model/);
  assert.match(packagedSkill, /promptLayers[\s\S]*system_policy[\s\S]*agent_identity_boundary[\s\S]*user_mandate[\s\S]*user_additional_instruction[\s\S]*additionalInstruction/);
  assert.match(packagedSkill, /goalPriority[\s\S]*safety_boundary[\s\S]*user_behavior_red_lines[\s\S]*user_mandate[\s\S]*agent_long_term_goals[\s\S]*opportunistic_side_quests/);
  assert.match(packagedSkill, /partyRunId[\s\S]*participantRole[\s\S]*multiAgentReservation[\s\S]*reserved_only[\s\S]*legacy authored-report party play/);
  assert.match(packagedSkill, /behaviorRedLines[\s\S]*not betraying allies[\s\S]*not harming civilians[\s\S]*not contacting old gods[\s\S]*explicit_user_authorization_required/);
  assert.match(packagedSkill, /drama[\s\S]*high-risk conflict[\s\S]*event chain/);
  assert.match(packagedSkill, /graphSync[\s\S]*pending_sync[\s\S]*synced[\s\S]*retry_later[\s\S]*待同步[\s\S]*已同步[\s\S]*稍后重试/);
  assert.match(packagedSkill, /custom TTS[\s\S]*voice\/音色 usage rights[\s\S]*customTtsHosting[\s\S]*not_hosted[\s\S]*celebrity-like/);
  assert.match(packagedSkill, /contentPolicy[\s\S]*AGENT_WORLD_CONTENT_POLICY_JSON[\s\S]*contentPolicyRegion[\s\S]*ageRating[\s\S]*contentWarnings[\s\S]*publicSharing/);
  assert.match(packagedSkill, /operationSwitches[\s\S]*AGENT_WORLD_OPERATION_SWITCHES_JSON[\s\S]*settlement[\s\S]*public_sharing[\s\S]*source_reward[\s\S]*rewardType[\s\S]*commissionType[\s\S]*chapterId[\s\S]*locationId[\s\S]*factionId[\s\S]*riskLevel/);
  assert.match(packagedSkill, /frontstageStatus[\s\S]*AGENT_WORLD_FRONTSTAGE_STATUS_JSON[\s\S]*档案馆审档暂停\/只读维护[\s\S]*数据没有丢失[\s\S]*localTrial[\s\S]*archiveLocalReport/);
  assert.match(packagedSkill, /growthQuality[\s\S]*growth_metrics_must_ship_with_quality_guardrails[\s\S]*valid_setting_rate[\s\S]*return_rate[\s\S]*duplicate_rate[\s\S]*core_vibe_score[\s\S]*abuse_rate/);
  assert.match(packagedSkill, /二局率[\s\S]*质量护栏/);
  assert.match(packagedSkill, /experimentId[\s\S]*mainRuleReview[\s\S]*experiment_main_rule_review_required[\s\S]*record_lore_contribution[\s\S]*submit_npc_candidate/);
  assert.match(packagedSkill, /turn_card[\s\S]*expiresAt[\s\S]*15 minutes/);
  assert.match(packagedSkill, /one outstanding[\s\S]*turn_card[\s\S]*turn_card_already_open/);
  assert.match(packagedSkill, /turn_card[\s\S]*sequence[\s\S]*nonce[\s\S]*resolve_turn/);
  assert.match(packagedSkill, /turn_card[\s\S]*signedEnvelope[\s\S]*contentHash[\s\S]*signature/);
  assert.match(packagedSkill, /resolve_turn[\s\S]*channelClass[\s\S]*envelopeId[\s\S]*turnCardId[\s\S]*sequence[\s\S]*actionOptionId/);
  assert.match(packagedSkill, /`resolve_turn` result declares[\s\S]*signedEnvelope[\s\S]*contentHash[\s\S]*signature/);
  assert.match(packagedSkill, /returned hosted action declares[\s\S]*signedEnvelope[\s\S]*contentHash[\s\S]*signature/);
  const hostInstallReference = entries.get("obsidian-epoch/references/host-install.md")?.toString("utf8") || "";
  assert.match(hostInstallReference, /Claude Code[\s\S]*Codex[\s\S]*Cursor[\s\S]*Hermes[\s\S]*OpenClaw[\s\S]*Web LLM Bridge/);
  assert.match(hostInstallReference, /\/epoch\/console/);
  assert.match(hostInstallReference, /package\.sha256[\s\S]*sha256/);
  assert.match(hostInstallReference, /package-integrity\.json[\s\S]*obsidian-epoch\/bin\/mcp-proxy\.ts/);
  assert.match(hostInstallReference, /agent:release-rehearsal[\s\S]*productionReleaseRehearsalCommand/);
  const protocolReference = entries.get("obsidian-epoch/references/protocol.md")?.toString("utf8") || "";
  assert.match(protocolReference, /verification\.releaseRehearsalCommand[\s\S]*verification\.productionReleaseRehearsalCommand/);
  assert.match(protocolReference, /payload\.receipt\.channelClass[\s\S]*payload\.receipt\.deliveryTrust[\s\S]*payload\.receipt\.playMode[\s\S]*payload\.receipt\.trustTier[\s\S]*untrusted_capped/);
  assert.match(protocolReference, /idempotency_key_conflict[\s\S]*stale cached result/);
  assert.match(protocolReference, /aggregateId[\s\S]*direct trade[\s\S]*tradeId/);
  assert.match(protocolReference, /adjudicate_lore_target[\s\S]*newAdjudicationId[\s\S]*previousAdjudicationId[\s\S]*never overwrites/);
  assert.match(protocolReference, /record_lore_contribution[\s\S]*revisionMode[\s\S]*suggestion[\s\S]*derived[\s\S]*merge[\s\S]*downgrade[\s\S]*direct_edit[\s\S]*lore_revision_direct_edit_forbidden[\s\S]*non-original explorers[\s\S]*proposal-only[\s\S]*derived version/);
  assert.match(protocolReference, /loreTargetStatuses[\s\S]*lineageDisplay[\s\S]*originAgentId[\s\S]*currentStatus[\s\S]*foldedContributionCounts[\s\S]*expandedTool[\s\S]*obsidian_epoch\.lore_contributions/);
  assert.match(protocolReference, /lore_targets[\s\S]*lineageDisplay[\s\S]*source originator[\s\S]*current status[\s\S]*confirmation\/refutation\/revision lineage[\s\S]*obsidian_epoch\.lore_contributions/);
  assert.match(protocolReference, /[Ff]action[\s\S]*character\/NPC[\s\S]*location[\s\S]*real IP\/work[\s\S]*moderation_hold[\s\S]*ipSimilarity/);
  assert.match(protocolReference, /obsidian_epoch\.submit_npc_candidate[\s\S]*real IP-similar character names[\s\S]*moderation_hold[\s\S]*real_ip_similarity[\s\S]*ipSimilarity/);
  assert.match(protocolReference, /agent_world\.start_run[\s\S]*contextVersion[\s\S]*signedEnvelope[\s\S]*contentHash[\s\S]*signature[\s\S]*regionId[\s\S]*actionBudget[\s\S]*sequenceWindow[\s\S]*issued[\s\S]*active[\s\S]*submitted[\s\S]*settled[\s\S]*expired[\s\S]*void[\s\S]*agent_world\.run_heartbeat[\s\S]*heartbeatAt[\s\S]*\/api\/runs\/heartbeat[\s\S]*agent_world\.archive_local_report[\s\S]*local_trial_archive[\s\S]*does not require runTicket[\s\S]*\/api\/runs\/archive[\s\S]*agent_world\.submit_battle_report[\s\S]*ticket_context_version_required[\s\S]*ticket_context_version_mismatch[\s\S]*ticket_context_envelope_required[\s\S]*ticket_context_envelope_mismatch[\s\S]*ticket_high_risk_confirmation_required[\s\S]*ticket_cooldown_rule_unverified[\s\S]*ticket_canonical_action_unverified[\s\S]*ticket_outcome_state_unverified[\s\S]*candidateClaims[\s\S]*does not raise score[\s\S]*server-capped claimSlots[\s\S]*sourceRewards[\s\S]*pending[\s\S]*released[\s\S]*claim status migration table[\s\S]*rumor[\s\S]*inscribed[\s\S]*manualApprovalId[\s\S]*canonAdoptionEventId[\s\S]*agent_world\.community_react[\s\S]*reactionPolicy\.claimStatusEffect[\s\S]*none[\s\S]*sorting[\s\S]*attention[\s\S]*truth adjudication[\s\S]*hidden_pending_review[\s\S]*disputeAbuseFlags[\s\S]*dispute_abuse[\s\S]*outbox\.summary[\s\S]*status[\s\S]*retryCount[\s\S]*deadLetter[\s\S]*agent_world\.outbox[\s\S]*dead-letter queue[\s\S]*\/api\/outbox[\s\S]*agent_world\.replay_outbox[\s\S]*\/api\/outbox\/replay[\s\S]*outbox\.jsonl[\s\S]*ticket_identity_archived[\s\S]*ticket_event_schema_invalid[\s\S]*ticket_event_sequence_invalid[\s\S]*ticket_item_use_unverified[\s\S]*ticket_sequence_required[\s\S]*ticket_sequence_mismatch[\s\S]*ticket_region_mismatch[\s\S]*ticket_action_budget_exceeded[\s\S]*legacy_run_submission_rate_limited/);
  assert.match(protocolReference, /failurePublication[\s\S]*failurePublicationMode[\s\S]*anonymous_public[\s\S]*claim_only[\s\S]*personal_sealed[\s\S]*visibility: "public"[\s\S]*explorerId[\s\S]*agentId[\s\S]*失败回流信用 \+2[\s\S]*claimPreview[\s\S]*失败回流信用 \+1[\s\S]*agent_world\.public_world/);
  assert.match(protocolReference, /review budget[\s\S]*identity reputation[\s\S]*runTicket[\s\S]*length[\s\S]*similarity[\s\S]*system load[\s\S]*delayed review queue[\s\S]*agent_world\.review_queue[\s\S]*\/api\/review-queue/);
  assert.match(protocolReference, /reviewStatus[\s\S]*排队中[\s\S]*规则校验[\s\S]*轻审[\s\S]*重审[\s\S]*人工[\s\S]*完成[\s\S]*estimatedWait/);
  assert.match(protocolReference, /contextSnapshot[\s\S]*settingCards[\s\S]*selectionReason[\s\S]*exposureLevel[\s\S]*retrievalParams[\s\S]*diversityPolicy[\s\S]*filteringReasons[\s\S]*low-exposure[\s\S]*agent_world\.context_snapshots[\s\S]*\/api\/context\/snapshots[\s\S]*context-snapshots\.jsonl/);
  assert.match(protocolReference, /obsidian_epoch\.delete_result_page[\s\S]*\/api\/epoch\/result-page\/delete[\s\S]*deleted[\s\S]*deletionSummary\.minimalReference[\s\S]*anonymousSourceHash[\s\S]*fullPayloadHash[\s\S]*receiptPayloadHash[\s\S]*result-pages\.jsonl/);
  assert.match(protocolReference, /deletionRequest\.categories[\s\S]*hide_body[\s\S]*anonymize_source[\s\S]*withdraw_unadmitted_candidate[\s\S]*request_de_admission_review[\s\S]*退档复审/);
  assert.match(protocolReference, /shareToken[\s\S]*shareVersion[\s\S]*result_page_share_version_required[\s\S]*result_page_share_version_mismatch/);
  assert.match(protocolReference, /obsidian_epoch\.create_result_page[\s\S]*故事署名归你；入档发现会成为共享世界资料，可被他人引用。/);
  assert.match(protocolReference, /agentSelfStatement[\s\S]*identity[\s\S]*region[\s\S]*recorded event facts[\s\S]*prompt[\s\S]*system[\s\S]*rules[\s\S]*model/);
  assert.match(protocolReference, /promptLayers[\s\S]*system_policy[\s\S]*agent_identity_boundary[\s\S]*user_mandate[\s\S]*user_additional_instruction[\s\S]*additionalInstruction/);
  assert.match(protocolReference, /goalPriority[\s\S]*safety_boundary[\s\S]*user_behavior_red_lines[\s\S]*user_mandate[\s\S]*agent_long_term_goals[\s\S]*opportunistic_side_quests/);
  assert.match(protocolReference, /partyRunId[\s\S]*participantRole[\s\S]*multiAgentReservation[\s\S]*reserved_only[\s\S]*legacy authored-report party play/);
  assert.match(protocolReference, /behaviorRedLines[\s\S]*betray allies[\s\S]*harm civilians[\s\S]*contact old gods[\s\S]*explicit_user_authorization_required/);
  assert.match(protocolReference, /drama[\s\S]*high-risk conflict[\s\S]*event chain/);
  assert.match(protocolReference, /graphSync[\s\S]*pending_sync[\s\S]*synced[\s\S]*retry_later[\s\S]*待同步[\s\S]*已同步[\s\S]*稍后重试/);
  assert.match(protocolReference, /Custom TTS[\s\S]*customTtsHosting[\s\S]*not_hosted[\s\S]*requires_voice_rights_confirmation[\s\S]*voice\/音色 usage rights/);
  assert.match(protocolReference, /contentPolicy[\s\S]*AGENT_WORLD_CONTENT_POLICY_JSON[\s\S]*contentPolicyRegion[\s\S]*ageRating[\s\S]*contentWarnings[\s\S]*publicSharing/);
  assert.match(protocolReference, /operationSwitches[\s\S]*AGENT_WORLD_OPERATION_SWITCHES_JSON[\s\S]*settlement[\s\S]*public_sharing[\s\S]*source_reward[\s\S]*rewardType[\s\S]*commissionType[\s\S]*chapterId[\s\S]*locationId[\s\S]*factionId[\s\S]*riskLevel/);
  assert.match(protocolReference, /frontstageStatus[\s\S]*AGENT_WORLD_FRONTSTAGE_STATUS_JSON[\s\S]*worldAnnouncement[\s\S]*档案馆审档暂停\/只读维护[\s\S]*数据没有丢失[\s\S]*localTrial[\s\S]*archiveLocalReport/);
  assert.match(protocolReference, /growthQuality[\s\S]*growth_metrics_must_ship_with_quality_guardrails[\s\S]*valid_setting_rate[\s\S]*return_rate[\s\S]*duplicate_rate[\s\S]*core_vibe_score[\s\S]*abuse_rate/);
  assert.match(protocolReference, /二局率[\s\S]*质量护栏/);
  assert.match(protocolReference, /experimentId[\s\S]*mainRuleReview[\s\S]*experiment_main_rule_review_required[\s\S]*record_lore_contribution[\s\S]*submit_npc_candidate/);
  assert.match(protocolReference, /turn_card[\s\S]*expiresAt[\s\S]*15 minutes[\s\S]*turn_card_expired/);
  assert.match(protocolReference, /one outstanding[\s\S]*turn_card[\s\S]*turn_card_already_open/);
  assert.match(protocolReference, /turn_card[\s\S]*sequence[\s\S]*nonce[\s\S]*resolve_turn[\s\S]*turn_card_sequence_mismatch[\s\S]*turn_card_nonce_mismatch/);
  assert.match(protocolReference, /signedEnvelope[\s\S]*Ed25519[\s\S]*contentHash[\s\S]*signature[\s\S]*not proof of delivery/);
  assert.match(protocolReference, /resolve_turn[\s\S]*channelClass[\s\S]*envelopeId[\s\S]*turnCardId[\s\S]*sequence[\s\S]*actionOptionId/);
  assert.match(protocolReference, /`resolve_turn` response declares[\s\S]*signedEnvelope[\s\S]*contentHash[\s\S]*signature/);
  assert.match(protocolReference, /Each hosted action response[\s\S]*signedEnvelope[\s\S]*contentHash[\s\S]*signature/);
  assert.match(entries.get("obsidian-epoch/references/one-turn-playbook.md")?.toString("utf8") || "", /turn_card[\s\S]*resolve_turn[\s\S]*create_result_page/);
  assert.match(entries.get("obsidian-epoch/references/smoke-playbook.md")?.toString("utf8") || "", /identity[\s\S]*turn_card[\s\S]*resolve_turn[\s\S]*create_result_page[\s\S]*\/epoch\/agent/);
  assert.match(entries.get("obsidian-epoch/references/web-llm-bridge-playbook.md")?.toString("utf8") || "", /web_bridge_turn[\s\S]*copyPrompt[\s\S]*actionOptionId[\s\S]*submit_web_bridge_action[\s\S]*create_result_page/);
});

test("Obsidian Epoch package signing metadata reflects an operator configured release key", async () => {
  const previous = process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM;
  const { privateKey } = generateKeyPairSync("ed25519");
  process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  try {
    const archive = await createObsidianEpochPackageArchive();
    const entries = tarEntries(archive);
    const rootManifest = JSON.parse(entries.get("install-manifest.json")?.toString("utf8") || "{}");
    const skillManifest = JSON.parse(entries.get("obsidian-epoch/assets/install-manifest.json")?.toString("utf8") || "{}");
    assert.equal(rootManifest.verification.packageSigningTrust, "operator_configured");
    assert.equal(skillManifest.verification.packageSigningTrust, "operator_configured");
    assert.equal(rootManifest.verification.packageSigningKeySource, "AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM");
    assert.match(rootManifest.verification.packageReleasePublicKey, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.match(rootManifest.verification.packageReleaseKeyId, /^[a-f0-9]{64}$/);
    assert.equal(skillManifest.verification.packageReleaseKeyId, rootManifest.verification.packageReleaseKeyId);
    assert.equal(verifyObsidianEpochPackageSignature([...entries].map(([name, content]) => ({ name, content })), {
      publicKey: rootManifest.verification.packageReleasePublicKey,
    }).verified, true);
  } finally {
    if (previous === undefined) {
      delete process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM;
    } else {
      process.env.AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM = previous;
    }
  }
});

test("Obsidian Epoch package carries a full-file integrity manifest", async () => {
  const archive = await createObsidianEpochPackageArchive({ serverBase: "https://epoch.example" });
  const entries = tarEntries(archive);
  const installManifest = JSON.parse(entries.get("install-manifest.json")?.toString("utf8") || "{}");
  const manifestEntry = entries.get("obsidian-epoch/assets/package-integrity.json");
  assert.ok(manifestEntry, "package integrity manifest missing");
  const manifest = JSON.parse(manifestEntry.toString("utf8"));

  assert.equal(manifest.type, "obsidian_epoch_package_integrity");
  assert.equal(manifest.version, 1);
  assert.equal(manifest.algorithm, "sha256");
  assert.equal(manifest.signatureAlgorithm, "Ed25519");
  assert.match(manifest.releasePublicKey, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.match(manifest.signature, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.equal(manifest.packageFile, "obsidian-epoch-agent-world-0.1.0-alpha.tar.gz");
  assert.deepEqual(installManifest.distribution, {
    mode: "live-rewritten",
    productionDistribution: "allowed",
    manifestUrl: "https://epoch.example/api/epoch/install-manifest",
    packageUrl: "https://epoch.example/api/epoch/package/obsidian-epoch-agent-world-0.1.0-alpha.tar.gz",
  });
  assert.ok(Array.isArray(manifest.files));

  const expectedPaths = [...entries.keys()]
    .filter((name) => name !== "obsidian-epoch/assets/package-integrity.json")
    .sort();
  assert.deepEqual(manifest.files.map((file: { path: string }) => file.path), expectedPaths);
  for (const file of manifest.files as Array<{ path: string; bytes: number; sha256: string }>) {
    const content = entries.get(file.path);
    assert.ok(content, `missing package file listed in integrity manifest: ${file.path}`);
    assert.equal(file.bytes, content.byteLength);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
  assert.ok(manifest.files.some((file: { path: string }) => file.path === "obsidian-epoch/bin/mcp-proxy.ts"));
  assert.ok(manifest.files.some((file: { path: string }) => file.path === "install-manifest.json"));
  assert.ok(manifest.files.some((file: { path: string }) => file.path === ".codex-plugin/plugin.json"));
  assert.ok(manifest.files.some((file: { path: string }) => file.path === ".mcp.json"));

  const verified = verifyObsidianEpochPackageIntegrity([...entries].map(([name, content]) => ({ name, content })));
  assert.equal(verified.verified, true);
  assert.equal(verified.releaseSignatureVerified, true);
  assert.equal(verified.fileCount, expectedPaths.length);
});

test("Obsidian Epoch package integrity verification rejects tampered files", async () => {
  const archive = await createObsidianEpochPackageArchive();
  const entries = [...tarEntries(archive)].map(([name, content]) => ({ name, content }));
  const proxy = entries.find((entry) => entry.name === "obsidian-epoch/bin/mcp-proxy.ts");
  assert.ok(proxy, "package proxy missing");
  proxy.content = Buffer.from(`${proxy.content.toString("utf8")}\n// tampered\n`, "utf8");

  assert.throws(
    () => verifyObsidianEpochPackageIntegrity(entries),
    /package_integrity_mismatch:obsidian-epoch\/bin\/mcp-proxy\.ts/,
  );
});

test("Obsidian Epoch package signature verification rejects integrity manifest tampering", async () => {
  const archive = await createObsidianEpochPackageArchive({ serverBase: "https://epoch.example" });
  const entries = [...tarEntries(archive)].map(([name, content]) => ({ name, content }));
  const manifest = JSON.parse(entries.find((entry) => entry.name === "obsidian-epoch/assets/package-integrity.json")?.content.toString("utf8") || "{}");

  assert.equal(verifyObsidianEpochPackageSignature(entries, {
    publicKey: manifest.releasePublicKey,
  }).verified, true);

  manifest.files[0].sha256 = "0".repeat(64);
  const manifestEntry = entries.find((entry) => entry.name === "obsidian-epoch/assets/package-integrity.json");
  assert.ok(manifestEntry, "package integrity manifest missing");
  manifestEntry.content = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  assert.throws(
    () => verifyObsidianEpochPackageSignature(entries, {
      publicKey: manifest.releasePublicKey,
    }),
    /package_signature_invalid/,
  );
});

test("Obsidian Epoch downloadable package runs its bundled MCP proxy from the extracted package root", async () => {
  const archive = await createObsidianEpochPackageArchive();
  const entries = tarEntries(archive);
  const packageRoot = await extractArchiveToTemp(entries);
  const {
    createAgentHttpServer,
    createAgentWorldMcpRuntime,
    createSequentialEpochIdFactory,
  } = await loadRuntimeHelpers();
  let realNow = "2026-07-12T00:00:00.000Z";
  let worldNow = "2026-01-01T08:00:00.000Z";
  const backing = createAgentWorldMcpRuntime({
    epoch: {
      idFactory: createSequentialEpochIdFactory("package_proxy"),
    },
    journey: {
      now: () => realNow,
      worldNow: () => worldNow,
    },
  });
  const bearerToken = "package-proxy-mcp-token-at-least-32-characters";
  const server = createAgentHttpServer({
    runtime: backing.runtime,
    mcpBearerToken: bearerToken,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const registrationResponse = await fetch(`${baseUrl}/api/epoch/pairing/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey: "package-proxy-register" }),
  });
  assert.equal(registrationResponse.status, 201);
  const registration = await registrationResponse.json() as Record<string, string>;
  const unauthenticatedChild = spawn("node", ["obsidian-epoch/bin/mcp-proxy.ts"], {
    cwd: packageRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      AGENT_WORLD_SERVER: baseUrl,
      AGENT_WORLD_MCP_TOKEN: "",
    },
  });
  const unauthenticatedLines = readline.createInterface({ input: unauthenticatedChild.stdout, crlfDelay: Infinity });
  const unauthenticatedStderr: Buffer[] = [];
  unauthenticatedChild.stderr.on("data", (chunk) => unauthenticatedStderr.push(Buffer.from(chunk)));
  const child = spawn("node", ["obsidian-epoch/bin/mcp-proxy.ts"], {
    cwd: packageRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      AGENT_WORLD_SERVER: baseUrl,
      AGENT_WORLD_MCP_TOKEN: bearerToken,
    },
  });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const stderrChunks: Buffer[] = [];
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
  const childOutput = () => Buffer.concat(stderrChunks).toString("utf8").trim();

  try {
    const unauthenticatedList = await requestJsonRpc(
      unauthenticatedLines,
      unauthenticatedChild,
      1,
      "tools/list",
      undefined,
      () => Buffer.concat(unauthenticatedStderr).toString("utf8").trim(),
    );
    assert.equal(unauthenticatedList.error?.code, -32002);
    assert.equal(unauthenticatedList.error?.message, "mcp_session_not_initialized");

    const initialized = await requestJsonRpc(lines, child, 1, "initialize", {
      protocolVersion: "2025-06-18",
      clientInfo: { name: "package-archive-test", version: "0.0.0" },
      capabilities: {},
    }, childOutput);
    assert.equal(initialized.result.serverInfo.name, "obsidian-epoch-agent-world");
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

    const listed = await requestJsonRpc(lines, child, 2, "tools/list", undefined, childOutput);
    assert.ok(listed.result.tools.some((tool: { name: string }) => tool.name === "obsidian_epoch.quickstart"));
    for (const toolName of ["obsidian_epoch.propose_journey_step", "obsidian_epoch.commit_journey_action"]) {
      assert.ok(listed.result.tools.some((tool: { name: string }) => tool.name === toolName), toolName);
    }

    const quickstart = await requestJsonRpc(lines, child, 3, "tools/call", {
      name: "obsidian_epoch.quickstart",
      arguments: { host: "Codex package" },
    }, childOutput);
    assert.ok(!quickstart.error, quickstart.error?.message);
    const payload = JSON.parse(quickstart.result.content[0].text);
    assert.equal(payload.serverBase, baseUrl);
    assert.equal(payload.hostConfig.cwd, ".");

    const preparedCall = await requestJsonRpc(lines, child, 4, "tools/call", {
      name: "obsidian_epoch.prepare_journey",
      arguments: {
        agentId: registration.agentId,
        destinationRegionId: "region_gray_harbor",
        recoveryCode: registration.recoveryCode,
        idempotencyKey: "package-proxy-prepare",
      },
    }, childOutput);
    const prepared = JSON.parse(preparedCall.result.content[0].text);
    const startedCall = await requestJsonRpc(lines, child, 5, "tools/call", {
      name: "obsidian_epoch.start_journey",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: prepared.journey.version,
        recoveryCode: registration.recoveryCode,
        idempotencyKey: "package-proxy-start",
      },
    }, childOutput);
    const started = JSON.parse(startedCall.result.content[0].text);
    assert.equal(started.journey.status, "awaiting_agent");
    assert.equal(started.sampling.fallback, "agent_native");
    const proposedCall = await requestJsonRpc(lines, child, 6, "tools/call", {
      name: "obsidian_epoch.propose_journey_step",
      arguments: {
        journeyId: prepared.journey.journeyId,
        expectedVersion: started.journey.version,
        recoveryCode: registration.recoveryCode,
        idempotencyKey: "package-proxy-propose",
      },
    }, childOutput);
    const proposed = JSON.parse(proposedCall.result.content[0].text);
    const selected = proposed.proposal.sceneContract.actionOptions[0];
    const committedCall = await requestJsonRpc(lines, child, 7, "tools/call", {
      name: "obsidian_epoch.commit_journey_action",
      arguments: {
        journeyId: prepared.journey.journeyId,
        sceneId: proposed.proposal.sceneContract.sceneId,
        episodeId: proposed.proposal.episode.episodeId,
        expectedVersion: proposed.proposal.expectedVersion,
        actionOptionId: selected.actionOptionId,
        signature: selected.signature,
        recoveryCode: registration.recoveryCode,
        idempotencyKey: "package-proxy-commit",
      },
    }, childOutput);
    const committed = JSON.parse(committedCall.result.content[0].text);
    assert.deepEqual([committed.mainEpisode.phase, committed.returnEpisode.phase], ["main", "return"]);
    realNow = "2026-07-12T00:45:00.000Z";
    worldNow = "2026-01-01T09:30:00.000Z";
    const statusCall = await requestJsonRpc(lines, child, 8, "tools/call", {
      name: "obsidian_epoch.journey_status",
      arguments: { journeyId: prepared.journey.journeyId, recoveryCode: registration.recoveryCode },
    }, childOutput);
    const status = JSON.parse(statusCall.result.content[0].text);
    assert.equal(status.journey.status, "settled");
    assert.equal(status.episodes.length, 3);
    const publicResult = await fetch(`${baseUrl}${status.finalVerification.page.urlPath}`);
    assert.equal(publicResult.status, 200);
    assert.match(await publicResult.text(), /从旅途中寄来/);
  } finally {
    unauthenticatedLines.close();
    unauthenticatedChild.stdin.destroy();
    if (!unauthenticatedChild.killed) unauthenticatedChild.kill();
    await Promise.race([
      once(unauthenticatedChild, "exit"),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]);
    lines.close();
    child.stdin.destroy();
    if (!child.killed) child.kill();
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]);
    (server as { closeAllConnections?: () => void }).closeAllConnections?.();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(packageRoot, { recursive: true, force: true });
  }
});
