import type { DatabaseSync } from "node:sqlite";

export const PUBLIC_RELEASE_READINESS_SCHEMA_VERSION = 1 as const;
export const PUBLIC_RELEASE_EVIDENCE_SCHEMA_MIGRATION = 5 as const;

const PUBLIC_RELEASE_EVIDENCE_ID = "latest";
const DEFAULT_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

type JsonRecord = Record<string, unknown>;

export interface PublicReleasePackageEvidence {
  readonly sha256: string;
  readonly releaseKeyId: string;
  readonly signingTrust: "operator_configured";
}

export interface PublicReleaseEvidence {
  readonly schemaVersion: typeof PUBLIC_RELEASE_READINESS_SCHEMA_VERSION;
  readonly mode: "production";
  readonly recordedAt: string;
  readonly package: PublicReleasePackageEvidence;
  readonly image: {
    readonly digest: string;
  };
  readonly checks: {
    readonly installSmoke: true;
    readonly operatorOverview: true;
    readonly recoveryDrill: true;
    readonly backup: true;
    readonly restore: true;
    readonly artifactDigests: true;
    readonly releaseSource: true;
  };
  readonly recovery: {
    readonly signatureVerified: true;
    readonly replayProtectionVerified: true;
  };
}

export interface PublicReleaseEvidenceStore {
  readonly read: () => PublicReleaseEvidence | undefined;
  readonly record: (value: unknown) => PublicReleaseEvidence;
}

export type PublicReleaseRequirementId =
  | "persistent_store"
  | "persistent_registration_protection"
  | "maintenance_worker"
  | "semantic_world_memory"
  | "live_recovery_manifest"
  | "server_ai"
  | "mcp_live_metrics"
  | "install_smoke"
  | "operator_package_signature"
  | "recovery_rehearsal";

export interface PublicReleaseRequirement {
  readonly id: PublicReleaseRequirementId;
  readonly label: string;
  readonly status: "pass" | "fail";
  readonly reasonCode: string;
  readonly detail: string;
}

export interface PublicReleaseReadiness {
  readonly schemaVersion: typeof PUBLIC_RELEASE_READINESS_SCHEMA_VERSION;
  readonly evaluatedAt: string;
  readonly status: "ready" | "blocked";
  readonly publicOpeningAllowed: boolean;
  readonly localTrialAllowed: true;
  readonly summary: string;
  readonly requirements: readonly PublicReleaseRequirement[];
  readonly evidence: {
    readonly status: "current" | "missing" | "mismatch" | "expired";
    readonly recordedAt?: string;
  };
}

export interface PublicReleaseReadinessInput {
  readonly health: unknown;
  readonly package: {
    readonly sha256: string;
    readonly releaseKeyId: string;
    readonly signingTrust: string;
  };
  readonly evidence?: PublicReleaseEvidence;
  readonly now?: Date;
  readonly evidenceMaxAgeMs?: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function integerValue(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}

function isSha256(value: string | undefined) {
  return Boolean(value && /^[a-f0-9]{64}$/.test(value));
}

function isImageDigest(value: string | undefined) {
  return Boolean(value && /^sha256:[a-f0-9]{64}$/.test(value));
}

function validTimestamp(value: string | undefined) {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function requiredTrue(value: JsonRecord, key: string, error: string) {
  if (value[key] !== true) throw new Error(error);
  return true as const;
}

function parsePublicReleaseEvidence(value: unknown): PublicReleaseEvidence {
  const input = recordValue(value);
  if (input.schemaVersion !== PUBLIC_RELEASE_READINESS_SCHEMA_VERSION) {
    throw new Error("public_release_evidence_schema_version_invalid");
  }
  if (input.mode !== "production") throw new Error("public_release_evidence_mode_invalid");
  const recordedAt = stringValue(input.recordedAt);
  if (!recordedAt || !validTimestamp(recordedAt)) throw new Error("public_release_evidence_recorded_at_invalid");

  const packageRecord = recordValue(input.package);
  const packageSha256 = stringValue(packageRecord.sha256);
  const releaseKeyId = stringValue(packageRecord.releaseKeyId);
  if (!packageSha256 || !isSha256(packageSha256)) throw new Error("public_release_evidence_package_sha256_invalid");
  if (!releaseKeyId || !isSha256(releaseKeyId)) throw new Error("public_release_evidence_release_key_id_invalid");
  if (packageRecord.signingTrust !== "operator_configured") {
    throw new Error("public_release_evidence_signing_trust_invalid");
  }

  const imageRecord = recordValue(input.image);
  const imageDigest = stringValue(imageRecord.digest);
  if (!imageDigest || !isImageDigest(imageDigest)) throw new Error("public_release_evidence_image_digest_invalid");

  const checks = recordValue(input.checks);
  const recovery = recordValue(input.recovery);
  return {
    schemaVersion: PUBLIC_RELEASE_READINESS_SCHEMA_VERSION,
    mode: "production",
    recordedAt,
    package: {
      sha256: packageSha256,
      releaseKeyId,
      signingTrust: "operator_configured",
    },
    image: { digest: imageDigest },
    checks: {
      installSmoke: requiredTrue(checks, "installSmoke", "public_release_evidence_install_smoke_required"),
      operatorOverview: requiredTrue(checks, "operatorOverview", "public_release_evidence_operator_overview_required"),
      recoveryDrill: requiredTrue(checks, "recoveryDrill", "public_release_evidence_recovery_drill_required"),
      backup: requiredTrue(checks, "backup", "public_release_evidence_backup_required"),
      restore: requiredTrue(checks, "restore", "public_release_evidence_restore_required"),
      artifactDigests: requiredTrue(checks, "artifactDigests", "public_release_evidence_artifact_digests_required"),
      releaseSource: requiredTrue(checks, "releaseSource", "public_release_evidence_release_source_required"),
    },
    recovery: {
      signatureVerified: requiredTrue(recovery, "signatureVerified", "public_release_evidence_backup_signature_required"),
      replayProtectionVerified: requiredTrue(recovery, "replayProtectionVerified", "public_release_evidence_replay_protection_required"),
    },
  };
}

export function migratePublicReleaseEvidenceSchema(db: DatabaseSync) {
  const existing = db.prepare("SELECT version FROM schema_migrations WHERE version = ?")
    .get(PUBLIC_RELEASE_EVIDENCE_SCHEMA_MIGRATION);
  if (existing) return;

  let transactionStarted = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    const concurrentlyApplied = db.prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(PUBLIC_RELEASE_EVIDENCE_SCHEMA_MIGRATION);
    if (!concurrentlyApplied) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS public_release_evidence (
          evidence_id TEXT PRIMARY KEY CHECK(evidence_id = '${PUBLIC_RELEASE_EVIDENCE_ID}'),
          recorded_at TEXT NOT NULL,
          evidence_json TEXT NOT NULL
        );
      `);
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)")
        .run(PUBLIC_RELEASE_EVIDENCE_SCHEMA_MIGRATION, new Date().toISOString());
    }
    db.exec("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) db.exec("ROLLBACK");
    throw error;
  }
}

export function createPublicReleaseEvidenceStore(db: DatabaseSync): PublicReleaseEvidenceStore {
  return {
    read() {
      const row = db.prepare(`
        SELECT evidence_json
        FROM public_release_evidence
        WHERE evidence_id = ?
      `).get(PUBLIC_RELEASE_EVIDENCE_ID) as { readonly evidence_json: string } | undefined;
      if (!row) return undefined;
      try {
        return parsePublicReleaseEvidence(JSON.parse(row.evidence_json) as unknown);
      } catch {
        return undefined;
      }
    },
    record(value: unknown) {
      const evidence = parsePublicReleaseEvidence(value);
      db.prepare(`
        INSERT INTO public_release_evidence(evidence_id, recorded_at, evidence_json)
        VALUES (?, ?, ?)
        ON CONFLICT(evidence_id) DO UPDATE SET
          recorded_at = excluded.recorded_at,
          evidence_json = excluded.evidence_json
      `).run(PUBLIC_RELEASE_EVIDENCE_ID, evidence.recordedAt, JSON.stringify(evidence));
      return evidence;
    },
  };
}

function requirement(
  id: PublicReleaseRequirementId,
  label: string,
  passed: boolean,
  passDetail: string,
  failureCode: string,
  failureDetail: string,
): PublicReleaseRequirement {
  return {
    id,
    label,
    status: passed ? "pass" : "fail",
    reasonCode: passed ? "ready" : failureCode,
    detail: passed ? passDetail : failureDetail,
  };
}

function evidenceState(
  evidence: PublicReleaseEvidence | undefined,
  currentPackage: PublicReleaseReadinessInput["package"],
  nowMs: number,
  maxAgeMs: number,
) {
  if (!evidence) return { status: "missing" as const };
  if (evidence.package.sha256 !== currentPackage.sha256 || evidence.package.releaseKeyId !== currentPackage.releaseKeyId) {
    return { status: "mismatch" as const, recordedAt: evidence.recordedAt };
  }
  const recordedAtMs = Date.parse(evidence.recordedAt);
  if (!Number.isFinite(recordedAtMs) || recordedAtMs > nowMs || nowMs - recordedAtMs > maxAgeMs) {
    return { status: "expired" as const, recordedAt: evidence.recordedAt };
  }
  return { status: "current" as const, recordedAt: evidence.recordedAt };
}

export function evaluatePublicReleaseReadiness(input: PublicReleaseReadinessInput): PublicReleaseReadiness {
  const now = input.now || new Date();
  const nowMs = now.getTime();
  const maxAgeMs = Number.isSafeInteger(input.evidenceMaxAgeMs) && Number(input.evidenceMaxAgeMs) > 0
    ? Number(input.evidenceMaxAgeMs)
    : DEFAULT_EVIDENCE_MAX_AGE_MS;
  const health = recordValue(input.health);
  const checks = recordValue(health.checks);
  const store = recordValue(checks.store);
  const registration = recordValue(checks.publicRegistration);
  const maintenance = recordValue(checks.maintenance);
  const worldMemory = recordValue(checks.worldMemory);
  const knowledge = recordValue(worldMemory.knowledge);
  const recovery = recordValue(checks.recovery);
  const serverAi = recordValue(checks.serverAi);
  const mcp = recordValue(checks.mcp);
  const tools = recordValue(mcp.tools);
  const errorBudget = recordValue(mcp.errorBudget);
  const evidence = evidenceState(input.evidence, input.package, nowMs, maxAgeMs);

  const semanticWorldMemoryReady = worldMemory.status === "ok"
    && worldMemory.semanticEnabled === true
    && integerValue(knowledge.sources) !== undefined
    && Number(knowledge.sources) > 0
    && integerValue(knowledge.chunks) !== undefined
    && Number(knowledge.chunks) > 0
    && knowledge.ready === knowledge.chunks
    && knowledge.pending === 0
    && knowledge.processing === 0
    && knowledge.failed === 0;
  const mcpMetricsReady = (integerValue(tools.total) || 0) > 0
    && (integerValue(tools.success) || 0) > 0
    && errorBudget.samplingTimeoutAlert !== true
    && errorBudget.toolFailureAlert !== true;
  const matchingEvidence = evidence.status === "current";
  const evidenceFailureCode = evidence.status === "missing"
    ? "release_evidence_missing"
    : evidence.status === "mismatch"
      ? "release_evidence_package_mismatch"
      : "release_evidence_expired";

  const requirements = [
    requirement(
      "persistent_store",
      "持久世界存储",
      store.status === "ok" && store.kind === "sqlite" && store.persistent === true,
      "世界状态写入持久 SQLite。",
      "persistent_store_required",
      "公开 MMO 需要可恢复的持久 SQLite 世界存储。",
    ),
    requirement(
      "persistent_registration_protection",
      "公开注册保护",
      registration.mode === "enforce" && registration.persistent === true && registration.actorHashSecretConfigured === true,
      "公开注册已启用持久的防滥用保护。",
      "public_registration_protection_required",
      "公开注册仍是 permissive 或未持久化，不能向公众开放。",
    ),
    requirement(
      "maintenance_worker",
      "世界维护任务",
      maintenance.status === "ok" && maintenance.enabled === true,
      "维护任务正在运行。",
      "maintenance_worker_required",
      "世界维护任务未运行，长期世界状态不能作为公开运营承诺。",
    ),
    requirement(
      "semantic_world_memory",
      "世界记忆检索",
      semanticWorldMemoryReady,
      "语义检索已启用，全部世界知识片段已就绪。",
      "semantic_world_memory_required",
      "世界知识尚未全部完成语义索引，Agent 不能稳定检索公开设定。",
    ),
    requirement(
      "live_recovery_manifest",
      "在线恢复状态",
      recovery.status === "ok" && recovery.persistent === true,
      "在线恢复清单可用。",
      "live_recovery_manifest_required",
      "在线恢复状态异常，不能公开开放。",
    ),
    requirement(
      "server_ai",
      "服务器任务生成",
      serverAi.status === "ready",
      "服务器任务生成服务已就绪。",
      "server_ai_not_ready",
      "服务器任务生成服务尚未就绪，不能把降级状态伪装成公开运营。",
    ),
    requirement(
      "mcp_live_metrics",
      "真实 MCP 调用",
      mcpMetricsReady,
      "当前进程已记录成功 MCP 工具调用，错误预算正常。",
      "mcp_live_metrics_required",
      "尚无成功的真实 MCP 工具调用，或错误预算正在告警。",
    ),
    requirement(
      "install_smoke",
      "安装与首局冒烟",
      matchingEvidence,
      "当前安装包已有匹配的生产首局冒烟记录。",
      evidenceFailureCode,
      "缺少与当前安装包和签名一致的生产首局冒烟记录。",
    ),
    requirement(
      "operator_package_signature",
      "运营方安装包签名",
      input.package.signingTrust === "operator_configured",
      "安装包由运营方配置的签名密钥签发。",
      "operator_package_signature_required",
      "当前安装包仍使用本地 alpha 临时签名，不能公开发布。",
    ),
    requirement(
      "recovery_rehearsal",
      "恢复演练",
      matchingEvidence,
      "当前安装包已有匹配的生产备份、还原和恢复演练记录。",
      evidenceFailureCode,
      "缺少与当前安装包和签名一致的生产恢复演练记录。",
    ),
  ] as const;
  const blocked = requirements.some((item) => item.status === "fail");
  return {
    schemaVersion: PUBLIC_RELEASE_READINESS_SCHEMA_VERSION,
    evaluatedAt: now.toISOString(),
    status: blocked ? "blocked" : "ready",
    publicOpeningAllowed: !blocked,
    localTrialAllowed: true,
    summary: blocked
      ? "公开 MMO 尚未开放；此节点仅可用于本地试玩和内部验收。"
      : "公开 MMO 发布门禁已通过，可以向公众开放。",
    requirements,
    evidence,
  };
}
