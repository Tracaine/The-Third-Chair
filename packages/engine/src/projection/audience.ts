import type { Audience, PlayerSeat } from "@third-chair/contracts";

export function allowedAudiences(viewer: PlayerSeat): ReadonlySet<Audience> {
  return new Set(["PUBLIC", "PARTY", viewer]);
}

export function visible<T extends { audience: Audience }>(records: readonly T[], viewer: PlayerSeat): T[] {
  const allowed = allowedAudiences(viewer);
  return records.filter((record) => allowed.has(record.audience));
}
