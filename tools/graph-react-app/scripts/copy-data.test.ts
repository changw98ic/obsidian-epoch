import assert from "node:assert/strict";
import test from "node:test";
import { copyFileWithRetry, includeMediaForArgs } from "./copy-data";

function errorWithCode(code: string) {
  const error = new Error(code) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

test("copyFileWithRetry retries transient EIO copy failures", async () => {
  let attempts = 0;
  await copyFileWithRetry("source.png", "target.png", {
    delayMs: 0,
    maxAttempts: 3,
    copyFile: async () => {
      attempts += 1;
      if (attempts === 1) throw errorWithCode("EIO");
    },
  });

  assert.equal(attempts, 2);
});

test("copyFileWithRetry does not retry non-transient copy failures", async () => {
  let attempts = 0;
  await assert.rejects(
    copyFileWithRetry("source.png", "target.png", {
      delayMs: 0,
      maxAttempts: 3,
      copyFile: async () => {
        attempts += 1;
        throw errorWithCode("EACCES");
      },
    }),
    /EACCES/,
  );

  assert.equal(attempts, 1);
});

test("container export mode skips large media copies", () => {
  assert.equal(includeMediaForArgs([]), true);
  assert.equal(includeMediaForArgs(["--skip-media"]), false);
});
