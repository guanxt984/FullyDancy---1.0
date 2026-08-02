import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoAsset } from "../media/videoAsset";
import { UploadStep } from "./UploadStep";

const fakes = vi.hoisted(() => ({
  createVideoAsset: vi.fn(),
  releaseVideoAsset: vi.fn(),
}));

vi.mock("../media/videoAsset", () => ({
  createVideoAsset: fakes.createVideoAsset,
  releaseVideoAsset: fakes.releaseVideoAsset,
}));

function fakeAsset(name: string): VideoAsset {
  return {
    file: new File(["video"], name, { type: "video/mp4" }),
    objectUrl: `blob:${name}`,
    durationSec: 30,
  };
}

beforeEach(() => {
  fakes.createVideoAsset.mockReset();
  fakes.releaseVideoAsset.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("UploadStep", () => {
  it("accepts a local video file and reports the loaded asset", async () => {
    const asset = fakeAsset("practice.mp4");
    const onAssetReady = vi.fn();
    fakes.createVideoAsset.mockResolvedValue(asset);
    render(<UploadStep onAssetReady={onAssetReady} />);

    fireEvent.change(screen.getByLabelText("选择练习视频"), { target: { files: [asset.file] } });

    await waitFor(() => expect(screen.getByText("practice.mp4（30.0 秒）")).toBeInTheDocument());
    expect(onAssetReady).toHaveBeenCalledWith(asset);
    expect(screen.getByText("视频仅在此设备上处理，不会上传。")).toBeInTheDocument();
  });

  it("shows the media validation error", async () => {
    fakes.createVideoAsset.mockRejectedValue(new Error("请选择 15–60 秒的视频"));
    render(<UploadStep />);
    const file = new File(["video"], "too-short.mp4", { type: "video/mp4" });

    fireEvent.change(screen.getByLabelText("选择练习视频"), { target: { files: [file] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("请选择 15–60 秒的视频");
  });

  it("releases superseded assets and the remaining asset on unmount", async () => {
    const firstAsset = fakeAsset("first.mp4");
    const secondAsset = fakeAsset("second.mp4");
    fakes.createVideoAsset
      .mockResolvedValueOnce(firstAsset)
      .mockResolvedValueOnce(secondAsset);
    const view = render(<UploadStep />);
    const picker = screen.getByLabelText("选择练习视频");

    fireEvent.change(picker, { target: { files: [firstAsset.file] } });
    await screen.findByText("first.mp4（30.0 秒）");
    fireEvent.change(picker, { target: { files: [secondAsset.file] } });
    await screen.findByText("second.mp4（30.0 秒）");

    expect(fakes.releaseVideoAsset).toHaveBeenCalledWith(firstAsset);
    view.unmount();
    expect(fakes.releaseVideoAsset).toHaveBeenCalledWith(secondAsset);
  });
});
