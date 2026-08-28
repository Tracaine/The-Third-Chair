export interface RealmsDate { yearStartDr: number; yearEndDr: number; precision: "EXACT" | "CIRCA" | "RANGE" }

export function parseRealmsDate(text: string): RealmsDate | undefined {
  const value = text.trim();
  const range = /^(?:c\.\s*)?(-?\d{1,5})\s*[–—-]\s*(-?\d{1,5})\s*DR\b/i.exec(value);
  if (range) return { yearStartDr: Number(range[1]), yearEndDr: Number(range[2]), precision: "RANGE" };
  const exact = /^(c\.\s*)?(-?\d{1,5})\s*DR\b/i.exec(value);
  if (!exact) return undefined;
  const year = Number(exact[2]);
  return { yearStartDr: year, yearEndDr: year, precision: exact[1] ? "CIRCA" : "EXACT" };
}
