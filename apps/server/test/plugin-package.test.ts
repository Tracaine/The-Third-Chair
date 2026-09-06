import { lstatSync, readFileSync, realpathSync, readdirSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../../..");
const pluginRoot = join(root, "plugins", "third-chair");
const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");

interface PluginManifest {
  name: string;
  version: string;
  skills?: string;
  mcpServers?: string;
  apps?: string;
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      const rel = relative(realpathSync(pluginRoot), realpathSync(path));
      expect(rel === ".." || rel.startsWith(`..${sep}`)).toBe(false);
      return [path];
    }
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe("private Third Chair plugin package", () => {
  it("has a valid manifest whose references stay inside the plugin", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PluginManifest;
    expect(manifest.name).toBe(basename(pluginRoot));
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (const reference of [manifest.skills, manifest.mcpServers, manifest.apps].filter((value): value is string => Boolean(value))) {
      const target = realpathSync(resolve(pluginRoot, reference));
      expect(relative(realpathSync(pluginRoot), target).startsWith("..")).toBe(false);
    }
  });

  it("contains four structurally valid skills and no unfinished scaffold text", () => {
    const skillRoot = join(pluginRoot, "skills");
    const names = readdirSync(skillRoot).sort();
    expect(names).toEqual(["third-chair-campaign", "third-chair-play", "third-chair-rules", "third-chair-source-pack"]);
    for (const name of names) {
      const text = readFileSync(join(skillRoot, name, "SKILL.md"), "utf8");
      expect(text).toMatch(new RegExp(`^---\\nname: ${name}\\ndescription: .+\\n---`, "s"));
      expect(text).not.toMatch(/\[TODO:|TODO_PLACEHOLDER/);
    }
  });

  it("excludes private sources, dangerous extensions, and fake app registrations", () => {
    const forbiddenDirectory = /(^|[/\\])(project_sources|private|data)([/\\]|$)/;
    const forbiddenExtension = /\.(pdf|sqlite|env)$/i;
    for (const path of walk(pluginRoot)) {
      const rel = relative(pluginRoot, path);
      expect(rel).not.toMatch(forbiddenDirectory);
      expect(extname(rel)).not.toMatch(forbiddenExtension);
      expect(lstatSync(path).size).toBeLessThanOrEqual(10 * 1024 * 1024);
      if (!lstatSync(path).isSymbolicLink()) expect(readFileSync(path, "utf8")).not.toMatch(/\[TODO:|TODO_PLACEHOLDER/);
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PluginManifest;
    const appPath = join(pluginRoot, ".app.json");
    expect(() => lstatSync(appPath)).toThrow();
    expect(manifest.apps).toBeUndefined();
  });

  it("passes the package validator and writes an ignored distributable", () => {
    const result = spawnSync(process.execPath, [join(root, "scripts", "package-plugin.mjs")], { cwd: root, encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: "PASS", archive: "tmp/third-chair-plugin.zip" });
    expect(lstatSync(join(root, "tmp", "third-chair-plugin.zip")).size).toBeGreaterThan(0);
  });
});
