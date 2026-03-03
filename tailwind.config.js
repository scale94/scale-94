// ESM imports — required because package.json has "type": "module".
// require() is CJS and is not defined in ESM scope. Mixing them causes
// plugins to silently fail in production (Tailwind CLI + PostCSS pipeline
// loads this via Node's native ESM handler where require() doesn't exist).
import typography from '@tailwindcss/typography';
import animate    from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./content/**/*.md",
  ],
  theme: {
    extend: {
      // Gradient shimmer keyframe + utilities — defined here so they are
      // guaranteed in the production CSS bundle (Tailwind generates them as
      // first-class utilities, unlike custom index.css classes which can be
      // stripped or mis-ordered by the PostCSS pipeline in production builds).
      keyframes: {
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':       { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'shimmer-fast': 'gradient-x 3s linear infinite',
        'shimmer-slow': 'gradient-x 6s ease   infinite',
      },
    },
  },
  plugins: [
    typography,
    animate,
  ],
}
