import React, { useState, useEffect } from 'react';

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_+-=|;:,<>?";
const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];

// Pre-scramble: fill every non-space character position with a random glyph.
// Spaces are preserved so word-wrap boundaries are stable from the very first frame —
// this is what prevents the layout shift when the component mounts.
const preseed = (str) =>
  str.split('').map(c => (c === ' ' ? ' ' : randChar())).join('');

const HackerText = ({ text, className }) => {
  // Initialise with a same-length scrambled string so the <h1> container
  // has its final height before the first interval tick fires.
  const [displayText, setDisplayText] = useState(() => preseed(text || ''));

  useEffect(() => {
    if (!text) {
      setDisplayText('');
      return;
    }

    // Reset to a fresh scramble whenever the text prop changes (new article).
    setDisplayText(preseed(text));

    let iterations = 0;
    // 50ms (~20fps) instead of 30ms (~33fps) — cuts re-renders by ~40%
    const interval = setInterval(() => {
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
      }
    }, 50);

    return () => clearInterval(interval);
  }, [text]);

  return <span className={className}>{displayText}</span>;
};

export default HackerText;
