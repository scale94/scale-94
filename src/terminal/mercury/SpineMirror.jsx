// src/terminal/mercury/SpineMirror.jsx — the altar's live spine (spec §3).
// Names what is marked and where the rest is found. There is deliberately no
// count: three rows where two read Some and one reads None already are the
// count, and a numeral would turn three deliberate acts into chores remaining.
// The field names stay genome-cryptic — the mystery lives there. The tail says
// where, never what.
import { VERTEBRAE, truncate } from '../quintessence/vertebrae';

export default function SpineMirror({ spine, onNavigate }) {
  return (
    <ul className="mt-3 mb-1 p-0 list-none space-y-1" data-testid="spine-mirror">
      {VERTEBRAE.map(v => {
        const raw = v.preview(spine);
        const marked = raw !== null && raw !== undefined;
        const shown = marked ? (v.quoted ? `"${truncate(raw)}"` : truncate(raw)) : null;
        // The label carries every fact the hue does — if the mirror stops
        // working in greyscale, the words are not doing their job (spec §3).
        const label = marked
          ? `${v.field} — ${raw} · marked at ${v.tab} · walk there`
          : `${v.field} — unmarked · walk to ${v.house}`;
        return (
          <li key={v.key}>
            <button
              type="button"
              aria-label={label}
              onClick={() => onNavigate?.(v.tab)}
              className="group w-full flex gap-3 items-baseline bg-transparent border-0 p-0 text-left font-mono text-[10px] cursor-pointer"
            >
              <span aria-hidden="true" className={marked ? 'text-amber-300' : 'text-zinc-700'}>
                {marked ? `Some(${shown})` : 'None'}
              </span>
              <span aria-hidden="true" className="text-zinc-600">{`// ${v.field}`}</span>
              {marked ? (
                <span aria-hidden="true" className="ml-auto whitespace-nowrap text-zinc-700">
                  {`✦ marked at /${v.tab.toUpperCase()}`}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="ml-auto whitespace-nowrap opacity-70 transition-opacity group-hover:opacity-100"
                  style={{ color: `rgb(${v.tint[0]},${v.tint[1]},${v.tint[2]})` }}
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
