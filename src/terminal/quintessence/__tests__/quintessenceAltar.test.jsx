// src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx — the living altar (spec §5–6).
// Smoke-level: wet/dry from the witness, click always navigates, the armed
// prompt names the gesture. No compile-flow simulation (timers + wasm not worth mocking).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import QuintessenceAltar from '../../mercury/QuintessenceAltar';
import { setTrend, setCouncil, setPhase, reconcileScent, markScentBroken, _resetSpineForTests } from '../spineStore';
import { sealScentForTests } from './scentFixture';
import { emit, subscribe, _resetForTests as resetBus } from '../../../observatory/observatoryBus';
import { compileKernel } from '../compileKernel';
import { launchCloud, _resetCloudsForTests } from '../../sol/cloudStore';
import { openAccordForAltar, ALTAR_LINES } from '../../lib/openAccordForAltar';
import { STORAGE_KEY } from '../sealedArtifact';

// Ignition doubles: the real engine is wasm, the real compile is crypto.subtle.
vi.mock('../engineWitness', async (orig) => ({ ...(await orig()), witnessEngine: vi.fn(async () => ({ stub: true })) }));
vi.mock('../compileKernel', async (orig) => ({
  ...(await orig()),
  compileKernel: vi.fn(async () => ({ hash: 'abc123def456', meta: { element: 'FIRE' }, text: 'k' })),
}));

// The accord opens through the P3 bridge (real crypto pinned in openAccordForAltar.test.js).
const OPENED_SALT = { current: null };
vi.mock('../../lib/openAccordForAltar', async (orig) => {
  // Imported here, at factory time: a dynamic import inside the mock would
  // resolve on real I/O while the fake timers race ahead.
  const { REAL_ACCORD, ENVELOPE_META } = await import('../../scent/__tests__/accordFixture');
  return {
    ...(await orig()),
    openAccordForAltar: vi.fn(async () => {
      OPENED_SALT.current = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
      return { state: 'ok', baseAccord: REAL_ACCORD, salt: OPENED_SALT.current, envelopeMeta: ENVELOPE_META };
    }),
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ELEMENT_IDS = ['FIRE', 'AIR', 'EARTH', 'WATER'];

let container = null;
let root = null;
let onNavigate = null;

function sealButtons() {
  return [...container.querySelectorAll('button')]
    .filter(b => ELEMENT_IDS.some(id => b.textContent.includes(id)));
}
function sealFor(id) {
  return sealButtons().find(b => b.textContent.includes(id));
}
function mirrorRows() {
  return [...container.querySelectorAll('[data-testid="spine-mirror"] button')];
}
function mirrorRowFor(field) {
  return mirrorRows().find(b => b.textContent.includes(field));
}
function completeSpine() {
  act(() => {
    setTrend({ label: 'degrowth', velocity: 0.9 });
    setCouncil({ pair: ['OSTROM', 'WIENER'], directive: 'test directive', trajectory: 'FOUNDATION', paradoxCount: 2 });
    setPhase('SMOKE DISSOLUTION');
    sealScentForTests();
  });
}

beforeEach(() => {
  _resetSpineForTests();
  resetBus();
  localStorage.clear();
  onNavigate = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<QuintessenceAltar onNavigate={onNavigate} />); });
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  _resetSpineForTests();
  resetBus();
});

describe('QuintessenceAltar — the living altar', () => {
  it('empty spine: four None rows name their houses — and the seals are NEVER disabled', () => {
    const text = container.textContent;
    expect(text).not.toContain('SPINE INCOMPLETE');
    expect(mirrorRows()).toHaveLength(4);
    expect(text).toContain('sealed accord');
    expect(text).toContain('→ the scent house holds it');
    expect(text).toContain('narcos payload');
    expect(text).toContain('friction pair');
    expect(text).toContain('dryness');
    expect(text).toContain('→ the bsky house holds it');
    expect(text).toContain('→ the accretion house holds it');
    expect(text).toContain('→ the lunar house holds it');
    const seals = sealButtons();
    expect(seals).toHaveLength(4);
    for (const b of seals) expect(b.disabled).toBe(false);
  });

  it('an unmarked vertebra is an invitation, not an error — nothing renders red', () => {
    expect(container.querySelector('[class*="red-"]')).toBeNull();
  });

  it('no progress counter — the shape is the count (spec §2)', () => {
    act(() => { setTrend({ label: 'degrowth', velocity: 0.9 }); });
    expect(container.textContent).not.toMatch(/\d\s*(of|\/)\s*\d/);
  });

  it('partial spine: Some carries the value and its provenance, the gaps name their house', () => {
    act(() => { setTrend({ label: 'gaza ceasefire', velocity: 0.4 }); });
    const text = container.textContent;
    expect(text).toContain('Some("gaza ceasefire")');
    expect(text).toContain('✦ marked at /BSKY');
    expect(text).toContain('→ the accretion house holds it');
    expect(text).toContain('→ the lunar house holds it');
  });

  it('a council pair reads unquoted — a pair is not a string literal', () => {
    act(() => {
      setCouncil({ pair: ['hunger', 'mercy'], directive: 'd', trajectory: 'FOUNDATION', paradoxCount: 0 });
    });
    expect(container.textContent).toContain('Some(hunger × mercy)');
  });

  it('clicking an unmarked row walks to the house that fills it', () => {
    act(() => { mirrorRowFor('dryness').click(); });
    expect(onNavigate).toHaveBeenCalledWith('lunar');
  });

  it('clicking a marked row walks back to re-mark it', () => {
    act(() => { setTrend({ label: 'degrowth', velocity: 0.9 }); });
    act(() => { mirrorRowFor('narcos payload').click(); });
    expect(onNavigate).toHaveBeenCalledWith('bsky');
  });

  it('three marks without a sealed accord do not arm the altar; the scent row names its house', () => {
    act(() => {
      setTrend({ label: 'degrowth', velocity: 0.9 });
      setCouncil({ pair: ['OSTROM', 'WIENER'], directive: 'd', trajectory: 'FOUNDATION', paradoxCount: 2 });
      setPhase('SMOKE DISSOLUTION');
    });
    expect(container.textContent).not.toContain('ALTAR ARMED');
    act(() => { mirrorRowFor('sealed accord').click(); });
    expect(onNavigate).toHaveBeenCalledWith('scaling');
  });

  it('an orphaned seal reads absent and names why — the altar disarms', () => {
    completeSpine();
    expect(container.textContent).toContain('ALTAR ARMED');
    act(() => { reconcileScent(null); });
    expect(container.textContent).not.toContain('ALTAR ARMED');
    expect(container.textContent).toContain('SEAL ORPHANED — the key evaporated');
    expect(mirrorRowFor('sealed accord').getAttribute('aria-label')).toContain('SEAL ORPHANED — the key evaporated');
  });

  it('a broken seal reads absent and names why — the altar disarms (P3)', () => {
    completeSpine();
    act(() => { markScentBroken(); });
    expect(container.textContent).not.toContain('ALTAR ARMED');
    expect(container.textContent).toContain('SEAL BROKEN — the accord would not open');
    expect(mirrorRowFor('sealed accord').getAttribute('aria-label')).toContain('SEAL BROKEN — the accord would not open');
  });

  it('a long trend label is truncated — the mirror is a row, not a paragraph', () => {
    act(() => { setTrend({ label: 'x'.repeat(60), velocity: 0.5 }); });
    expect(container.textContent).toContain('…');
    expect(container.textContent).not.toContain('x'.repeat(60));
  });

  it('every row carries an aria-label — the hue is decoration, the label is the fact', () => {
    const labels = mirrorRows().map(b => b.getAttribute('aria-label'));
    expect(labels).toHaveLength(4);
    for (const l of labels) expect(l).toBeTruthy();
    expect(labels.some(l => l.includes('unmarked') && l.includes('the lunar house'))).toBe(true);
  });

  it('click always navigates to the element house — never ignites', () => {
    act(() => { sealFor('FIRE').click(); });
    expect(onNavigate).toHaveBeenCalledWith('art');
    act(() => { sealFor('WATER').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ledger');
    act(() => { sealFor('AIR').click(); });
    expect(onNavigate).toHaveBeenCalledWith('transmission');
    act(() => { sealFor('EARTH').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ecocide');
  });

  it('seals are dry until their house is visited, then wet (live via the bus)', () => {
    expect(sealFor('FIRE').getAttribute('data-wet')).toBe('false');
    act(() => { emit('gaze', 'tab_navigated', { tab: 'art' }); });
    expect(sealFor('FIRE').getAttribute('data-wet')).toBe('true');
    expect(sealFor('WATER').getAttribute('data-wet')).toBe('false');
  });

  it('armed altar: the mirror STAYS lit (the payoff), the prompt names the gesture, click still navigates', () => {
    completeSpine();
    expect(container.textContent).toContain('ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL');
    expect(container.querySelector('[data-testid="spine-mirror"]')).not.toBeNull();
    expect(container.textContent).not.toContain('None');
    expect(mirrorRows()).toHaveLength(4);
    act(() => { sealFor('EARTH').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ecocide');
  });

  it('compiling: the mirror yields the frame to the stages', async () => {
    vi.useFakeTimers();
    completeSpine();
    const seal = sealFor('FIRE');
    act(() => { seal.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); });
    act(() => { vi.advanceTimersByTime(1200); });
    // P3: the accord opens (async) before the first stage.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(container.textContent).toContain('SPINE READ');
    expect(container.querySelector('[data-testid="spine-mirror"]')).toBeNull();
    vi.useRealTimers();
  });

  it('armed: holding a seal for 1200ms starts the ignition (spine element written)', async () => {
    vi.useFakeTimers();
    completeSpine();
    const seal = sealFor('FIRE');
    act(() => { seal.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); });
    act(() => { vi.advanceTimersByTime(1200); });
    // P3: the accord opens (async) before the first stage.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    // ignite() ran: the compile staging begins (grid unmounts into the stage list)
    expect(container.textContent).toContain('SPINE READ');
    vi.useRealTimers();
  });

  it('armed: releasing early cancels — grid intact, nothing ignites, click still walks', () => {
    vi.useFakeTimers();
    completeSpine();
    const seal = sealFor('AIR');
    act(() => { seal.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); });
    act(() => { vi.advanceTimersByTime(600); });
    act(() => { seal.dispatchEvent(new Event('pointerup', { bubbles: true })); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(container.textContent).not.toContain('SPINE READ');
    act(() => { seal.click(); });
    expect(onNavigate).toHaveBeenCalledWith('transmission');
    vi.useRealTimers();
  });

  // Hue spec §2 — hue = provenance, gold = committed. These pin the exact
  // failure the rule exists to prevent: a marked row whose provenance tail
  // renders in a grey that is indistinguishable from the field comment.
  describe('hue = provenance, gold = committed', () => {
    const tailFor = field => mirrorRowFor(field).querySelector('.ml-auto');
    const ruleOf = field => mirrorRowFor(field).style.borderLeftColor;
    const GOLD = 'rgb(251, 191, 36)';

    it('a marked tail wears its house hue, not grey — /BSKY reads sky', () => {
      act(() => { setTrend({ label: 'degrowth', velocity: 0.9 }); });
      expect(tailFor('narcos payload').textContent).toContain('marked at /BSKY');
      expect(tailFor('narcos payload').style.color).toBe('rgb(56, 189, 248)');
    });

    it('an unmarked row wears the same house hue — absence points home too', () => {
      expect(tailFor('dryness').style.color).toBe('rgb(167, 139, 250)');
      expect(ruleOf('dryness')).toBe('rgb(167, 139, 250)');
    });

    it('every row carries a left rule in its house hue while assembling', () => {
      act(() => { setTrend({ label: 'degrowth', velocity: 0.9 }); });
      expect(ruleOf('narcos payload')).toBe('rgb(56, 189, 248)');
      expect(ruleOf('friction pair')).toBe('rgb(167, 139, 250)');
    });

    it('armed: all four houses resolve to one gold — rule and tail together', () => {
      completeSpine();
      for (const field of ['narcos payload', 'friction pair', 'dryness', 'sealed accord']) {
        expect(ruleOf(field), field).toBe(GOLD);
        expect(tailFor(field).style.color, field).toBe(GOLD);
      }
    });

    it('the resolution is staggered — three rows sweep, they do not blink', () => {
      completeSpine();
      const delays = ['narcos payload', 'friction pair', 'dryness']
        .map(f => mirrorRowFor(f).style.transitionDelay);
      expect(new Set(delays).size).toBe(3);
      expect(delays[0]).toBe('0ms');
    });

    it('a dry seal still names its house — the keystone is visible before the walk', () => {
      const rim = sealFor('EARTH').querySelector('[aria-hidden="true"]');
      expect(rim.style.borderColor).toBe('rgba(122, 184, 0, 0.25)');
    });
  });

  it('keyboard: Enter opens the confirm; "walk the house" navigates', () => {
    completeSpine();
    const seal = sealFor('WATER');
    act(() => { seal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    const walk = [...container.querySelectorAll('button')].find(b => b.textContent.includes('walk the house'));
    expect(walk).toBeTruthy();
    act(() => { walk.click(); });
    expect(onNavigate).toHaveBeenCalledWith('ledger');
  });
});

// /SOL witnessed at the Altar (sol spec §11): one compact line per cloud in flight.
describe('QuintessenceAltar — the sun', () => {
  const H = 3600e3;
  const solLines = () => [...container.querySelectorAll('[data-testid="altar-sol-line"]')].map(n => n.textContent);

  afterEach(() => _resetCloudsForTests());

  it('no clouds: no sol line', () => {
    expect(solLines()).toEqual([]);
  });

  it('a cloud in flight shows its time to arrival', () => {
    act(() => { launchCloud({ energyErg: 5e32, handedness: 'cw', origin: 'hand' }, Date.now()); });
    const lines = solLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/arrives in 17 h 3[56] min/);
    expect(lines[0]).not.toContain("crossed Mercury's orbit");
    expect(lines[0]).not.toMatch(/southward|northward/);
  });

  it("past Mercury's orbit the line says so", () => {
    act(() => { launchCloud({ energyErg: 5e32, handedness: 'cw', origin: 'hand' }, Date.now() - 10 * H); });
    expect(solLines()[0]).toContain("crossed Mercury's orbit");
    expect(solLines()[0]).toMatch(/arrives in 7 h 3[56] min/);
  });

  it('a landed cloud is not in flight', () => {
    act(() => { launchCloud({ energyErg: 5e32, handedness: 'ccw', origin: 'hand' }, Date.now() - 100 * H); });
    expect(solLines()).toEqual([]);
  });
});

// The deliberate act, announced on the bus (observer quest): ignition, seal, and the unsealed end.
describe('QuintessenceAltar — bus emits', () => {
  let events;
  let offBus;
  const edge = () => events.filter(e => e.category === 'edge').map(e => `${e.kind}`);
  async function holdSeal(id) {
    const seal = sealFor(id);
    act(() => { seal.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); });
    act(() => { vi.advanceTimersByTime(1200); });
  }
  const flush = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
    offBus = subscribe(e => events.push(e));
    vi.mocked(compileKernel).mockClear();
    completeSpine();
  });
  afterEach(() => { offBus(); vi.useRealTimers(); });

  it('emits_kernel_sealed_same_tick_as_stage6', async () => {
    await holdSeal('FIRE');
    expect(edge()).toEqual(['kernel_ignited']);
    expect(events.find(e => e.kind === 'kernel_ignited').payload).toEqual({ element: 'FIRE' });
    await flush(650 * 6 + 50);
    expect(container.textContent).toContain('BUILD 0xABC123DE'); // stage 6 rendered
    expect(edge()).toEqual(['kernel_ignited', 'kernel_sealed']);
    expect(events.find(e => e.kind === 'kernel_sealed').payload).toEqual({ hash: 'abc123def456' });
  });

  it('emits_ignite_ended_on_unmount_midway', async () => {
    await holdSeal('FIRE');
    act(() => { root.unmount(); });
    root = createRoot(container); // afterEach unmounts a live root
    await flush(650 * 7);
    expect(edge()).toEqual(['kernel_ignited', 'kernel_ignite_ended']);
    expect(events.find(e => e.kind === 'kernel_ignite_ended').payload).toEqual({ sealed: false });
  });

  it('emits_ignite_ended_on_compile_throw', async () => {
    vi.mocked(compileKernel).mockRejectedValueOnce(new Error('no crypto'));
    await holdSeal('FIRE');
    await flush(650 * 6 + 50);
    expect(edge()).toEqual(['kernel_ignited', 'kernel_ignite_ended']);
  });
});

// scent-aether P3: ignite opens the sealed accord before the stages (rulings 1–2).
describe('QuintessenceAltar — the accord opens at ignite', () => {
  let events;
  let offBus;
  const edge = () => events.filter(e => e.category === 'edge').map(e => e.kind);
  const flush = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
  async function holdSeal(id) {
    const seal = sealFor(id);
    act(() => { seal.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); });
    await flush(1200);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
    offBus = subscribe(e => events.push(e));
    vi.mocked(compileKernel).mockClear();
    vi.mocked(openAccordForAltar).mockClear();
    completeSpine();
  });
  afterEach(() => { offBus(); vi.useRealTimers(); });

  it.each(['orphaned', 'tampered', 'malformed', 'no-webcrypto', 'wasm-unavailable', 'error'])(
    '%s: the line is named, no stage runs, nothing compiles, the ignition ends unsealed',
    async (state) => {
      vi.mocked(openAccordForAltar).mockResolvedValueOnce({ state, line: ALTAR_LINES[state] });
      await holdSeal('FIRE');
      await flush(650 * 6 + 50);
      expect(container.querySelector('[role="status"]')?.textContent).toContain(ALTAR_LINES[state]);
      expect(container.textContent).not.toContain('SPINE READ');
      expect(compileKernel).not.toHaveBeenCalled();
      expect(edge()).toEqual(['kernel_ignited', 'kernel_ignite_ended']);
      expect(events.find(e => e.kind === 'kernel_ignite_ended').payload).toEqual({ sealed: false });
      // the grid is back: the altar cooled, it did not brick
      expect(sealFor('FIRE')).toBeTruthy();
    },
  );

  it('ok: compileKernel receives the opened accord, and the salt is zeroed afterwards', async () => {
    await holdSeal('EARTH');
    await flush(650 * 6 + 50);
    expect(openAccordForAltar).toHaveBeenCalledTimes(1);
    const opts = vi.mocked(compileKernel).mock.calls[0][3];
    expect(opts.accord.baseAccord.rows.length).toBeGreaterThan(0);
    expect(opts.accord.envelopeMeta.ctBytes).toBe(1088);
    expect(opts.accord.salt).toBe(OPENED_SALT.current);
    expect([...OPENED_SALT.current].every(b => b === 0)).toBe(true);
    expect(edge()).toContain('kernel_sealed');
  });

  // Review Focus 6: the real compile, end to end through storage.
  it('the stored artifact holds the formula and no trace of the salt', async () => {
    const real = (await vi.importActual('../compileKernel')).compileKernel;
    vi.mocked(compileKernel).mockImplementationOnce(real);
    await holdSeal('WATER');
    const salt = OPENED_SALT.current.slice();
    await flush(650 * 6 + 50);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw);
    expect(stored.formula.state).toBe('ok');
    expect(stored.formula.modulators.element).toBe('WATER');
    expect(raw).not.toContain(Buffer.from(salt).toString('base64'));
    expect(raw).not.toContain(Buffer.from(salt).toString('hex'));
  });

  it('a failed open, then a retry that opens, compiles and clears the line', async () => {
    vi.mocked(openAccordForAltar).mockResolvedValueOnce({ state: 'no-webcrypto', line: ALTAR_LINES['no-webcrypto'] });
    await holdSeal('FIRE');
    expect(container.textContent).toContain(ALTAR_LINES['no-webcrypto']);
    await holdSeal('FIRE');
    await flush(650 * 6 + 50);
    expect(container.textContent).not.toContain(ALTAR_LINES['no-webcrypto']);
    expect(compileKernel).toHaveBeenCalledTimes(1);
  });
});
