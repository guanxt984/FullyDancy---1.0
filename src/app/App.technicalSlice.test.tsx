import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App technical slice", () => {
  it("includes the local camera validation surface", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "摄像头与姿态性能验证" })).toBeInTheDocument();
  });
});
