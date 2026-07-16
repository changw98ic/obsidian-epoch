const API_KEY_PATTERN = /\b(?:Bearer\s+)?sk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]{8,}=*/gi;
const LOCAL_SECRET_PATTERN = /\blocal[_-][A-Za-z0-9_-]{8,}\b/gi;
const REDACTED_SECRET = "[REDACTED_SECRET]";

export const SECRET_FIELD_NAMES = [
  "accessToken",
  "authorization",
  "bearerToken",
  "confirmationToken",
  "localSecret",
  "newRecoveryCode",
  "operatorKey",
  "publishToken",
  "recoveryCode",
  "shareToken",
] as const;

const SECRET_FIELD_SOURCE = SECRET_FIELD_NAMES.join("|");
const SERIALIZED_SECRET_PATTERN = new RegExp(`("(?:${SECRET_FIELD_SOURCE})"\\s*:\\s*)"[^"]*"`, "gi");
const DOUBLE_QUOTED_SECRET_PATTERN = new RegExp(`(\\b(?:${SECRET_FIELD_SOURCE})\\b\\s*(?::|=)\\s*)"[^"]*"`, "gi");
const SINGLE_QUOTED_SECRET_PATTERN = new RegExp(`(\\b(?:${SECRET_FIELD_SOURCE})\\b\\s*(?::|=)\\s*)'[^']*'`, "gi");
const UNQUOTED_SECRET_PATTERN = new RegExp(`(\\b(?:${SECRET_FIELD_SOURCE})\\b\\s*(?::|=)\\s*)(?!["'])[A-Za-z0-9._~+\\/-]{8,}=*`, "gi");
const SECRET_FIELD_PATTERN = new RegExp(`^(?:${SECRET_FIELD_SOURCE})$`, "i");

export interface SecretLeak {
  readonly index: number | undefined;
  readonly kind: "api_key" | "bearer" | "local_secret" | "secret_field";
  readonly preview: string;
}

const SECRET_LEAK_PATTERNS: readonly {
  readonly kind: SecretLeak["kind"];
  readonly pattern: RegExp;
  readonly preview: string;
}[] = [
  { kind: "api_key", pattern: API_KEY_PATTERN, preview: "[REDACTED_API_KEY]" },
  { kind: "bearer", pattern: BEARER_PATTERN, preview: `Bearer ${REDACTED_SECRET}` },
  { kind: "local_secret", pattern: LOCAL_SECRET_PATTERN, preview: REDACTED_SECRET },
  { kind: "secret_field", pattern: SERIALIZED_SECRET_PATTERN, preview: REDACTED_SECRET },
  { kind: "secret_field", pattern: DOUBLE_QUOTED_SECRET_PATTERN, preview: REDACTED_SECRET },
  { kind: "secret_field", pattern: SINGLE_QUOTED_SECRET_PATTERN, preview: REDACTED_SECRET },
  { kind: "secret_field", pattern: UNQUOTED_SECRET_PATTERN, preview: REDACTED_SECRET },
];

function serializedValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? "") || "";
}

function redactSecretText(value: string): string {
  return value
    .replace(SERIALIZED_SECRET_PATTERN, `$1"${REDACTED_SECRET}"`)
    .replace(DOUBLE_QUOTED_SECRET_PATTERN, `$1"${REDACTED_SECRET}"`)
    .replace(SINGLE_QUOTED_SECRET_PATTERN, `$1'${REDACTED_SECRET}'`)
    .replace(UNQUOTED_SECRET_PATTERN, `$1${REDACTED_SECRET}`)
    .replace(API_KEY_PATTERN, "[REDACTED_API_KEY]")
    .replace(BEARER_PATTERN, `Bearer ${REDACTED_SECRET}`)
    .replace(LOCAL_SECRET_PATTERN, REDACTED_SECRET);
}

function requestSecretValues(value: unknown, values: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => requestSecretValues(item, values));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value)) {
    if (SECRET_FIELD_PATTERN.test(key) && typeof item === "string") {
      const secret = item.trim();
      if (secret.length >= 8) values.push(secret);
      continue;
    }
    requestSecretValues(item, values);
  }
}

export function findApiKeyLeaks(value: unknown): { index: number | undefined; preview: string }[] {
  const text = serializedValue(value);
  return Array.from(text.matchAll(API_KEY_PATTERN), (match) => ({
    index: match.index,
    preview: "[REDACTED_API_KEY]",
  }));
}

export function findSecretLeaks(value: unknown): SecretLeak[] {
  const text = serializedValue(value);
  return SECRET_LEAK_PATTERNS.flatMap(({ kind, pattern, preview }) => (
    Array.from(text.matchAll(pattern), (match) => ({
      index: match.index,
      kind,
      preview,
    }))
  ));
}

export function containsSecretMaterial(text: unknown, requestInput: unknown = {}): boolean {
  if (typeof text !== "string" || !text) return false;
  if (findSecretLeaks(text).length > 0) return true;

  const requestSecrets: string[] = [];
  requestSecretValues(requestInput, requestSecrets);
  return requestSecrets.some((secret) => text.includes(secret));
}

export function redactApiKeys(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSecretText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactApiKeys(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_FIELD_PATTERN.test(key) ? REDACTED_SECRET : redactApiKeys(item),
      ]),
    );
  }
  return value;
}

export function assertPublicSafe(value: unknown): void {
  const leaks = findApiKeyLeaks(value);
  if (leaks.length) {
    const error = Object.assign(new Error("api_key_detected"), {
      code: "api_key_detected",
      leakCount: leaks.length,
    });
    throw error;
  }
}
