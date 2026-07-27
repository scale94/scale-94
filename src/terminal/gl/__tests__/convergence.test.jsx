// convergence.test.jsx — machine-checks the flag list itself.
//
// Phase 1 (tasks 3-8) turned three renderers' invisible differences into an
// enumerated set of `useShaderCanvas` options — see
// docs/superpowers/specs/2026-07-26-shared-gl-harness-design.md, "The
// flags", and the phase 2 plan in
// docs/superpowers/specs/2026-07-26-shared-gl-harness-phase2-backlog.md.
// That table is only worth having if it cannot silently go stale: this file
// asserts TODAY's DELIBERATE divergence, one flag per test, so that when
// phase 2 converges a flag the test named after it fails and the change has
// to be acknowledged (backlog item checked off, assertion updated) rather
// than slipping through unreviewed.
//
// No GL runs here. `useShaderCanvas` is mocked outright and this file
// captures the exact options object each component hands it — a config
// divergence can never hide behind a GL side effect the way it could in a
// call-log snapshot. Expected values below were read directly from
// MercuryTerminator.jsx / ObserverEye.jsx / LunarShaderMoon.jsx as they
// exist today, not copied from the task brief's table (the brief's table
// and the code agree in every case checked — see the task report for the
// one wording nuance that needed reconciling).

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const { captured } = vi.hoisted(() => ({ captured: new Map() }));

vi.mock('../useShaderCanvas', () => ({
  useShaderCanvas: (_ref, opts) => {
    captured.set(opts.label, opts);
    return { snap: () => {} };
  },
}));

import MercuryTerminator from '../../components/MercuryTerminator';
import ObserverEye from '../../components/ObserverEye';
import LunarShaderMoon from '../../lunar/LunarShaderMoon';

afterEach(cleanup);
beforeEach(() => captured.clear());

// Defaults the harness itself declares (useShaderCanvas.js / glHost.js). A
// component that omits a key inherits these, so "effective" value — not
// merely "the key it bothered to spell out" — is what actually governs
// behavior and is what this file compares.
//
// HAND-MAINTAINED MIRROR. This duplicates the real defaults rather than
// importing them, so that a default silently changing upstream shows up
// here as a failure instead of being absorbed. That is deliberate — but it
// means the duplication is only useful if it stays honest: if you change a
// default in useShaderCanvas.js or glHost.js, update this block in the same
// commit. Left to drift, it reintroduces in miniature exactly the
// invisible-divergence problem this whole phase exists to close.
const HARNESS_DEFAULTS = {
  version: 1,
  contextOptions: {},
  setStyleSize: false,
  blend: 'straight',
  loseContextOnDispose: true,
  strategy: 'legacy',
  initialDraw: true,
  dtClamp: 0.05,
  seedLast: 'now',
  watchdogMs: 40,
  trackVisibility: false,
  haltOnReducedMotion: true,
};

function effective(opts, key) {
  return opts[key] === undefined ? HARNESS_DEFAULTS[key] : opts[key];
}

function configFor(label) {
  const opts = captured.get(label);
  if (!opts) {
    throw new Error(
      `useShaderCanvas was never called with label "${label}" — the ` +
      `component no longer wires the shared harness the way this test expects.`
    );
  }
  return opts;
}

describe('gl harness convergence — flags deliberately still diverge (phase 1)', () => {
  let M, O, L;

  beforeEach(() => {
    render(<MercuryTerminator twilight={0.3} day={0.1} size={180} />);
    render(<ObserverEye state="armed" size={28} />);
    render(
      <LunarShaderMoon lunarAge={7.4} illumination={0.5}
        timestamp={Date.UTC(2026, 6, 22)} size={340} />
    );
    M = configFor('MercuryTerminator');
    O = configFor('ObserverEye');
    L = configFor('moonShader');
  });

  // Backlog #7 — version / contextOptions / blend: decide whether WebGL2 +
  // premultiplied becomes the house standard.
  it('backlog #7a — version: eye/terminator on WebGL1, moon on WebGL2', () => {
    expect(effective(M, 'version'), 'MercuryTerminator.version converged toward the moon').toBe(1);
    expect(effective(O, 'version'), 'ObserverEye.version converged toward the moon').toBe(1);
    expect(effective(L, 'version'), 'LunarShaderMoon.version converged toward the eye/terminator').toBe(2);
  });

  it('backlog #7b — contextOptions: moon alone is premultiplied/AA-off/low-power', () => {
    const legacyOptions = { alpha: true, premultipliedAlpha: false, antialias: true };
    const lunarOptions = {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: 'low-power',
    };
    expect(effective(M, 'contextOptions'), 'MercuryTerminator.contextOptions converged').toEqual(legacyOptions);
    expect(effective(O, 'contextOptions'), 'ObserverEye.contextOptions converged').toEqual(legacyOptions);
    expect(effective(L, 'contextOptions'), 'LunarShaderMoon.contextOptions converged').toEqual(lunarOptions);
  });

  it('backlog #7c — blend: straight for eye/terminator, premultiplied for the moon', () => {
    expect(effective(M, 'blend'), 'MercuryTerminator.blend converged').toBe('straight');
    expect(effective(O, 'blend'), 'ObserverEye.blend converged').toBe('straight');
    expect(effective(L, 'blend'), 'LunarShaderMoon.blend converged').toBe('premultiplied');
  });

  // Backlog #1 — strategy: collapse 'legacy' into 'lunar' for real
  // compile/link error surfacing on the eye and terminator.
  it('backlog #1 — strategy: legacy for eye/terminator, lunar for the moon', () => {
    expect(effective(M, 'strategy'), 'MercuryTerminator.strategy converged to lunar').toBe('legacy');
    expect(effective(O, 'strategy'), 'ObserverEye.strategy converged to lunar').toBe('legacy');
    expect(effective(L, 'strategy'), 'LunarShaderMoon.strategy converged to legacy').toBe('lunar');
  });

  // Backlog #8 — setStyleSize: unify how the canvas is sized.
  it('backlog #8 — setStyleSize: only the moon writes canvas.style dimensions', () => {
    expect(effective(M, 'setStyleSize'), 'MercuryTerminator.setStyleSize converged').toBe(false);
    expect(effective(O, 'setStyleSize'), 'ObserverEye.setStyleSize converged').toBe(false);
    expect(effective(L, 'setStyleSize'), 'LunarShaderMoon.setStyleSize converged').toBe(true);
  });

  // Backlog #3 — loseContextOnDispose: give the moon `true`. This is the
  // one flag with a runtime-observable proxy (teardown emits `loseContext`
  // or it does not) — see the falsification note in the task report.
  it('backlog #3 — loseContextOnDispose: eye/terminator release the GL context, the moon does not', () => {
    expect(effective(M, 'loseContextOnDispose'), 'MercuryTerminator.loseContextOnDispose converged').toBe(true);
    expect(effective(O, 'loseContextOnDispose'), 'ObserverEye.loseContextOnDispose converged').toBe(true);
    expect(effective(L, 'loseContextOnDispose'), 'LunarShaderMoon.loseContextOnDispose converged (moon should now release its context)').toBe(false);
  });

  // Backlog #2 — watchdogMs: give the moon 40. It is the only one of the
  // three that cannot be driven from a suspended-rAF preview pane.
  it('backlog #2 — watchdogMs: eye/terminator have the 40ms watchdog, the moon has none', () => {
    expect(effective(M, 'watchdogMs'), 'MercuryTerminator.watchdogMs converged').toBe(40);
    expect(effective(O, 'watchdogMs'), 'ObserverEye.watchdogMs converged').toBe(40);
    expect(effective(L, 'watchdogMs'), 'LunarShaderMoon.watchdogMs converged (moon should now have the watchdog)').toBe(null);
  });

  // Backlog #9 — trackVisibility: decide whether all three pause work when
  // the tab is hidden.
  it('backlog #9 — trackVisibility: only the moon tracks document.visibilitychange', () => {
    expect(effective(M, 'trackVisibility'), 'MercuryTerminator.trackVisibility converged').toBe(false);
    expect(effective(O, 'trackVisibility'), 'ObserverEye.trackVisibility converged').toBe(false);
    expect(effective(L, 'trackVisibility'), 'LunarShaderMoon.trackVisibility converged').toBe(true);
  });

  // Backlog #4 — reducedMotion policy: eye/terminator halt the loop and
  // expose a snap-repaint (haltOnReducedMotion + onSnap); the moon keeps
  // looping and freezes its own time uniform inside `draw` instead
  // (haltOnReducedMotion: false, no onSnap needed).
  it('backlog #4 — reducedMotion policy: eye/terminator halt+snap, the moon runs+freezes', () => {
    expect(effective(M, 'haltOnReducedMotion'), 'MercuryTerminator.haltOnReducedMotion converged').toBe(true);
    expect(typeof M.onSnap, 'MercuryTerminator lost its onSnap repaint').toBe('function');

    expect(effective(O, 'haltOnReducedMotion'), 'ObserverEye.haltOnReducedMotion converged').toBe(true);
    expect(typeof O.onSnap, 'ObserverEye lost its onSnap repaint').toBe('function');

    expect(effective(L, 'haltOnReducedMotion'), 'LunarShaderMoon.haltOnReducedMotion converged to halt').toBe(false);
    expect(L.onSnap == null, 'LunarShaderMoon gained an onSnap — reducedMotion policy converged').toBe(true);
  });

  // Backlog #5 — dtClamp / seedLast: pure drift, no design intent behind
  // 0.05 vs 0.25 or 'now' vs 'zero'.
  it('backlog #5 — dtClamp/seedLast: eye/terminator clamp tighter and seed from "now"', () => {
    expect(effective(M, 'dtClamp'), 'MercuryTerminator.dtClamp converged').toBe(0.05);
    expect(effective(M, 'seedLast'), 'MercuryTerminator.seedLast converged').toBe('now');
    expect(effective(O, 'dtClamp'), 'ObserverEye.dtClamp converged').toBe(0.05);
    expect(effective(O, 'seedLast'), 'ObserverEye.seedLast converged').toBe('now');
    expect(effective(L, 'dtClamp'), 'LunarShaderMoon.dtClamp converged').toBe(0.25);
    expect(effective(L, 'seedLast'), 'LunarShaderMoon.seedLast converged').toBe('zero');
  });

  // Backlog #6 — initialDraw: decide whether a synchronous first paint is
  // wanted. Forcing the moon's loop-only behavior onto the eye risks a
  // one-frame blank on slow mounts.
  it('backlog #6 — initialDraw: eye/terminator paint synchronously at mount, the moon does not', () => {
    expect(effective(M, 'initialDraw'), 'MercuryTerminator.initialDraw converged').toBe(true);
    expect(effective(O, 'initialDraw'), 'ObserverEye.initialDraw converged').toBe(true);
    expect(effective(L, 'initialDraw'), 'LunarShaderMoon.initialDraw converged').toBe(false);
  });

  // Backlog #10 — onUnsupported: keep as a genuine capability hook, but
  // give the eye and terminator a fallback. Today only the moon has one.
  it('backlog #10 — onUnsupported: only the moon has a no-WebGL fallback today', () => {
    expect(M.onUnsupported == null, 'MercuryTerminator gained an onUnsupported fallback').toBe(true);
    expect(O.onUnsupported == null, 'ObserverEye gained an onUnsupported fallback').toBe(true);
    expect(typeof L.onUnsupported, 'LunarShaderMoon lost its onUnsupported fallback').toBe('function');
  });
});
