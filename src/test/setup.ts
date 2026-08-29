import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  beginPath: vi.fn(),
  arc: vi.fn(),
  clearRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fill: vi.fn(),
  fillRect: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  globalCompositeOperation: "source-over",
  fillStyle: "",
  lineWidth: 1,
  strokeStyle: "",
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
