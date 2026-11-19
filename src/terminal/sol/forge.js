// The Forge That Cannot Make Gold: the fusion-equivalent mass each solar
// release would cost the core. Pure arithmetic, no storage. Dated years are
// plain Numbers (never Date, never epoch ms: 7.59e9 yr overflows both).
import { HELIUM_FLASH_YEARS, HE_BURN_END_YEARS } from './solPhysics';
import { protonsArriveAt, yearOf } from './delayStack';

const C_LIGHT = 299792458;
const U_H = 1.007825;
const U_HE = 4.002603;
const U_C = 12;
const U_O = 15.994915;

// Energy released per kg of product, from the mass defect of each fusion step.
const jPerKg = (defect, mass) => (defect / mass) * C_LIGHT * C_LIGHT;

export const J_PER_KG = Object.freeze({
  He: jPerKg(4 * U_H - U_HE, U_HE),
  C: jPerKg(3 * U_HE - U_C, U_C),
  O: jPerKg(U_C + U_HE - U_O, U_O), // 12C + 4He -> 16O
});
export const H_PER_HE = (4 * U_H) / U_HE;

export const FORGE_TABLE = Object.freeze([
  Object.freeze({ symbol: 'H', z: 1, role: 'spent' }),
  Object.freeze({ symbol: 'He', z: 2, role: 'delivered' }),
  Object.freeze({ symbol: 'C', z: 6, role: 'dated' }),
  Object.freeze({ symbol: 'O', z: 8, role: 'dated' }),
  Object.freeze({ symbol: 'Au', z: 79, role: null }),
]);

export function offerings(cloud) {
  const joules = cloud.energyErg * 1e-7;
  const he = joules / J_PER_KG.He;
  const deliveredAt = protonsArriveAt(cloud);
  const y = yearOf(cloud.launchedAt);
  return {
    H: { kg: he * H_PER_HE, deliveredAt },
    He: { kg: he, deliveredAt },
    C: { kg: joules / J_PER_KG.C, year: y + HELIUM_FLASH_YEARS },
    O: { kg: joules / J_PER_KG.O, year: y + HE_BURN_END_YEARS },
  };
}

export const EMPTY_ARCHIVE = Object.freeze({
  H: 0, He: 0, C: 0, O: 0, cYear: null, oYear: null, foldedIds: Object.freeze([]),
});

const num = (v) => (Number.isFinite(v) ? v : 0);
const yr = (v) => (Number.isFinite(v) ? v : null);
const maxYear = (a, b) => (a === null ? b : b === null ? a : Math.max(a, b));

export function forgeLedger(clouds, archive, now) {
  const a = archive || {};
  let H = num(a.H);
  let He = num(a.He);
  let C = num(a.C);
  let O = num(a.O);
  let heOwed = 0;
  let cYear = yr(a.cYear);
  let oYear = yr(a.oYear);
  const list = Array.isArray(clouds) ? clouds : [];
  for (const cloud of list) {
    const o = offerings(cloud);
    // Non-finite now, or one before launch, is read as the launch moment.
    const t = Number.isFinite(now) && now > cloud.launchedAt ? now : cloud.launchedAt;
    if (t >= o.He.deliveredAt) {
      He += o.He.kg;
      H += o.H.kg;
    } else {
      heOwed += o.He.kg;
    }
    C += o.C.kg;
    O += o.O.kg;
    cYear = maxYear(cYear, o.C.year);
    oYear = maxYear(oYear, o.O.year);
  }
  const any = list.length > 0 || H > 0 || He > 0 || C > 0 || O > 0;
  return { H, He, heOwed, C, O, cYear, oYear, any };
}
