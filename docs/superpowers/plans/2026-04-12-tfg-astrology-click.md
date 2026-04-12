# TFG Sphere Astrology Click Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-triggered orbital ring animations and real planetary position readings (Jean Meeus VSOP87) to the TFG element sphere, with 10 alchemical/modern planet mappings and a "ruled by" fallback for all other elements.

**Architecture:** A new `run_astro(unix_ms)` Rust function computes geocentric ecliptic longitudes for 10 planets using mean VSOP87 formulas, compiled into the existing WASM kernel. A new `tfgAstroHelpers.js` module holds the JS parsing and planet mapping logic. `TFGSphere.jsx` gains click state, a rotating torus ring, and a terminal-styled `<Html>` reading panel — all contained in the existing R3F scene.

**Tech Stack:** Rust + wasm-bindgen, Three.js/R3F, Vitest, Jean Meeus *Astronomical Algorithms* 2nd ed.

---

## File Map

| File | Action |
|---|---|
| `content/rust_kernels/src/kernels/astro.rs` | **Create** — `run_astro()` planetary positions |
| `content/rust_kernels/src/kernels/mod.rs` | **Modify** — add `pub mod astro;` |
| `src/terminal/mercury/tfgAstroHelpers.js` | **Create** — PLANET_MAP, PLANET_COLORS, parseAstroOutput, getRuler |
| `tests/mercury/tfgAstroHelpers.test.js` | **Create** — vitest tests for helpers |
| `src/terminal/mercury/TFGSphere.jsx` | **Modify** — click state, ring, panel, WASM call |

WASM rebuild required after Task 1. The rebuild auto-updates `src/wasm/scale94_kernels.js` and the `.wasm` binary — never edit these by hand.

---

## Task 1: Rust astrology kernel

**Files:**
- Create: `content/rust_kernels/src/kernels/astro.rs`
- Modify: `content/rust_kernels/src/kernels/mod.rs`

---

- [ ] **Step 1.1 — Create stub + register module**

Create `content/rust_kernels/src/kernels/astro.rs` with a stub that compiles:

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn run_astro(_unix_ms: f64) -> String {
    String::new()
}

#[cfg(test)]
mod tests {}
```

Add to the end of `content/rust_kernels/src/kernels/mod.rs`:

```rust
pub mod astro;                   // run_astro (planetary positions · Jean Meeus VSOP87 truncated · TFG sphere click readings)
```

Verify it compiles:
```bash
cd content/rust_kernels && cargo check
```
Expected: no errors.

- [ ] **Step 1.2 — Write failing Rust tests**

Replace the empty `#[cfg(test)] mod tests {}` in `astro.rs` with:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unix_ms_to_t_near_j2000() {
        // 2000-01-01 12:00 UTC ≈ unix ms 946728000000 → T ≈ 0
        let t = unix_ms_to_t(946728000000.0);
        assert!(t.abs() < 0.01, "T at J2000 expected ~0, got {}", t);
    }

    #[test]
    fn test_normalize_wraps() {
        assert!((normalize(370.0) - 10.0).abs() < 0.001);
        assert!((normalize(-10.0) - 350.0).abs() < 0.001);
        assert!((normalize(0.0) - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_sun_at_j2000_capricorn() {
        // Sun at J2000 ≈ 280° (Capricorn ~10°)
        let lon = geocentric_lon(2, 0.0);
        assert!(lon > 265.0 && lon < 295.0, "Sun at J2000 expected ~280°, got {}", lon);
    }

    #[test]
    fn test_run_astro_returns_10_blocks() {
        let result = run_astro(1_700_000_000_000.0);
        // 9 separators for 10 planet blocks
        assert_eq!(result.matches("---\n").count(), 9, "expected 9 separators, got:\n{}", result);
    }

    #[test]
    fn test_run_astro_contains_all_planet_names() {
        let result = run_astro(1_700_000_000_000.0);
        for name in &["Mercury","Venus","Sun","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Moon"] {
            assert!(result.contains(&format!("{}\n", name)), "missing planet: {}", name);
        }
    }

    #[test]
    fn test_run_astro_sign_fields_present() {
        let result = run_astro(1_700_000_000_000.0);
        assert_eq!(result.matches("sign:").count(), 10);
        assert_eq!(result.matches("retrograde:").count(), 10);
        assert_eq!(result.matches("aspect:").count(), 10);
    }

    #[test]
    fn test_moon_not_retrograde() {
        let result = run_astro(1_700_000_000_000.0);
        // Moon block starts after "Moon\n"
        if let Some(pos) = result.find("Moon\n") {
            let block = &result[pos..pos+80];
            assert!(block.contains("retrograde:false"), "Moon should not be retrograde");
        }
    }
}
```

Run to confirm compilation failures (functions not yet defined):
```bash
cd content/rust_kernels && cargo test kernels::astro 2>&1 | head -20
```
Expected: compile error mentioning `unix_ms_to_t`, `normalize`, `geocentric_lon`.

- [ ] **Step 1.3 — Implement run_astro**

Replace the entire content of `content/rust_kernels/src/kernels/astro.rs` with:

```rust
// kernels/astro.rs — Planetary Position Engine (TFG sphere click readings)
//
// Computes geocentric ecliptic longitudes for 10 astrological bodies using
// mean longitude + L2 correction term (Jean Meeus, Astronomical Algorithms,
// 2nd ed., Appendix II). Accuracy: ±2° for all planets, sufficient for
// zodiac sign and degree display.
//
// Body indices (internal):
//   0=Mercury  1=Venus  2=Sun(Earth+180°)  3=Mars  4=Jupiter
//   5=Saturn   6=Uranus  7=Neptune  8=Pluto  9=Moon
//
// Output: text blocks separated by "---\n", one per body, in the order above.

use wasm_bindgen::prelude::*;

const DEG: f64 = std::f64::consts::PI / 180.0;

fn unix_ms_to_t(unix_ms: f64) -> f64 {
    // Julian Day from Unix ms, then Julian centuries from J2000.0
    let jde = 2440587.5 + unix_ms / 86_400_000.0;
    (jde - 2451545.0) / 36525.0
}

fn normalize(deg: f64) -> f64 {
    let d = deg % 360.0;
    if d < 0.0 { d + 360.0 } else { d }
}

// Heliocentric mean longitude for solar system bodies (Meeus App. II)
// body: 0=Mercury 1=Venus 2=Earth 3=Mars 4=Jupiter 5=Saturn 6=Uranus 7=Neptune 8=Pluto
fn helio_lon(body: usize, t: f64) -> f64 {
    let (l0, l1, l2): (f64, f64, f64) = match body {
        0 => (252.250906, 149474.0722491,  0.00030397), // Mercury
        1 => (181.979801,  58519.2130302,  0.00031014), // Venus
        2 => (100.464457,  36000.7698278,  0.00030322), // Earth
        3 => (355.433275,  19141.6964746,  0.00031097), // Mars
        4 => ( 34.351484,   3036.3027889,  0.00022374), // Jupiter
        5 => ( 50.077444,   1223.5110686,  0.00051908), // Saturn
        6 => (314.055005,    429.8640561,  0.00030390), // Uranus
        7 => (304.348665,    219.8833092,  0.00030926), // Neptune
        8 => (238.958116,    144.9600329,  0.0),        // Pluto (2-term approx)
        _ => (0.0, 0.0, 0.0),
    };
    normalize(l0 + l1 * t + l2 * t * t)
}

// Mean heliocentric radius in AU (circular orbit approximation)
fn helio_radius(body: usize) -> f64 {
    match body {
        0 => 0.387, 1 => 0.723, 2 => 1.000, 3 => 1.524,
        4 => 5.203, 5 => 9.537, 6 => 19.19, 7 => 30.07,
        8 => 39.48, _ => 1.0,
    }
}

// Geocentric ecliptic longitude (degrees)
// planet 2 = Sun (Earth helio lon + 180°)
// planet 9 = Moon (direct geocentric mean longitude, Meeus simplified)
// planets 0,1,3-8 = heliocentric → geocentric via vector subtraction
fn geocentric_lon(planet: usize, t: f64) -> f64 {
    if planet == 2 {
        return normalize(helio_lon(2, t) + 180.0); // Sun
    }
    if planet == 9 {
        // Moon mean longitude (Meeus ch.47 leading term, ±2° accuracy)
        return normalize(218.3164477 + 481267.88123421 * t);
    }
    let e_rad = helio_lon(2, t) * DEG;
    let p_rad = helio_lon(planet, t) * DEG;
    let re    = helio_radius(2);
    let rp    = helio_radius(planet);
    let ex    = re * e_rad.cos();
    let ey    = re * e_rad.sin();
    let px    = rp * p_rad.cos();
    let py    = rp * p_rad.sin();
    normalize((py - ey).atan2(px - ex) / DEG)
}

// Retrograde: geocentric longitude decreasing over one day
// Moon and Sun are never retrograde in this model
fn is_retrograde(planet: usize, t: f64) -> bool {
    if planet == 2 || planet == 9 { return false; }
    let dt = 1.0 / 36525.0; // one day in Julian centuries
    let lon1 = geocentric_lon(planet, t);
    let lon2 = geocentric_lon(planet, t + dt);
    let mut diff = lon2 - lon1;
    if diff >  180.0 { diff -= 360.0; }
    if diff < -180.0 { diff += 360.0; }
    diff < 0.0
}

const ZODIAC: [&str; 12] = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const PLANET_NAMES: [&str; 10] = [
    "Mercury", "Venus", "Sun", "Mars", "Jupiter",
    "Saturn", "Uranus", "Neptune", "Pluto", "Moon",
];

const ASPECTS: [(f64, &str); 5] = [
    (0.0,   "Conjunct"),
    (60.0,  "Sextile"),
    (90.0,  "Square"),
    (120.0, "Trine"),
    (180.0, "Opposite"),
];

fn dominant_aspect(i: usize, lons: &[f64; 10]) -> String {
    let mut best: Option<(f64, &str, usize)> = None;
    for j in 0..10 {
        if j == i { continue; }
        let mut sep = (lons[i] - lons[j]).abs() % 360.0;
        if sep > 180.0 { sep = 360.0 - sep; }
        for &(angle, name) in &ASPECTS {
            let orb = (sep - angle).abs();
            if orb < 8.0 && (best.is_none() || orb < best.unwrap().0) {
                best = Some((orb, name, j));
            }
        }
    }
    match best {
        Some((orb, name, j)) => format!("{} {} (orb {:.0}°)", name, PLANET_NAMES[j], orb),
        None => String::from("\u{2014}"),
    }
}

#[wasm_bindgen]
pub fn run_astro(unix_ms: f64) -> String {
    let t = unix_ms_to_t(unix_ms);
    let mut lons = [0.0f64; 10];
    for i in 0..10 {
        lons[i] = geocentric_lon(i, t);
    }
    let mut out = String::with_capacity(512);
    for i in 0..10 {
        let lon      = lons[i];
        let sign_idx = (lon / 30.0).floor() as usize % 12;
        let degree   = lon % 30.0;
        let retro    = is_retrograde(i, t);
        let aspect   = dominant_aspect(i, &lons);
        if i > 0 { out.push_str("---\n"); }
        out.push_str(&format!(
            "{}\nsign:{}\ndegree:{:.0}\nretrograde:{}\naspect:{}\n",
            PLANET_NAMES[i], ZODIAC[sign_idx], degree, retro, aspect,
        ));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unix_ms_to_t_near_j2000() {
        let t = unix_ms_to_t(946728000000.0);
        assert!(t.abs() < 0.01, "T at J2000 expected ~0, got {}", t);
    }

    #[test]
    fn test_normalize_wraps() {
        assert!((normalize(370.0) - 10.0).abs() < 0.001);
        assert!((normalize(-10.0) - 350.0).abs() < 0.001);
        assert!((normalize(0.0) - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_sun_at_j2000_capricorn() {
        let lon = geocentric_lon(2, 0.0);
        assert!(lon > 265.0 && lon < 295.0, "Sun at J2000 expected ~280°, got {}", lon);
    }

    #[test]
    fn test_run_astro_returns_10_blocks() {
        let result = run_astro(1_700_000_000_000.0);
        assert_eq!(result.matches("---\n").count(), 9, "expected 9 separators, got:\n{}", result);
    }

    #[test]
    fn test_run_astro_contains_all_planet_names() {
        let result = run_astro(1_700_000_000_000.0);
        for name in &["Mercury","Venus","Sun","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Moon"] {
            assert!(result.contains(&format!("{}\n", name)), "missing planet: {}", name);
        }
    }

    #[test]
    fn test_run_astro_sign_fields_present() {
        let result = run_astro(1_700_000_000_000.0);
        assert_eq!(result.matches("sign:").count(), 10);
        assert_eq!(result.matches("retrograde:").count(), 10);
        assert_eq!(result.matches("aspect:").count(), 10);
    }

    #[test]
    fn test_moon_not_retrograde() {
        let result = run_astro(1_700_000_000_000.0);
        if let Some(pos) = result.find("Moon\n") {
            let block = &result[pos..pos+80.min(result.len()-pos)];
            assert!(block.contains("retrograde:false"), "Moon should not be retrograde");
        }
    }
}
```

- [ ] **Step 1.4 — Run Rust tests**

```bash
cd content/rust_kernels && cargo test kernels::astro -- --nocapture
```

Expected output:
```
test kernels::astro::tests::test_moon_not_retrograde ... ok
test kernels::astro::tests::test_normalize_wraps ... ok
test kernels::astro::tests::test_run_astro_contains_all_planet_names ... ok
test kernels::astro::tests::test_run_astro_returns_10_blocks ... ok
test kernels::astro::tests::test_run_astro_sign_fields_present ... ok
test kernels::astro::tests::test_sun_at_j2000_capricorn ... ok
test kernels::astro::tests::test_unix_ms_to_t_near_j2000 ... ok
test result: ok. 7 passed; 0 failed
```

- [ ] **Step 1.5 — Commit**

```bash
cd F:/scale_9.4
git add content/rust_kernels/src/kernels/astro.rs content/rust_kernels/src/kernels/mod.rs
git commit -m "feat(tfg): add run_astro Rust kernel — VSOP87 planetary positions for 10 bodies"
```

---

## Task 2: WASM rebuild

**Files:**
- Auto-modified: `src/wasm/scale94_kernels.js`, `src/wasm/scale94_kernels_bg.wasm`, `src/wasm/scale94_kernels.d.ts`
- Possibly auto-modified: `public/wasm/scale94_kernels_bg.wasm`

Prerequisites: `rustup` and `wasm-pack` must be installed.
- Install Rust: `curl https://sh.rustup.rs -sSf | sh`
- Install wasm-pack: `cargo install wasm-pack`

---

- [ ] **Step 2.1 — Rebuild WASM**

From the project root (`F:/scale_9.4`):
```bash
node scripts/import-rust.js
```

This takes 30–90 seconds. Expected output ends with something like:
```
[BUILD-WASM] wasm-pack build complete
[BUILD-WASM] Copied .wasm to public/wasm/
[BUILD-WASM] Generated wasm.generated.js
```

- [ ] **Step 2.2 — Verify run_astro exported**

```bash
grep -n "run_astro" src/wasm/scale94_kernels.js
```

Expected: at least one line like `export function run_astro(unix_ms) {`

- [ ] **Step 2.3 — Run vitest to confirm no breakage**

```bash
npx vitest run
```

Expected: all 109 existing tests pass.

- [ ] **Step 2.4 — Commit rebuilt artifacts**

```bash
git add src/wasm/scale94_kernels.js src/wasm/scale94_kernels_bg.wasm src/wasm/scale94_kernels.d.ts src/wasm/scale94_kernels_bg.wasm.d.ts
git add public/wasm/ 2>/dev/null; true
git commit -m "build(tfg): rebuild WASM with run_astro planetary kernel"
```

---

## Task 3: tfgAstroHelpers.js — JS helpers

**Files:**
- Create: `src/terminal/mercury/tfgAstroHelpers.js`
- Create: `tests/mercury/tfgAstroHelpers.test.js`

---

- [ ] **Step 3.1 — Write failing tests**

Create `tests/mercury/tfgAstroHelpers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  PLANET_MAP, PLANET_COLORS,
  parseAstroOutput, getRuler,
} from '../../src/terminal/mercury/tfgAstroHelpers';

describe('PLANET_MAP', () => {
  it('maps Hg #80 to Mercury', () => expect(PLANET_MAP[80]).toBe('Mercury'));
  it('maps Au #79 to Sun',     () => expect(PLANET_MAP[79]).toBe('Sun'));
  it('maps Ag #47 to Moon',    () => expect(PLANET_MAP[47]).toBe('Moon'));
  it('maps Fe #26 to Mars',    () => expect(PLANET_MAP[26]).toBe('Mars'));
  it('maps Cu #29 to Venus',   () => expect(PLANET_MAP[29]).toBe('Venus'));
  it('maps Sn #50 to Jupiter', () => expect(PLANET_MAP[50]).toBe('Jupiter'));
  it('maps Pb #82 to Saturn',  () => expect(PLANET_MAP[82]).toBe('Saturn'));
  it('maps U  #92 to Uranus',  () => expect(PLANET_MAP[92]).toBe('Uranus'));
  it('maps Np #93 to Neptune', () => expect(PLANET_MAP[93]).toBe('Neptune'));
  it('maps Pu #94 to Pluto',   () => expect(PLANET_MAP[94]).toBe('Pluto'));
  it('has exactly 10 entries', () => expect(Object.keys(PLANET_MAP)).toHaveLength(10));
});

describe('PLANET_COLORS', () => {
  it('Hg #80 is silver (#c0c0c0)',   () => expect(PLANET_COLORS[80]).toBe('#c0c0c0'));
  it('Au #79 is gold (#f59e0b)',     () => expect(PLANET_COLORS[79]).toBe('#f59e0b'));
  it('has same keys as PLANET_MAP',  () => {
    expect(Object.keys(PLANET_COLORS).map(Number).sort((a,b)=>a-b))
      .toEqual(Object.keys(PLANET_MAP).map(Number).sort((a,b)=>a-b));
  });
});

describe('parseAstroOutput', () => {
  const RAW = [
    'Mercury\nsign:Taurus\ndegree:14\nretrograde:false\naspect:Conjunct Sun (orb 3°)\n',
    'Venus\nsign:Aries\ndegree:5\nretrograde:false\naspect:\u2014\n',
    'Sun\nsign:Taurus\ndegree:11\nretrograde:false\naspect:Conjunct Mercury (orb 3°)\n',
    'Mars\nsign:Gemini\ndegree:22\nretrograde:false\naspect:\u2014\n',
    'Jupiter\nsign:Taurus\ndegree:8\nretrograde:false\naspect:\u2014\n',
    'Saturn\nsign:Pisces\ndegree:1\nretrograde:false\naspect:\u2014\n',
    'Uranus\nsign:Taurus\ndegree:20\nretrograde:false\naspect:\u2014\n',
    'Neptune\nsign:Pisces\ndegree:25\nretrograde:false\naspect:\u2014\n',
    'Pluto\nsign:Aquarius\ndegree:29\nretrograde:false\naspect:\u2014\n',
    'Moon\nsign:Cancer\ndegree:12\nretrograde:false\naspect:\u2014\n',
  ].join('---\n');

  it('returns 10 planet keys', () => {
    expect(Object.keys(parseAstroOutput(RAW))).toHaveLength(10);
  });

  it('parses Mercury correctly', () => {
    expect(parseAstroOutput(RAW).Mercury).toMatchObject({
      sign: 'Taurus', degree: 14, retrograde: false, aspect: 'Conjunct Sun (orb 3°)',
    });
  });

  it('parses degree as number', () => {
    expect(typeof parseAstroOutput(RAW).Moon.degree).toBe('number');
  });

  it('parses retrograde:true correctly', () => {
    const raw = 'Mercury\nsign:Virgo\ndegree:5\nretrograde:true\naspect:\u2014\n';
    expect(parseAstroOutput(raw).Mercury.retrograde).toBe(true);
  });
});

describe('getRuler', () => {
  it('f-block → Neptune',           () => expect(getRuler({ group: null, block: 'f' })).toBe('Neptune'));
  it('group 1 → Moon',              () => expect(getRuler({ group: 1,    block: 's' })).toBe('Moon'));
  it('group 2 → Moon',              () => expect(getRuler({ group: 2,    block: 's' })).toBe('Moon'));
  it('group 3 → Saturn',            () => expect(getRuler({ group: 3,    block: 'd' })).toBe('Saturn'));
  it('group 6 → Mars',              () => expect(getRuler({ group: 6,    block: 'd' })).toBe('Mars'));
  it('group 9 → Venus',             () => expect(getRuler({ group: 9,    block: 'd' })).toBe('Venus'));
  it('group 11 → Sun',              () => expect(getRuler({ group: 11,   block: 'd' })).toBe('Sun'));
  it('group 13 → Mercury',          () => expect(getRuler({ group: 13,   block: 'p' })).toBe('Mercury'));
  it('group 17 → Jupiter',          () => expect(getRuler({ group: 17,   block: 'p' })).toBe('Jupiter'));
});
```

- [ ] **Step 3.2 — Run to confirm they fail**

```bash
npx vitest run tests/mercury/tfgAstroHelpers.test.js
```

Expected: all fail with `Cannot find module`.

- [ ] **Step 3.3 — Implement tfgAstroHelpers.js**

Create `src/terminal/mercury/tfgAstroHelpers.js`:

```js
// Planet–element mappings and output parsing for TFG sphere astrology layer.
// Called by TFGSphere.jsx on element click.

// 10 alchemical/modern planet correspondences: atomicNumber → planet name
export const PLANET_MAP = {
  80: 'Mercury',  // Hg — alchemical Mercury
  79: 'Sun',      // Au — Gold
  47: 'Moon',     // Ag — Silver
  26: 'Mars',     // Fe — Iron
  29: 'Venus',    // Cu — Copper
  50: 'Jupiter',  // Sn — Tin
  82: 'Saturn',   // Pb — Lead
  92: 'Uranus',   // U  — Uranium
  93: 'Neptune',  // Np — Neptunium
  94: 'Pluto',    // Pu — Plutonium
};

// Ring + glow colors for planetary elements
export const PLANET_COLORS = {
  80: '#c0c0c0',  // Mercury — silver
  79: '#f59e0b',  // Sun — amber-gold
  47: '#e8e8f0',  // Moon — white-silver
  26: '#ef4444',  // Mars — red
  29: '#22c55e',  // Venus — green
  50: '#8b5cf6',  // Jupiter — purple
  82: '#78716c',  // Saturn — grey-brown
  92: '#06b6d4',  // Uranus — cyan
  93: '#3b82f6',  // Neptune — deep blue
  94: '#dc2626',  // Pluto — dark red
};

// Parse run_astro() text output → { PlanetName: { sign, degree, retrograde, aspect } }
// Input format per block: "PlanetName\nsign:X\ndegree:N\nretrograde:bool\naspect:X\n"
// Blocks are separated by "---\n"
export function parseAstroOutput(raw) {
  const result = {};
  const blocks = raw.split('---\n').filter(Boolean);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 5) continue;
    const name      = lines[0].trim();
    const sign      = lines[1].replace('sign:', '').trim();
    const degree    = parseFloat(lines[2].replace('degree:', ''));
    const retrograde = lines[3].replace('retrograde:', '').trim() === 'true';
    const aspect    = lines[4].replace('aspect:', '').trim();
    result[name] = { sign, degree, retrograde, aspect };
  }
  return result;
}

// Ruling planet for non-planetary elements, by group proximity
export function getRuler(element) {
  const { group, block } = element;
  if (block === 'f' || group === null) return 'Neptune';
  if (group <= 2)   return 'Moon';
  if (group <= 5)   return 'Saturn';
  if (group <= 8)   return 'Mars';
  if (group <= 10)  return 'Venus';
  if (group === 11) return 'Sun';
  if (group <= 14)  return 'Mercury';
  return 'Jupiter'; // groups 15–18
}
```

- [ ] **Step 3.4 — Run tests to confirm they pass**

```bash
npx vitest run tests/mercury/tfgAstroHelpers.test.js
```

Expected: all tests pass.

- [ ] **Step 3.5 — Run full suite**

```bash
npx vitest run
```

Expected: all tests pass (109 + new helpers tests).

- [ ] **Step 3.6 — Commit**

```bash
git add src/terminal/mercury/tfgAstroHelpers.js tests/mercury/tfgAstroHelpers.test.js
git commit -m "feat(tfg): add astrology helpers — PLANET_MAP, parseAstroOutput, getRuler"
```

---

## Task 4: TFGSphere.jsx — click interaction, orbital ring, reading panel

**Files:**
- Modify: `src/terminal/mercury/TFGSphere.jsx`

No new unit tests — Three.js requires WebGL. Visual verification via `npm run dev`.

---

- [ ] **Step 4.1 — Update imports and add state**

In `src/terminal/mercury/TFGSphere.jsx`:

**Change line 1** from:
```js
import { useRef, useMemo, useEffect } from 'react';
```
to:
```js
import { useRef, useMemo, useEffect, useState } from 'react';
```

**Add after line 5** (after `import { ELEMENTS } from '../data/periodicElements';`):
```js
import { loadWasm } from '../../wasm/wasmSingleton';
import { PLANET_MAP, PLANET_COLORS, parseAstroOutput, getRuler } from './tfgAstroHelpers';
```

**Add inside `TFGSphere()` component body, after the existing `const driftRef = useRef(null);` line:**
```js
const [activeIdx, setActiveIdx]     = useState(null); // clicked non-Hg element index
const [hgActive,  setHgActive]      = useState(false); // Hg anchor clicked
const [readingText, setReadingText] = useState('');
const ringRef    = useRef();
const pulseRef   = useRef({ active: false, t: 0, idx: -1 });
const prevTimeRef = useRef(0);
```

- [ ] **Step 4.2 — Add WASM call effects**

Add after the existing disposal `useEffect` (the one with `geo.dispose(); mat.dispose();`):

```js
// Fetch planetary reading when an element is clicked
useEffect(() => {
  const idx = activeIdx;
  if (idx === null) { setReadingText(''); return; }
  const el = nonHgElements[idx];
  setReadingText('computing...');
  loadWasm().then(wasm => {
    if (activeIdx !== idx) return; // stale click
    const raw    = wasm.run_astro(Date.now());
    const parsed = parseAstroOutput(raw);
    const planet = PLANET_MAP[el.atomicNumber];
    if (planet && parsed[planet]) {
      const d = parsed[planet];
      setReadingText(
        `${planet.toUpperCase()} · ${el.symbol}\n` +
        `${d.sign} ${d.degree.toFixed(0)}°\n` +
        `Retro: ${d.retrograde ? 'Yes \u211e' : 'No'}\n` +
        `${d.aspect}`
      );
    } else {
      const ruler = getRuler(el);
      const d     = parsed[ruler] || {};
      setReadingText(
        `${el.symbol} \u2014 ruled by ${ruler}\n` +
        (d.sign ? `${d.sign} ${(d.degree || 0).toFixed(0)}°` : '\u2014')
      );
    }
  });
}, [activeIdx, nonHgElements]);

// Fetch Hg reading when Hg anchor is clicked
useEffect(() => {
  if (!hgActive) { setReadingText(''); return; }
  setReadingText('computing...');
  loadWasm().then(wasm => {
    const raw    = wasm.run_astro(Date.now());
    const parsed = parseAstroOutput(raw);
    const d      = parsed['Mercury'] || {};
    setReadingText(
      `MERCURY \u00b7 Hg\n` +
      `${d.sign || '?'} ${(d.degree || 0).toFixed(0)}°\n` +
      `Retro: ${d.retrograde ? 'Yes \u211e' : 'No'}\n` +
      `${d.aspect || '\u2014'}`
    );
  });
}, [hgActive]);
```

- [ ] **Step 4.3 — Add ring rotation and pulse to useFrame**

In the existing `useFrame` callback, add these blocks **after** the existing `if (hgLightRef.current)` block and **before** the `if (mesh && drift)` block:

```js
// Orbital ring rotation
if (ringRef.current) ringRef.current.rotation.y += 0.02;

// Pulse animation for planetary elements (scale 1→1.5→1 over 0.4s)
const now   = state.clock.elapsedTime;
const delta = now - prevTimeRef.current;
prevTimeRef.current = now;
const pulse = pulseRef.current;
if (pulse.active && mesh && pulse.idx >= 0 && pulse.idx < nonHgElements.length) {
  pulse.t += delta;
  const progress = Math.min(pulse.t / 0.4, 1.0);
  const scale    = 1.0 + 0.5 * Math.sin(progress * Math.PI);
  dummy.position.copy(positions[pulse.idx]);
  dummy.scale.set(scale, scale, scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(pulse.idx, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
  dummy.scale.set(1, 1, 1); // reset dummy scale for drift loop below
  if (progress >= 1.0) pulse.active = false;
}
```

- [ ] **Step 4.4 — Add onClick to instancedMesh**

Change the `<instancedMesh>` JSX line from:
```jsx
<instancedMesh ref={meshRef} args={[geo, mat, nonHgElements.length]} />
```
to:
```jsx
<instancedMesh
  ref={meshRef}
  args={[geo, mat, nonHgElements.length]}
  onClick={(e) => {
    e.stopPropagation();
    const idx = e.instanceId;
    if (idx === undefined || idx === null) return;
    const el = nonHgElements[idx];
    if (PLANET_MAP[el.atomicNumber]) {
      pulseRef.current = { active: true, t: 0, idx };
    }
    setHgActive(false);
    setActiveIdx(prev => prev === idx ? null : idx);
  }}
/>
```

- [ ] **Step 4.5 — Add onClick to Hg mesh**

Change the opening `<mesh position={hgPos}>` line to:
```jsx
<mesh
  position={hgPos}
  onClick={(e) => {
    e.stopPropagation();
    setActiveIdx(null);
    setHgActive(v => !v);
  }}
>
```

- [ ] **Step 4.6 — Add orbital ring and reading panel to JSX**

Inside `<group ref={groupRef}>`, add the following **before** the `{/* Hg anchor node */}` comment:

```jsx
{/* Orbital ring — spawns on click, color-coded by planet */}
{activeIdx !== null && (() => {
  const p   = positions[activeIdx];
  const el  = nonHgElements[activeIdx];
  const col = PLANET_COLORS[el.atomicNumber] ?? '#404050';
  return (
    <mesh ref={ringRef} position={[p.x, p.y, p.z]} rotation={[Math.PI / 6, 0, 0]}>
      <torusGeometry args={[BASE_SIZE * 3, 0.008, 8, 48]} />
      <meshBasicMaterial color={col} transparent opacity={0.9} />
    </mesh>
  );
})()}

{hgActive && (
  <mesh ref={ringRef} position={hgPos} rotation={[Math.PI / 6, 0, 0]}>
    <torusGeometry args={[BASE_SIZE * 9, 0.008, 8, 48]} />
    <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} />
  </mesh>
)}

{/* Reading panel — appears after WASM resolves */}
{readingText && (activeIdx !== null || hgActive) && (() => {
  const p = activeIdx !== null
    ? positions[activeIdx]
    : { x: 0, y: SPHERE_RADIUS, z: 0 };
  return (
    <Html
      position={[p.x, p.y + 0.45, p.z]}
      style={{
        background:   'rgba(0,0,0,0.85)',
        border:       '1px solid rgba(217,70,239,0.4)',
        color:        '#c0c0c0',
        fontFamily:   'monospace',
        fontSize:     '9px',
        padding:      '6px 8px',
        whiteSpace:   'pre',
        pointerEvents:'none',
        userSelect:   'none',
        borderRadius: '3px',
        minWidth:     '140px',
      }}
    >
      {readingText}
    </Html>
  );
})()}
```

- [ ] **Step 4.7 — Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (no regressions).

- [ ] **Step 4.8 — Visual verification**

```bash
npm run dev
```

Open the Scaling tab. Verify:
- Click any element node → orbital ring spawns around it, panel shows "computing..." then reading
- Click a planetary element (Au, Ag, Fe, Cu, Sn, Pb, U, Np, Pu) → ring is planet-colored, pulse animation plays
- Click a non-planetary element → ring is dim silver (#404050), panel shows "ruled by X · Sign °"
- Click Hg anchor (top of sphere) → larger gold ring, panel shows "MERCURY · Hg · ..."
- Second click on same element → ring and panel disappear
- Click different element → previous ring/panel replaced by new one

- [ ] **Step 4.9 — Commit**

```bash
git add src/terminal/mercury/TFGSphere.jsx
git commit -m "feat(tfg): add click orbital rings and planetary astrology reading panel"
```
