#!/usr/bin/env python3
"""Normalize a flat near-gray render onto the exact #F4F4F4 final background."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


FINAL_BACKGROUND = (244, 244, 244)


def sample_border(array: np.ndarray, width: int) -> np.ndarray:
    height, image_width = array.shape[:2]
    width = max(1, min(width, height // 4, image_width // 4))
    return np.concatenate(
        (
            array[:width, :, :].reshape(-1, 3),
            array[-width:, :, :].reshape(-1, 3),
            array[width:-width, :width, :].reshape(-1, 3),
            array[width:-width, -width:, :].reshape(-1, 3),
        ),
        axis=0,
    )


def connected_background(candidate: np.ndarray) -> np.ndarray:
    mask = Image.fromarray(np.where(candidate, 255, 0).astype(np.uint8)).copy()
    corners = (
        (0, 0),
        (mask.width - 1, 0),
        (0, mask.height - 1),
        (mask.width - 1, mask.height - 1),
    )
    for corner in corners:
        if mask.getpixel(corner) == 255:
            ImageDraw.floodfill(mask, corner, 128, thresh=0)
    return np.asarray(mask) == 128


def build_matte(
    rgb: np.ndarray,
    detected_background: np.ndarray,
    tolerance: int,
    feather_limit: int,
) -> tuple[np.ndarray, np.ndarray]:
    delta = np.max(
        np.abs(rgb.astype(np.int16) - detected_background.astype(np.int16)),
        axis=2,
    )
    background = connected_background(delta <= tolerance)
    alpha = np.full(delta.shape, 255, dtype=np.uint8)
    alpha[background] = 0

    dilated = Image.fromarray(background.astype(np.uint8) * 255).filter(
        ImageFilter.MaxFilter(5)
    )
    edge_ring = (np.asarray(dilated) > 0) & ~background
    padded = np.pad(rgb, ((2, 2), (2, 2), (0, 0)), mode="edge")
    foreground_hint = rgb.copy()
    best_delta = delta.copy()
    for y_offset in range(5):
        for x_offset in range(5):
            neighbor = padded[
                y_offset : y_offset + rgb.shape[0],
                x_offset : x_offset + rgb.shape[1],
            ]
            neighbor_delta = np.max(
                np.abs(
                    neighbor.astype(np.int16)
                    - detected_background.astype(np.int16)
                ),
                axis=2,
            )
            replace = neighbor_delta > best_delta
            best_delta[replace] = neighbor_delta[replace]
            foreground_hint[replace] = neighbor[replace]

    denominator = np.maximum(best_delta.astype(np.float32), feather_limit)
    edge_alpha = np.clip(delta.astype(np.float32) / denominator * 255, 0, 255).astype(
        np.uint8
    )
    alpha[edge_ring] = np.minimum(alpha[edge_ring], edge_alpha[edge_ring])
    return alpha, foreground_hint


def normalize(
    rgb: np.ndarray,
    alpha: np.ndarray,
    foreground_hint: np.ndarray,
) -> Image.Image:
    cleaned = rgb.copy()
    semi = (alpha > 0) & (alpha < 255)
    cleaned[semi] = foreground_hint[semi]
    cleaned[alpha == 0] = 0
    rgba = Image.fromarray(np.dstack((cleaned, alpha)))
    background = Image.new("RGBA", rgba.size, (*FINAL_BACKGROUND, 255))
    return Image.alpha_composite(background, rgba).convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Replace a uniform near-gray model background with the exact "
            "#F4F4F4 final field without rerendering the subject."
        )
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--sample-width", type=int, default=24)
    parser.add_argument("--tolerance", type=int, default=3)
    parser.add_argument("--feather-limit", type=int, default=12)
    parser.add_argument("--max-border-variation", type=float, default=4.0)
    parser.add_argument("--max-border-outlier", type=int, default=8)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGB")
    rgb = np.asarray(source)
    border = sample_border(rgb, args.sample_width)
    detected = np.median(border, axis=0).round().astype(np.uint8)
    border_delta = np.max(
        np.abs(border.astype(np.int16) - detected.astype(np.int16)),
        axis=1,
    )
    variation = float(np.percentile(border_delta, 95))
    border_max = int(np.max(border_delta))
    if variation > args.max_border_variation:
        raise SystemExit(
            "Gray normalization refused: the outer border is not flat "
            f"(95th-percentile variation {variation:.1f} > "
            f"{args.max_border_variation:.1f}). Correct the render first."
        )
    if border_max > args.max_border_outlier:
        raise SystemExit(
            "Gray normalization refused: the outer border contains a "
            f"{border_max}-level outlier. Correct the render or framing first."
        )

    effective_tolerance = max(args.tolerance, border_max)
    alpha, foreground_hint = build_matte(
        rgb,
        detected,
        effective_tolerance,
        args.feather_limit,
    )
    visible = Image.fromarray(alpha).getbbox()
    if visible is None:
        raise SystemExit("Gray normalization refused: no subject remained.")
    if (
        visible[0] == 0
        or visible[1] == 0
        or visible[2] == source.width
        or visible[3] == source.height
    ):
        raise SystemExit(
            "Gray normalization refused: the extracted subject touches the canvas edge."
        )

    output = normalize(rgb, alpha, foreground_hint)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.output)

    output_array = np.asarray(output)
    corners = (
        output_array[0, 0],
        output_array[0, -1],
        output_array[-1, 0],
        output_array[-1, -1],
    )
    if any(tuple(pixel) != FINAL_BACKGROUND for pixel in corners):
        raise SystemExit("Gray normalization validation failed at a canvas corner.")

    print(
        json.dumps(
            {
                "input": str(args.input),
                "output": str(args.output),
                "detected_background": [int(value) for value in detected],
                "final_background": list(FINAL_BACKGROUND),
                "border_variation_p95": round(variation, 2),
                "border_variation_max": border_max,
                "tolerance_used": effective_tolerance,
                "visible_bbox": list(visible),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
