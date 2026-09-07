import { PlayerJournalSchema, type PlayerJournal } from "@third-chair/contracts";

function bullets(values: readonly string[]): string {
  return values.length === 0 ? "- None" : values.map((value) => `- ${value}`).join("\n");
}

export function renderPlayerJournalMarkdown(raw: PlayerJournal): string {
  const journal = PlayerJournalSchema.parse(raw);
  const title = journal.audience === "PARTY" ? "Party" : journal.audience === "BILL" ? "Bill" : "Raven";
  const sections = [
    `# Player Journal — ${title}`,
    `**Date:** ${journal.worldDate.month} ${journal.worldDate.day}, ${journal.worldDate.yearDr} DR  \n**Location:** ${journal.location.name}`,
    `## Current Objective\n${journal.currentObjective?.name ?? "No active objective"}`,
    `## Immediate Risk\n${journal.immediateRisk ?? "None known"}`,
    `## Known Clues\n${bullets(journal.knownClues.map(({ text }) => text))}`,
    `## Open Threads\n${bullets(journal.openThreads.map(({ name, status }) => `${name} (${status})`))}`,
    `## Recent Turns\n${bullets(journal.recentTurns.map(({ narrationExcerpt }) => narrationExcerpt))}`,
  ];
  return `${sections.join("\n\n")}\n`;
}
