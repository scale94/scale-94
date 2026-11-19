import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import SolHud from '../SolHud';
import { formatClock, formatYear } from '../hudFormat';

afterEach(cleanup);

const hud = (props) =>
  render(<SolHud tensionG={300} lastReleaseErg={null} clouds={[]} landings={[]} {...props} />);

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

  const ROWS = [
    { key: 'neutrinos', arrived: false, etaMs: 499e3, arrivesYear: 2026, reading: null },
    { key: 'light', arrived: false, etaMs: 499e3, arrivesYear: 2026, reading: null },
    { key: 'protons', arrived: false, etaMs: 3600e3, arrivesYear: 2026, reading: null },
    { key: 'cloud', arrived: false, etaMs: 17 * 3600e3, arrivesYear: 2026, reading: { phase: 'flight', orientation: null } },
    { key: 'core', arrived: false, etaMs: null, arrivesYear: 172026, reading: null },
  ];

  it('a stack renders five labelled rows and the launch clock in its header', () => {
    const launchedAt = new Date(2026, 10, 17, 9, 5, 7).getTime();
    const { getAllByTestId, container } = hud({ stack: { launchedAt, rows: ROWS } });
    const rows = getAllByTestId('sol-stack-row');
    expect(rows).toHaveLength(5);
    const labels = ['NEUTRINOS', 'LIGHT', 'PROTONS', 'CLOUD', 'CORE LIGHT'];
    labels.forEach((l, i) => expect(rows[i].textContent).toContain(l));
    expect(rows[0].textContent).toContain('00:08:19');
    expect(container.textContent).toContain(formatClock(launchedAt));
    expect(container.textContent).not.toContain('OLD');
  });

  it('stack null renders no stack rows', () => {
    expect(hud({ stack: null }).queryAllByTestId('sol-stack-row')).toHaveLength(0);
  });

  it('clicking a compact row selects it; rows are buttons', () => {
    const calls = [];
    const { getAllByTestId } = hud({
      clouds: [{ id: 'a', etaMs: 5e3, orientation: null }, { id: 'b', etaMs: 9e3, orientation: null }],
      onSelect: (id) => calls.push(id),
    });
    const rows = getAllByTestId('sol-cloud');
    expect(rows[1].tagName).toBe('BUTTON');
    fireEvent.click(rows[1]);
    expect(calls).toEqual(['b']);
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
      'arrived · southward · coupled · −850\u00a0nT',
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
      tensionG: 4000, lastReleaseErg: 5e32, stack: { launchedAt: 0, rows: ROWS },
      clouds: [{ id: 'a', etaMs: 1000, orientation: 'southward' }],
      landings: [{ id: 'p', fate: 'passed', nT: null }, { id: 'c', fate: 'coupled', nT: -900 }],
    });
    const text = container.textContent.toLowerCase();
    for (const w of ['civilization', 'grid', 'infrastructure']) expect(text).not.toContain(w);
  });

  it('forge view: five rows, Au dark with no title and only symbol and Z', () => {
    const { getAllByTestId, queryAllByTestId } = hud({
      view: 'forge', forge: null,
      stack: { launchedAt: 0, rows: ROWS }, clouds: [{ id: 'a', etaMs: 1000, orientation: null }],
    });
    const rows = getAllByTestId('sol-forge-row');
    expect(rows).toHaveLength(5);
    const au = rows[4];
    expect(au.hasAttribute('title')).toBe(false);
    expect(au.querySelector('[title],[aria-label]')).toBeNull();
    expect(au.textContent.replace(/\s/g, '')).toBe('Au79');
    expect(au.className).toContain('text-yellow-100/20');
    expect(queryAllByTestId('sol-stack-row')).toHaveLength(0);
    expect(queryAllByTestId('sol-cloud')).toHaveLength(0);
  });

  it('forge view keeps tension and release; shows ledger values', () => {
    const { container } = hud({
      view: 'forge', lastReleaseErg: 5e32,
      forge: { H: 7.82e10, He: 7.76e10, heOwed: 0, C: 8.55e11, O: 1.16e12, cYear: 7590002026, oYear: 7700002026, any: true },
    });
    expect(container.textContent).toContain('MAGNETIC TENSION');
    expect(container.textContent).toContain('LAST RELEASE');
    expect(container.textContent).toContain('7.8e10 kg');
    expect(container.textContent).toContain('CE 7 590 002 026');
  });

  it('forge view: symbols keep their case, H reads spent, years never wrap', () => {
    const { getAllByTestId } = hud({
      view: 'forge',
      forge: { H: 7.82e10, He: 7.76e10, heOwed: 0, C: 8.55e11, O: 1.16e12, cYear: 7590002026, oYear: 7700002026, any: true },
    });
    const rows = getAllByTestId('sol-forge-row');
    const sym = rows[1].querySelector('[data-testid="sol-forge-symbol"]');
    expect(sym.textContent).toBe('He');
    expect(sym.className).not.toContain('uppercase');
    expect(rows[1].textContent).not.toContain('HE');
    expect(rows[0].textContent).toContain('spent');
    expect(rows[0].textContent).not.toMatch(/H\s*1/);
    const yr = rows[2].querySelector('[data-testid="sol-year"]');
    expect(yr.textContent).toBe(formatYear(7590002026));
    expect(yr.className).toContain('whitespace-nowrap');
  });

  it('core light year is nowrap', () => {
    const { getAllByTestId } = hud({ stack: { launchedAt: 0, rows: ROWS } });
    const core = getAllByTestId('sol-stack-row')[4];
    expect(core.querySelector('[data-testid="sol-year"]').className).toContain('whitespace-nowrap');
  });

  it('toggle: aria-pressed, bracketed active, click calls onView', () => {
    const calls = [];
    const { getByText } = hud({ view: 'clocks', onView: (v) => calls.push(v) });
    const clocks = getByText('[ CLOCKS ]');
    expect(clocks.getAttribute('aria-pressed')).toBe('true');
    const forge = getByText('FORGE');
    expect(forge.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(forge);
    expect(calls).toEqual(['forge']);
  });

  it('toggle: each button reserves its bracketed width, so switching never shifts layout', () => {
    const a = hud({ view: 'clocks' });
    const widthsOn = ['[ CLOCKS ]', 'FORGE'].map((t) => a.getByText(t).style.minWidth);
    cleanup();
    const b = hud({ view: 'forge' });
    const widthsOff = ['CLOCKS', '[ FORGE ]'].map((t) => b.getByText(t).style.minWidth);
    expect(widthsOn).toEqual(widthsOff);
    expect(widthsOn[0]).toContain('10ch');   // '[ CLOCKS ]'
    expect(widthsOn[1]).toContain('9ch');    // '[ FORGE ]'
  });

  it('toggle: a 44 px hit area without growing the row', () => {
    const btn = hud({ view: 'clocks' }).getByText('[ CLOCKS ]');
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className).toContain('-my-[15px]');
  });

  it('the stacked (selected) cloud carries a marker; compact rows do not', () => {
    const { getByTestId, getAllByTestId } = hud({
      stack: { launchedAt: 0, rows: ROWS }, selectedId: 'a',
      clouds: [{ id: 'b', etaMs: 3600e3, orientation: null }],
    });
    const stack = getByTestId('sol-stack');
    expect(stack.getAttribute('aria-current')).toBe('true');
    expect(stack.firstChild.textContent.startsWith('▸')).toBe(true);
    expect(getAllByTestId('sol-cloud')[0].getAttribute('aria-current')).toBeNull();
  });

  it('a landing value never wraps away from its unit', () => {
    const [line] = hud({ landings: [{ id: 'c', fate: 'coupled', nT: -1200 }] })
      .getAllByTestId('sol-landing').map((n) => n.textContent);
    expect(line.endsWith('−1200\u00a0nT')).toBe(true);
    expect(line).not.toMatch(/−1200 nT/);
  });

  it('wrapped rows keep vertical breathing room', () => {
    const row = hud({ stack: { launchedAt: 0, rows: ROWS } }).getAllByTestId('sol-stack-row')[0];
    expect(row.className).toContain('gap-y-0.5');
    expect(row.lastChild.className).toContain('leading-snug');
  });
});
