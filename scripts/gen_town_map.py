#!/usr/bin/env python3
"""Generate assets/maps/town.json from the footprint contract in
assets/higgsfield-spec.md.

The ground is built as a material grid (grass base, tan paths carved
through it, district floors painted on top), then autotiled: every
material patch gets proper edge/corner tiles from the Kenney RPG Urban
tileset wherever it meets a different material, so there are no hard
90-degree color seams anywhere. Decor (trees, lamps, benches, fences,
props) goes on the Buildings layer with per-tile collision.

Building collision is NOT tile-based: TownScene creates a static physics
zone per BuildingFootprints object, so footprints here only need to match
the sprite sizes in the spec (tiles * 16px, exact).

Run: python3 scripts/gen_town_map.py   (rewrites assets/maps/town.json)
"""
import json
import random
from pathlib import Path

random.seed(1918)

W, H, T = 80, 60, 16

# ---------------------------------------------------------------- materials
TAN, GRASS, PAVE, PLAZA, WATER, ASPHALT = range(6)

# 3x3 edge sets: [NW N NE / W C E / SW S SE] (Kenney RPG Urban indices)
EDGE_SETS = {
    GRASS: [0, 1, 2, 27, 28, 29, 54, 55, 56],
    PAVE:  [8, 9, 10, 35, 36, 37, 62, 63, 64],
    PLAZA: [89, 90, 91, 116, 117, 118, 143, 144, 145],
    WATER: [170, 171, 172, 197, 198, 199, 224, 225, 226],
}
TAN_C = 109
ASPHALT_PLAIN = [439, 440, 441, 466, 467, 468]
ASPHALT_CORNERS = {'nw': 437, 'ne': 438, 'sw': 464, 'se': 465}

# ------------------------------------------------------------------- decor
TREES_GREEN = [(232, 259), (233, 260), (237, 264)]   # (top, bottom)
TREES_AUTUMN = [(313, 340), (314, 341), (318, 345)]
FOREST = [[235, 236], [262, 263], [289, 290]]        # 2x3 dense clump
BUSHES = [238, 292, 265, 346]
SPROUT = 196
HEDGE = [328, 329, 330]
CHAIN, CHAIN_POST = [355, 356, 357], 358
WFENCE_V = 385
LAMP = (164, 191)
BENCH = 223
HYDRANT, TRASH, BARREL, MAILBOX, CRATE, COAL, BARRICADE = 251, 253, 280, 305, 381, 254, 221

COLLIDING_DECOR = (
    {t for pair in TREES_GREEN + TREES_AUTUMN for t in pair}
    | {t for row in FOREST for t in row}
    | set(BUSHES) | set(HEDGE) | set(CHAIN) | {CHAIN_POST, WFENCE_V}
    | set(LAMP) | {BENCH, HYDRANT, TRASH, BARREL, MAILBOX, CRATE, COAL, BARRICADE}
)
COLLIDING_GROUND = set(EDGE_SETS[WATER])

# ---------------------------------------------------------------- layout
mat = [[GRASS] * W for _ in range(H)]

def paint(m, x0, y0, x1, y1):
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            mat[y][x] = m

# tan paths carved through the grass (3 tiles wide)
paint(TAN, 39, 13, 41, 30)    # park path: pavilion -> plaza
paint(TAN, 7, 31, 60, 33)     # main street: commercial -> plaza -> quay
paint(TAN, 39, 37, 41, 42)    # plaza -> industrial yard

# district floors
paint(PAVE, 7, 23, 31, 31)    # commercial sidewalk lot
paint(PLAZA, 34, 27, 46, 37)  # town square
paint(PLAZA, 30, 42, 52, 54)  # industrial yard (concrete)
paint(ASPHALT, 32, 47, 43, 53)  # poured asphalt pad under/below the silo
paint(PAVE, 58, 22, 65, 38)   # waterfront quay
paint(WATER, 66, 10, 79, 50)  # the water itself (runs off the east edge)
paint(WATER, 39, 30, 40, 31)  # town-square fountain basin (2x2, self-edging)

# footprints (tiles): must match assets/higgsfield-spec.md exactly
FOOTPRINTS = {
    'touchgrass_pavilion': (37, 8, 43, 12),
    'summer_nicole_films': (9, 24, 14, 28),
    'all_hands_detailing': (16, 24, 22, 28),
    'fourwinds': (24, 24, 29, 28),
    'twin_silo': (33, 43, 42, 48),
    'roberts_fuel': (44, 44, 51, 48),
    'shortsleeve_dock': (62, 26, 69, 31),
}
TRIGGERS = {  # name -> (x0, y0, x1, y1) in tiles
    'touchgrass': (39, 13, 41, 14),
    'summer_nicole_films': (10, 29, 12, 30),
    'all_hands_detailing': (18, 29, 20, 30),
    'fourwinds': (25, 29, 27, 30),
    'terminal_dashboard': (34, 49, 36, 50),   # twin silo, left door
    'blend_planner': (39, 49, 41, 50),        # twin silo, right door
    'roberts_fuel': (48, 49, 50, 50),
    'shortsleeve': (60, 27, 61, 30),          # dock walk-on planks, west edge
}
SPAWN = (648, 568)      # px, plaza south of the fountain
SIGNPOST = (680, 560)   # px, next to spawn — first thing a visitor meets
FOUNTAIN = (640, 496)   # px, center of the 2x2 basin (anchors particles/SFX)

# --------------------------------------------------------------- autotile
def material_at(x, y, m):
    """Off-map continues the same material so borders run clean off-screen."""
    if 0 <= x < W and 0 <= y < H:
        return mat[y][x]
    return m

ground = [[TAN_C] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        m = mat[y][x]
        if m == TAN:
            ground[y][x] = TAN_C
            continue
        if m == ASPHALT:
            n = material_at(x, y - 1, m) == ASPHALT
            s = material_at(x, y + 1, m) == ASPHALT
            w_ = material_at(x - 1, y, m) == ASPHALT
            e = material_at(x + 1, y, m) == ASPHALT
            if not n and not w_: ground[y][x] = ASPHALT_CORNERS['nw']
            elif not n and not e: ground[y][x] = ASPHALT_CORNERS['ne']
            elif not s and not w_: ground[y][x] = ASPHALT_CORNERS['sw']
            elif not s and not e: ground[y][x] = ASPHALT_CORNERS['se']
            else: ground[y][x] = random.choice(ASPHALT_PLAIN)
            continue
        nw_, n_, ne_, w_, c_, e_, sw_, s_, se_ = EDGE_SETS[m]
        has_n = material_at(x, y - 1, m) == m
        has_s = material_at(x, y + 1, m) == m
        has_w = material_at(x - 1, y, m) == m
        has_e = material_at(x + 1, y, m) == m
        if not has_n and not has_w: tile = nw_
        elif not has_n and not has_e: tile = ne_
        elif not has_s and not has_w: tile = sw_
        elif not has_s and not has_e: tile = se_
        elif not has_n: tile = n_
        elif not has_s: tile = s_
        elif not has_w: tile = w_
        elif not has_e: tile = e_
        else: tile = c_
        ground[y][x] = tile

# ------------------------------------------------------------------ decor
decor = [[0] * W for _ in range(H)]

def cell_free(x, y):
    return 0 <= x < W and 0 <= y < H and decor[y][x] == 0

def on_grass(x, y):
    return 0 <= x < W and 0 <= y < H and mat[y][x] == GRASS

def near_footprint(x, y):
    for (fx0, fy0, fx1, fy1) in FOOTPRINTS.values():
        if fx0 - 1 <= x <= fx1 + 1 and fy0 - 1 <= y <= fy1 + 1:
            return True
    return False

def put(x, y, tid):
    if cell_free(x, y):
        decor[y][x] = tid
        return True
    return False

def put_tree(x, y, kind):
    """(x, y) is the trunk/bottom tile; top goes one tile above."""
    top, bottom = kind
    if (on_grass(x, y) and on_grass(x, y - 1) and cell_free(x, y)
            and cell_free(x, y - 1) and not near_footprint(x, y)
            and not near_footprint(x, y - 1)):
        decor[y][x] = bottom
        decor[y - 1][x] = top
        return True
    return False

def put_forest(x, y):
    """2-wide x 3-tall dense clump, (x, y) = top-left."""
    cells = [(x + dx, y + dy) for dy in range(3) for dx in range(2)]
    if all(on_grass(cx, cy) and cell_free(cx, cy) and not near_footprint(cx, cy)
           for cx, cy in cells):
        for dy in range(3):
            for dx in range(2):
                decor[y + dy][x + dx] = FOREST[dy][dx]
        return True
    return False

# dense clumps framing the park and the map corners
for fx, fy in [(30, 2), (45, 2), (55, 3), (2, 2), (6, 6), (2, 14),
               (70, 2), (75, 4), (3, 44), (5, 52), (73, 53), (56, 55)]:
    put_forest(fx, fy)

# park trees (clustered, jittered — not grid-aligned rows)
park_spots = [(33, 7), (35, 11), (46, 7), (48, 11), (34, 17), (46, 17),
              (37, 20), (44, 20), (31, 13), (50, 14), (53, 9), (28, 10),
              (36, 14), (45, 14), (52, 18), (29, 18)]
for i, (tx, ty) in enumerate(park_spots):
    jx = tx + random.choice((-1, 0, 0, 1))
    put_tree(jx, ty, TREES_GREEN[i % len(TREES_GREEN)])

# NE corner above the water
for tx, ty in [(68, 5), (72, 7), (76, 4), (69, 2)]:
    put_tree(tx, ty, TREES_GREEN[random.randrange(len(TREES_GREEN))])

# SW + SE lawns get the autumn mix
for i, (tx, ty) in enumerate([(6, 38), (10, 42), (15, 40), (20, 45), (8, 50),
                              (14, 52), (22, 50), (25, 44), (18, 57), (12, 47),
                              (24, 56), (4, 47), (56, 58), (60, 56), (65, 54),
                              (70, 55), (75, 58), (62, 58)]):
    kinds = TREES_AUTUMN if i % 3 != 2 else TREES_GREEN
    put_tree(tx, ty, kinds[random.randrange(len(kinds))])

# bushes + sprouts scattered over every lawn (ground-texture variation)
placed = 0
while placed < 160:
    x, y = random.randrange(W), random.randrange(H)
    if on_grass(x, y) and cell_free(x, y) and not near_footprint(x, y):
        decor[y][x] = SPROUT if placed % 3 else random.choice(BUSHES)
        placed += 1

# plaza dressing: lamps at the corners, benches by the fountain, street furniture
for lx, ly in [(35, 28), (45, 28), (35, 36), (45, 36)]:
    put(lx, ly - 1, LAMP[0]); put(lx, ly, LAMP[1])
put(37, 31, BENCH); put(43, 31, BENCH)
put(34, 34, HYDRANT); put(46, 34, TRASH)

# park path lamps + benches by the pavilion
put(38, 20, LAMP[0]); put(38, 21, LAMP[1])
put(42, 24, LAMP[0]); put(42, 25, LAMP[1])
put(38, 16, BENCH); put(42, 16, BENCH)

# commercial strip: hedges behind, furniture between storefronts, street lamps
for hx in list(range(8, 14)) + list(range(24, 30)):
    put(hx, 22, HEDGE[hx % 3])
put(15, 28, MAILBOX); put(23, 28, HYDRANT); put(30, 28, TRASH)
for lx in (14, 22, 30):
    put(lx, 29, LAMP[0]); put(lx, 30, LAMP[1])

# main-street lamps (south side, clear of every trigger strip)
for lx in (12, 20, 28, 48, 54):
    put(lx, 34, LAMP[0]); put(lx, 35, LAMP[1])

# industrial yard: chain-link fence with a gate aligned to the south path
for fx in list(range(30, 38)) + list(range(43, 53)):
    put(fx, 42, CHAIN_POST if fx in (30, 37, 43, 52) else CHAIN[fx % 3])
put(31, 45, CRATE); put(31, 46, CRATE); put(43, 46, BARREL)
put(51, 52, COAL); put(50, 53, COAL); put(33, 53, BARRICADE)
put(30, 47, LAMP[0]); put(30, 48, LAMP[1])
put(52, 47, LAMP[0]); put(52, 48, LAMP[1])

# quay: lamps, crates, wooden rail posts along the waterline
for fy in (23, 24, 33, 34):
    put(65, fy, WFENCE_V)
put(59, 22, LAMP[0]); put(59, 23, LAMP[1])
put(59, 35, LAMP[0]); put(59, 36, LAMP[1])
put(60, 24, CRATE); put(61, 35, CRATE)

# ------------------------------------------------------------------ emit
def tile_layer(lid, name, grid, use_gid):
    return {
        'id': lid, 'name': name, 'type': 'tilelayer', 'visible': True,
        'opacity': 1, 'x': 0, 'y': 0, 'width': W, 'height': H,
        'data': [c + 1 if use_gid or c else 0 for row in grid for c in row],
    }

def obj(oid, name, x, y, w=0, h=0, point=False):
    o = {'id': oid, 'name': name, 'type': '', 'x': x, 'y': y,
         'width': w, 'height': h, 'visible': True, 'rotation': 0,
         'properties': []}
    if point:
        o['point'] = True
    return o

oid = iter(range(1, 200))
objects_layer = {
    'id': 3, 'name': 'Objects', 'type': 'objectgroup', 'visible': True,
    'opacity': 1, 'x': 0, 'y': 0, 'objects': [
        obj(next(oid), 'PlayerSpawn', *SPAWN, point=True),
        obj(next(oid), 'Signpost', *SIGNPOST, point=True),
        obj(next(oid), 'Fountain', *FOUNTAIN, point=True),
    ],
}
triggers_layer = {
    'id': 4, 'name': 'Triggers', 'type': 'objectgroup', 'visible': True,
    'opacity': 1, 'x': 0, 'y': 0, 'objects': [
        obj(next(oid), name, x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T)
        for name, (x0, y0, x1, y1) in TRIGGERS.items()
    ],
}
footprints_layer = {
    'id': 5, 'name': 'BuildingFootprints', 'type': 'objectgroup', 'visible': True,
    'opacity': 1, 'x': 0, 'y': 0, 'objects': [
        obj(next(oid), name, x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T)
        for name, (x0, y0, x1, y1) in FOOTPRINTS.items()
    ],
}

colliding = sorted(COLLIDING_GROUND | COLLIDING_DECOR)
tileset = {
    'columns': 27, 'firstgid': 1, 'image': 'rpg-urban-tileset.png',
    'imageheight': 305, 'imagewidth': 458, 'margin': 0, 'name': 'rpg-urban',
    'spacing': 1, 'tilecount': 486, 'tileheight': 16, 'tilewidth': 16,
    'tiles': [
        {'id': tid, 'properties': [
            {'name': 'collides', 'type': 'bool', 'value': True}]}
        for tid in colliding
    ],
}

town = {
    'compressionlevel': -1, 'height': H, 'width': W, 'infinite': False,
    'nextlayerid': 6, 'nextobjectid': next(oid), 'orientation': 'orthogonal',
    'renderorder': 'right-down', 'tiledversion': '1.10.2',
    'tileheight': T, 'tilewidth': T, 'type': 'map', 'version': '1.10',
    'layers': [
        tile_layer(1, 'Ground', ground, use_gid=True),
        tile_layer(2, 'Buildings', decor, use_gid=False),
        objects_layer, triggers_layer, footprints_layer,
    ],
    'tilesets': [tileset],
}

out = Path(__file__).resolve().parent.parent / 'assets' / 'maps' / 'town.json'
out.write_text(json.dumps(town))
print(f'wrote {out} ({out.stat().st_size} bytes)')
