import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DiceTray } from "./DiceTray";
import { explorationFixture } from "../fixtures/table-view";

it("shows the roll before the consequence and preserves declared stakes", () => {
  render(<DiceTray checks={explorationFixture.visibleChecks} actorNames={explorationFixture.actorNames} />);

  const text = screen.getByRole("listitem").textContent ?? "";
  expect(text.indexOf("14 + 5 = 19")).toBeLessThan(text.indexOf("Success"));
  expect(text).toContain("On success: Read the coded margin note.");
  expect(text).toContain("On failure: Alert whoever is on the stairs.");
  expect(text).toContain("Target 15");
  expect(text).toContain("Raven");
});
