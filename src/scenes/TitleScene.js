import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { openDirectory } from '../directory.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const isTouch = this.sys.game.device.input.touch;

    this.cameras.main.setBackgroundColor('#0a0a0a');

    this.createStarfield();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'THE TOWN', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#f0d878',
      })
      .setOrigin(0.5);

    this.promptText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, isTouch ? 'Tap to Start' : 'Press Start', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f0f0f0',
      })
      .setOrigin(0.5);

    const hintText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 70,
        isTouch ? 'Skip walking - tap here for directory' : '[E] Skip walking - open directory',
        {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#888',
          padding: { x: 16, y: 14 },
        }
      )
      .setOrigin(0.5);

    this.tweens.add({
      targets: this.promptText,
      alpha: 0,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    const startKeys = this.input.keyboard.addKeys('SPACE,ENTER');
    Object.values(startKeys).forEach((key) =>
      key.on('down', () => this.scene.start('Town'))
    );

    this.input.keyboard.addKey('E').on('down', () => openDirectory());

    // Tap/click anywhere starts the town; the hint is its own tap target and
    // stops propagation so opening the directory doesn't also start the game.
    // The first tap doubles as the audio-unlock gesture (Phaser's sound
    // manager listens for it; TownScene.startAudio waits on 'unlocked').
    hintText.setInteractive({ useHandCursor: true });
    hintText.on('pointerup', (pointer, localX, localY, event) => {
      event.stopPropagation();
      openDirectory();
    });
    this.input.on('pointerup', () => this.scene.start('Town'));
  }

  // Idle background flicker while sitting on the title screen - plain
  // Graphics circles + alpha tweens, no sprite/atlas dependency so it never
  // interacts with the art-loading seam in PreloadScene.
  createStarfield() {
    const STAR_COUNT = 45;
    for (let i = 0; i < STAR_COUNT; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(1, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.3, 0.9)
      );
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.05, 0.2),
        duration: Phaser.Math.Between(800, 2200),
        delay: Phaser.Math.Between(0, 2000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
