/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./content/**/*.md", // Ensure tailwind scans your kernels
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
    require('@tailwindcss/typography'),
    // tailwindcss-animate: generates animate-in, fade-in, slide-in-from-*,
    // zoom-in-*, etc. — used across every view component. Without this plugin
    // those classes produce no CSS in production (Tailwind JIT skips unknowns).
    require('tailwindcss-animate'),
  ],
}
