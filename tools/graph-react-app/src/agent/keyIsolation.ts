export const KEY_MATERIAL_REDACTION = "[key-material-redacted]";

const SENSITIVE_FIELD_NAMES = new Set([
  "apiKey",
  "api_key",
  "authorization",
  "localSecret",
  "newRecoveryCode",
  "operatorKey",
  "recoveryCode",
  "secret",
  "token",
]);

const KEY_VALUE_PATTERN = /\b(recoveryCode|newRecoveryCode|localSecret|operatorKey|apiKey|api_key|authorization|token|secret)(\s*[:=]\s*)([^\s,;]+)/gi;
const OPENAI_KEY_PATTERN = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g;
const LOCAL_SECRET_PATTERN = /\blocal_[A-Za-z0-9_-]{12,}\b/g;
const LONG_BASE64_TOKEN_PATTERN = /\b[A-Za-z0-9+/]{32,}={0,2}\b/g;
const USER_TEXT_FIELD_NAMES = new Set([
  "additionalInstruction",
  "body",
  "description",
  "message",
  "note",
  "outcomeSummary",
  "prompt",
  "publicNote",
  "report",
  "storyEvidence",
  "summary",
  "title",
  "visibleText",
]);

export interface KeyMaterialDetection {
  readonly fieldPath: string;
  readonly reason: "key_material_in_user_text";
}

function decodeBase64Json(value: string): unknown {
  if (typeof globalThis.atob !== "function") return undefined;
  try {
    return JSON.parse(globalThis.atob(value));
  } catch {
    return undefined;
  }
}

function isRecoveryCode(value: string): boolean {
  const decoded = decodeBase64Json(value);
  if (!decoded || typeof decoded !== "object") return false;
  const record = decoded as Record<string, unknown>;
  return typeof record.explorerId === "string" && typeof record.localSecret === "string";
}

function isSensitiveFieldName(key: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(key);
}

export function sanitizeKeyMaterialInText(value: string): string {
  const trimmed = value.trim();
  if (isRecoveryCode(trimmed)) return KEY_MATERIAL_REDACTION;
  return value
    .replace(KEY_VALUE_PATTERN, (_match, field: string, separator: string) => `${field}${separator}${KEY_MATERIAL_REDACTION}`)
    .replace(OPENAI_KEY_PATTERN, KEY_MATERIAL_REDACTION)
    .replace(LOCAL_SECRET_PATTERN, KEY_MATERIAL_REDACTION)
    .replace(LONG_BASE64_TOKEN_PATTERN, (token) => isRecoveryCode(token) ? KEY_MATERIAL_REDACTION : token);
}

function userTextContainsKeyMaterial(value: string): boolean {
  return sanitizeKeyMaterialInText(value) !== value;
}

function shouldScanUserTextPath(path: readonly string[]): boolean {
  if (path.length === 0) return true;
  const fieldName = path[path.length - 1] || "";
  return USER_TEXT_FIELD_NAMES.has(fieldName) && !isSensitiveFieldName(fieldName);
}

function fieldPath(path: readonly string[]): string {
  return path.join(".");
}

export function findKeyMaterialInUserTextPayload(value: unknown, path: readonly string[] = []): readonly KeyMaterialDetection[] {
  if (typeof value === "string") {
    return shouldScanUserTextPath(path) && userTextContainsKeyMaterial(value)
      ? [{ fieldPath: fieldPath(path), reason: "key_material_in_user_text" }]
      : [];
  }
  if (value === null || typeof value !== "object") return [];
  if (value instanceof Error) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findKeyMaterialInUserTextPayload(entry, [...path, String(index)]));
  }

  const record = value as Record<string, unknown>;
  return Object.entries(record).flatMap(([key, entry]) =>
    findKeyMaterialInUserTextPayload(entry, [...path, key]));
}

export function assertNoKeyMaterialInUserTextPayload(value: unknown) {
  const detections = findKeyMaterialInUserTextPayload(value);
  if (detections.length > 0) throw new Error("api_key_detected");
}

export function sanitizeKeyMaterialForErrorPayload(value: unknown): unknown {
  if (typeof value === "string") return sanitizeKeyMaterialInText(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeKeyMaterialInText(value.message),
      ...(value.stack ? { stack: sanitizeKeyMaterialInText(value.stack) } : {}),
    };
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeKeyMaterialForErrorPayload(entry));

  const record = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    sanitized[key] = isSensitiveFieldName(key)
      ? KEY_MATERIAL_REDACTION
      : sanitizeKeyMaterialForErrorPayload(entry);
  }
  return sanitized;
}

export function sanitizeKeyMaterialErrorMessage(error: unknown): string {
  if (error instanceof Error) return sanitizeKeyMaterialInText(error.message);
  return sanitizeKeyMaterialInText(String(error));
}
