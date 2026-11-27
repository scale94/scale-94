// /CRYPTOGRAPHY identity panel (spec §5.3, §6.2, §6.5): fingerprint, backup, restore, rotate.
// The vault is a recording stub here; the real vault is tested in lib/__tests__/identityVault.test.js.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';
import IdentityPanel from '../cryptography/IdentityPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const FP = '0123456789abcdef0123456789abcdef';
const ID = { ek: new Uint8Array(1184), pk: new Uint8Array(1952), fp: FP, createdAt: 1_700_000_000_000, volatile: false };
const PARAMS = { mlkem: 'ML-KEM-768', mldsa: 'ML-DSA-65', argon2: { m_kib: 65536, t: 3, p: 4 } };

let container, root, vault, onIdentityChanged, download;

function stubVault(over = {}) {
  return {
    getIdentityIfExists: vi.fn(async () => ID),
    getOrCreateIdentity: vi.fn(async () => ID),
    exportBackup: vi.fn(async () => new Uint8Array([1, 2, 3])),
    importBackup: vi.fn(async () => ({ ok: true, identity: { ...ID, fp: 'f'.repeat(32) } })),
    rotate: vi.fn(async () => ({ ...ID, fp: 'a'.repeat(32) })),
    ...over,
  };
}

async function mount(v = stubVault(), props = {}) {
  vault = v;
  onIdentityChanged = vi.fn(async () => {});
  download = vi.fn();
  await act(async () => {
    root.render(<IdentityPanel getVault={async () => vault} getParams={async () => PARAMS}
      onIdentityChanged={onIdentityChanged} download={download} {...props} />);
  });
}

const text = () => container.textContent;
const button = (label) => [...container.querySelectorAll('button')].find(b => b.textContent.includes(label));
const input = (name) => container.querySelector(`[data-field="${name}"]`);
function type(el, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function click(el) { await act(async () => { el.click(); }); }

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('IdentityPanel', () => {
  it('shows the fingerprint in 8 groups with its derivation, and the primitives', async () => {
    await mount();
    expect(text()).toContain('0123 4567 89ab cdef 0123 4567 89ab cdef');
    expect(text()).toContain('FP · SHA-256(ek‖pk)[0..16]');
    expect(text()).toContain('ML-KEM-768');
    expect(text()).toContain('ML-DSA-65');
  });

  it('no identity yet: offers to create one (crystallize reuses it)', async () => {
    await mount(stubVault({ getIdentityIfExists: vi.fn(async () => null) }));
    expect(text()).toContain('NO IDENTITY YET');
    await click(button('CREATE IDENTITY'));
    expect(vault.getOrCreateIdentity).toHaveBeenCalledTimes(1);
    expect(text()).toContain('0123 4567');
  });

  it('a vault that cannot start names the reason', async () => {
    await mount(undefined, { getVault: async () => { throw new Error('no WebCrypto on this origin'); } });
    expect(text()).toContain('IDENTITY UNAVAILABLE — this origin has no WebCrypto');
  });

  it('the volatile label shows when the identity is not persisted', async () => {
    await mount(stubVault({ getIdentityIfExists: vi.fn(async () => ({ ...ID, volatile: true })) }));
    expect(text()).toContain('VOLATILE IDENTITY — will not survive reload');
  });

  it('backup: the KDF label states the real parameters; under 12 characters is disabled; it downloads', async () => {
    await mount();
    expect(text()).toContain('Argon2id · m=64 MiB · t=3 · p=4 · RFC 9106 §4 option 2');
    type(input('backup-pass'), 'short');
    expect(button('BACKUP').disabled).toBe(true);
    type(input('backup-pass'), 'twelve chars');
    expect(button('BACKUP').disabled).toBe(false);
    await click(button('BACKUP'));
    expect(vault.exportBackup).toHaveBeenCalledWith('twelve chars');
    expect(download).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 'scale94-identity-01234567.json');
  });

  it('restore with a wrong passphrase leaves the identity unchanged and says so', async () => {
    await mount(stubVault({ importBackup: vi.fn(async () => ({ ok: false, reason: 'bad-passphrase' })) }));
    const file = new File([new Uint8Array([9])], 'b.json');
    await act(async () => {
      Object.defineProperty(input('restore-file'), 'files', { value: [file], configurable: true });
      input('restore-file').dispatchEvent(new Event('change', { bubbles: true }));
    });
    type(input('restore-pass'), 'whatever passphrase');
    await click(button('RESTORE'));
    expect(text()).toContain('WRONG PASSPHRASE — identity unchanged');
    expect(onIdentityChanged).not.toHaveBeenCalled();
    expect(text()).toContain('0123 4567');
  });

  it('a good restore swaps the identity and reconciles the spine', async () => {
    await mount();
    const file = new File([new Uint8Array([9])], 'b.json');
    await act(async () => {
      Object.defineProperty(input('restore-file'), 'files', { value: [file], configurable: true });
      input('restore-file').dispatchEvent(new Event('change', { bubbles: true }));
    });
    type(input('restore-pass'), 'whatever passphrase');
    await click(button('RESTORE'));
    expect(vault.importBackup).toHaveBeenCalledTimes(1);
    expect(onIdentityChanged).toHaveBeenCalledTimes(1);
    expect(text()).toContain('ffff ffff');
  });

  it('rotate needs two clicks, warns about orphaning, then reconciles', async () => {
    await mount();
    await click(button('ROTATE'));
    expect(vault.rotate).not.toHaveBeenCalled();
    expect(text()).toContain('Rotating orphans the sealed accord. SEAL ORPHANED — the key evaporated.');
    await click(button('ROTATE — I understand'));
    expect(vault.rotate).toHaveBeenCalledTimes(1);
    expect(onIdentityChanged).toHaveBeenCalledTimes(1);
    expect(text()).toContain('aaaa aaaa');
  });
});

describe('ClassifiedTab keygen', () => {
  it('uses the structured mlkem768_keygen export, never parses keys out of a log', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/terminal/views/ClassifiedTab.jsx'), 'utf8');
    expect(src).not.toContain('ENCAPSULATION KEY (PUBLIC)');
    expect(src).not.toContain('parseMLKemKeypair');
    expect(src).toContain('mlkem768_keygen()');
    expect(src).toContain('<IdentityPanel');
  });
});
