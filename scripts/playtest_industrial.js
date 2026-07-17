#!/usr/bin/env node
/* Headless Chrome playtest: walks the industrial yard route with REAL
 * keyboard input (no teleporting) to prove the physical path the fix
 * describes is actually walkable end-to-end under Arcade physics collision
 * — spawn -> south into the TAN gate corridor -> west along the open gate
 * row -> south down the x=30-32 margin corridor -> east across the south
 * apron to each of the three yard buildings, checking the interaction
 * prompt appears and E fires the correct redirect at each stop.
 *
 * Usage: node scripts/playtest_industrial.js [port]
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(
  '/tmp/claude-1000/-home-michaelpynn/3dc50578-212d-4b69-bd68-97ca3f507195/scratchpad',
  'node_modules', 'puppeteer-core'
));

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || 8971);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.game && window.game.scene.isActive('Title'), { timeout: 15000 });
  await page.evaluate(() => {
    window.__opened = [];
    window.open = (url) => { window.__opened.push(url); return null; };
  });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.scene.isActive('Town'), { timeout: 10000 });
  await sleep(300);

  const playerPos = () => page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return { x: s.player.x, y: s.player.y };
  });
  const state = () => page.evaluate(() => {
    const s = window.game.scene.getScene('Town');
    return { type: s.activeInteraction?.type, label: s.promptText.text, visible: s.promptText.visible };
  });

  // Holds `key` and polls position every 50ms, releasing once the given
  // axis is within `tol` of `target` (walked there for real, under actual
  // collision) or once several consecutive polls in a row show no further
  // progress (genuinely blocked by something on the intended route, not
  // just one noisy sample racing a render frame) or `maxMs` elapses.
  // `target` may be deliberately unreachable (e.g. past a building the leg
  // is *supposed* to collide with) — pass `expect: [lo, hi]` to assert the
  // real stopping point lands in that range instead of near `target`.
  async function walkToward(key, axis, target, tol, maxMs, label, expect) {
    await page.keyboard.down(key);
    let last = (await playerPos())[axis];
    let elapsed = 0;
    let flatPolls = 0;
    const step = 50;
    while (elapsed < maxMs) {
      await sleep(step);
      elapsed += step;
      const cur = (await playerPos())[axis];
      if (Math.abs(cur - target) <= tol) { last = cur; break; }
      flatPolls = Math.abs(cur - last) < 1 ? flatPolls + 1 : 0;
      last = cur;
      if (flatPolls >= 3) break; // genuinely stalled, not one noisy sample
    }
    await page.keyboard.up(key);
    await sleep(150);
    const final = await playerPos();
    const ok = expect
      ? final[axis] >= expect[0] && final[axis] <= expect[1]
      : Math.abs(final[axis] - target) <= tol;
    check(`walk ${label}`, ok, `reached (${final.x.toFixed(0)},${final.y.toFixed(0)}), wanted ${axis}${expect ? ` in [${expect}]` : `~=${target}`}`);
    return final;
  }

  // ---- leg 1: spawn (648,568) south to the real collision stop against
  // the twin_silo footprint (~y=672). Target is deliberately past what's
  // reachable so the leg ends via stall-detection at the true boundary,
  // not an approximate guessed pixel — the 16px row only gives the 14px
  // body ~2px of vertical slack, and stopping a couple pixels short grazes
  // a bush placed one row up at (38,41), which a real player passing
  // through cleanly (feet planted against the silo) would never touch.
  await walkToward('KeyS', 'y', 750, 2, 2500, 'south from spawn into the gate corridor', [668, 676]);

  // ---- leg 2: west along the open gate row into the x=30-32 margin
  // corridor. Target the tile31/32 sub-window specifically (x=512, not the
  // full corridor's midpoint x=504): the pre-existing lamp post at (30,47)
  // narrows the *usable* width to exactly 2 tiles at those rows, and a
  // straight walk centered on the full 3-tile corridor grazes column 30 by
  // a pixel — same shape of bug as the crate pinch this fix removed, just
  // from decor this pass didn't touch. The reachability checker already
  // models this correctly (it checks both the 30/31 and 31/32 windows).
  await walkToward('KeyA', 'x', 512, 6, 4000, 'west along the gate row to the margin corridor');

  // ---- leg 3: south down the margin corridor, past the twin_silo
  // footprint, into the open south apron (row49-50 trigger band)
  await walkToward('KeyS', 'y', 800, 10, 4000, 'south down the margin corridor to the apron');

  // ---- stop 1: terminal_dashboard (twin silo, left door, trigger x34-36)
  await walkToward('KeyD', 'x', 560, 10, 3000, 'east to terminal_dashboard door');
  await sleep(150);
  let st = await state();
  check('prompt at terminal_dashboard', st.visible && st.type === 'building' && st.label.includes('Terminal Dashboard'), JSON.stringify(st));
  await page.keyboard.press('KeyE');
  await sleep(150);
  let opened = await page.evaluate(() => window.__opened[window.__opened.length - 1]);
  check('E opens terminal_dashboard url', opened === 'https://pynnmichael-oss.github.io/Terminal-Dashboard/', opened);

  // ---- stop 2: blend_planner (twin silo, right door, trigger x39-41)
  await walkToward('KeyD', 'x', 640, 10, 3000, 'east to blend_planner door');
  await sleep(150);
  st = await state();
  check('prompt at blend_planner', st.visible && st.type === 'building' && st.label.includes('Blend Planner'), JSON.stringify(st));
  await page.keyboard.press('KeyE');
  await sleep(150);
  opened = await page.evaluate(() => window.__opened[window.__opened.length - 1]);
  check('E opens blend_planner url', opened === 'https://pynnmichael-oss.github.io/blend-planner/', opened);

  // ---- stop 3: roberts_fuel (trigger x48-50)
  await walkToward('KeyD', 'x', 784, 10, 3000, 'east to roberts_fuel door');
  await sleep(150);
  st = await state();
  check('prompt at roberts_fuel', st.visible && st.type === 'building' && st.label.includes('Roberts Fuel Services'), JSON.stringify(st));
  await page.keyboard.press('KeyE');
  await sleep(150);
  opened = await page.evaluate(() => window.__opened[window.__opened.length - 1]);
  check('E opens roberts_fuel url', opened === 'https://pynnmichael-oss.github.io/roberts-fuel-services/', opened);

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PLAYTEST CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
