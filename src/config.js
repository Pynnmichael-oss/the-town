export const TILE_SIZE = 32;

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// Building footprint sprite keys - must match the BuildingFootprints object
// names in assets/maps/town.json (see gen_town_map.py and
// assets/higgsfield-spec.md). PreloadScene requests
// assets/sprites/buildings/<key>.png for each; TownScene reads the same
// names straight off the map's BuildingFootprints layer, so this list only
// needs to stay in sync with what PreloadScene requests.
export const BUILDING_SPRITE_KEYS = [
  'touchgrass_pavilion',
  'shortsleeve_dock',
  'twin_silo',
  'roberts_fuel',
  'summer_nicole_films',
  'all_hands_detailing',
  'fourwinds',
];

// Building id -> { name, url }. Matches the trigger-zone object names placed in the Tiled map.
export const BUILDINGS = {
  touchgrass: {
    name: 'TouchGrass',
    url: 'https://pynnmichael-oss.github.io/TouchGrass/',
  },
  shortsleeve: {
    name: 'Shortsleeve Travel',
    url: 'https://pynnmichael-oss.github.io/short-sleeve-travel/',
  },
  terminal_dashboard: {
    name: 'Terminal Dashboard',
    url: 'https://pynnmichael-oss.github.io/Terminal-Dashboard/',
  },
  blend_planner: {
    name: 'Blend Planner',
    url: 'https://pynnmichael-oss.github.io/blend-planner/',
  },
  roberts_fuel: {
    name: 'Roberts Fuel Services',
    url: 'https://pynnmichael-oss.github.io/roberts-fuel-services/',
  },
  summer_nicole_films: {
    name: 'Summer Nicole Films',
    url: 'https://pynnmichael-oss.github.io/summer-nicole-films/',
  },
  all_hands_detailing: {
    name: 'All Hands Detailing',
    url: 'https://pynnmichael-oss.github.io/all-hands-detailing-site/',
  },
  fourwinds: {
    name: 'FourWinds',
    url: 'https://fourwindstulsa.com',
  },
};
