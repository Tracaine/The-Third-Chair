import { runProcess, type ProcessResult } from "../process.js";
import { parsePageStream, type TextPage } from "../parsing/page-stream.js";

export async function extractNativeTextPages(
  document: { absolutePath: string; pageCount: number },
  dependencies: { run(command: string, args: readonly string[]): Promise<ProcessResult> } = { run: runProcess },
): Promise<TextPage[]> {
  const result = await dependencies.run("pdftotext", [
    "-layout", "-enc", "UTF-8", "-f", "1", "-l", String(document.pageCount), document.absolutePath, "-",
  ]);
  return parsePageStream(result.stdout);
}
