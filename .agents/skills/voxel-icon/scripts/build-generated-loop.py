#!/usr/bin/env python3
"""Assemble a short loop directly from complete generated PNG frames."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
from pathlib import Path

from PIL import Image, ImageDraw


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Copy complete generated frames without masks or compositing, then "
            "encode a base-forward-base-back loop."
        )
    )
    parser.add_argument("base", type=Path)
    parser.add_argument("pose_forward", type=Path)
    parser.add_argument("pose_back", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument(
        "--moving-part",
        action="append",
        required=True,
        help=(
            "Visible semantic region affected by the physical motion; pass at "
            "least twice. Regions may move independently or as a coupled rigid group."
        ),
    )
    parser.add_argument("--duration-ms", type=int, default=300)
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_complete_rgb_png(path: Path) -> Image.Image:
    if path.suffix.lower() != ".png":
        raise ValueError(f"source must be a PNG: {path}")
    with Image.open(path) as image:
        image.load()
        if image.mode != "RGB":
            raise ValueError(f"source must be opaque RGB, got {image.mode}: {path}")
        return image.copy()


def read_webp_frame_durations(path: Path) -> list[int]:
    data = path.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise RuntimeError(f"{path.name} is not a WebP RIFF container")

    durations = []
    offset = 12
    while offset + 8 <= len(data):
        chunk_type = data[offset : offset + 4]
        chunk_size = struct.unpack_from("<I", data, offset + 4)[0]
        payload_start = offset + 8
        payload_end = payload_start + chunk_size
        if payload_end > len(data):
            raise RuntimeError(f"{path.name} contains a truncated WebP chunk")
        if chunk_type == b"ANMF":
            if chunk_size < 16:
                raise RuntimeError(f"{path.name} contains an invalid ANMF chunk")
            duration_bytes = data[payload_start + 12 : payload_start + 15]
            durations.append(int.from_bytes(duration_bytes, "little"))
        offset = payload_end + (chunk_size % 2)
    return durations


def verify_animation(path: Path, expected_frames: int, expected_duration_ms: int) -> None:
    with Image.open(path) as image:
        if getattr(image, "n_frames", 1) != expected_frames:
            raise RuntimeError(
                f"{path.name} has {getattr(image, 'n_frames', 1)} frames; "
                f"expected {expected_frames}"
            )
        if image.info.get("loop") != 0:
            raise RuntimeError(f"{path.name} is not configured to loop forever")

        if path.suffix.lower() == ".webp":
            durations = read_webp_frame_durations(path)
        else:
            durations = []
            for index in range(expected_frames):
                image.seek(index)
                durations.append(image.info.get("duration"))

    if durations != [expected_duration_ms] * expected_frames:
        raise RuntimeError(
            f"{path.name} has frame durations {durations}; "
            f"expected {expected_duration_ms} ms each"
        )


def build_contact_sheet(frames: list[Image.Image], labels: list[str]) -> Image.Image:
    width, height = frames[0].size
    label_height = max(44, height // 18)
    sheet = Image.new("RGB", (width * len(frames), height + label_height), "#F4F4F4")
    draw = ImageDraw.Draw(sheet)
    if len(frames) != len(labels):
        raise ValueError("each contact-sheet frame needs one label")
    for index, (frame, label) in enumerate(zip(frames, labels)):
        x = index * width
        sheet.paste(frame, (x, label_height))
        draw.text((x + 16, 14), label, fill="#111111")
    return sheet


def main() -> None:
    args = parse_args()
    moving_parts = list(dict.fromkeys(args.moving_part))
    if len(moving_parts) < 2:
        raise ValueError("at least two unique --moving-part values are required")
    if args.duration_ms <= 0:
        raise ValueError("--duration-ms must be positive")

    source_paths = [args.base, args.pose_forward, args.pose_back]
    source_images = [load_complete_rgb_png(path) for path in source_paths]
    sizes = {image.size for image in source_images}
    if len(sizes) != 1:
        raise ValueError(f"all sources must use one canvas size, got {sorted(sizes)}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    sequence_indices = [0, 1, 0, 2]
    sequence_labels = ["rest", "forward", "rest", "back"]
    frame_paths: list[Path] = []
    for frame_index, source_index in enumerate(sequence_indices):
        destination = args.output_dir / f"frame-{frame_index:02d}.png"
        shutil.copyfile(source_paths[source_index], destination)
        if sha256(destination) != sha256(source_paths[source_index]):
            raise RuntimeError(f"copied frame does not match source: {destination}")
        frame_paths.append(destination)

    frames = [source_images[index] for index in sequence_indices]
    webp_path = args.output_dir / "loop.webp"
    frames[0].save(
        webp_path,
        save_all=True,
        append_images=frames[1:],
        duration=args.duration_ms,
        loop=0,
        lossless=True,
        method=6,
    )
    gif_path = args.output_dir / "loop.gif"
    frames[0].save(
        gif_path,
        save_all=True,
        append_images=frames[1:],
        duration=args.duration_ms,
        loop=0,
        disposal=2,
        optimize=False,
    )

    contact_sheet_path = args.output_dir / "contact-sheet.png"
    build_contact_sheet(frames, sequence_labels).save(contact_sheet_path)
    verify_animation(webp_path, len(frames), args.duration_ms)
    verify_animation(gif_path, len(frames), args.duration_ms)

    manifest = {
        "assembly": "complete generated frames; no masks or compositing",
        "canvas_size": list(frames[0].size),
        "frame_count": len(frames),
        "duration_ms": args.duration_ms,
        "moving_parts": moving_parts,
        "sequence": sequence_labels,
        "sources": [
            {"path": str(path.resolve()), "sha256": sha256(path)}
            for path in source_paths
        ],
        "frames": [
            {
                "path": path.name,
                "source": str(source_paths[source_index].resolve()),
                "sha256": sha256(path),
            }
            for path, source_index in zip(frame_paths, sequence_indices)
        ],
        "outputs": {
            "gif": gif_path.name,
            "webp": webp_path.name,
            "contact_sheet": contact_sheet_path.name,
        },
    }
    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(frames)} complete frames to {args.output_dir}")
    print(f"Moving parts: {', '.join(moving_parts)}")
    print(f"GIF: {gif_path}")
    print(f"WebP: {webp_path}")


if __name__ == "__main__":
    main()
