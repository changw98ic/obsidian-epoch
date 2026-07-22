import { createHash } from "node:crypto";

export type CausalCanonicalJsonPrimitive = string | number | boolean | null;
export type CausalCanonicalJsonValue =
  | CausalCanonicalJsonPrimitive
  | readonly CausalCanonicalJsonValue[]
  | { readonly [key: string]: CausalCanonicalJsonValue };

export class CausalCanonicalJsonError extends Error {
  readonly code: string;

  constructor(code: string, path: string) {
    super(`${code}:${path}`);
    this.name = "CausalCanonicalJsonError";
    this.code = code;
  }
}

function fail(code: string, path: string): never {
  throw new CausalCanonicalJsonError(code, path);
}

function canonicalize(value: unknown, path: string, seen: WeakSet<object>): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) fail("causal_canonical_json_non_finite_number", path);
      return JSON.stringify(value);
    case "undefined":
      fail("causal_canonical_json_undefined", path);
    case "function":
      fail("causal_canonical_json_function", path);
    case "symbol":
      fail("causal_canonical_json_symbol", path);
    case "bigint":
      fail("causal_canonical_json_bigint", path);
    case "object":
      break;
    default:
      fail("causal_canonical_json_unsupported", path);
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) fail("causal_canonical_json_cycle", path);
  seen.add(objectValue);

  if (Array.isArray(value)) {
    const items = value.map((item, index) => canonicalize(item, `${path}[${index}]`, seen));
    seen.delete(objectValue);
    return `[${items.join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const properties = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key], `${path}.${key}`, seen)}`);

  seen.delete(objectValue);
  return `{${properties.join(",")}}`;
}

export function causalCanonicalJson(value: unknown): string {
  return canonicalize(value, "$", new WeakSet<object>());
}

export function causalCanonicalJsonBytes(value: unknown): Uint8Array {
  return Buffer.from(causalCanonicalJson(value), "utf8");
}

export function causalSha256Utf8(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function causalCanonicalJsonHash(value: unknown): `sha256:${string}` {
  return causalSha256Utf8(causalCanonicalJson(value));
}

export const canonicalJson = causalCanonicalJson;
export const canonicalJsonHash = causalCanonicalJsonHash;
