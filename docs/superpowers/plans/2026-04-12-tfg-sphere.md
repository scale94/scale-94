# TFG Sphere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hollow Three.js sphere of all 118 periodic table elements as a new hero section at the top of ScalingTab, with TFG phase-affinity physics anchored to Mercury (Hg, #80), sitting above the untouched LatentCollider.

**Architecture:** Pure data module (`periodicElements.js`) computes phase affinity once at definition time using electron-shell proximity to Hg. `TFGSphere.jsx` renders 117 elements as a single `InstancedMesh` with a custom GLSL ShaderMaterial; Hg is a separate `<mesh>` at north pole with amber-gold glow. `TFGCanvas.jsx` wraps the scene in an isolated R3F `<Canvas>` that shares no context with the existing MercuryTab canvas.

**Tech Stack:** React, Three.js, @react-three/fiber, @react-three/drei, Vitest/jsdom for data tests

---

## File Map

| File | Action |
|---|---|
| `src/terminal/data/periodicElements.js` | **Create** — 118 elements array, phaseAffinity pre-computed |
| `tests/mercury/periodicElements.test.js` | **Create** — data layer tests |
| `src/terminal/mercury/TFGSphere.jsx` | **Create** — InstancedMesh + GLSL + Hg node + Html labels |
| `src/terminal/mercury/TFGCanvas.jsx` | **Create** — isolated R3F Canvas wrapper |
| `src/terminal/views/ScalingTab.jsx` | **Modify** — import TFGCanvas, insert above LatentCollider |

---

## Task 1: periodicElements.js — data + phase affinity

**Files:**
- Create: `src/terminal/data/periodicElements.js`
- Create: `tests/mercury/periodicElements.test.js`

---

- [ ] **Step 1.1 — Write failing tests**

Create `tests/mercury/periodicElements.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ELEMENTS } from '../../src/terminal/data/periodicElements';

describe('ELEMENTS array', () => {
  it('has exactly 118 entries', () => {
    expect(ELEMENTS).toHaveLength(118);
  });

  it('each element has required fields of correct type', () => {
    for (const el of ELEMENTS) {
      expect(typeof el.symbol).toBe('string');
      expect(typeof el.name).toBe('string');
      expect(typeof el.atomicNumber).toBe('number');
      expect(typeof el.period).toBe('number');
      expect(typeof el.block).toBe('string');
      expect(typeof el.phaseAffinity).toBe('number');
      expect(el.phaseAffinity).toBeGreaterThanOrEqual(0);
      expect(el.phaseAffinity).toBeLessThanOrEqual(1);
    }
  });

  it('atomic numbers run 1–118 with no gaps', () => {
    const nums = ELEMENTS.map(e => e.atomicNumber).sort((a, b) => a - b);
    for (let i = 0; i < 118; i++) expect(nums[i]).toBe(i + 1);
  });
});

describe('phaseAffinity — anchor', () => {
  it('Hg (#80) is exactly 1.00', () => {
    const hg = ELEMENTS.find(e => e.atomicNumber === 80);
    expect(hg.phaseAffinity).toBe(1.00);
  });
});

describe('phaseAffinity — group 12 (0.90)', () => {
  it('Zn (#30) is 0.90', () => {
    expect(ELEMENTS[29].phaseAffinity).toBe(0.90);
  });
  it('Cd (#48) is 0.90', () => {
    expect(ELEMENTS[47].phaseAffinity).toBe(0.90);
  });
  it('Cn (#112) is 0.90', () => {
    expect(ELEMENTS[111].phaseAffinity).toBe(0.90);
  });
});

describe('phaseAffinity — period 6 (0.85)', () => {
  it('Cs (#55) is 0.85', () => {
    expect(ELEMENTS[54].phaseAffinity).toBe(0.85);
  });
  it('Au (#79) is 0.85', () => {
    expect(ELEMENTS[78].phaseAffinity).toBe(0.85);
  });
  it('Rn (#86) is 0.85', () => {
    expect(ELEMENTS[85].phaseAffinity).toBe(0.85);
  });
  it('all 31 non-Hg period-6 elements are 0.85', () => {
    const p6 = ELEMENTS.filter(e => e.period === 6 && e.atomicNumber !== 80);
    expect(p6).toHaveLength(31);
    for (const el of p6) expect(el.phaseAffinity).toBe(0.85);
  });
});

describe('phaseAffinity — d-block (0.55)', () => {
  it('Fe (#26) is 0.55', () => {
    expect(ELEMENTS[25].phaseAffinity).toBe(0.55);
  });
  it('Ag (#47) is 0.55', () => {
    expect(ELEMENTS[46].phaseAffinity).toBe(0.55);
  });
  it('Rf (#104) is 0.55', () => {
    expect(ELEMENTS[103].phaseAffinity).toBe(0.55);
  });
});

describe('phaseAffinity — period 5 non-d (0.40)', () => {
  it('Rb (#37) is 0.40', () => {
    expect(ELEMENTS[36].phaseAffinity).toBe(0.40);
  });
  it('Xe (#54) is 0.40', () => {
    expect(ELEMENTS[53].phaseAffinity).toBe(0.40);
  });
});

describe('phaseAffinity — dissipating (0.15)', () => {
  it('H (#1) is 0.15', () => {
    expect(ELEMENTS[0].phaseAffinity).toBe(0.15);
  });
  it('K (#19) is 0.15', () => {
    expect(ELEMENTS[18].phaseAffinity).toBe(0.15);
  });
  it('U (#92) is 0.15', () => {
    expect(ELEMENTS[91].phaseAffinity).toBe(0.15);
  });
});

describe('phaseAffinity — tier counts', () => {
  it('locked tier (≥0.70) has 35 elements', () => {
    expect(ELEMENTS.filter(e => e.phaseAffinity >= 0.70)).toHaveLength(35);
  });
  it('weak tier (0.40–0.69) has 36 elements', () => {
    expect(ELEMENTS.filter(e => e.phaseAffinity >= 0.40 && e.phaseAffinity < 0.70)).toHaveLength(36);
  });
  it('dissipating tier (<0.40) has 47 elements', () => {
    expect(ELEMENTS.filter(e => e.phaseAffinity < 0.40)).toHaveLength(47);
  });
});
```

- [ ] **Step 1.2 — Run tests to confirm they fail**

```bash
npx vitest run tests/mercury/periodicElements.test.js
```

Expected: All tests fail with `Cannot find module '../../src/terminal/data/periodicElements'`

- [ ] **Step 1.3 — Implement periodicElements.js**

Create `src/terminal/data/periodicElements.js`:

```js
// Periodic table elements with pre-computed phaseAffinity relative to Hg (#80).
// Phase affinity algorithm (priority order, first match wins):
//   atomicNumber === 80 → 1.00  (Hg anchor)
//   group === 12        → 0.90  (Zn, Cd, Cn — same column)
//   period === 6        → 0.85  (Cs–Rn — same row)
//   block === 'd'       → 0.55  (d-block transition metals)
//   period === 5        → 0.40  (adjacent row, non-d)
//   else                → 0.15  (dissipating)

function pa(atomicNumber, period, group, block) {
  if (atomicNumber === 80) return 1.00;
  if (group === 12)        return 0.90;
  if (period === 6)        return 0.85;
  if (block === 'd')       return 0.55;
  if (period === 5)        return 0.40;
  return 0.15;
}

// prettier-ignore
export const ELEMENTS = [
  { symbol:'H',   name:'Hydrogen',       atomicNumber:1,   period:1, group:1,    block:'s', phaseAffinity: pa(1,  1, 1,    's') },
  { symbol:'He',  name:'Helium',         atomicNumber:2,   period:1, group:18,   block:'s', phaseAffinity: pa(2,  1, 18,   's') },
  { symbol:'Li',  name:'Lithium',        atomicNumber:3,   period:2, group:1,    block:'s', phaseAffinity: pa(3,  2, 1,    's') },
  { symbol:'Be',  name:'Beryllium',      atomicNumber:4,   period:2, group:2,    block:'s', phaseAffinity: pa(4,  2, 2,    's') },
  { symbol:'B',   name:'Boron',          atomicNumber:5,   period:2, group:13,   block:'p', phaseAffinity: pa(5,  2, 13,   'p') },
  { symbol:'C',   name:'Carbon',         atomicNumber:6,   period:2, group:14,   block:'p', phaseAffinity: pa(6,  2, 14,   'p') },
  { symbol:'N',   name:'Nitrogen',       atomicNumber:7,   period:2, group:15,   block:'p', phaseAffinity: pa(7,  2, 15,   'p') },
  { symbol:'O',   name:'Oxygen',         atomicNumber:8,   period:2, group:16,   block:'p', phaseAffinity: pa(8,  2, 16,   'p') },
  { symbol:'F',   name:'Fluorine',       atomicNumber:9,   period:2, group:17,   block:'p', phaseAffinity: pa(9,  2, 17,   'p') },
  { symbol:'Ne',  name:'Neon',           atomicNumber:10,  period:2, group:18,   block:'p', phaseAffinity: pa(10, 2, 18,   'p') },
  { symbol:'Na',  name:'Sodium',         atomicNumber:11,  period:3, group:1,    block:'s', phaseAffinity: pa(11, 3, 1,    's') },
  { symbol:'Mg',  name:'Magnesium',      atomicNumber:12,  period:3, group:2,    block:'s', phaseAffinity: pa(12, 3, 2,    's') },
  { symbol:'Al',  name:'Aluminium',      atomicNumber:13,  period:3, group:13,   block:'p', phaseAffinity: pa(13, 3, 13,   'p') },
  { symbol:'Si',  name:'Silicon',        atomicNumber:14,  period:3, group:14,   block:'p', phaseAffinity: pa(14, 3, 14,   'p') },
  { symbol:'P',   name:'Phosphorus',     atomicNumber:15,  period:3, group:15,   block:'p', phaseAffinity: pa(15, 3, 15,   'p') },
  { symbol:'S',   name:'Sulfur',         atomicNumber:16,  period:3, group:16,   block:'p', phaseAffinity: pa(16, 3, 16,   'p') },
  { symbol:'Cl',  name:'Chlorine',       atomicNumber:17,  period:3, group:17,   block:'p', phaseAffinity: pa(17, 3, 17,   'p') },
  { symbol:'Ar',  name:'Argon',          atomicNumber:18,  period:3, group:18,   block:'p', phaseAffinity: pa(18, 3, 18,   'p') },
  { symbol:'K',   name:'Potassium',      atomicNumber:19,  period:4, group:1,    block:'s', phaseAffinity: pa(19, 4, 1,    's') },
  { symbol:'Ca',  name:'Calcium',        atomicNumber:20,  period:4, group:2,    block:'s', phaseAffinity: pa(20, 4, 2,    's') },
  { symbol:'Sc',  name:'Scandium',       atomicNumber:21,  period:4, group:3,    block:'d', phaseAffinity: pa(21, 4, 3,    'd') },
  { symbol:'Ti',  name:'Titanium',       atomicNumber:22,  period:4, group:4,    block:'d', phaseAffinity: pa(22, 4, 4,    'd') },
  { symbol:'V',   name:'Vanadium',       atomicNumber:23,  period:4, group:5,    block:'d', phaseAffinity: pa(23, 4, 5,    'd') },
  { symbol:'Cr',  name:'Chromium',       atomicNumber:24,  period:4, group:6,    block:'d', phaseAffinity: pa(24, 4, 6,    'd') },
  { symbol:'Mn',  name:'Manganese',      atomicNumber:25,  period:4, group:7,    block:'d', phaseAffinity: pa(25, 4, 7,    'd') },
  { symbol:'Fe',  name:'Iron',           atomicNumber:26,  period:4, group:8,    block:'d', phaseAffinity: pa(26, 4, 8,    'd') },
  { symbol:'Co',  name:'Cobalt',         atomicNumber:27,  period:4, group:9,    block:'d', phaseAffinity: pa(27, 4, 9,    'd') },
  { symbol:'Ni',  name:'Nickel',         atomicNumber:28,  period:4, group:10,   block:'d', phaseAffinity: pa(28, 4, 10,   'd') },
  { symbol:'Cu',  name:'Copper',         atomicNumber:29,  period:4, group:11,   block:'d', phaseAffinity: pa(29, 4, 11,   'd') },
  { symbol:'Zn',  name:'Zinc',           atomicNumber:30,  period:4, group:12,   block:'d', phaseAffinity: pa(30, 4, 12,   'd') },
  { symbol:'Ga',  name:'Gallium',        atomicNumber:31,  period:4, group:13,   block:'p', phaseAffinity: pa(31, 4, 13,   'p') },
  { symbol:'Ge',  name:'Germanium',      atomicNumber:32,  period:4, group:14,   block:'p', phaseAffinity: pa(32, 4, 14,   'p') },
  { symbol:'As',  name:'Arsenic',        atomicNumber:33,  period:4, group:15,   block:'p', phaseAffinity: pa(33, 4, 15,   'p') },
  { symbol:'Se',  name:'Selenium',       atomicNumber:34,  period:4, group:16,   block:'p', phaseAffinity: pa(34, 4, 16,   'p') },
  { symbol:'Br',  name:'Bromine',        atomicNumber:35,  period:4, group:17,   block:'p', phaseAffinity: pa(35, 4, 17,   'p') },
  { symbol:'Kr',  name:'Krypton',        atomicNumber:36,  period:4, group:18,   block:'p', phaseAffinity: pa(36, 4, 18,   'p') },
  { symbol:'Rb',  name:'Rubidium',       atomicNumber:37,  period:5, group:1,    block:'s', phaseAffinity: pa(37, 5, 1,    's') },
  { symbol:'Sr',  name:'Strontium',      atomicNumber:38,  period:5, group:2,    block:'s', phaseAffinity: pa(38, 5, 2,    's') },
  { symbol:'Y',   name:'Yttrium',        atomicNumber:39,  period:5, group:3,    block:'d', phaseAffinity: pa(39, 5, 3,    'd') },
  { symbol:'Zr',  name:'Zirconium',      atomicNumber:40,  period:5, group:4,    block:'d', phaseAffinity: pa(40, 5, 4,    'd') },
  { symbol:'Nb',  name:'Niobium',        atomicNumber:41,  period:5, group:5,    block:'d', phaseAffinity: pa(41, 5, 5,    'd') },
  { symbol:'Mo',  name:'Molybdenum',     atomicNumber:42,  period:5, group:6,    block:'d', phaseAffinity: pa(42, 5, 6,    'd') },
  { symbol:'Tc',  name:'Technetium',     atomicNumber:43,  period:5, group:7,    block:'d', phaseAffinity: pa(43, 5, 7,    'd') },
  { symbol:'Ru',  name:'Ruthenium',      atomicNumber:44,  period:5, group:8,    block:'d', phaseAffinity: pa(44, 5, 8,    'd') },
  { symbol:'Rh',  name:'Rhodium',        atomicNumber:45,  period:5, group:9,    block:'d', phaseAffinity: pa(45, 5, 9,    'd') },
  { symbol:'Pd',  name:'Palladium',      atomicNumber:46,  period:5, group:10,   block:'d', phaseAffinity: pa(46, 5, 10,   'd') },
  { symbol:'Ag',  name:'Silver',         atomicNumber:47,  period:5, group:11,   block:'d', phaseAffinity: pa(47, 5, 11,   'd') },
  { symbol:'Cd',  name:'Cadmium',        atomicNumber:48,  period:5, group:12,   block:'d', phaseAffinity: pa(48, 5, 12,   'd') },
  { symbol:'In',  name:'Indium',         atomicNumber:49,  period:5, group:13,   block:'p', phaseAffinity: pa(49, 5, 13,   'p') },
  { symbol:'Sn',  name:'Tin',            atomicNumber:50,  period:5, group:14,   block:'p', phaseAffinity: pa(50, 5, 14,   'p') },
  { symbol:'Sb',  name:'Antimony',       atomicNumber:51,  period:5, group:15,   block:'p', phaseAffinity: pa(51, 5, 15,   'p') },
  { symbol:'Te',  name:'Tellurium',      atomicNumber:52,  period:5, group:16,   block:'p', phaseAffinity: pa(52, 5, 16,   'p') },
  { symbol:'I',   name:'Iodine',         atomicNumber:53,  period:5, group:17,   block:'p', phaseAffinity: pa(53, 5, 17,   'p') },
  { symbol:'Xe',  name:'Xenon',          atomicNumber:54,  period:5, group:18,   block:'p', phaseAffinity: pa(54, 5, 18,   'p') },
  { symbol:'Cs',  name:'Caesium',        atomicNumber:55,  period:6, group:1,    block:'s', phaseAffinity: pa(55, 6, 1,    's') },
  { symbol:'Ba',  name:'Barium',         atomicNumber:56,  period:6, group:2,    block:'s', phaseAffinity: pa(56, 6, 2,    's') },
  { symbol:'La',  name:'Lanthanum',      atomicNumber:57,  period:6, group:3,    block:'d', phaseAffinity: pa(57, 6, 3,    'd') },
  { symbol:'Ce',  name:'Cerium',         atomicNumber:58,  period:6, group:null, block:'f', phaseAffinity: pa(58, 6, null, 'f') },
  { symbol:'Pr',  name:'Praseodymium',   atomicNumber:59,  period:6, group:null, block:'f', phaseAffinity: pa(59, 6, null, 'f') },
  { symbol:'Nd',  name:'Neodymium',      atomicNumber:60,  period:6, group:null, block:'f', phaseAffinity: pa(60, 6, null, 'f') },
  { symbol:'Pm',  name:'Promethium',     atomicNumber:61,  period:6, group:null, block:'f', phaseAffinity: pa(61, 6, null, 'f') },
  { symbol:'Sm',  name:'Samarium',       atomicNumber:62,  period:6, group:null, block:'f', phaseAffinity: pa(62, 6, null, 'f') },
  { symbol:'Eu',  name:'Europium',       atomicNumber:63,  period:6, group:null, block:'f', phaseAffinity: pa(63, 6, null, 'f') },
  { symbol:'Gd',  name:'Gadolinium',     atomicNumber:64,  period:6, group:null, block:'f', phaseAffinity: pa(64, 6, null, 'f') },
  { symbol:'Tb',  name:'Terbium',        atomicNumber:65,  period:6, group:null, block:'f', phaseAffinity: pa(65, 6, null, 'f') },
  { symbol:'Dy',  name:'Dysprosium',     atomicNumber:66,  period:6, group:null, block:'f', phaseAffinity: pa(66, 6, null, 'f') },
  { symbol:'Ho',  name:'Holmium',        atomicNumber:67,  period:6, group:null, block:'f', phaseAffinity: pa(67, 6, null, 'f') },
  { symbol:'Er',  name:'Erbium',         atomicNumber:68,  period:6, group:null, block:'f', phaseAffinity: pa(68, 6, null, 'f') },
  { symbol:'Tm',  name:'Thulium',        atomicNumber:69,  period:6, group:null, block:'f', phaseAffinity: pa(69, 6, null, 'f') },
  { symbol:'Yb',  name:'Ytterbium',      atomicNumber:70,  period:6, group:null, block:'f', phaseAffinity: pa(70, 6, null, 'f') },
  { symbol:'Lu',  name:'Lutetium',       atomicNumber:71,  period:6, group:3,    block:'d', phaseAffinity: pa(71, 6, 3,    'd') },
  { symbol:'Hf',  name:'Hafnium',        atomicNumber:72,  period:6, group:4,    block:'d', phaseAffinity: pa(72, 6, 4,    'd') },
  { symbol:'Ta',  name:'Tantalum',       atomicNumber:73,  period:6, group:5,    block:'d', phaseAffinity: pa(73, 6, 5,    'd') },
  { symbol:'W',   name:'Tungsten',       atomicNumber:74,  period:6, group:6,    block:'d', phaseAffinity: pa(74, 6, 6,    'd') },
  { symbol:'Re',  name:'Rhenium',        atomicNumber:75,  period:6, group:7,    block:'d', phaseAffinity: pa(75, 6, 7,    'd') },
  { symbol:'Os',  name:'Osmium',         atomicNumber:76,  period:6, group:8,    block:'d', phaseAffinity: pa(76, 6, 8,    'd') },
  { symbol:'Ir',  name:'Iridium',        atomicNumber:77,  period:6, group:9,    block:'d', phaseAffinity: pa(77, 6, 9,    'd') },
  { symbol:'Pt',  name:'Platinum',       atomicNumber:78,  period:6, group:10,   block:'d', phaseAffinity: pa(78, 6, 10,   'd') },
  { symbol:'Au',  name:'Gold',           atomicNumber:79,  period:6, group:11,   block:'d', phaseAffinity: pa(79, 6, 11,   'd') },
  { symbol:'Hg',  name:'Mercury',        atomicNumber:80,  period:6, group:12,   block:'d', phaseAffinity: pa(80, 6, 12,   'd') },
  { symbol:'Tl',  name:'Thallium',       atomicNumber:81,  period:6, group:13,   block:'p', phaseAffinity: pa(81, 6, 13,   'p') },
  { symbol:'Pb',  name:'Lead',           atomicNumber:82,  period:6, group:14,   block:'p', phaseAffinity: pa(82, 6, 14,   'p') },
  { symbol:'Bi',  name:'Bismuth',        atomicNumber:83,  period:6, group:15,   block:'p', phaseAffinity: pa(83, 6, 15,   'p') },
  { symbol:'Po',  name:'Polonium',       atomicNumber:84,  period:6, group:16,   block:'p', phaseAffinity: pa(84, 6, 16,   'p') },
  { symbol:'At',  name:'Astatine',       atomicNumber:85,  period:6, group:17,   block:'p', phaseAffinity: pa(85, 6, 17,   'p') },
  { symbol:'Rn',  name:'Radon',          atomicNumber:86,  period:6, group:18,   block:'p', phaseAffinity: pa(86, 6, 18,   'p') },
  { symbol:'Fr',  name:'Francium',       atomicNumber:87,  period:7, group:1,    block:'s', phaseAffinity: pa(87, 7, 1,    's') },
  { symbol:'Ra',  name:'Radium',         atomicNumber:88,  period:7, group:2,    block:'s', phaseAffinity: pa(88, 7, 2,    's') },
  { symbol:'Ac',  name:'Actinium',       atomicNumber:89,  period:7, group:3,    block:'d', phaseAffinity: pa(89, 7, 3,    'd') },
  { symbol:'Th',  name:'Thorium',        atomicNumber:90,  period:7, group:null, block:'f', phaseAffinity: pa(90, 7, null, 'f') },
  { symbol:'Pa',  name:'Protactinium',   atomicNumber:91,  period:7, group:null, block:'f', phaseAffinity: pa(91, 7, null, 'f') },
  { symbol:'U',   name:'Uranium',        atomicNumber:92,  period:7, group:null, block:'f', phaseAffinity: pa(92, 7, null, 'f') },
  { symbol:'Np',  name:'Neptunium',      atomicNumber:93,  period:7, group:null, block:'f', phaseAffinity: pa(93, 7, null, 'f') },
  { symbol:'Pu',  name:'Plutonium',      atomicNumber:94,  period:7, group:null, block:'f', phaseAffinity: pa(94, 7, null, 'f') },
  { symbol:'Am',  name:'Americium',      atomicNumber:95,  period:7, group:null, block:'f', phaseAffinity: pa(95, 7, null, 'f') },
  { symbol:'Cm',  name:'Curium',         atomicNumber:96,  period:7, group:null, block:'f', phaseAffinity: pa(96, 7, null, 'f') },
  { symbol:'Bk',  name:'Berkelium',      atomicNumber:97,  period:7, group:null, block:'f', phaseAffinity: pa(97, 7, null, 'f') },
  { symbol:'Cf',  name:'Californium',    atomicNumber:98,  period:7, group:null, block:'f', phaseAffinity: pa(98, 7, null, 'f') },
  { symbol:'Es',  name:'Einsteinium',    atomicNumber:99,  period:7, group:null, block:'f', phaseAffinity: pa(99, 7, null, 'f') },
  { symbol:'Fm',  name:'Fermium',        atomicNumber:100, period:7, group:null, block:'f', phaseAffinity: pa(100,7, null, 'f') },
  { symbol:'Md',  name:'Mendelevium',    atomicNumber:101, period:7, group:null, block:'f', phaseAffinity: pa(101,7, null, 'f') },
  { symbol:'No',  name:'Nobelium',       atomicNumber:102, period:7, group:null, block:'f', phaseAffinity: pa(102,7, null, 'f') },
  { symbol:'Lr',  name:'Lawrencium',     atomicNumber:103, period:7, group:3,    block:'d', phaseAffinity: pa(103,7, 3,    'd') },
  { symbol:'Rf',  name:'Rutherfordium',  atomicNumber:104, period:7, group:4,    block:'d', phaseAffinity: pa(104,7, 4,    'd') },
  { symbol:'Db',  name:'Dubnium',        atomicNumber:105, period:7, group:5,    block:'d', phaseAffinity: pa(105,7, 5,    'd') },
  { symbol:'Sg',  name:'Seaborgium',     atomicNumber:106, period:7, group:6,    block:'d', phaseAffinity: pa(106,7, 6,    'd') },
  { symbol:'Bh',  name:'Bohrium',        atomicNumber:107, period:7, group:7,    block:'d', phaseAffinity: pa(107,7, 7,    'd') },
  { symbol:'Hs',  name:'Hassium',        atomicNumber:108, period:7, group:8,    block:'d', phaseAffinity: pa(108,7, 8,    'd') },
  { symbol:'Mt',  name:'Meitnerium',     atomicNumber:109, period:7, group:9,    block:'d', phaseAffinity: pa(109,7, 9,    'd') },
  { symbol:'Ds',  name:'Darmstadtium',   atomicNumber:110, period:7, group:10,   block:'d', phaseAffinity: pa(110,7, 10,   'd') },
  { symbol:'Rg',  name:'Roentgenium',    atomicNumber:111, period:7, group:11,   block:'d', phaseAffinity: pa(111,7, 11,   'd') },
  { symbol:'Cn',  name:'Copernicium',    atomicNumber:112, period:7, group:12,   block:'d', phaseAffinity: pa(112,7, 12,   'd') },
  { symbol:'Nh',  name:'Nihonium',       atomicNumber:113, period:7, group:13,   block:'p', phaseAffinity: pa(113,7, 13,   'p') },
  { symbol:'Fl',  name:'Flerovium',      atomicNumber:114, period:7, group:14,   block:'p', phaseAffinity: pa(114,7, 14,   'p') },
  { symbol:'Mc',  name:'Moscovium',      atomicNumber:115, period:7, group:15,   block:'p', phaseAffinity: pa(115,7, 15,   'p') },
  { symbol:'Lv',  name:'Livermorium',    atomicNumber:116, period:7, group:16,   block:'p', phaseAffinity: pa(116,7, 16,   'p') },
  { symbol:'Ts',  name:'Tennessine',     atomicNumber:117, period:7, group:17,   block:'p', phaseAffinity: pa(117,7, 17,   'p') },
  { symbol:'Og',  name:'Oganesson',      atomicNumber:118, period:7, group:18,   block:'p', phaseAffinity: pa(118,7, 18,   'p') },
];
```

- [ ] **Step 1.4 — Run tests to confirm they pass**

```bash
npx vitest run tests/mercury/periodicElements.test.js
```

Expected: All 18 tests pass.

- [ ] **Step 1.5 — Commit**

```bash
git add src/terminal/data/periodicElements.js tests/mercury/periodicElements.test.js
git commit -m "feat(tfg): add periodicElements data module with phase affinity"
```

---

## Task 2: TFGSphere.jsx — Three.js scene

**Files:**
- Create: `src/terminal/mercury/TFGSphere.jsx`

No unit tests — Three.js rendering requires a live WebGL context. Verify visually in browser (Step 4).

---

- [ ] **Step 2.1 — Create TFGSphere.jsx**

Create `src/terminal/mercury/TFGSphere.jsx`:

```jsx
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ELEMENTS } from '../data/periodicElements';

const SPHERE_RADIUS = 2.8;
const BASE_SIZE     = 0.055;  // sphere geometry radius for each element node

// Fibonacci sphere: distributes n points uniformly on a sphere of given radius.
function fibonacciSphere(n, radius) {
  const phi    = Math.PI * (3 - Math.sqrt(5)); // golden angle ≈ 2.399 rad
  const points = [];
  for (let i = 0; i < n; i++) {
    const y     = 1 - (i / (n - 1)) * 2;
    const r     = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    points.push(new THREE.Vector3(
      Math.cos(theta) * r * radius,
      y * radius,
      Math.sin(theta) * r * radius,
    ));
  }
  return points;
}

const vertexShader = /* glsl */`
  attribute float phaseAlignment;
  attribute float instanceIndex;
  uniform   float uTime;
  varying   float vPhase;
  varying   float vIdx;

  void main() {
    vPhase = phaseAlignment;
    vIdx   = instanceIndex;

    float s;
    if (vPhase >= 0.70) {
      s = 1.0 + 0.2 * sin(uTime * 5.0 + vIdx * 0.7);
    } else if (vPhase >= 0.40) {
      s = 1.0;
    } else {
      s = 0.8;
    }
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * s, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform float uTime;
  varying float vPhase;
  varying float vIdx;

  void main() {
    vec3 colLocked    = vec3(0.88, 0.88, 0.90);
    vec3 colWeak      = vec3(0.25, 0.28, 0.32);
    vec3 colDissipate = vec3(0.04, 0.06, 0.08);

    vec3  col;
    float alpha;

    if (vPhase >= 0.70) {
      float pulse = 0.88 + 0.12 * sin(uTime * 5.0 + vIdx * 0.7);
      col   = colLocked * pulse;
      alpha = 1.0;
    } else if (vPhase >= 0.40) {
      col   = colWeak;
      alpha = 0.85;
    } else {
      col   = colDissipate;
      alpha = 0.30;
    }
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function TFGSphere() {
  const groupRef    = useRef();
  const meshRef     = useRef();
  const hgLightRef  = useRef();
  const matRef      = useRef();
  const driftRef    = useRef(null); // Float32Array of per-element drift offsets

  // Hg is handled separately; build non-Hg list and sphere positions once.
  const { nonHgElements, positions, phaseAlignments } = useMemo(() => {
    const els  = ELEMENTS.filter(e => e.atomicNumber !== 80);
    const pts  = fibonacciSphere(els.length, SPHERE_RADIUS);
    const pa   = new Float32Array(els.map(e => e.phaseAffinity));
    return { nonHgElements: els, positions: pts, phaseAlignments: pa };
  }, []);

  // Hg north-pole position (top of sphere).
  const hgPos = useMemo(() => new THREE.Vector3(0, SPHERE_RADIUS, 0), []);

  // Geometry + ShaderMaterial — created once, stable references.
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(BASE_SIZE, 8, 8);
    g.setAttribute('phaseAlignment', new THREE.InstancedBufferAttribute(phaseAlignments, 1));
    const idxArr = new Float32Array(nonHgElements.length);
    for (let i = 0; i < nonHgElements.length; i++) idxArr[i] = i;
    g.setAttribute('instanceIndex', new THREE.InstancedBufferAttribute(idxArr, 1));
    return g;
  }, [nonHgElements, phaseAlignments]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
  }), []);

  // Keep matRef in sync so useFrame can write uTime without re-closure.
  matRef.current = mat;

  // Dummy Object3D for matrix computation.
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialise instance matrices and drift state after mesh mounts.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < nonHgElements.length; i++) {
      dummy.position.copy(positions[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    driftRef.current = new Float32Array(nonHgElements.length); // all zeros
  }, [nonHgElements, positions, dummy]);

  useFrame((state) => {
    const t    = state.clock.elapsedTime;
    const mesh = meshRef.current;
    const drift = driftRef.current;

    // Shader time
    if (matRef.current) matRef.current.uniforms.uTime.value = t;

    // Slow Y-axis rotation of whole group
    if (groupRef.current) groupRef.current.rotation.y = t * 0.04;

    // Hg light breath
    if (hgLightRef.current) {
      hgLightRef.current.intensity = 0.8 + 0.4 * Math.sin(t * 2.1);
    }

    // Dissipating nodes: micro outward drift, reset at +0.15 units
    if (mesh && drift) {
      let dirty = false;
      for (let i = 0; i < nonHgElements.length; i++) {
        if (nonHgElements[i].phaseAffinity >= 0.40) continue;
        drift[i] = (drift[i] + 0.002) % 0.15;
        const scale = 1 + drift[i] / SPHERE_RADIUS;
        dummy.position.copy(positions[i]).multiplyScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        dirty = true;
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 117 non-Hg elements — single draw call */}
      <instancedMesh ref={meshRef} args={[geo, mat, nonHgElements.length]} />

      {/* Hg anchor node — north pole, amber-gold */}
      <mesh position={hgPos}>
        <sphereGeometry args={[BASE_SIZE * 3, 16, 16]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.8}
          metalness={0.9}
          roughness={0.1}
        />
        <pointLight ref={hgLightRef} color="#f59e0b" intensity={0.8} distance={4} />
        <Html
          position={[0.3, 0, 0]}
          style={{
            color: '#f59e0b',
            fontFamily: 'monospace',
            fontSize: '9px',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          Hg · 80
        </Html>
      </mesh>

      {/* Labels for locked tier only (≥0.70, ~34 non-Hg elements) */}
      {nonHgElements.map((el, i) => {
        if (el.phaseAffinity < 0.70) return null;
        const p = positions[i];
        return (
          <Html
            key={el.atomicNumber}
            position={[p.x, p.y, p.z]}
            style={{
              color: '#c0c0c0',
              fontFamily: 'monospace',
              fontSize: '9px',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {el.symbol} · {el.atomicNumber}
          </Html>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 2.2 — Commit**

```bash
git add src/terminal/mercury/TFGSphere.jsx
git commit -m "feat(tfg): add TFGSphere — InstancedMesh + GLSL + Hg anchor"
```

---

## Task 3: TFGCanvas.jsx — R3F Canvas wrapper

**Files:**
- Create: `src/terminal/mercury/TFGCanvas.jsx`

---

- [ ] **Step 3.1 — Create TFGCanvas.jsx**

Create `src/terminal/mercury/TFGCanvas.jsx`:

```jsx
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import TFGSphere from './TFGSphere';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export default function TFGCanvas() {
  return (
    <div style={{ height: isMobile ? 360 : 500, width: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: '#04040a' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.15} color="#0a0a14" />
          <TFGSphere />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={4}
            maxDistance={12}
            enablePan={false}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 3.2 — Commit**

```bash
git add src/terminal/mercury/TFGCanvas.jsx
git commit -m "feat(tfg): add TFGCanvas — isolated R3F Canvas wrapper"
```

---

## Task 4: ScalingTab.jsx integration

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx`

---

- [ ] **Step 4.1 — Add TFGCanvas import to ScalingTab.jsx**

In `src/terminal/views/ScalingTab.jsx`, add the import after the existing imports:

```jsx
import TFGCanvas from '../mercury/TFGCanvas';
```

The existing import block starts at line 1:
```jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap, FileText, Cpu } from 'lucide-react';
import LatentCollider from './LatentCollider';
import TFGCanvas from '../mercury/TFGCanvas';   // ← add this line
```

- [ ] **Step 4.2 — Insert TFG section above LatentCollider**

In `src/terminal/views/ScalingTab.jsx`, find the LatentCollider render line (currently line 179):

```jsx
      {/* ── Latent Space Collider (hero section) ── */}
      <LatentCollider />
```

Replace it with:

```jsx
      {/* ── TFG Sphere (new hero) ── */}
      <div
        className="border-b border-fuchsia-900/40 pb-8 mb-8"
        style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s forwards' }}
      >
        <div className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span style={{ color: 'rgba(192,192,192,0.5)', fontSize: 14 }}>◉</span>
          THALAMIC FLAT-BAND GATING · HG #80 · PHASE-SELECTIVE REALITY FILTER
        </div>
        <TFGCanvas />
      </div>

      {/* ── Latent Space Collider (hero section) ── */}
      <LatentCollider />
```

- [ ] **Step 4.3 — Run dev server and verify visually**

```bash
npm run dev
```

Open the app, navigate to the Scaling tab. Verify:
- TFG sphere appears above LatentCollider
- Sphere rotates slowly
- Amber-gold Hg node visible at top with "Hg · 80" label
- Silver-white locked elements (period 6 row, group 12 column) pulse
- Dark dissipating elements slightly drift outward
- OrbitControls: drag to rotate, scroll to zoom
- LatentCollider collision + particle burst below — unchanged

- [ ] **Step 4.4 — Run full test suite**

```bash
npx vitest run
```

Expected: All existing tests pass + 18 new periodicElements tests pass.

- [ ] **Step 4.5 — Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "feat(tfg): integrate TFG sphere into ScalingTab above LatentCollider"
```
