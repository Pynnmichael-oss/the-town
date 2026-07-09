import { BUILDINGS } from '../config.js';
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

    // Real building art (assets/higgsfield-spec.md) drops in as
    // assets/sprites/buildings/<name>.png with no scene-code change: this
    // only adds an overlay when PreloadScene actually loaded that texture,
    // so a missing file just leaves the flat-color tile fill underneath
    // showing through unchanged - collision stays on buildingsLayer either way.
    map.getObjectLayer('BuildingFootprints').objects.forEach((obj) => {
      const textureKey = `building_${obj.name}`;
      if (!this.textures.exists(textureKey)) return;
      const image = this.add.image(obj.x + obj.width / 2, obj.y + obj.height / 2, textureKey);
      image.setDisplaySize(obj.width, obj.height);
    });

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    const spawnPoint = map.findObject('Objects', (obj) => obj.name === 'PlayerSpawn');
    const signpostPoint = map.findObject('Objects', (obj) => obj.name === 'Signpost');

    // Trigger zone name must match a key in BUILDINGS (src/config.js) - no URLs
    // are hardcoded here, they're read straight from that map.
    this.triggerZones = map.getObjectLayer('Triggers').objects.map((obj) => ({
      name: obj.name,
      rect: new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height),
      building: BUILDINGS[obj.name],
    }));

    this.signpost = this.add.image(signpostPoint.x, signpostPoint.y, 'signpost');

    this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, 'player');
    this.player.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, groundLayer);
    this.physics.add.collider(this.player, buildingsLayer);

    this.cameras.main.startFollow(this.player, true);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E');

    this.promptText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f0f0f0',
        backgroundColor: '#000000',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(1)
      .setVisible(false);

    this.activeInteraction = null;

    this.wasd.E.on('down', () => {
      if (!this.activeInteraction) return;
      if (this.activeInteraction.type === 'building') {
        window.open(this.activeInteraction.url, '_blank');
      } else if (this.activeInteraction.type === 'signpost') {
        toggleDirectory();
      }
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

    this.activeInteraction = this.resolveInteraction();

    this.promptText.setVisible(!!this.activeInteraction);
    if (this.activeInteraction) {
      this.promptText.setText(this.activeInteraction.label);
      this.promptText.setPosition(this.player.x, this.player.y - 32);
    }
  }

  // Building zones take priority over the signpost's radius so only one
  // prompt is ever shown, even if a player could stand near both at once.
  resolveInteraction() {
    const zone = this.triggerZones.find((z) =>
      Phaser.Geom.Rectangle.Contains(z.rect, this.player.x, this.player.y)
    );
    if (zone) {
      return {
        type: 'building',
        label: `Press E to visit ${zone.building.name}`,
        url: zone.building.url,
      };
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.signpost.x,
      this.signpost.y
    );
    if (distance <= SIGNPOST_RADIUS) {
      return { type: 'signpost', label: 'Press E for Town Directory' };
    }

    return null;
  }
}
