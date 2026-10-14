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
      fontSize: {
        /* Semantic type scale */
        'display': ['2rem', { lineHeight: '1.15', fontWeight: '800', letterSpacing: '-0.02em' }],      /* 32px – hero numbers */
        'title':   ['1.375rem', { lineHeight: '1.25', fontWeight: '700', letterSpacing: '-0.015em' }], /* 22px – section titles */
        'subtitle':['1.0625rem', { lineHeight: '1.4', fontWeight: '600' }],                            /* 17px – card headings */
        'body':    ['0.9375rem', { lineHeight: '1.55' }],                                              /* 15px – body copy */
        'caption': ['0.8125rem', { lineHeight: '1.4' }],                                              /* 13px – labels, secondary */
        'micro':   ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.04em' }],                     /* 11px – badges, metadata */
      },
      boxShadow: {
        subtle:   '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
        card:     '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 8px 24px rgba(15, 110, 86, 0.10), 0 2px 6px rgba(0,0,0,0.06)',
        elevated: '0 4px 16px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        card: '1rem',      /* 16px – all cards */
        pill: '999px',     /* pill buttons */
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '18': '4.5rem',
      }
    },
  },
  plugins: [],
}
