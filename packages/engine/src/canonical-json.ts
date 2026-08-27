/** Stable JSON for hashes and persistence comparisons. */
export function canonicalJson(value: unknown): string {
  const visit = (item: unknown): string => {
    if (item === null) return "null";
    if (typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new TypeError("Non-finite number is not canonical JSON");
      return JSON.stringify(item);
    }
    if (Array.isArray(item)) return `[${item.map(visit).join(",")}]`;
    if (typeof item === "object") {
      const record = item as Record<string, unknown>;
      return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${visit(record[key])}`).join(",")}}`;
    }
    throw new TypeError("Value is not JSON");
  };
  return visit(value);
}
