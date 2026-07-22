type JsonRecord = Record<string, unknown>;

type NamedMcpTool = {
  readonly name: string;
};

type McpToolAllowlistRuntime = {
  readonly listTools: () => readonly NamedMcpTool[];
  readonly callTool: (name: string, args?: JsonRecord) => Promise<unknown>;
};

const RUNTIME_TOOL_NAME = /^obsidian_epoch\.[a-z][a-z0-9_]*$/;

function invalidAllowlist(reason: string): never {
  throw new Error(`phase6_mcp_tool_allowlist_${reason}`);
}

function parseAllowlist(serialized: string, availableNames: ReadonlySet<string>) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return invalidAllowlist("invalid_json");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return invalidAllowlist("non_empty_array_required");

  const names: string[] = [];
  const seen = new Set<string>();
  for (const value of parsed) {
    if (typeof value !== "string" || !RUNTIME_TOOL_NAME.test(value)) return invalidAllowlist("invalid_tool_name");
    if (seen.has(value)) return invalidAllowlist("duplicate_tool");
    if (!availableNames.has(value)) return invalidAllowlist("unknown_tool");
    seen.add(value);
    names.push(value);
  }
  return names;
}

export function applyMcpToolAllowlist<T extends McpToolAllowlistRuntime>(
  baseRuntime: T,
  serializedAllowlist: string | undefined,
): T {
  if (serializedAllowlist === undefined) return baseRuntime;

  const tools = baseRuntime.listTools();
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool] as const));
  const allowedNames = parseAllowlist(serializedAllowlist, new Set(toolsByName.keys()));
  const allowedNameSet = new Set(allowedNames);
  const allowedTools = allowedNames.map((name) => toolsByName.get(name)!);

  return {
    ...baseRuntime,
    listTools: () => allowedTools,
    callTool: async (name: string, args: JsonRecord = {}) => {
      if (!allowedNameSet.has(name)) throw new Error(`unknown_tool:${name}`);
      return baseRuntime.callTool(name, args);
    },
  } as T;
}
