#!/usr/bin/env node
/* Headless MOBILE regression for The Town (touch emulation).
 *
 * Emulates a phone (390x844 portrait + 844x390 landscape, touch enabled)
 * and asserts:
 *  - touch device detection: body.touch class, "Tap ..." prompt labels,
 *    "Tap to Start" title, touch-action: none on the canvas
 *  - tap on the title starts the town AND unlocks audio (no autoplay flag
 *    is passed here, so sound genuinely starts locked)
 *  - quadrant movement: hold in each screen triangle walks that direction,
 *    dragging across a diagonal mid-hold retargets live, release stops
 *  - tapping the prompt opens the right URL (2 buildings), opens the
 *    directory (44px+ link/close targets, Close taps shut), greets the cat,
 *    and shows flavor text - and never counts as movement
 *  - page never scrolls or overflows during play
 * Screenshots portrait + landscape into the dir given as argv[3].
 *
 * Usage: node scripts/mobile_test.js [port] [shotdir]
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(
  '/tmp/claude-1000/-home-michaelpynn/3dc50578-212d-4b69-bd68-97ca3f507195/scratchpad',
  'node_modules', 'puppeteer-core'
));

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || 8941);
const SHOTDIR = process.argv[3] || '/tmp/claude-1000/-home-michaelpynn/3dc50578-212d-4b69-bd68-97ca3f507195/scratchpad/shots-mobile';
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
    // deliberately NO --autoplay-policy flag: audio must start locked so the
    // tap-to-unlock path is actually exercised
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // raw CDP touch: works on every puppeteer-core version and generates
  // trusted events (they count as the user gesture for audio unlock)
  const cdp = await page.target().createCDPSession();
  const touchStart = (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  const touchMove = (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
  const touchEnd = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const tap = async (x, y) => { await touchStart(x, y); await sleep(80); await touchEnd(); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const canvasRect = () => page.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  // world point -> page CSS px (through camera zoom + FIT scaling)
  const worldToPage = (wx, wy) => page.evaluate(([x, y]) => {
    const s = window.game.scene.getScene('Town');
    const cam = s.cameras.main;
    const r = document.querySelector('canvas').getBoundingClientRect();
    const cx = (x - cam.worldView.x) * cam.zoom;
    const cy = (y - cam.worldView.y) * cam.zoom;
    return { x: r.left + cx * (r.width / s.scale.width), y: r.top + cy * (r.height / s.scale.height) };
  }, [wx, wy]);
  const promptCenter = async () => {
    const p = await page.evaluate(() => {
      const s = window.game.scene.getScene('Town');
      return { x: s.promptText.x, y: s.promptText.y };
    });
    return worldToPage(p.x, p.y);
  };
  const teleport = (tx, ty) => page.evaluate(([x, y]) => {
    const s = window.game.scene.getScene('Town');
    s.player.body.reset(x * 16, y * 16);
  }, [tx, ty]);
  const townState = () => page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return {
      vx: s.player.body.velocity.x, vy: s.player.body.velocity.y,
      px: s.player.x, py: s.player.y,
      anim: s.player.anims.currentAnim?.key,
      prompt: s.promptText.text, promptVisible: s.promptText.visible,
      touchDir: s.touchDir,
      type: s.activeInteraction?.type,
    };
  });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.game && window.game.scene.isActive('Title'), { timeout: 15000 });

  await page.evaluate(() => {
    window.__opened = [];
    window.open = (url) => { window.__opened.push(url); return null; };
  });

  // ---- touch detection + page behavior
  const env = await page.evaluate(() => ({
    bodyTouch: document.body.classList.contains('touch'),
    canvasTouchAction: getComputedStyle(document.querySelector('canvas')).touchAction,
    titleText: window.game.scene.getScene('Title').promptText.text,
    soundLocked: window.game.sound.locked,
  }));
  check('body.touch class set', env.bodyTouch);
  check('canvas touch-action: none', env.canvasTouchAction === 'none', env.canvasTouchAction);
  check('title says Tap to Start', env.titleText === 'Tap to Start', `"${env.titleText}"`);
  check('audio starts locked (unlock path is real)', env.soundLocked === true, String(env.soundLocked));

  // ---- tap starts the town + unlocks audio
  let rect = await canvasRect();
  await tap(rect.left + rect.width / 2, rect.top + rect.height / 2);
  await page.waitForFunction(() => window.game.scene.isActive('Town'), { timeout: 10000 });
  await sleep(700);
  const audio = await page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return { locked: window.game.sound.locked, music: !!(s.music && s.music.isPlaying) };
  });
  check('tap started the town', true);
  check('tap unlocked audio, music playing', !audio.locked && audio.music, JSON.stringify(audio));

  // ---- quadrant movement: hold each triangle, walk that way, release stops
  rect = await canvasRect();
  const QUAD = {
    down: [rect.left + rect.width / 2, rect.top + rect.height - 12],
    up: [rect.left + rect.width / 2, rect.top + 12],
    left: [rect.left + 12, rect.top + rect.height / 2],
    right: [rect.left + rect.width - 12, rect.top + rect.height / 2],
  };
  for (const [dir, [x, y]] of Object.entries(QUAD)) {
    await teleport(40, 34);
    await sleep(100);
    await touchStart(x, y);
    await sleep(300);
    const held = await townState();
    await touchEnd();
    await sleep(200);
    const released = await townState();
    const axisOk = {
      down: held.vy > 50 && Math.abs(held.vx) < 1,
      up: held.vy < -50 && Math.abs(held.vx) < 1,
      left: held.vx < -50 && Math.abs(held.vy) < 1,
      right: held.vx > 50 && Math.abs(held.vy) < 1,
    }[dir];
    check(`quadrant ${dir}: walks ${dir} while held`, axisOk && held.anim === `walk-${dir}`, `v=(${held.vx.toFixed(0)},${held.vy.toFixed(0)}) anim=${held.anim}`);
    check(`quadrant ${dir}: release stops`, released.vx === 0 && released.vy === 0 && released.touchDir === null, `v=(${released.vx},${released.vy}) dir=${released.touchDir}`);
  }

  // ---- drag across a diagonal mid-hold retargets live
  await teleport(40, 34);
  await sleep(100);
  await touchStart(QUAD.down[0], QUAD.down[1]);
  await sleep(250);
  const before = await townState();
  await touchMove(QUAD.left[0], QUAD.left[1]);
  await sleep(250);
  const after = await townState();
  await touchEnd();
  check('drag mid-hold: was walking down', before.touchDir === 'down' && before.vy > 50, `dir=${before.touchDir}`);
  check('drag mid-hold: retargets to left live', after.touchDir === 'left' && after.vx < -50 && Math.abs(after.vy) < 1, `dir=${after.touchDir} v=(${after.vx.toFixed(0)},${after.vy.toFixed(0)})`);

  // ---- prompt is a tap button: 2 buildings open their URLs
  for (const [name, tile] of [['touchgrass', [40, 14]], ['roberts_fuel', [49, 50]]]) {
    await teleport(tile[0], tile[1]);
    await sleep(250);
    const st = await townState();
    check(`zone ${name}: prompt says Tap`, st.promptVisible && st.prompt.startsWith('Tap to visit'), `"${st.prompt}"`);
    const pc = await promptCenter();
    await tap(pc.x, pc.y);
    await sleep(150);
    const result = await page.evaluate((n) => {
      const s = window.game.scene.getScene('Town');
      return {
        opened: window.__opened[window.__opened.length - 1],
        expected: s.triggerZones.find((z) => z.name === n).building.url,
        touchDir: s.touchDir,
      };
    }, name);
    check(`zone ${name}: tap opens url`, result.opened === result.expected, `${result.opened} vs ${result.expected}`);
    check(`zone ${name}: prompt tap is not movement`, result.touchDir === null, `dir=${result.touchDir}`);
  }

  // ---- signpost: tap prompt -> directory; targets are 44px+; Close taps shut
  await teleport(42, 34.6);
  await sleep(250);
  const signSt = await townState();
  check('signpost: prompt says Tap for Town Directory', signSt.prompt === 'Tap for Town Directory', `"${signSt.prompt}"`);
  let pc = await promptCenter();
  await tap(pc.x, pc.y);
  await sleep(250);
  const dir = await page.evaluate(() => {
    const el = document.getElementById('directory-overlay');
    if (!el || el.hidden) return { open: false };
    const link = el.querySelector('a').getBoundingClientRect();
    const close = el.querySelector('.directory-close').getBoundingClientRect();
    return {
      open: true, links: el.querySelectorAll('a').length,
      linkH: link.height, closeH: close.height,
      closeX: close.left + close.width / 2, closeY: close.top + close.height / 2,
    };
  });
  check('tap opens directory with 8 links', dir.open && dir.links === 8, JSON.stringify({ open: dir.open, links: dir.links }));
  check('directory links are 44px+ rows', dir.open && dir.linkH >= 44, `linkH=${dir.linkH}`);
  check('close button is 44px+', dir.open && dir.closeH >= 44, `closeH=${dir.closeH}`);
  await tap(dir.closeX, dir.closeY);
  await sleep(250);
  const dirClosed = await page.evaluate(() => document.getElementById('directory-overlay').hidden);
  check('tap on Close dismisses directory', dirClosed === true);

  // ---- cat + flavor props tappable
  const catExists = await page.evaluate(() => !!window.game.scene.getScene('Town').cat);
  if (catExists) {
    await page.evaluate(() => {
      const s = window.game.scene.getScene('Town');
      s.cat.setVelocity(0);
      s.catState = 'pause';
      s.catUntil = s.time.now + 60000;
      s.cat.body.reset(600, 560);
    });
    await teleport(37.5, 35.6);
    await sleep(250);
    const catSt = await townState();
    check('cat: prompt says Tap to greet', catSt.prompt === 'Tap to greet the cat', `"${catSt.prompt}"`);
    pc = await promptCenter();
    await tap(pc.x, pc.y);
    await sleep(200);
    const meow = await page.evaluate(() => {
      const s = window.game.scene.getScene('Town');
      return s.bubbleText.visible && s.bubbleText.text;
    });
    check('cat: tap -> Meow bubble', meow === 'Meow.', String(meow));
    await page.evaluate(() => {
      const s = window.game.scene.getScene('Town');
      s.cat.body.reset(710, 585);
    });
  } else {
    check('cat spawned', false);
  }

  await teleport(37.5, 31.5);
  await sleep(2600); // let the meow bubble finish dismissing first
  const benchSt = await townState();
  check('flavor: bench prompt says Tap to look', benchSt.prompt === 'Tap to look' && benchSt.type === 'flavor', `"${benchSt.prompt}" type=${benchSt.type}`);
  pc = await promptCenter();
  await tap(pc.x, pc.y);
  await sleep(200);
  const benchBubble = await page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return s.bubbleText.visible && s.bubbleText.text;
  });
  check('flavor: tap -> bench bubble', benchBubble === 'A nice place to sit.', String(benchBubble));

  // ---- page never scrolled or overflowed during all of that
  const scroll = await page.evaluate(() => ({
    x: window.scrollX, y: window.scrollY,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    overflowY: document.documentElement.scrollHeight - window.innerHeight,
  }));
  check('no page scroll during play', scroll.x === 0 && scroll.y === 0, JSON.stringify(scroll));
  check('no page overflow', scroll.overflowX <= 0 && scroll.overflowY <= 0, JSON.stringify(scroll));

  // ---- portrait screenshot in the square
  await teleport(40, 32);
  await sleep(400);
  await page.screenshot({ path: path.join(SHOTDIR, 'mobile-portrait.png') });

  // ---- landscape: FIT refits, movement still works, screenshot
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await sleep(600);
  rect = await canvasRect();
  const landscapeFit = rect.width > 500 && rect.height <= 392 && Math.abs(rect.width / rect.height - 800 / 600) < 0.02;
  check('landscape: canvas refits at 4:3', landscapeFit, JSON.stringify(rect));
  await teleport(40, 34);
  await sleep(100);
  await touchStart(rect.left + rect.width - 12, rect.top + rect.height / 2);
  await sleep(300);
  const land = await townState();
  await touchEnd();
  check('landscape: quadrant movement works', land.vx > 50 && land.anim === 'walk-right', `v=(${land.vx.toFixed(0)},${land.vy.toFixed(0)}) anim=${land.anim}`);
  await teleport(40, 32);
  await sleep(400);
  await page.screenshot({ path: path.join(SHOTDIR, 'mobile-landscape.png') });
  console.log(`screenshots -> ${SHOTDIR}`);

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL MOBILE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
