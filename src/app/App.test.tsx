import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the local-only camera privacy disclosure", () => {
    render(<App />);

    expect(
      screen.getByText("视频和摄像头数据仅在本地处理"),
    ).toBeInTheDocument();
  });
});
