"use client";

import * as React from "react";

// Matriks Bayer 4x4 standar untuk ordered dithering (gaya Lumno)
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

function buildDitherLut(params: {
  brightness: number;
  contrast: number;
  grain: number;
  levels: number;
}): Uint8ClampedArray {
  const { brightness, contrast, grain, levels } = params;
  const lut = new Uint8ClampedArray(16 * 256);
  const step = 255 / Math.max(1, levels - 1);

  for (let b = 0; b < 16; b += 1) {
    const thresholdOffset = (b * 3 - 24) * grain;
    for (let v = 0; v < 256; v += 1) {
      const adjusted = Math.min(
        255,
        Math.max(0, (v - 128) * contrast + 128 + brightness * 255)
      );
      const dithered = Math.min(255, Math.max(0, adjusted + thresholdOffset));
      lut[b * 256 + v] = Math.round(dithered / step) * step;
    }
  }
  return lut;
}

function computeCoverRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const drawW = Math.ceil(srcW * scale);
  const drawH = Math.ceil(srcH * scale);
  return {
    x: Math.floor((dstW - drawW) / 2),
    y: Math.floor((dstH - drawH) / 2),
    width: drawW,
    height: drawH,
  };
}

function renderDitherFrame(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  cssW: number,
  cssH: number,
  cellSize: number,
  lut: Uint8ClampedArray
): boolean {
  if (cssW < 1 || cssH < 1 || img.naturalWidth < 1 || img.naturalHeight < 1) {
    return false;
  }

  const cell = Math.max(1, Math.floor(cellSize));
  const w = Math.max(1, Math.ceil(cssW / cell));
  const h = Math.max(1, Math.ceil(cssH / cell));

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  const rect = computeCoverRect(img.naturalWidth, img.naturalHeight, w, h);
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);

  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  for (let y = 0; y < h; y += 1) {
    const rowOffset = (y & 3) * 4;
    let idx = y * w * 4;
    for (let x = 0; x < w; x += 1, idx += 4) {
      if (pixels[idx + 3] < 10) {
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
        continue;
      }
      const bayerBase = BAYER_4X4[rowOffset + (x & 3)] * 256;
      pixels[idx] = lut[bayerBase + pixels[idx]];
      pixels[idx + 1] = lut[bayerBase + pixels[idx + 1]];
      pixels[idx + 2] = lut[bayerBase + pixels[idx + 2]];
      pixels[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return true;
}

export function DitherBackground({
  src,
  cellSize = 2,
  brightness = -0.02,
  contrast = 1.12,
  grain = 0.92,
  levels = 7,
  className = "",
}: {
  src: string;
  cellSize?: number;
  brightness?: number;
  contrast?: number;
  grain?: number;
  levels?: number;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const lut = buildDitherLut({ brightness, contrast, grain, levels });
    const img = new Image();
    img.decoding = "async";

    let disposed = false;
    let rafId = 0;
    let timerId = 0;
    let size = {
      width: Math.floor(container.clientWidth),
      height: Math.floor(container.clientHeight),
    };

    const draw = () => {
      rafId = 0;
      if (disposed) return;
      const ok = renderDitherFrame(
        canvas,
        img,
        size.width,
        size.height,
        cellSize,
        lut
      );
      if (ok) setReady(true);
    };

    const scheduleDraw = (delayMs: number) => {
      if (disposed || rafId) return;
      if (delayMs === 0) {
        window.clearTimeout(timerId);
        timerId = 0;
        rafId = window.requestAnimationFrame(draw);
        return;
      }
      if (!timerId) {
        timerId = window.setTimeout(() => {
          timerId = 0;
          rafId = window.requestAnimationFrame(draw);
        }, delayMs);
      }
    };

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = {
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      };
      if (
        next.width < 1 ||
        next.height < 1 ||
        (next.width === size.width && next.height === size.height)
      ) {
        return;
      }
      size = next;
      scheduleDraw(90);
    });

    img.onload = () => scheduleDraw(0);
    img.src = src;
    if (img.complete && img.naturalWidth > 0) {
      scheduleDraw(0);
    }

    observer.observe(container);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(timerId);
      window.cancelAnimationFrame(rafId);
      img.onload = null;
    };
  }, [src, cellSize, brightness, contrast, grain, levels]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        className={`block size-full transition-opacity duration-500 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
