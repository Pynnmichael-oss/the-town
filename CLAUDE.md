# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"The Town" is a small top-down Phaser 3 walking-sim / portfolio hub: a static, no-build browser game where the player walks around a town and each building is a portal (opens in a new tab) to one of Michael's other projects. No framework, no bundler, no package.json — plain ES modules loaded straight by the browser, Phaser pulled from a CDN `<script>` tag in `index.html`.

## Running it

There is no build step and no dev-server script checked in. Serve the directory root with any static file server and open it (ES modules and `fetch`-based asset loading require `http://`, not `file://`), e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Architecture

**Scene flow** (`src/main.js` registers all four in order): `Boot` → `Preload` → `Title` → `Town`.

- `BootScene` — immediately hands off to `Preload`.
- `PreloadScene` — loads the tileset, tilemap, player spritesheet, building sprites, and audio. See "Asset fallback seam" below.
- `TitleScene` — title card; Space/Enter starts `Town`, `E` opens the directory overlay directly (skip-walking shortcut).
- `TownScene` — the actual game: tilemap, player movement/collision, building trigger zones, signpost, footstep/ambient audio.

**Data-driven map, not hardcoded scene logic.** `assets/maps/town.json` is GENERATED — edit and rerun `scripts/gen_town_map.py`, never hand-edit the JSON. It's a Tiled-format map with five layers: `Ground` (autotiled grass/paths/plaza/water — water tiles collide via the `collides` custom property), `Buildings` (set dressing: trees, lamps, benches, fences — most of it collides), and three object layers — `Objects` (spawn point, signpost position), `Triggers` (interaction zones), `BuildingFootprints` (building art anchor + a static collision body per footprint, created in `TownScene` whether or not the art loaded). `TownScene.create()` reads all of this at runtime; there's no per-building code path. To add/move/resize a building or trigger, change the `FOOTPRINTS`/`TRIGGERS` tables in `gen_town_map.py` and regenerate — and keep footprint sizes in lockstep with the sprite sizes in `assets/higgsfield-spec.md`, because `TownScene` renders building PNGs at native size, bottom-center-anchored, depth-sorted against the player (`depth = baseline y`).

**Camera runs at 2x zoom** (`pixelArt` + `roundPixels` in `main.js` keep it crisp), so the 800x600 canvas shows a 400x300 world slice; in-world text sizes are set at half the intended on-screen size (see `promptText`).

**Interactions resolve through one strict priority chain** (`TownScene.resolveInteraction`): building trigger > signpost > stray cat > flavor prop — exactly one prompt at a time. Flavor props are a data map (`FLAVOR_PROPS` in `src/config.js`, px rects + one-liner text); adding one is a single entry, no scene code. The cat, music/ambient/fountain loops, and every other audio path ride the same graceful-failure seam as the art (missing file = feature silently absent, never an error). Volume hierarchy is pinned by constants at the top of `TownScene.js`: music > ambient > footsteps > fountain.

**The `BUILDINGS` registry is the single source of truth for what each building links to** (`src/config.js`). Trigger-zone object *names* in the Tiled map must exactly match keys in `BUILDINGS`; `TownScene` looks up `BUILDINGS[obj.name]` with no other indirection. Adding a new building/portal means: add a `BUILDINGS` entry (name + url), add the sprite key to `BUILDING_SPRITE_KEYS` if it needs custom art, and add matching `Triggers`/`BuildingFootprints` objects in the Tiled map.

**Asset fallback seam (important, spans 3 files).** Real Higgsfield-generated art is optional at every point — a missing or 404'd sprite must never break the scene:
- `PreloadScene` tracks failed loads in `failedKeys` via the loader's `loaderror` event, then in `create()` generates flat-color placeholder textures for `player`/`signpost` if they failed. Buildings get no placeholder — `TownScene`'s footprint loop just checks `this.textures.exists(...)` and skips the overlay if absent, leaving the flat tile fill visible.
- Same pattern for audio: `TownScene` filters `FOOTSTEP_KEYS` down to whatever actually landed in `this.cache.audio`, and every `sound.add/play` call is try/catch-wrapped (autoplay policies can block audio even when the file loaded fine).
- When dropping in new art per `assets/higgsfield-spec.md`, no scene code needs to change — just add the file at the documented path.

**Player animation contract** (`src/anims.js` + `assets/higgsfield-spec.md`): the player spritesheet is a fixed 5-col x 4-row grid, row = direction (`down, left, right, up` — this exact order), col 0 = idle, cols 1-4 = walk cycle. `createPlayerAnimations` builds `idle-<dir>`/`walk-<dir>` keys straight from that layout; `animKeyFor(direction, moving)` in the same file is the only place scene code should pick an animation key. Swapping row order in a regenerated sprite sheet silently makes the character face the wrong way — no error, so double check against the spec's table when replacing art.

**Directory overlay** (`src/directory.js`) is a plain-DOM modal (not a Phaser scene) built lazily on first open, listing every entry in `BUILDINGS`. Reachable two ways: `E` near the in-map signpost, or `E` on the title screen as a walking-skip shortcut. Both call into the same `openDirectory`/`toggleDirectory` module-level singleton.

## Conventions to preserve

- No hardcoded URLs or building metadata inside scene files — always go through `BUILDINGS` in `src/config.js`.
- Keep the placeholder-fallback seam intact when touching `PreloadScene`/`TownScene`: any new asset type should fail silently and degrade gracefully, not throw.
- `assets/higgsfield-spec.md` is the generation spec and integration contract for art — update it if the sprite sheet layout, building footprint sizes, or file paths change.
- `assets/CREDITS.md` tracks asset licensing/attribution (Kenney tileset, OpenGameArt CC0 audio, Higgsfield-generated sprites) — update it when swapping or adding assets.
