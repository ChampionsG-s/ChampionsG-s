import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#070b16',
        surface: '#101a30',
        'surface-2': '#0a0f1e',
        border: '#213050',
        gold: '#d4a017',
        'gold-2': '#f0bb28',
        cream: '#f3f5fa',
        muted: '#6e85ab',
        'spain-red': '#c60b1e',
        'spain-yellow': '#f1bf00',
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'sans-serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
