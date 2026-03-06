import React, { useState, useEffect } from 'react';

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_+-=|;:,<>?";
const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];

// preseed: produces a scrambled string whose length is EXACTLY str.length.
// Length parity is the critical invariant — if preseed were shorter the
// container would 'pop' open when the real title arrives and its wider
// character set fills more horizontal space, causing a line-count jump.
//
// Space characters are preserved as spaces (not replaced with glyphs) so
// that word-wrap boundaries are identical between the scrambled and final
// states. The browser sees the same wrap points on every frame.
const preseed = (str) => {
  if (!str) return '';
  const out = str.split('').map(c => (c === ' ' ? ' ' : randChar())).join('');
  // Defensive assertion: output must be the same length as input.
  // If this ever fires it means str contains multi-codepoint grapheme clusters
  // (e.g. emoji) that split() counts as multiple chars. Caller should sanitise.
  if (out.length !== str.length) {
    console.warn('[HackerText] preseed length mismatch — input:', str.length, 'output:', out.length);
  }
  return out;
};

const HackerText = ({ text, className }) => {
  // Initialise display text. If the user prefers reduced motion, show the real
  // string immediately (no scramble on first paint either). Otherwise preseed
  // a same-length scramble so the container has its final height before the
  // interval or font-ready callback fires.
  const [displayText, setDisplayText] = useState(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return text || '';
    return preseed(text || '');
  });

  useEffect(() => {
    if (!text) {
      setDisplayText('');
      return;
    }

    // Respect the OS/browser "prefer reduced motion" setting.
    // Skips the scramble entirely — renders the final string instantly.
    // This also benefits users on low-power mobile devices.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(text);
      return;
    }

    // Reset to a fresh scramble on every text change (new article, or remount).
    // The scramble holds until fonts are confirmed ready — no invisible-glyph flash.
    setDisplayText(preseed(text));

    let interval = null;
    let cancelled = false;

    // document.fonts.ready resolves immediately if fonts are already loaded,
    // so there is no delay on subsequent mounts. On first mount it waits for
    // the custom font-face to finish loading before the scramble begins,
    // preventing the "invisible text jumps" caused by FOUT mid-animation.
    document.fonts.ready.then(() => {
      if (cancelled) return;

      let iterations = 0;
      interval = setInterval(() => {
        setDisplayText(
          text
            .split('')
            .map((letter, index) => {
              if (index < iterations) return text[index];
              return letter === ' ' ? ' ' : randChar();
            })
            .join('')
        );

        iterations += 0.5;

        if (iterations >= text.length) {
          clearInterval(interval);
          interval = null;
        }
      }, 50);
    });

    return () => {
      cancelled = true;
      if (interval !== null) clearInterval(interval);
    };
  }, [text]);

  return <span className={className}>{displayText}</span>;
};

export default HackerText;
