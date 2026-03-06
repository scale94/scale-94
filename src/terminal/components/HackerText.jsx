import React, { useState, useEffect } from 'react';

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_+-=|;:,<>?";
const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];

// preseed: fills every non-space position with a random glyph at full length.
// This reserves the final layout box before the first paint — prevents the
// container collapsing to zero height during the font-load wait.
const preseed = (str) =>
  str.split('').map(c => (c === ' ' ? ' ' : randChar())).join('');

const HackerText = ({ text, className }) => {
  // Initialise with a same-length scrambled string so the container has its
  // final height before any interval or font-ready callback fires.
  const [displayText, setDisplayText] = useState(() => preseed(text || ''));

  useEffect(() => {
    if (!text) {
      setDisplayText('');
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
