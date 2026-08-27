import { execFileSync } from "node:child_process";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const forbidden = tracked.filter((path) =>
  /^(project_sources|private|data|tmp)\//.test(path) ||
  /(?:\.pdf|\.sqlite(?:-shm|-wal)?|\.ocr\.pdf|\.sidecar\.txt)$/i.test(path),
);
if (forbidden.length > 0) {
  process.stderr.write(`Forbidden tracked files:\n${forbidden.join("\n")}\n`);
  process.exit(1);
}
