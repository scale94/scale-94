# /LEDGER river catalog and catchment snapping

Date: 2026-09-30. Follows `2026-09-29-ledger-ocean-advection-design.md`. Status: draft for review.

## 1. Problem

Two separate defects, verified by running the real code (`snapToOcean` on the 512×256 grid, lagoon filter on):

1. **The ambient ocean has 9 river mouths.** Africa, the Arctic shelf, the north Atlantic and most of South America have no plume.
2. **A verdict site snaps to the nearest ocean cell (Euclidean, ≤ 64 cells), not to a river.** It ignores catchments.
   - Manaus (−60.02, −3.12) → (−56.6, 6.0), the Guiana coast, 14 cells. It does not reach the Rio Doce.
   - Berlin (13.405, 52.52) → (13.71, 54.49), the Baltic. The Spree and Havel drain to the Elbe and the North Sea, so this is physically wrong.

The "Berlin in South America" observation was a test input (coordinates injected under a "berlin" label). Parsing and the form path are sound; no change there.

## 2. Non-goals and frozen surfaces

- `AUDIT_PRESETS`, `RIVERS` in `riverCourses.js`, and the Mercury preset are not edited. Their tests still pass unchanged.
- No shader, `streamFunction`, or advection change. A plume is emergent: a source is a discharge (m³/s) and a mouth concentration splatted onto ocean cells, and the existing pipeline advects it. There are no per-river plume vectors to define. Plume geometry is determined by the outfall cell, `SPLAT_SIGMA_CELLS` and the ocean flow.
- No real basin dataset (no HydroBASINS).

## 3. New files

| File | Purpose |
|---|---|
| `ledger/ocean/riverCatalog.js` | `CATALOG`: 13 ambient sources (12 rivers; the Nile is two mouths) |
| `ledger/ocean/catchments.js` | `CATCHMENTS`: hand-authored polygons, plus `catchmentOutfall(lon, lat)` |
| `__tests__/riverCatalog.test.js`, `__tests__/catchments.test.js` | data invariants and routing |

Edits: `sources.js` (`oceanSources`, `buildSource` call sites for verdict/ghost), `hudFormat.js` (tooltip for `kind: 'catalog'`, verdict snap distance).

## 4. Catalog entry schema

```js
CATALOG.amazon = {
  label: 'AMAZON',
  outfall: [lon, lat],          // course = [outfall]; buildSource snaps it (snapRadius 8)
  dischargeM3s: 209000,
  kernel: { temp, do, bod, dt, nitrate },   // mouth water quality
  sources: { outfall: '…', dischargeM3s: '…', kernel: 'UNVERIFIED — …' },
}
```

Built by a `catalogSourceSpec(entry)` with `kind: 'catalog'`, `id: 'catalog:<key>'`, `velocityMs: 1`, `depthM: 10`, `snapRadius: 8`. A one-point course gives a mouth-only source: `buildSource` draws a short straight line to the snapped cell, `prepareRiver` returns null (no travel time), so no river-stage particles. Only the plume is drawn.

`ambientSources` still returns exactly the 9 presets (a test pins it); the new `oceanSources` returns those 9 first, then the 13 catalog sources, and is what the world and the GPU parity probe use. Preset ids and cells are byte-identical.

### Data (discharge and outfalls as briefed; each carries a source note at implementation)

| Key | Outfall [lon, lat] | Q m³/s | Notes |
|---|---|---|---|
| amazon | [−50.0, 0.0] | 209000 | Macapá delta; dominant Atlantic plume |
| parana | [−57.0, −35.0] | 17200 | Río de la Plata estuary |
| elbe | [8.70, 53.86] | 870 | Cuxhaven |
| congo | [12.35, −6.07] | 41000 | Banana |
| nile_rosetta | [30.4, 31.4] | 1400 | half of 2800 |
| nile_damietta | [31.8, 31.5] | 1400 | half of 2800; the 50/50 split is UNVERIFIED |
| niger | [6.0, 4.3] | 5600 | Gulf of Guinea delta |
| st_lawrence | [−67.0, 49.3] | 16800 | Gulf of St. Lawrence |
| lena | [127.0, 72.0] | 16800 | Laptev Sea |
| yenisey | [82.5, 72.5] | 19600 | Kara Sea |
| mekong | [106.8, 10.2] | 16000 | South China Sea delta |
| yellow | [119.2, 37.7] | 2570 | Bohai Sea |
| indus | [67.5, 24.0] | 6600 | Arabian Sea |

Two briefed outfalls need care: the Lena (72°N, 127°E) and Yenisey (72.5°N, 82.5°E) are inside `LAT_LIMIT` 78, but the Kara/Laptev coastlines must produce ocean cells within 8 cells. The implementation test asserts every catalog outfall snaps within 8 cells into a basin ≥ `MIN_SNAP_BASIN_CELLS`. A failing entry is a data error to fix by nudging the outfall to the open-water side, not by raising `snapRadius`. The Nile mouths land in the Mediterranean (511 cells), well above the lagoon threshold.

### Kernel (UNVERIFIED by design)

The catalog rivers are ambient background, not audits, so no water-quality data is claimed. Every entry uses a near-pristine kernel scaled only by climate: `do` = 92 % of `doSat(temp)`, `bod` 2, `dt` 0, `nitrate` 3, and `temp` by latitude band (equatorial 27, temperate 14, boreal/Arctic 5). Marked `UNVERIFIED — background baseline, not a measurement`. The plumes are therefore driven by discharge volume, so the Amazon dominates through Q alone. The visual effect of the low-BOD, near-saturated water on the existing colour ramp is to be checked against a screenshot in the plan's verification task.

## 5. Catchment snapping

`catchments.js` exports `CATCHMENTS`: an array of `{ key, outfalls: ['elbe'], ring: [[lon,lat],…], sources: { ring: 'UNVERIFIED — … ' } }`, and:

```js
catchmentTarget(lon, lat) -> { key, outfall: [lon, lat] } | null
```

- Point-in-polygon by ray casting in lon/lat (no polygon crosses the antimeridian; asserted).
- Rings are coarse (up to ~45 vertices), authored to follow major drainage divides, and ordered so the more specific basin comes first. An exact overlap test fails on any proper edge crossing between two rings or any vertex strictly inside another ring (shared vertices and shared edges are allowed).
- The Nile ring lists both delta outfalls; the target is the nearer by planar, cos(lat)-scaled lon/lat distance (not great-circle). Archived verdicts whose coordinates fall inside a ring are re-routed to that river's outfall the next time the ocean loads, so their drawn course and travel time change.

Verdict and ghost sources (`verdictSourceSpec`, `ghostSourceSpec`): if `catchmentTarget` hits, the source's snap target becomes that river's snapped outfall cell, so the drawn course is the straight line site → outfall (the existing verdict course shape). On a miss, or if the outfall cell fails to snap, behaviour is exactly today's `snapToOcean(site, 64, lagoon filter)`. The 64-cell radius applies only to the fallback. The target is carried as `snapAt` on the spec; `buildSource` snaps to it at radius 8 (`CATCHMENT_SNAP_RADIUS_CELLS`) and otherwise snaps the course end as before.

Inland sites therefore drain to their own river's outfall regardless of distance. The HUD `SNAP n km TO OCEAN` reading can now be thousands of km (Manaus → Macapá is about 1,300 km). The wording stays true, and `hudFormat` needs no format change.

### Scope decision for review

Included: rings for the Rhine, Danube, Mississippi, Yangtze and Ganges–Brahmaputra, routed to the existing preset outfalls (`preset:germany`, `preset:danube`, `preset:usa`, `preset:yangtze`, `preset:ganges`).

## 6. Error handling

- A catalog outfall that does not snap: `ambientSources` skips it (matches the existing `.filter(Boolean)`), but the data test fails, so it cannot ship.
- A malformed ring (< 3 vertices, non-finite): the data test fails.
- `catchmentTarget` on non-finite input returns null, and the caller falls back.

## 7. Tests

- Catalog: 13 entries; finite positive Q; unique keys; total ≈ the briefed figures; each outfall snaps ≤ 8 cells into a basin ≥ 40 cells; the Amazon carries the largest discharge of any ambient source (assert against the max of all sources); every entry has a source note.
- Frozen presets: the existing preset tests pass unmodified; `ambientSources(...).slice(0, 9)` is deep-equal to a pre-change snapshot.
- Catchments: Berlin, Manaus, Kinshasa, Cairo, Bamako, Montréal, Yakutsk, Krasnoyarsk, Phnom Penh, Lanzhou, Lahore and Asunción route to Elbe, Amazon, Congo, Nile, Niger, St. Lawrence, Lena, Yenisey, Mekong, Yellow, Indus and Paraná respectively. Points in the Sahara, the Atlantic and Antarctica return null. No overlaps on the lattice.
- Verdict path: Berlin's built source snaps to the Elbe outfall cell (not the Baltic); an out-of-catchment site is unchanged from today's snap (regression).
- Ocean runtime: `parityProbe` and the render tests still pass with 22 sources (9 + 13); a snapshot screenshot of the Atlantic, Africa and the Arctic confirms the plumes.

## 8. Risks

- **Polygon accuracy.** Hand-drawn rings will misroute sites near divides (for example the Rhine–Elbe–Danube junction in Germany). This is accepted and labelled UNVERIFIED; the fallback is the current behaviour.
- **Visual dominance.** The Amazon at 209,000 m³/s is about 5× the next source and may saturate the plume colour scale. Verified in the screenshot task; the fix, if needed, is a display-side clamp, not a change to Q.
- **Source count.** No fixed cap was found in `gpu/`, and `parityProbe` should be re-run to confirm 22 sources are handled.
- Catalog sources also get a HUD ring and tooltip (`AMBIENT RIVER`), styled like presets at 0.6 opacity; `prepareRiver` skips `kind: 'catalog'`.
