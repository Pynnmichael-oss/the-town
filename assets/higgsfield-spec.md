# Higgsfield Asset Generation Spec

Generation spec for the real art pass (build step 6) that replaces the flat-color
placeholder rectangles currently baked into `assets/maps/town.json`. Every
dimension below is pulled directly from the trigger/footprint rectangles already
in the Tiled map (see `gen_town_map.py` in project history) — nothing here is
eyeballed.

No art from this spec has been generated yet. This file plus the loader in
`src/scenes/PreloadScene.js` / `src/scenes/TownScene.js` is the seam a finished
PNG drops into; see "Integration" at the bottom.

## Shared style note

Every asset — character and all 7 buildings — must read as one world, so every
prompt ends with this exact suffix:

> top-down 3/4 perspective pixel art game asset, cohesive 16-bit SNES-JRPG
> aesthetic, warm late-afternoon sunlight from the upper-left (soft highlights
> on upper-left edges, soft cool shadows on lower-right edges), flat
> cel-shaded fills with 2-3 shade bands per surface, single consistent 1px
> dark outline (near-black, e.g. #2b1d1f, never pure #000), muted saturated
> palette matching a small cozy town (avoid neon/oversaturated colors), no
> anti-aliasing, hard crisp pixel edges, transparent background, no baked-in
> drop shadow (the engine adds its own), no text or UI elements in frame

Fixed for every asset: **light source upper-left**, **1px near-black outline
weight**, **2-3 shade bands per surface** (no smooth gradients), **muted
palette**. Do not vary these per-asset even if a single generation looks
better with different lighting — consistency across the set matters more than
any one image.

### Generation vs. target size

Text-to-image models don't reliably hit exact tiny pixel dimensions. For every
building, generate at an 8x canvas (locked to the same aspect ratio as the
target), then downscale with nearest-neighbor (never bilinear/bicubic) to the
exact target size, and hand-clean stray anti-aliased pixels the downscale
leaves behind. The character sheet is generated frame-by-frame at 512x512 and
downscaled per-frame — see the character section.

## Character — player

**File:** `assets/sprites/player.png`
**Target size:** 32x32px per frame, packed into a **160x128px sheet** (5
columns x 4 rows, zero padding/margin between cells — Phaser loads this with
`frameWidth: 32, frameHeight: 32` and no spacing).

**Grid layout** (row = direction, column = pose):

| Row | Direction | Col 0 | Col 1 | Col 2 | Col 3 | Col 4 |
|---|---|---|---|---|---|---|
| 0 | Down (south, faces camera) | Idle | Walk 1 | Walk 2 | Walk 3 | Walk 4 |
| 1 | Left (west) | Idle | Walk 1 | Walk 2 | Walk 3 | Walk 4 |
| 2 | Right (east) | Idle | Walk 1 | Walk 2 | Walk 3 | Walk 4 |
| 3 | Up (north, faces away) | Idle | Walk 1 | Walk 2 | Walk 3 | Walk 4 |

Walk frames 1-4 are a standard contact-passing-contact-passing cycle. Frame
index within the sheet = `row * 5 + col` (e.g. Right-Walk2 = row2,col2 = index
12).

### Animation key contract

`src/anims.js` registers 8 Phaser animations against the `player` texture,
built directly from the row/col table above. This is the exact contract the
real sprite sheet has to match — row order especially, since swapping two
rows silently makes the character face the wrong way with no error:

| Anim key | Row | Frames (row*5+col) | frameRate | repeat |
|---|---|---|---|---|
| `idle-down` | 0 | 0 | 1 | -1 |
| `walk-down` | 0 | 1-4 | 8 | -1 |
| `idle-left` | 1 | 5 | 1 | -1 |
| `walk-left` | 1 | 6-9 | 8 | -1 |
| `idle-right` | 2 | 10 | 1 | -1 |
| `walk-right` | 2 | 11-14 | 8 | -1 |
| `idle-up` | 3 | 15 | 1 | -1 |
| `walk-up` | 3 | 16-19 | 8 | -1 |

These are registered once in `PreloadScene.create()` against whatever texture
ends up at the `player` key — the real spritesheet if it loaded, or a
generated 20-frame placeholder sheet (each frame identical) if it didn't.
Either way the animations exist and play; a missing `player.png` degrades the
*visuals* to a static-looking placeholder, not the animation *state machine*.
TownScene picks the key via `animKeyFor(direction, moving)` in the same file.

**Base prompt** (before the shared style suffix):

> A single friendly townsperson character for a top-down pixel art
> walking-simulator game, simple rounded proportions (chibi-ish, roughly
> 2.5-heads-tall), casual weekend clothing (t-shirt, jeans, sneakers), no
> logos or text on clothing, gender-neutral features, brown hair, medium skin
> tone, plain neutral pose with arms visible

**Generation workflow:** generate ONE clean reference frame (Down/Idle) at
512x512 using the base prompt + style suffix. Text-to-image models can't
reliably produce a full multi-pose grid in one shot, so use that reference as
a character-consistency/image-reference input (Higgsfield's character-lock or
equivalent) for the other 19 frames, generating each individually at 512x512.
Downscale each frame to 32x32 (nearest-neighbor), hand-clean, then assemble
into the 160x128 grid in a sprite sheet packer or image editor. Keep the
character's silhouette centered and consistently sized across all 20 frames —
inconsistent scale between frames is the most common failure mode here.

## Buildings

All 7 building footprint sizes below are read directly from the Tiled map's
building rectangles (tile size 16px):

| Key | Project(s) | Footprint (tiles) | Target px (W x H) | Suggested gen canvas |
|---|---|---|---|---|
| `touchgrass_pavilion` | TouchGrass | 4 x 3 | 64 x 48 | 512 x 384 |
| `shortsleeve_dock` | Shortsleeve Travel | 4 x 3 | 64 x 48 | 512 x 384 |
| `twin_silo` | Terminal Dashboard + Blend Planner | 6 x 3 | 96 x 48 | 768 x 384 |
| `roberts_fuel` | Roberts Fuel Services | 4 x 3 | 64 x 48 | 512 x 384 |
| `summer_nicole_films` | Summer Nicole Films | 4 x 3 | 64 x 48 | 512 x 384 |
| `all_hands_detailing` | All Hands Detailing | 4 x 3 | 64 x 48 | 512 x 384 |
| `fourwinds` | FourWinds | 4 x 3 | 64 x 48 | 512 x 384 |

File path convention: `assets/sprites/buildings/<key>.png` (e.g.
`assets/sprites/buildings/touchgrass_pavilion.png`).

v1 art should fill the target canvas edge-to-edge (building occupies the full
footprint box, no ground/margin baked in) — TownScene displays each sprite at
exactly its footprint's pixel size regardless of the source file's native
resolution. If a future pass wants a roof/silhouette that overshoots above the
footprint (a common top-down pixel-art technique), that needs a scene-code
change to anchor the sprite bottom-aligned instead of centered; out of scope
for this spec.

### touchgrass_pavilion — TouchGrass

> A small open-air park pavilion/gazebo with a peaked shingled roof supported
> by four wooden posts, a built-in wooden bench inside, string lights along
> the roofline, canvas 64x48px, building fills the frame edge to edge

### shortsleeve_dock — Shortsleeve Travel

> A small wooden boat dock jutting out with one moored rowboat with a light
> blue and white hull, coiled rope and a lantern post at the dock's edge,
> canvas 64x48px, building fills the frame edge to edge

### twin_silo — Terminal Dashboard (west door) + Blend Planner (east door)

> A compact industrial twin-silo refinery building, two cylindrical metal
> storage silos side by side connected by a shared low structure with
> catwalks and pipework between them, each silo has its own ground-level
> entrance door facing the viewer, brushed steel with rust-orange accent
> paneling, small warning-stripe details, canvas 96x48px, the left door must
> sit entirely within the left half (the first 48px) and the right door
> entirely within the right half (the last 48px) — the two doors are
> separate interactive zones in-engine and must not blend into a single
> centered entrance

### roberts_fuel — Roberts Fuel Services

> A small single-pump fuel depot kiosk with a flat overhanging canopy roof,
> one fuel pump out front, orange and white color scheme, small attached
> office booth with a window, canvas 64x48px, building fills the frame edge
> to edge

### summer_nicole_films — Summer Nicole Films

> A small photo/film studio storefront with a large display window showing a
> softbox light and camera-on-tripod silhouette, red brick facade, black
> awning above the entrance door, small marquee-style sign, canvas 64x48px,
> building fills the frame edge to edge

### all_hands_detailing — All Hands Detailing

> A small single-bay auto detailing garage with an open roll-up door showing
> a glimpse of a car's front bumper inside, concrete apron in front, a
> wall-mounted hose reel, grey and blue color scheme, canvas 64x48px,
> building fills the frame edge to edge

### fourwinds — FourWinds

> A small upscale parlor storefront blending a quant-finance office and a
> mahjong lounge, dark wood and brass facade, a subtle four-winds compass
> emblem above the door, warm amber window glow, a discreet reserved/
> members-only brass plaque by the entrance, canvas 64x48px, building fills
> the frame edge to edge

## Integration

`PreloadScene` tries to load every file in this spec from `assets/sprites/`
first. Missing files fail silently (no console errors) and fall back to the
current placeholder — a generated 20-frame sheet (every frame an identical
flat square) for the player, so the animation system in `src/anims.js` has
real frames to play even with no art; and the existing flat-color tile fill
for buildings (no code change needed either way). Drop a finished PNG at the
path above and it's picked up automatically next load; nothing else in the
codebase needs to change. See `BUILDING_SPRITE_KEYS` in `src/config.js`, the
loader in `PreloadScene.js`, the animation defs in `src/anims.js`, and the
footprint loop in `TownScene.js` for the mechanism.
