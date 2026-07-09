import { TILE_SIZE, BUILDING_SPRITE_KEYS } from '../config.js';

// Real sprites (see assets/higgsfield-spec.md) drop into assets/sprites/ with
// no code change: this scene requests each expected file, and anything that
// 404s just falls back to a placeholder instead of failing the load. Player
// and signpost get a generated flat-color placeholder texture. Buildings need
// no placeholder texture of their own - TownScene only adds a sprite overlay
// when the real file loaded, so a missing building PNG just leaves the
// existing flat-color tile fill in the map visible, unchanged.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    this.load.image('rpg-urban-tileset', 'assets/tilesets/rpg-urban-tileset.png');
    this.load.tilemapTiledJSON('town', 'assets/maps/town.json');

    this.failedKeys = new Set();
    this.load.on('loaderror', (file) => this.failedKeys.add(file.key));

    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
    this.load.image('signpost', 'assets/sprites/signpost.png');

    BUILDING_SPRITE_KEYS.forEach((key) => {
      this.load.image(`building_${key}`, `assets/sprites/buildings/${key}.png`);
    });
  }

  create() {
    if (this.failedKeys.has('player')) {
      this.generateSquareTexture('player', 0x7fd1ff, TILE_SIZE);
    }
    if (this.failedKeys.has('signpost')) {
      this.generateSquareTexture('signpost', 0xf0d878, TILE_SIZE);
    }

    this.scene.start('Title');
  }

  generateSquareTexture(key, color, size) {
    const g = this.make.graphics({ add: false });
    g.fillStyle(color, 1);
    g.fillRect(0, 0, size, size);
    g.lineStyle(2, 0x000000, 0.3);
    g.strokeRect(0, 0, size, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
