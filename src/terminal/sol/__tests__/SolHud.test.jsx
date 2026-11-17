import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import SolHud from '../SolHud';

afterEach(cleanup);

const hud = (props) =>
  render(<SolHud tensionG={300} lastReleaseErg={null} lightDelayVisible={false} clouds={[]} landings={[]} {...props} />);

describe('SolHud', () => {
  it('renders tension as an integer in G', () => {
    const { container } = hud({ tensionG: 4000 });
    expect(container.textContent).toContain('MAGNETIC TENSION');
    expect(container.textContent).toContain('4000 G');
  });

  it('rounds the tension', () => {
    const { container } = hud({ tensionG: 1234.6 });
    expect(container.textContent).toContain('1235 G');
  });

  it('renders the last release as mantissa e exponent erg', () => {
    const { container } = hud({ lastReleaseErg: 5e32 });
    expect(container.textContent).toContain('LAST RELEASE');
    expect(container.textContent).toContain('5.0e32 erg');
  });

  it('formats a small release too', () => {
    const { container } = hud({ lastReleaseErg: 1.234e29 });
    expect(container.textContent).toContain('1.2e29 erg');
  });

  it('shows the light line only while visible', () => {
    expect(hud({ lightDelayVisible: true }).container.textContent).toContain('LIGHT · 8 min 19 s OLD');
    cleanup();
    expect(hud({ lightDelayVisible: false }).container.textContent).not.toContain('8 min 19 s');
  });

  it('has no release row before the first snap', () => {
    const { container } = hud({ lastReleaseErg: null });
    expect(container.textContent).not.toContain('erg');
    expect(container.textContent).not.toContain('LAST RELEASE');
  });

  it('a cloud in flight shows its time to arrival and unread', () => {
    const eta = (17 * 3600 + 36 * 60) * 1000;
    const { getAllByTestId } = hud({ clouds: [{ id: 'a', etaMs: eta, orientation: null }] });
    const rows = getAllByTestId('sol-cloud');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('17:36:00');
    expect(rows[0].textContent).toContain('unread');
  });

  it('a read cloud shows its orientation; seconds round up, never 00:00:00 in flight', () => {
    const { getAllByTestId } = hud({
      clouds: [
        { id: 'a', etaMs: 5 * 60e3, orientation: 'southward' },
        { id: 'b', etaMs: 1, orientation: 'northward' },
      ],
    });
    const rows = getAllByTestId('sol-cloud');
    expect(rows[0].textContent).toContain('00:05:00');
    expect(rows[0].textContent).toContain('southward');
    expect(rows[0].textContent).not.toContain('unread');
    expect(rows[1].textContent).toContain('00:00:01');
    expect(rows[1].textContent).toContain('northward');
  });

  it('landings are one line each, exactly', () => {
    const { getAllByTestId } = hud({
      landings: [
        { id: 'p', fate: 'passed', nT: null },
        { id: 'c', fate: 'coupled', nT: -850.4 },
        { id: 'u', fate: 'unwitnessed', nT: -300 },
      ],
    });
    expect(getAllByTestId('sol-landing').map((n) => n.textContent)).toEqual([
      'arrived · northward · passed',
      'arrived · southward · coupled · −850 nT',
      'arrived · unwitnessed',
    ]);
  });

  it('no cloud rows and no landing lines when there are none', () => {
    const { queryAllByTestId } = hud({});
    expect(queryAllByTestId('sol-cloud')).toHaveLength(0);
    expect(queryAllByTestId('sol-landing')).toHaveLength(0);
  });

  it('never explains itself', () => {
    const { container } = hud({
      tensionG: 4000, lastReleaseErg: 5e32, lightDelayVisible: true,
      clouds: [{ id: 'a', etaMs: 1000, orientation: 'southward' }],
      landings: [{ id: 'p', fate: 'passed', nT: null }, { id: 'c', fate: 'coupled', nT: -900 }],
    });
    const text = container.textContent.toLowerCase();
    for (const w of ['civilization', 'grid', 'infrastructure']) expect(text).not.toContain(w);
  });
});
