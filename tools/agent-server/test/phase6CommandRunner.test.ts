import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ATTESTATION_KEY_ENV,
  loadAttestationKey,
  receiptHash,
  validateExecutionReceipt,
} from "../phase6-command-runner.ts";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const scratchRoot = "tools/agent-server/test/.tmp-phase6-command-runner";
const createFileScript = [
  "const fs=require('node:fs')",
  "const output=process.argv[1]",
  `const leaked=process.env.${ATTESTATION_KEY_ENV}!==undefined`,
  "setTimeout(()=>fs.writeFileSync(output,leaked?'key path leaked\\n':'runner artifact\\n'),20)",
].join(";");

function runRunner(args, keyFile) {
  const env = { ...process.env };
  if (keyFile === null) delete env[ATTESTATION_KEY_ENV];
  else env[ATTESTATION_KEY_ENV] = keyFile;
  return spawnSync(process.execPath, ["tools/agent-server/phase6-command-runner.ts", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    env,
  });
}

function resetScratch(t) {
  const relative = `${scratchRoot}/${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const absolute = path.join(repoRoot, relative);
  fs.rmSync(absolute, { recursive: true, force: true });
  fs.mkdirSync(absolute, { recursive: true });
  t.after(() => fs.rmSync(absolute, { recursive: true, force: true }));
  return { relative, absolute };
}

function createKey(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase6-attestation-"));
  const keyFile = path.join(directory, "trust.bin");
  fs.writeFileSync(keyFile, options.bytes ?? crypto.randomBytes(32), { mode: options.mode ?? 0o600 });
  fs.chmodSync(keyFile, options.mode ?? 0o600);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return keyFile;
}

function runnerArgs(outputPath, receiptPath, script = createFileScript, extraArgs = [outputPath]) {
  const args = ["--program", process.execPath, "--arg", "-e", "--arg", script];
  for (const value of extraArgs) args.push("--arg", value);
  args.push("--claim-output", outputPath, "--receipt", receiptPath);
  return args;
}

test("runner signs a private receipt for outputs created by the shell:false command", (t) => {
  const scratch = resetScratch(t);
  const keyFile = createKey(t);
  const outputPath = `${scratch.relative}/artifact.txt`;
  const receiptPath = `${scratch.relative}/receipt.json`;
  const result = runRunner(runnerArgs(outputPath, receiptPath), keyFile);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(path.join(repoRoot, outputPath), "utf8"), "runner artifact\n");
  const body = JSON.parse(result.stdout);
  const receiptFile = path.join(repoRoot, receiptPath);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
  assert.equal(body.receiptHash, receipt.receiptHash);
  assert.equal(receipt.receiptHash, receiptHash(receipt));
  assert.equal(fs.statSync(receiptFile).mode & 0o777, 0o600);
  assert.equal(receipt.keyId, loadAttestationKey({ keyFile }).keyId);
  assert.match(receipt.signature, /^hmac-sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(receipt).includes("process.exit"), false);
  assert.deepEqual(receipt.outputs.map((entry) => ({ preState: entry.preState, createdByRun: entry.createdByRun })), [
    { preState: "absent", createdByRun: true },
  ]);
  assert.ok(Date.parse(receipt.outputs[0].mtime) > Date.parse(receipt.startedAt));
  assert.ok(Date.parse(receipt.outputs[0].ctime) > Date.parse(receipt.startedAt));
  assert.deepEqual(validateExecutionReceipt(receipt, { keyFile }).errors, []);
});

test("runner rejects pre-existing outputs before spawning even when the command would exit zero", (t) => {
  const scratch = resetScratch(t);
  const keyFile = createKey(t);
  const outputPath = `${scratch.relative}/artifact.txt`;
  const receiptPath = `${scratch.relative}/receipt.json`;
  fs.writeFileSync(path.join(repoRoot, outputPath), "pre-existing artifact\n", "utf8");

  const result = runRunner(runnerArgs(outputPath, receiptPath, "process.exit(0)", []), keyFile);

  assert.notEqual(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.code, "runtime_error");
  assert.match(body.detailHash, /^[a-f0-9]{16}$/);
  assert.equal(result.stdout.includes(outputPath), false);
  assert.equal(fs.existsSync(path.join(repoRoot, receiptPath)), false);
});

test("runner rejects no-op, directory, symlink, and stale-timestamp claimed outputs", async (t) => {
  const scenarios = [
    { name: "no-op", script: "process.exit(0)", extraArgs: [], message: /ENOENT|missing|invalid/i },
    {
      name: "directory",
      script: "const fs=require('node:fs');const p=process.argv[1];setTimeout(()=>fs.mkdirSync(p),20)",
      extraArgs: (outputPath) => [outputPath],
      message: /regular file|directory/i,
    },
    {
      name: "symlink",
      prepare: (scratch) => {
        const targetPath = `${scratch.relative}/target.txt`;
        fs.writeFileSync(path.join(repoRoot, targetPath), "target\n", "utf8");
        return targetPath;
      },
      script: "const fs=require('node:fs');const target=process.argv[1];const output=process.argv[2];setTimeout(()=>fs.symlinkSync(target,output),20)",
      extraArgs: (outputPath, targetPath) => [path.join(repoRoot, targetPath), outputPath],
      message: /regular file|symlink/i,
    },
    {
      name: "stale-mtime",
      script: "const fs=require('node:fs');const p=process.argv[1];setTimeout(()=>{fs.writeFileSync(p,'artifact\\n');fs.utimesSync(p,new Date(0),new Date(0))},20)",
      extraArgs: (outputPath) => [outputPath],
      message: /mtime.*execution window/i,
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, (subtest) => {
      const scratch = resetScratch(subtest);
      const keyFile = createKey(subtest);
      const outputPath = `${scratch.relative}/artifact`;
      const receiptPath = `${scratch.relative}/receipt.json`;
      const prepared = scenario.prepare?.(scratch);
      const extraArgs = typeof scenario.extraArgs === "function" ? scenario.extraArgs(outputPath, prepared) : scenario.extraArgs;
      const result = runRunner(runnerArgs(outputPath, receiptPath, scenario.script, extraArgs), keyFile);
      assert.notEqual(result.status, 0);
      const body = JSON.parse(result.stdout);
      assert.equal(body.code, "runtime_error");
      assert.match(body.detailHash, /^[a-f0-9]{16}$/);
      assert.equal(result.stdout.includes(outputPath), false);
      assert.equal(fs.existsSync(path.join(repoRoot, receiptPath)), false);
    });
  }
});

test("runner and verifier fail closed for missing, weak, repository-local, or wrong keys", (t) => {
  const scratch = resetScratch(t);
  const outputPath = `${scratch.relative}/artifact.txt`;
  const receiptPath = `${scratch.relative}/receipt.json`;
  const missing = runRunner(runnerArgs(outputPath, receiptPath), null);
  assert.notEqual(missing.status, 0);
  assert.equal(JSON.parse(missing.stdout).code, "runtime_error");
  assert.throws(() => loadAttestationKey({ keyFile: "" }), /absolute key file/);
  assert.equal(fs.existsSync(path.join(repoRoot, outputPath)), false);

  const repoKey = path.join(scratch.absolute, "trust.bin");
  fs.writeFileSync(repoKey, crypto.randomBytes(32), { mode: 0o600 });
  const repoLocal = runRunner(runnerArgs(outputPath, receiptPath), repoKey);
  assert.notEqual(repoLocal.status, 0);
  assert.throws(() => loadAttestationKey({ keyFile: repoKey }), /outside the repository/);
  assert.equal(repoLocal.stdout.includes(repoKey), false);

  const looseKey = createKey(t, { mode: 0o644 });
  const loose = runRunner(runnerArgs(outputPath, receiptPath), looseKey);
  assert.notEqual(loose.status, 0);
  assert.throws(() => loadAttestationKey({ keyFile: looseKey }), /0600/);
  assert.equal(loose.stdout.includes(looseKey), false);

  const shortKey = createKey(t, { bytes: crypto.randomBytes(31) });
  const short = runRunner(runnerArgs(outputPath, receiptPath), shortKey);
  assert.notEqual(short.status, 0);
  assert.throws(() => loadAttestationKey({ keyFile: shortKey }), /at least 32 bytes/);

  const keyFile = createKey(t);
  const valid = runRunner(runnerArgs(outputPath, receiptPath), keyFile);
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  const receipt = JSON.parse(fs.readFileSync(path.join(repoRoot, receiptPath), "utf8"));
  const wrongKey = createKey(t);
  const validation = validateExecutionReceipt(receipt, { keyFile: wrongKey });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /keyId does not match|signature verification failed/);
});

test("self-consistent handwritten receipts and signature tampering fail HMAC verification", (t) => {
  const scratch = resetScratch(t);
  const keyFile = createKey(t);
  const outputPath = `${scratch.relative}/artifact.txt`;
  const receiptPath = `${scratch.relative}/receipt.json`;
  const result = runRunner(runnerArgs(outputPath, receiptPath), keyFile);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const receipt = JSON.parse(fs.readFileSync(path.join(repoRoot, receiptPath), "utf8"));

  const forged = structuredClone(receipt);
  forged.program = "/handwritten/program";
  forged.receiptHash = receiptHash(forged);
  const forgedValidation = validateExecutionReceipt(forged, { keyFile });
  assert.equal(forgedValidation.ok, false);
  assert.match(forgedValidation.errors.join("\n"), /signature verification failed/);

  for (const [field, value, expected] of [
    ["preState", "present", /preState=absent/],
    ["createdByRun", false, /createdByRun=true/],
    ["mtime", receipt.startedAt, /mtime must be inside the command execution window/],
    ["ctime", receipt.startedAt, /ctime must be inside the command execution window/],
  ]) {
    const changedClaim = structuredClone(receipt);
    changedClaim.outputs[0][field] = value;
    changedClaim.receiptHash = receiptHash(changedClaim);
    const validation = validateExecutionReceipt(changedClaim, { keyFile });
    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), expected);
    assert.match(validation.errors.join("\n"), /signature verification failed/);
  }

  const tampered = structuredClone(receipt);
  tampered.signature = `hmac-sha256:${"0".repeat(64)}`;
  const tamperedValidation = validateExecutionReceipt(tampered, { keyFile });
  assert.equal(tamperedValidation.ok, false);
  assert.match(tamperedValidation.errors.join("\n"), /signature verification failed/);
});

test("failed commands can only leave signed, non-publishable receipts when they created the claims", (t) => {
  const scratch = resetScratch(t);
  const keyFile = createKey(t);
  const outputPath = `${scratch.relative}/artifact.txt`;
  const receiptPath = `${scratch.relative}/failed-receipt.json`;
  const script = "const fs=require('node:fs');const p=process.argv[1];setTimeout(()=>{fs.writeFileSync(p,'failed artifact\\n');process.exit(9)},20)";
  const result = runRunner(runnerArgs(outputPath, receiptPath, script, [outputPath]), keyFile);

  assert.notEqual(result.status, 0);
  const receipt = JSON.parse(fs.readFileSync(path.join(repoRoot, receiptPath), "utf8"));
  assert.deepEqual(validateExecutionReceipt(receipt, { keyFile, requireSuccess: false }).errors, []);
  const validation = validateExecutionReceipt(receipt, { keyFile });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /did not complete successfully/);
});
