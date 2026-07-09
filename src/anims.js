// Contract: assets/higgsfield-spec.md's character grid is row=direction,
// col=pose (col 0 idle, cols 1-4 walk). Row order here is the source of
// truth the real sprite sheet has to match - swap two rows and the
// character silently faces the wrong way with no error.
const ROWS = ['down', 'left', 'right', 'up'];
const COLS_PER_ROW = 5; // idle + 4 walk frames

export function createPlayerAnimations(scene) {
  ROWS.forEach((direction, row) => {
    const base = row * COLS_PER_ROW;

    if (!scene.anims.exists(`idle-${direction}`)) {
      scene.anims.create({
        key: `idle-${direction}`,
        frames: [{ key: 'player', frame: base }],
        frameRate: 1,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(`walk-${direction}`)) {
      scene.anims.create({
        key: `walk-${direction}`,
        frames: scene.anims.generateFrameNumbers('player', {
          start: base + 1,
          end: base + 4,
        }),
        frameRate: 8,
        repeat: -1,
      });
    }
  });
}

export function animKeyFor(direction, moving) {
  return `${moving ? 'walk' : 'idle'}-${direction}`;
}
