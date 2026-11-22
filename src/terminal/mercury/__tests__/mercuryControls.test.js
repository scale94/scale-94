// src/terminal/mercury/__tests__/mercuryControls.test.js — the parameter sliders on a phone (fix/mercury-motion):
// a 4 px track with no touch-action lost the finger to the browser's pan (pointercancel), and every pointer move
// re-rendered the whole stage with an unsnapped value. The density range also started above the phone default.
import { describe, it, expect } from 'vitest';
import { snapSlider } from '../sliderMath';
import controlsSrc from '../MercuryControls.jsx?raw';
import tabSrc from '../../views/MercuryTab.jsx?raw';

describe('snapSlider', () => {
  it('clamps to [min, max] and snaps to step, without float noise', () => {
    expect(snapSlider(0.123456, 0.01, 0.4, 0.01)).toBe(0.12);
    expect(snapSlider(-5, 0, 1, 0.01)).toBe(0);
    expect(snapSlider(9, 0, 1, 0.01)).toBe(1);
    expect(snapSlider(1234, 500, 15000, 500)).toBe(1000);
    expect(snapSlider(0.07 + 0.000000001, 0, 1, 0.01)).toBe(0.07);
  });
  it('the last partial step reaches max', () => {
    expect(snapSlider(0.399, 0.01, 0.4, 0.01)).toBe(0.4);
  });
});

describe('slider wiring', () => {
  it('a finger-sized hit area the browser does not take for a pan', () => {
    expect(controlsSrc).toContain("style={{ touchAction: 'none' }}");
    expect(controlsSrc).toContain('className="relative h-9 flex items-center cursor-pointer"');
  });
  it('the drag ends on up, cancel or a lost capture; it is not inferred from e.buttons', () => {
    expect(controlsSrc).toContain('onPointerUp={end}');
    expect(controlsSrc).toContain('onPointerCancel={end}');
    expect(controlsSrc).toContain('onLostPointerCapture={end}');
    expect(controlsSrc).not.toContain('e.buttons');
  });
  it('one change per animation frame, and only when the snapped value moves', () => {
    expect(controlsSrc).toContain('if (v === sent.current) return;');
    expect(controlsSrc).toContain('raf.current = requestAnimationFrame(flush);');
  });
  it('density: the range holds the phone default (600), and the low-fps auto-reduce really reduces', () => {
    expect(controlsSrc).toContain('<Slider label="density"    value={params.density}    min={500} max={15000} step={100}');
    expect(tabSrc).toContain('const reduced = Math.max(500, Math.round(p.density * 0.75 / 100) * 100);');
  });
});
