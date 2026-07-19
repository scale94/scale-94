// api/og.js — Dynamic Open Graph / Twitter card image for link previews
// (Bluesky, Discord, etc.). Mirrors the actual /KERNEL tab (system_kernel
// header, Axiomatic Law I thesis, PF/tty0 footer) rather than invented copy —
// see src/terminal/views/KernelTab.jsx for the source of truth on colors
// and text.
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const GOLD = '#FFD700';
const MARKER_GOLD = '#d4a82a';
const THESIS_PALE = '#e8d28a';
const PF_GREEN = '#39ff14';
const CYAN_BORDER = '#0e3a42';

function el(type, props, ...children) {
  const flat = children.flat();
  // satori only exempts a div with a plain string `children` from the
  // explicit-display requirement; an empty or single-item array is still
  // truthy, so collapse 0/1/N children the way JSX actually would.
  const resolved = flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat;
  return { type, props: { ...props, children: resolved } };
}

export default function handler() {
  return new ImageResponse(
    el(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '56px 64px',
          backgroundColor: '#000000',
          backgroundImage: 'radial-gradient(circle at 88% 8%, #6b1e5c 0%, #1a0a1e 35%, #000000 65%)',
        },
      },
      // ── header: system_kernel + Axiomatic Law I thesis ──
      el(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        el(
          'div',
          { style: { display: 'flex', alignItems: 'center', marginBottom: '28px' } },
          el(
            'svg',
            { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', stroke: GOLD, style: { marginRight: '16px' } },
            el('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 }),
            el('rect', { x: 9, y: 9, width: 6, height: 6, rx: 1 })
          ),
          el(
            'span',
            {
              style: {
                display: 'flex',
                fontFamily: 'monospace',
                fontSize: '48px',
                fontWeight: 700,
                color: GOLD,
              },
            },
            'system_kernel'
          )
        ),
        el(
          'span',
          {
            style: {
              display: 'flex',
              fontFamily: 'monospace',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: MARKER_GOLD,
              marginBottom: '14px',
            },
          },
          'AXIOMATIC LAW I'
        ),
        el(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              fontSize: '38px',
              color: THESIS_PALE,
            },
          },
          el('span', { style: { display: 'flex' } }, 'THEORY THAT CANNOT BE COMPILED'),
          el('span', { style: { display: 'flex', color: MARKER_GOLD } }, 'DOES NOT YET EXIST AS KNOWLEDGE')
        )
      ),
      // ── footer: PF meter + tty0 log, echoing the real kernel console ──
      el(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            borderTop: `1px solid ${CYAN_BORDER}`,
            paddingTop: '22px',
            fontFamily: 'monospace',
          },
        },
        el(
          'div',
          { style: { display: 'flex', alignItems: 'center', marginBottom: '14px' } },
          el('span', { style: { color: PF_GREEN, fontSize: '13px', fontWeight: 700, marginRight: '10px' } }, 'PF'),
          el('div', {
            style: {
              display: 'flex',
              width: '260px',
              height: '8px',
              backgroundColor: PF_GREEN,
              borderRadius: '1px',
            },
          }),
          el(
            'span',
            { style: { color: '#6b7280', fontSize: '13px', marginLeft: '16px' } },
            '/dev/tty0'
          )
        ),
        el(
          'div',
          { style: { display: 'flex', fontSize: '17px', color: PF_GREEN } },
          el('span', { style: { color: MARKER_GOLD, marginRight: '12px' } }, 'tty0:~$'),
          'SYSTEM_KERNEL_LOG: manifest loaded // kernels indexed'
        )
      )
    ),
    { width: 1200, height: 630 }
  );
}
