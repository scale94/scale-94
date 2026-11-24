// eyeQuestTour.mjs — scripted CDP screenshot tour of the Observer Eye quest.
//
//   npm run dev -- --port 5174 --strictPort      (in another shell)
//   node scripts/eyeQuestTour.mjs [--url http://localhost:5174/] [--out baseline/eye-quest-tour]
//
// Fresh Chrome profile each run (cdp.mjs mkdtemp), so local/sessionStorage are empty.
// Crops the masthead eye (button rect + margin, wider on the right for the phrase
// slot), scaled x4 through CDP clip.scale. Timing is real-time and approximate:
// the manifest records the ACTUAL elapsed ms of every shot.
// Uses dev hooks window.__observatoryEmit and window.__quintessenceSpine.
// Writes PNGs + manifest.json + contact.png (an HTML grid rendered through CDP).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launch } from './cdp.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://localhost:5174/');
const OUT = arg('out', 'baseline/eye-quest-tour');
const SCALE = 4;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

await mkdir(OUT, { recursive: true });
const page = await launch({ url: URL, width: 1520, height: 900 });
const shots = [];
const t0 = Date.now();

const EYE = `document.querySelector('[aria-label="Open Mercury — observer view"]')`;

async function shoot(name, label, extra = {}) {
  const r = await page.eval(`(() => { const e = ${EYE}; if (!e) return null; const b = e.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
  if (!r) throw new Error(`eye missing for shot ${name}`);
  const m = 8;
  const clip = {
    x: Math.max(0, Math.floor(r.x - m)), y: Math.max(0, Math.floor(r.y - m)),
    width: Math.ceil(Math.max(r.w + 2 * m, 360)), height: Math.ceil(r.h + 2 * m), scale: SCALE,
  };
  const file = `${name}.png`;
  const buf = await page.screenshot({ path: join(OUT, file), clip });
  const info = { name, label, file, bytes: buf.length, elapsedMs: Date.now() - t0, clip, ...extra };
  shots.push(info);
  console.log(`${name}  +${info.elapsedMs}ms  ${buf.length}B`);
  return info;
}

try {
  await page.goto(URL);
  await page.waitFor(`!!${EYE} && !!${EYE}.querySelector('canvas')`, { timeoutMs: 60000, label: 'eye canvas' });
  await page.waitFor(`typeof window.__observatoryEmit === 'function' && !!window.__quintessenceSpine`, { label: 'dev hooks' });
  const tLand = Date.now();
  await sleep(300);
  await shoot('01-landing-silver', 'landing, silver');

  // t = 13.5 s after the eye mounted: idle Mercury whisper + shimmer glance.
  await sleep(Math.max(0, 13500 - (Date.now() - tLand)));
  await shoot('02-idle-13.5s', 'idle t=13.5s (whisper + glance)', { sinceLandingMs: Date.now() - tLand });

  await page.eval(`window.__observatoryEmit('essences', 'collision_fired', {})`);
  await sleep(500);
  await shoot('03-collision-fired', 'after collision_fired');

  const S = 'window.__quintessenceSpine';
  const marks = [
    ['04-vertebra-trend', 'trend marked', `${S}.setTrend({ label: 'tour trend', velocity: 0.6 })`],
    ['05-vertebra-council', 'council marked', `${S}.setCouncil({ pair: ['A', 'B'], directive: 'd', trajectory: 'converging', paradoxCount: 1 })`],
    ['06-vertebra-phase', 'phase marked', `${S}.setPhase('DARK INCUBATION')`],
    ['07-vertebra-element', 'element marked', `${S}.setElement('FIRE')`],
  ];
  for (const [name, label, js] of marks) {
    await page.eval(js);
    await sleep(500);
    await shoot(name, label);
  }
  await sleep(1500);
  await shoot('08-armed-aether', 'armed (all vertebrae), Aether');

  // Crescendo: ignite, then seal, shots at +0/250/600/1500/3000/6000 ms.
  await page.eval(`window.__observatoryEmit('edge', 'kernel_ignited', { element: 'FIRE' })`);
  await sleep(400);
  await shoot('09-ignited', 'kernel_ignited (charging)');
  const tSeal = Date.now();
  await page.eval(`window.__observatoryEmit('edge', 'kernel_sealed', { hash: 'tourhash' })`);
  for (const at of [0, 250, 600, 1500, 3000, 6000]) {
    await sleep(Math.max(0, at - (Date.now() - tSeal)));
    await shoot(`10-sealed-${String(at).padStart(4, '0')}`, `kernel_sealed +${at}ms`, { requestedMs: at, sinceSealMs: Date.now() - tSeal });
  }

  await writeFile(join(OUT, 'manifest.json'), JSON.stringify({ url: URL, scale: SCALE, shots }, null, 2));

  // Contact sheet: HTML grid of data URIs, rendered through CDP.
  const { readFile } = await import('node:fs/promises');
  const cells = [];
  for (const s of shots) {
    const b64 = (await readFile(join(OUT, s.file))).toString('base64');
    cells.push(`<figure><img src="data:image/png;base64,${b64}"><figcaption>${s.name}<br>${s.label}<br>+${s.elapsedMs}ms</figcaption></figure>`);
  }
  const cols = 3;
  const w = shots[0].clip.width * SCALE;
  const html = `<!doctype html><meta charset=utf-8><style>
    body{margin:0;background:#101014;color:#bbb;font:14px monospace}
    .g{display:grid;grid-template-columns:repeat(${cols},${w}px);gap:16px;padding:16px;width:max-content}
    figure{margin:0}img{display:block;border:1px solid #333}figcaption{padding:6px 0}</style>
    <div class=g>${cells.join('')}</div>`;
  const rows = Math.ceil(shots.length / cols);
  const sheetW = cols * w + (cols + 1) * 16;
  const sheetH = rows * (shots[0].clip.height * SCALE + 90) + 60;
  await page.eval(`document.open(); document.write(${JSON.stringify(html)}); document.close();`);
  await sleep(1500);
  await page.setViewport(sheetW, sheetH, 1);
  await sleep(500);
  await page.screenshot({ path: join(OUT, 'contact.png') });
  console.log('contact sheet', join(OUT, 'contact.png'));
} finally {
  await page.close();
}
