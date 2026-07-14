#!/usr/bin/env bash
# Regenerate the 3 buildings that drifted isometric, with stronger
# straight-on front-elevation framing. Overwrites the raw PNGs.
set -u
cd "$(dirname "$0")/.."
RAW=/tmp/claude-1000/-home-michaelpynn/3dc50578-212d-4b69-bd68-97ca3f507195/scratchpad/higgs-raw

SUFFIX="pixel art game asset for a 16-bit SNES-JRPG town, drawn EXACTLY like a building sprite in Stardew Valley or Pokemon: dead-straight-on front elevation view from the south, perfectly frontal and symmetrical framing, front wall flat and vertical filling the bottom of the sprite, roof plane tilted toward the viewer above it, left and right building edges perfectly vertical and parallel, absolutely NO isometric view, NO rotated corner, NO side wall visible, NO vanishing point, warm late-afternoon sunlight from the upper-left, flat cel-shaded fills with 2-3 shade bands per surface, single consistent 1px dark outline near-black #2b1d1f, muted saturated cozy-town palette, no anti-aliasing, hard crisp pixel edges, thin soft contact shadow hugging the bottom edge, solid uniform magenta #ff00ff background filling every pixel not covered by the asset, no text in frame"

gen() {
  local key="$1" prompt="$2" aspect="$3"
  local url
  url=$(higgsfield generate create nano_banana_2 \
    --prompt "$prompt, $SUFFIX" \
    --aspect_ratio "$aspect" \
    --resolution 2k --wait --wait-timeout 15m 2>/dev/null | grep -o 'https://[^ ]*' | tail -1)
  if [ -n "$url" ]; then
    curl -sL "$url" -o "$RAW/$key.png" && echo "REGEN OK $key"
  else
    echo "REGEN FAILED $key" >&2
  fi
}

gen touchgrass_pavilion "A generous open-air park pavilion with a peaked green-shingled roof seen straight from the front, gable ridge running left-to-right so the roof slope faces the viewer, six wooden posts across the open front, built-in benches visible inside between the posts, string lights sagging along the front roofline, a stone step at the front-center opening, potted plants at the two front corners" "3:2" &
p1=$!
gen roberts_fuel "A small fuel depot seen straight from the front: a flat orange-and-white canopy held up by two front poles sheltering one retro red fuel pump at front-center-left, attached flat-roofed office booth on the right with a lit window and its entrance door facing the viewer, an oil drum and a stack of tires beside the booth breaking the outline" "3:2" &
p2=$!
gen fourwinds "An upscale parlor storefront facade seen straight from the front, blending a quant-finance office and a mahjong lounge: dark wood and brass flat facade, warm amber glow in two front windows, a four-winds compass emblem sign hanging from a bracket above the front-center door, brass members-only plaque beside the door, two small lanterns flanking the entrance breaking the outline" "5:4" &
p3=$!
wait $p1 $p2 $p3
echo "retry batch done"
