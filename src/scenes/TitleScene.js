import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { openDirectory } from '../directory.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a0a');

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'THE TOWN', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#f0d878',
      })
      .setOrigin(0.5);

    this.promptText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'Press Start', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f0f0f0',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, '[E] Skip walking - open directory', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#888',
      })
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
  }
}
