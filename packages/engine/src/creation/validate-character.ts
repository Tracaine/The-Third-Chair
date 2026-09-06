import { CharacterBuildSchema, type CharacterBuild } from "@third-chair/contracts";

export type CharacterOwnershipResult =
  | { readonly status: "AWAITING_BILL_CHARACTER" }
  | { readonly status: "AWAITING_RAVEN_CHARACTER" }
  | { readonly status: "READY"; readonly bill: CharacterBuild; readonly raven: CharacterBuild };

export function validateCharacterOwnership(input: {
  readonly bill?: CharacterBuild;
  readonly raven?: CharacterBuild;
}): CharacterOwnershipResult {
  if (input.bill === undefined) return { status: "AWAITING_BILL_CHARACTER" };
  const bill = CharacterBuildSchema.parse(input.bill);
  if (bill.controller !== "BILL") throw new Error("CHARACTER_SEAT_MISMATCH");

  if (input.raven === undefined) return { status: "AWAITING_RAVEN_CHARACTER" };
  const raven = CharacterBuildSchema.parse(input.raven);
  if (raven.controller !== "RAVEN") throw new Error("CHARACTER_SEAT_MISMATCH");
  if (bill.actorId === raven.actorId) throw new Error("DUPLICATE_CHARACTER_ACTOR_ID");

  return { status: "READY", bill, raven };
}
