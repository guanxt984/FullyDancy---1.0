import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App technical slice", () => {
  it("includes the local camera validation surface", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "?????????" })).toBeInTheDocument();
  });
});
