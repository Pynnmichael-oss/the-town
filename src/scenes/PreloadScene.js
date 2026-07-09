import { TILE_SIZE } from '../config.js';

// Generates flat-color placeholder textures so the scaffold is playable before
// the real Kenney tileset / Higgsfield sprites are dropped into assets/.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create() {
    this.generateSquareTexture('player', 0x7fd1ff, TILE_SIZE);
    this.generateSquareTexture('ground', 0x2f5233, TILE_SIZE);
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
