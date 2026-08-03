import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the local-only camera privacy disclosure", () => {
    render(<App />);

    expect(
      screen.getByText("视频和摄像头数据仅在本地处理"),
    ).toBeInTheDocument();
  });

  it("starts analysis for the built-in dance level without an upload control", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "8月3日舞蹈挑战" })).toBeInTheDocument();
    expect(screen.getByLabelText("内置舞蹈示范")).toHaveAttribute("src", "/levels/level-1.mp4");
    expect(screen.queryByLabelText("选择练习视频")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "分析卡点" }));

    expect(screen.getByText("正在准备卡点分析…")).toBeInTheDocument();
  });
});
