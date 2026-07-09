import { TILE_SIZE, BUILDING_SPRITE_KEYS } from '../config.js';
import { createPlayerAnimations } from '../anims.js';

const SHEET_COLS = 5;
const SHEET_ROWS = 4;

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
      this.generateCharacterSheetTexture('player');
    }
    if (this.failedKeys.has('signpost')) {
      this.generateSquareTexture('signpost', 0xf0d878, TILE_SIZE);
    }

    // Registered here so both the real spritesheet and the placeholder sheet
    // (below) work identically - animation setup never depends on whether
    // the real file loaded, only on 'player' having 20 valid frames.
    createPlayerAnimations(this);

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

  // Same 5x4 grid as the real character sheet (assets/higgsfield-spec.md),
  // every cell an identical flat square - looks static, but slices into 20
  // real named frames so walk/idle animations have something valid to play.
  generateCharacterSheetTexture(key) {
    const frameWidth = TILE_SIZE;
    const frameHeight = TILE_SIZE;
    const sheetWidth = frameWidth * SHEET_COLS;
    const sheetHeight = frameHeight * SHEET_ROWS;

    const g = this.make.graphics({ add: false });
    g.fillStyle(0x7fd1ff, 1);
    g.fillRect(0, 0, sheetWidth, sheetHeight);
    g.lineStyle(2, 0x000000, 0.3);
    for (let row = 0; row < SHEET_ROWS; row++) {
      for (let col = 0; col < SHEET_COLS; col++) {
        g.strokeRect(col * frameWidth, row * frameHeight, frameWidth, frameHeight);
      }
    }
    g.generateTexture(key, sheetWidth, sheetHeight);
    g.destroy();

    const texture = this.textures.get(key);
    let frameIndex = 0;
    for (let row = 0; row < SHEET_ROWS; row++) {
      for (let col = 0; col < SHEET_COLS; col++) {
        texture.add(frameIndex, 0, col * frameWidth, row * frameHeight, frameWidth, frameHeight);
        frameIndex++;
      }
    }
  }
}
