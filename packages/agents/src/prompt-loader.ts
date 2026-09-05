import { readFileSync } from "node:fs";

/** Resolve packaged prompts relative to this module, never the process cwd. */
export function loadDirectorPrompt(): string {
  try {
    return readFileSync(new URL("../prompts/director.md", import.meta.url), "utf8");
  } catch {
    throw new Error("DIRECTOR_PROMPT_UNAVAILABLE");
  }
}
