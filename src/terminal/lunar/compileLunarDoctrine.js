// src/terminal/lunar/compileLunarDoctrine.js — the doctrine register's engine
// (spec §5). Pure: no React, no DOM, no clock. Same inputs always compile the
// same reading, which is what lets the time-scrub recompile it live.
import { scoreLenses, synthesizeLunarAspect } from './doctrineLens';
import { quadrantOf, tensionClassOf, SYNODIC_PERIOD } from './synodic';
import { KERNEL_HOROSCOPE } from '../data/kernelHoroscope';
import { drynessFor } from '../data/lunarAccords';

export function compileLunarDoctrine({
  age, illumination, phaseId, currentAccord, transits, planets, spine,
}) {
  // One normalization for the whole reading. The dependencies disagree about
  // out-of-range ages — phaseAffinity and synthesizeLunarAspect wrap onto the
  // wheel, quadrantOf clamps — so a raw age past the end of the cycle would
  // pick the right lens and then read the wrong quadrant's text. Normalizing
  // here makes every downstream consumer agree, and turns a non-finite age
  // into a reading rather than a thrown TypeError.
  const wheelAge = Number.isFinite(age)
    ? ((age % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD
    : 0;

  // transits arrive orb-sorted from useTransits. Nothing within orb (or no
  // ephemeris at all) is not an absence: the moon supplies its own aspect.
  const dominant = (transits && transits.length)
    ? transits[0]
    : synthesizeLunarAspect(wheelAge);

  const scores = scoreLenses({ age: wheelAge, phaseId, currentAccord, dominant, spine });
  const winner = scores[0];
  const entry  = KERNEL_HOROSCOPE[winner.id];

  const quadrant = quadrantOf(wheelAge);
  const tension  = tensionClassOf(dominant.aspect);
  const q        = entry.quadrants[quadrant];

  const spineComplete = !!(spine?.trend && spine?.council && spine?.phase && spine?.element);

  return {
    lensId:    winner.id,
    kernel:    winner.kernel,
    axis:      entry.axis,
    plato:     q.plato,
    promo:     q.promo,
    paradox:   entry.paradox[tension],
    directive: q.directive,
    coda:      spineComplete ? entry.coda.complete : entry.coda.partial,
    quadrant,
    tension,
    dominant,
    provenance: {
      age: wheelAge,
      illumination,
      dryness: drynessFor(currentAccord),
      phaseId,
      accord: currentAccord,
      element: spine?.element ?? null,
      spineComplete,
    },
    scores,
  };
}
