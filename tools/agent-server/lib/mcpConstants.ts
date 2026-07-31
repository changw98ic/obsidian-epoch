// mcpConstants.ts — canonical MCP protocol constants shared across modules.
//
// Single source of truth for protocol version, server info, and supported
// protocol versions.  Every module that needs these values should import
// from here rather than defining its own copy.

export const MCP_PROTOCOL_VERSION = "2025-06-18" as const;

export const MCP_SERVER_INFO = {
  name: "obsidian-epoch-agent-world",
  version: "0.1.2",
} as const;

export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [MCP_PROTOCOL_VERSION] as const;

export type McpSupportedProtocolVersion = typeof MCP_SUPPORTED_PROTOCOL_VERSIONS[number];
