import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DecisionBanner } from "./DecisionBanner";
import { explorationFixture } from "../fixtures/table-view";

it("labels Bill-owned decisions without offering Raven action controls", () => {
  render(<DecisionBanner decision={explorationFixture.playerView.currentDecision} actorNames={explorationFixture.actorNames} />);

  expect(screen.getByText("Bill decides")).toBeInTheDocument();
  expect(screen.getByText("What do you do before the footsteps reach the cellar?")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByText(/Raven decides/i)).not.toBeInTheDocument();
});
