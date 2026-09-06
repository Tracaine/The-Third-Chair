import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { combatFixture, explorationFixture } from "./fixtures/table-view";

describe("Raven's Table", () => {
  it("renders the required exploration panels from player-visible data", () => {
    render(<App view={explorationFixture} />);

    expect(screen.getByRole("heading", { name: "The Lantern Cellar" })).toBeInTheDocument();
    expect(screen.getByText("14 Mirtul, 1375 DR")).toBeInTheDocument();
    expect(screen.getByText("Find who marked the smuggler's ledger.")).toBeInTheDocument();
    expect(screen.getByText("Footsteps are descending the stairs.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bill" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Raven" })).toBeInTheDocument();
    expect(screen.getByText("The violet wax matches House Veyra.")).toBeInTheDocument();
    expect(screen.getByText("Who is paying the dock watch?")).toBeInTheDocument();
    expect(screen.getByText("State 12")).toBeInTheDocument();
    expect(screen.getByText("Recovered and current")).toBeInTheDocument();
  });

  it("renders combat initiative and only visible battlefield facts", () => {
    render(<App view={combatFixture} />);

    const combat = screen.getByRole("region", { name: "Combat" });
    expect(within(combat).getByText("Round 3")).toBeInTheDocument();
    expect(within(combat).getByText("Raven is acting")).toBeInTheDocument();
    expect(within(combat).getAllByText("Dockside Cutthroat")).toHaveLength(2);
    expect(within(combat).getByText("Overturned fish cart")).toBeInTheDocument();
    expect(within(combat).getByText("Burning lamp oil")).toBeInTheDocument();
    expect(within(combat).getByText("Cargo crane release")).toBeInTheDocument();
  });

  it("does not render hidden or unknown fields", () => {
    render(<App view={combatFixture} />);

    expect(screen.queryByText("The patron is Lady Sablethorn.")).not.toBeInTheDocument();
    expect(screen.queryByText("Invisible assassin")).not.toBeInTheDocument();
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
  });

  it("renders narration recovery as a player-readable status", () => {
    render(<App view={{
      ...explorationFixture,
      playerView: {
        ...explorationFixture.playerView,
        recoveryStatus: { kind: "NARRATION_RECOVERY", turnId: "test_turn_recovery", decisionId: "test_decision_recovery" },
      },
    }} />);
    expect(screen.getByText("Narration recovery required")).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });
});
