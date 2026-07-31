import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createPublicReleaseEvidenceStore,
  evaluatePublicReleaseReadiness,
  type PublicReleaseEvidence,
} from "../lib/publicReleaseReadiness.ts";
import { createAgentSqlitePersistenceStores } from "../lib/sqliteStore.ts";

const packageInfo = {
  sha256: "a".repeat(64),
  releaseKeyId: "b".repeat(64),
  signingTrust: "operator_configured" as const,
};

function productionEvidence(overrides: Partial<PublicReleaseEvidence> = {}): PublicReleaseEvidence {
  return {
    schemaVersion: 1,
    mode: "production",
    recordedAt: "2026-07-30T08:00:00.000Z",
    package: packageInfo,
    image: { digest: `sha256:${"c".repeat(64)}` },
    checks: {
      installSmoke: true,
      operatorOverview: true,
      recoveryDrill: true,
      backup: true,
      restore: true,
      artifactDigests: true,
      releaseSource: true,
    },
    recovery: {
      signatureVerified: true,
      replayProtectionVerified: true,
    },
    ...overrides,
  };
}

function healthyRuntimeHealth() {
  return {
    checks: {
      store: { status: "ok", kind: "sqlite", persistent: true },
      maintenance: { status: "ok", enabled: true },
      worldMemory: {
        status: "ok",
        semanticEnabled: true,
        knowledge: { sources: 122, chunks: 298, pending: 0, processing: 0, ready: 298, failed: 0 },
      },
      recovery: { status: "ok", persistent: true },
      publicRegistration: {
        mode: "enforce",
        persistent: true,
        actorHashSecretConfigured: true,
      },
      serverAi: { status: "ready" },
      mcp: {
        tools: { total: 4, success: 4, failure: 0 },
        errorBudget: { samplingTimeoutAlert: false, toolFailureAlert: false },
      },
    },
  };
}

test("public release readiness blocks a local alpha runtime with concrete reasons", () => {
  const readiness = evaluatePublicReleaseReadiness({
    health: {
      checks: {
        store: { status: "ok", kind: "sqlite", persistent: true },
        maintenance: { status: "disabled", enabled: false },
        worldMemory: {
          status: "lexical_only",
          semanticEnabled: false,
          knowledge: { sources: 122, chunks: 298, pending: 298, processing: 0, ready: 0, failed: 0 },
        },
        recovery: { status: "ok", persistent: true },
        publicRegistration: { mode: "permissive", persistent: false, actorHashSecretConfigured: false },
        serverAi: { status: "degraded" },
        mcp: {
          tools: { total: 0, success: 0, failure: 0 },
          errorBudget: { samplingTimeoutAlert: false, toolFailureAlert: false },
        },
      },
    },
    package: {
      ...packageInfo,
      signingTrust: "local_alpha_fallback",
    },
    now: new Date("2026-07-30T08:01:00.000Z"),
  });

  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.publicOpeningAllowed, false);
  assert.equal(readiness.localTrialAllowed, true);
  assert.deepEqual(
    readiness.requirements.filter((requirement) => requirement.status === "fail").map((requirement) => requirement.id),
    [
      "persistent_registration_protection",
      "maintenance_worker",
      "semantic_world_memory",
      "server_ai",
      "mcp_live_metrics",
      "install_smoke",
      "operator_package_signature",
      "recovery_rehearsal",
    ],
  );
});

test("public release readiness opens only when live health and matching production evidence both pass", () => {
  const readiness = evaluatePublicReleaseReadiness({
    health: healthyRuntimeHealth(),
    package: packageInfo,
    evidence: productionEvidence(),
    now: new Date("2026-07-30T08:01:00.000Z"),
  });

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.publicOpeningAllowed, true);
  assert.equal(readiness.requirements.every((requirement) => requirement.status === "pass"), true);
});

test("public release evidence cannot approve a different package", () => {
  const readiness = evaluatePublicReleaseReadiness({
    health: healthyRuntimeHealth(),
    package: packageInfo,
    evidence: productionEvidence({
      package: {
        ...packageInfo,
        sha256: "d".repeat(64),
      },
    }),
    now: new Date("2026-07-30T08:01:00.000Z"),
  });

  assert.equal(readiness.status, "blocked");
  assert.equal(readiness.requirements.find((requirement) => requirement.id === "install_smoke")?.reasonCode, "release_evidence_package_mismatch");
  assert.equal(readiness.requirements.find((requirement) => requirement.id === "recovery_rehearsal")?.reasonCode, "release_evidence_package_mismatch");
});

test("production release evidence is stored in SQLite and survives a new store instance", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "epoch-public-release-readiness-"));
  const dbPath = path.join(tempDir, "agent-world.sqlite");
  try {
    const first = createAgentSqlitePersistenceStores(dbPath);
    const firstStore = createPublicReleaseEvidenceStore(first.database);
    const recorded = firstStore.record(productionEvidence());
    assert.equal(recorded.package.sha256, packageInfo.sha256);
    first.database.close();

    const second = createAgentSqlitePersistenceStores(dbPath);
    const secondStore = createPublicReleaseEvidenceStore(second.database);
    assert.deepEqual(secondStore.read(), productionEvidence());
    second.database.close();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
