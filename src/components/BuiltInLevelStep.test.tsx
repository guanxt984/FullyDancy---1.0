import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BuiltInLevel } from "../levels/builtInLevel";
import { BuiltInLevelStep } from "./BuiltInLevelStep";

const level: BuiltInLevel = {
  id: "level-1",
  title: "8月3日舞蹈挑战",
  videoUrl: "/levels/level-1.mp4",
};

describe("BuiltInLevelStep", () => {
  it("shows the bundled level and requests analysis once", () => {
    const onAnalyze = vi.fn();
    render(<BuiltInLevelStep level={level} onAnalyze={onAnalyze} />);

    expect(screen.getByRole("heading", { name: "8月3日舞蹈挑战" })).toBeInTheDocument();
    expect(screen.getByLabelText("内置舞蹈示范")).toHaveAttribute("src", "/levels/level-1.mp4");
    expect(screen.getByLabelText("内置舞蹈示范")).toHaveAttribute("preload", "metadata");
    expect(screen.getByText("先观看示范，再分析音乐强拍。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "分析卡点" }));

    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });
});
