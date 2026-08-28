import type { EntityRecord, SourceChunk } from "./types.js";

export interface AliasConfig {
  version: number;
  entities: Array<{ id: string; canonicalName: string; entityType: string; region?: string; aliases: string[] }>;
}

const fold = (text: string) => text.normalize("NFKC").toLocaleLowerCase("en-US");
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function expandAliases(nameOrAlias: string, config: AliasConfig): string[] {
  const needle = fold(nameOrAlias.trim());
  const entity = config.entities.find((item) => [item.canonicalName, ...item.aliases].some((name) => fold(name) === needle));
  return entity ? [entity.canonicalName, ...entity.aliases] : [];
}

export function indexEntities(chunks: readonly SourceChunk[], config: AliasConfig): {
  entities: EntityRecord[];
  mentions: Array<{ entityId: string; chunkId: string; startOffset: number; endOffset: number }>;
} {
  const phrases = config.entities.flatMap((entity) => [entity.canonicalName, ...entity.aliases].map((phrase) => ({ entity, phrase })))
    .sort((a, b) => b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase));
  const mentions: Array<{ entityId: string; chunkId: string; startOffset: number; endOffset: number }> = [];
  const found = new Set<string>();
  for (const chunk of chunks) {
    const occupied: Array<[number, number]> = [];
    for (const { entity, phrase } of phrases) {
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase)}(?![\\p{L}\\p{N}])`, "giu");
      for (const match of chunk.text.matchAll(pattern)) {
        const start = match.index; const end = start + match[0].length;
        if (occupied.some(([left, right]) => start < right && end > left)) continue;
        occupied.push([start, end]); found.add(entity.id);
        mentions.push({ entityId: entity.id, chunkId: chunk.id, startOffset: start, endOffset: end });
      }
    }
  }
  const entities = config.entities.filter((entity) => found.has(entity.id)).map((entity): EntityRecord => ({
    id: entity.id, canonicalName: entity.canonicalName, entityType: entity.entityType, aliases: entity.aliases,
    ...(entity.region ? { region: entity.region } : {}),
  })).sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
  return { entities, mentions };
}
