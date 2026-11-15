/** Pointer distance from the centre (px) under which a sample carries no turn. */
export const STIR_DEADZONE_PX = 6;

/**
 * Signed turns swept from `prev` to `cur` around `center`, in screen pixels
 * with y pointing down. Positive is clockwise as the visitor sees it, so
 * right -> down is +0.25. The short way across the ±π seam is taken, so the
 * result always lies within -0.5..+0.5.
 *
 * Returns 0 when either point is inside the deadzone, when prev equals cur,
 * and for any non-finite input coordinate (never NaN).
 *
 * @param {{x:number,y:number}} prev
 * @param {{x:number,y:number}} cur
 * @param {{x:number,y:number}} center
 * @returns {number}
 */
export function stirDelta(prev, cur, center) {
  const finite = [prev?.x, prev?.y, cur?.x, cur?.y, center?.x, center?.y]
    .every((v) => Number.isFinite(v));
  if (!finite) return 0;
  if (prev.x === cur.x && prev.y === cur.y) return 0;

  const px = prev.x - center.x;
  const py = prev.y - center.y;
  const cx = cur.x - center.x;
  const cy = cur.y - center.y;

  const deadSq = STIR_DEADZONE_PX * STIR_DEADZONE_PX;
  if (px * px + py * py < deadSq || cx * cx + cy * cy < deadSq) return 0;

  const cross = px * cy - py * cx;
  const dot = px * cx + py * cy;
  const turn = Math.atan2(cross, dot) / (2 * Math.PI);
  return Number.isFinite(turn) ? turn : 0;
}
