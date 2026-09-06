import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "../App";

it("uses the explicit fixture fallback when no host APIs exist", () => {
  delete window.openai;
  render(<App />);
  expect(screen.getByRole("heading", { name: "The Lantern Cellar" })).toBeInTheDocument();
  expect(screen.getByText("State 12")).toBeInTheDocument();
});
