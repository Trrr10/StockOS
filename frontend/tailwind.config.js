/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent:  '#7effd4',
        danger:  '#ff4d6d',
        warn:    '#ffb347',
        surface: '#0d0e1a',
        card:    '#12131f',
        obsidian:'#07080f',
      },
      fontFamily: {
        display: ['Clash Display', 'DM Sans', 'sans-serif'],
        body:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}