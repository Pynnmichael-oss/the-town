#!/usr/bin/env python3
"""Chroma-key and pack a Higgsfield generation into a game-ready sprite.

Usage: process_sprite.py <input.png> <output.png> <target_w> <target_h>

Pipeline (see assets/higgsfield-spec.md "Generation vs. target size"):
  1. key solid magenta (#ff00ff-ish) to transparency
  2. clean fringe: edge pixels still blending toward magenta get re-keyed
  3. autocrop to content bbox
  4. nearest-neighbor downscale to fit the target box
  5. paste bottom-centered onto a transparent canvas of exactly target size
"""
import sys
from PIL import Image


def magenta_score(r, g, b):
    """0..1 — how magenta a pixel is (high r+b, low g)."""
    return max(0, min(r, b) - g) / 255


def key_out(im, threshold=0.25):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            s = magenta_score(r, g, b)
            if s > threshold:
                px[x, y] = (r, g, b, 0)
    return im


def clean_fringe(im, passes=2):
    """Kill semi-magenta halo pixels that touch transparency."""
    px = im.load()
    w, h = im.size
    for _ in range(passes):
        kill = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if magenta_score(r, g, b) > 0.08:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                            kill.append((x, y))
                            break
        for x, y in kill:
            px[x, y] = (0, 0, 0, 0)
    return im


def pack(im, tw, th):
    bbox = im.getbbox()
    if bbox is None:
        raise SystemExit("nothing left after keying — check the input")
    im = im.crop(bbox)
    scale = min(tw / im.width, th / im.height)
    nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im = im.resize((nw, nh), Image.NEAREST)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(im, ((tw - nw) // 2, th - nh), im)
    return canvas


def main():
    src, dst, tw, th = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    im = key_out(Image.open(src))
    im = clean_fringe(im)
    pack(im, tw, th).save(dst)
    print(f"{dst}: {tw}x{th}")


if __name__ == "__main__":
    main()
