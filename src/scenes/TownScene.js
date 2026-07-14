import { BUILDINGS, FLAVOR_PROPS } from '../config.js';
import { toggleDirectory, isDirectoryOpen } from '../directory.js';
import { animKeyFor } from '../anims.js';

const PLAYER_SPEED = 160;
const SIGNPOST_RADIUS = 48;
const FOOTSTEP_INTERVAL_MS = 260;
const FOOTSTEP_KEYS = ['footstep-1', 'footstep-2'];

// Volume hierarchy (loudest to quietest): music > ambient > footsteps >
// fountain. Footsteps are felt-not-heard: ~18% of the old 0.35, with
// per-step pitch/volume jitter so the two alternating samples don't
// sound mechanical.
const MUSIC_VOLUME = 0.16;
const AMBIENT_VOLUME = 0.07;
const FOOTSTEP_VOLUME = 0.06;
const FOUNTAIN_VOLUME = 0.05;
const FOUNTAIN_SFX_NEAR = 32; // px: full (tiny) volume inside this
const FOUNTAIN_SFX_FAR = 112; // px: silent beyond this (~3 tiles of fade)

const CAT_RADIUS = 40;
const CAT_SPEED = 28;
// The cat's patrol is bounded to the walkable ring of the town square —
// waypoints stay inside this px rect, and physics colliders (fountain
// water, benches, lamps) handle anything inside it.
const CAT_BOUNDS = { x0: 560, y0: 448, x1: 736, y1: 592 };

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
    const fountainPoint = map.findObject('Objects', (obj) => obj.name === 'Fountain');

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

    this.createCat(groundLayer, buildingsLayer);
    this.createFountain(fountainPoint);

    this.cameras.main.startFollow(this.player, true);
    // 2x zoom: pixelArt + roundPixels (set in main.js) keep it crisp.
    this.cameras.main.setZoom(2);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,E');

    // Touch devices swap "Press E" prompts for "Tap" and get quadrant
    // steering; detection is per-device (not per-pointer) so prompt labels
    // stay stable. Keyboard input keeps working either way.
    this.isTouch = this.sys.game.device.input.touch;
    this.promptVerb = this.isTouch ? 'Tap' : 'Press E';
    this.setupTouchMovement();

    // 10px because the camera runs at 2x zoom - renders at an effective
    // 20px on screen; always on top of depth-sorted buildings. On touch it
    // doubles as the action button, so it gets a bigger face (and a hit
    // area padded well past it - see updatePromptHitArea).
    this.promptText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: this.isTouch ? '12px' : '10px',
        color: '#f0f0f0',
        backgroundColor: '#000000',
        padding: this.isTouch ? { x: 10, y: 7 } : { x: 5, y: 3 },
      })
      .setOrigin(0.5)
      .setScrollFactor(1)
      .setDepth(10000)
      .setVisible(false);

    // Tapping the prompt is the touch equivalent of E. window.open must run
    // synchronously inside this pointerup handler (a real user gesture) or
    // mobile popup blockers eat the building redirect. Down+up both on the
    // prompt = a tap; a movement finger merely released over it won't have
    // the matching pointerdown, so it can't trigger anything.
    this.promptDownPointer = null;
    this.promptText.setInteractive({ useHandCursor: true });
    this.promptText.on('pointerdown', (pointer, localX, localY, event) => {
      this.promptDownPointer = pointer;
      event.stopPropagation();
    });
    this.promptText.on('pointerup', (pointer, localX, localY, event) => {
      if (pointer !== this.promptDownPointer) return;
      this.promptDownPointer = null;
      event.stopPropagation();
      this.triggerInteraction();
    });

    this.flavorZones = FLAVOR_PROPS.map((p) => ({
      rect: new Phaser.Geom.Rectangle(p.x, p.y, p.w, p.h),
      text: p.text,
    }));

    // One reusable bubble for flavor text / the cat's meow — same styling
    // family as promptText, auto-dismisses after a beat.
    this.bubbleText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#1d1d28',
        backgroundColor: '#f0f0e0',
        padding: { x: 5, y: 3 },
        wordWrap: { width: 180 },
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(10001)
      .setVisible(false);

    this.activeInteraction = null;

    this.wasd.E.on('down', () => this.triggerInteraction());

    this.footstepKeys = FOOTSTEP_KEYS.filter((key) => this.cache.audio.exists(key));
    this.stepIndex = 0;
    this.lastStepAt = 0;

    this.startAudio();
  }

  // Shared by the E key and the prompt tap - the one place an interaction
  // actually fires.
  triggerInteraction() {
    if (!this.activeInteraction) return;
    const it = this.activeInteraction;
    if (it.type === 'building') {
      window.open(it.url, '_blank');
    } else if (it.type === 'signpost') {
      toggleDirectory();
    } else if (it.type === 'cat') {
      this.showBubble('Meow.', this.cat.x, this.cat.y - 18);
    } else if (it.type === 'flavor') {
      this.showBubble(it.text, this.player.x, this.player.y - 24);
    }
  }

  // Invisible d-pad: the screen splits into 4 triangles along its diagonals
  // (an X through the center) - hold to walk toward that edge, release to
  // stop, and dragging across a diagonal mid-hold retargets live. Only the
  // first touch steers; extra simultaneous touches are ignored for movement
  // (they're free to tap the prompt). Touches that land on UI (currentlyOver)
  // never become movement.
  setupTouchMovement() {
    this.touchMovePointer = null;
    this.touchDir = null;

    this.input.on('pointerdown', (pointer, currentlyOver) => {
      if (!pointer.wasTouch) return;
      if (this.touchMovePointer) return;
      if (currentlyOver && currentlyOver.length > 0) return;
      this.touchMovePointer = pointer;
      this.touchDir = this.quadrantFor(pointer);
    });
    this.input.on('pointermove', (pointer) => {
      if (pointer !== this.touchMovePointer) return;
      this.touchDir = this.quadrantFor(pointer);
    });
    const release = (pointer) => {
      if (pointer === this.touchMovePointer) this.clearTouchMove();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  clearTouchMove() {
    this.touchMovePointer = null;
    this.touchDir = null;
  }

  // Which diagonal-bounded triangle the pointer is in. Offsets are
  // normalized by the half-extents so the boundaries are the true
  // corner-to-corner diagonals of the (non-square) screen.
  quadrantFor(pointer) {
    const nx = (pointer.x - this.scale.width / 2) / (this.scale.width / 2);
    const ny = (pointer.y - this.scale.height / 2) / (this.scale.height / 2);
    if (Math.abs(nx) >= Math.abs(ny)) return nx >= 0 ? 'right' : 'left';
    return ny >= 0 ? 'down' : 'up';
  }

  // The prompt renders at 2x camera zoom and then gets FIT-scaled down on
  // phones, so the visible box alone is under thumb size - pad the hit area
  // well past it. Must re-run whenever the text (and so the width) changes.
  updatePromptHitArea() {
    if (!this.isTouch || !this.promptText.input) return;
    const padX = 14;
    const padY = 12;
    this.promptText.input.hitArea.setTo(
      -padX,
      -padY,
      this.promptText.width + padX * 2,
      this.promptText.height + padY * 2
    );
  }

  showBubble(text, x, y) {
    if (this.bubbleTimer) this.bubbleTimer.remove();
    if (this.bubbleTween) this.bubbleTween.stop();
    this.bubbleText.setText(text).setPosition(x, y).setAlpha(1).setVisible(true);
    this.bubbleTimer = this.time.delayedCall(2200, () => {
      this.bubbleTween = this.tweens.add({
        targets: this.bubbleText,
        alpha: 0,
        duration: 300,
        onComplete: () => this.bubbleText.setVisible(false),
      });
    });
  }

  // Lazy plaza patrol: pause -> amble to a random waypoint inside
  // CAT_BOUNDS -> pause or sit -> repeat. Colliders keep it out of the
  // fountain and off the furniture; a timeout re-rolls the waypoint if it
  // gets pinned against something.
  createCat(groundLayer, buildingsLayer) {
    if (!this.textures.exists('cat')) return;

    ['cat-idle', 'cat-walk', 'cat-sit'].forEach((key) => {
      if (this.anims.exists(key)) return;
      const frames = { 'cat-idle': [0], 'cat-walk': [1, 2], 'cat-sit': [3] }[key];
      this.anims.create({
        key,
        frames: frames.map((frame) => ({ key: 'cat', frame })),
        frameRate: 5,
        repeat: -1,
      });
    });

    this.cat = this.physics.add.sprite(648, 520, 'cat');
    this.cat.body.setSize(18, 10).setOffset(7, 20);
    this.cat.play('cat-idle');
    this.physics.add.collider(this.cat, groundLayer);
    this.physics.add.collider(this.cat, buildingsLayer);
    this.buildingSolids.forEach((solid) => this.physics.add.collider(this.cat, solid));

    this.catState = 'pause';
    this.catUntil = 0;
    this.catTarget = null;
  }

  updateCat(now) {
    if (!this.cat) return;
    this.cat.setDepth(this.cat.y + 12);

    if (this.catState === 'walk') {
      const done =
        Phaser.Math.Distance.Between(this.cat.x, this.cat.y, this.catTarget.x, this.catTarget.y) < 6;
      if (done || now > this.catUntil) {
        this.cat.setVelocity(0);
        const sitting = Math.random() < 0.5;
        this.catState = sitting ? 'sit' : 'pause';
        this.catUntil = now + Phaser.Math.Between(1800, 4500);
        this.cat.play(sitting ? 'cat-sit' : 'cat-idle');
      } else {
        // colliders can deflect it, so keep re-aiming at the waypoint
        this.physics.moveTo(this.cat, this.catTarget.x, this.catTarget.y, CAT_SPEED);
        this.cat.setFlipX(this.cat.body.velocity.x < 0);
      }
    } else if (now > this.catUntil) {
      this.catTarget = {
        x: Phaser.Math.Between(CAT_BOUNDS.x0, CAT_BOUNDS.x1),
        y: Phaser.Math.Between(CAT_BOUNDS.y0, CAT_BOUNDS.y1),
      };
      this.catState = 'walk';
      this.catUntil = now + 8000; // give up on unreachable waypoints
      this.cat.play('cat-walk');
    }
  }

  createFountain(fountainPoint) {
    if (!fountainPoint) return;
    this.fountainPoint = fountainPoint;

    // 2x2 white pixel, tinted per-particle toward pale blues.
    if (!this.textures.exists('splash-px')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 2, 2);
      g.generateTexture('splash-px', 2, 2);
      g.destroy();
    }
    this.add
      .particles(fountainPoint.x, fountainPoint.y - 8, 'splash-px', {
        speedX: { min: -14, max: 14 },
        speedY: { min: -34, max: -12 },
        gravityY: 70,
        lifespan: { min: 350, max: 700 },
        frequency: 70,
        quantity: 1,
        alpha: { start: 0.9, end: 0 },
        scale: { start: 1, end: 0.5 },
        tint: [0xffffff, 0xcfeaff, 0x9fd8ff],
      })
      .setDepth(fountainPoint.y + 16);
  }

  // Autoplay policies (and headless/CI browsers) commonly block audio until
  // a user gesture or block it outright - none of that may ever throw, but
  // it must never stop the scene from loading or playing, so every audio
  // call in this scene is try/catch-wrapped and gated on the asset having
  // actually made it into the cache (see PreloadScene's failedKeys seam).
  //
  // Three loops, quiet-to-quieter: the chiptune town theme carries, the old
  // nature ambience sits ducked underneath it as a bed, and the fountain
  // loop starts silent — update() raises it only near the fountain.
  startAudio() {
    const play = () => {
      try {
        if (this.cache.audio.exists('music-town')) {
          this.music = this.sound.add('music-town', { loop: true, volume: MUSIC_VOLUME });
          this.music.play();
        }
        if (this.cache.audio.exists('ambient-town')) {
          this.ambient = this.sound.add('ambient-town', { loop: true, volume: AMBIENT_VOLUME });
          this.ambient.play();
        }
        if (this.cache.audio.exists('fountain-loop') && this.fountainPoint) {
          this.fountainSound = this.sound.add('fountain-loop', { loop: true, volume: 0 });
          this.fountainSound.play();
        }
      } catch (e) {
        // non-fatal: game continues silently
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
      // ±8% pitch and ±10% volume per step keeps the two samples from
      // reading as a mechanical A/B loop.
      this.sound.play(key, {
        volume: FOOTSTEP_VOLUME * Phaser.Math.FloatBetween(0.9, 1.1),
        rate: Phaser.Math.FloatBetween(0.92, 1.08),
      });
    } catch (e) {
      // non-fatal: a blocked/failed footstep must never interrupt movement
    }
  }

  // Distance-faded fountain SFX: full FOUNTAIN_VOLUME inside NEAR px,
  // silent past FAR px (~3 tiles of fade), beneath everything else.
  updateFountainSound() {
    if (!this.fountainSound) return;
    const d = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.fountainPoint.x, this.fountainPoint.y
    );
    const t = Phaser.Math.Clamp(
      (FOUNTAIN_SFX_FAR - d) / (FOUNTAIN_SFX_FAR - FOUNTAIN_SFX_NEAR), 0, 1
    );
    try {
      this.fountainSound.setVolume(FOUNTAIN_VOLUME * t);
    } catch (e) {
      // non-fatal
    }
  }

  update() {
    if (isDirectoryOpen()) {
      // The DOM overlay swallows touchend, so Phaser would never see the
      // release - drop any held movement or it sticks after closing.
      this.clearTouchMove();
      this.player.setVelocity(0);
      return;
    }
    // Safety net for releases Phaser missed (touchcancel, focus loss).
    if (this.touchMovePointer && !this.touchMovePointer.isDown) this.clearTouchMove();

    const velocity = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown || this.wasd.A.isDown || this.touchDir === 'left') velocity.x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown || this.touchDir === 'right') velocity.x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown || this.touchDir === 'up') velocity.y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown || this.touchDir === 'down') velocity.y += 1;

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

    this.updateCat(this.time.now);
    this.updateFountainSound();

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
      if (this.promptText.text !== this.activeInteraction.label) {
        this.promptText.setText(this.activeInteraction.label);
        this.updatePromptHitArea();
      }
      this.promptText.setPosition(this.player.x, this.player.y - 32);
    }
  }

  // One prompt at a time, strict priority: building portals, then the
  // signpost directory, then the cat, then flavor props. Overlapping zones
  // therefore never shadow a redirect or the directory.
  resolveInteraction() {
    const zone = this.triggerZones.find((z) =>
      Phaser.Geom.Rectangle.Contains(z.rect, this.player.x, this.player.y)
    );
    if (zone) {
      return {
        type: 'building',
        label: `${this.promptVerb} to visit ${zone.building.name}`,
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
      return { type: 'signpost', label: `${this.promptVerb} for Town Directory` };
    }

    if (
      this.cat &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.cat.x, this.cat.y) <=
        CAT_RADIUS
    ) {
      return { type: 'cat', label: `${this.promptVerb} to greet the cat` };
    }

    const flavor = this.flavorZones.find((z) =>
      Phaser.Geom.Rectangle.Contains(z.rect, this.player.x, this.player.y)
    );
    if (flavor) {
      return { type: 'flavor', label: `${this.promptVerb} to look`, text: flavor.text };
    }

    return null;
  }
}
