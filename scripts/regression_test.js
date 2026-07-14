#!/usr/bin/env node
/* Headless regression for The Town.
 *
 * Serves the repo, drives the game in headless Chrome and asserts:
 *  - all 8 trigger zones show the right prompt and E opens the right URL
 *  - signpost prompt + directory overlay (open, lists all 8, Esc closes)
 *  - walk animations track all 4 directions
 *  - camera: zoom 2, bounds = world, follows the player
 *  - building sprites loaded at native footprint size; 7 solid footprints
 *  - audio cache holds ambient + both footsteps (playback stays try/catch'd)
 * Also captures one screenshot per district into the dir given as argv[2].
 *
 * Usage: node scripts/regression_test.js [port] [shotdir]
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(
  '/tmp/claude-1000/-home-michaelpynn/3dc50578-212d-4b69-bd68-97ca3f507195/scratchpad',
  'node_modules', 'puppeteer-core'
));

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || 8931);
const SHOTDIR = process.argv[3] || '/tmp/claude-1000/-home-michaelpynn/3dc50578-212d-4b69-bd68-97ca3f507195/scratchpad/shots';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const EXPECT = {
  touchgrass: { label: 'TouchGrass', tile: [40, 14] },
  summer_nicole_films: { label: 'Summer Nicole Films', tile: [11, 30] },
  all_hands_detailing: { label: 'All Hands Detailing', tile: [19, 30] },
  fourwinds: { label: 'FourWinds', tile: [26, 30] },
  terminal_dashboard: { label: 'Terminal Dashboard', tile: [35, 50] },
  blend_planner: { label: 'Blend Planner', tile: [40, 50] },
  roberts_fuel: { label: 'Roberts Fuel Services', tile: [49, 50] },
  shortsleeve: { label: 'Shortsleeve Travel', tile: [60.5, 29] },
};
const DISTRICTS = {
  park: [40, 12], plaza: [40, 32], commercial: [19, 27],
  industrial: [40, 48], waterfront: [61, 29],
};

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

(async () => {
  fs.mkdirSync(SHOTDIR, { recursive: true });
  await new Promise((r) => server.listen(PORT, r));

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=840,660', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.game && window.game.scene.isActive('Title'), { timeout: 15000 });

  // window.open interception must be installed before any E press
  await page.evaluate(() => {
    window.__opened = [];
    window.open = (url) => { window.__opened.push(url); return null; };
  });

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.scene.isActive('Town'), { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));

  const boot = await page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    const cam = s.cameras.main;
    const sprites = {};
    ['touchgrass_pavilion', 'shortsleeve_dock', 'twin_silo', 'roberts_fuel',
     'summer_nicole_films', 'all_hands_detailing', 'fourwinds'].forEach((k) => {
      const t = s.textures.exists(`building_${k}`) && s.textures.get(`building_${k}`).getSourceImage();
      sprites[k] = t ? [t.width, t.height] : null;
    });
    return {
      zoom: cam.zoom,
      camBounds: [cam.getBounds().width, cam.getBounds().height],
      world: [s.physics.world.bounds.width, s.physics.world.bounds.height],
      solids: s.buildingSolids.length,
      signpostTexture: s.textures.exists('signpost'),
      audio: ['ambient-town', 'footstep-1', 'footstep-2'].map((k) => s.cache.audio.exists(k)),
      triggers: s.triggerZones.map((z) => z.name).sort(),
      sprites,
    };
  });

  check('camera zoom is 2', boot.zoom === 2, `zoom=${boot.zoom}`);
  check('camera bounds = world 1280x960',
    boot.camBounds[0] === 1280 && boot.camBounds[1] === 960 && boot.world[0] === 1280 && boot.world[1] === 960,
    `cam=${boot.camBounds} world=${boot.world}`);
  check('7 building collision solids', boot.solids === 7, `got ${boot.solids}`);
  check('signpost texture loaded', boot.signpostTexture);
  check('audio cache: ambient + 2 footsteps', boot.audio.every(Boolean), JSON.stringify(boot.audio));
  check('8 trigger zones present', boot.triggers.length === 8, boot.triggers.join(','));
  const SIZES = { touchgrass_pavilion: [112, 80], shortsleeve_dock: [128, 96], twin_silo: [160, 96], roberts_fuel: [128, 80], summer_nicole_films: [96, 80], all_hands_detailing: [112, 80], fourwinds: [96, 80] };
  for (const [k, wh] of Object.entries(SIZES)) {
    const got = boot.sprites[k];
    check(`sprite ${k} ${wh.join('x')}`, got && got[0] === wh[0] && got[1] === wh[1], `got ${got}`);
  }

  const teleport = (tx, ty) => page.evaluate(([x, y]) => {
    const s = window.game.scene.getScene('Town');
    s.player.body.reset(x * 16, y * 16);
  }, [tx, ty]);

  // ---- walk animations, 4 directions
  for (const [key, dir] of [['KeyD', 'right'], ['KeyA', 'left'], ['KeyW', 'up'], ['KeyS', 'down']]) {
    await teleport(40, 34);
    await page.keyboard.down(key);
    await new Promise((r) => setTimeout(r, 250));
    const anim = await page.evaluate(() => window.game.scene.getScene('Town').player.anims.currentAnim?.key);
    await page.keyboard.up(key);
    check(`walk anim ${dir}`, anim === `walk-${dir}`, `got ${anim}`);
  }
  await new Promise((r) => setTimeout(r, 200));
  const idle = await page.evaluate(() => window.game.scene.getScene('Town').player.anims.currentAnim?.key);
  check('returns to idle', idle && idle.startsWith('idle-'), `got ${idle}`);

  // ---- all 8 trigger zones: prompt text + E opens the registered URL
  for (const [name, { label, tile }] of Object.entries(EXPECT)) {
    await teleport(tile[0], tile[1]);
    await new Promise((r) => setTimeout(r, 150));
    const state = await page.evaluate(() => {
      const s = window.game.scene.getScene('Town');
      return { visible: s.promptText.visible, text: s.promptText.text, active: s.activeInteraction?.type };
    });
    const promptOk = state.visible && state.text.includes(label) && state.active === 'building';
    await page.keyboard.press('KeyE');
    await new Promise((r) => setTimeout(r, 100));
    const opened = await page.evaluate(() => window.__opened);
    const expectedUrl = await page.evaluate((n) => {
      const s = window.game.scene.getScene('Town');
      return s.triggerZones.find((z) => z.name === n).building.url;
    }, name);
    const urlOk = opened[opened.length - 1] === expectedUrl;
    check(`zone ${name}: prompt`, promptOk, `"${state.text}"`);
    check(`zone ${name}: E opens url`, urlOk, `${opened[opened.length - 1]} vs ${expectedUrl}`);
  }

  // ---- signpost + directory overlay
  await teleport(42, 34.6);
  await new Promise((r) => setTimeout(r, 150));
  const signState = await page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return { visible: s.promptText.visible, text: s.promptText.text, type: s.activeInteraction?.type };
  });
  check('signpost prompt', signState.type === 'signpost' && signState.visible, `"${signState.text}"`);
  await page.keyboard.press('KeyE');
  await new Promise((r) => setTimeout(r, 200));
  const dir1 = await page.evaluate(() => {
    const el = document.getElementById('directory-overlay');
    return { open: el && !el.hidden, links: el ? el.querySelectorAll('a').length : 0 };
  });
  check('directory opens with 8 links', dir1.open && dir1.links === 8, JSON.stringify(dir1));
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 100));
  const dir2 = await page.evaluate(() => !document.getElementById('directory-overlay').hidden);
  check('directory closes on Esc', dir2 === false);

  // ---- charm pass: cat, flavor props, prompt priority, audio hierarchy
  const parkCat = (cx, cy) => page.evaluate(([x, y]) => {
    const s = window.game.scene.getScene('Town');
    if (!s.cat) return false;
    s.cat.setVelocity(0);
    s.catState = 'pause';
    s.catUntil = s.time.now + 60000; // pin it for the rest of the run
    s.cat.body.reset(x, y);
    return true;
  }, [cx, cy]);

  const catExists = await page.evaluate(() => !!window.game.scene.getScene('Town').cat);
  check('cat spawned', catExists);

  if (catExists) {
    await parkCat(600, 560);
    await teleport(37.5, 35.6); // (600, 570): 10px from cat, 80px from signpost
    await new Promise((r) => setTimeout(r, 150));
    const catPrompt = await page.evaluate(() => {
      const s = window.game.scene.getScene('Town');
      return { type: s.activeInteraction?.type, text: s.promptText.text };
    });
    check('cat prompt (beats flavor, loses to signpost)', catPrompt.type === 'cat', JSON.stringify(catPrompt));
    await page.keyboard.press('KeyE');
    await new Promise((r) => setTimeout(r, 150));
    const meow = await page.evaluate(() => {
      const s = window.game.scene.getScene('Town');
      return { visible: s.bubbleText.visible, text: s.bubbleText.text };
    });
    check('E near cat -> Meow bubble', meow.visible && meow.text === 'Meow.', JSON.stringify(meow));
    await parkCat(710, 585); // out of the way of the remaining checks
  }

  // bench flavor + auto-dismiss
  await teleport(37.5, 31.5); // (600, 504) inside bench-plaza-w zone
  await new Promise((r) => setTimeout(r, 150));
  const benchPrompt = await page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return { type: s.activeInteraction?.type, text: s.activeInteraction?.text };
  });
  check('bench flavor prompt', benchPrompt.type === 'flavor' && benchPrompt.text === 'A nice place to sit.', JSON.stringify(benchPrompt));
  await page.keyboard.press('KeyE');
  await new Promise((r) => setTimeout(r, 200));
  const bubble1 = await page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return s.bubbleText.visible && s.bubbleText.text;
  });
  check('bench bubble shows', bubble1 === 'A nice place to sit.', String(bubble1));
  await new Promise((r) => setTimeout(r, 2900));
  const bubbleGone = await page.evaluate(() => window.game.scene.getScene('Town').bubbleText.visible);
  check('bubble auto-dismisses ~2.5s', bubbleGone === false);

  // priority boundary at the silo: between the doors = flavor, on a door = building
  await teleport(38, 50); // (608, 800): the gap between the two door triggers
  await new Promise((r) => setTimeout(r, 150));
  const siloFlavor = await page.evaluate(() => window.game.scene.getScene('Town').activeInteraction?.type);
  check('between silo doors -> flavor', siloFlavor === 'flavor', String(siloFlavor));
  await teleport(35, 50); // (560, 800): inside terminal_dashboard trigger
  await new Promise((r) => setTimeout(r, 150));
  const siloDoor = await page.evaluate(() => window.game.scene.getScene('Town').activeInteraction?.type);
  check('on silo door -> building wins over flavor', siloDoor === 'building', String(siloDoor));

  // fountain: flavor text, particles, proximity-faded loop
  await teleport(38.75, 32.5); // (620, 520) beside the basin
  await new Promise((r) => setTimeout(r, 200));
  const fountain = await page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return {
      type: s.activeInteraction?.type,
      text: s.activeInteraction?.text,
      splashTex: s.textures.exists('splash-px'),
      vol: s.fountainSound ? s.fountainSound.volume : null,
    };
  });
  check('fountain flavor prompt', fountain.type === 'flavor' && fountain.text === 'Make a wish.', JSON.stringify(fountain));
  check('fountain particle texture exists', fountain.splashTex);
  check('fountain SFX audible up close', fountain.vol === null || fountain.vol > 0.02, `vol=${fountain.vol}`);
  await teleport(12, 12);
  await new Promise((r) => setTimeout(r, 200));
  const farVol = await page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return s.fountainSound ? s.fountainSound.volume : null;
  });
  check('fountain SFX silent far away', farVol === null || farVol === 0, `vol=${farVol}`);

  // audio hierarchy: music > ambient > fountain cap; footsteps subtle
  const audio = await page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return {
      music: s.music ? { playing: s.music.isPlaying, vol: s.music.volume } : null,
      ambient: s.ambient ? { playing: s.ambient.isPlaying, vol: s.ambient.volume } : null,
    };
  });
  check('music playing at quiet volume', !!audio.music && audio.music.playing && audio.music.vol > 0.1 && audio.music.vol <= 0.2, JSON.stringify(audio.music));
  check('ambient ducked under music', !!audio.ambient && audio.ambient.playing && audio.ambient.vol < audio.music.vol, JSON.stringify(audio.ambient));

  // ---- camera follows across a teleport
  await teleport(10, 45);
  await new Promise((r) => setTimeout(r, 400));
  const cam = await page.evaluate(() => {
    const c = window.game.scene.getScene('Town').cameras.main;
    return [c.midPoint.x, c.midPoint.y];
  });
  check('camera follows player', Math.abs(cam[0] - 160) < 210 && Math.abs(cam[1] - 720) < 210, `mid=${cam}`);

  // ---- district screenshots at the new zoom
  for (const [district, [tx, ty]] of Object.entries(DISTRICTS)) {
    await teleport(tx, ty);
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(SHOTDIR, `${district}.png`) });
  }
  // hero shot: cat sitting by the fountain, particles running
  if (catExists) {
    await parkCat(612, 540);
    await page.evaluate(() => {
      const s = window.game.scene.getScene('Town');
      s.catState = 'sit';
      s.catUntil = s.time.now + 60000;
      s.cat.play('cat-sit');
    });
  }
  await teleport(41.5, 33.5);
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(SHOTDIR, 'plaza-charm.png') });
  console.log(`screenshots -> ${SHOTDIR}`);

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

  // ---- graceful failure: every audio file 404s -> town still boots clean
  const deadServer = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url.startsWith('/assets/audio/')) { res.writeHead(404); res.end(); return; }
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise((r) => deadServer.listen(PORT + 1, r));
  const page2 = await browser.newPage();
  const errs2 = [];
  page2.on('pageerror', (e) => errs2.push(String(e)));
  await page2.goto(`http://127.0.0.1:${PORT + 1}/`, { waitUntil: 'networkidle0' });
  await page2.waitForFunction(() => window.game && window.game.scene.isActive('Title'), { timeout: 15000 });
  await page2.keyboard.press('Enter');
  await page2.waitForFunction(() => window.game.scene.isActive('Town'), { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 600));
  const noAudioState = await page2.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return { music: !!s.music, footsteps: s.footstepKeys.length, active: true };
  });
  check('no-audio boot: town runs, zero errors', errs2.length === 0 && noAudioState.active, errs2.join(' | '));
  check('no-audio boot: seam left music/footsteps unset', !noAudioState.music && noAudioState.footsteps === 0, JSON.stringify(noAudioState));
  deadServer.close();

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
