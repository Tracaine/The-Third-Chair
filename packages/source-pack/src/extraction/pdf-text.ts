import { runProcess, type ProcessResult } from "../process.js";
import { parsePageStream, type TextPage } from "../parsing/page-stream.js";

export async function extractNativeText(
  document: { absolutePath: string; pageCount: number },
  dependencies: { run(command: string, args: readonly string[]): Promise<ProcessResult> } = { run: runProcess },
): Promise<string> {
  const result = await dependencies.run("pdftotext", [
    "-layout", "-enc", "UTF-8", "-f", "1", "-l", String(document.pageCount), document.absolutePath, "-",
  ]);
  return result.stdout;
}

export async function extractNativeTextPages(
  document: Parameters<typeof extractNativeText>[0], dependencies?: Parameters<typeof extractNativeText>[1],
): Promise<TextPage[]> {
  return parsePageStream(await extractNativeText(document, dependencies));
}
