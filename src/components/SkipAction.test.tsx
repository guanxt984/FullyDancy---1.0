import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkipAction } from "./SkipAction";

describe("SkipAction", () => {
  it("calls onSkip once when the single 跳过 button is clicked", () => {
    const onSkip = vi.fn();

    render(<SkipAction onSkip={onSkip} />);

    const buttons = screen.getAllByRole("button", { name: "跳过" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
