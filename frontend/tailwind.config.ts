import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          25: '#f7f8ff',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        accent: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5f5',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        surface: {
          50: '#f8fafc',
          100: '#f5f7fb',
          200: '#eef2f6',
          300: '#e3e8f0',
          400: '#d4dae5',
        },
        border: '#e2e8f0',
        focus: '#c7d2fe',
        overlay: 'rgba(15, 23, 42, 0.65)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.75rem',
        '3xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(15, 23, 42, 0.08)',
        elevated: '0 15px 45px rgba(15, 23, 42, 0.12)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        ring: '0 0 0 1px rgba(99, 102, 241, 0.15)',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
        90: '22.5rem',
      },
      backdropBlur: {
        xs: '6px',
      },
      maxWidth: {
        '8xl': '96rem',
      },
      backgroundImage: {
        'app-grid': 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.25), transparent 0)',
        'app-spotlight': 'radial-gradient(600px at 5% 15%, rgba(99,102,241,0.12), transparent)',
      },
      transitionTimingFunction: {
        'snappy': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config

