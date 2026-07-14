#!/usr/bin/env bash
# Submit Higgsfield Nano Banana Pro jobs for all 7 buildings + signpost
# per assets/higgsfield-spec.md v2. Writes job ids to scripts/jobs.txt.
set -u

SUFFIX="top-down 3/4 perspective pixel art game asset for a 16-bit SNES-JRPG town, camera looking straight down at a slight forward tilt so ONLY the front face and the roof plane are visible, front wall vertical at the bottom of the frame, roof receding upward, strictly NO isometric or rotated-corner view, no side walls visible, warm late-afternoon sunlight from the upper-left (soft highlights on upper-left edges, soft cool shadows on lower-right edges), flat cel-shaded fills with 2-3 shade bands per surface, single consistent 1px dark outline (near-black #2b1d1f, never pure #000), muted saturated palette matching a small cozy town, no anti-aliasing, hard crisp pixel edges, a thin soft contact shadow hugging the bottom edge of the base so the asset sits grounded, solid uniform magenta #ff00ff background filling every pixel not covered by the asset, no text or UI elements in frame"

declare -A PROMPTS ASPECTS

PROMPTS[touchgrass_pavilion]="A generous open-air park pavilion with a peaked green-shingled roof on six wooden posts, built-in benches inside, string lights sagging along the roofline, a stone step at the south opening, potted plants at two corners"
ASPECTS[touchgrass_pavilion]="3:2"

PROMPTS[shortsleeve_dock]="A weathered wooden boat dock seen from above jutting toward the right, plank walkway entering from the left edge, one moored rowboat with a light blue and white hull tied at the right side, coiled rope, a lantern post, and a stack of crates breaking the outline, gentle water lapping visible between planks"
ASPECTS[shortsleeve_dock]="4:3"

PROMPTS[twin_silo]="A compact industrial twin-silo refinery, two tall cylindrical brushed-steel silos side by side joined by a low pipework gantry, catwalk with railing, rust-orange accent paneling and warning stripes, one ground-level entrance door at the front of the LEFT silo and one at the front of the RIGHT silo, clearly separated, external pipes and a vent stack breaking the outline"
ASPECTS[twin_silo]="16:9"

PROMPTS[roberts_fuel]="A small fuel depot with a flat orange-and-white canopy on two poles sheltering one retro fuel pump, attached office booth with a lit window on the right with its entrance door at the front, an oil drum and a tire stack beside the booth breaking the outline"
ASPECTS[roberts_fuel]="3:2"

PROMPTS[summer_nicole_films]="A cozy film studio storefront, red brick facade, black awning over a large display window showing a softbox light and camera-on-tripod silhouette, marquee-style sign mounted above the awning, entrance door at the front center, a sandwich-board sign on the pavement breaking the outline"
ASPECTS[summer_nicole_films]="5:4"

PROMPTS[all_hands_detailing]="A single-bay auto detailing garage, grey and blue color scheme, wide open roll-up door at the front center showing a car bumper inside a genuinely dark interior (no white backdrop), small office window to the side, wall-mounted hose reel, a bucket and cone out front breaking the outline"
ASPECTS[all_hands_detailing]="3:2"

PROMPTS[fourwinds]="An upscale parlor storefront blending a quant-finance office and a mahjong lounge, dark wood and brass facade, warm amber glow in two windows, a four-winds compass emblem sign hanging above the front-center door on a bracket, brass members-only plaque, two small lanterns flanking the entrance breaking the outline"
ASPECTS[fourwinds]="5:4"

PROMPTS[signpost]="A rustic wooden town signpost, single sturdy post with three small direction boards pointing different ways, carved arrows, a tiny roof cap on top, tuft of grass at the base"
ASPECTS[signpost]="2:3"

: > scripts/jobs.txt
for key in touchgrass_pavilion shortsleeve_dock twin_silo roberts_fuel summer_nicole_films all_hands_detailing fourwinds signpost; do
  out=$(higgsfield generate create nano_banana_2 \
    --prompt "${PROMPTS[$key]}, $SUFFIX" \
    --aspect_ratio "${ASPECTS[$key]}" \
    --resolution 2k --json 2>&1)
  id=$(echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id') or d.get('job_id') or (d.get('jobs') or [{}])[0].get('id',''))" 2>/dev/null)
  if [ -z "$id" ]; then
    echo "SUBMIT FAILED $key: $out" >&2
  else
    echo "$key $id" >> scripts/jobs.txt
    echo "submitted $key -> $id"
  fi
done
cat scripts/jobs.txt
