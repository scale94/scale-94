import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import CompiledMercuryKernel from '../CompiledMercuryKernel';
import { unlockMercuryKernel } from '../mercuryKernelUnlock';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const btnWith = (container, needle) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.includes(needle));

describe('CompiledMercuryKernel', () => {
  it('renders nothing while locked', () => {
    const { container } = render(<CompiledMercuryKernel />);
    expect(container.textContent).toBe('');
  });

  it('unlocked: shows header, buttons, and the RTFM byline', () => {
    unlockMercuryKernel();
    const { container } = render(<CompiledMercuryKernel />);
    const text = container.textContent;
    expect(text).toContain('mercury-scale kernel');
    expect(text).toContain('compile → download');
    expect(text).toContain('[copy]');
    expect(text).toContain('we read the fucking manual so you never have to');
  });

  it('copy writes the raw kernel source to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    unlockMercuryKernel();
    const { container } = render(<CompiledMercuryKernel />);
    await fireEvent.click(btnWith(container, '[copy]'));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('MERCURY-SCALE KERNEL');
  });

  it('download builds an .md blob and flips the button to downloaded', () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    unlockMercuryKernel();
    const { container } = render(<CompiledMercuryKernel />);
    const dlBtn = btnWith(container, 'download');
    fireEvent.click(dlBtn);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(dlBtn.textContent).toContain('downloaded');
  });
});
