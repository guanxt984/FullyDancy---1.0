import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BUILT_IN_LEVEL } from "../levels/builtInLevel";
import { LevelSelectScreen } from "./LevelSelectScreen";

const selectLabel = "\u9009\u62e9 8\u67083\u65e5\u821e\u8e48\u6311\u6218";

describe("LevelSelectScreen", () => {
  it("skips to analysis", () => {
    const onSkip = vi.fn();
    render(<LevelSelectScreen level={BUILT_IN_LEVEL} onSelect={vi.fn()} onBack={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));

    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("offers one playable built-in level and a disabled upload roadmap choice", () => {
    render(<LevelSelectScreen level={BUILT_IN_LEVEL} onSelect={vi.fn()} onBack={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByRole("button", { name: selectLabel })).toBeEnabled();
    expect(screen.getByRole("button", { name: "\u4e0a\u4f20\u81ea\u5df1\u7684\u821e\u8e48\uff08\u5373\u5c06\u5f00\u653e\uff09" })).toBeDisabled();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("returns to the game introduction from level selection", () => {
    const onBack = vi.fn();
    render(<LevelSelectScreen level={BUILT_IN_LEVEL} onSelect={vi.fn()} onBack={onBack} onSkip={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "\u8fd4\u56de" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
