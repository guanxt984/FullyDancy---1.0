import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen";

const homeTitle = "\u628a\u52a8\u4f5c\u8df3\u5f00";
const homeCopy = "\u8ddf\u7740\u97f3\u4e50\uff0c\u628a\u6bcf\u4e00\u4e2a\u52a8\u4f5c\u505a\u5230\u66f4\u8212\u5c55\u3002";
const startLabel = "\u5f00\u59cb\u6e38\u620f";

afterEach(() => vi.unstubAllGlobals());

describe("HomeScreen", () => {
  it("starts the game from the immersive introduction", () => {
    const onStart = vi.fn();
    render(<HomeScreen onStart={onStart} />);

    expect(screen.getByRole("heading", { name: homeTitle })).toBeInTheDocument();
    expect(screen.getByText(homeCopy)).toBeInTheDocument();
    expect(screen.getByLabelText("\u821e\u8e48\u793a\u8303\u80cc\u666f")).toHaveAttribute("src", "/levels/level-1.mp4");

    fireEvent.click(screen.getByRole("button", { name: startLabel }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("does not autoplay or loop the background video when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<HomeScreen onStart={vi.fn()} />);

    const video = screen.getByLabelText("\u821e\u8e48\u793a\u8303\u80cc\u666f");
    expect(video).not.toHaveAttribute("autoplay");
    expect(video).not.toHaveAttribute("loop");
  });
});
