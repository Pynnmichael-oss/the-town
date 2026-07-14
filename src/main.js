import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { TownScene } from './scenes/TownScene.js';

// Touch-capable devices get bigger tap targets in the DOM directory overlay
// (index.html styles keyed off body.touch) — a class rather than a
// pointer:coarse media query so game code and CSS share one detection.
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  document.body.classList.add('touch');
}

// Exposed on window so headless regression tests (scripts/) can reach the
// running scenes; the game itself never reads it back.
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  pixelArt: true,
  roundPixels: true,
  disableContextMenu: true,
  // FIT keeps the 800x600 world letterboxed and aspect-correct on phones in
  // either orientation; the CSS image-rendering: pixelated in index.html
  // keeps the scaled canvas crisp.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  // 3 pointers so a second finger can tap the prompt while the first one is
  // held down steering (movement itself only ever binds to the first touch).
  input: { activePointers: 3 },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, PreloadScene, TitleScene, TownScene],
});
