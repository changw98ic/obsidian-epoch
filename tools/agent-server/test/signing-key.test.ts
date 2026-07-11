import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createObsidianEpochPackageArchive,
  OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR,
  verifyObsidianEpochPackageSignature,
} from "../lib/packageArchive.ts";
import { gunzipSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const graphAppRoot = resolve(repoRoot, "tools/graph-react-app");

interface TarEntry {
  readonly name: string;
  readonly content: Buffer;
}

async function runSigningKeyCommand(args: string[]) {
  const child = spawn("npm", ["run", "agent:generate-signing-key", "--", ...args], {
    cwd: graphAppRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
    },
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
  const [code] = await once(child, "exit");
  return {
    code,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  };
}

function parseLastJsonLine(stdout: string) {
  return JSON.parse(stdout.trim().split(/\r?\n/).at(-1) || "{}");
}

function tarEntries(archive: Buffer): TarEntry[] {
  const raw = gunzipSync(archive);
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + 512 <= raw.length) {
    const header = raw.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    if (!name) break;
    const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeText || "0", 8);
    const contentStart = offset + 512;
    entries.push({ name, content: raw.subarray(contentStart, contentStart + size) });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

test("release signing key generator emits production install-smoke inputs", async () => {
  const { code, stdout, stderr } = await runSigningKeyCommand(["--json"]);
  assert.equal(code, 0, stderr || stdout);
  const result = parseLastJsonLine(stdout);

  assert.equal(result.type, "obsidian_epoch_release_signing_key");
  assert.equal(result.algorithm, "Ed25519");
  assert.equal(result.envVar, OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR);
  assert.match(result.privateKeyPem, /^-----BEGIN PRIVATE KEY-----/);
  assert.match(result.privateKeyPem, /-----END PRIVATE KEY-----\n$/);
  assert.match(result.publicKeyBase64, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.match(result.releaseKeyId, /^[a-f0-9]{64}$/);
  assert.equal(result.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR], result.privateKeyPem);
  assert.deepEqual(result.installSmokeArgs, [
    "--require-operator-signing",
    "--expected-release-key-id",
    result.releaseKeyId,
  ]);

  const publicKeyDer = createPublicKey(result.privateKeyPem).export({ type: "spki", format: "der" });
  assert.equal(result.publicKeyBase64, publicKeyDer.toString("base64"));
  assert.equal(result.releaseKeyId, createHash("sha256").update(publicKeyDer).digest("hex"));
});

test("generated release signing key signs package manifests with the same release key id", async () => {
  const command = await runSigningKeyCommand(["--json"]);
  assert.equal(command.code, 0, command.stderr || command.stdout);
  const generated = parseLastJsonLine(command.stdout);
  const previous = process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR];
  process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR] = generated.privateKeyPem;
  try {
    const archive = await createObsidianEpochPackageArchive({ serverBase: "https://epoch.example" });
    const entries = tarEntries(archive);
    const rootManifest = JSON.parse(entries.find((entry) => entry.name === "install-manifest.json")?.content.toString("utf8") || "{}");
    const skillManifest = JSON.parse(entries.find((entry) => entry.name === "obsidian-epoch/assets/install-manifest.json")?.content.toString("utf8") || "{}");

    assert.equal(rootManifest.verification.packageSigningTrust, "operator_configured");
    assert.equal(rootManifest.verification.packageSigningKeySource, OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR);
    assert.equal(rootManifest.verification.packageReleasePublicKey, generated.publicKeyBase64);
    assert.equal(rootManifest.verification.packageReleaseKeyId, generated.releaseKeyId);
    assert.equal(skillManifest.verification.packageReleaseKeyId, generated.releaseKeyId);
    assert.equal(verifyObsidianEpochPackageSignature(entries, { publicKey: generated.publicKeyBase64 }).verified, true);
  } finally {
    if (previous === undefined) {
      delete process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR];
    } else {
      process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR] = previous;
    }
  }
});

test("package signing accepts escaped key material from deployment env files", async () => {
  const command = await runSigningKeyCommand(["--json"]);
  assert.equal(command.code, 0, command.stderr || command.stdout);
  const generated = parseLastJsonLine(command.stdout);
  const previous = process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR];
  const encodedValues = [
    generated.privateKeyPem.replaceAll("\n", "\\n"),
    JSON.stringify(generated.privateKeyPem),
  ];

  try {
    for (const encodedValue of encodedValues) {
      process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR] = encodedValue;
      const archive = await createObsidianEpochPackageArchive({ serverBase: "https://epoch.example" });
      const entries = tarEntries(archive);
      const rootManifest = JSON.parse(
        entries.find((entry) => entry.name === "install-manifest.json")?.content.toString("utf8") || "{}",
      );
      assert.equal(rootManifest.verification.packageSigningTrust, "operator_configured");
      assert.equal(rootManifest.verification.packageReleasePublicKey, generated.publicKeyBase64);
      assert.equal(rootManifest.verification.packageReleaseKeyId, generated.releaseKeyId);
      assert.equal(verifyObsidianEpochPackageSignature(entries, { publicKey: generated.publicKeyBase64 }).verified, true);
    }
  } finally {
    if (previous === undefined) {
      delete process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR];
    } else {
      process.env[OBSIDIAN_EPOCH_PACKAGE_SIGNING_ENV_VAR] = previous;
    }
  }
});
