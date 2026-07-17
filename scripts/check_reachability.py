#!/usr/bin/env python3
"""Reachability guard for the generated map.

Flood-fills the walkable tiles of assets/maps/town.json from PlayerSpawn and
fails (exit 1, unreachable triggers listed) if any trigger zone can't be
walked to. Reads the emitted JSON — not the generator's in-memory tables — so
it validates exactly what the game will load: colliding ground/decor tiles
(via the tileset's `collides` properties) plus every BuildingFootprints rect
(TownScene turns those into static physics bodies whether or not art loaded).

Movement model (matches the player's real ~18x14px Arcade body, TownScene.js
`body.setSize(18, 14)` on 16px tiles):
  - East/west steps only need both tiles open — the body's 14px height fits
    inside a single 16px row with no extra vertical clearance required.
  - North/south steps (crossing a row boundary, e.g. a gate or doorway) need
    a 2-tile-wide window at BOTH rows — the 18px body is wider than one
    16px tile, so a 1-tile-wide gap is impassable even though the tile
    itself is "open ground".
A naive isotropic 2x2-window model (requiring 2-row clearance even for pure
sideways movement) produces false negatives: it wrongly blocks walking
sideways along a wide-open plaza row just because the row above happens to
be narrow, which is exactly the shape of the industrial-yard gate (a narrow
approach path opening onto a wide yard behind a building).

Two passes, both must hold:
1. any-terrain: every trigger walkable from spawn at all;
2. paved-network: every trigger walkable from spawn WITHOUT stepping on
   grass — i.e. the designed path/plaza/pavement routes actually connect.
   This is the pass that catches a gate/door that dead-ends into a building
   footprint (the original industrial-yard bug): the yard stayed technically
   enterable across open lawn, so pass 1 alone was blind to it.

Run standalone (python3 scripts/check_reachability.py) or let
gen_town_map.py invoke it automatically after each regeneration.
"""
import json
import sys
from collections import deque
from pathlib import Path

TILE = 16

# Kenney RPG Urban grass tile ids (the GRASS 3x3 edge set in gen_town_map.py)
GRASS_TILE_IDS = {0, 1, 2, 27, 28, 29, 54, 55, 56}


def unreachable_triggers(map_path, paved_only=False):
    """Returns the list of trigger names with no walkable path from spawn.

    paved_only=True additionally forbids grass tiles, restricting the search
    to the designed path/plaza/pavement network.
    """
    town = json.loads(Path(map_path).read_text())
    W, H = town['width'], town['height']
    layers = {layer['name']: layer for layer in town['layers']}

    ts = town['tilesets'][0]
    colliding_gids = {
        t['id'] + ts['firstgid'] for t in ts.get('tiles', [])
        if any(p['name'] == 'collides' and p['value'] for p in t.get('properties', []))
    }
    grass_gids = {tid + ts['firstgid'] for tid in GRASS_TILE_IDS}

    blocked = [[False] * W for _ in range(H)]
    for lname in ('Ground', 'Buildings'):
        for i, gid in enumerate(layers[lname]['data']):
            if gid in colliding_gids or (paved_only and lname == 'Ground' and gid in grass_gids):
                blocked[i // W][i % W] = True
    for o in layers['BuildingFootprints']['objects']:
        x0, y0 = int(o['x']) // TILE, int(o['y']) // TILE
        x1 = (int(o['x'] + o['width']) - 1) // TILE
        y1 = (int(o['y'] + o['height']) - 1) // TILE
        for y in range(max(0, y0), min(H, y1 + 1)):
            for x in range(max(0, x0), min(W, x1 + 1)):
                blocked[y][x] = True

    def open_tile(x, y):
        return 0 <= x < W and 0 <= y < H and not blocked[y][x]

    def can_step(x1, y1, x2, y2):
        if not open_tile(x1, y1) or not open_tile(x2, y2):
            return False
        if y1 == y2:
            # sideways: the 14px body fits inside one 16px row, no extra
            # vertical clearance needed beyond the two tiles themselves.
            return True
        # crossing a row boundary: need a 2-tile-wide window (18px body vs
        # 16px tile) clear at both the row left behind and the row entered.
        y_lo, y_hi = sorted((y1, y2))
        for dx in (-1, 0):
            xs = (x1 + dx, x1 + dx + 1)
            if all(open_tile(xx, y_lo) and open_tile(xx, y_hi) for xx in xs):
                return True
        return False

    spawn = next(o for o in layers['Objects']['objects'] if o['name'] == 'PlayerSpawn')
    start = (int(spawn['x']) // TILE, int(spawn['y']) // TILE)
    if not open_tile(*start):
        return ['<PlayerSpawn itself is blocked>']

    seen = {start}
    queue = deque([start])
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) not in seen and can_step(x, y, nx, ny):
                seen.add((nx, ny))
                queue.append((nx, ny))

    bad = []
    for o in layers['Triggers']['objects']:
        x0, y0 = int(o['x']) // TILE, int(o['y']) // TILE
        x1 = (int(o['x'] + o['width']) - 1) // TILE
        y1 = (int(o['y'] + o['height']) - 1) // TILE
        if not any((x, y) in seen for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)):
            bad.append(o['name'])
    return bad


def main():
    map_path = Path(__file__).resolve().parent.parent / 'assets' / 'maps' / 'town.json'
    failed = False
    for paved_only, label in ((False, 'any terrain'), (True, 'paved network')):
        bad = unreachable_triggers(map_path, paved_only=paved_only)
        if bad:
            print(f'REACHABILITY FAIL ({label}): unreachable triggers: {", ".join(bad)}')
            failed = True
        else:
            print(f'reachability OK ({label}): every trigger walkable from spawn')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
