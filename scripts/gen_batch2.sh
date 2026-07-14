#!/usr/bin/env bash
# Wait for batch-1 jobs, download results, then submit + download batch 2.
set -u
cd "$(dirname "$0")/.."
RAW=/tmp/claude-1000/-home-michaelpynn/3dc50578-212d-4b69-bd68-97ca3f507195/scratchpad/higgs-raw
mkdir -p "$RAW"

SUFFIX="top-down 3/4 perspective pixel art game asset for a 16-bit SNES-JRPG town, camera looking straight down at a slight forward tilt so ONLY the front face and the roof plane are visible, front wall vertical at the bottom of the frame, roof receding upward, strictly NO isometric or rotated-corner view, no side walls visible, warm late-afternoon sunlight from the upper-left (soft highlights on upper-left edges, soft cool shadows on lower-right edges), flat cel-shaded fills with 2-3 shade bands per surface, single consistent 1px dark outline (near-black #2b1d1f, never pure #000), muted saturated palette matching a small cozy town, no anti-aliasing, hard crisp pixel edges, a thin soft contact shadow hugging the bottom edge of the base so the asset sits grounded, solid uniform magenta #ff00ff background filling every pixel not covered by the asset, no text or UI elements in frame"

declare -A PROMPTS ASPECTS
PROMPTS[summer_nicole_films]="A cozy film studio storefront, red brick facade, black awning over a large display window showing a softbox light and camera-on-tripod silhouette, marquee-style sign mounted above the awning, entrance door at the front center, a sandwich-board sign on the pavement breaking the outline"
ASPECTS[summer_nicole_films]="5:4"
PROMPTS[all_hands_detailing]="A single-bay auto detailing garage, grey and blue color scheme, wide open roll-up door at the front center showing a car bumper inside a genuinely dark interior (no white backdrop), small office window to the side, wall-mounted hose reel, a bucket and cone out front breaking the outline"
ASPECTS[all_hands_detailing]="3:2"
PROMPTS[fourwinds]="An upscale parlor storefront blending a quant-finance office and a mahjong lounge, dark wood and brass facade, warm amber glow in two windows, a four-winds compass emblem sign hanging above the front-center door on a bracket, brass members-only plaque, two small lanterns flanking the entrance breaking the outline"
ASPECTS[fourwinds]="5:4"
PROMPTS[signpost]="A rustic wooden town signpost, single sturdy post with three small direction boards pointing different ways, carved arrows, a tiny roof cap on top, tuft of grass at the base"
ASPECTS[signpost]="2:3"

wait_and_download() {
  local key="$1" id="$2"
  local url
  url=$(higgsfield generate wait "$id" --timeout 15m --quiet 2>/dev/null | grep -o 'https://[^ ]*' | head -1)
  if [ -n "$url" ]; then
    curl -sL "$url" -o "$RAW/$key.png" && echo "DOWNLOADED $key"
  else
    echo "NO URL for $key ($id)" >&2
  fi
}

# batch 1
while read -r key id; do
  wait_and_download "$key" "$id" &
done < scripts/jobs.txt
wait

# batch 2
: > scripts/jobs2.txt
for key in summer_nicole_films all_hands_detailing fourwinds signpost; do
  out=$(higgsfield generate create nano_banana_2 \
    --prompt "${PROMPTS[$key]}, $SUFFIX" \
    --aspect_ratio "${ASPECTS[$key]}" \
    --resolution 2k --json 2>&1)
  id=$(echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0] if isinstance(d,list) else d.get('id',''))" 2>/dev/null)
  if [ -z "$id" ]; then echo "SUBMIT FAILED $key: $out" >&2; else echo "$key $id" >> scripts/jobs2.txt; echo "submitted $key -> $id"; fi
  sleep 2
done

while read -r key id; do
  wait_and_download "$key" "$id" &
done < scripts/jobs2.txt
wait
ls -la "$RAW"
