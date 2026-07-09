import { toggleDirectory, isDirectoryOpen } from '../directory.js';

const PLAYER_SPEED = 160;
const SIGNPOST_RADIUS = 48;

export class TownScene extends Phaser.Scene {
  constructor() {
    super('Town');
  }

  create() {
    const map = this.make.tilemap({ key: 'town' });
    const tileset = map.addTilesetImage('rpg-urban', 'rpg-urban-tileset');
    const groundLayer = map.createLayer('Ground', tileset, 0, 0);
    const buildingsLayer = map.createLayer('Buildings', tileset, 0, 0);

    groundLayer.setCollisionByProperty({ collides: true });
    buildingsLayer.setCollisionByProperty({ collides: true });

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    const spawnPoint = map.findObject('Objects', (obj) => obj.name === 'PlayerSpawn');
    const signpostPoint = map.findObject('Objects', (obj) => obj.name === 'Signpost');

    this.signpost = this.add.image(signpostPoint.x, signpostPoint.y, 'signpost');

    this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, 'player');
    this.player.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, groundLayer);
    this.physics.add.collider(this.player, buildingsLayer);

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
