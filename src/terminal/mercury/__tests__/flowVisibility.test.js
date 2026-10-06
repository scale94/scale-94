import { describe, it, expect } from 'vitest';
import fluidSrc from '../../fluid/ParticleFlow.jsx?raw';
import thermalSrc from '../../thermal/ThermalFlow.jsx?raw';
import earthSrc from '../../earth/SedimentFlow.jsx?raw';
import airSrc from '../../air/AtmosphericFlow.jsx?raw';

// Neutral state spec: a flow at fade 0 does not draw (three's object visibility) and does no per-frame uniform work
// beyond the shared clock.
describe.each([['ParticleFlow', fluidSrc], ['ThermalFlow', thermalSrc], ['SedimentFlow', earthSrc], ['AtmosphericFlow', airSrc]])('%s visibility', (_, src) => {
  it('takes a visible prop defaulting to true', () => {
    expect(src).toMatch(/\bvisible = true,/);
  });
  it('puts it on the points object', () => {
    expect(src).toMatch(/<points[^>]*visible=\{visible\}/);
  });
  it('skips uniform work right after the clock tick when hidden', () => {
    expect(src).toMatch(/tickAetherClock\([^)]*\);\s*\n\s*if \(!visible\) return;/);
  });
});
