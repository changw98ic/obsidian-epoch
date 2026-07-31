import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signPayload,
  verify as verifyPayloadSignature,
} from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  epochHostConfigFiles,
  epochHostConfigManifestEntries,
  epochHostInstallEntries,
} from "./hostInstall.ts";
import { epochAgentWorldToolNames } from "./mcpTools.ts";
import {
  OBSIDIAN_EPOCH_PUBLIC_PAGES as PUBLIC_PAGES,
  obsidianEpochPublicSurface,
} from "./publicSurfaceContract.ts";

export const OBSIDIAN_EPOCH_PACKAGE_FILE = "obsidian-epoch-agent-world-0.1.0-alpha.tar.gz";
export const OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE = "obsidian-epoch/assets/package-integrity.json";
export const OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM = "Ed25519";
export const OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR = "AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM";
export const OBSIDIAN_EPOCH_PACKAGE_SIGNING_FILE_ENV_VAR = "AGENT_PACKAGE_SIGNING_PRIVATE_KEY_PEM_FILE";
export const OBSIDIAN_EPOCH_SOURCE_DATE_EPOCH_ENV_VAR = "SOURCE_DATE_EPOCH";
// Stable fallback derived from the repository release revision timestamp.
export const OBSIDIAN_EPOCH_RELEASE_EPOCH_SECONDS = 1_780_806_923;
export const OBSIDIAN_EPOCH_RELEASE_EPOCH_REVISION = "e3b228dc3feba56bb02edd2ddbc46de685276278";
export const OBSIDIAN_EPOCH_PUBLIC_PAGES = PUBLIC_PAGES;

export const OBSIDIAN_EPOCH_MCP_BOOTSTRAP_SURFACE = {
  tool: "obsidian_epoch.register_explorer",
  authentication: "anonymous_mcp_bootstrap",
  credentialHandoff: "package_stdio_proxy",
  nextTool: "obsidian_epoch.agent_briefing",
  serverEnvironmentVariable: "AGENT_WORLD_SERVER",
} as const;

export const OBSIDIAN_EPOCH_PLAYBOOKS = {
  oneTurn: "obsidian-epoch/references/one-turn-playbook.md",
  smokeE2E: "obsidian-epoch/references/smoke-playbook.md",
  webBridge: "obsidian-epoch/references/web-llm-bridge-playbook.md",
  attestedRunner: "obsidian-epoch/references/attested-runner-playbook.md",
} as const;
const EPHEMERAL_LOCAL_RELEASE_KEY_PAIR = generateKeyPairSync("ed25519");

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultPackageRoot = join(serverRoot, "package");
const blockSize = 512;
const maxTarMtimeSeconds = Number.parseInt("77777777777", 8);

export interface ArchiveFile {
  readonly path: string;
  readonly content: Buffer;
}

interface PackageIntegrityFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

interface PackageIntegrityManifest {
  readonly type: "obsidian_epoch_package_integrity";
  readonly version: 1;
  readonly algorithm: "sha256";
  readonly signatureAlgorithm: typeof OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM;
  readonly releasePublicKey: string;
  readonly signature: string;
  readonly packageFile: typeof OBSIDIAN_EPOCH_PACKAGE_FILE;
  readonly files: readonly PackageIntegrityFile[];
}

export interface PackageIntegrityInputEntry {
  readonly name?: string;
  readonly path?: string;
  readonly content: Uint8Array;
}

export interface PackageIntegrityVerification {
  readonly verified: true;
  readonly releaseSignatureVerified: true;
  readonly manifestPath: typeof OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE;
  readonly algorithm: "sha256";
  readonly signatureAlgorithm: typeof OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM;
  readonly releasePublicKey: string;
  readonly releaseKeyId: string;
  readonly fileCount: number;
}

export interface PackageSignatureVerification {
  readonly verified: true;
  readonly signatureAlgorithm: typeof OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM;
  readonly releasePublicKey: string;
  readonly releaseKeyId: string;
}

export type PackageSigningTrust = "operator_configured" | "local_alpha_fallback";

interface PackageSignatureOptions {
  readonly publicKey?: string;
}

export interface ObsidianEpochPackageArchiveOptions {
  readonly packageRoot?: string;
  readonly serverBase?: string;
  readonly sourceDateEpoch?: number | string;
}

export type ObsidianEpochPackageDistributionMode = "local-template" | "live-rewritten";

type MutableRecord = Record<string, unknown>;

function unixPath(pathName: string) {
  return pathName.split(sep).join("/");
}

function comparePackagePath(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sha256(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

function configuredReleasePrivateKeyPem() {
  const configured = process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR];
  const configuredFile = process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_FILE_ENV_VAR]?.trim();
  if (configured?.trim() && configuredFile) {
    throw new Error("package_signing_private_key_source_ambiguous");
  }
  let raw = configured;
  if (configuredFile) {
    try {
      raw = readFileSync(configuredFile, "utf8");
    } catch {
      throw new Error("package_signing_private_key_file_unreadable");
    }
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let value = trimmed;
  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === "string") value = parsed;
    } catch {
      value = trimmed;
    }
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  }

  return value.replaceAll("\\n", "\n");
}

function releasePublicKeyDer() {
  const configured = configuredReleasePrivateKeyPem();
  const publicKey = configured
    ? createPublicKey(configured)
    : EPHEMERAL_LOCAL_RELEASE_KEY_PAIR.publicKey;
  return publicKey.export({ type: "spki", format: "der" });
}

export function obsidianEpochReleasePublicKey() {
  return releasePublicKeyDer().toString("base64");
}

function releaseKeyIdFromPublicKey(publicKey: string) {
  return createHash("sha256").update(Buffer.from(publicKey, "base64")).digest("hex");
}

export function obsidianEpochReleaseKeyId() {
  return createHash("sha256").update(releasePublicKeyDer()).digest("hex");
}

export function obsidianEpochPackageSigningTrust(): PackageSigningTrust {
  return configuredReleasePrivateKeyPem() ? "operator_configured" : "local_alpha_fallback";
}

export function obsidianEpochPackageSigningKeySource() {
  if (!configuredReleasePrivateKeyPem()) return "ephemeral_local_alpha_fallback";
  return process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_FILE_ENV_VAR]?.trim()
    ? OBSIDIAN_EPOCH_PACKAGE_SIGNING_FILE_ENV_VAR
    : OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR;
}

function releasePrivateKey() {
  const configured = configuredReleasePrivateKeyPem();
  return configured ? createPrivateKey(configured) : EPHEMERAL_LOCAL_RELEASE_KEY_PAIR.privateKey;
}

export function signObsidianEpochReleasePayload(payload: Uint8Array) {
  return signPayload(null, payload, releasePrivateKey()).toString("base64");
}

function publicKeyFromBase64(publicKey: string) {
  return createPublicKey({
    key: Buffer.from(publicKey, "base64"),
    type: "spki",
    format: "der",
  });
}

function validateArchivePath(pathName: string) {
  if (!pathName || pathName.startsWith("/") || pathName.includes("\\") || pathName.split("/").includes("..")) {
    throw new Error(`package_integrity_path_invalid:${pathName}`);
  }
}

function packageIntegritySignedPayload(manifest: Pick<PackageIntegrityManifest, "type" | "version" | "algorithm" | "packageFile" | "files">) {
  return Buffer.from(JSON.stringify({
    type: manifest.type,
    version: manifest.version,
    algorithm: manifest.algorithm,
    packageFile: manifest.packageFile,
    files: manifest.files,
  }), "utf8");
}

function packageIntegrityFile(files: readonly ArchiveFile[]): ArchiveFile {
  const unsignedManifest = {
    type: "obsidian_epoch_package_integrity",
    version: 1,
    algorithm: "sha256",
    packageFile: OBSIDIAN_EPOCH_PACKAGE_FILE,
    files: files
      .filter((file) => file.path !== OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE)
      .map((file) => ({
        path: file.path,
        bytes: file.content.byteLength,
        sha256: sha256(file.content),
      }))
      .sort((left, right) => comparePackagePath(left.path, right.path)),
  } as const;
  const signature = signPayload(null, packageIntegritySignedPayload(unsignedManifest), releasePrivateKey()).toString("base64");
  const manifest: PackageIntegrityManifest = {
    ...unsignedManifest,
    signatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    releasePublicKey: obsidianEpochReleasePublicKey(),
    signature,
  };
  return {
    path: OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE,
    content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  };
}

function withPackageIntegrityManifest(files: readonly ArchiveFile[]): ArchiveFile[] {
  const filesWithoutOldManifest = files.filter((file) => file.path !== OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE);
  return [...filesWithoutOldManifest, packageIntegrityFile(filesWithoutOldManifest)]
    .sort((left, right) => comparePackagePath(left.path, right.path));
}

function parseIntegrityManifest(content: Uint8Array): PackageIntegrityManifest {
  const parsed = JSON.parse(Buffer.from(content).toString("utf8")) as unknown;
  if (!isRecord(parsed)) throw new Error("package_integrity_manifest_invalid");
  if (
    parsed.type !== "obsidian_epoch_package_integrity"
    || parsed.version !== 1
    || parsed.algorithm !== "sha256"
    || parsed.signatureAlgorithm !== OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM
    || typeof parsed.releasePublicKey !== "string"
    || typeof parsed.signature !== "string"
    || parsed.packageFile !== OBSIDIAN_EPOCH_PACKAGE_FILE
    || !Array.isArray(parsed.files)
  ) {
    throw new Error("package_integrity_manifest_invalid");
  }
  const files = parsed.files.map((entry) => {
    if (!isRecord(entry) || typeof entry.path !== "string" || typeof entry.bytes !== "number" || typeof entry.sha256 !== "string") {
      throw new Error("package_integrity_manifest_invalid");
    }
    validateArchivePath(entry.path);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("package_integrity_manifest_invalid");
    return {
      path: entry.path,
      bytes: entry.bytes,
      sha256: entry.sha256,
    };
  });
  return {
    type: "obsidian_epoch_package_integrity",
    version: 1,
    algorithm: "sha256",
    signatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    releasePublicKey: parsed.releasePublicKey,
    signature: parsed.signature,
    packageFile: OBSIDIAN_EPOCH_PACKAGE_FILE,
    files,
  };
}

export function verifyObsidianEpochPackageIntegrity(
  entries: readonly PackageIntegrityInputEntry[],
  options: PackageSignatureOptions = {},
): PackageIntegrityVerification {
  const byPath = new Map<string, Uint8Array>();
  for (const entry of entries) {
    const pathName = entry.name || entry.path;
    if (typeof pathName !== "string") throw new Error("package_integrity_path_missing");
    validateArchivePath(pathName);
    if (byPath.has(pathName)) throw new Error(`package_integrity_duplicate:${pathName}`);
    byPath.set(pathName, entry.content);
  }
  const manifestContent = byPath.get(OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE);
  if (!manifestContent) throw new Error("package_integrity_manifest_missing");
  const manifest = parseIntegrityManifest(manifestContent);
  verifyPackageIntegrityManifestSignature(manifest, options);
  const actualPaths = [...byPath.keys()]
    .filter((pathName) => pathName !== OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE)
    .sort();
  const expectedPaths = manifest.files.map((file) => file.path).sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error("package_integrity_file_list_mismatch");
  }
  for (const file of manifest.files) {
    const content = byPath.get(file.path);
    if (!content || content.byteLength !== file.bytes || sha256(content) !== file.sha256) {
      throw new Error(`package_integrity_mismatch:${file.path}`);
    }
  }
  return {
    verified: true,
    releaseSignatureVerified: true,
    manifestPath: OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE,
    algorithm: "sha256",
    signatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    releasePublicKey: manifest.releasePublicKey,
    releaseKeyId: releaseKeyIdFromPublicKey(manifest.releasePublicKey),
    fileCount: manifest.files.length,
  };
}

function verifyPackageIntegrityManifestSignature(
  manifest: PackageIntegrityManifest,
  options: PackageSignatureOptions = {},
): PackageSignatureVerification {
  const expectedPublicKey = options.publicKey || manifest.releasePublicKey;
  if (expectedPublicKey !== manifest.releasePublicKey) {
    throw new Error("package_signature_public_key_mismatch");
  }
  const ok = verifyPayloadSignature(
    null,
    packageIntegritySignedPayload(manifest),
    publicKeyFromBase64(expectedPublicKey),
    Buffer.from(manifest.signature, "base64"),
  );
  if (!ok) throw new Error("package_signature_invalid");
  return {
    verified: true,
    signatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    releasePublicKey: manifest.releasePublicKey,
    releaseKeyId: releaseKeyIdFromPublicKey(manifest.releasePublicKey),
  };
}

export function verifyObsidianEpochPackageSignature(
  entries: readonly PackageIntegrityInputEntry[],
  options: PackageSignatureOptions = {},
): PackageSignatureVerification {
  const manifestEntry = entries.find((entry) =>
    (entry.name || entry.path) === OBSIDIAN_EPOCH_PACKAGE_INTEGRITY_FILE);
  if (!manifestEntry) throw new Error("package_integrity_manifest_missing");
  return verifyPackageIntegrityManifestSignature(parseIntegrityManifest(manifestEntry.content), options);
}

async function listPackageFiles(root: string, dir = root): Promise<ArchiveFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: ArchiveFile[] = [];
  for (const entry of entries) {
    const current = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listPackageFiles(root, current));
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = unixPath(relative(root, current));
    files.push({
      path: relativePath,
      content: await readFile(current),
    });
  }
  return files.sort((left, right) => comparePackagePath(left.path, right.path));
}

function writeOctal(header: Buffer, value: number, offset: number, length: number) {
  const encoded = value.toString(8).padStart(length - 1, "0").slice(-(length - 1));
  header.write(encoded, offset, length - 1, "ascii");
  header[offset + length - 1] = 0;
}

function tarHeader(file: ArchiveFile, mtime: number) {
  if (Buffer.byteLength(file.path) > 100) {
    throw new Error(`archive_path_too_long:${file.path}`);
  }
  const header = Buffer.alloc(blockSize);
  header.write(file.path, 0, 100, "utf8");
  writeOctal(header, 0o644, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, file.content.length, 124, 12);
  writeOctal(header, mtime, 136, 12);
  header.fill(0x20, 148, 156);
  header.write("0", 156, 1, "ascii");
  header.write("ustar", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const checksumText = checksum.toString(8).padStart(6, "0");
  header.write(checksumText, 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function padContent(content: Buffer) {
  const padding = (blockSize - (content.length % blockSize)) % blockSize;
  return padding ? Buffer.concat([content, Buffer.alloc(padding)]) : content;
}

function validatedArchiveMtime(value: number, errorCode: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maxTarMtimeSeconds) {
    throw new Error(errorCode);
  }
  return value;
}

export function resolveObsidianEpochSourceDateEpoch(
  value: number | string | undefined = process.env[OBSIDIAN_EPOCH_SOURCE_DATE_EPOCH_ENV_VAR],
) {
  if (value === undefined) return OBSIDIAN_EPOCH_RELEASE_EPOCH_SECONDS;
  if (typeof value === "number") {
    return validatedArchiveMtime(value, "source_date_epoch_invalid");
  }
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) throw new Error("source_date_epoch_invalid");
  return validatedArchiveMtime(Number(normalized), "source_date_epoch_invalid");
}

export function createTarGzArchive(files: readonly ArchiveFile[], options: { readonly mtime?: number } = {}) {
  const mtime = validatedArchiveMtime(options.mtime ?? 0, "archive_mtime_invalid");
  const chunks = files.flatMap((file) => {
    validateArchivePath(file.path);
    return [tarHeader(file, mtime), padContent(file.content)];
  });
  chunks.push(Buffer.alloc(blockSize), Buffer.alloc(blockSize));
  return gzipSync(Buffer.concat(chunks), { level: 9 });
}

function isRecord(value: unknown): value is MutableRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedServerBase(serverBase: string) {
  return serverBase.trim().replace(/\/+$/, "");
}

function packageUrl(serverBase: string) {
  return `${serverBase}/api/epoch/package/${OBSIDIAN_EPOCH_PACKAGE_FILE}`;
}

function installPackageDistribution(serverBase: string, mode: ObsidianEpochPackageDistributionMode) {
  const liveManifestUrl = `${serverBase}/api/epoch/install-manifest`;
  const livePackageUrl = packageUrl(serverBase);
  return mode === "live-rewritten"
    ? {
        mode,
        productionDistribution: "allowed" as const,
        manifestUrl: liveManifestUrl,
        packageUrl: livePackageUrl,
      }
    : {
        mode,
        productionDistribution: "forbidden" as const,
        productionSource: "live-rewritten-package-endpoint" as const,
        liveManifestUrl,
        livePackageUrl,
      };
}

export function obsidianEpochInstallSurface(
  serverBase = "http://127.0.0.1:8787",
  distributionMode: ObsidianEpochPackageDistributionMode = "live-rewritten",
) {
  const normalizedBase = normalizedServerBase(serverBase);
  const configuredHosts = epochHostInstallEntries(normalizedBase).map((entry) => ({
    host: entry.host,
    status: "config_provided" as const,
  }));
  return {
    health: {
      readiness: "/api/health",
      epochReadiness: "/api/epoch/health",
    },
    bootstrap: { ...OBSIDIAN_EPOCH_MCP_BOOTSTRAP_SURFACE },
    publicSurface: obsidianEpochPublicSurface(),
    publicPages: { ...OBSIDIAN_EPOCH_PUBLIC_PAGES },
    playbooks: { ...OBSIDIAN_EPOCH_PLAYBOOKS },
    tools: epochAgentWorldToolNames(),
    distribution: installPackageDistribution(normalizedBase, distributionMode),
    hostSupport: {
      schemaVersion: 1,
      hosts: configuredHosts,
      transportSmoke: {
        status: "verified" as const,
        scope: ["generic_streamable_http_mcp", "package_stdio_proxy"] as const,
        command: "npm run agent:install-smoke -- --json",
        hostNativeClients: {
          status: "not_run" as const,
          startedHosts: [] as readonly string[],
        },
      },
    },
  };
}

function updateHostConfigManifest(manifest: MutableRecord, serverBase: string) {
  manifest.hostConfigFiles = epochHostConfigManifestEntries(serverBase);
}

function withGeneratedHostConfigFiles(files: readonly ArchiveFile[], serverBase = "http://127.0.0.1:8787"): ArchiveFile[] {
  const generatedFiles = epochHostConfigFiles(serverBase).map((file) => ({
    path: file.path,
    content: Buffer.from(file.content, "utf8"),
  }));
  const generatedPaths = new Set(generatedFiles.map((file) => file.path));
  return [
    ...files.filter((file) => !generatedPaths.has(file.path)),
    ...generatedFiles,
  ].sort((a, b) => a.path.localeCompare(b.path));
}

function withGeneratedCodexPluginFiles(files: readonly ArchiveFile[], serverBase = "http://127.0.0.1:8787"): ArchiveFile[] {
  const codexEntry = epochHostInstallEntries(serverBase).find((entry) => entry.host === "Codex");
  const pluginSnippet = codexEntry?.configSnippets?.find((snippet) => snippet.label === "Codex plugin manifest");
  const mcpSnippet = codexEntry?.configSnippets?.find((snippet) => snippet.label === "Codex MCP JSON");
  if (!pluginSnippet || !mcpSnippet) throw new Error("codex_plugin_config_missing");
  const generatedFiles: ArchiveFile[] = [
    {
      path: ".codex-plugin/plugin.json",
      content: Buffer.from(`${JSON.stringify(pluginSnippet.body, null, 2)}\n`, "utf8"),
    },
    {
      path: ".mcp.json",
      content: Buffer.from(`${JSON.stringify(mcpSnippet.body, null, 2)}\n`, "utf8"),
    },
  ];
  const generatedPaths = new Set(generatedFiles.map((file) => file.path));
  return [
    ...files.filter((file) => !generatedPaths.has(file.path)),
    ...generatedFiles,
  ].sort((a, b) => a.path.localeCompare(b.path));
}

function updateTransportServerBase(manifest: MutableRecord, serverBase: string) {
  const transport = isRecord(manifest.transport) ? manifest.transport : {};
  const streamableHttp = isRecord(transport.streamableHttp) ? transport.streamableHttp : {};
  const stdio = isRecord(transport.stdio) ? transport.stdio : {};
  const env = isRecord(stdio.env) ? stdio.env : {};
  manifest.transport = {
    ...transport,
    streamableHttp: {
      ...streamableHttp,
      endpoint: `${serverBase}/mcp`,
      protocolVersion: typeof streamableHttp.protocolVersion === "string"
        ? streamableHttp.protocolVersion
        : "2025-06-18",
      sse: false,
    },
    stdio: {
      ...stdio,
      command: typeof stdio.command === "string"
        ? stdio.command
        : "node obsidian-epoch/bin/mcp-proxy.ts",
      env: {
        ...env,
        AGENT_WORLD_SERVER: serverBase,
      },
    },
  };
}

type SourceDateEpochSource = "SOURCE_DATE_EPOCH" | "explicit_option" | "release_revision";

function addReleaseVerificationMetadata(
  manifest: MutableRecord,
  sourceDateEpoch = resolveObsidianEpochSourceDateEpoch(),
  sourceDateEpochSource: SourceDateEpochSource = process.env[OBSIDIAN_EPOCH_SOURCE_DATE_EPOCH_ENV_VAR] === undefined
    ? "release_revision"
    : "SOURCE_DATE_EPOCH",
) {
  const verification = isRecord(manifest.verification) ? manifest.verification : {};
  const packageReleasePublicKey = obsidianEpochReleasePublicKey();
  manifest.verification = {
    ...verification,
    packageSignatureAlgorithm: OBSIDIAN_EPOCH_PACKAGE_SIGNATURE_ALGORITHM,
    packageReleasePublicKey,
    packageReleaseKeyId: releaseKeyIdFromPublicKey(packageReleasePublicKey),
    packageSigningTrust: obsidianEpochPackageSigningTrust(),
    packageSigningKeySource: obsidianEpochPackageSigningKeySource(),
    reproducibleArchive: {
      sourceDateEpoch,
      sourceDateEpochSource,
      fallbackReleaseRevision: OBSIDIAN_EPOCH_RELEASE_EPOCH_REVISION,
      tarMtimeSeconds: sourceDateEpoch,
      gzipLevel: 9,
      digestAlgorithm: "sha256",
    },
  };
}

export function synchronizeObsidianEpochInstallManifest(value: unknown, requestedServerBase?: string) {
  if (!isRecord(value)) throw new Error("install_manifest_not_object");
  const manifest: MutableRecord = { ...value };
  const currentServerBase = typeof manifest.serverBase === "string"
    ? manifest.serverBase
    : "http://127.0.0.1:8787";
  const serverBase = normalizedServerBase(requestedServerBase || currentServerBase);
  const existingDistribution = isRecord(manifest.distribution) ? manifest.distribution : undefined;
  const distributionMode: ObsidianEpochPackageDistributionMode = requestedServerBase
    || existingDistribution?.mode === "live-rewritten"
    ? "live-rewritten"
    : "local-template";
  delete manifest.pairing;
  Object.assign(manifest, obsidianEpochInstallSurface(serverBase, distributionMode));
  manifest.serverBase = serverBase;
  manifest.packageUrl = packageUrl(serverBase);
  addReleaseVerificationMetadata(manifest);
  manifest.hostInstall = epochHostInstallEntries(serverBase);
  manifest.hosts = epochHostInstallEntries(serverBase).map((entry) => entry.host);
  updateHostConfigManifest(manifest, serverBase);
  updateTransportServerBase(manifest, serverBase);
  return manifest;
}

function updateInstallManifest(content: Buffer, serverBase: string) {
  const manifest = JSON.parse(content.toString("utf8")) as unknown;
  return Buffer.from(`${JSON.stringify(synchronizeObsidianEpochInstallManifest(manifest, serverBase), null, 2)}\n`, "utf8");
}

function updateInstallManifestReleaseMetadata(
  content: Buffer,
  sourceDateEpoch: number,
  sourceDateEpochSource: SourceDateEpochSource,
) {
  const manifest = JSON.parse(content.toString("utf8")) as unknown;
  const synchronized = synchronizeObsidianEpochInstallManifest(manifest);
  if (!isRecord(synchronized)) throw new Error("install_manifest_not_object");
  addReleaseVerificationMetadata(synchronized, sourceDateEpoch, sourceDateEpochSource);
  return Buffer.from(`${JSON.stringify(synchronized, null, 2)}\n`, "utf8");
}

function updatePluginManifest(content: Buffer, serverBase: string) {
  const manifest = JSON.parse(content.toString("utf8")) as unknown;
  if (!isRecord(manifest)) throw new Error("plugin_manifest_not_object");
  const mcpServers = manifest.mcpServers;
  if (isRecord(mcpServers)) {
    for (const server of Object.values(mcpServers)) {
      if (!isRecord(server)) continue;
      server.type = "http";
      server.url = `${serverBase}/mcp`;
      delete server.command;
      delete server.args;
      delete server.cwd;
      delete server.env;
    }
  }
  if (Array.isArray(mcpServers)) {
    for (const server of mcpServers) {
      if (!isRecord(server)) continue;
      const env = isRecord(server.env) ? server.env : {};
      server.env = {
        ...env,
        AGENT_WORLD_SERVER: serverBase,
      };
    }
  }
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function packageFileWithServerBase(file: ArchiveFile, serverBase: string): ArchiveFile {
  if (file.path === "install-manifest.json" || file.path === "obsidian-epoch/assets/install-manifest.json") {
    return {
      ...file,
      content: updateInstallManifest(file.content, serverBase),
    };
  }
  if (file.path === ".codex-plugin/plugin.json") {
    return {
      ...file,
      content: updatePluginManifest(file.content, serverBase),
    };
  }
  return file;
}

function packageFileWithReleaseMetadata(
  file: ArchiveFile,
  sourceDateEpoch: number,
  sourceDateEpochSource: SourceDateEpochSource,
): ArchiveFile {
  if (file.path === "install-manifest.json" || file.path === "obsidian-epoch/assets/install-manifest.json") {
    return {
      ...file,
      content: updateInstallManifestReleaseMetadata(file.content, sourceDateEpoch, sourceDateEpochSource),
    };
  }
  return file;
}

function resolvePackageArchiveOptions(input: string | ObsidianEpochPackageArchiveOptions) {
  if (typeof input === "string") {
    return {
      packageRoot: resolvePath(input),
      serverBase: undefined,
      sourceDateEpoch: undefined,
    };
  }
  return {
    packageRoot: resolvePath(input.packageRoot || defaultPackageRoot),
    serverBase: input.serverBase ? normalizedServerBase(input.serverBase) : undefined,
    sourceDateEpoch: input.sourceDateEpoch,
  };
}

function resolvePackageArchiveBuildContext(input: string | ObsidianEpochPackageArchiveOptions) {
  const options = resolvePackageArchiveOptions(input);
  const archiveMtime = resolveObsidianEpochSourceDateEpoch(options.sourceDateEpoch);
  const sourceDateEpochSource: SourceDateEpochSource = options.sourceDateEpoch !== undefined
    ? "explicit_option"
    : process.env[OBSIDIAN_EPOCH_SOURCE_DATE_EPOCH_ENV_VAR] === undefined
      ? "release_revision"
      : "SOURCE_DATE_EPOCH";
  return {
    ...options,
    archiveMtime,
    sourceDateEpochSource,
  };
}

export function obsidianEpochPackageArchiveCacheKey(
  input: string | ObsidianEpochPackageArchiveOptions = defaultPackageRoot,
) {
  const context = resolvePackageArchiveBuildContext(input);
  return JSON.stringify({
    packageRoot: context.packageRoot,
    serverBase: context.serverBase || null,
    archiveMtime: context.archiveMtime,
    sourceDateEpochSource: context.sourceDateEpochSource,
    releaseKeyId: obsidianEpochReleaseKeyId(),
    signingTrust: obsidianEpochPackageSigningTrust(),
  });
}

export async function createObsidianEpochPackageArchive(
  input: string | ObsidianEpochPackageArchiveOptions = defaultPackageRoot,
): Promise<Buffer> {
  const {
    packageRoot,
    serverBase,
    archiveMtime,
    sourceDateEpochSource,
  } = resolvePackageArchiveBuildContext(input);
  const rootStat = await stat(packageRoot);
  if (!rootStat.isDirectory()) throw new Error("package_root_not_directory");
  const hostConfiguredFiles = serverBase
    ? withGeneratedHostConfigFiles((await listPackageFiles(packageRoot)).map((file) => packageFileWithServerBase(file, serverBase)), serverBase)
    : withGeneratedHostConfigFiles(await listPackageFiles(packageRoot));
  const files = withGeneratedCodexPluginFiles(hostConfiguredFiles, serverBase);
  const filesWithReleaseMetadata = files.map((file) => packageFileWithReleaseMetadata(
    file,
    archiveMtime,
    sourceDateEpochSource,
  ));
  if (!filesWithReleaseMetadata.some((file) => file.path === "obsidian-epoch/SKILL.md")) {
    throw new Error("skill_package_missing_skill");
  }
  if (!filesWithReleaseMetadata.some((file) => file.path === ".codex-plugin/plugin.json")) {
    throw new Error("skill_package_missing_plugin_manifest");
  }
  if (!filesWithReleaseMetadata.some((file) => file.path === ".mcp.json")) {
    throw new Error("skill_package_missing_mcp_manifest");
  }
  const packagedFiles = withPackageIntegrityManifest(filesWithReleaseMetadata);
  return createTarGzArchive(packagedFiles, { mtime: archiveMtime });
}
