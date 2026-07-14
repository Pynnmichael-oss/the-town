import { BUILDINGS } from '../config.js';
import { toggleDirectory, isDirectoryOpen } from '../directory.js';
import { animKeyFor } from '../anims.js';

const PLAYER_SPEED = 160;
const SIGNPOST_RADIUS = 48;
const FOOTSTEP_INTERVAL_MS = 260;
const FOOTSTEP_KEYS = ['footstep-1', 'footstep-2'];

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
    // so a missing file just leaves the ground tiles visible. Sprites are
    // anchored bottom-centered at native size (the PNG is generated to the
    // exact footprint size - never scale it here), and every footprint gets
    // a static collision body whether or not its art loaded, so buildings
    // are solid even in the fallback path.
    this.buildingSolids = [];
    map.getObjectLayer('BuildingFootprints').objects.forEach((obj) => {
      const solid = this.add.zone(
        obj.x + obj.width / 2,
        obj.y + obj.height / 2,
        obj.width,
        obj.height
      );
      this.physics.add.existing(solid, true);
      this.buildingSolids.push(solid);

      const textureKey = `building_${obj.name}`;
      if (!this.textures.exists(textureKey)) return;
      this.add
        .image(obj.x + obj.width / 2, obj.y + obj.height, textureKey)
        .setOrigin(0.5, 1)
        .setDepth(obj.y + obj.height);
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

    // Bottom-anchored so the point in the map marks where the post meets the
    // ground; depth keyed off that same point so the player walks in front
    // of/behind it correctly.
    this.signpost = this.add
      .image(signpostPoint.x, signpostPoint.y, 'signpost')
      .setOrigin(0.5, 1)
      .setDepth(signpostPoint.y);

    this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, 'player');
    this.player.setCollideWorldBounds(true);
    // Feet-sized body: the sprite frame is 32px but the walkable world is
    // 16px tiles, so a full-frame body snags on every doorway and tree.
    this.player.body.setSize(18, 14).setOffset(7, 18);

    this.facing = 'down';
    this.player.play(animKeyFor(this.facing, false));

    this.physics.add.collider(this.player, groundLayer);
    this.physics.add.collider(this.player, buildingsLayer);
    this.buildingSolids.forEach((solid) => this.physics.add.collider(this.player, solid));

    this.cameras.main.startFollow(this.player, true);
    // 2x zoom: pixelArt + roundPixels (set in main.js) keep it crisp.
    this.cameras.main.setZoom(2);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E');

    // 10px because the camera runs at 2x zoom - renders at an effective
    // 20px on screen; always on top of depth-sorted buildings.
    this.promptText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f0f0f0',
        backgroundColor: '#000000',
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5)
      .setScrollFactor(1)
      .setDepth(10000)
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

    this.footstepKeys = FOOTSTEP_KEYS.filter((key) => this.cache.audio.exists(key));
    this.stepIndex = 0;
    this.lastStepAt = 0;

    this.startAmbientSound();
  }

  // Autoplay policies (and headless/CI browsers) commonly block audio until
  // a user gesture or block it outright - none of that may ever throw, but
  // it must never stop the scene from loading or playing, so every audio
  // call in this scene is try/catch-wrapped and gated on the asset having
  // actually made it into the cache (see PreloadScene's failedKeys seam).
  startAmbientSound() {
    if (!this.cache.audio.exists('ambient-town')) return;
    const play = () => {
      try {
        this.sound.add('ambient-town', { loop: true, volume: 0.25 }).play();
      } catch (e) {
        // non-fatal: game continues silently without ambient sound
      }
    };
    if (this.sound.locked) {
      this.sound.once('unlocked', play);
    } else {
      play();
    }
  }

  playFootstep() {
    if (!this.footstepKeys.length) return;
    const key = this.footstepKeys[this.stepIndex % this.footstepKeys.length];
    this.stepIndex++;
    try {
      this.sound.play(key, { volume: 0.35 });
    } catch (e) {
      // non-fatal: a blocked/failed footstep must never interrupt movement
    }
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

    const moving = velocity.x !== 0 || velocity.y !== 0;
    if (moving) {
      this.facing =
        Math.abs(velocity.x) > Math.abs(velocity.y)
          ? velocity.x > 0
            ? 'right'
            : 'left'
          : velocity.y > 0
            ? 'down'
            : 'up';
    }

    velocity.normalize().scale(PLAYER_SPEED);
    this.player.setVelocity(velocity.x, velocity.y);

    const animKey = animKeyFor(this.facing, moving);
    if (this.player.anims.currentAnim?.key !== animKey) {
      this.player.play(animKey);
    }

    // Depth-sort against the bottom-anchored building sprites/signpost:
    // sprite feet vs. their baselines.
    this.player.setDepth(this.player.y + 16);

    if (moving) {
      if (this.time.now - this.lastStepAt >= FOOTSTEP_INTERVAL_MS) {
        this.lastStepAt = this.time.now;
        this.playFootstep();
      }
    } else {
      // Reset so the next walk cycle starts with an immediate step instead
      // of waiting out whatever was left of the interval from before.
      this.lastStepAt = 0;
    }

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
