import type { SourcePackService, SourceResult } from "@third-chair/contracts";

const citation = {
  documentId: "test_fake_document",
  title: "Deterministic local gate fixture",
  pageStart: 1,
  pageEnd: 1,
  headingPath: ["Local gate"],
};

const rule: SourceResult = {
  kind: "RULE",
  id: "test_fake_rule_cover",
  passage: "Half cover grants a +2 bonus to Armor Class and Dexterity saving throws against effects originating beyond the cover.",
  citation: { ...citation, edition: "SRD_5_1" },
  confidenceStatus: "NATIVE_TEXT",
};

const lore: SourceResult = {
  kind: "LORE",
  id: "test_fake_lore_raven",
  passage: "This bounded lore entry exists only for deterministic local transport checks.",
  citation: { ...citation, edition: "TEST_FIXTURE" },
  confidenceStatus: "NATIVE_TEXT",
};

export function createFakeSourcePack(): SourcePackService {
  return {
    searchRules: ({ limit }) => (limit === 0 ? [] : [rule]),
    searchLore: ({ entityIds, limit }) => (!entityIds?.length || limit === 0 ? [] : [lore]),
    searchTimeline: () => [],
    getEntity: () => null,
    manifest: () => ({ sourcePackManifestHash: "test_fake_source_pack" }),
  };
}
