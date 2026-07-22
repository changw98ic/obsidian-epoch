export function stableResultPageJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => entry === undefined
      || typeof entry === "function"
      || typeof entry === "symbol"
      ? "null"
      : stableResultPageJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined && typeof entry !== "function" && typeof entry !== "symbol")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableResultPageJson(entry)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "null" : serialized;
}
