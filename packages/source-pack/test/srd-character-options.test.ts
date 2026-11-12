import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { QuickstartArchetypeSchema } from "@third-chair/contracts";
import { buildLevelOneCharacter, characterCatalogFromSourceOptions, quickstartCharacterDraft } from "@third-chair/engine";
import { openSourcePackForBuild, openSourcePackReadOnly } from "../src/indexing/database.js";
import { SourcePackWriter } from "../src/indexing/writer.js";
import { hashManifest, loadSourceConfig } from "../src/manifest.js";
import { createSqliteSourcePackService } from "../src/retrieval/service.js";
import { upgradeCharacterOptions } from "../src/upgrade-character-options.js";

const configPath = "packages/source-pack/config/documents.v1.json";

describe("verified SRD character catalog", () => {
  it.runIf(existsSync(resolve("project_sources/01-SRD-OGL_V5.1.pdf")))(
    "enriches an existing pack without changing its identity and builds every Quickstart sheet", async () => {
      const directory = await mkdtemp(join(tmpdir(), "third-chair-character-catalog-"));
      try {
        const database = join(directory, "source-pack.sqlite");
        const config = await loadSourceConfig(configPath);
        const manifest = { schemaVersion: 1, documents: config.documents, selectionHash: "fixture", aliasHash: "fixture" };
        const sourcePackManifestHash = hashManifest(manifest);
        const db = openSourcePackForBuild(database);
        const writer = new SourcePackWriter(db);
        writer.insertManifest({ ...manifest, sourcePackManifestHash });
        for (const document of config.documents) writer.insertDocument({ ...document, extractionMethod: document.method });
        db.close();

        const upgraded = await upgradeCharacterOptions(process.cwd(), configPath, database);
        expect(upgraded).toMatchObject({ status: "PASS", sourcePackManifestHash });
        expect(await upgradeCharacterOptions(process.cwd(), configPath, database)).toMatchObject({ status: "ALREADY_CURRENT" });
        const backup = openSourcePackReadOnly(`${database}.previous`);
        expect(createSqliteSourcePackService(backup).characterOptions()).toHaveLength(0);
        backup.close();

        const upgradedDb = openSourcePackReadOnly(database);
        try {
          const options = createSqliteSourcePackService(upgradedDb).characterOptions();
          const catalog = characterCatalogFromSourceOptions(options);
          expect(Object.keys(catalog.classes)).toHaveLength(12);
          expect(Object.keys(catalog.ancestries)).toHaveLength(9);
          expect(Object.values(catalog.spells).some(({ displayName }) => displayName.includes("Not for resale"))).toBe(false);
          const [fighter, rogue, wizard, cleric] = QuickstartArchetypeSchema.options.map((archetype) => {
            const draft = quickstartCharacterDraft({ archetype, name: archetype, pronouns: "", characterHook: "" }, "BILL", true);
            return buildLevelOneCharacter(draft, "BILL", catalog);
          });
          expect(fighter).toMatchObject({ armorClass: 19, maxHp: 12, abilities: { strength: 16, constitution: 15 } });
          expect(rogue).toMatchObject({ armorClass: 14, skills: { stealth: 7, investigation: 6 } });
          expect(wizard).toMatchObject({ mechanics: { spellcasting: { saveDc: 13, attackBonus: 5 } },
            spellSlots: { "1": { current: 2, maximum: 2 } } });
          expect(wizard?.mechanics?.spellcasting?.spellbook).toHaveLength(6);
          expect(cleric).toMatchObject({ maxHp: 12, armorClass: 18 });
          expect(cleric?.spells).toContain(catalog.spells["cure-wounds"]!.id);
          expect(options.every(({ ruleSectionId }) => upgradedDb.prepare("SELECT 1 FROM rule_sections WHERE id=?").get(ruleSectionId))).toBe(true);
        } finally { upgradedDb.close(); }
      } finally { await rm(directory, { recursive: true, force: true }); }
    },
  );
});
