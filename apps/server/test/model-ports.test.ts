import { OpenAiDirectorAdapter, OpenAiNarratorAdapter, loadAgentConfig } from "@third-chair/agents";
import type { SourcePackService } from "@third-chair/contracts";
import { describe, expect, it } from "vitest";
import { createLiveModelPorts } from "../src/runtime/model-ports.js";

describe("live model ports", () => {
  it("selects separate real Director and Narrator adapters without making an API call", () => {
    const sourcePack: SourcePackService = { searchRules: () => [], searchLore: () => [],
      searchTimeline: () => [], getEntity: () => null,
      manifest: () => ({ sourcePackManifestHash: "test-pack" }) };
    const ports = createLiveModelPorts(loadAgentConfig({}), sourcePack);
    expect(ports.director).toBeInstanceOf(OpenAiDirectorAdapter);
    expect(ports.narrator).toBeInstanceOf(OpenAiNarratorAdapter);
  });
});
