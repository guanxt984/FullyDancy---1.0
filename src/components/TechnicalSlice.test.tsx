import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechnicalSlice } from "./TechnicalSlice";

describe("TechnicalSlice", () => {
  it("offers an explicit local-camera start control and preview", () => {
    render(<TechnicalSlice />);

    expect(screen.getByRole("button", { name: "?????????" })).toBeInTheDocument();
    expect(screen.getByTestId("camera-preview")).toBeInTheDocument();
  });
});
