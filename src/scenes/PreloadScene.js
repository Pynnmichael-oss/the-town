import { TILE_SIZE } from '../config.js';

// Loads the real Tiled map/tileset and generates flat-color placeholder
// textures for the player and signpost until Higgsfield sprites replace them.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    this.load.image('rpg-urban-tileset', 'assets/tilesets/rpg-urban-tileset.png');
    this.load.tilemapTiledJSON('town', 'assets/maps/town.json');
  }

  create() {
    this.generateSquareTexture('player', 0x7fd1ff, TILE_SIZE);
    this.generateSquareTexture('signpost', 0xf0d878, TILE_SIZE);

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
