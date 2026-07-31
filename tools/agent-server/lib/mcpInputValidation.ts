/**
 * MCP tool input validation.
 *
 * Validates tool arguments against declared inputSchema before dispatch.
 * Rejects unknown properties (additionalProperties: false) and missing
 * required fields.
 */

type JsonRecord = Record<string, unknown>;

export interface ValidationError {
  readonly path: string;
  readonly rule: string;
  readonly message: string;
}

export class McpInputValidationError extends Error {
  readonly code = -32602;
  readonly errors: readonly ValidationError[];

  constructor(errors: readonly ValidationError[]) {
    super(`Invalid params: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`);
    this.name = "McpInputValidationError";
    this.errors = errors;
  }
}

/**
 * Validate tool arguments against the tool's inputSchema.
 * Only rejects unknown properties (additionalProperties: false).
 * Does NOT check required fields — handlers handle missing fields with their own error messages.
 * Throws McpInputValidationError if unknown fields are found.
 */
export function validateToolInput(
  toolName: string,
  args: JsonRecord,
  schema: JsonRecord | undefined,
): void {
  if (!schema) return;
  const errors: ValidationError[] = [];
  rejectUnknownFields("", args, schema, errors);
  if (errors.length > 0) {
    throw new McpInputValidationError(errors);
  }
}

function rejectUnknownFields(
  path: string,
  value: unknown,
  schema: JsonRecord,
  errors: ValidationError[],
): void {
  if (!isRecord(value)) return; // type checking is done by handlers

  const properties = schema.properties as JsonRecord | undefined;
  const additionalProperties = schema.additionalProperties;

  // Only reject unknown properties when additionalProperties is explicitly false
  if (additionalProperties === false && properties) {
    const knownKeys = new Set(Object.keys(properties));
    for (const key of Object.keys(value)) {
      if (!knownKeys.has(key)) {
        errors.push({ path: path ? `${path}.${key}` : key, rule: "additionalProperties", message: "unknown field" });
      }
    }
  }

  // Recursively check nested objects
  if (properties) {
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in value && isRecord(propSchema)) {
        rejectUnknownFields(path ? `${path}.${key}` : key, value[key], propSchema, errors);
      }
    }
  }
}

function validateField(
  path: string,
  value: unknown,
  schema: JsonRecord,
  errors: ValidationError[],
): void {
  if (!schema || typeof schema !== "object") return;

  const type = schema.type as string | undefined;
  if (!type) return;

  // Check enum
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push({ path, rule: "enum", message: `must be one of: ${schema.enum.join(", ")}` });
      return;
    }
  }

  switch (type) {
    case "string":
      if (typeof value !== "string") {
        errors.push({ path, rule: "type", message: "expected string" });
        return;
      }
      if (typeof schema.minLength === "number" && value.length < schema.minLength) {
        errors.push({ path, rule: "minLength", message: `minimum length is ${schema.minLength}` });
      }
      if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
        errors.push({ path, rule: "maxLength", message: `maximum length is ${schema.maxLength}` });
      }
      break;

    case "number":
    case "integer":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push({ path, rule: "type", message: `expected ${type}` });
        return;
      }
      if (type === "integer" && !Number.isSafeInteger(value)) {
        errors.push({ path, rule: "type", message: "expected safe integer" });
        return;
      }
      if (typeof schema.minimum === "number" && value < schema.minimum) {
        errors.push({ path, rule: "minimum", message: `minimum value is ${schema.minimum}` });
      }
      if (typeof schema.maximum === "number" && value > schema.maximum) {
        errors.push({ path, rule: "maximum", message: `maximum value is ${schema.maximum}` });
      }
      break;

    case "boolean":
      if (typeof value !== "boolean") {
        errors.push({ path, rule: "type", message: "expected boolean" });
      }
      break;

    case "array":
      if (!Array.isArray(value)) {
        errors.push({ path, rule: "type", message: "expected array" });
        return;
      }
      if (typeof schema.minItems === "number" && value.length < schema.minItems) {
        errors.push({ path, rule: "minItems", message: `minimum items is ${schema.minItems}` });
      }
      if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
        errors.push({ path, rule: "maxItems", message: `maximum items is ${schema.maxItems}` });
      }
      // Validate items
      if (schema.items && typeof schema.items === "object") {
        for (let i = 0; i < value.length; i++) {
          validateField(`${path}[${i}]`, value[i], schema.items as JsonRecord, errors);
        }
      }
      break;

    case "object":
      if (isRecord(value)) {
        rejectUnknownFields(path, value, schema, errors);
      } else {
        errors.push({ path, rule: "type", message: "expected object" });
      }
      break;

    case "null":
      if (value !== null) {
        errors.push({ path, rule: "type", message: "expected null" });
      }
      break;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
