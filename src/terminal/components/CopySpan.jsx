// CopySpan.jsx
// Tiny clipboard affordance — click to copy, brief COPIED confirmation.
import React from 'react';

export default function CopySpan({ value, color }) {
  const [copied, setCopied] = React.useState(false);
  const handleClick = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <span
      onClick={handleClick}
      style={{ color: copied ? `rgba(255,215,0,0.36)` : color, cursor: 'pointer' }}
    >
      {copied ? 'COPIED' : value}
    </span>
  );
}
