import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

const homeTitle = "\u628a\u52a8\u4f5c\u8df3\u5f00";
const startLabel = "\u5f00\u59cb\u6e38\u620f";
const selectLabel = "\u9009\u62e9 8\u67083\u65e5\u821e\u8e48\u6311\u6218";

describe("App", () => {
  it("moves from the game introduction to level selection", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: homeTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: startLabel }));

    expect(screen.getByRole("heading", { name: "\u9009\u62e9\u4f60\u7684\u6311\u6218" })).toBeInTheDocument();
  });

  it("opens the temporary analysis preview after selecting the built-in level", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: startLabel }));
    fireEvent.click(screen.getByRole("button", { name: selectLabel }));

    expect(screen.getByRole("heading", { name: "8\u67083\u65e5\u821e\u8e48\u6311\u6218" })).toBeInTheDocument();
  });

  it("keeps the camera technical slice out of the formal home flow", () => {
    render(<App />);

    expect(screen.queryByRole("heading", { name: "\u6444\u50cf\u5934\u4e0e\u59ff\u6001\u6027\u80fd\u9a8c\u8bc1" })).not.toBeInTheDocument();
  });
});
