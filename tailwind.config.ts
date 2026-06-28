import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        slate: {
          850: '#1e293b',
          950: '#020617',
        }
      },
      fontSize: {
        // Override Tailwind defaults to enforce 16px base
        'xs':   ['0.8125rem', { lineHeight: '1.4' }],  // 13px — absolute minimum
        'sm':   ['0.9375rem', { lineHeight: '1.5' }],  // 15px
        'base': ['1rem',      { lineHeight: '1.6' }],  // 16px
        'lg':   ['1.125rem',  { lineHeight: '1.5' }],  // 18px
        'xl':   ['1.25rem',   { lineHeight: '1.45' }], // 20px
        '2xl':  ['1.5rem',    { lineHeight: '1.35' }], // 24px
        '3xl':  ['1.875rem',  { lineHeight: '1.25' }], // 30px
        '4xl':  ['2.25rem',   { lineHeight: '1.15' }], // 36px
        '5xl':  ['3rem',      { lineHeight: '1.1'  }], // 48px
      },
    },
  },
  plugins: [],
};
export default config;
