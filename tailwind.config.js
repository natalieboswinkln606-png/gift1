/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-noto-serif)', 'Noto Serif SC', 'serif'],
        display: ['var(--font-playfair)', 'Playfair Display', 'serif'],
      },
      colors: {
        gold: {
          DEFAULT: '#ffd700',
          light: '#ffeeb0',
          dark: '#b8860b',
        },
        'cyber-cyan': '#00ffff',
        'cyber-blue': '#0055ff',
        'cyber-purple': '#aa00ff',
        'cyber-gold': '#ffcc00',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        breathe: 'breathe 3s infinite ease-in-out',
        float: 'float 3s infinite ease-in-out',
      },
    },
  },
  plugins: [],
}
