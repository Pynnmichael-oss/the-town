import { TILE_SIZE } from '../config.js';
import { toggleDirectory, isDirectoryOpen } from '../directory.js';

const WORLD_TILES_X = 40;
const WORLD_TILES_Y = 30;
const PLAYER_SPEED = 160;
const SIGNPOST_RADIUS = 48;

export class TownScene extends Phaser.Scene {
  constructor() {
    super('Town');
  }

  create() {
    const worldWidth = WORLD_TILES_X * TILE_SIZE;
    const worldHeight = WORLD_TILES_Y * TILE_SIZE;

    // Placeholder ground until the Tiled map (build step 1) replaces this.
    for (let x = 0; x < WORLD_TILES_X; x++) {
      for (let y = 0; y < WORLD_TILES_Y; y++) {
        this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'ground').setOrigin(0);
      }
    }

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.signpost = this.add.image(worldWidth / 2, worldHeight / 2, 'signpost');

    this.player = this.physics.add.sprite(worldWidth / 2, worldHeight / 2 + 100, 'player');
    this.player.setCollideWorldBounds(true);

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E');

    this.promptText = this.add
      .text(0, 0, 'Press E for Town Directory', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f0f0f0',
        backgroundColor: '#000000',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(1)
      .setVisible(false);

    this.wasd.E.on('down', () => {
      if (this.nearSignpost) toggleDirectory();
    });
  }

  update() {
    if (isDirectoryOpen()) {
      this.player.setVelocity(0);
      return;
    }

    const velocity = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown || this.wasd.A.isDown) velocity.x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) velocity.x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) velocity.y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) velocity.y += 1;

    velocity.normalize().scale(PLAYER_SPEED);
    this.player.setVelocity(velocity.x, velocity.y);

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.signpost.x,
      this.signpost.y
    );
    this.nearSignpost = distance <= SIGNPOST_RADIUS;
    this.promptText.setVisible(this.nearSignpost);
    if (this.nearSignpost) {
      this.promptText.setPosition(this.player.x, this.player.y - 32);
    }
  }
}
