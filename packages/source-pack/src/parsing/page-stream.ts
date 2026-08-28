export interface TextPage { page: number; text: string }

function normalizePage(text: string): string[] {
  return text.normalize("NFKC").replace(/\u00ad/g, "").replace(/\r\n?/g, "\n")
    .split("\n").map((line) => line.replace(/[ \t]+$/g, ""));
}

export function parsePageStream(stream: string): TextPage[] {
  const raw = stream.split("\f");
  if (raw.at(-1)?.trim() === "") raw.pop();
  const pages = raw.map(normalizePage);
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const candidates = [...lines.slice(0, 4), ...lines.slice(-4)].map((line) => line.trim()).filter(Boolean);
    for (const line of new Set(candidates)) counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.6));
  const repeated = new Set([...counts].filter(([, count]) => count >= threshold).map(([line]) => line));
  return pages.map((lines, index) => ({
    page: index + 1,
    text: lines.filter((line, lineIndex) => {
      const margin = lineIndex < 4 || lineIndex >= lines.length - 4;
      return !(margin && repeated.has(line.trim()));
    }).join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  }));
}
