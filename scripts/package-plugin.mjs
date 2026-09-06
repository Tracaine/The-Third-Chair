import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { zipSync } from "fflate";

const repositoryRoot = resolve(import.meta.dirname, "..");
const pluginRoot = resolve(repositoryRoot, "plugins/third-chair");
const archivePath = resolve(repositoryRoot, "tmp/third-chair-plugin.zip");
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function inside(root, target) {
  const rel = relative(realpathSync(root), realpathSync(target));
  return rel !== ".." && !rel.startsWith(`..${sep}`);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      if (!inside(pluginRoot, path)) throw new Error(`PLUGIN_SYMLINK_ESCAPE:${relative(pluginRoot, path)}`);
      if (lstatSync(realpathSync(path)).isDirectory()) throw new Error(`PLUGIN_DIRECTORY_SYMLINK_UNSUPPORTED:${relative(pluginRoot, path)}`);
      return [path];
    }
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function validateContents(files) {
  const forbiddenDirectory = /(^|[/\\])(project_sources|private|data)([/\\]|$)/i;
  const forbiddenExtension = /\.(pdf|sqlite|env)$/i;
  const rawPromptPath = /(^|[/\\])(?:prompts?|system-prompt|director-prompt|narrator-prompt)(?:\.[^/\\]+)?$/i;
  for (const path of files) {
    const rel = relative(pluginRoot, path);
    if (forbiddenDirectory.test(rel)) throw new Error(`PLUGIN_PRIVATE_DIRECTORY:${rel}`);
    if (forbiddenExtension.test(extname(rel))) throw new Error(`PLUGIN_PRIVATE_EXTENSION:${rel}`);
    if (rawPromptPath.test(rel)) throw new Error(`PLUGIN_RAW_PROMPT:${rel}`);
    const size = lstatSync(path).isSymbolicLink() ? lstatSync(realpathSync(path)).size : lstatSync(path).size;
    if (size > MAX_FILE_SIZE) throw new Error(`PLUGIN_FILE_TOO_LARGE:${rel}`);
    const text = readFileSync(path, "utf8");
    if (/\[TODO:|TODO_PLACEHOLDER/.test(text)) throw new Error(`PLUGIN_UNFINISHED_SCAFFOLD:${rel}`);
  }
}

function validateSkills() {
  const skillsRoot = join(pluginRoot, "skills");
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const text = readFileSync(join(skillsRoot, entry.name, "SKILL.md"), "utf8");
    const frontmatter = /^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---/s.exec(text);
    if (!frontmatter || frontmatter[1] !== entry.name || !frontmatter[2].trim()) {
      throw new Error(`PLUGIN_SKILL_INVALID:${entry.name}`);
    }
  }
}

function findValidator() {
  const candidates = [
    process.env.THIRD_CHAIR_PLUGIN_VALIDATOR,
    process.env.CODEX_HOME && join(process.env.CODEX_HOME, "skills/.system/plugin-creator/scripts/validate_plugin.py"),
    join(homedir(), ".codex/skills/.system/plugin-creator/scripts/validate_plugin.py"),
  ].filter(Boolean);
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error("PLUGIN_CREATOR_VALIDATOR_MISSING");
  return path;
}

function runOfficialValidator() {
  const validator = findValidator();
  const commands = process.platform === "win32"
    ? [["py", ["-3", validator, pluginRoot]], ["python", [validator, pluginRoot]]]
    : [["python3", [validator, pluginRoot]], ["python", [validator, pluginRoot]]];
  for (const [command, args] of commands) {
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (!result.error) {
      if (result.status !== 0) throw new Error(`PLUGIN_CREATOR_VALIDATION_FAILED:${(result.stderr || result.stdout).trim()}`);
      return;
    }
  }
  throw new Error("PYTHON_RUNTIME_MISSING");
}

export function packagePlugin() {
  const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
  if (manifest.name !== basename(pluginRoot)) throw new Error("PLUGIN_NAME_MISMATCH");
  runOfficialValidator();
  validateSkills();
  const files = walk(pluginRoot);
  validateContents(files);
  const entries = Object.fromEntries(files.map((path) => [
    `third-chair/${relative(pluginRoot, path).split(sep).join("/")}`,
    new Uint8Array(readFileSync(path)),
  ]));
  mkdirSync(resolve(repositoryRoot, "tmp"), { recursive: true });
  writeFileSync(archivePath, zipSync(entries, { level: 9 }));
  process.stdout.write(`${JSON.stringify({ status: "PASS", archive: relative(repositoryRoot, archivePath), files: files.length })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) packagePlugin();
