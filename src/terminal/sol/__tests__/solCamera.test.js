import { describe, it, expect } from 'vitest'
import { STAR_RADIUS_NDC, createCamera, orbitDrag, stepCamera, holdCamera, pick, viewNormal } from '../solCamera.js'

const close = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('createCamera', () => {
  it('starts at rest', () => {
    expect(createCamera()).toEqual({ yaw: 0, pitch: 0, yawVel: 0, pitchVel: 0 })
  })
})

describe('viewNormal', () => {
  it('(0,0) faces the viewer on a fresh camera', () => {
    const n = viewNormal(createCamera(), 0, 0, 0)
    close(n[0], 0); close(n[1], 0); close(n[2], 1)
  })
  it('yaw = PI turns (0,0) away', () => {
    const cam = createCamera(); cam.yaw = Math.PI
    close(viewNormal(cam, 0, 0, 0)[2], -1)
  })
  it('rotLon moves a point toward +x (lon + rotLon)', () => {
    const n = viewNormal(createCamera(), 0, 0, 0.5)
    close(n[0], Math.sin(0.5)); close(n[2], Math.cos(0.5))
  })
  it('positive pitch tilts the north pole toward the viewer', () => {
    const cam = createCamera(); cam.pitch = 0.4
    const n = viewNormal(cam, Math.PI / 2, 0, 0)
    close(n[1], Math.cos(0.4)); close(n[2], Math.sin(0.4))
  })
  it('is unit length', () => {
    const cam = { yaw: 0.7, pitch: -0.5, yawVel: 0, pitchVel: 0 }
    const n = viewNormal(cam, 0.3, -1.1, 0.9)
    close(Math.hypot(...n), 1)
  })
})

describe('orbitDrag', () => {
  it('drag right moves the centre point to the right', () => {
    const cam = createCamera()
    orbitDrag(cam, 10, 0, 600)
    expect(viewNormal(cam, 0, 0, 0)[0]).toBeGreaterThan(0)
  })
  it('drag down moves the centre point down', () => {
    const cam = createCamera()
    orbitDrag(cam, 0, 10, 600)
    expect(viewNormal(cam, 0, 0, 0)[1]).toBeLessThan(0)
  })
  it('a full short side is PI radians', () => {
    const cam = createCamera()
    orbitDrag(cam, 300, 0, 600)
    close(Math.abs(cam.yaw), Math.PI / 2)
  })
  it('sets velocities as the delta over 1/60 s, clamped to 6 rad/s', () => {
    const cam = createCamera()
    orbitDrag(cam, 1, 1, 600)
    close(Math.abs(cam.yawVel), (Math.PI / 600) * 60)
    close(cam.pitchVel, (Math.PI / 600) * 60)
    orbitDrag(cam, 500, 500, 600)
    expect(Math.abs(cam.yawVel)).toBe(6)
    expect(cam.pitchVel).toBe(6)
  })
  it('ignores non-finite or non-positive input', () => {
    const cam = createCamera()
    orbitDrag(cam, NaN, 5, 600)
    orbitDrag(cam, 5, 5, 0)
    expect(Number.isFinite(cam.yaw) && Number.isFinite(cam.pitch)).toBe(true)
  })
})

describe('stepCamera', () => {
  it('coasts, decays monotonically', () => {
    const cam = { yaw: 0, pitch: 0, yawVel: 3, pitchVel: 0 }
    let prevV = cam.yawVel, prevYaw = cam.yaw
    for (let i = 0; i < 50; i++) {
      stepCamera(cam, 0.02)
      expect(cam.yawVel).toBeLessThan(prevV)
      expect(cam.yaw).toBeGreaterThan(prevYaw)
      prevV = cam.yawVel; prevYaw = cam.yaw
    }
  })
  it('one 0.1 s step equals ten 0.01 s steps', () => {
    const a = { yaw: 0, pitch: 0, yawVel: 4, pitchVel: -2 }
    const b = { ...a }
    stepCamera(a, 0.1)
    for (let i = 0; i < 10; i++) stepCamera(b, 0.01)
    expect(Math.abs(a.yaw - b.yaw)).toBeLessThan(1e-6)
    expect(Math.abs(a.pitch - b.pitch)).toBeLessThan(1e-6)
    expect(Math.abs(a.yawVel - b.yawVel)).toBeLessThan(1e-6)
  })
  it('clamps pitch to +-1.2 and zeroes pitchVel', () => {
    const cam = { yaw: 0, pitch: 1.19, yawVel: 0, pitchVel: 5 }
    stepCamera(cam, 0.5)
    expect(cam.pitch).toBe(1.2)
    expect(cam.pitchVel).toBe(0)
    const c2 = { yaw: 0, pitch: -1.19, yawVel: 0, pitchVel: -5 }
    stepCamera(c2, 0.5)
    expect(c2.pitch).toBe(-1.2)
    expect(c2.pitchVel).toBe(0)
  })
  it('treats non-finite dt and velocity as 0', () => {
    const cam = { yaw: 1, pitch: 0.5, yawVel: 2, pitchVel: 1 }
    stepCamera(cam, NaN)
    expect(cam.yaw).toBe(1)
    const c2 = { yaw: 1, pitch: 0.5, yawVel: NaN, pitchVel: Infinity }
    stepCamera(c2, 0.1)
    expect(c2.yaw).toBe(1)
    expect(c2.pitch).toBe(0.5)
    expect(Number.isFinite(c2.yawVel) && Number.isFinite(c2.pitchVel)).toBe(true)
  })
})

describe('pick', () => {
  const W = 800, H = 600
  const R = (STAR_RADIUS_NDC * Math.min(W, H)) / 2
  it('centre of a fresh camera is (0,0)', () => {
    const r = pick(createCamera(), 400, 300, W, H, 0)
    close(r.lat, 0); close(r.lon, 0)
  })
  it('0.9 x the short half-side is off the disc', () => {
    expect(pick(createCamera(), 400 + 0.9 * 300, 300, W, H, 0)).toBeNull()
  })
  it('uses the short side on a non-square canvas', () => {
    expect(pick(createCamera(), 400 + R * 0.99, 300, W, H, 0)).not.toBeNull()
    expect(pick(createCamera(), 400 + R * 1.01, 300, W, H, 0)).toBeNull()
    expect(pick(createCamera(), 400, 300 - R * 1.01, W, H, 0)).toBeNull()
  })
  it('the limb is finite or null, never NaN', () => {
    for (const [px, py] of [[400 + R, 300], [400 - R, 300], [400, 300 + R], [400, 300 - R]]) {
      const r = pick(createCamera(), px, py, W, H, 0)
      if (r) { expect(Number.isFinite(r.lat)).toBe(true); expect(Number.isFinite(r.lon)).toBe(true) }
    }
  })
  it('up on screen is north, right is +lon', () => {
    expect(pick(createCamera(), 400, 300 - R / 2, W, H, 0).lat).toBeGreaterThan(0)
    expect(pick(createCamera(), 400 + R / 2, 300, W, H, 0).lon).toBeGreaterThan(0)
  })
  it('round-trips through viewNormal with yaw, pitch and rotLon', () => {
    const cam = { yaw: 0.8, pitch: -0.45, yawVel: 0, pitchVel: 0 }
    const rotLon = 1.3
    for (const [dx, dy] of [[0, 0], [60, -40], [-90, 70], [20, 100], [-100, -30]]) {
      const px = 400 + dx, py = 300 + dy
      const r = pick(cam, px, py, W, H, rotLon)
      expect(r).not.toBeNull()
      const n = viewNormal(cam, r.lat, r.lon, rotLon)
      const sx = dx / R, sy = -dy / R
      close(n[0], sx); close(n[1], sy)
      close(n[2], Math.sqrt(1 - sx * sx - sy * sy))
      expect(r.lon).toBeGreaterThan(-Math.PI - 1e-12)
      expect(r.lon).toBeLessThanOrEqual(Math.PI)
    }
  })
  it('returns null for non-finite input or an empty canvas', () => {
    const cam = createCamera()
    expect(pick(cam, NaN, 300, W, H, 0)).toBeNull()
    expect(pick(cam, 400, 300, W, H, NaN)).toBeNull()
    expect(pick({ ...cam, yaw: NaN }, 400, 300, W, H, 0)).toBeNull()
    expect(pick(cam, 0, 0, 0, 600, 0)).toBeNull()
  })
})

describe('orbit fling speed and coast', () => {
  it('with real event times the fling speed does not depend on the pointer report rate', () => {
    // the same hand speed (600 px/s on a 600 px short side = PI rad/s) reported at 60 Hz and at 1000 Hz
    const run = (hz) => {
      const cam = createCamera()
      for (let i = 0; i < hz / 2; i++) orbitDrag(cam, 600 / hz, 0, 600, 1 / hz)
      return cam.yawVel
    }
    const slow = run(60)
    const fast = run(1000)
    close(Math.abs(slow), Math.PI, 0.02)
    close(Math.abs(fast), Math.PI, 0.02)
  })
  it('real event times still clamp to 6 rad/s and ignore a zero or non-finite interval', () => {
    const cam = createCamera()
    for (let i = 0; i < 60; i++) orbitDrag(cam, 100, 0, 600, 1 / 120)
    expect(Math.abs(cam.yawVel)).toBe(6)
    const c2 = createCamera()
    orbitDrag(c2, 1, 0, 600, 0)
    close(Math.abs(c2.yawVel), (Math.PI / 600) * 60)
    orbitDrag(c2, 1, 0, 600, NaN)
    expect(Number.isFinite(c2.yawVel)).toBe(true)
  })
  it('a fling glides its speed times 0.62 s in all', () => {
    const cam = { yaw: 0, pitch: 0, yawVel: 2, pitchVel: 0 }
    for (let i = 0; i < 3600; i++) stepCamera(cam, 1 / 360)
    close(cam.yaw, 2 * 0.62, 1e-4)
  })
  it('holdCamera forgets the fling speed without moving the camera', () => {
    const cam = { yaw: 0.4, pitch: -0.2, yawVel: 3, pitchVel: -2 }
    holdCamera(cam, 0.3)
    expect(cam.yaw).toBe(0.4)
    expect(cam.pitch).toBe(-0.2)
    expect(Math.abs(cam.yawVel)).toBeLessThan(0.2)
    expect(Math.abs(cam.pitchVel)).toBeLessThan(0.2)
    holdCamera(cam, NaN)
    expect(Number.isFinite(cam.yawVel)).toBe(true)
  })
})
