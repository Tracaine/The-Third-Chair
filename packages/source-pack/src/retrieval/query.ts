import { expandAliases, type AliasConfig } from "../indexing/entities.js";

export function safeFtsQuery(query: string, aliases?: AliasConfig): string {
  const raw = query.match(/[\p{L}\p{N}][\p{L}\p{N}'-]{0,63}/gu) ?? [];
  const expanded = aliases ? raw.flatMap((token) => expandAliases(token, aliases)) : [];
  const tokens = [...new Set([...raw, ...expanded].map((token) => token.slice(0, 64)))].slice(0, 12);
  if (tokens.length === 0) return '"__no_match__"';
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(" OR ");
}

export function delimitSourceData(text: string): string { return `<source-data>\n${text}\n</source-data>`; }
