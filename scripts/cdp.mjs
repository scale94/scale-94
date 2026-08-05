// cdp.mjs — dependency-free Chrome DevTools Protocol driver.
//
// Why this exists: the Claude browser pane reports document.hidden === true,
// which suspends requestAnimationFrame, so every canvas-driven view in this repo
// screenshots as a frozen boot frame there. Real headless Chrome does not, so
// every visual gate for /art, /SCENT, the moon and the eye has to go through
// CDP. Node 24 ships a global WebSocket, so this needs no npm dependency.
//
// GPU rules, learned the hard way:
//   --headless=new                 the old headless has no WebGL at all
//   --enable-unsafe-swiftshader    software GL; without it WebGL contexts fail
//   NEVER --disable-gpu            it kills WebGL even with swiftshader
//
// Usage:
//   import { launch } from './cdp.mjs';
//   const page = await launch({ url, width, height });
//   await page.waitFor('document.querySelectorAll("canvas").length > 0');
//   const png = await page.screenshot();
//   await page.close();

import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function findChrome() {
  const { existsSync } = await import('node:fs');
  const hit = CHROME_CANDIDATES.find(p => existsSync(p));
  if (!hit) throw new Error('Chrome not found; add its path to CHROME_CANDIDATES');
  return hit;
}

// Poll the DevTools HTTP endpoint until Chrome is listening and has a page.
async function waitForTarget(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) { lastErr = e; }
    await sleep(200);
  }
  throw new Error(`No CDP page target on :${port} after ${timeoutMs}ms (${lastErr?.message ?? 'no page'})`);
}

export async function launch({
  url,
  width = 1520,
  height = 900,
  dpr = 1,
  port = 9333 + (process.pid % 400),
  headless = true,
  deterministic = false,   // install the frame/RNG/clock shim before any page script
} = {}) {
  const chrome = await findChrome();
  const profile = await mkdtemp(join(tmpdir(), 'cdp-art-'));

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=${dpr}`,
    '--enable-unsafe-swiftshader',   // software WebGL
    '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--mute-audio',
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');   // NOT --disable-gpu

  const proc = spawn(chrome, args, { stdio: 'ignore', detached: false });
  const target = await waitForTarget(port);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('CDP websocket failed to open'));
  });

  let nextId = 1;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id != null) {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      // CDP puts the useful part in error.data ("Failed to deserialize
      // params.clip.x - BINDINGS: int32 value expected"); message alone is
      // just "Invalid parameters".
      msg.error
        ? p.reject(new Error(`${msg.error.message}${msg.error.data ? ` — ${msg.error.data}` : ''}`))
        : p.resolve(msg.result);
    } else {
      events.push(msg);
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`CDP timeout: ${method}`));
    }, 60000);
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  // Deterministic viewport regardless of window chrome.
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: dpr, mobile: false,
  });

  if (deterministic) {
    // /art's page pulls live climate data (NASA GISS, Global Forest Watch).
    // Those are CORS-blocked here anyway, but their timing is real-time
    // dependent, which is exactly what a reproducible frame gate cannot have.
    // Blocking them also stops a repeated capture run from hammering someone
    // else's API.
    // The dev server is plain http://localhost, so blocking every https/wss
    // origin leaves the app fully served while cutting all third-party traffic.
    await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['https://*', 'wss://*'] });

    const { DETERMINISM_SHIM } = await import('./determinism.mjs');
    // Must land before any module body runs — modules read performance.now()
    // at import time, and rAF must already be queued rather than scheduled.
    await send('Page.addScriptToEvaluateOnNewDocument', { source: DETERMINISM_SHIM });
  }

  const page = {
    send,
    events,

    async goto(target_, { waitMs = 0 } = {}) {
      await send('Page.navigate', { url: target_ });
      // Page.loadEventFired is unreliable for an SPA; poll readyState instead.
      await page.waitFor('document.readyState === "complete"', { timeoutMs: 30000 });
      if (waitMs) await sleep(waitMs);
    },

    // Evaluate an expression in the page and return its JS value.
    async eval(expression, { awaitPromise = false } = {}) {
      const r = await send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise,
      });
      if (r.exceptionDetails) {
        throw new Error(`page eval threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      }
      return r.result.value;
    },

    // Poll a boolean expression until true.
    async waitFor(expression, { timeoutMs = 20000, intervalMs = 150, label } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        try { if (await page.eval(expression)) return true; } catch { /* pre-boot */ }
        await sleep(intervalMs);
      }
      throw new Error(`waitFor timed out after ${timeoutMs}ms: ${label ?? expression}`);
    },

    async screenshot({ path, clip } = {}) {
      const r = await send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: false, ...(clip ? { clip } : {}),
      });
      const buf = Buffer.from(r.data, 'base64');
      if (path) {
        const { writeFile } = await import('node:fs/promises');
        await writeFile(path, buf);
      }
      return buf;
    },

    // ── Input. CDP dispatch, because synthetic DOM events skip the real
    // pointer/contextmenu paths that the sphere's hit-testing listens on.
    async mouse(type, x, y, { button = 'left', clickCount = 1, modifiers = 0 } = {}) {
      await send('Input.dispatchMouseEvent', {
        type, x, y, button, buttons: button === 'left' ? 1 : button === 'right' ? 2 : 0,
        clickCount, modifiers,
      });
    },

    async click(x, y, { button = 'left', modifiers = 0 } = {}) {
      await page.mouse('mouseMoved', x, y, { button: 'none', modifiers });
      await page.mouse('mousePressed', x, y, { button, clickCount: 1, modifiers });
      await page.mouse('mouseReleased', x, y, { button, clickCount: 1, modifiers });
    },

    async rightClick(x, y) {
      await page.mouse('mouseMoved', x, y, { button: 'none' });
      await page.mouse('mousePressed', x, y, { button: 'right', clickCount: 1 });
      await page.mouse('mouseReleased', x, y, { button: 'right', clickCount: 1 });
    },

    async hover(x, y) { await page.mouse('mouseMoved', x, y, { button: 'none' }); },

    async drag(x0, y0, x1, y1, steps = 12) {
      await page.mouse('mousePressed', x0, y0, { button: 'left', clickCount: 1 });
      for (let i = 1; i <= steps; i++) {
        await page.mouse('mouseMoved', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, { button: 'left' });
        await sleep(16);
      }
      return {
        async release() {
          await page.mouse('mouseReleased', x1, y1, { button: 'left', clickCount: 1 });
        },
      };
    },

    // Touch, for the long-press path. Ars Electronica is a touch screen, and
    // long-press is a different code path from right-click. Chrome will not
    // deliver dispatchTouchEvent unless touch emulation is on.
    async enableTouch(maxTouchPoints = 5) {
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints });
    },

    async touch(type, x, y) {
      await send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 12, radiusY: 12, force: 1 }],
      });
    },

    async longPress(x, y, holdMs = 800) {
      await page.touch('touchStart', x, y);
      await sleep(holdMs);
      await page.touch('touchEnd', x, y);
    },

    async type(text) {
      for (const ch of text) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
        await sleep(12);
      }
    },

    async key(key, code, windowsVirtualKeyCode) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode });
    },

    // Deterministic mode only: run exactly n virtual frames.
    async pump(n = 1) { return page.eval(`window.__pump(${n})`); },

    // Poll like waitFor, but keep the virtual clock moving between polls —
    // nothing in a deterministic page advances on its own.
    async waitForPumped(expression, { timeoutMs = 30000, framesPerPoll = 8, label } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        try { if (await page.eval(expression)) return true; } catch { /* pre-boot */ }
        try { await page.pump(framesPerPoll); } catch { /* shim not up yet */ }
        await sleep(20);
      }
      throw new Error(`waitForPumped timed out: ${label ?? expression}`);
    },

    async frameCosts() { return page.eval('window.__frameCosts()'); },
    async resetCosts() { return page.eval('window.__resetCosts()'); },

    async setViewport(w, h, scale = 1) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: scale, mobile: false,
      });
    },

    consoleErrors() {
      return events
        .filter(e => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
        .map(e => e.params.entry.text);
    },

    async close() {
      try { ws.close(); } catch { /* already gone */ }
      try { proc.kill(); } catch { /* already gone */ }
      await sleep(300);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };

  if (url) await page.goto(url);
  return page;
}
