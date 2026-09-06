import { describe, expect, it } from "vitest";
import {
  advanceGameDescriptor,
  answerRulesDescriptor,
  getTableViewDescriptor,
  listCampaignsDescriptor,
  recallKnownLoreDescriptor,
} from "@third-chair/server";

describe("CHAIR-004 tool annotations", () => {
  const descriptors = [
    listCampaignsDescriptor,
    getTableViewDescriptor,
    advanceGameDescriptor,
    answerRulesDescriptor,
    recallKnownLoreDescriptor,
  ];

  it("advertises the exact player-safe annotation matrix", () => {
    expect(Object.fromEntries(descriptors.map((descriptor) => [descriptor.name, descriptor.annotations]))).toEqual({
      list_campaigns: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      get_table_view: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      advance_game: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      answer_rules: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      recall_known_lore: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    });
  });

  it("uses stable IDs and complete schemas", () => {
    expect(descriptors.map((descriptor) => descriptor.name)).toEqual([
      "list_campaigns", "get_table_view", "advance_game", "answer_rules", "recall_known_lore",
    ]);
    for (const descriptor of descriptors) {
      expect(descriptor.description).toMatch(/^Use this when/);
      expect(descriptor.inputSchema).toBeDefined();
      expect(descriptor.outputSchema).toBeDefined();
    }
  });
});
