import {
  containsSecretMaterial,
  redactApiKeys,
  SECRET_FIELD_NAMES,
} from "../safety.ts";

type AnyRecord = Record<string, unknown>;

export const PUBLIC_TEXT_SECRET_INPUT_KEYS = SECRET_FIELD_NAMES;

const AUDIT_REDACTED_KEYS = /api.?key|secret|token|signature|visibleText|transcript|private/i;

export function assertNoRequestSecretMaterialInPublicText(input: AnyRecord, text: unknown) {
  if (containsSecretMaterial(text, input)) throw new Error("secret_material_detected");
}

export function summarizeRejectedInput(input: AnyRecord = {}): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (AUDIT_REDACTED_KEYS.test(key)) return [key, "[redacted]"];
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      return [key, typeof value === "string" ? String(redactApiKeys(value)).slice(0, 160) : value];
    }
    if (Array.isArray(value)) return [key, `[array:${value.length}]`];
    if (value && typeof value === "object") return [key, "[object]"];
    return [key, String(value)];
  }));
}
