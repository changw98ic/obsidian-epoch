import { createHash } from "node:crypto";

export const IDEMPOTENCY_SUBJECT_IGNORED_FIELDS = new Set([
  "confirmationToken",
  "idempotencyKey",
  "localSecret",
  "newRecoveryCode",
  "recoveryCode",
]);

export function stableIdempotencySubject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => stableIdempotencySubject(entry));
  if (!value || typeof value !== "object") return value;
  const stable: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (IDEMPOTENCY_SUBJECT_IGNORED_FIELDS.has(key)) continue;
    const entry = (value as Record<string, unknown>)[key];
    if (entry === undefined) continue;
    stable[key] = stableIdempotencySubject(entry);
  }
  return stable;
}

export function idempotencySubjectHash(
  scope: string,
  explorerId: string,
  input: Readonly<Record<string, unknown>>,
) {
  return createHash("sha256")
    .update(JSON.stringify({
      explorerId,
      input: stableIdempotencySubject(input),
      scope,
    }))
    .digest("hex");
}

export function ownerIdempotencyKey(scope: string, explorerId: string, idempotencyKey: string) {
  return `${scope}:${explorerId}:${idempotencyKey}`;
}
