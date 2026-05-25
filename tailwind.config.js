/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F6E56', // Brand Teal
          light: '#148C6E',
          dark: '#0A4D3C'
        },
        accent: {
          DEFAULT: '#854F0B', // Warm Amber
          light: '#B26A0E',
          dark: '#5C3707'
        },
        danger: {
          DEFAULT: '#993C1D', // Coral Red
          light: '#BF4B24',
          dark: '#6E2B14'
        },
        background: '#F8F9FA',
        card: '#FFFFFF',
        textPrimary: '#1A1A1A',
        textSecondary: '#5F5E5A',
      },
      fontFamily: {
        head: ['var(--font-head)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['DM Mono', 'monospace']
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)'
      }
    },
  },
  plugins: [],
}
