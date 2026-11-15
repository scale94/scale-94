// solCamera.js - orbit state and orthographic surface pick for /SOL.
//
// CONVENTIONS (the shader and pointer hook must copy these exactly)
//  View space: +x right, +y UP, +z toward the viewer. The camera looks down -z.
//  Canvas pixels: origin top-left, y DOWN. The star is centred in the canvas;
//    its radius in pixels is STAR_RADIUS_NDC * min(widthPx, heightPx) / 2.
//  Star frame: unit vector of (lat, lon) = [cos(lat) sin(lon), sin(lat), cos(lat) cos(lon)].
//    (0,0) is +z, +lon is toward +x, +lat is toward +y (north up).
//  Star -> view: (1) rotation about +y by rotLon (a point at star lon appears at
//    lon + rotLon); (2) camera yaw: rotation about +y by -yaw; (3) camera pitch:
//    rotation about +x by +pitch (positive pitch tilts the north pole toward the viewer).
//    Rotation about +y by a:  x' = x cos a + z sin a,  z' = -x sin a + z cos a.
//    Rotation about +x by a:  y' = y cos a - z sin a,  z' = y sin a + z cos a.
//  orbitDrag: dragging right by the short side gives yaw -= PI (the surface follows
//    the pointer to the right); dragging down by the short side gives pitch += PI
//    (the surface follows the pointer down). yawVel/pitchVel are radians per second.
//  pick inverts the chain exactly; lon is wrapped to (-PI, PI].

export const STAR_RADIUS_NDC = 0.62
const TAU = 0.35
const PITCH_MAX = 1.2
const VEL_MAX = 6
const DRAG_DT = 1 / 60

const fin = (v) => (Number.isFinite(v) ? v : 0)

export function createCamera() {
  return { yaw: 0, pitch: 0, yawVel: 0, pitchVel: 0 }
}

export function orbitDrag(cam, dxPx, dyPx, shortSidePx) {
  if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx) || !(shortSidePx > 0)) return
  const dYaw = (-dxPx / shortSidePx) * Math.PI
  const dPitch = (dyPx / shortSidePx) * Math.PI
  cam.yaw = fin(cam.yaw) + dYaw
  cam.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, fin(cam.pitch) + dPitch))
  cam.yawVel = Math.max(-VEL_MAX, Math.min(VEL_MAX, dYaw / DRAG_DT))
  cam.pitchVel = Math.max(-VEL_MAX, Math.min(VEL_MAX, dPitch / DRAG_DT))
}

export function stepCamera(cam, dtSeconds) {
  const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0
  const yv = fin(cam.yawVel)
  const pv = fin(cam.pitchVel)
  const decay = Math.exp(-dt / TAU)
  const gain = TAU * (1 - decay)
  cam.yaw = fin(cam.yaw) + yv * gain
  cam.pitch = fin(cam.pitch) + pv * gain
  cam.yawVel = yv * decay
  cam.pitchVel = pv * decay
  if (cam.pitch > PITCH_MAX || cam.pitch < -PITCH_MAX) {
    cam.pitch = cam.pitch > 0 ? PITCH_MAX : -PITCH_MAX
    cam.pitchVel = 0
  }
}

export function viewNormal(cam, lat, lon, rotLon) {
  const cl = Math.cos(lat)
  let x = cl * Math.sin(lon)
  let y = Math.sin(lat)
  let z = cl * Math.cos(lon)
  // rotY(rotLon) then rotY(-yaw)
  const a = rotLon - cam.yaw
  const ca = Math.cos(a), sa = Math.sin(a)
  const x1 = x * ca + z * sa
  const z1 = -x * sa + z * ca
  // rotX(pitch)
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch)
  x = x1
  const y2 = y * cp - z1 * sp
  const z2 = y * sp + z1 * cp
  return [x, y2, z2]
}

export function pick(cam, px, py, widthPx, heightPx, rotLon) {
  if (![px, py, widthPx, heightPx, rotLon, cam.yaw, cam.pitch].every(Number.isFinite)) return null
  if (!(widthPx > 0) || !(heightPx > 0)) return null
  const radius = (STAR_RADIUS_NDC * Math.min(widthPx, heightPx)) / 2
  const sx = (px - widthPx / 2) / radius
  const sy = -(py - heightPx / 2) / radius
  const r2 = sx * sx + sy * sy
  if (r2 > 1) return null
  const sz = Math.sqrt(Math.max(0, 1 - r2))
  // undo pitch: rotX(-pitch)
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch)
  const y1 = sy * cp + sz * sp
  const z1 = -sy * sp + sz * cp
  // undo yaw and rotLon: rotY(yaw - rotLon)
  const a = cam.yaw - rotLon
  const ca = Math.cos(a), sa = Math.sin(a)
  const x2 = sx * ca + z1 * sa
  const z2 = -sx * sa + z1 * ca
  const lat = Math.asin(Math.max(-1, Math.min(1, y1)))
  let lon = Math.atan2(x2, z2)
  if (lon <= -Math.PI) lon = Math.PI
  return { lat, lon }
}
