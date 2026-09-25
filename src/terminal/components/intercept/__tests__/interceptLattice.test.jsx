import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import laws from '../../../lib/__tests__/fixtures/legislation-sealed-2026-03-09.json';
import InterceptLattice from '../InterceptLattice';
import { WORD_MS } from '../useInterceptSession';
import { nodeXY, nodeAt } from '../interceptGeometry';

let lastSceneVersion;
vi.mock('../InterceptField', () => ({
  default: ({ sceneVersion, onLiveChange }) => {
    lastSceneVersion = sceneVersion;
    onLiveChange?.(false);
    return null;
  },
}));

const node = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const fate = () => screen.getByTestId('fate-line').textContent;
const setStep = (i) => fireEvent.change(screen.getByLabelText('legislative time'), { target: { value: String(i) } });

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('InterceptLattice (spec §5, §6, §8, §9)', () => {
  it('opens at now with the pinned readout', () => {
    render(<InterceptLattice laws={laws} />);
    expect(screen.getByLabelText('legislative time').value).toBe('3');
    expect(screen.getByTestId('lattice-readout').textContent).toBe('in force 30 / 44 · unread 1 · unkept none · unnamed none');
    expect(fate()).toBe('choose where it leaves · then where it lands');
  });

  it('moves the readout with the ratchet', () => {
    render(<InterceptLattice laws={laws} />);
    setStep(1);
    expect(screen.getByTestId('lattice-readout').textContent).toBe('in force 18 / 44 · unread 3 · unkept 6 · unnamed 18');
  });

  it('sends a packet between two clicked nodes and re-sends on a ratchet move', () => {
    const onNodeSelect = vi.fn();
    render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
    setStep(0);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    expect(fate()).toBe('canada → new zealand · 2 hops · arrived. unseen.');
    setStep(5);
    expect(fate()).toBe('canada → new zealand · 2 hops · seen, named, measured, watched before leaving · read at canada, united states · kept at canada, united states · traced at canada');
    expect(onNodeSelect.mock.calls.map((c) => c[0])).toEqual(['CA', 'NZ']);
  });

  it('bends the route through a waypoint with shift, and resets on the source', () => {
    const onNodeSelect = vi.fn();
    render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
    setStep(0);
    fireEvent.keyDown(node('canada'), { key: 'Enter' });
    fireEvent.keyDown(node('new zealand'), { key: 'Enter' });
    fireEvent.keyDown(node('australia'), { key: 'Enter', shiftKey: true });
    expect(fate()).toBe('canada → new zealand · 3 hops · arrived. unseen.');
    fireEvent.click(node('canada'));
    expect(fate()).toBe('choose where it leaves · then where it lands');
    expect(onNodeSelect).toHaveBeenLastCalledWith(null);
  });

  it('flashes each word at its node, then lets it fade', () => {
    vi.useFakeTimers();
    const { container } = render(<InterceptLattice laws={laws} />);
    setStep(5);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(container.querySelector('[data-word="digitalId"]').textContent).toBe('named');
    act(() => { vi.advanceTimersByTime(WORD_MS + 1); });
    expect(container.querySelector('[data-word="digitalId"]')).toBeNull();
  });

  it("keeps a later word at its spawn slot when an older word at the same node expires", () => {
    vi.useFakeTimers();
    const { container } = render(<InterceptLattice laws={laws} />);
    setStep(5);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    // 'backdoor' (read) spawns at canada at ~450ms, alongside the source-phase
    // words (seen/named/measured/watched) spawned at 0ms.
    act(() => { vi.advanceTimersByTime(500); });
    const before = container.querySelector('[data-word="backdoor"]').getAttribute('y');
    // Past WORD_MS (1600ms): the 0ms words expire and are removed from the
    // list. The 450ms word must not jump down to fill their slots.
    act(() => { vi.advanceTimersByTime(1200); });
    const after = container.querySelector('[data-word="backdoor"]').getAttribute('y');
    expect(after).toBe(before);
  });

  it('draws the SVG fallback bead when WebGL2 is unavailable', () => {
    render(<InterceptLattice laws={laws} />);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    expect(screen.getByTestId('fallback-bead')).toBeTruthy();
  });

  it('fades the fallback bead out after the gate instead of parking it at the destination forever', () => {
    vi.useFakeTimers();
    render(<InterceptLattice laws={laws} />);
    setStep(5);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    expect(screen.getByTestId('fallback-bead')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByTestId('fallback-bead')).toBeNull();
  });

  it('lights the nodes of a hovered ledger law — all six members for an EU law', () => {
    const euLaw = laws.find((l) => l.location === 'EU');
    const { container } = render(<InterceptLattice laws={laws} highlightLaw={euLaw} />);
    const lit = [...container.querySelectorAll('[data-node][data-highlight="true"]')].map((n) => n.getAttribute('data-node'));
    expect(lit.sort()).toEqual(['BE', 'DE', 'FR', 'IE', 'NL', 'SE']);
    expect(screen.getByTestId('eu-membrane').getAttribute('data-highlight')).toBe('true');
  });

  it("raises a hovered law's own tap ticks, leaving the node's other ticks alone", () => {
    const law = laws.find((l) => l.id === 'LAW-CA-2025-C2-001');
    const { container } = render(<InterceptLattice laws={laws} highlightLaw={law} />);
    const backdoor = container.querySelector('[data-node="CA"] [data-tick="backdoor"]');
    const digitalId = container.querySelector('[data-node="CA"] [data-tick="digitalId"]');
    expect(backdoor.getAttribute('data-highlight')).toBe('true');
    expect(digitalId.getAttribute('data-highlight')).toBe('false');
  });

  it('shows flickering ticks for CHALLENGED laws at now only', () => {
    const { container } = render(<InterceptLattice laws={laws} />);
    expect(container.querySelectorAll('[data-node="CA"] [data-state="flicker"]')).toHaveLength(3);
    setStep(4);
    expect(container.querySelectorAll('[data-node="CA"] [data-state="flicker"]')).toHaveLength(0);
  });

  it('counts only in-force taps for the node aria-label, calling out contested ticks separately', () => {
    render(<InterceptLattice laws={laws} />);
    expect(node('canada').getAttribute('aria-label')).toBe('canada · 2 taps in force · 3 contested');
  });

  it('keeps the legend honest', () => {
    render(<InterceptLattice laws={laws} />);
    expect(screen.getByText(/each word marks what the law permits, not what happened/)).toBeTruthy();
    expect(screen.getByText(/country-level connectivity, not cable routes/)).toBeTruthy();
  });

  it('gives each node a visible keyboard-focus ring (WCAG 2.4.7)', () => {
    const { container } = render(<InterceptLattice laws={laws} />);
    const canada = node('canada');
    expect(canada.tabIndex).toBe(0);
    const styleText = container.querySelector('style').textContent;
    expect(styleText).toMatch(/:focus-visible/);
    expect(styleText).toMatch(/iv-focus-ring/);
  });

  it('folds the corpus size into the scene version, so a corpus swap repaints under reduced motion', () => {
    const { rerender } = render(<InterceptLattice laws={laws} />);
    const before = lastSceneVersion;
    rerender(<InterceptLattice laws={laws.slice(0, laws.length - 1)} />);
    expect(lastSceneVersion).not.toBe(before);
  });

  it('ignores a repeated keydown from a held Enter, so it does not re-cycle the route', () => {
    const onNodeSelect = vi.fn();
    render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
    setStep(0);
    fireEvent.keyDown(node('canada'), { key: 'Enter' });
    expect(onNodeSelect).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(node('canada'), { key: 'Enter', repeat: true });
    expect(onNodeSelect).toHaveBeenCalledTimes(1);
  });

  it('renders the read-mark orbit static under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<InterceptLattice laws={laws} />);
    setStep(5);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    const readMark = container.querySelector('[data-mark="read"]');
    expect(readMark).toBeTruthy();
    expect(readMark.querySelector('animateTransform')).toBeNull();
    vi.unstubAllGlobals();
  });

  describe('touch loupe over the European cluster', () => {
    const tap = (el, pointerType = 'touch', at = {}) => {
      fireEvent.pointerUp(el, { pointerType, ...at });
      fireEvent.click(el, at);
    };
    const loupe = () => screen.queryByTestId('eu-loupe');
    const loupeButton = (id) => loupe().querySelector(`[data-loupe-node="${id}"]`);
    const nodeG = (id) => document.querySelector(`[data-node="${id}"]`);
    const IDLE = 'choose where it leaves · then where it lands';

    // The loupe ignores picks for 300ms after it opens; tests drive the clock.
    let now;
    const settle = () => { now += 300; };
    beforeEach(() => {
      now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);
    });
    afterEach(() => { vi.restoreAllMocks(); });

    it('opens on a touch tap on a crowded node, without choosing it', () => {
      const onNodeSelect = vi.fn();
      render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      tap(node('germany'));
      expect(loupe()).toBeTruthy();
      expect(loupe().querySelectorAll('[data-loupe-node]')).toHaveLength(7);
      expect(document.activeElement).toBe(loupe().querySelector('[data-loupe-node]'));
      expect(fate()).toBe(IDLE);
      expect(onNodeSelect).not.toHaveBeenCalled();
    });

    it('is a labelled dialog, and takes the nodes out of the tab order while open', () => {
      render(<InterceptLattice laws={laws} />);
      tap(node('germany'));
      expect(screen.getByRole('dialog', { name: 'european cluster' })).toBe(loupe());
      expect(nodeG('DE').tabIndex).toBe(-1);
      expect(nodeG('CA').tabIndex).toBe(-1);
      fireEvent.keyDown(loupeButton('UK'), { key: 'Escape' });
      expect(nodeG('DE').tabIndex).toBe(0);
    });

    it('chooses the tapped loupe button, closes, and focuses the chosen node', () => {
      const onNodeSelect = vi.fn();
      render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      tap(node('germany'));
      settle();
      fireEvent.click(loupeButton('FR'));
      expect(onNodeSelect).toHaveBeenCalledWith('FR');
      expect(onNodeSelect).toHaveBeenCalledTimes(1);
      expect(loupe()).toBeNull();
      expect(document.activeElement).toBe(nodeG('FR'));
    });

    it('ignores picks and backdrop taps for 300ms after opening (an impatient re-tap)', () => {
      const onNodeSelect = vi.fn();
      render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      tap(node('germany'));
      fireEvent.click(loupeButton('SE'));
      fireEvent.click(screen.getByTestId('loupe-backdrop'));
      now += 299;
      fireEvent.keyDown(loupeButton('SE'), { key: 'Enter' });
      expect(loupe()).toBeTruthy();
      expect(onNodeSelect).not.toHaveBeenCalled();
      now += 1;
      fireEvent.click(loupeButton('DE'));
      expect(onNodeSelect).toHaveBeenCalledWith('DE');
      expect(loupe()).toBeNull();
    });

    it('chooses from the keyboard, ignoring a held key', () => {
      const onNodeSelect = vi.fn();
      render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      tap(node('germany'));
      settle();
      fireEvent.keyDown(loupeButton('FR'), { key: 'Enter', repeat: true });
      expect(onNodeSelect).not.toHaveBeenCalled();
      fireEvent.keyDown(loupeButton('FR'), { key: ' ' });
      expect(onNodeSelect).toHaveBeenCalledWith('FR');
      expect(loupe()).toBeNull();
    });

    it('closes on Escape and on the backdrop, choosing nothing and focusing the opener', () => {
      const onNodeSelect = vi.fn();
      render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      tap(node('germany'));
      fireEvent.keyDown(loupeButton('UK'), { key: 'Escape' });
      expect(loupe()).toBeNull();
      expect(document.activeElement).toBe(nodeG('DE'));
      tap(node('france'));
      settle();
      fireEvent.click(screen.getByTestId('loupe-backdrop'));
      expect(loupe()).toBeNull();
      expect(document.activeElement).toBe(nodeG('FR'));
      expect(onNodeSelect).not.toHaveBeenCalled();
      expect(fate()).toBe(IDLE);
    });

    it('never scrolls the page when it moves focus', () => {
      const focus = vi.spyOn(SVGElement.prototype, 'focus');
      render(<InterceptLattice laws={laws} />);
      tap(node('germany'));
      fireEvent.keyDown(loupeButton('UK'), { key: 'Escape' });
      tap(node('germany'));
      settle();
      fireEvent.click(loupeButton('DE'));
      expect(focus).toHaveBeenCalledTimes(4);
      for (const call of focus.mock.calls) expect(call).toEqual([{ preventScroll: true }]);
    });

    it('opens from a touch on the EU membrane too', () => {
      render(<InterceptLattice laws={laws} />);
      tap(screen.getByTestId('eu-membrane'));
      expect(loupe()).toBeTruthy();
    });

    it('chooses an uncrowded node directly on touch', () => {
      const onNodeSelect = vi.fn();
      render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      tap(node('canada'));
      expect(loupe()).toBeNull();
      expect(onNodeSelect).toHaveBeenCalledWith('CA');
    });

    it('bends on a pen tap, as on a touch tap', () => {
      render(<InterceptLattice laws={laws} />);
      setStep(0);
      fireEvent.click(node('canada'));
      fireEvent.click(node('new zealand'));
      tap(node('australia'), 'pen');
      expect(fate()).toBe('canada → new zealand · 3 hops · arrived. unseen.');
    });

    it('leaves the mouse alone: a click on germany chooses it directly', () => {
      const onNodeSelect = vi.fn();
      render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      tap(node('germany'), 'mouse');
      expect(loupe()).toBeNull();
      expect(onNodeSelect).toHaveBeenCalledWith('DE');
      fireEvent.click(node('france'));
      expect(loupe()).toBeNull();
      expect(onNodeSelect).toHaveBeenLastCalledWith('FR');
    });

    it('fans the buttons out from their nodes, but not under reduced motion', () => {
      const { container, unmount } = render(<InterceptLattice laws={laws} />);
      tap(node('germany'));
      expect(loupeButton('DE').getAttribute('class')).toBe('iv-loupe-in');
      expect(container.querySelector('style').textContent).toMatch(/prefers-reduced-motion[^}]*\.iv-loupe-in/);
      unmount();
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
      render(<InterceptLattice laws={laws} />);
      tap(node('germany'));
      expect(loupeButton('DE').getAttribute('class')).toBeNull();
    });
  });

  describe('hit cells under the route filament', () => {
    // jsdom has no SVG geometry: map client coordinates 1:1 onto the viewBox.
    const identityCTM = () => {
      const svg = screen.getByTestId('intercept-overlay');
      const ident = { a: 1, inverse: () => ident };
      svg.getScreenCTM = () => ident;
      svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
      return svg;
    };
    // A point on the US–CA segment, 15 units from canada: inside CA's cell, outside its core.
    const nearCA = () => {
      const [cx, cy] = nodeXY('CA');
      const [ux, uy] = nodeXY('US');
      const d = Math.hypot(ux - cx, uy - cy);
      return [cx + ((ux - cx) / d) * 15, cy + ((uy - cy) / d) * 15];
    };
    const grab = () => screen.getByTestId('route-grab');
    const route = (a, b) => { fireEvent.click(node(a)); fireEvent.click(node(b)); };

    it('draws the capped cells under the grab band, and a small core over it', () => {
      const { container } = render(<InterceptLattice laws={laws} />);
      route('canada', 'new zealand');
      const cell = container.querySelector('[data-hit-cell="CA"]');
      expect(cell.getAttribute('aria-hidden')).toBe('true');
      expect(cell.compareDocumentPosition(grab()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const core = container.querySelector('[data-node="CA"] [data-hit-core]');
      expect(core.getAttribute('r')).toBe('8');
      expect(grab().compareDocumentPosition(core) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('a click on a cell acts as a click on its node', () => {
      const onNodeSelect = vi.fn();
      const { container } = render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      fireEvent.pointerUp(container.querySelector('[data-hit-cell="CA"]'), { pointerType: 'mouse' });
      fireEvent.click(container.querySelector('[data-hit-cell="CA"]'));
      expect(onNodeSelect).toHaveBeenCalledWith('CA');
    });

    it('lets the mouse start a bend-drag in the outer ring of a node cell', () => {
      render(<InterceptLattice laws={laws} />);
      route('canada', 'new zealand');
      const svg = identityCTM();
      const [x, y] = nearCA();
      expect(nodeAt([x, y])).toBe('CA');
      fireEvent.pointerDown(grab(), { pointerType: 'mouse', clientX: x, clientY: y });
      expect(svg.style.touchAction).toBe('none');
      fireEvent.pointerUp(svg, { pointerType: 'mouse' });
    });

    it('turns a touch tap on the band into a tap on the node whose cell holds it', () => {
      const onNodeSelect = vi.fn();
      render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      route('canada', 'new zealand');
      const svg = identityCTM();
      const [x, y] = nearCA();
      fireEvent.pointerDown(grab(), { pointerType: 'touch', clientX: x, clientY: y });
      expect(svg.style.touchAction).toBe('auto');
      fireEvent.pointerUp(grab(), { pointerType: 'touch', clientX: x, clientY: y });
      fireEvent.click(grab(), { clientX: x, clientY: y });
      // Same as tapping canada itself: it is the source, so the route resets.
      expect(onNodeSelect).toHaveBeenLastCalledWith(null);
      expect(fate()).toBe('choose where it leaves · then where it lands');
    });

    it('routes a touch tap on the band near a crowded node into the loupe', () => {
      const onNodeSelect = vi.fn();
      render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
      route('united states', 'germany');
      identityCTM();
      const [dx, dy] = nodeXY('DE');
      const [ux, uy] = nodeXY('US');
      const d = Math.hypot(ux - dx, uy - dy);
      const at = { clientX: dx + ((ux - dx) / d) * 10, clientY: dy + ((uy - dy) / d) * 10 };
      expect(nodeAt([at.clientX, at.clientY])).toBe('DE');
      fireEvent.pointerUp(grab(), { pointerType: 'touch', ...at });
      fireEvent.click(grab(), at);
      expect(screen.getByTestId('eu-loupe')).toBeTruthy();
      expect(onNodeSelect).toHaveBeenCalledTimes(2);
    });
  });
});
