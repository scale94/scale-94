import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSolStar } from '../useSolStar';
import { tensionG } from '../solPhysics';
import { STAR_RADIUS_NDC, viewNormal } from '../solCamera';

const RECT = { left: 0, top: 0, width: 800, height: 600 };
const CX = 400;
const CY = 300;

function setup() {
  const onSnap = vi.fn();
  const target = {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    getBoundingClientRect: () => RECT,
  };
  const { result } = renderHook(() => useSolStar({ onSnap, getRect: () => RECT }));
  const api = result.current;
  // Deterministic: no star-born regions, so a grab always births a fresh hand region.
  api._debug().star.regions = [];
  const ev = (x, y, pointerId = 1) => ({ pointerId, clientX: x, clientY: y, button: 0, currentTarget: target });
  return { api, onSnap, target, ev };
}

// Clockwise as seen (screen y down): angle increases right -> down -> left -> up.
function circle(api, ev, { cx = CX, cy = CY, r = 60, turns, dir = 1, steps = 32, pointerId = 1 }) {
  api.handlers.onPointerMove(ev(cx + r, cy, pointerId));
  const n = Math.round(turns * steps);
  for (let k = 1; k <= n; k++) {
    const a = dir * (k / steps) * 2 * Math.PI;
    api.handlers.onPointerMove(ev(cx + r * Math.cos(a), cy + r * Math.sin(a), pointerId));
  }
}

const heldRegions = (api) => api._debug().star.regions.filter((r) => r.held);

function allFinite(u) {
  for (const v of Object.values(u)) {
    if (typeof v === 'number') { if (!Number.isFinite(v)) return false; }
    else if (ArrayBuffer.isView(v) || Array.isArray(v)) {
      for (const x of v) if (!Number.isFinite(x)) return false;
    }
  }
  return true;
}

describe('useSolStar', () => {
  it('two clockwise circles around the grab point wind two turns and raise tension', () => {
    const { api, ev } = setup();
    api.handlers.onPointerDown(ev(CX, CY));
    circle(api, ev, { turns: 2 });
    const held = heldRegions(api);
    expect(held).toHaveLength(1);
    expect(held[0].handTurns).toBeCloseTo(2, 1);
    expect(Math.abs(held[0].handTurns - 2)).toBeLessThan(0.05);
    expect(api.hud().tensionG).toBeGreaterThan(tensionG(0));
  });

  it('a drag that starts off the disc orbits the camera and holds nothing', () => {
    const { api, ev } = setup();
    const yaw0 = api.uniforms().uCamYaw;
    api.handlers.onPointerDown(ev(20, 20));
    api.handlers.onPointerMove(ev(80, 40));
    expect(heldRegions(api)).toHaveLength(0);
    expect(api._debug().star.regions).toHaveLength(0);
    expect(api.uniforms().uCamYaw).not.toBe(yaw0);
  });

  it('only the first pointer stirs: a second pointerId is ignored', () => {
    const { api, ev } = setup();
    api.handlers.onPointerDown(ev(CX, CY, 1));
    const first = heldRegions(api)[0];
    api.handlers.onPointerDown(ev(CX + 100, CY - 50, 2));
    expect(api._debug().star.regions).toHaveLength(1);
    circle(api, ev, { cx: CX + 100, cy: CY - 50, turns: 1, pointerId: 2 });
    api.handlers.onPointerUp(ev(CX + 100, CY - 50, 2));
    const still = heldRegions(api);
    expect(still).toHaveLength(1);
    expect(still[0].id).toBe(first.id);
    expect(still[0].handTurns).toBe(0);
  });

  it.each(['onPointerUp', 'onPointerCancel', 'onLostPointerCapture'])('%s ends the stir', (name) => {
    const { api, ev } = setup();
    api.handlers.onPointerDown(ev(CX, CY));
    circle(api, ev, { turns: 0.5 });
    expect(heldRegions(api)).toHaveLength(1);
    api.handlers[name](ev(CX, CY));
    expect(heldRegions(api)).toHaveLength(0);
    // and the pointer slot is free again: a new grab works
    api.handlers.onPointerDown(ev(CX, CY, 7));
    expect(heldRegions(api)).toHaveLength(1);
  });

  it('six clockwise circles snap once while still held, cw, facing at the centre', () => {
    const { api, ev, onSnap } = setup();
    api.handlers.onPointerDown(ev(CX, CY));
    circle(api, ev, { turns: 6.5 });
    expect(onSnap).toHaveBeenCalledTimes(1);
    const e = onSnap.mock.calls[0][0];
    expect(e.handedness).toBe('cw');
    expect(e.origin).toBe('hand');
    expect(e.facing).toBe(true);
    expect(heldRegions(api)).toHaveLength(0);
    // moves after the snap do nothing; pointer-up does not snap again
    circle(api, ev, { turns: 2 });
    api.handlers.onPointerUp(ev(CX, CY));
    expect(onSnap).toHaveBeenCalledTimes(1);
  });

  it('counter-clockwise circles snap ccw', () => {
    const { api, ev, onSnap } = setup();
    api.handlers.onPointerDown(ev(CX, CY));
    circle(api, ev, { turns: 6.5, dir: -1 });
    expect(onSnap).toHaveBeenCalledTimes(1);
    expect(onSnap.mock.calls[0][0].handedness).toBe('ccw');
  });

  it('a grab point carried past the limb snaps on release with facing false and no NaN uniform', () => {
    const { api, ev, onSnap } = setup();
    api.handlers.onPointerDown(ev(CX, CY));
    circle(api, ev, { turns: 2 });
    // 100 s at the equator carries the point ~2 rad round: behind the limb
    api.frame(100);
    expect(onSnap).not.toHaveBeenCalled();
    expect(allFinite(api.uniforms())).toBe(true);
    api.handlers.onPointerUp(ev(CX + 60, CY));
    expect(onSnap).toHaveBeenCalledTimes(1);
    expect(onSnap.mock.calls[0][0].facing).toBe(false);
    expect(allFinite(api.uniforms())).toBe(true);
  });

  it('forwards the star\'s own snaps from frame() with a facing flag', () => {
    const { api, onSnap } = setup();
    const { star } = api._debug();
    star.regions = [{ id: 1, lat: 0.2, lon: 0, starTurns: 5.999, handTurns: 0, held: false, born: 'star' }];
    api.frame(1);
    expect(onSnap).toHaveBeenCalledTimes(1);
    expect(onSnap.mock.calls[0][0].origin).toBe('star');
    expect(typeof onSnap.mock.calls[0][0].facing).toBe('boolean');
  });

  it.each([
    [0.3, 1, 2], [0.3, -1, -2], [-0.3, 1, 2], [-0.3, -1, -2],
  ])('a stir on a star region at lat %s (dir %s) shows twist %s whatever its own winding', (lat, dir, want) => {
    const { api, ev } = setup();
    const { star } = api._debug();
    star.regions = [{ id: 1, lat, lon: 0, starTurns: 3, handTurns: 0, held: false, born: 'star' }];
    const t0 = api.uniforms().uRegionTension[0];
    expect(api.uniforms().uRegionTwist[0]).toBe(0);
    // the region's screen position at rest: straight above/below the centre
    const radius = (STAR_RADIUS_NDC * 600) / 2;
    const py = CY - Math.sin(lat) * radius;
    api.handlers.onPointerDown(ev(CX, py));
    expect(heldRegions(api).map((r) => r.id)).toEqual([1]);
    circle(api, ev, { cx: CX, cy: py, turns: 2, dir, r: 50 });
    const u = api.uniforms();
    expect(Math.abs(u.uRegionTwist[0] - want)).toBeLessThan(0.05);
    expect(u.uRegionTension[0]).toBeGreaterThan(t0);
  });

  it('untouched star regions carry no twist', () => {
    const onSnap = vi.fn();
    const { result } = renderHook(() => useSolStar({ onSnap, getRect: () => RECT }));
    const api = result.current;
    api.frame(1);
    const u = api.uniforms();
    expect(u.uRegionCount).toBeGreaterThan(0);
    for (let i = 0; i < u.uRegionCount; i++) expect(u.uRegionTwist[i]).toBe(0);
  });

  it('the stir centre rides with the rotation', () => {
    const { api, ev } = setup();
    api.handlers.onPointerDown(ev(CX, CY));
    const id = heldRegions(api)[0].id;
    api.frame(30);
    const r = api._debug().star.regions.find((x) => x.id === id);
    const n = viewNormal(api._debug().cam, r.lat, r.lon, 0);
    const radius = (STAR_RADIUS_NDC * 600) / 2;
    const cx = CX + n[0] * radius;
    const cy = CY - n[1] * radius;
    expect(cx - CX).toBeGreaterThan(80); // it really moved; the old centre lies outside the circle
    // follow the point to its new place (the hand travels with it, through the deadzone)
    api.handlers.onPointerMove(ev(cx, cy));
    circle(api, ev, { cx, cy, turns: 2, r: 40 });
    expect(Math.abs(r.handTurns - 2)).toBeLessThan(0.05);
  });

  it('uniforms() reuses one object', () => {
    const { api } = setup();
    expect(api.uniforms()).toBe(api.uniforms());
  });

  it('a page scroll mid-drag: the rect is re-read, the stir still winds around the region', () => {
    const onSnap = vi.fn();
    const rect = { left: 0, top: 0, width: 800, height: 600 };
    const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true };
    const { result } = renderHook(() => useSolStar({ onSnap, getRect: () => rect }));
    const api = result.current;
    api._debug().star.regions = [];
    const ev = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, button: 0, currentTarget: target });
    api.handlers.onPointerDown(ev(CX, CY));
    rect.top = -150; // the page scrolled: the canvas moved up 150 px under the pointer
    circle(api, ev, { cx: CX, cy: CY - 150, turns: 2 });
    expect(Math.abs(heldRegions(api)[0].handTurns - 2)).toBeLessThan(0.05);
  });

  it('a failed pointer capture: pointerleave ends the hold and frees the pointer', () => {
    const onSnap = vi.fn();
    const target = {
      setPointerCapture: () => { throw new Error('no capture'); },
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => false,
    };
    const { result } = renderHook(() => useSolStar({ onSnap, getRect: () => RECT }));
    const api = result.current;
    api._debug().star.regions = [];
    const ev = (x, y, pointerId = 1) => ({ pointerId, clientX: x, clientY: y, button: 0, currentTarget: target });
    api.handlers.onPointerDown(ev(CX, CY));
    expect(heldRegions(api)).toHaveLength(1);
    api.handlers.onPointerLeave(ev(CX + 500, CY));
    expect(heldRegions(api)).toHaveLength(0);
    api.handlers.onPointerDown(ev(CX, CY, 2));
    expect(heldRegions(api)).toHaveLength(1);
  });

  it('with capture held, pointerleave does not end the stir', () => {
    const { api, ev } = setup();
    api.handlers.onPointerDown(ev(CX, CY));
    api.handlers.onPointerLeave(ev(CX + 500, CY));
    expect(heldRegions(api)).toHaveLength(1);
  });

  it('rate independence: 60 frames of 1/60 s and 360 of 1/360 s leave the same star and camera', () => {
    function run(hz) {
      const onSnap = vi.fn();
      const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true };
      const { result } = renderHook(() => useSolStar({ onSnap, getRect: () => RECT }));
      const api = result.current;
      const { star } = api._debug();
      star.regions = [
        { id: 1, lat: 0.1, lon: 0.05, starTurns: 2, handTurns: 0, held: false, born: 'star' },
        { id: 2, lat: -0.4, lon: 1.2, starTurns: 1, handTurns: 0.8, held: false, born: 'star' },
      ];
      star.nextId = 3;
      const ev = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, button: 0, currentTarget: target });
      const per = hz / 60; // frames between pointer events (pointer at 60 Hz in both runs)
      // an orbit fling, then 1 s of coast
      api.handlers.onPointerDown(ev(20, 20));
      api.handlers.onPointerMove(ev(23, 21));
      api.handlers.onPointerUp(ev(23, 21));
      for (let k = 0; k < hz; k++) api.frame(1 / hz);
      // a stir around the region's centre: one pointer event every 1/60 s
      const r1 = star.regions.find((r) => r.id === 1);
      const n0 = viewNormal(api._debug().cam, r1.lat, r1.lon, 0);
      const radius = (STAR_RADIUS_NDC * 600) / 2;
      const cx = CX + n0[0] * radius;
      const cy = CY - n0[1] * radius;
      api.handlers.onPointerDown(ev(cx, cy));
      for (let k = 0; k <= 60; k++) {
        const a = (k / 30) * 2 * Math.PI;
        api.handlers.onPointerMove(ev(cx + 50 * Math.cos(a), cy + 50 * Math.sin(a)));
        if (k < 60) for (let j = 0; j < per; j++) api.frame(1 / hz);
      }
      // still held: the region keeps its wound twist
      const u = api.uniforms();
      return {
        regions: star.regions.map((r) => [r.handTurns, r.starTurns]),
        yaw: api._debug().cam.yaw,
        u: {
          yaw: u.uCamYaw, pitch: u.uCamPitch, count: u.uRegionCount,
          pos: Array.from(u.uRegionPos), twist: Array.from(u.uRegionTwist), tension: Array.from(u.uRegionTension),
        },
        snaps: onSnap.mock.calls.length,
      };
    }
    const a = run(60);
    const b = run(360);
    expect(a.snaps).toBe(b.snaps);
    expect(a.regions.length).toBe(b.regions.length);
    expect(Math.abs(a.regions[0][0])).toBeGreaterThan(0.5); // the stir really wound
    a.regions.forEach((ra, i) => {
      expect(Math.abs(ra[0] - b.regions[i][0])).toBeLessThan(1e-6);
      expect(Math.abs(ra[1] - b.regions[i][1])).toBeLessThan(1e-6);
    });
    expect(Math.abs(a.yaw - b.yaw)).toBeLessThan(1e-6);
    expect(a.u.count).toBe(b.u.count);
    for (const k of ['yaw', 'pitch']) expect(Math.abs(a.u[k] - b.u[k])).toBeLessThan(1e-6);
    for (const k of ['pos', 'twist', 'tension']) {
      a.u[k].forEach((v, i) => expect(Math.abs(v - b.u[k][i])).toBeLessThan(1e-6));
    }
  });

  describe('reduced motion', () => {
    function setupRM() {
      const onSnap = vi.fn();
      const requestDraw = vi.fn();
      const clock = { t: 1000 };
      const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true };
      const { result } = renderHook(() => useSolStar({
        onSnap, getRect: () => RECT, reducedMotion: true, requestDraw, now: () => clock.t,
      }));
      const api = result.current;
      api._debug().star.regions = [];
      // every pointer event is 10 ms after the last
      const ev = (x, y, pointerId = 1) => {
        clock.t += 10;
        return { pointerId, clientX: x, clientY: y, button: 0, currentTarget: target };
      };
      return { api, onSnap, requestDraw, clock, ev };
    }

    it('pointer moves alone wind the region and request draws', () => {
      const { api, requestDraw, ev } = setupRM();
      api.handlers.onPointerDown(ev(CX, CY));
      circle(api, ev, { turns: 2 });
      expect(Math.abs(heldRegions(api)[0].handTurns - 2)).toBeLessThan(0.05);
      expect(requestDraw.mock.calls.length).toBeGreaterThanOrEqual(64);
    });

    it('the star does not wind or turn itself: sixty seconds of frames, no snap', () => {
      const { api, onSnap } = setupRM();
      const { star } = api._debug();
      star.regions = [{ id: 1, lat: 0.2, lon: 0.3, starTurns: 5.999, handTurns: 0, held: false, born: 'star' }];
      for (let i = 0; i < 60; i++) api.frame(1);
      expect(onSnap).not.toHaveBeenCalled();
      expect(star.regions[0].starTurns).toBe(5.999);
      expect(star.regions[0].lon).toBe(0.3);
    });

    it('a long stir steps without self-winding or turning, and decays a released twist', () => {
      const { api, ev, clock } = setupRM();
      const { star } = api._debug();
      star.regions = [
        { id: 1, lat: 0, lon: 0, starTurns: 3, handTurns: 0, held: false, born: 'star' },
        { id: 2, lat: 0.5, lon: 2.5, starTurns: 1, handTurns: 1, held: false, born: 'star' },
      ];
      star.nextId = 3;
      api.handlers.onPointerDown(ev(CX, CY));
      clock.t += 5000; // a pause longer than the clamp: steps at most 0.05 s
      circle(api, ev, { turns: 1 });
      const [r1, r2] = star.regions;
      expect(r1.starTurns).toBe(3);
      expect(r1.lon).toBe(0);
      expect(r2.lon).toBe(2.5);
      expect(r2.handTurns).toBeLessThan(1);        // the slip ran on the pointer clock
      expect(r2.handTurns).toBeGreaterThan(0.5);   // ~0.4 s of clock, not 5 s
      expect(Math.abs(r1.handTurns - 1)).toBeLessThan(0.05);
    });

    it('a held stir past the threshold still snaps', () => {
      const { api, ev, onSnap } = setupRM();
      api.handlers.onPointerDown(ev(CX, CY));
      circle(api, ev, { turns: 6.5 });
      expect(onSnap).toHaveBeenCalledTimes(1);
      expect(onSnap.mock.calls[0][0].origin).toBe('hand');
    });

    it('an orbit drag moves the camera with no coast and requests a draw', () => {
      const { api, ev, requestDraw } = setupRM();
      const yaw0 = api.uniforms().uCamYaw;
      api.handlers.onPointerDown(ev(20, 20));
      requestDraw.mockClear();
      api.handlers.onPointerMove(ev(80, 40));
      api.handlers.onPointerUp(ev(80, 40));
      const yaw1 = api.uniforms().uCamYaw;
      expect(yaw1).not.toBe(yaw0);
      expect(requestDraw).toHaveBeenCalled();
      const { cam } = api._debug();
      expect(cam.yawVel).toBe(0);
      expect(cam.pitchVel).toBe(0);
      api.frame(1);
      expect(api.uniforms().uCamYaw).toBe(yaw1);
    });
  });

  it('uniforms carry region slots and stay finite on hostile input', () => {
    const { api, ev } = setup();
    api.handlers.onPointerDown(ev(CX, CY));
    circle(api, ev, { turns: 1 });
    api.handlers.onPointerMove(ev(NaN, Infinity));
    api.frame(NaN);
    api.frame(-1);
    const u = api.uniforms();
    expect(u.uRegionCount).toBe(1);
    expect(u.uRegionPos).toHaveLength(18);
    expect(u.uRegionTwist).toHaveLength(6);
    expect(u.uRegionTension).toHaveLength(6);
    expect(u.uRegionTwist[0]).toBeCloseTo(1, 1);
    expect(u.uRotLon).toBe(0);
    expect(allFinite(u)).toBe(true);
  });
});
