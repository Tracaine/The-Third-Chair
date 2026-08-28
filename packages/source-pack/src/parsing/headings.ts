export const reviewedHeadingAliases: Record<string, string> = {
  "ADVANTAGE AND DISADVANTAGE": "Advantage and Disadvantage",
  "CONCENTRATION": "Concentration",
  "LONG REST": "Long Rest",
  "DEATH SAVING THROWS": "Death Saving Throws",
  "COVER": "Cover",
};

export function recognizeHeading(line: string): string | undefined {
  const value = line.trim().replace(/\s+/g, " ");
  if (reviewedHeadingAliases[value]) return reviewedHeadingAliases[value];
  if (value.length < 3 || value.length > 100 || /[.!?;:]$/.test(value)) return undefined;
  if (/^(CHAPTER\s+\d+|PART\s+\d+)\b/i.test(value)) return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const letters = value.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && value === value.toUpperCase()) {
    return value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  }
  return undefined;
}

export function slugHeading(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
