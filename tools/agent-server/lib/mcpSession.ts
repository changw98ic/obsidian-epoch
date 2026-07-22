export const MCP_SESSION_PROTOCOL_VERSION = "2025-06-18" as const;
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [MCP_SESSION_PROTOCOL_VERSION] as const;

export type McpSupportedProtocolVersion = typeof MCP_SUPPORTED_PROTOCOL_VERSIONS[number];
export type McpSessionState = "new" | "initializing" | "initialized" | "closed";
export type McpSessionTransport = "stdio" | "streamable-http";
export type McpJsonValue = null | boolean | number | string | readonly McpJsonValue[] | McpJsonObject;
export type McpJsonObject = { readonly [key: string]: McpJsonValue };
export type McpClientCapabilities = Readonly<Record<string, McpJsonObject>>;

export interface McpClientInfo {
  readonly name: string;
  readonly title?: string;
  readonly version: string;
  readonly description?: string;
  readonly websiteUrl?: string;
  readonly icons?: readonly McpClientIcon[];
}

export interface McpClientIcon {
  readonly src: string;
  readonly mimeType?: string;
  readonly sizes?: readonly string[];
  readonly theme?: "light" | "dark";
}

export interface McpInitializeParams {
  readonly requestedProtocolVersion: string;
  readonly protocolVersion: McpSupportedProtocolVersion;
  readonly capabilities: McpClientCapabilities;
  readonly clientInfo: McpClientInfo;
}

export interface McpSessionOptions {
  readonly sessionId: string;
  readonly transport: McpSessionTransport;
  readonly now?: () => Date;
}

export interface McpSessionSnapshot {
  readonly sessionId: string;
  readonly transport: McpSessionTransport;
  readonly state: McpSessionState;
  readonly protocolVersion?: McpSupportedProtocolVersion;
  readonly clientInfo?: McpClientInfo;
  readonly clientCapabilities?: McpClientCapabilities;
  readonly closedAt?: string;
}

export type McpSessionErrorCode =
  | "mcp_session_options_invalid"
  | "mcp_initialize_params_invalid"
  | "mcp_initialize_already_received"
  | "mcp_initialized_notification_unexpected"
  | "mcp_session_not_initialized"
  | "mcp_session_closed";

export class McpSessionError extends Error {
  readonly code: McpSessionErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: McpSessionErrorCode, details?: Readonly<Record<string, unknown>>) {
    super(code);
    this.name = "McpSessionError";
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalidParams(field: string): never {
  throw new McpSessionError("mcp_initialize_params_invalid", { field });
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) invalidParams(field);
  return value;
}

function cloneJsonValue(value: unknown, field: string, ancestors: Set<object>): McpJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalidParams(field);
    return value;
  }
  if (typeof value !== "object") invalidParams(field);
  if (ancestors.has(value)) invalidParams(field);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((entry, index) => cloneJsonValue(entry, `${field}[${index}]`, ancestors)));
    }
    const entries = Object.entries(value).map(([key, entry]) => [
      key,
      cloneJsonValue(entry, `${field}.${key}`, ancestors),
    ] as const);
    return Object.freeze(Object.fromEntries(entries)) as McpJsonObject;
  } finally {
    ancestors.delete(value);
  }
}

function cloneCapability(value: unknown, field: string): McpJsonObject {
  if (!isRecord(value)) invalidParams(field);
  return cloneJsonValue(value, field, new Set()) as McpJsonObject;
}

function parseCapabilities(value: unknown): McpClientCapabilities {
  if (!isRecord(value)) invalidParams("capabilities");
  const capabilities = Object.fromEntries(
    Object.entries(value).map(([name, capability]) => [
      name,
      cloneCapability(capability, `capabilities.${name}`),
    ]),
  ) as Record<string, McpJsonObject>;

  const roots = capabilities.roots;
  if (roots && "listChanged" in roots && typeof roots.listChanged !== "boolean") {
    invalidParams("capabilities.roots.listChanged");
  }
  const experimental = capabilities.experimental;
  if (experimental) {
    for (const [name, capability] of Object.entries(experimental)) {
      if (!isRecord(capability)) invalidParams(`capabilities.experimental.${name}`);
    }
  }
  return Object.freeze(capabilities);
}

const CLIENT_INFO_FIELDS = new Set([
  "name",
  "title",
  "version",
  "description",
  "websiteUrl",
  "icons",
]);
const CLIENT_ICON_FIELDS = new Set(["src", "mimeType", "sizes", "theme"]);

function parseClientIcons(value: unknown): readonly McpClientIcon[] {
  if (!Array.isArray(value)) invalidParams("clientInfo.icons");
  return Object.freeze(value.map((entry, index) => {
    const field = `clientInfo.icons[${index}]`;
    if (!isRecord(entry)) invalidParams(field);
    for (const key of Object.keys(entry)) {
      if (!CLIENT_ICON_FIELDS.has(key)) invalidParams(`${field}.${key}`);
    }
    const src = requiredString(entry.src, `${field}.src`);
    if (entry.mimeType !== undefined && typeof entry.mimeType !== "string") {
      invalidParams(`${field}.mimeType`);
    }
    if (entry.sizes !== undefined && (
      !Array.isArray(entry.sizes)
      || entry.sizes.some((size) => typeof size !== "string" || size.trim().length === 0)
    )) {
      invalidParams(`${field}.sizes`);
    }
    if (entry.theme !== undefined && entry.theme !== "light" && entry.theme !== "dark") {
      invalidParams(`${field}.theme`);
    }
    return Object.freeze({
      src,
      ...(entry.mimeType === undefined ? {} : { mimeType: entry.mimeType }),
      ...(entry.sizes === undefined ? {} : { sizes: Object.freeze([...entry.sizes]) }),
      ...(entry.theme === undefined ? {} : { theme: entry.theme }),
    }) as McpClientIcon;
  }));
}

function parseClientInfo(value: unknown): McpClientInfo {
  if (!isRecord(value)) invalidParams("clientInfo");
  for (const field of Object.keys(value)) {
    if (!CLIENT_INFO_FIELDS.has(field)) invalidParams(`clientInfo.${field}`);
  }
  const name = requiredString(value.name, "clientInfo.name");
  const version = requiredString(value.version, "clientInfo.version");
  if (value.title !== undefined && typeof value.title !== "string") invalidParams("clientInfo.title");
  if (value.description !== undefined && typeof value.description !== "string") {
    invalidParams("clientInfo.description");
  }
  const websiteUrl = value.websiteUrl === undefined
    ? undefined
    : requiredString(value.websiteUrl, "clientInfo.websiteUrl");
  const icons = value.icons === undefined ? undefined : parseClientIcons(value.icons);
  return Object.freeze({
    name,
    version,
    ...(value.title === undefined ? {} : { title: value.title }),
    ...(value.description === undefined ? {} : { description: value.description }),
    ...(websiteUrl === undefined ? {} : { websiteUrl }),
    ...(icons === undefined ? {} : { icons }),
  });
}

export function parseMcpInitializeParams(value: unknown): McpInitializeParams {
  if (!isRecord(value)) invalidParams("params");
  if (typeof value.protocolVersion !== "string" || value.protocolVersion.length === 0) {
    invalidParams("protocolVersion");
  }
  const protocolVersion = MCP_SUPPORTED_PROTOCOL_VERSIONS.some((version) => version === value.protocolVersion)
    ? value.protocolVersion as McpSupportedProtocolVersion
    : MCP_SESSION_PROTOCOL_VERSION;
  return Object.freeze({
    requestedProtocolVersion: value.protocolVersion,
    protocolVersion,
    capabilities: parseCapabilities(value.capabilities),
    clientInfo: parseClientInfo(value.clientInfo),
  });
}

export class McpSession {
  readonly sessionId: string;
  readonly transport: McpSessionTransport;
  private readonly now: () => Date;
  private currentState: McpSessionState = "new";
  private negotiated?: McpInitializeParams;
  private closedTimestamp?: string;

  constructor(options: McpSessionOptions) {
    if (typeof options.sessionId !== "string" || options.sessionId.trim().length === 0) {
      throw new McpSessionError("mcp_session_options_invalid", { field: "sessionId" });
    }
    this.sessionId = options.sessionId;
    this.transport = options.transport;
    this.now = options.now ?? (() => new Date());
  }

  get state(): McpSessionState {
    return this.currentState;
  }

  get protocolVersion(): McpSupportedProtocolVersion | undefined {
    return this.negotiated?.protocolVersion;
  }

  get clientInfo(): McpClientInfo | undefined {
    return this.negotiated?.clientInfo;
  }

  get clientCapabilities(): McpClientCapabilities | undefined {
    return this.negotiated?.capabilities;
  }

  get closedAt(): string | undefined {
    return this.closedTimestamp;
  }

  acceptInitialize(params: unknown): McpInitializeParams {
    this.assertOpen();
    if (this.currentState !== "new") {
      throw new McpSessionError("mcp_initialize_already_received");
    }
    const negotiated = parseMcpInitializeParams(params);
    this.negotiated = negotiated;
    this.currentState = "initializing";
    return negotiated;
  }

  acceptInitializedNotification(): void {
    this.assertOpen();
    if (this.currentState !== "initializing") {
      throw new McpSessionError("mcp_initialized_notification_unexpected", { state: this.currentState });
    }
    this.currentState = "initialized";
  }

  assertInitialized(): void {
    this.assertOpen();
    if (this.currentState !== "initialized") {
      throw new McpSessionError("mcp_session_not_initialized", { state: this.currentState });
    }
  }

  supportsClientCapability(name: string): boolean {
    return Object.hasOwn(this.negotiated?.capabilities ?? {}, name);
  }

  close(at: Date = this.now()): void {
    if (this.currentState === "closed") return;
    this.closedTimestamp = at.toISOString();
    this.currentState = "closed";
  }

  snapshot(): McpSessionSnapshot {
    return Object.freeze({
      sessionId: this.sessionId,
      transport: this.transport,
      state: this.currentState,
      ...(this.negotiated ? {
        protocolVersion: this.negotiated.protocolVersion,
        clientInfo: this.negotiated.clientInfo,
        clientCapabilities: this.negotiated.capabilities,
      } : {}),
      ...(this.closedTimestamp ? { closedAt: this.closedTimestamp } : {}),
    });
  }

  private assertOpen(): void {
    if (this.currentState === "closed") throw new McpSessionError("mcp_session_closed");
  }
}

export function createMcpSession(options: McpSessionOptions): McpSession {
  return new McpSession(options);
}
