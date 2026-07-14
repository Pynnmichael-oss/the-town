import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { TownScene } from './scenes/TownScene.js';

// Exposed on window so headless regression tests (scripts/) can reach the
// running scenes; the game itself never reads it back.
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, PreloadScene, TitleScene, TownScene],
});
