// src/terminal/mercury/SpineMirror.jsx — the altar's live spine (spec §3).
// Names what is marked and where the rest is found. There is deliberately no
// count: three rows where two read Some and one reads None already are the
// count, and a numeral would turn three deliberate acts into chores remaining.
// The field names stay genome-cryptic — the mystery lives there. The tail says
// where, never what.
//
// HUE = PROVENANCE, GOLD = COMMITTED (hue spec §2). Every row wears its house
// hue on a left rule and on its tail, marked or not — a marked tail used to
// render zinc-700, which made provenance the dimmest thing on a row whose whole
// job is provenance. When the altar arms, the three houses resolve into one
// gold in a staggered sweep: three sources becoming one artifact, told in
// colour. Arming had no visual register before this; it had a sentence.
import { VERTEBRAE, truncate } from '../quintessence/vertebrae';

const ARMED_GOLD = 'rgb(251,191,36)';   // amber-400 — one step under the Some() amber-300
const SWEEP_MS = 600;
const STAGGER_MS = 200;

export default function SpineMirror({ spine, armed = false, onNavigate }) {
  return (
    <ul className="mt-3 mb-1 p-0 list-none space-y-1" data-testid="spine-mirror">
      {VERTEBRAE.map((v, i) => {
        const raw = v.preview(spine);
        const marked = raw !== null && raw !== undefined;
        const shown = marked ? (v.quoted ? `"${truncate(raw)}"` : truncate(raw)) : null;
        // The label carries every fact the hue does — if the mirror stops
        // working in greyscale, the words are not doing their job (spec §3).
        const label = marked
          ? `${v.field} — ${raw} · marked at ${v.tab} · walk there`
          : `${v.field} — unmarked · walk to ${v.house}`;
        // An unmarked row can never be armed (armed ⇔ all three marked), so the
        // house hue is the only tail colour absence ever wears.
        const hue = `rgb(${v.tint[0]},${v.tint[1]},${v.tint[2]})`;
        const lit = armed ? ARMED_GOLD : hue;
        // The sweep reads left-to-right down the rows; without the stagger all
        // three flip at once and the resolution reads as a theme change.
        const sweep = {
          transition: `color ${SWEEP_MS}ms ease, border-left-color ${SWEEP_MS}ms ease`,
          transitionDelay: `${i * STAGGER_MS}ms`,
        };
        return (
          <li key={v.key}>
            <button
              type="button"
              aria-label={label}
              onClick={() => onNavigate?.(v.tab)}
              style={{ borderLeft: `2px solid ${lit}`, ...sweep }}
              className="group w-full flex gap-3 items-baseline bg-transparent border-0 p-0 pl-2 text-left font-mono text-[10px] cursor-pointer"
            >
              <span aria-hidden="true" className={marked ? 'text-amber-300' : 'text-zinc-700'}>
                {marked ? `Some(${shown})` : 'None'}
              </span>
              <span aria-hidden="true" className="text-zinc-600">{`// ${v.field}`}</span>
              {marked ? (
                <span aria-hidden="true" className="ml-auto whitespace-nowrap" style={{ color: lit, ...sweep }}>
                  {`✦ marked at /${v.tab.toUpperCase()}`}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="ml-auto whitespace-nowrap opacity-70 transition-opacity group-hover:opacity-100"
                  style={{ color: hue }}
                >
                  {`→ ${v.house} holds it`}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
