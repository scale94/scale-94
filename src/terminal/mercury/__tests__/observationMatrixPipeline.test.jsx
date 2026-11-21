// End-to-end: bus emit -> Observation Matrix chip. One test per category that
// used to stay empty, plus the backfill that lets events from other tabs
// (the matrix is only mounted on /MERCURY) show up when the observer returns.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ObservationMatrix from '../ObservationMatrix';
import { categoryForEvent, PHRASES } from '../observationLog';
import { emit, _resetForTests, getTotals } from '../../../observatory/observatoryBus';

const mercury = {
  heliocentricDistanceAU: 0.387, subsolarTempK: 700, daysToNextPerihelion: 40, earthMercuryDistanceAU: 0.9,
};
const instruments = ['PROMISE HALF-LIFE', 'WORSHIP TEMPERATURE', 'GRIEF INDEX', 'ATTENTION VISCOSITY', 'FORGETTING FLUX']
  .map(label => ({ label, value: 1, unit: '' }));

const mount = () => render(<ObservationMatrix mercury={mercury} instruments={instruments} activePhase="fluid" />);
const chip = (c, name) => [...c.querySelectorAll('button')].find(b => b.textContent === name);
const empty = (c) => c.textContent.includes('observation log empty');

// The four primary interactions, with the payloads their emitters really send.
const ACTIONS = [
  { chip: 'TRANSMISSIONS', category: 'transmissions', kind: 'transmission_selected',
    payload: { id: 'sorbe', title: 'THE SORBE BLOOM' }, tail: 'THE SORBE BLOOM' },
  { chip: 'ESSENCES', category: 'essences', kind: 'node_selected',
    payload: { nodeId: 7, name: 'Saponification' }, tail: 'Saponification' },
  { chip: 'CIPHERS', category: 'ciphers', kind: 'key_generated',
    payload: { scheme: 'ML-KEM-768', ekBytes: 1184, dkBytes: 2400 }, tail: 'ML-KEM-768 · ek 1184B · dk 2400B' },
  { chip: 'EDGE', category: 'edge', kind: 'council_collision',
    payload: { pair: ['Arendt', 'Weil'], trajectory: 'FOUNDATION', paradoxCount: 2 }, tail: 'Arendt × Weil' },
];

describe('Observation Matrix pipeline', () => {
  beforeEach(() => _resetForTests());
  afterEach(cleanup);

  for (const a of ACTIONS) {
    it(`${a.chip}: ${a.kind} logs under its own chip, in a dedicated phrase`, () => {
      const { container } = mount();
      fireEvent.click(chip(container, a.chip));
      expect(empty(container)).toBe(true);

      act(() => { emit(a.category, a.kind, a.payload); });

      expect(empty(container)).toBe(false);
      expect(container.textContent).toContain(`${a.category}/${a.kind}`);
      expect(container.textContent).toContain(a.tail);
      // no unfilled template placeholders leaked into the line
      expect(container.textContent).not.toMatch(/\{\w+\}/);
      // and it does not appear under a sibling chip
      const other = ACTIONS.find(o => o.chip !== a.chip).chip;
      fireEvent.click(chip(container, other));
      expect(container.textContent).not.toContain(`${a.category}/${a.kind}`);
    });
  }

  it('events emitted while /MERCURY was closed are backfilled on mount', () => {
    for (const a of ACTIONS) emit(a.category, a.kind, a.payload);
    const { container } = mount();
    for (const a of ACTIONS) {
      fireEvent.click(chip(container, a.chip));
      expect(container.textContent).toContain(`${a.category}/${a.kind}`);
    }
  });

  it('an event is never logged twice (backfill + live subscription)', () => {
    emit('ciphers', 'key_generated', ACTIONS[2].payload);
    const { container } = mount();
    fireEvent.click(chip(container, 'CIPHERS'));
    expect(container.textContent.match(/ciphers\/key_generated/g)).toHaveLength(1);
  });

  it('classifier gives each new kind its own phrase pool', () => {
    for (const a of ACTIONS) {
      const cat = categoryForEvent({ category: a.category, kind: a.kind, payload: a.payload });
      expect(PHRASES[cat]?.length).toBeGreaterThan(0);
    }
    expect(categoryForEvent({ category: 'ciphers', kind: 'cipher_sealed' })).toBe('cipher_sealed');
  });

  it('bus totals count keys and council collisions', () => {
    emit('ciphers', 'key_generated', {});
    emit('edge', 'council_collision', ACTIONS[3].payload);
    expect(getTotals().ciphers.keysGenerated).toBe(1);
    expect(getTotals().edge.councilCollisions).toBe(1);
    expect(getTotals().edge.lastCouncil.trajectory).toBe('FOUNDATION');
  });
});

describe('wording matches the event (no cross-wired phrases)', () => {
  beforeEach(() => _resetForTests());
  afterEach(cleanup);

  const lines = (container, name) => {
    fireEvent.click(chip(container, name));
    return container.textContent;
  };

  it('every gaze kind gets its own pool; tab navigation never claims a sphere turned', () => {
    const cat = (kind) => categoryForEvent({ category: 'gaze', kind, payload: {} });
    expect(cat('tab_navigated')).toBe('tab_navigated');
    expect(cat('sphere_clicked')).toBe('sphere_turned');
    expect(cat('lunar_read')).toBe('moon_read');
    expect(cat('scaling_visit')).toBe('scent_visited');
    // the nav pool is the only place a tab name is promised, and none mention spheres/moon
    for (const l of PHRASES.tab_navigated) expect(l).not.toMatch(/sphere|moon|planet/);
    for (const l of PHRASES.gaze_redirected) expect(l).not.toMatch(/sphere|moon|planet|monument|scent/);
  });

  it('scaling_visit logs as the scent collider, not its raw event name', () => {
    const { container } = mount();
    act(() => { emit('gaze', 'scaling_visit', {}); });
    const text = lines(container, 'GAZE');
    expect(text).toContain('gaze/scaling_visit');
    expect(text).toContain('scent collider');
    expect(text).not.toMatch(/scaling_visit\s*$/m);
    expect(PHRASES.scent_visited.join(' ')).toMatch(/scent/);
  });

  it('eye_phase gets an eye line carrying the phase, not a gate line', () => {
    const { container } = mount();
    act(() => { emit('edge', 'eye_phase', { phase: 'deep-watch' }); });
    const text = lines(container, 'EDGE');
    expect(text).toContain('deep-watch');
    expect(text).not.toMatch(/gate answered|gate refused|perihelion correct/);
    expect(categoryForEvent({ category: 'edge', kind: 'eye_phase', payload: {} })).toBe('eye_phase_shifted');
    expect(categoryForEvent({ category: 'edge', kind: 'manifesto_opened', payload: {} })).toBe('accretion_opened');
  });

  it('collision notes come from the collision, not the transmission counter', () => {
    const { container } = mount();
    act(() => { emit('transmissions', 'kernel_completed', { kernelId: 'k', durationMs: 5 }); });
    act(() => { emit('essences', 'collision_fired', { polarity: 'CHAOTIC', noteCount: 3, dominant: 'aromatic' }); });
    const text = lines(container, 'ESSENCES');
    expect(text).toContain('CHAOTIC · 3 notes · aromatic');
    expect(text).not.toContain('— notes');
    // the phrase itself must never read the transmission count
    for (const l of PHRASES.essence_collided) expect(l).not.toContain('{n}');
  });
});

// The matrix can only show what the tabs emit. Pin each emitter at its call
// site so deleting one fails here instead of silently emptying a chip.
describe('emitters stay wired at the action sites', () => {
  const src = (p) => readFileSync(resolve(__dirname, '../../', p), 'utf8');
  it.each([
    ['App.jsx', /emitObs\('transmissions', 'transmission_selected'/],
    ['views/LatentCollider.jsx', /emitObs\('essences', 'node_selected'/],
    ['views/LatentCollider.jsx', /emitObs\('essences', 'collision_fired'/],
    ['views/ClassifiedTab.jsx', /emitObs\('ciphers', 'key_generated'/],
    ['views/manifesto/useCouncilCollider.js', /emitObs\('edge', 'council_collision'/],
  ])('%s emits %s', (file, re) => {
    expect(src(file)).toMatch(re);
  });
});
