import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import laws from '../../../lib/__tests__/fixtures/legislation-sealed-2026-03-09.json';
import InterceptLattice from '../InterceptLattice';
import { WORD_MS } from '../useInterceptSession';

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

  it('draws the SVG fallback bead when WebGL2 is unavailable', () => {
    render(<InterceptLattice laws={laws} />);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    expect(screen.getByTestId('fallback-bead')).toBeTruthy();
  });

  it('lights the nodes of a hovered ledger law — all six members for an EU law', () => {
    const euLaw = laws.find((l) => l.location === 'EU');
    const { container } = render(<InterceptLattice laws={laws} highlightLaw={euLaw} />);
    const lit = [...container.querySelectorAll('[data-node][data-highlight="true"]')].map((n) => n.getAttribute('data-node'));
    expect(lit.sort()).toEqual(['BE', 'DE', 'FR', 'IE', 'NL', 'SE']);
    expect(screen.getByTestId('eu-membrane').getAttribute('data-highlight')).toBe('true');
  });

  it('shows flickering ticks for CHALLENGED laws at now only', () => {
    const { container } = render(<InterceptLattice laws={laws} />);
    expect(container.querySelectorAll('[data-node="CA"] [data-state="flicker"]')).toHaveLength(3);
    setStep(4);
    expect(container.querySelectorAll('[data-node="CA"] [data-state="flicker"]')).toHaveLength(0);
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
});
