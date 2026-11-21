import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANDING_TAB, LANDING_PATH } from '../landing';

const app = readFileSync(resolve(__dirname, '../App.jsx'), 'utf8');

describe('landing tab', () => {
  it('opens on /MERCURY, and the path matches the tab', () => {
    expect(LANDING_TAB).toBe('mercury');
    expect(LANDING_PATH).toBe('~/system/mercury');
  });

  it('App seeds its state from the landing constants, not a hard-coded tab', () => {
    expect(app).toMatch(/useState\(LANDING_TAB\)/);
    expect(app).toMatch(/useState\(LANDING_PATH\)/);
  });

  it('mercury only mounts once the boot sequence has handed off', () => {
    expect(app).toMatch(/activeTab === 'mercury' && bootRevealed/);
  });

  it('/KERNEL stays reachable from both the top and the mobile nav', () => {
    const navs = app.match(/aria-label="Kernel"/g) ?? [];
    expect(navs.length).toBeGreaterThanOrEqual(2);
    expect(app.match(/handleNav\('~\/system\/kernel', 'kernel'\)/g).length).toBeGreaterThanOrEqual(2);
  });
});
